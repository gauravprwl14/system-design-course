# Performance Bottleneck Identification & Resolution

## Question
**"How do you identify performance bottlenecks in a system? Walk me through your debugging process."**

Common in: Senior Backend, DevOps, SRE interviews

---

## 📊 Quick Answer

**Systematic Approach**:
1. **Measure** - Identify the problem (APM tools, logs, metrics)
2. **Locate** - Find the bottleneck (profiling, tracing)
3. **Analyze** - Understand root cause
4. **Fix** - Implement solution
5. **Verify** - Confirm improvement

**Common Bottlenecks**:
- Database queries (60% of cases)
- Network I/O (20%)
- CPU-intensive operations (10%)
- Memory leaks (5%)
- Third-party APIs (5%)

---

## 🎯 Step-by-Step Debugging Process

### Step 1: Measure - Establish Baseline

```javascript
// monitoring-setup.js
const express = require('express');
const responseTime = require('response-time');
const app = express();

// 1. Response time tracking
app.use(responseTime((req, res, time) => {
  console.log(`${req.method} ${req.url}: ${time.toFixed(2)}ms`);

  // Alert on slow requests
  if (time > 1000) {
    console.error(`⚠️ SLOW REQUEST: ${req.method} ${req.url} - ${time}ms`);
  }
}));

// 2. Request logging with timestamps
app.use((req, res, next) => {
  req.startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// 3. Memory usage monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}, 30000); // Every 30 seconds

// 4. Event loop lag monitoring
const { performance } = require('perf_hooks');

let lastCheck = performance.now();
setInterval(() => {
  const now = performance.now();
  const lag = now - lastCheck - 1000; // Should be ~1000ms

  if (lag > 100) {
    console.error(`⚠️ EVENT LOOP LAG: ${lag.toFixed(2)}ms`);
  }

  lastCheck = now;
}, 1000);
```

---

### Step 2: Locate - Find the Bottleneck

#### A. Database Bottlenecks (Most Common)

```javascript
// db-profiling.js
const { Pool } = require('pg');

class ProfiledPool extends Pool {
  async query(text, params) {
    const start = Date.now();

    try {
      const result = await super.query(text, params);
      const duration = Date.now() - start;

      // Log slow queries
      if (duration > 100) {
        console.error(`🐌 SLOW QUERY (${duration}ms):`, {
          query: text.substring(0, 100),
          params,
          duration,
          rows: result.rowCount
        });
      }

      return result;
    } catch (err) {
      console.error('Query error:', err);
      throw err;
    }
  }
}

const pool = new ProfiledPool({
  host: 'localhost',
  database: 'myapp'
});

// Example slow query detection
app.get('/api/users/:id/activity', async (req, res) => {
  // This will log if it takes >100ms
  const result = await pool.query(`
    SELECT a.*
    FROM activities a
    WHERE a.user_id = $1
    ORDER BY a.created_at DESC
    LIMIT 50
  `, [req.params.id]);

  res.json(result.rows);
});
```

**PostgreSQL Query Analysis**:

```sql
-- Enable query logging (in postgresql.conf or runtime)
SET log_min_duration_statement = 100; -- Log queries >100ms

-- Find slow queries in pg_stat_statements
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Analyze specific query
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123
  AND status = 'completed'
  AND created_at > '2024-01-01';

/*
Example output:
Seq Scan on orders (cost=0.00..1234.56 rows=10 width=120) (actual time=0.123..145.678 rows=10 loops=1)
  Filter: (user_id = 123 AND status = 'completed' AND created_at > '2024-01-01')
  Rows Removed by Filter: 98765
Planning Time: 0.234 ms
Execution Time: 145.912 ms
*/

-- ⚠️ Problem: Sequential scan removing 98,765 rows!
-- Solution: Add index

CREATE INDEX idx_orders_user_status_date
ON orders(user_id, status, created_at);

-- After index:
-- Index Scan (actual time=0.012..0.234 rows=10 loops=1)
-- Execution Time: 1.245 ms (100x faster!)
```

