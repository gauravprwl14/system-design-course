# POC #61: Cache-Aside Pattern (Lazy Loading)

> **Difficulty:** 🟢 Beginner
> **Time:** 20 minutes
> **Prerequisites:** Redis basics, Node.js

## What You'll Learn

The **Cache-Aside** (or Lazy Loading) pattern is the most common caching strategy. The application manages the cache explicitly:
1. Check cache first
2. If miss, load from database
3. Store in cache for next time

```
Cache-Aside Flow:
┌─────────────────────────────────────────────────────────┐
│                      Application                        │
│                                                         │
│  1. get(key)     ┌─────────┐    2. MISS                │
│  ───────────────▶│  Cache  │────────────▶              │
│  ◀───────────────│ (Redis) │                           │
│  4. return data  └─────────┘                           │
│                                                         │
│                      │ 3. query                         │
│                      ▼                                  │
│                 ┌──────────┐                            │
│                 │ Database │                            │
│                 └──────────┘                            │
│                      │                                  │
│                      │ 3b. set(key, data)              │
│                      └──────────────▶ Cache             │
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
    command: redis-server --appendonly yes

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
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, price, stock) VALUES
    ('Laptop', 999.99, 50),
    ('Phone', 599.99, 100),
    ('Tablet', 399.99, 75),
    ('Headphones', 149.99, 200),
    ('Keyboard', 79.99, 150);
```

---

## Implementation

```javascript
// cache-aside.js
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

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'product:';

// ==========================================
// CACHE-ASIDE PATTERN IMPLEMENTATION
// ==========================================

async function getProduct(productId) {
  const cacheKey = `${CACHE_PREFIX}${productId}`;
  const startTime = Date.now();

  // Step 1: Check cache first
  const cached = await redis.get(cacheKey);

  if (cached) {
    const elapsed = Date.now() - startTime;
    console.log(`✅ CACHE HIT: Product ${productId} (${elapsed}ms)`);
    return { ...JSON.parse(cached), source: 'cache', latency: elapsed };
  }

  // Step 2: Cache miss - fetch from database
  console.log(`❌ CACHE MISS: Product ${productId}`);
  const dbStart = Date.now();

  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1',
    [productId]
  );

  if (result.rows.length === 0) {
    return null; // Product not found
  }

  const product = result.rows[0];
  const dbElapsed = Date.now() - dbStart;

  // Step 3: Store in cache for next time
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(product));
  console.log(`📝 CACHED: Product ${productId} for ${CACHE_TTL}s`);

  const totalElapsed = Date.now() - startTime;
  return { ...product, source: 'database', latency: totalElapsed, dbLatency: dbElapsed };
}

// ==========================================
// CACHE INVALIDATION
// ==========================================

async function updateProduct(productId, updates) {
  const cacheKey = `${CACHE_PREFIX}${productId}`;

  // Update database first
  const setClauses = Object.keys(updates)
    .map((key, i) => `${key} = $${i + 2}`)
    .join(', ');

  await pool.query(
    `UPDATE products SET ${setClauses} WHERE id = $1`,
    [productId, ...Object.values(updates)]
  );

  // Invalidate cache (delete, don't update)
  await redis.del(cacheKey);
  console.log(`🗑️ INVALIDATED: Cache for product ${productId}`);

  return { success: true, invalidated: cacheKey };
}

// ==========================================
// BATCH OPERATIONS
// ==========================================

async function getProducts(productIds) {
  const results = [];
  const uncachedIds = [];

  // Step 1: Check cache for all items
  const cacheKeys = productIds.map(id => `${CACHE_PREFIX}${id}`);
  const cachedValues = await redis.mget(cacheKeys);

  for (let i = 0; i < productIds.length; i++) {
    if (cachedValues[i]) {
      results.push({
        id: productIds[i],
        data: JSON.parse(cachedValues[i]),
        source: 'cache'
      });
    } else {
      uncachedIds.push(productIds[i]);
    }
  }

  // Step 2: Fetch uncached items from database
  if (uncachedIds.length > 0) {
    const placeholders = uncachedIds.map((_, i) => `$${i + 1}`).join(', ');
    const dbResults = await pool.query(
      `SELECT * FROM products WHERE id IN (${placeholders})`,
      uncachedIds
    );

    // Step 3: Cache the fetched items
    const pipeline = redis.pipeline();
    for (const row of dbResults.rows) {
      const cacheKey = `${CACHE_PREFIX}${row.id}`;
      pipeline.setex(cacheKey, CACHE_TTL, JSON.stringify(row));
      results.push({ id: row.id, data: row, source: 'database' });
    }
    await pipeline.exec();
  }

  console.log(`📊 Batch: ${results.filter(r => r.source === 'cache').length} cache hits, ${uncachedIds.length} cache misses`);
  return results;
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('CACHE-ASIDE PATTERN DEMONSTRATION');
  console.log('='.repeat(60));

  // Clear cache for clean demo
  await redis.flushdb();
  console.log('\n🧹 Cache cleared\n');

  // Demo 1: First access (cache miss)
  console.log('--- Demo 1: First Access (Cold Cache) ---');
  const firstAccess = await getProduct(1);
  console.log('Result:', firstAccess);
  console.log();

  // Demo 2: Second access (cache hit)
  console.log('--- Demo 2: Second Access (Cache Hit) ---');
  const secondAccess = await getProduct(1);
  console.log('Result:', secondAccess);
  console.log(`🚀 Speedup: ${Math.round(firstAccess.latency / secondAccess.latency)}x faster`);
  console.log();

  // Demo 3: Update invalidates cache
  console.log('--- Demo 3: Update Invalidates Cache ---');
  await updateProduct(1, { price: 899.99 });
  const afterUpdate = await getProduct(1);
  console.log('Result after update:', afterUpdate);
  console.log();

  // Demo 4: Batch operations
  console.log('--- Demo 4: Batch Operations ---');
  await redis.flushdb();
  console.log('First batch (all misses):');
  await getProducts([1, 2, 3, 4, 5]);
  console.log('Second batch (all hits):');
  await getProducts([1, 2, 3, 4, 5]);
  console.log('Mixed batch:');
  await getProducts([1, 2, 6]); // 1,2 cached, 6 would miss (doesn't exist)

  // Demo 5: Cache TTL
  console.log('\n--- Demo 5: Cache Statistics ---');
  const keys = await redis.keys(`${CACHE_PREFIX}*`);
  console.log(`Cached products: ${keys.length}`);
  for (const key of keys) {
    const ttl = await redis.ttl(key);
    console.log(`  ${key}: ${ttl}s remaining`);
  }

  // Cleanup
  await redis.quit();
  await pool.end();
}

demonstrate().catch(console.error);
```

