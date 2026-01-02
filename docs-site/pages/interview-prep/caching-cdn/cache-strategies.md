# Cache Strategies: Cache-Aside, Write-Through, Write-Behind

## Question
**"Explain different caching strategies (cache-aside, write-through, write-behind, read-through). When would you use each?"**

Common in: System Design, Backend, Architecture interviews

---

## 📊 Quick Answer

| Strategy | Read Flow | Write Flow | Use Case |
|----------|-----------|------------|----------|
| **Cache-Aside** | App checks cache → DB on miss | Write to DB → Invalidate cache | Most common (80% of use cases) |
| **Read-Through** | Cache loads from DB automatically | Write to DB → Invalidate cache | Simplify read logic |
| **Write-Through** | App reads from cache | Write to cache → Sync write to DB | Strong consistency needed |
| **Write-Behind** | App reads from cache | Write to cache → Async write to DB | High write throughput needed |
| **Refresh-Ahead** | Predict access → Preload cache | Normal writes | Predictable access patterns |

**Most Popular**: Cache-Aside (Lazy Loading)

---

## 🎯 Complete Solutions

### 1. Cache-Aside (Lazy Loading) ⭐ Most Common

**Pattern**: Application manages both cache and database

```
READ:
1. Check cache
2. If miss → Read from DB
3. Store in cache
4. Return data

WRITE:
1. Write to DB
2. Invalidate/Delete from cache
```

```javascript
// cache-aside-pattern.js
class CacheAsideService {
  constructor(redis, db) {
    this.cache = redis;
    this.db = db;
  }

  // READ with cache-aside
  async getUser(userId) {
    const cacheKey = `user:${userId}`;

    // 1. Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      console.log('CACHE HIT');
      return JSON.parse(cached);
    }

    console.log('CACHE MISS');

    // 2. Read from database
    const user = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      // Cache negative results to prevent DB hammering
      await this.cache.setex(cacheKey, 60, JSON.stringify(null));
      return null;
    }

    // 3. Store in cache (TTL: 1 hour)
    await this.cache.setex(cacheKey, 3600, JSON.stringify(user));

    return user;
  }

  // WRITE with cache invalidation
  async updateUser(userId, updates) {
    const cacheKey = `user:${userId}`;

    // 1. Update database first
    const updated = await this.db.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *',
      [updates.name, updates.email, userId]
    );

    // 2. Invalidate cache
    await this.cache.del(cacheKey);

    // Alternative: Update cache (not recommended - race conditions)
    // await this.cache.setex(cacheKey, 3600, JSON.stringify(updated));

    return updated;
  }

  async deleteUser(userId) {
    const cacheKey = `user:${userId}`;

    // 1. Delete from database
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);

    // 2. Remove from cache
    await this.cache.del(cacheKey);
  }
}

// Usage
const service = new CacheAsideService(redis, db);

app.get('/api/users/:id', async (req, res) => {
  const user = await service.getUser(req.params.id);
  res.json(user);
});

app.put('/api/users/:id', async (req, res) => {
  const updated = await service.updateUser(req.params.id, req.body);
  res.json(updated);
});
```

**Pros**:
- ✅ Simple to implement
- ✅ Cache only what's needed (lazy)
- ✅ Cache failure doesn't break app (degraded performance)

**Cons**:
- ❌ Cache miss penalty (every first access is slow)
- ❌ Stale data risk (if cache invalidation fails)
- ❌ Cache stampede (many requests hit DB on cache expire)

---

### 2. Read-Through Cache

**Pattern**: Cache acts as the main interface to data

```
READ:
1. App requests from cache
2. Cache checks if data exists
3. If miss → Cache loads from DB
4. Cache returns data

WRITE:
1. Write to DB (cache doesn't know)
2. Invalidate cache
```

```javascript
// read-through-cache.js
class ReadThroughCache {
  constructor(redis, db) {
    this.cache = redis;
    this.db = db;
  }

  // Cache handles DB loading automatically
  async get(key, loaderFunction, ttl = 3600) {
    // 1. Check cache
    let value = await this.cache.get(key);

    if (value) {
      return JSON.parse(value);
    }

    // 2. Cache miss - load from DB (handled by cache layer)
    value = await loaderFunction();

    if (value) {
      // 3. Store in cache
      await this.cache.setex(key, ttl, JSON.stringify(value));
    }

    return value;
  }
}

// Usage - Application doesn't know about DB
const cache = new ReadThroughCache(redis, db);

app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id;

  // App only talks to cache - cache handles DB
  const product = await cache.get(
    `product:${productId}`,
    async () => {
      // Loader function (only called on miss)
      return await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    }
  );

  res.json(product);
});

// Writes still go to DB directly
app.put('/api/products/:id', async (req, res) => {
  const productId = req.params.id;

  await db.query('UPDATE products SET ... WHERE id = $1', [productId]);

  // Invalidate cache
  await cache.cache.del(`product:${productId}`);

  res.json({ success: true });
});
```