---

#### B. N+1 Query Problem

```javascript
// n-plus-one-problem.js
// ❌ BAD: N+1 queries (1 + N database calls)
app.get('/api/users', async (req, res) => {
  // 1 query to get users
  const users = await pool.query('SELECT * FROM users LIMIT 10');

  // N queries (10 more!) to get orders for each user
  const usersWithOrders = await Promise.all(
    users.rows.map(async (user) => {
      const orders = await pool.query(
        'SELECT * FROM orders WHERE user_id = $1',
        [user.id]
      );
      return { ...user, orders: orders.rows };
    })
  );

  res.json(usersWithOrders);
  // Total: 11 database queries!
});

// ✅ GOOD: Single JOIN query
app.get('/api/users', async (req, res) => {
  const result = await pool.query(`
    SELECT
      u.*,
      json_agg(o.*) as orders
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE u.id IN (SELECT id FROM users LIMIT 10)
    GROUP BY u.id
  `);

  res.json(result.rows);
  // Total: 1 database query (10x faster!)
});
```

---

#### C. Memory Leaks

```javascript
// memory-leak-detection.js
const heapdump = require('heapdump');

// Take heap snapshot on demand
app.get('/api/debug/heapdump', (req, res) => {
  const filename = `/tmp/heapdump-${Date.now()}.heapsnapshot`;
  heapdump.writeSnapshot(filename, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ file: filename });
  });
});

// Automatic heap snapshots when memory grows
let lastHeapSize = 0;
const HEAP_GROWTH_THRESHOLD = 100 * 1024 * 1024; // 100MB

setInterval(() => {
  const usage = process.memoryUsage();
  const currentHeap = usage.heapUsed;

  if (currentHeap - lastHeapSize > HEAP_GROWTH_THRESHOLD) {
    console.error('⚠️ Memory leak detected! Taking heap snapshot...');
    heapdump.writeSnapshot(`/tmp/leak-${Date.now()}.heapsnapshot`);
  }

  lastHeapSize = currentHeap;
}, 60000);

// Common memory leak: Event listeners
// ❌ BAD: Memory leak
const EventEmitter = require('events');
const emitter = new EventEmitter();

app.get('/api/subscribe', (req, res) => {
  // Listener is never removed!
  emitter.on('data', (data) => {
    res.write(JSON.stringify(data));
  });
});

// ✅ GOOD: Remove listener
app.get('/api/subscribe', (req, res) => {
  const handler = (data) => {
    res.write(JSON.stringify(data));
  };

  emitter.on('data', handler);

  // Clean up on disconnect
  req.on('close', () => {
    emitter.removeListener('data', handler);
  });
});
```

---

#### D. CPU Bottlenecks

```javascript
// cpu-profiling.js
const { createServer } = require('http');
const { cpuUsage } = require('process');

// Profile CPU usage per request
app.use((req, res, next) => {
  const startCPU = cpuUsage();

  res.on('finish', () => {
    const cpuDiff = cpuUsage(startCPU);
    const userMs = cpuDiff.user / 1000;
    const systemMs = cpuDiff.system / 1000;

    if (userMs > 100) {
      console.error(`⚠️ HIGH CPU: ${req.method} ${req.url} - ${userMs.toFixed(2)}ms user, ${systemMs.toFixed(2)}ms system`);
    }
  });

  next();
});

// Example: CPU-intensive operation
// ❌ BAD: Blocking the event loop
app.get('/api/calculate', (req, res) => {
  let result = 0;
  for (let i = 0; i < 1e9; i++) {
    result += Math.sqrt(i);
  }
  res.json({ result });
  // Blocks event loop for ~10 seconds!
});

// ✅ GOOD: Offload to worker thread
const { Worker } = require('worker_threads');

app.get('/api/calculate', (req, res) => {
  const worker = new Worker('./calculate-worker.js');

  worker.on('message', (result) => {
    res.json({ result });
  });

  worker.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// calculate-worker.js
const { parentPort } = require('worker_threads');

let result = 0;
for (let i = 0; i < 1e9; i++) {
  result += Math.sqrt(i);
}

parentPort.postMessage(result);
```

