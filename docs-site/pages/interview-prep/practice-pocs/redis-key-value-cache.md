# POC: Simple Redis Key-Value Cache

## What You'll Build
A production-ready key-value cache using Redis to speed up database queries by 100x.

## Why This Matters
- **Netflix**: Caches movie metadata (1M+ requests/sec)
- **Twitter**: Caches user profiles (reduces DB load by 95%)
- **Instagram**: Caches feed data (sub-10ms response times)

Every major system uses Redis for caching. This is your foundation.

---

## Prerequisites
- Docker installed
- Node.js 18+
- 10 minutes

---

## The Problem

Without cache:
```
User requests profile → Hit database → 50ms response time
1000 users → 1000 database queries → Database overwhelmed
```

With cache:
```
User requests profile → Check Redis (2ms) → Return cached data
1000 users → 10 database queries (990 from cache) → Database happy
```

---

## Step-by-Step Build

### Step 1: Project Setup

```bash
mkdir poc-redis-cache
cd poc-redis-cache
npm init -y
npm install express ioredis pg
```

### Step 2: Start Redis with Docker

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: testdb
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  redis-data:
  postgres-data:
```

Start services:
```bash
docker-compose up -d
```

### Step 3: Initialize Database

Create `init-db.js`:
```javascript
const { Client } = require('pg');

