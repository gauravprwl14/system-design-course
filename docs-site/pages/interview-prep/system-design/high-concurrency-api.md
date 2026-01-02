# Designing High-Concurrency APIs

## Question
**"Design an API that can handle 100,000+ concurrent requests. How would you optimize for performance and reliability?"**

Common in: Backend, DevOps, System Design interviews

---

## 📊 Quick Answer

**Key Strategies**:
1. **Connection Pooling** - Reuse DB connections instead of creating new ones
2. **Async Processing** - Use queues for non-critical operations
3. **Caching** - Redis/CDN to reduce database load
4. **Load Balancing** - Distribute traffic across multiple servers
5. **Circuit Breaker** - Fail fast to prevent cascading failures
6. **Database Optimization** - Indexing, read replicas, query optimization

**Architecture Pattern**: Layered caching + async processing + horizontal scaling

---

## 🎯 Complete Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Load Balancer                     │
│              (NGINX / AWS ALB)                      │
└─────────────────┬───────────────────────────────────┘
                  │
        ┌─────────┼─────────┬─────────┐
        │         │         │         │
   ┌────▼───┐ ┌──▼────┐ ┌──▼────┐ ┌──▼────┐
   │ API 1  │ │ API 2 │ │ API 3 │ │ API N │
   │ Server │ │ Server│ │ Server│ │ Server│
   └────┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
        │         │         │         │
        └─────────┼─────────┴─────────┘
                  │
        ┌─────────▼──────────┐
        │   Redis Cache      │
        │   (Read-Through)   │
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────┐
        │  Connection Pool   │
        │   (100 connections)│
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────────────┐
        │      Database Cluster      │
        │  Primary + Read Replicas   │
        └────────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │   Message Queue    │
        │  (Background Jobs) │
        └────────────────────┘
```

---

## 💻 Implementation

### 1. Connection Pooling

**Problem**: Creating new DB connections is expensive (20-50ms per connection)

**Solution**: Reuse connections from a pool

```javascript
// connection-pool.js
const { Pool } = require('pg');

// Connection pool configuration
const pool = new Pool({
  host: 'localhost',
  database: 'myapp',
  user: 'postgres',
  password: 'secret',

  // CRITICAL: Pool size optimization
  max: 100,                    // Max connections in pool
  min: 10,                     // Min idle connections
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 2000 // Wait 2s for available connection
});

// Efficient query with automatic connection release
async function getUser(userId) {
  // Connection automatically returned to pool after query
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

// For complex transactions
async function transferMoney(fromId, toId, amount) {
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
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // Return connection to pool
  }
}

// Monitor pool health
setInterval(() => {
  console.log('Pool stats:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 10000);

module.exports = pool;
```

**Performance Impact**:
- Without pool: 50ms per request (connection overhead)
- With pool: 5ms per request (10x faster!)

---

### 2. Multi-Layer Caching

**Strategy**: Cache at multiple levels to reduce database load

```javascript
// cache-service.js
const Redis = require('ioredis');
const NodeCache = require('node-cache');

class MultiLayerCache {
  constructor() {
    // L1: In-memory cache (fastest, 1-5ms)
    this.memoryCache = new NodeCache({
      stdTTL: 60,        // 60 seconds
      maxKeys: 10000     // Max 10k keys
    });

    // L2: Redis cache (fast, 5-20ms)
    this.redisCache = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false
    });
  }

  async get(key, fetchFunction) {
    // L1: Check memory cache
    let value = this.memoryCache.get(key);
    if (value !== undefined) {
      console.log('L1 HIT:', key);
      return value;
    }

    // L2: Check Redis cache
    const redisValue = await this.redisCache.get(key);
    if (redisValue) {
      console.log('L2 HIT:', key);
      value = JSON.parse(redisValue);
      // Populate L1 cache
      this.memoryCache.set(key, value);
      return value;
    }

    // L3: Database (slowest, 50-200ms)
    console.log('CACHE MISS:', key);
    value = await fetchFunction();

    // Populate both caches
    this.memoryCache.set(key, value);
    await this.redisCache.setex(key, 300, JSON.stringify(value));

    return value;
  }

  async invalidate(key) {
    this.memoryCache.del(key);
    await this.redisCache.del(key);
  }
}

// Usage in API
const cache = new MultiLayerCache();

app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  const user = await cache.get(
    `user:${userId}`,
    async () => {
      // Only called on cache miss
      return await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    }
  );

  res.json(user);
});

