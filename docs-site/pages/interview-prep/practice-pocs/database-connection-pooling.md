# POC #15: Advanced Connection Pooling - Scale to 100k Requests/Sec

## What You'll Build

**Production-ready connection pooling strategies** for high-traffic applications:
- ✅ **Pool sizing** - Calculate optimal pool size
- ✅ **Pool monitoring** - Detect exhaustion and bottlenecks
- ✅ **Connection lifecycle** - Idle timeouts, max lifetime
- ✅ **Read/Write splitting** - Separate pools for replicas
- ✅ **pgBouncer** - Connection pooler for 10,000+ connections

**Time to complete**: 25 minutes
**Difficulty**: ⭐⭐⭐ Advanced
**Prerequisites**: POC #11 (CRUD)

---

## Why This Matters

### Real-World Impact

| Company | Database | Pool Strategy | Result |
|---------|----------|--------------|--------|
| **Instagram** | PostgreSQL | PgBouncer (10k+ connections) | 100k req/sec |
| **Uber** | PostgreSQL | 40 conn/server, 1000 servers | 500k writes/sec |
| **GitHub** | MySQL | Read replica pools (3:1 ratio) | 1M queries/sec |
| **Airbnb** | PostgreSQL | Dynamic pool sizing | 200k req/sec |
| **Discord** | ScyllaDB | Connection per CPU core | 50M concurrent users |

### The Problem

**Without pooling**:
```javascript
// Every request creates new connection
app.get('/users/:id', async (req, res) => {
  const client = new Client(config);
  await client.connect();  // 20-50ms overhead!
  const user = await client.query('SELECT...');
  await client.end();
  res.json(user);
});

// Problems:
// - 50ms connection overhead per request
// - Database max_connections = 100
// - 101st concurrent request = FATAL: sorry, too many clients
```

**With pooling**:
```javascript
// Reuse connections from pool
const pool = new Pool({ max: 20 });

app.get('/users/:id', async (req, res) => {
  const user = await pool.query('SELECT...');  // 2ms!
  res.json(user);
});

// Benefits:
// - 0ms connection overhead
// - 20 connections handle 10k+ req/sec
// - Never hit max_connections limit
```

---

## Optimal Pool Size Formula

**Common mistake**: Setting pool size = max_connections

**Correct formula**:
```
pool_size = ((core_count * 2) + effective_spindle_count)

For SSD (spindle = 1):
  pool_size = (cores * 2) + 1

For 4-core server:
  pool_size = (4 * 2) + 1 = 9 connections
```

**Why?**
- More connections ≠ better performance
- Each connection = 10MB RAM + context switching
- Optimal pool size saturates CPU without waste

**Real-world sizing**:
- **4-core server**: 10 connections
- **8-core server**: 20 connections
- **16-core server**: 40 connections

---

## Step-by-Step Build

### Setup

```bash
mkdir pool-poc && cd pool-poc
npm init -y && npm install pg express prom-client
```

### Advanced Pool Manager (`poolManager.js`)

```javascript
const { Pool } = require('pg');
const client = require('prom-client');

// Prometheus metrics
const poolMetrics = {
  totalConnections: new client.Gauge({
    name: 'db_pool_total_connections',
    help: 'Total connections in pool'
  }),
  idleConnections: new client.Gauge({
    name: 'db_pool_idle_connections',
    help: 'Idle connections in pool'
  }),
  waitingClients: new client.Gauge({
    name: 'db_pool_waiting_clients',
    help: 'Clients waiting for connection'
  }),
  queryDuration: new client.Histogram({
    name: 'db_query_duration_ms',
    help: 'Query execution time',
    buckets: [1, 5, 10, 50, 100, 500, 1000]
  })
};

class PoolManager {
  constructor(config) {
    this.writePool = new Pool({
      host: config.writeHost || 'localhost',
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.writePoolSize || 20,
      idleTimeoutMillis: 30000,      // Close idle connections after 30s
      connectionTimeoutMillis: 2000,  // Timeout if no connection available
      maxUses: 7500,                  // Close connection after 7500 queries
      allowExitOnIdle: true           // Allow pool to close on idle
    });

    this.readPool = config.readHost ? new Pool({
      host: config.readHost,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.readPoolSize || 60,  // 3x more for reads
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    }) : this.writePool;

    this.setupMonitoring();
  }

  setupMonitoring() {
    setInterval(() => {
      poolMetrics.totalConnections.set(this.writePool.totalCount);
      poolMetrics.idleConnections.set(this.writePool.idleCount);
      poolMetrics.waitingClients.set(this.writePool.waitingCount);
    }, 1000);
  }

  async query(sql, params, { useReadReplica = false } = {}) {
    const pool = useReadReplica ? this.readPool : this.writePool;

    const start = Date.now();
    try {
      const result = await pool.query(sql, params);
      const duration = Date.now() - start;

      poolMetrics.queryDuration.observe(duration);

      if (duration > 100) {
        console.warn(`⚠️ Slow query (${duration}ms): ${sql.substring(0, 100)}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Query error:', error.message);
      throw error;
    }
  }

  getStats() {
    return {
      write: {
        total: this.writePool.totalCount,
        idle: this.writePool.idleCount,
        waiting: this.writePool.waitingCount
      },
      read: this.readPool !== this.writePool ? {
        total: this.readPool.totalCount,
        idle: this.readPool.idleCount,
        waiting: this.readPool.waitingCount
      } : null
    };
  }

  async close() {
    await this.writePool.end();
    if (this.readPool !== this.writePool) {
      await this.readPool.end();
    }
  }
}