**Pros**:
- ✅ Simpler application code (cache abstraction)
- ✅ Consistent read logic

**Cons**:
- ❌ First access is still slow (like cache-aside)
- ❌ Requires cache library/middleware

**vs Cache-Aside**: Read-Through moves the "load from DB" logic into the cache layer instead of application code.

---

### 3. Write-Through Cache

**Pattern**: Write to cache first, cache synchronously writes to DB

```
READ:
1. Read from cache (always hits)

WRITE:
1. Write to cache
2. Cache synchronously writes to DB
3. Return success
```

```javascript
// write-through-cache.js
class WriteThroughCache {
  constructor(redis, db) {
    this.cache = redis;
    this.db = db;
  }

  // READ - always from cache
  async get(key) {
    const value = await this.cache.get(key);
    return value ? JSON.parse(value) : null;
  }

  // WRITE - to cache + DB (synchronous)
  async set(key, value, dbWriter) {
    // 1. Write to cache first
    await this.cache.set(key, JSON.stringify(value));

    // 2. Synchronously write to DB
    await dbWriter(value);

    // Both writes succeed or both fail (consistency!)
  }

  async delete(key, dbDeleter) {
    // 1. Delete from cache
    await this.cache.del(key);

    // 2. Delete from DB
    await dbDeleter();
  }
}

// Usage
const cache = new WriteThroughCache(redis, db);

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  const userId = generateId();

  const user = { id: userId, name, email };

  try {
    // Write-through: cache + DB
    await cache.set(
      `user:${userId}`,
      user,
      async (userData) => {
        // DB writer
        await db.query(
          'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
          [userData.id, userData.name, userData.email]
        );
      }
    );

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Write failed' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, email } = req.body;

  const user = { id: userId, name, email };

  await cache.set(
    `user:${userId}`,
    user,
    async (userData) => {
      await db.query(
        'UPDATE users SET name = $1, email = $2 WHERE id = $3',
        [userData.name, userData.email, userData.id]
      );
    }
  );

  res.json(user);
});
```

**Pros**:
- ✅ Strong consistency (cache and DB always in sync)
- ✅ No stale data
- ✅ Reads are always fast (cache always has data)

**Cons**:
- ❌ Write latency (must wait for both cache + DB)
- ❌ Wasted cache space (writes everything, even rarely-read data)
- ❌ If DB write fails, need to rollback cache

**Use Case**: Shopping cart, user preferences (strong consistency required)

---

### 4. Write-Behind (Write-Back) Cache

**Pattern**: Write to cache immediately, asynchronously write to DB later

```
READ:
1. Read from cache

WRITE:
1. Write to cache
2. Return success immediately
3. Background job writes to DB (async)
```

```javascript
// write-behind-cache.js
const Queue = require('bull');

class WriteBehindCache {
  constructor(redis, db) {
    this.cache = redis;
    this.db = db;

    // Background queue for DB writes
    this.writeQueue = new Queue('db-writes', { redis });

    // Process DB writes
    this.writeQueue.process(10, async (job) => {
      const { operation, key, value } = job.data;

      try {
        if (operation === 'set') {
          await db.query(
            'INSERT INTO users (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, email = $3',
            [value.id, value.name, value.email]
          );
        } else if (operation === 'delete') {
          await db.query('DELETE FROM users WHERE id = $1', [value.id]);
        }

        console.log(`DB write completed: ${key}`);
      } catch (err) {
        console.error('DB write failed:', err);
        throw err; // Retry on failure
      }
    });
  }

  async get(key) {
    const value = await this.cache.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value) {
    // 1. Write to cache (fast!)
    await this.cache.set(key, JSON.stringify(value));

    // 2. Queue DB write (async)
    await this.writeQueue.add(
      {
        operation: 'set',
        key,
        value
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }
    );

    // Return immediately - don't wait for DB!
  }

  async delete(key, userId) {
    // 1. Delete from cache
    await this.cache.del(key);

    // 2. Queue DB delete
    await this.writeQueue.add({
      operation: 'delete',
      key,
      value: { id: userId }
    });
  }
}

// Usage
const cache = new WriteBehindCache(redis, db);

app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, email } = req.body;

  const user = { id: userId, name, email };

  // FAST: Only writes to cache, returns immediately!
  await cache.set(`user:${userId}`, user);

  res.json(user); // ~5ms response time!
  // DB write happens in background
});

// Read is also fast (from cache)
app.get('/api/users/:id', async (req, res) => {
  const user = await cache.get(`user:${req.params.id}`);
  res.json(user);
});
```