// Invalidate cache on update
app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  await db.query('UPDATE users SET ... WHERE id = $1', [userId]);

  // CRITICAL: Invalidate cache after update
  await cache.invalidate(`user:${userId}`);

  res.json({ success: true });
});
```

---

### 3. Async Processing with Message Queues

**Problem**: Slow operations block API responses

**Solution**: Offload to background workers

```javascript
// queue-service.js
const Queue = require('bull');
const Redis = require('ioredis');

// Create queue
const emailQueue = new Queue('email-notifications', {
  redis: { host: 'localhost', port: 6379 }
});

// Queue configuration
emailQueue.process(5, async (job) => {
  // Process 5 jobs concurrently
  const { userId, type, data } = job.data;

  console.log(`Processing email job ${job.id} for user ${userId}`);

  await sendEmail({
    to: data.email,
    subject: data.subject,
    body: data.body
  });

  return { sent: true };
});

// API endpoint - responds immediately
app.post('/api/orders', async (req, res) => {
  const { userId, items } = req.body;

  // 1. Create order (fast, 50ms)
  const order = await db.query(
    'INSERT INTO orders (user_id, items, status) VALUES ($1, $2, $3) RETURNING *',
    [userId, JSON.stringify(items), 'pending']
  );

  // 2. Queue email notification (async, 2ms)
  await emailQueue.add({
    userId,
    type: 'order_confirmation',
    data: {
      email: req.body.email,
      subject: 'Order Confirmed',
      body: `Your order #${order.id} has been confirmed`
    }
  });

  // 3. Queue inventory update (async)
  await inventoryQueue.add({ orderId: order.id, items });

  // Respond immediately - total: ~55ms instead of 500ms!
  res.json({
    orderId: order.id,
    status: 'processing',
    message: 'Order created. Confirmation email will arrive shortly.'
  });
});

// Monitor queue health
app.get('/api/admin/queue-stats', async (req, res) => {
  const [waiting, active, completed, failed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount()
  ]);

  res.json({ waiting, active, completed, failed });
});
```

---

### 4. Circuit Breaker Pattern

**Problem**: Cascading failures when dependencies fail

**Solution**: Fail fast and recover gracefully

```javascript
// circuit-breaker.js
class CircuitBreaker {
  constructor(service, options = {}) {
    this.service = service;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 60s
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  async call(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Try to recover
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await this.service(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`Circuit breaker OPEN. Will retry at ${new Date(this.nextAttempt)}`);
    }
  }
}

// Usage with external API
const paymentAPI = new CircuitBreaker(
  async (orderId, amount) => {
    const response = await fetch('https://payment-gateway.com/charge', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
      timeout: 5000 // 5s timeout
    });

    if (!response.ok) throw new Error('Payment failed');
    return response.json();
  },
  {
    failureThreshold: 5,
    resetTimeout: 60000
  }
);