---

## Run the POC

```bash
# Start services
docker-compose up -d

# Wait for PostgreSQL to initialize
sleep 5

# Install dependencies
npm install ioredis pg

# Run demonstration
node cache-aside.js
```

---

## Expected Output

```
============================================================
CACHE-ASIDE PATTERN DEMONSTRATION
============================================================

🧹 Cache cleared

--- Demo 1: First Access (Cold Cache) ---
❌ CACHE MISS: Product 1
📝 CACHED: Product 1 for 300s
Result: {
  id: 1,
  name: 'Laptop',
  price: 999.99,
  stock: 50,
  source: 'database',
  latency: 15,
  dbLatency: 12
}

--- Demo 2: Second Access (Cache Hit) ---
✅ CACHE HIT: Product 1 (1ms)
Result: {
  id: 1,
  name: 'Laptop',
  price: 999.99,
  stock: 50,
  source: 'cache',
  latency: 1
}
🚀 Speedup: 15x faster

--- Demo 3: Update Invalidates Cache ---
🗑️ INVALIDATED: Cache for product 1
❌ CACHE MISS: Product 1
📝 CACHED: Product 1 for 300s
Result after update: {
  id: 1,
  name: 'Laptop',
  price: 899.99,  // Updated!
  stock: 50,
  source: 'database',
  latency: 8
}

--- Demo 4: Batch Operations ---
First batch (all misses):
📊 Batch: 0 cache hits, 5 cache misses
Second batch (all hits):
📊 Batch: 5 cache hits, 0 cache misses
Mixed batch:
📊 Batch: 2 cache hits, 1 cache misses
```

---

## Key Observations

### When to Use Cache-Aside

| Use Case | Good Fit? | Why |
|----------|-----------|-----|
| Read-heavy workloads | ✅ Yes | Most reads served from cache |
| Infrequently updated data | ✅ Yes | Cache invalidation is rare |
| Data that can be stale | ✅ Yes | TTL provides eventual consistency |
| Write-heavy workloads | ❌ No | Constant invalidation defeats purpose |
| Strong consistency required | ❌ No | Cache can be stale until TTL |

### Trade-offs

| Pros | Cons |
|------|------|
| Simple to implement | Cache can have stale data |
| Cache only what's needed | First request always slow (cold cache) |
| Database is source of truth | Application responsible for cache management |
| Graceful degradation if cache fails | N+1 cache problem with naive implementation |

---

## Common Pitfalls

### 1. Thundering Herd

```javascript
// ❌ WRONG: Multiple requests cause multiple DB queries
async function getProductNaive(productId) {
  const cached = await redis.get(cacheKey);
  if (!cached) {
    // 100 concurrent requests all hit DB!
    const product = await db.query(...);
    await redis.setex(cacheKey, TTL, product);
  }
}

// ✅ CORRECT: Use lock to prevent thundering herd
async function getProductSafe(productId) {
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${cacheKey}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 5);

  if (acquired) {
    // We got the lock, fetch from DB
    const product = await db.query(...);
    await redis.setex(cacheKey, TTL, JSON.stringify(product));
    await redis.del(lockKey);
    return product;
  } else {
    // Wait for the other request to populate cache
    await new Promise(resolve => setTimeout(resolve, 100));
    return getProductSafe(productId); // Retry
  }
}
```

### 2. Cache Stampede Prevention

```javascript
// ✅ Add jitter to TTL to prevent synchronized expiration
const jitter = Math.floor(Math.random() * 60); // 0-60 seconds
await redis.setex(cacheKey, CACHE_TTL + jitter, data);
```

---

## Production Checklist

- [ ] Set appropriate TTL based on data freshness requirements
- [ ] Implement proper error handling (fallback to DB if cache fails)
- [ ] Add cache hit/miss metrics for monitoring
- [ ] Use connection pooling for both Redis and database
- [ ] Consider implementing thundering herd protection
- [ ] Add jitter to TTL to prevent cache stampede
- [ ] Use batch operations (MGET/MSET) for multiple items

---

## Related POCs

- [POC #62: Write-Through Caching](/interview-prep/practice-pocs/write-through-caching)
- [POC #63: Cache Invalidation](/interview-prep/practice-pocs/cache-invalidation-strategies)
- [Caching Strategies Article](/system-design/caching/caching-strategies)