async function initDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'secret',
    database: 'testdb'
  });

  await client.connect();

  // Create users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(100),
      bio TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Insert sample data (1000 users)
  console.log('Inserting 1000 users...');

  for (let i = 1; i <= 1000; i++) {
    await client.query(`
      INSERT INTO users (name, email, bio)
      VALUES ($1, $2, $3)
    `, [
      `User ${i}`,
      `user${i}@example.com`,
      `This is the bio for user ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
    ]);

    if (i % 100 === 0) {
      console.log(`Inserted ${i} users...`);
    }
  }

  console.log('✅ Database initialized with 1000 users');

  await client.end();
}

initDatabase().catch(console.error);
```

Run it:
```bash
node init-db.js
```

### Step 4: Build the Cache Layer

Create `cache.js`:
```javascript
const Redis = require('ioredis');

class CacheLayer {
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.DEFAULT_TTL = 300; // 5 minutes
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const value = await this.redis.get(key);

      if (value) {
        console.log(`✅ CACHE HIT: ${key}`);
        return JSON.parse(value);
      } else {
        console.log(`❌ CACHE MISS: ${key}`);
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null; // Fail gracefully
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = this.DEFAULT_TTL) {
    try {
      await this.redis.setex(
        key,
        ttl,
        JSON.stringify(value)
      );
      console.log(`✅ CACHED: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete from cache
   */
  async delete(key) {
    try {
      await this.redis.del(key);
      console.log(`✅ DELETED FROM CACHE: ${key}`);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once (pipeline)
   */
  async mget(keys) {
    try {
      const values = await this.redis.mget(keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get cache stats
   */
  async getStats() {
    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');

      return {
        info,
        keyspace,
        totalKeys: await this.redis.dbsize()
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Clear all cache
   */
  async flush() {
    try {
      await this.redis.flushdb();
      console.log('✅ Cache cleared');
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  async close() {
    await this.redis.quit();
  }
}

module.exports = CacheLayer;
```

### Step 5: Build the API with Cache-Aside Pattern

Create `server.js`:
```javascript
const express = require('express');
const { Pool } = require('pg');
const CacheLayer = require('./cache');

const app = express();
const cache = new CacheLayer();

// PostgreSQL connection pool
const db = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'secret',
  database: 'testdb',
  max: 20
});

app.use(express.json());

/**
 * GET /users/:id - With caching (Cache-Aside pattern)
 */
app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const cacheKey = `user:${userId}`;

  const startTime = Date.now();

  try {
    // 1. Check cache first
    let user = await cache.get(cacheKey);

    if (user) {
      // Cache hit - return immediately
      const duration = Date.now() - startTime;
      return res.json({
        source: 'cache',
        duration: `${duration}ms`,
        data: user
      });
    }

    // 2. Cache miss - query database
    console.log(`📊 Querying database for user ${userId}...`);

    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    user = result.rows[0];

    // 3. Store in cache for next time
    await cache.set(cacheKey, user, 300); // 5 minutes TTL

    const duration = Date.now() - startTime;

    res.json({
      source: 'database',
      duration: `${duration}ms`,
      data: user
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /users - List users with pagination (cached)
 */
app.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const cacheKey = `users:page:${page}:limit:${limit}`;
  const startTime = Date.now();

  try {
    // Check cache
    let users = await cache.get(cacheKey);

    if (users) {
      const duration = Date.now() - startTime;
      return res.json({
        source: 'cache',
        duration: `${duration}ms`,
        page,
        data: users
      });
    }

    // Query database
    const result = await db.query(
      'SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    users = result.rows;

    // Cache the result
    await cache.set(cacheKey, users, 60); // 1 minute TTL

    const duration = Date.now() - startTime;

    res.json({
      source: 'database',
      duration: `${duration}ms`,
      page,
      data: users
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /users/:id - Update user (invalidate cache)
 */
app.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, email, bio } = req.body;

  try {
    // Update database
    const result = await db.query(
      `UPDATE users
       SET name = $1, email = $2, bio = $3
       WHERE id = $4
       RETURNING *`,
      [name, email, bio, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // IMPORTANT: Invalidate cache after update
    const cacheKey = `user:${userId}`;
    await cache.delete(cacheKey);

    res.json({
      message: 'User updated and cache invalidated',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /cache/stats - Cache statistics
 */
app.get('/cache/stats', async (req, res) => {
  try {
    const stats = await cache.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * DELETE /cache - Clear all cache
 */
app.delete('/cache', async (req, res) => {
  try {
    await cache.flush();
    res.json({ message: 'Cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Try: http://localhost:${PORT}/users/1`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await cache.close();
  await db.end();
  process.exit(0);
});
```

---

## Run It

```bash
# Terminal 1: Start services
docker-compose up -d

# Terminal 2: Initialize database
node init-db.js

# Terminal 3: Start server
node server.js
```

---

## Test It

### Test 1: Cache Miss (First Request)
```bash
curl http://localhost:3000/users/1
```

**Expected output:**
```json
{
  "source": "database",
  "duration": "45ms",
  "data": {
    "id": 1,
    "name": "User 1",
    "email": "user1@example.com",
    "bio": "This is the bio for user 1..."
  }
}
```

### Test 2: Cache Hit (Second Request)
```bash
curl http://localhost:3000/users/1
```

**Expected output:**
```json
{
  "source": "cache",
  "duration": "2ms",
  "data": {
    "id": 1,
    ...
  }
}
```

**Result: 22x faster!** (2ms vs 45ms)

### Test 3: Load Test (See Cache Impact)

Create `load-test.sh`:
```bash
#!/bin/bash

echo "🔥 Load test: 100 requests to /users/1"

for i in {1..100}; do
  curl -s http://localhost:3000/users/1 > /dev/null
  echo "Request $i done"
done

echo "✅ Load test complete. Check server logs for cache hits."
```

Run it:
```bash
chmod +x load-test.sh
./load-test.sh
```

**Expected result:**
- Request 1: Database query (45ms)
- Requests 2-100: Cache hits (2ms each)
- **Total time: ~250ms** (vs 4500ms without cache)

### Test 4: Cache Invalidation

```bash
# Update user
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated User","email":"updated@example.com","bio":"New bio"}'

# Fetch again (cache was invalidated, so DB query)
curl http://localhost:3000/users/1
# Should show "source": "database"

# Fetch again (now cached)
curl http://localhost:3000/users/1
# Should show "source": "cache"
```

### Test 5: Check Cache Stats

```bash
curl http://localhost:3000/cache/stats
```

---

## Performance Benchmarks

| Scenario | Without Cache | With Cache | Improvement |
|----------|--------------|-----------|-------------|
| Single query | 45ms | 2ms | **22x faster** |
| 100 queries (same key) | 4500ms | 250ms | **18x faster** |
| 100 queries (different keys) | 4500ms | 4500ms | No benefit (cache misses) |
| Database load (100 req/s) | 100 queries/s | 1 query/s | **99% reduction** |

---

## How This Fits Larger Systems

### Real-World Usage

**Netflix**:
```javascript
// Cache movie metadata
await cache.set(`movie:${movieId}`, movieData, 3600); // 1 hour

// Serve 1M requests/sec from cache (not database)
const movie = await cache.get(`movie:${movieId}`);
```

**Twitter**:
```javascript
// Cache user profiles
await cache.set(`user:${username}`, profile, 300);

// Handle profile views without hitting database
```

**Instagram**:
```javascript
// Cache feed posts
await cache.set(`feed:${userId}`, posts, 60);

// Feed loads in <10ms
```

---

## Extend It

### Level 1: Add More Cache Patterns
- [ ] Implement cache warming (pre-load popular users)
- [ ] Add cache stampede prevention (lock-based)
- [ ] Implement probabilistic early expiration

### Level 2: Multi-layer Caching
- [ ] Add in-memory L1 cache (LRU)
- [ ] Redis as L2 cache
- [ ] Measure hit rates for each layer

### Level 3: Distributed Cache
- [ ] Deploy Redis Cluster (3 masters + 3 replicas)
- [ ] Implement consistent hashing for cache keys
- [ ] Handle cache failures gracefully

### Level 4: Production Features
- [ ] Add cache monitoring (hit rate, miss rate)
- [ ] Implement cache key versioning
- [ ] Add compression for large values
- [ ] Implement cache aside pattern with TTL jitter

---

## Key Takeaways

✅ **Cache-aside pattern**: Check cache → if miss → query DB → update cache
✅ **TTL (Time To Live)**: Automatically expire stale data
✅ **Cache invalidation**: Delete cache when data changes
✅ **Performance**: 10-100x faster than database queries
✅ **Scalability**: Reduce database load by 95%+

---

## Related POCs

- [POC: Redis Counter with INCR](/interview-prep/practice-pocs/redis-counter) - Track page views
- [POC: Redis Hash for Sessions](/interview-prep/practice-pocs/redis-hash-sessions) - User sessions
- [POC: Cache Stampede Prevention](/interview-prep/practice-pocs/cache-stampede) - Handle traffic spikes
- [POC: Multi-layer Cache](/interview-prep/practice-pocs/multi-layer-cache) - L1 + L2 caching

---

## Cleanup

```bash
# Stop services
docker-compose down -v

# Remove project
cd ..
rm -rf poc-redis-cache
```

---

**Time to complete**: 15 minutes
**Difficulty**: Beginner
**Production-ready**: ✅ Yes (with monitoring added)