**Batched Writes (Optimization)**:

```javascript
// Batch DB writes for better throughput
class BatchedWriteBehindCache extends WriteBehindCache {
  constructor(redis, db) {
    super(redis, db);

    // Batch writes every 5 seconds
    setInterval(() => this.flushBatch(), 5000);

    this.pendingWrites = new Map();
  }

  async set(key, value) {
    // 1. Write to cache
    await this.cache.set(key, JSON.stringify(value));

    // 2. Add to pending batch
    this.pendingWrites.set(key, value);
  }

  async flushBatch() {
    if (this.pendingWrites.size === 0) return;

    const writes = Array.from(this.pendingWrites.values());
    this.pendingWrites.clear();

    // Bulk insert to DB
    const values = writes.map(w => `('${w.id}', '${w.name}', '${w.email}')`).join(',');

    await this.db.query(`
      INSERT INTO users (id, name, email)
      VALUES ${values}
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
    `);

    console.log(`Flushed ${writes.length} writes to DB`);
  }
}
```

**Pros**:
- ✅ **Very fast writes** (5-10ms instead of 50-100ms)
- ✅ **High throughput** (batch writes to DB)
- ✅ **Reduced DB load** (fewer write operations)

**Cons**:
- ❌ **Data loss risk** (if cache crashes before DB write)
- ❌ **Eventual consistency** (DB lags behind cache)
- ❌ **Complex failure handling**

**Use Case**: Analytics, view counts, logging (ok to lose some data)

---

### 5. Refresh-Ahead Cache

**Pattern**: Proactively refresh cache before expiry

```
READ:
1. Read from cache
2. Check TTL remaining
3. If < threshold → Refresh in background

WRITE:
1. Normal cache-aside write
```

```javascript
// refresh-ahead-cache.js
class RefreshAheadCache {
  constructor(redis, db) {
    this.cache = redis;
    this.db = db;
    this.refreshThreshold = 0.2; // Refresh when 20% TTL remaining
  }

  async get(key, loaderFunction, ttl = 3600) {
    // 1. Get value from cache
    const value = await this.cache.get(key);

    if (value) {
      // 2. Check TTL
      const remainingTTL = await this.cache.ttl(key);

      // 3. Proactively refresh if near expiry
      if (remainingTTL < ttl * this.refreshThreshold) {
        console.log(`Refreshing cache ahead: ${key}`);

        // Refresh in background (don't await)
        this.refreshCache(key, loaderFunction, ttl).catch(err => {
          console.error('Refresh failed:', err);
        });
      }

      return JSON.parse(value);
    }

    // Cache miss - load synchronously
    const freshData = await loaderFunction();
    if (freshData) {
      await this.cache.setex(key, ttl, JSON.stringify(freshData));
    }

    return freshData;
  }

  async refreshCache(key, loaderFunction, ttl) {
    const freshData = await loaderFunction();
    if (freshData) {
      await this.cache.setex(key, ttl, JSON.stringify(freshData));
      console.log(`Cache refreshed: ${key}`);
    }
  }
}

// Usage
const cache = new RefreshAheadCache(redis, db);

app.get('/api/trending-products', async (req, res) => {
  // Frequently accessed - good for refresh-ahead
  const products = await cache.get(
    'trending-products',
    async () => {
      // Expensive query
      return await db.query(`
        SELECT * FROM products
        WHERE score > 100
        ORDER BY score DESC
        LIMIT 20
      `);
    },
    300 // TTL: 5 minutes
  );

  // When TTL < 60s, cache refreshes in background
  // Users never experience cache miss slowdown!

  res.json(products);
});
```

**Pros**:
- ✅ **No cache miss penalty** (always refreshed before expiry)
- ✅ **Predictable performance** (always fast)