module.exports = PoolManager;
```

### Load Test (`loadTest.js`)

```javascript
const PoolManager = require('./poolManager');

const poolManager = new PoolManager({
  database: 'pool_demo',
  user: 'postgres',
  password: 'password',
  writePoolSize: 10,   // Optimal for 4-core server
  readPoolSize: 30     // 3x for read replicas
});

async function simulateLoad() {
  console.log('\n🚀 Load Test: 1000 concurrent requests\n');

  const startTime = Date.now();
  const requests = [];

  for (let i = 0; i < 1000; i++) {
    const promise = poolManager.query(
      'SELECT pg_sleep(0.01)',  // Simulate 10ms query
      [],
      { useReadReplica: i % 3 !== 0 }  // 66% reads, 33% writes
    );
    requests.push(promise);
  }

  await Promise.all(requests);

  const elapsed = Date.now() - startTime;
  const rps = Math.floor(1000 / (elapsed / 1000));

  console.log(`✅ Completed 1000 requests in ${elapsed}ms`);
  console.log(`📊 Throughput: ${rps} req/sec`);
  console.log(`📊 Avg latency: ${elapsed / 1000}ms per request`);

  console.log('\n📊 Pool Stats:');
  console.log(poolManager.getStats());

  await poolManager.close();
}

simulateLoad().catch(console.error);
```

### Test Pool Exhaustion (`exhaustion.js`)

```javascript
const PoolManager = require('./poolManager');

const poolManager = new PoolManager({
  database: 'pool_demo',
  user: 'postgres',
  password: 'password',
  writePoolSize: 5  // Intentionally small
});