---

#### E. Network I/O Bottlenecks

```javascript
// network-profiling.js
const axios = require('axios');

// ❌ BAD: Sequential external API calls
app.get('/api/dashboard', async (req, res) => {
  const start = Date.now();

  const users = await axios.get('https://api.example.com/users'); // 200ms
  const orders = await axios.get('https://api.example.com/orders'); // 300ms
  const products = await axios.get('https://api.example.com/products'); // 250ms

  console.log(`Total time: ${Date.now() - start}ms`); // 750ms!

  res.json({ users, orders, products });
});

// ✅ GOOD: Parallel API calls
app.get('/api/dashboard', async (req, res) => {
  const start = Date.now();

  const [users, orders, products] = await Promise.all([
    axios.get('https://api.example.com/users'),
    axios.get('https://api.example.com/orders'),
    axios.get('https://api.example.com/products')
  ]);

  console.log(`Total time: ${Date.now() - start}ms`); // 300ms (2.5x faster!)

  res.json({ users, orders, products });
});

// ✅ BETTER: Add timeout + circuit breaker
const circuitBreaker = require('opossum');

const fetchUsers = new circuitBreaker(
  async () => {
    return await axios.get('https://api.example.com/users', { timeout: 5000 });
  },
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  }
);

app.get('/api/dashboard', async (req, res) => {
  try {
    const [users, orders, products] = await Promise.all([
      fetchUsers.fire(),
      // ... other calls
    ]);

    res.json({ users, orders, products });
  } catch (err) {
    // Fail gracefully
    res.json({ error: 'External API unavailable', partial: true });
  }
});
```

---

## 🔍 Profiling Tools

### 1. Node.js Built-in Profiler

```bash
# Start app with profiling
node --prof app.js

# Generate load
ab -n 10000 -c 100 http://localhost:3000/api/users

# Process profiler output
node --prof-process isolate-0x*.log > profiler-output.txt

# Analyze profiler-output.txt for hot functions
```

**Example Output**:
```
Statistical profiling result from isolate-0x...

 [Summary]:
   ticks  total  nonlib   name
   4567   45.7%   65.3%  JavaScript
   3421   34.2%   48.9%  C++
   2012   20.1%   28.8%  GC

 [JavaScript]:
   ticks  total  nonlib   name
   1234   27.0%   38.5%  LazyCompile: *getUsers /app/routes.js:45:21
    987   21.6%   30.8%  LazyCompile: *query /node_modules/pg/lib/query.js:89:14
    ...
```

---

### 2. Chrome DevTools Profiling

```javascript
// Enable inspector
// Run: node --inspect app.js
// Open: chrome://inspect

// Add profiling breakpoints
app.get('/api/heavy', async (req, res) => {
  console.profile('heavy-operation');

  // Your code here
  const result = await heavyOperation();

  console.profileEnd('heavy-operation');

  res.json(result);
});
```

---

### 3. Application Performance Monitoring (APM)

```javascript
// datadog-apm-advanced.js
const tracer = require('dd-trace').init({
  service: 'my-api',
  analytics: true
});

app.get('/api/users/:id', async (req, res) => {
  const span = tracer.scope().active();

  // Add custom tags
  span.setTag('user.id', req.params.id);
  span.setTag('user.role', req.user?.role);

  // Child span for DB query
  const dbSpan = tracer.startSpan('database.query', {
    childOf: span,
    tags: {
      'db.type': 'postgres',
      'db.statement': 'SELECT * FROM users WHERE id = $1'
    }
  });

  const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

  dbSpan.finish();

  // Child span for external API
  const apiSpan = tracer.startSpan('external.api', {
    childOf: span,
    tags: {
      'http.url': 'https://api.example.com/profile'
    }
  });

  const profile = await axios.get(`https://api.example.com/profile/${user.id}`);

  apiSpan.finish();

  res.json({ ...user, profile });
});

