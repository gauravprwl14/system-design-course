# Database Connection Pooling

## Question
**"Explain database connection pooling. Why is it important? How do you configure pool size?"**

Common in: Backend, Performance Engineering, System Design interviews

---

## 📊 Quick Answer

**Connection Pooling** = Reuse database connections instead of creating new ones for each request

**Why It Matters**:
- Creating a connection = 20-50ms overhead
- With pooling = <1ms (reuse existing connection)
- **Result**: 20-50x faster database access!

**Without Pool** (1000 req/sec):
```
Request 1 → Create connection (50ms) → Query (10ms) → Close
Request 2 → Create connection (50ms) → Query (10ms) → Close
Total: 60ms per request
```

**With Pool** (1000 req/sec):
```
Request 1 → Get from pool (0.5ms) → Query (10ms) → Return to pool
Request 2 → Get from pool (0.5ms) → Query (10ms) → Return to pool
Total: 10.5ms per request (6x faster!)
```

---

## 🎯 Complete Solution

### 1. Basic Connection Pool (PostgreSQL)

```javascript
// connection-pool.js
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'secret',

  // Pool configuration
  max: 20,                      // Maximum connections in pool
  min: 5,                       // Minimum idle connections
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Wait 2s for available connection
  maxUses: 7500                 // Recycle connection after 7500 uses
});

// Basic query (automatically uses pool)
app.get('/api/users/:id', async (req, res) => {
  try {
    // Pool automatically:
    // 1. Gets available connection
    // 2. Executes query
    // 3. Returns connection to pool
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// For transactions (manually manage connection)
app.post('/api/transfer', async (req, res) => {
  const { fromId, toId, amount } = req.body;

  // Get connection from pool
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
      [amount, fromId]
    );

    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
      [amount, toId]
    );

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Transfer failed' });
  } finally {
    // CRITICAL: Always release connection back to pool!
    client.release();
  }
});
```

---

### 2. Pool Configuration Best Practices

#### Optimal Pool Size Formula

```
Optimal Pool Size = (Core Count × 2) + Effective Spindle Count

For cloud databases (SSD):
Pool Size = CPU Cores × 2 + 1

Example:
- Database: 4 CPU cores
- Optimal pool size: 4 × 2 + 1 = 9

For application servers (multiple instances):
- 3 app servers
- Pool size per server: 10
- Total connections: 30
- Database max_connections: 100 (allow headroom)
```

**Configuration Examples**:

```javascript
// Small app (1 server, light load)
const pool = new Pool({
  max: 10,   // Max 10 connections
  min: 2     // Keep 2 idle connections
});

// Medium app (3 servers, moderate load)
const pool = new Pool({
  max: 20,   // Max 20 connections per server (60 total)
  min: 5     // Keep 5 idle connections
});

// Large app (10 servers, heavy load)
const pool = new Pool({
  max: 15,   // Max 15 per server (150 total)
  min: 10,   // Keep 10 idle
  idleTimeoutMillis: 60000  // Longer timeout for high traffic
});
```

---

### 3. Pool Monitoring

```javascript
// pool-monitoring.js
class MonitoredPool extends Pool {
  constructor(config) {
    super(config);

    // Track metrics
    this.metrics = {
      checkouts: 0,
      timeouts: 0,
      errors: 0
    };

    // Log pool stats every 10 seconds
    setInterval(() => {
      console.log('Pool Stats:', {
        total: this.totalCount,
        idle: this.idleCount,
        waiting: this.waitingCount,
        checkouts: this.metrics.checkouts,
        timeouts: this.metrics.timeouts,
        errors: this.metrics.errors
      });

      // Alert if pool is exhausted
      if (this.waitingCount > 5) {
        console.error('⚠️ POOL EXHAUSTED: %d requests waiting', this.waitingCount);
      }

      // Reset metrics
      this.metrics.checkouts = 0;
      this.metrics.timeouts = 0;
      this.metrics.errors = 0;
    }, 10000);
  }

  async query(text, params) {
    this.metrics.checkouts++;

    const start = Date.now();

    try {
      const result = await super.query(text, params);

      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn('Slow query (%dms):', duration, text.substring(0, 100));
      }

      return result;
    } catch (err) {
      this.metrics.errors++;
      throw err;
    }
  }

  async connect() {
    const timeout = setTimeout(() => {
      this.metrics.timeouts++;
      console.error('⚠️ CONNECTION TIMEOUT');
    }, this.options.connectionTimeoutMillis);

    try {
      const client = await super.connect();
      clearTimeout(timeout);
      return client;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

// Usage
const pool = new MonitoredPool({
  max: 20,
  min: 5,
  connectionTimeoutMillis: 2000
});

// Expose metrics endpoint
app.get('/api/metrics/pool', (req, res) => {
  res.json({
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    checkouts: pool.metrics.checkouts,
    timeouts: pool.metrics.timeouts,
    errors: pool.metrics.errors
  });
});

/*
Example metrics output:
{
  "total": 15,      // 15 connections exist
  "idle": 8,        // 8 are idle
  "waiting": 0,     // No requests waiting
  "checkouts": 1234, // 1234 queries in last 10s
  "timeouts": 0,    // No timeouts
  "errors": 2       // 2 errors
}
*/
```