app.post('/api/checkout', async (req, res) => {
  const { orderId, amount } = req.body;

  try {
    const result = await paymentAPI.call(orderId, amount);
    res.json({ success: true, transactionId: result.id });
  } catch (err) {
    if (err.message === 'Circuit breaker is OPEN') {
      // Payment service is down - use fallback
      res.status(503).json({
        success: false,
        message: 'Payment service temporarily unavailable. Please try again later.',
        fallback: 'offline_payment_initiated'
      });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});
```

---

### 5. Database Optimization

#### Read Replicas for Scaling Reads

```javascript
// database-cluster.js
const { Pool } = require('pg');

class DatabaseCluster {
  constructor() {
    // Write to primary
    this.primary = new Pool({
      host: 'primary.db.local',
      database: 'myapp',
      max: 50
    });

    // Read from replicas (round-robin)
    this.replicas = [
      new Pool({ host: 'replica1.db.local', database: 'myapp', max: 50 }),
      new Pool({ host: 'replica2.db.local', database: 'myapp', max: 50 }),
      new Pool({ host: 'replica3.db.local', database: 'myapp', max: 50 })
    ];

    this.replicaIndex = 0;
  }

  // All writes go to primary
  async write(query, params) {
    return await this.primary.query(query, params);
  }

  // Reads go to replicas (load balanced)
  async read(query, params) {
    const replica = this.replicas[this.replicaIndex];
    this.replicaIndex = (this.replicaIndex + 1) % this.replicas.length;
    return await replica.query(query, params);
  }
}

const db = new DatabaseCluster();

// Usage
app.get('/api/products', async (req, res) => {
  // Read from replica
  const products = await db.read('SELECT * FROM products WHERE active = true');
  res.json(products.rows);
});

app.post('/api/products', async (req, res) => {
  // Write to primary
  const result = await db.write(
    'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *',
    [req.body.name, req.body.price]
  );
  res.json(result.rows[0]);
});
```

#### Query Optimization

```sql
-- BAD: Full table scan (1000ms for 1M rows)
SELECT * FROM orders
WHERE user_id = 12345
  AND status = 'completed'
  AND created_at > '2024-01-01';

-- GOOD: Use composite index (10ms)
CREATE INDEX idx_orders_user_status_date
ON orders(user_id, status, created_at);

-- Select only needed columns
SELECT id, total, created_at FROM orders
WHERE user_id = 12345
  AND status = 'completed'
  AND created_at > '2024-01-01';

-- Use EXPLAIN ANALYZE to check query plan
EXPLAIN ANALYZE
SELECT id, total, created_at FROM orders
WHERE user_id = 12345;
```

---

### 6. Load Balancing with NGINX

```nginx
# nginx.conf
upstream api_backend {
    # Load balancing strategies

    # 1. Round Robin (default)
    server api1.example.com:3000;
    server api2.example.com:3000;
    server api3.example.com:3000;

    # 2. Least connections (use server with fewest active connections)
    # least_conn;

    # 3. IP Hash (same user always goes to same server)
    # ip_hash;

    # Health checks
    server api1.example.com:3000 max_fails=3 fail_timeout=30s;
    server api2.example.com:3000 max_fails=3 fail_timeout=30s;
    server api3.example.com:3000 max_fails=3 fail_timeout=30s;

    # Keep-alive connections
    keepalive 100;
}

server {
    listen 80;
    server_name api.example.com;

    # Request rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    location /api/ {
        proxy_pass http://api_backend;

        # Connection pooling
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

### 7. Complete High-Concurrency API Example

```javascript
// server.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(express.json({ limit: '1mb' })); // Limit body size

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests, please try again later'
});
app.use('/api/', limiter);

// Health check (for load balancer)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// High-concurrency endpoint
app.get('/api/products/:category', async (req, res) => {
  const { category } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    // 1. Check cache first (5ms)
    const products = await cache.get(
      `products:${category}:${page}:${limit}`,
      async () => {
        // 2. Fetch from read replica (50ms)
        const offset = (page - 1) * limit;
        const result = await db.read(
          `SELECT id, name, price, image_url
           FROM products
           WHERE category = $1 AND active = true
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [category, limit, offset]
        );
        return result.rows;
      }
    );

    // 3. Respond quickly
    res.json({
      data: products,
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully');

  server.close(() => {
    console.log('Server closed');
  });

  // Close database connections
  await db.primary.end();
  await Promise.all(db.replicas.map(r => r.end()));

  // Close Redis
  await cache.redisCache.quit();

  process.exit(0);
});

