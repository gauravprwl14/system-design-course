# POC #62: Write-Through vs Write-Behind Caching

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Cache-aside pattern, Redis basics

## What You'll Learn

Two strategies for keeping cache and database in sync during writes:

```
WRITE-THROUGH (Synchronous):
┌─────────────────────────────────────────────────────────┐
│  Write Request                                          │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────┐    1. Write    ┌──────────┐               │
│  │  Cache  │ ───────────────▶│ Database │               │
│  │ (Redis) │                 └──────────┘               │
│  └─────────┘                      │                     │
│       │◀──────────────────────────┘                     │
│       │        2. Confirm                               │
│       ▼                                                 │
│  Return Success (after BOTH complete)                   │
└─────────────────────────────────────────────────────────┘

WRITE-BEHIND (Asynchronous):
┌─────────────────────────────────────────────────────────┐
│  Write Request                                          │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────┐                                            │
│  │  Cache  │────▶ Return Success (immediately)         │
│  │ (Redis) │                                            │
│  └─────────┘                                            │
│       │                                                 │
│       │  Background (async)                             │
│       ▼                                                 │
│  ┌──────────┐                                           │
│  │ Database │  (writes batched and persisted later)    │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: demo
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

```sql
-- init.sql
CREATE TABLE user_sessions (
    user_id VARCHAR(36) PRIMARY KEY,
    session_data JSONB,
    last_activity TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE page_views (
    id SERIAL PRIMARY KEY,
    page_url VARCHAR(500),
    view_count INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO page_views (page_url, view_count) VALUES
    ('/home', 0),
    ('/products', 0),
    ('/about', 0);
```

---

## Implementation

```javascript
// write-caching.js
const Redis = require('ioredis');
const { Pool } = require('pg');

const redis = new Redis({ host: 'localhost', port: 6379 });
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'demo',
  password: 'demo',
  database: 'demo'
});

// ==========================================
// WRITE-THROUGH PATTERN
// ==========================================

class WriteThroughCache {
  constructor(prefix) {
    this.prefix = prefix;
  }

  async write(key, data) {
    const cacheKey = `${this.prefix}:${key}`;
    const startTime = Date.now();

    // Step 1: Write to database first (synchronous)
    await pool.query(
      `INSERT INTO user_sessions (user_id, session_data, last_activity)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET session_data = $2, last_activity = NOW(), updated_at = NOW()`,
      [key, JSON.stringify(data)]
    );

    // Step 2: Write to cache (synchronous)
    await redis.setex(cacheKey, 3600, JSON.stringify(data));

    const elapsed = Date.now() - startTime;
    console.log(`📝 WRITE-THROUGH: ${key} (${elapsed}ms) - DB + Cache updated synchronously`);

    return { latency: elapsed, pattern: 'write-through' };
  }

  async read(key) {
    const cacheKey = `${this.prefix}:${key}`;

    // Always read from cache (guaranteed fresh due to write-through)
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`✅ READ: ${key} from cache (always fresh)`);
      return JSON.parse(cached);
    }

    // Fallback to database if cache miss (rare - only if evicted)
    const result = await pool.query(
      'SELECT session_data FROM user_sessions WHERE user_id = $1',
      [key]
    );

    if (result.rows.length > 0) {
      const data = result.rows[0].session_data;
      await redis.setex(cacheKey, 3600, JSON.stringify(data));
      return data;
    }

    return null;
  }
}

// ==========================================
// WRITE-BEHIND PATTERN (Async/Batched)
// ==========================================

class WriteBehindCache {
  constructor(prefix) {
    this.prefix = prefix;
    this.writeBuffer = new Map();
    this.flushInterval = null;
    this.BATCH_SIZE = 10;
    this.FLUSH_INTERVAL_MS = 5000; // 5 seconds

    this.startBackgroundFlush();
  }

  async write(key, data) {
    const cacheKey = `${this.prefix}:${key}`;
    const startTime = Date.now();

    // Step 1: Write to cache immediately
    await redis.setex(cacheKey, 3600, JSON.stringify(data));

    // Step 2: Queue for background database write
    this.writeBuffer.set(key, {
      data,
      timestamp: Date.now()
    });

    const elapsed = Date.now() - startTime;
    console.log(`⚡ WRITE-BEHIND: ${key} (${elapsed}ms) - Cache updated, DB queued`);
    console.log(`   📋 Buffer size: ${this.writeBuffer.size}`);

    // Flush if buffer is full
    if (this.writeBuffer.size >= this.BATCH_SIZE) {
      await this.flush();
    }

    return { latency: elapsed, pattern: 'write-behind', queued: true };
  }