---

### 4. Pool Sizing Strategies

#### Strategy 1: Fixed Size (Most Common)

```javascript
// Fixed pool: Always maintain connections
const pool = new Pool({
  max: 20,  // Never exceed 20
  min: 10   // Always keep 10 idle
});

// Pros: Predictable, simple
// Cons: May waste connections during low traffic
```

#### Strategy 2: Dynamic Size

```javascript
// Dynamic pool: Scale with demand
const pool = new Pool({
  max: 50,  // Can scale up to 50
  min: 5,   // Start with 5
  idleTimeoutMillis: 10000  // Close idle after 10s
});

// Pros: Efficient resource usage
// Cons: Connection creation overhead during spikes
```

#### Strategy 3: Per-Route Pools

```javascript
// Different pools for different workloads
const readPool = new Pool({
  host: 'replica.db.example.com',
  max: 30,  // Read-heavy
  min: 10
});

const writePool = new Pool({
  host: 'primary.db.example.com',
  max: 10,  // Write-light
  min: 5
});

// Read from replica pool
app.get('/api/products', async (req, res) => {
  const result = await readPool.query('SELECT * FROM products');
  res.json(result.rows);
});

// Write to primary pool
app.post('/api/products', async (req, res) => {
  const result = await writePool.query('INSERT INTO products ...');
  res.json(result.rows[0]);
});
```

---

### 5. Connection Pool Failure Scenarios

#### Scenario 1: Pool Exhaustion

```javascript
// Problem: All connections busy, new requests wait
app.get('/api/slow-report', async (req, res) => {
  // This query takes 30 seconds!
  const result = await pool.query('SELECT ... (complex analytics query)');
  res.json(result.rows);
});

// If 20 users request this endpoint simultaneously:
// - All 20 pool connections are used
// - 21st user waits (timeout after 2s)

// Solution 1: Increase pool size
const pool = new Pool({ max: 50 });

// Solution 2: Use separate pool for slow queries
const analyticsPool = new Pool({
  max: 5,  // Limit concurrent analytics
  connectionTimeoutMillis: 30000  // Allow 30s timeout
});

app.get('/api/slow-report', async (req, res) => {
  const result = await analyticsPool.query('SELECT ...');
  res.json(result.rows);
});

// Solution 3: Queue slow requests
const queue = [];
const maxConcurrentSlowQueries = 3;
let runningSlowQueries = 0;

app.get('/api/slow-report', async (req, res) => {
  if (runningSlowQueries >= maxConcurrentSlowQueries) {
    return res.status(429).json({
      error: 'Too many concurrent reports. Try again later.'
    });
  }

  runningSlowQueries++;

  try {
    const result = await analyticsPool.query('SELECT ...');
    res.json(result.rows);
  } finally {
    runningSlowQueries--;
  }
});
```

#### Scenario 2: Connection Leak

```javascript
// ❌ BAD: Connection not released (leak!)
app.get('/api/users/:id', async (req, res) => {
  const client = await pool.connect();

  const result = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

  res.json(result.rows[0]);

  // FORGOT to release! Connection leaked!
  // client.release();
});

// After 20 requests, pool is exhausted!

// ✅ GOOD: Always release in finally
app.get('/api/users/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release(); // CRITICAL!
  }
});

// ✅ BETTER: Use pool.query (auto-release)
app.get('/api/users/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
});
```

#### Scenario 3: Database Restart

```javascript
// Handle database connection errors gracefully
pool.on('error', (err, client) => {
  console.error('Unexpected pool error:', err);
  // Don't crash the app!
  // Pool will automatically reconnect
});

pool.on('connect', (client) => {
  console.log('Pool connected to database');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');

  // Close pool (waits for active queries to complete)
  await pool.end();

  console.log('Pool closed');
  process.exit(0);
});
```

---

### 6. Advanced: Multi-Database Pooling