// Datadog will show:
// Total: 345ms
// ├─ database.query: 45ms
// └─ external.api: 280ms (bottleneck!)
```

---

## 🛠️ Common Fixes

### 1. Add Database Indexes

```sql
-- Before: 2000ms
SELECT * FROM orders
WHERE user_id = 123 AND status = 'completed';

-- Check for missing indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;

-- Add composite index
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- After: 12ms (166x faster!)
```

---

### 2. Implement Caching

```javascript
// Before: 500ms per request
app.get('/api/products', async (req, res) => {
  const products = await pool.query('SELECT * FROM products WHERE active = true');
  res.json(products.rows);
});

// After: 5ms per request (cache hit)
const redis = require('ioredis');
const cache = new redis();

app.get('/api/products', async (req, res) => {
  const cached = await cache.get('products:active');

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const products = await pool.query('SELECT * FROM products WHERE active = true');
  await cache.setex('products:active', 300, JSON.stringify(products.rows));

  res.json(products.rows);
});
```

---

### 3. Use Connection Pooling

```javascript
// Before: 150ms (new connection per request)
const { Client } = require('pg');

app.get('/api/users/:id', async (req, res) => {
  const client = new Client({ /* ... */ });
  await client.connect(); // 50ms overhead!

  const result = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

  await client.end();
  res.json(result.rows[0]);
});

// After: 20ms (reused connection)
const { Pool } = require('pg');
const pool = new Pool({ /* ... */ });

app.get('/api/users/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
});
```

---

### 4. Optimize JSON Serialization

```javascript
// Before: 250ms to serialize large object
app.get('/api/large-data', async (req, res) => {
  const data = await getLargeDataset(); // 10MB JSON
  res.json(data); // Slow JSON.stringify!
});

// After: 50ms with streaming
const JSONStream = require('JSONStream');

app.get('/api/large-data', async (req, res) => {
  const stream = await getLargeDatasetStream();

  res.setHeader('Content-Type', 'application/json');

  stream
    .pipe(JSONStream.stringify())
    .pipe(res);
});
```

---

## 🎓 Interview Tips

### Debugging Process to Explain

1. **"I'd start by checking monitoring dashboards"** - Show you use tools (Datadog, Prometheus, CloudWatch)
2. **"Look at P95/P99 latencies"** - Not just averages
3. **"Identify the slow endpoint"** - Which API is affected?
4. **"Use distributed tracing"** - See where time is spent (DB vs external API vs code)
5. **"Check database query logs"** - Use EXPLAIN ANALYZE
6. **"Profile the code"** - Node.js profiler or Chrome DevTools
7. **"Look for N+1 queries"** - Very common issue
8. **"Check for memory leaks"** - Heap snapshots
9. **"Implement fix incrementally"** - Don't change everything at once
10. **"Measure improvement"** - Verify with metrics

### Common Follow-ups

**Q: How do you prioritize which bottleneck to fix first?**
A: "Impact × Frequency. Fix slow queries that run 1000x/second before rare admin endpoints. Use APM to find which slow operation affects the most users."

**Q: Production is slow RIGHT NOW. What do you do?**
A: "1) Check if it's a spike in traffic (scale horizontally), 2) Look for slow queries in DB logs, 3) Check external API response times, 4) Restart if memory leak (temporary fix), 5) Enable caching for hot endpoints, 6) Add rate limiting if under attack."

---

## 🔗 Related Questions

- [API Metrics (P95/P99)](/interview-prep/caching-cdn/api-metrics)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Database Query Optimization](/interview-prep/database/query-optimization)
- [Redis Caching Fundamentals](/interview-prep/caching-cdn/redis-fundamentals)

---

## 📚 Additional Resources

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [Chrome DevTools Profiling](https://developer.chrome.com/docs/devtools/performance/)