  startBackgroundFlush() {
    this.flushInterval = setInterval(async () => {
      if (this.writeBuffer.size > 0) {
        await this.flush();
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  async flush() {
    if (this.writeBuffer.size === 0) return;

    const entries = Array.from(this.writeBuffer.entries());
    this.writeBuffer.clear();

    console.log(`\n🔄 FLUSHING ${entries.length} entries to database...`);
    const startTime = Date.now();

    // Batch insert/update
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [key, { data }] of entries) {
        await client.query(
          `INSERT INTO user_sessions (user_id, session_data, last_activity)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET session_data = $2, last_activity = NOW(), updated_at = NOW()`,
          [key, JSON.stringify(data)]
        );
      }

      await client.query('COMMIT');
      const elapsed = Date.now() - startTime;
      console.log(`✅ FLUSHED: ${entries.length} entries in ${elapsed}ms`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ FLUSH FAILED:', error.message);
      // Re-queue failed writes (in production, use a proper retry mechanism)
      for (const [key, value] of entries) {
        this.writeBuffer.set(key, value);
      }
    } finally {
      client.release();
    }
  }

  async read(key) {
    const cacheKey = `${this.prefix}:${key}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`✅ READ: ${key} from cache`);
      return JSON.parse(cached);
    }

    // Check write buffer (data not yet persisted)
    if (this.writeBuffer.has(key)) {
      console.log(`✅ READ: ${key} from write buffer (pending flush)`);
      return this.writeBuffer.get(key).data;
    }

    // Fallback to database
    const result = await pool.query(
      'SELECT session_data FROM user_sessions WHERE user_id = $1',
      [key]
    );

    if (result.rows.length > 0) {
      const data = result.rows[0].session_data;
      await redis.setex(cacheKey, 3600, JSON.stringify(data));
      return data;
    }

    return null;
  }

  async stop() {
    clearInterval(this.flushInterval);
    await this.flush(); // Final flush
  }
}

// ==========================================
// PERFORMANCE COMPARISON
// ==========================================

async function benchmark() {
  console.log('='.repeat(60));
  console.log('WRITE-THROUGH vs WRITE-BEHIND COMPARISON');
  console.log('='.repeat(60));

  await redis.flushdb();
  await pool.query('TRUNCATE user_sessions');

  const writeThrough = new WriteThroughCache('wt:session');
  const writeBehind = new WriteBehindCache('wb:session');

  const NUM_WRITES = 20;

  // Benchmark Write-Through
  console.log('\n--- Write-Through Benchmark ---');
  let wtTotal = 0;
  for (let i = 0; i < NUM_WRITES; i++) {
    const result = await writeThrough.write(`user-wt-${i}`, {
      cart: [`item-${i}`],
      lastPage: '/products'
    });
    wtTotal += result.latency;
  }
  console.log(`\n📊 Write-Through: ${NUM_WRITES} writes in ${wtTotal}ms`);
  console.log(`   Average: ${(wtTotal / NUM_WRITES).toFixed(2)}ms per write`);

  // Benchmark Write-Behind
  console.log('\n--- Write-Behind Benchmark ---');
  let wbTotal = 0;
  for (let i = 0; i < NUM_WRITES; i++) {
    const result = await writeBehind.write(`user-wb-${i}`, {
      cart: [`item-${i}`],
      lastPage: '/checkout'
    });
    wbTotal += result.latency;
  }
  console.log(`\n📊 Write-Behind: ${NUM_WRITES} writes in ${wbTotal}ms`);
  console.log(`   Average: ${(wbTotal / NUM_WRITES).toFixed(2)}ms per write`);

  // Comparison
  console.log('\n--- Performance Summary ---');
  console.log(`Write-Through: ${wtTotal}ms total`);
  console.log(`Write-Behind:  ${wbTotal}ms total`);
  console.log(`Speedup: ${(wtTotal / wbTotal).toFixed(2)}x faster with write-behind`);

  // Wait for final flush
  console.log('\n--- Waiting for Write-Behind Flush ---');
  await new Promise(resolve => setTimeout(resolve, 6000));
  await writeBehind.stop();

  // Verify data consistency
  console.log('\n--- Data Verification ---');
  const dbCount = await pool.query('SELECT COUNT(*) FROM user_sessions');
  const cacheKeys = await redis.keys('*:session:*');
  console.log(`Database records: ${dbCount.rows[0].count}`);
  console.log(`Cache entries: ${cacheKeys.length}`);
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  await benchmark();

  // Cleanup
  await redis.quit();
  await pool.end();
}

demonstrate().catch(console.error);
```

---

## Run the POC

```bash
docker-compose up -d
sleep 5
npm install ioredis pg
node write-caching.js
```

---

## Expected Output

```
============================================================
WRITE-THROUGH vs WRITE-BEHIND COMPARISON
============================================================

--- Write-Through Benchmark ---
📝 WRITE-THROUGH: user-wt-0 (12ms) - DB + Cache updated synchronously
📝 WRITE-THROUGH: user-wt-1 (8ms) - DB + Cache updated synchronously
...
📝 WRITE-THROUGH: user-wt-19 (7ms) - DB + Cache updated synchronously

📊 Write-Through: 20 writes in 165ms
   Average: 8.25ms per write

--- Write-Behind Benchmark ---
⚡ WRITE-BEHIND: user-wb-0 (2ms) - Cache updated, DB queued
   📋 Buffer size: 1
⚡ WRITE-BEHIND: user-wb-1 (1ms) - Cache updated, DB queued
   📋 Buffer size: 2
...
🔄 FLUSHING 10 entries to database...
✅ FLUSHED: 10 entries in 45ms
...
⚡ WRITE-BEHIND: user-wb-19 (1ms) - Cache updated, DB queued
   📋 Buffer size: 10

📊 Write-Behind: 20 writes in 32ms
   Average: 1.60ms per write

--- Performance Summary ---
Write-Through: 165ms total
Write-Behind:  32ms total
Speedup: 5.16x faster with write-behind

--- Waiting for Write-Behind Flush ---
🔄 FLUSHING 10 entries to database...
✅ FLUSHED: 10 entries in 38ms

--- Data Verification ---
Database records: 40
Cache entries: 40
```

---

## Comparison Table

| Aspect | Write-Through | Write-Behind |
|--------|---------------|--------------|
| **Write Latency** | High (DB + Cache sync) | Low (Cache only) |
| **Data Consistency** | Strong | Eventual |
| **Durability** | Immediate | Delayed |
| **Risk of Data Loss** | None | If crash before flush |
| **Database Load** | Per-write | Batched |
| **Complexity** | Simple | More complex |
| **Use Cases** | Critical data (payments) | High-write (analytics, sessions) |

---

## When to Use Each Pattern

### Write-Through

```
✅ Use when:
- Data consistency is critical
- Writes are infrequent
- Cannot afford data loss
- Simple architecture preferred

Examples:
- User account updates
- Payment transactions
- Inventory changes
- Configuration settings
```

### Write-Behind

```
✅ Use when:
- Write performance is critical
- Can tolerate brief inconsistency
- High write volume
- Data loss of recent writes is acceptable

Examples:
- Page view counters
- User activity logs
- Session data
- Real-time analytics
```

---

## Production Considerations

### Write-Behind Durability

```javascript
// For critical write-behind, persist queue to Redis
class DurableWriteBehind {
  async write(key, data) {
    // Write to cache
    await redis.setex(`cache:${key}`, TTL, JSON.stringify(data));

    // Add to durable queue (survives process restart)
    await redis.lpush('write-behind-queue', JSON.stringify({ key, data, timestamp: Date.now() }));
  }

  async processQueue() {
    while (true) {
      const item = await redis.brpop('write-behind-queue', 0);
      const { key, data } = JSON.parse(item[1]);
      await this.persistToDatabase(key, data);
    }
  }
}
```

---

## Related POCs

- [POC #61: Cache-Aside Pattern](/interview-prep/practice-pocs/cache-aside-pattern)
- [POC #63: Cache Invalidation](/interview-prep/practice-pocs/cache-invalidation-strategies)
- [Caching Strategies Article](/system-design/caching/caching-strategies)