```javascript
// multi-pool.js
class DatabaseCluster {
  constructor() {
    // Primary database (writes)
    this.primary = new Pool({
      host: 'primary.db.example.com',
      max: 20,
      min: 5
    });

    // Read replicas (reads)
    this.replicas = [
      new Pool({ host: 'replica1.db.example.com', max: 30, min: 10 }),
      new Pool({ host: 'replica2.db.example.com', max: 30, min: 10 }),
      new Pool({ host: 'replica3.db.example.com', max: 30, min: 10 })
    ];

    this.currentReplicaIndex = 0;
  }

  // Write to primary
  async write(query, params) {
    return await this.primary.query(query, params);
  }

  // Read from replicas (round-robin)
  async read(query, params) {
    const replica = this.replicas[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicas.length;

    return await replica.query(query, params);
  }

  // Get pool stats
  getStats() {
    return {
      primary: {
        total: this.primary.totalCount,
        idle: this.primary.idleCount,
        waiting: this.primary.waitingCount
      },
      replicas: this.replicas.map((r, i) => ({
        index: i,
        total: r.totalCount,
        idle: r.idleCount,
        waiting: r.waitingCount
      }))
    };
  }

  // Graceful shutdown
  async end() {
    await this.primary.end();
    await Promise.all(this.replicas.map(r => r.end()));
  }
}

// Usage
const db = new DatabaseCluster();

// Writes go to primary
app.post('/api/users', async (req, res) => {
  const result = await db.write(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [req.body.name, req.body.email]
  );

  res.json(result.rows[0]);
});

// Reads go to replicas (load balanced)
app.get('/api/users', async (req, res) => {
  const result = await db.read('SELECT * FROM users ORDER BY created_at DESC LIMIT 100');
  res.json(result.rows);
});

// Expose stats
app.get('/api/metrics/db', (req, res) => {
  res.json(db.getStats());
});
```

---

## 📊 Performance Impact

### Benchmark: With vs Without Pooling

```javascript
// Benchmark setup
const { performance } = require('perf_hooks');

// WITHOUT POOL (create connection per request)
async function withoutPool() {
  const start = performance.now();

  for (let i = 0; i < 100; i++) {
    const client = new Client({ /* ... */ });
    await client.connect();      // 20-50ms overhead!
    await client.query('SELECT 1');
    await client.end();
  }

  const duration = performance.now() - start;
  console.log('Without pool: %dms', duration);
  // ~3000ms (30ms per request)
}

// WITH POOL
async function withPool() {
  const start = performance.now();

  for (let i = 0; i < 100; i++) {
    await pool.query('SELECT 1');  // <1ms overhead
  }

  const duration = performance.now() - start;
  console.log('With pool: %dms', duration);
  // ~200ms (2ms per request) - 15x faster!
}
```

**Results**:
```
Without Pool: 100 requests = 3000ms (30ms each)
With Pool:    100 requests = 200ms (2ms each)
Speedup: 15x faster!
```

---

## 🎓 Interview Tips

### Common Questions

**Q: What's the optimal pool size?**
A: "Use formula: CPU cores × 2 + 1. For 4-core DB, use pool size of 9. If multiple app servers, divide by server count. Example: 3 servers → 3 connections per server = 9 total. Monitor pool stats and adjust if seeing timeouts or idle connections."

**Q: What happens when pool is exhausted?**
A: "New requests wait for available connection. After timeout (default 2s), throw error. Solutions: 1) Increase pool size, 2) Optimize slow queries, 3) Use queue/rate limiting, 4) Add more database replicas."

**Q: How do you detect connection leaks?**
A: "Monitor pool.totalCount over time. If it keeps growing and never decreases, you have a leak. Check for missing client.release() calls. Use `pool.query()` instead of manual `pool.connect()` to avoid leaks."

**Q: Should you use one pool or multiple pools?**
A: "Depends on workload. Single pool for simple apps. Multiple pools for: 1) Read vs write (different databases), 2) Fast vs slow queries (isolate), 3) Multi-tenant (isolation). Avoid creating pools per request (overhead)."

**Q: What's the difference between min and max?**
A: "Min: Always keep this many connections open (reduce latency for first requests). Max: Never exceed this limit (prevent database overload). Example: min=5, max=20 → starts with 5, scales to 20 under load, shrinks back to 5 when idle."

---

## 🔗 Related Questions

- [Database Scaling Strategies](/interview-prep/database-storage/scaling-strategies)
- [Query Optimization](/interview-prep/database-storage/query-optimization)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Performance Bottleneck Identification](/interview-prep/caching-cdn/performance-bottlenecks)

---

## 📚 Additional Resources

- [node-postgres Pool Documentation](https://node-postgres.com/features/pooling)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [HikariCP - Java Pool](https://github.com/brettwooldridge/HikariCP) (Best practices apply to all languages)
- [PgBouncer - External Connection Pooler](https://www.pgbouncer.org/)