**Cons**:
- ❌ **Wasted refreshes** (if data isn't accessed)
- ❌ **Complex implementation**

**Use Case**: Homepage, trending items, leaderboards (frequently accessed data)

---

## 📊 Strategy Comparison

### When to Use Each Strategy

```javascript
// 1. CACHE-ASIDE - General purpose (80% of cases)
// Use for: User profiles, product details, blog posts
class UserService {
  async getUser(id) {
    const cached = await redis.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    const user = await db.getUser(id);
    await redis.setex(`user:${id}`, 3600, JSON.stringify(user));
    return user;
  }
}

// 2. WRITE-THROUGH - Strong consistency required
// Use for: Shopping cart, user preferences, game scores
class CartService {
  async addItem(userId, item) {
    // Both must succeed
    await Promise.all([
      redis.sadd(`cart:${userId}`, JSON.stringify(item)),
      db.query('INSERT INTO cart_items ...')
    ]);
  }
}

// 3. WRITE-BEHIND - High write throughput
// Use for: Page views, likes, analytics
class AnalyticsService {
  async trackView(pageId) {
    // Fast: Just increment Redis
    await redis.incr(`views:${pageId}`);

    // Background job syncs to DB every minute
  }
}

// 4. REFRESH-AHEAD - Frequently accessed
// Use for: Homepage data, trending items, global configs
class TrendingService {
  async getTrending() {
    // Refreshes automatically before expiry
    return await refreshAheadCache.get('trending', fetchTrending, 300);
  }
}
```

---

### Performance Characteristics

| Strategy | Read Latency | Write Latency | Consistency | Complexity |
|----------|--------------|---------------|-------------|------------|
| Cache-Aside | 5ms (hit) / 50ms (miss) | 50ms | Eventual | Low |
| Read-Through | 5ms (hit) / 50ms (miss) | 50ms | Eventual | Medium |
| Write-Through | 5ms | 55ms (cache + DB) | Strong | Medium |
| Write-Behind | 5ms | 5ms | Eventual | High |
| Refresh-Ahead | 5ms (always hit) | 50ms | Eventual | High |

---

## 🎯 Real-World Example: E-commerce System

```javascript
// ecommerce-caching.js
class EcommerceCache {
  constructor(redis, db) {
    this.cache = redis;
    this.db = db;
  }

  // Product catalog - CACHE-ASIDE (rarely changes)
  async getProduct(productId) {
    const key = `product:${productId}`;
    const cached = await this.cache.get(key);

    if (cached) return JSON.parse(cached);

    const product = await this.db.query('SELECT * FROM products WHERE id = $1', [productId]);
    await this.cache.setex(key, 3600, JSON.stringify(product)); // 1 hour

    return product;
  }

  // Shopping cart - WRITE-THROUGH (consistency matters)
  async addToCart(userId, item) {
    const key = `cart:${userId}`;

    // Write to both (atomic)
    await Promise.all([
      this.cache.sadd(key, JSON.stringify(item)),
      this.db.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)', [userId, item.productId, item.quantity])
    ]);
  }

  // Page views - WRITE-BEHIND (high volume, ok to lose some)
  async trackView(productId) {
    await this.cache.incr(`views:${productId}`);

    // Background job syncs every 10 seconds
  }

  // Trending products - REFRESH-AHEAD (frequently accessed)
  async getTrending() {
    return await refreshAheadCache.get(
      'trending-products',
      async () => {
        return await this.db.query('SELECT * FROM products ORDER BY views DESC LIMIT 20');
      },
      300
    );
  }
}
```

---

## 🎓 Interview Tips

### What Interviewers Want to Hear

1. **Trade-offs**: "Cache-aside is simple but has cache miss penalty. Write-behind is fast but risks data loss."
2. **Use Cases**: "Shopping cart needs write-through for consistency. Analytics can use write-behind."
3. **Failure Scenarios**: "If cache fails with cache-aside, app still works (from DB). With write-through, writes fail."

### Common Follow-ups

**Q: How do you prevent cache stampede?**
A: "Use locks (SETNX in Redis), request coalescing, or probabilistic early expiration."

**Q: How do you handle cache invalidation?**
A: "Invalidate on write (cache-aside), use TTLs, or use event-driven invalidation (pub/sub)."

**Q: What if cache and DB get out of sync?**
A: "Use write-through for strong consistency, or periodic reconciliation jobs for eventual consistency."

---

## 🔗 Related Questions

- [Redis Caching Fundamentals](/interview-prep/caching-cdn/redis-fundamentals)
- [CDN Usage and Optimization](/interview-prep/caching-cdn/cdn-usage)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Database Scaling Strategies](/interview-prep/database/scaling-strategies)

---

## 📚 Additional Resources

- [Caching Best Practices](https://aws.amazon.com/caching/best-practices/)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)
- [Cache Strategies Comparison](https://codeahoy.com/2017/08/11/caching-strategies-and-how-to-choose-the-right-one/)