const server = app.listen(3000, () => {
  console.log('API server running on port 3000');
});
```

---

## 📈 Performance Benchmarks

### Without Optimization
```
Concurrent Users: 100,000
Requests/sec: 500
Average Response Time: 5000ms
Error Rate: 35%
Database Connections: Maxed out (100)
```

### With Optimization
```
Concurrent Users: 100,000
Requests/sec: 15,000
Average Response Time: 150ms
Error Rate: 0.1%
Cache Hit Rate: 85%
Database Connections: 20-30 (from pool of 100)
```

**Improvement**: 30x faster, 99.7% reduction in errors!

---

## 🔍 Real-World Example: E-commerce Flash Sale

```javascript
// flash-sale-api.js
class FlashSaleAPI {
  constructor() {
    this.cache = new MultiLayerCache();
    this.queue = new Queue('flash-sale-orders');
    this.circuitBreaker = new CircuitBreaker(this.processPayment);
  }

  async handlePurchase(req, res) {
    const { userId, productId, quantity } = req.body;

    try {
      // 1. Check inventory (Redis - 5ms)
      const available = await this.checkInventoryRedis(productId);

      if (available < quantity) {
        return res.status(409).json({
          error: 'Out of stock',
          available
        });
      }

      // 2. Reserve inventory atomically (Lua script - 10ms)
      const reserved = await this.reserveInventory(productId, quantity);

      if (!reserved) {
        return res.status(409).json({ error: 'Race condition - sold out' });
      }

      // 3. Create order (DB write - 50ms)
      const order = await db.write(
        'INSERT INTO orders (user_id, product_id, quantity, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, productId, quantity, 'reserved']
      );

      // 4. Queue payment processing (async - 2ms)
      await this.queue.add({
        orderId: order.id,
        userId,
        amount: order.total
      }, {
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });

      // 5. Respond immediately - total: ~70ms
      res.json({
        orderId: order.id,
        status: 'reserved',
        message: 'Order reserved. Processing payment...'
      });

    } catch (err) {
      console.error('Flash sale error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async reserveInventory(productId, quantity) {
    // Atomic inventory decrement with Lua script
    const script = `
      local current = tonumber(redis.call('GET', KEYS[1]))
      if current >= tonumber(ARGV[1]) then
        redis.call('DECRBY', KEYS[1], ARGV[1])
        return 1
      else
        return 0
      end
    `;

    const result = await this.cache.redisCache.eval(
      script,
      1,
      `inventory:${productId}`,
      quantity
    );

    return result === 1;
  }
}
```

---

## 🎓 Interview Tips

### What Interviewers Want to Hear

1. **Specific Numbers**: "Connection pooling reduced response time from 50ms to 5ms"
2. **Trade-offs**: "In-memory cache is fastest but limited by RAM"
3. **Monitoring**: "We track P95 latency and error rates in Datadog"
4. **Failure Scenarios**: "Circuit breaker prevents cascading failures"

### Common Follow-up Questions

**Q: How do you handle database connection exhaustion?**
A: "Use connection pooling with proper limits. Monitor pool stats. Scale horizontally by adding more app servers with their own pools. Use read replicas to distribute load."

**Q: What if cache becomes stale?**
A: "Use cache invalidation on writes. Set appropriate TTLs. For critical data, use cache-aside pattern with explicit invalidation."

**Q: How do you debug performance issues?**
A: "APM tools (New Relic, Datadog), database EXPLAIN ANALYZE, Redis SLOWLOG, NGINX logs. Look for: slow queries, high cache miss rate, connection pool exhaustion."

**Q: How do you test high concurrency?**
A: "Load testing with tools like k6, Apache JMeter, or Artillery. Test with 2x expected traffic. Monitor: response times (P50, P95, P99), error rates, resource usage."

---

## 🔗 Related Questions

- [Rate Limiting Implementation](/interview-prep/system-design/rate-limiting)
- [Flash Sales System Design](/interview-prep/system-design/flash-sales)
- [Redis Caching Strategies](/interview-prep/caching/redis-fundamentals)
- [Database Scaling](/interview-prep/database/scaling-strategies)

---

## 📚 Additional Resources

- [PostgreSQL Connection Pooling Best Practices](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Redis for High-Concurrency Systems](https://redis.io/docs/manual/patterns/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [NGINX Load Balancing](https://nginx.org/en/docs/http/load_balancing.html)