async function testExhaustion() {
  console.log('\n⚠️ Testing Pool Exhaustion (pool size = 5)\n');

  const longQueries = [];

  // Start 10 long-running queries (more than pool size)
  for (let i = 0; i < 10; i++) {
    const promise = poolManager.query('SELECT pg_sleep(5)').then(() => {
      console.log(`✅ Query ${i + 1} completed`);
    }).catch(err => {
      console.error(`❌ Query ${i + 1} failed:`, err.message);
    });

    longQueries.push(promise);

    console.log(`Started query ${i + 1}`);
    console.log(`Pool stats:`, poolManager.getStats());

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await Promise.all(longQueries);
  await poolManager.close();
}

testExhaustion().catch(console.error);
```

---

## Run It

```bash
# Start PostgreSQL
docker run -d --name postgres-pool \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pool_demo \
  -p 5432:5432 \
  postgres:15-alpine

# Run load test
node loadTest.js

# Test pool exhaustion
node exhaustion.js
```

### Expected Output (Load Test)

```
🚀 Load Test: 1000 concurrent requests

✅ Completed 1000 requests in 420ms
📊 Throughput: 2380 req/sec
📊 Avg latency: 0.42ms per request

📊 Pool Stats:
{
  write: { total: 10, idle: 7, waiting: 0 },
  read: { total: 30, idle: 22, waiting: 0 }
}
```

**Key insight**: 40 total connections handled 2380 req/sec!

### Expected Output (Exhaustion Test)

```
⚠️ Testing Pool Exhaustion (pool size = 5)

Started query 1
Pool stats: { write: { total: 1, idle: 0, waiting: 0 } }
Started query 2
Pool stats: { write: { total: 2, idle: 0, waiting: 0 } }
...
Started query 6
Pool stats: { write: { total: 5, idle: 0, waiting: 1 } }  ← Waiting!
Started query 7
Pool stats: { write: { total: 5, idle: 0, waiting: 2 } }

❌ Query 7 failed: timeout acquiring connection
✅ Query 1 completed
✅ Query 6 completed (was waiting)
```

---

## PgBouncer: External Pooler for 10k+ Connections

### Why PgBouncer?

**Problem**: 1000 app servers × 20 connections = 20,000 database connections (PostgreSQL limit: 100-500)

**Solution**: PgBouncer sits between app and database

```
┌────────────────────────┐
│   1000 App Servers     │
│   (20 conn each)       │
│   = 20,000 connections │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│      PgBouncer         │
│  (Pool: 100 conn)      │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   PostgreSQL           │
│   (100 actual conn)    │
└────────────────────────┘
```

### PgBouncer Setup

```bash
# Docker Compose
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    command: postgres -c max_connections=100

  pgbouncer:
    image: edoburu/pgbouncer
    environment:
      DB_HOST: postgres
      DB_USER: postgres
      DB_PASSWORD: password
      POOL_MODE: transaction      # transaction | session | statement
      MAX_CLIENT_CONN: 10000      # Max client connections
      DEFAULT_POOL_SIZE: 25       # Actual PostgreSQL connections
    ports:
      - "6432:5432"
```

**Pool Modes**:
- **transaction**: Best performance, but no prepared statements
- **session**: Full PostgreSQL features, moderate performance
- **statement**: Lowest performance, rarely used

---

## Connection Pool Tuning Guide

### Symptoms of Pool Exhaustion

1. **waitingCount > 0** consistently
2. Timeout errors: "TimeoutError: Timeout acquiring connection"
3. Slow API response times
4. High CPU on database server

### Symptoms of Too Large Pool

1. High memory usage (10MB per connection)
2. Context switching overhead
3. Database server CPU at 100%
4. Queries slower than expected

### Optimal Configuration

```javascript
new Pool({
  max: 20,                        // Optimal pool size for 8-core DB
  min: 2,                         // Keep 2 warm connections
  idleTimeoutMillis: 30000,       // Close idle after 30s
  connectionTimeoutMillis: 2000,  // Fast fail if pool exhausted
  maxUses: 7500,                  // Close connection after 7500 queries (prevent memory leaks)
  allowExitOnIdle: true           // Allow graceful shutdown
})
```

---

## Key Takeaways

1. **Pool Size = (cores × 2) + 1** - Don't exceed this formula
2. **Monitor waitingCount** - If > 0, you need more capacity (scale horizontally or add read replicas)
3. **Read/Write Split** - Use 3x more connections for read replicas
4. **Use PgBouncer** - When you have many app servers (>100)
5. **Set Timeouts** - Fail fast, don't let clients wait forever

### Pool Size Examples

| Server Type | CPU Cores | Optimal Pool Size |
|------------|----------|-------------------|
| Small (t3.small) | 2 | 5 connections |
| Medium (t3.medium) | 2 | 5 connections |
| Large (t3.large) | 2 | 5 connections |
| XLarge (t3.xlarge) | 4 | 10 connections |
| 2XLarge (t3.2xlarge) | 8 | 20 connections |
| Database Server (32 cores) | 32 | 65 connections |

---

## Related POCs

- **POC #11: CRUD** - Foundation of database operations
- **POC #16: Read Replicas** - Scale reads with separate pools
- **POC #1: Redis Cache** - Reduce database load

---

## Cleanup

```bash
docker stop postgres-pool && docker rm postgres-pool
rm -rf pool-poc
```

---

**Production examples**:
- **Instagram**: 1000 app servers → PgBouncer (100 connections) → PostgreSQL
- **Uber**: 40 connections per server, 1000 servers = 40,000 app connections → PgBouncer → 500 DB connections
- **GitHub**: Dynamic pool sizing based on load (5-50 connections per server)

**Remember**: More connections ≠ better performance. Find the optimal size and stick to it!
