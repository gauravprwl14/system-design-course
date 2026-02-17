#!/usr/bin/env node
/**
 * Complete Data Archival System in Node.js
 *
 * Usage:
 *   node archival_system.js archive --days 90
 *   node archival_system.js query --days 30
 *   node archival_system.js restore --record-id 12345
 *   node archival_system.js stats
 */

const { Pool } = require('pg');

// Database configurations
const HOT_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'archival_poc',
  user: 'postgres',
  password: 'postgres',
};

const ARCHIVE_DB_CONFIG = {
  host: 'localhost',
  port: 5433,
  database: 'archival_archive',
  user: 'postgres',
  password: 'postgres',
};

class ArchivalSystem {
  constructor() {
    this.hotPool = new Pool(HOT_DB_CONFIG);
    this.archivePool = new Pool(ARCHIVE_DB_CONFIG);
    this.cutoffDays = 90;
  }

  async close() {
    await this.hotPool.end();
    await this.archivePool.end();
  }

  // ==================== ARCHIVE WORKER ====================

  async runArchival(tableName = 'orders', retentionDays = 90, batchSize = 10000) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`\nStarting archival for ${tableName}`);
    console.log(`Cutoff date: ${cutoffDate.toISOString()}`);
    console.log(`Batch size: ${batchSize}`);

    let totalArchived = 0;
    let batchCount = 0;
    const archiveTable = `${tableName}_archive`;

    while (true) {
      const archived = await this._archiveBatch(tableName, archiveTable, cutoffDate, batchSize);

      if (archived === 0) break;

      totalArchived += archived;
      batchCount++;
      console.log(`Batch ${batchCount}: archived ${archived} records (total: ${totalArchived})`);

      // Small delay to reduce load
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`\nArchival complete!`);
    console.log(`Total records archived: ${totalArchived}`);
    console.log(`Batches processed: ${batchCount}`);

    return { tableName, recordsArchived: totalArchived, batchesProcessed: batchCount };
  }

  async _archiveBatch(tableName, archiveTable, cutoffDate, batchSize) {
    const hotClient = await this.hotPool.connect();
    const archiveClient = await this.archivePool.connect();

    try {
      await hotClient.query('BEGIN');

      // Select old records
      const selectResult = await hotClient.query(
        `
        SELECT * FROM ${tableName}
        WHERE created_at < $1
          AND status NOT IN ('pending', 'processing')
        ORDER BY created_at
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      `,
        [cutoffDate, batchSize]
      );

      if (selectResult.rows.length === 0) {
        await hotClient.query('ROLLBACK');
        return 0;
      }

      const records = selectResult.rows;
      const recordIds = records.map((r) => r.id);

      // Insert into archive
      for (const record of records) {
        const columns = Object.keys(record);
        const values = Object.values(record);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        await archiveClient.query(
          `
          INSERT INTO ${archiveTable} (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING
        `,
          values
        );
      }

      // Track and delete
      for (const id of recordIds) {
        await hotClient.query(
          `
          INSERT INTO archive_tracking (table_name, record_id, storage_tier, archived_at)
          VALUES ($1, $2, 'archive', NOW())
          ON CONFLICT (table_name, record_id)
          DO UPDATE SET storage_tier = 'archive', archived_at = NOW()
        `,
          [tableName, id]
        );
      }

      await hotClient.query(`DELETE FROM ${tableName} WHERE id = ANY($1)`, [recordIds]);

      await hotClient.query('COMMIT');
      return records.length;
    } catch (err) {
      await hotClient.query('ROLLBACK');
      throw err;
    } finally {
      hotClient.release();
      archiveClient.release();
    }
  }

  // ==================== QUERY ROUTER ====================

  determineTier(startDate, endDate) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - this.cutoffDays);

    if (!startDate && !endDate) return 'hot';
    if (!endDate) endDate = now;
    if (!startDate) startDate = new Date(0);

    if (startDate >= cutoff) return 'hot';
    if (endDate < cutoff) return 'archive';
    return 'both';
  }

  async queryOrders({ userId, startDate, endDate, status, limit = 100 } = {}) {
    const tier = this.determineTier(startDate, endDate);
    console.log(`Query routing to tier: ${tier}`);

    const startTime = Date.now();
    let results = [];
    const tiersQueried = [];

    if (tier === 'hot' || tier === 'both') {
      const hotResults = await this._queryTable('orders', { userId, startDate, endDate, status, limit });
      results.push(...hotResults.map((r) => ({ ...r, _storage_tier: 'hot' })));
      tiersQueried.push('hot');
    }

    if (tier === 'archive' || tier === 'both') {
      const archiveResults = await this._queryTable('orders_archive', {
        userId,
        startDate,
        endDate,
        status,
        limit,
        isArchive: true,
      });
      results.push(...archiveResults.map((r) => ({ ...r, _storage_tier: 'archive' })));
      tiersQueried.push('archive');
    }

    // Sort by date descending
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const latencyMs = Date.now() - startTime;

    return {
      orders: results.slice(0, limit),
      count: results.length,
      tiersQueried,
      routingDecision: tier,
      latencyMs,
    };
  }

  async _queryTable(tableName, { userId, startDate, endDate, status, limit, isArchive = false }) {
    const pool = isArchive ? this.archivePool : this.hotPool;
    let query = `SELECT * FROM ${tableName} WHERE 1=1`;
    const params = [];
    let paramIdx = 1;

    if (userId) {
      query += ` AND user_id = $${paramIdx++}`;
      params.push(userId);
    }
    if (startDate) {
      query += ` AND created_at >= $${paramIdx++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND created_at <= $${paramIdx++}`;
      params.push(endDate);
    }
    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // ==================== RESTORE SERVICE ====================

  async restoreRecord(tableName, recordId, keepInArchive = true) {
    const archiveTable = `${tableName}_archive`;

    // Fetch from archive
    const archiveResult = await this.archivePool.query(`SELECT * FROM ${archiveTable} WHERE id = $1`, [recordId]);

    if (archiveResult.rows.length === 0) {
      throw new Error(`Record ${recordId} not found in archive`);
    }

    const record = { ...archiveResult.rows[0] };
    delete record.archived_at;

    console.log(`Found record ${recordId} in archive, restoring...`);

    // Insert into hot storage
    const hotClient = await this.hotPool.connect();
    try {
      await hotClient.query('BEGIN');

      const columns = Object.keys(record);
      const values = Object.values(record);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      await hotClient.query(
        `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
      `,
        values
      );

      await hotClient.query(
        `
        UPDATE archive_tracking
        SET storage_tier = $1
        WHERE table_name = $2 AND record_id = $3
      `,
        [keepInArchive ? 'both' : 'hot', tableName, recordId]
      );

      await hotClient.query('COMMIT');
    } catch (err) {
      await hotClient.query('ROLLBACK');
      throw err;
    } finally {
      hotClient.release();
    }

    // Remove from archive if requested
    if (!keepInArchive) {
      await this.archivePool.query(`DELETE FROM ${archiveTable} WHERE id = $1`, [recordId]);
      console.log(`Removed record ${recordId} from archive`);
    }

    console.log(`Successfully restored record ${recordId}`);
    return record;
  }

  // ==================== STATISTICS ====================

  async getStats() {
    const stats = {};

    // Hot storage
    const hotCount = await this.hotPool.query('SELECT COUNT(*) FROM orders');
    const hotRange = await this.hotPool.query('SELECT MIN(created_at), MAX(created_at) FROM orders');

    stats.hot = {
      count: parseInt(hotCount.rows[0].count),
      oldest: hotRange.rows[0].min,
      newest: hotRange.rows[0].max,
    };

    // Archive storage
    const archiveCount = await this.archivePool.query('SELECT COUNT(*) FROM orders_archive');
    const archiveRange = await this.archivePool.query('SELECT MIN(created_at), MAX(created_at) FROM orders_archive');

    stats.archive = {
      count: parseInt(archiveCount.rows[0].count),
      oldest: archiveRange.rows[0].min,
      newest: archiveRange.rows[0].max,
    };

    // Tracking
    const tracking = await this.hotPool.query(`
      SELECT storage_tier, COUNT(*) as count
      FROM archive_tracking
      GROUP BY storage_tier
    `);
    stats.tracking = tracking.rows.reduce((acc, r) => ({ ...acc, [r.storage_tier]: parseInt(r.count) }), {});

    return stats;
  }

  printStats(stats) {
    console.log('\n' + '='.repeat(60));
    console.log(' STORAGE STATISTICS');
    console.log('='.repeat(60));

    console.log(`\n HOT STORAGE (Primary DB):`);
    console.log(`   Records: ${stats.hot.count.toLocaleString()}`);
    console.log(`   Range: ${stats.hot.oldest?.toISOString().split('T')[0] || 'N/A'} to ${stats.hot.newest?.toISOString().split('T')[0] || 'N/A'}`);

    console.log(`\n ARCHIVE STORAGE (Warm DB):`);
    console.log(`   Records: ${stats.archive.count.toLocaleString()}`);
    console.log(`   Range: ${stats.archive.oldest?.toISOString().split('T')[0] || 'N/A'} to ${stats.archive.newest?.toISOString().split('T')[0] || 'N/A'}`);

    console.log(`\n TRACKING:`);
    for (const [tier, count] of Object.entries(stats.tracking)) {
      console.log(`   ${tier}: ${count.toLocaleString()}`);
    }

    const total = stats.hot.count + stats.archive.count;
    console.log(`\n SUMMARY:`);
    console.log(`   Total: ${total.toLocaleString()}`);
    console.log(`   Hot: ${((stats.hot.count / total) * 100).toFixed(1)}%`);
    console.log(`   Archive: ${((stats.archive.count / total) * 100).toFixed(1)}%`);
  }
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const system = new ArchivalSystem();

  try {
    switch (command) {
      case 'archive': {
        const daysArg = args.find((a) => a.startsWith('--days='));
        const days = daysArg ? parseInt(daysArg.split('=')[1]) : 90;

        const stats = await system.getStats();
        system.printStats(stats);

        console.log('\n' + '-'.repeat(60));
        console.log('Running archival...');
        console.log('-'.repeat(60));

        await system.runArchival('orders', days, 10000);

        console.log('\n' + '-'.repeat(60));
        console.log('After archival:');
        console.log('-'.repeat(60));

        const newStats = await system.getStats();
        system.printStats(newStats);
        break;
      }

      case 'query': {
        const daysArg = args.find((a) => a.startsWith('--days='));
        const userIdArg = args.find((a) => a.startsWith('--user-id='));

        const days = daysArg ? parseInt(daysArg.split('=')[1]) : null;
        const userId = userIdArg ? parseInt(userIdArg.split('=')[1]) : null;

        const startDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

        const result = await system.queryOrders({ userId, startDate, limit: 10 });

        console.log('\n' + '='.repeat(60));
        console.log(' QUERY RESULTS');
        console.log('='.repeat(60));
        console.log(`Tiers queried: ${result.tiersQueried.join(', ')}`);
        console.log(`Routing decision: ${result.routingDecision}`);
        console.log(`Results: ${result.count}`);
        console.log(`Latency: ${result.latencyMs}ms`);

        console.log('\nSample orders:');
        for (const order of result.orders.slice(0, 5)) {
          console.log(
            `  - #${order.id}: $${order.total_amount} (${order.created_at.toISOString().split('T')[0]}) [${order._storage_tier}]`
          );
        }
        break;
      }

      case 'restore': {
        const recordIdArg = args.find((a) => a.startsWith('--record-id='));
        if (!recordIdArg) {
          console.log('Usage: node archival_system.js restore --record-id=12345');
          break;
        }

        const recordId = parseInt(recordIdArg.split('=')[1]);
        const record = await system.restoreRecord('orders', recordId);
        console.log(`Restored: Order #${record.id}, $${record.total_amount}`);
        break;
      }

      case 'stats':
      default: {
        const stats = await system.getStats();
        system.printStats(stats);
        break;
      }
    }
  } finally {
    await system.close();
  }
}

main().catch(console.error);
