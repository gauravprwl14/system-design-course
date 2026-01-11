# Redis Caching - Fundamentals & Best Practices

## Question
**"Explain Redis caching strategies. How do you handle TTL, eviction policies, and what are the common use cases?"**

Common in: Backend, System Design, Performance Engineering interviews

---

## 📊 Quick Answer

**Redis** is an in-memory key-value store used for:
1. **Caching** - Store frequently accessed data (80% of use cases)
2. **Session Storage** - User sessions across servers
3. **Rate Limiting** - Track request counts
4. **Leaderboards** - Sorted sets for rankings
5. **Pub/Sub** - Real-time messaging

**Key Concepts**:
- **TTL (Time To Live)**: Auto-expire keys after N seconds
- **Eviction Policies**: What to delete when memory is full
- **Data Structures**: Strings, Hashes, Lists, Sets, Sorted Sets

---

## 🎯 Complete Solution

### Redis Data Structures

```javascript
const Redis = require('ioredis');
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

// 1. STRING - Most common (simple key-value)
// Use case: Cache API responses, user sessions
await redis.set('user:1001', JSON.stringify({ name: 'Alice', email: 'alice@example.com' }));
await redis.setex('user:1001', 3600, JSON.stringify(userData)); // Expire in 1 hour

const user = JSON.parse(await redis.get('user:1001'));

// 2. HASH - Object fields (better than JSON strings)
// Use case: User profiles, product details
await redis.hset('user:1001', 'name', 'Alice');
await redis.hset('user:1001', 'email', 'alice@example.com');
await redis.hset('user:1001', 'age', 28);

// Get single field
const name = await redis.hget('user:1001', 'name');

// Get all fields
const allFields = await redis.hgetall('user:1001');
// { name: 'Alice', email: 'alice@example.com', age: '28' }

// 3. LIST - Ordered collection
// Use case: Activity feeds, job queues
await redis.lpush('notifications:1001', 'New message from Bob');
await redis.lpush('notifications:1001', 'Order shipped');

// Get latest 10 notifications
const notifications = await redis.lrange('notifications:1001', 0, 9);

// 4. SET - Unique items
// Use case: Tags, unique visitors
await redis.sadd('article:123:tags', 'javascript', 'redis', 'caching');

// Check if member exists
const hasTag = await redis.sismember('article:123:tags', 'redis'); // 1 (true)

// Get all tags
const tags = await redis.smembers('article:123:tags');

// 5. SORTED SET - Ordered by score
// Use case: Leaderboards, trending items
await redis.zadd('leaderboard', 1500, 'Alice');
await redis.zadd('leaderboard', 2000, 'Bob');
await redis.zadd('leaderboard', 1800, 'Charlie');

// Get top 10 players
const topPlayers = await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');
// ['Bob', '2000', 'Charlie', '1800', 'Alice', '1500']

// Get rank
const rank = await redis.zrevrank('leaderboard', 'Alice'); // 2 (0-indexed)
```

---

### TTL (Time To Live) Strategies

```javascript
// cache-with-ttl.js
class CacheService {
  constructor(redis) {
    this.redis = redis;
  }

  // Strategy 1: Fixed TTL
  async setWithTTL(key, value, ttlSeconds) {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  // Strategy 2: Sliding TTL (reset on access)
  async getWithSlidingTTL(key, ttlSeconds) {
    const value = await this.redis.get(key);
    if (value) {
      // Reset TTL on access
      await this.redis.expire(key, ttlSeconds);
      return JSON.parse(value);
    }
    return null;
  }

  // Strategy 3: Conditional TTL (different TTLs based on data)
  async cacheUser(userId, userData) {
    const isPremium = userData.isPremium;

    // Premium users: 1 hour, Regular users: 5 minutes
    const ttl = isPremium ? 3600 : 300;

    await this.redis.setex(
      `user:${userId}`,
      ttl,
      JSON.stringify(userData)
    );
  }

  // Strategy 4: Refresh TTL before expiry
  async getOrRefresh(key, fetchFunction, ttlSeconds, refreshThreshold = 0.8) {
    const value = await this.redis.get(key);
    const ttl = await this.redis.ttl(key);

    if (value) {
      // If TTL is less than 20% remaining, refresh in background
      if (ttl < ttlSeconds * (1 - refreshThreshold)) {
        // Refresh asynchronously (don't await)
        this.refreshCache(key, fetchFunction, ttlSeconds);
      }
      return JSON.parse(value);
    }

    // Cache miss - fetch and cache
    const freshData = await fetchFunction();
    await this.redis.setex(key, ttlSeconds, JSON.stringify(freshData));
    return freshData;
  }

  async refreshCache(key, fetchFunction, ttlSeconds) {
    try {
      const freshData = await fetchFunction();
      await this.redis.setex(key, ttlSeconds, JSON.stringify(freshData));
    } catch (err) {
      console.error('Cache refresh failed:', err);
    }
  }

  // Check remaining TTL
  async checkTTL(key) {
    const ttl = await this.redis.ttl(key);
    /*
      ttl > 0: Remaining seconds
      ttl = -1: Key exists but no expiry
      ttl = -2: Key doesn't exist
    */
    return ttl;
  }
}

// Usage
const cache = new CacheService(redis);

// Fixed TTL
await cache.setWithTTL('product:123', { name: 'Laptop', price: 999 }, 3600);

// Sliding TTL
const product = await cache.getWithSlidingTTL('product:123', 3600);

// Auto-refresh before expiry
const user = await cache.getOrRefresh(
  'user:5001',
  async () => await db.getUser(5001),
  600  // 10 minutes
);
```

---

### Eviction Policies

**When Redis runs out of memory, which keys should be deleted?**

```bash
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

**Eviction Policy Options**:

| Policy | Description | Use Case |
|--------|-------------|----------|
| **noeviction** | Return errors when memory full | Critical data that must not be lost |
| **allkeys-lru** | Evict least recently used keys | General caching (RECOMMENDED) |
| **allkeys-lfu** | Evict least frequently used | Hot data caching |
| **volatile-lru** | Evict LRU keys with TTL only | Mixed cache + persistent data |
| **volatile-ttl** | Evict keys with shortest TTL | Time-sensitive data |
| **allkeys-random** | Random eviction | Testing/development |

```javascript
// eviction-demo.js
class EvictionAwareCacheService {
  constructor(redis) {
    this.redis = redis;
  }

  // For allkeys-lru: Mark important keys as recently used
  async markAsImportant(key) {
    // Read the key to update LRU
    await this.redis.get(key);
  }

  // For volatile-ttl: Set appropriate TTLs
  async cacheByPriority(key, value, priority) {
    const ttlMap = {
      'critical': 86400,    // 24 hours
      'high': 3600,         // 1 hour
      'medium': 600,        // 10 minutes
      'low': 60             // 1 minute
    };

    const ttl = ttlMap[priority] || ttlMap.medium;
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  // Prevent eviction by not setting TTL on critical keys
  async setCritical(key, value) {
    // No TTL - won't be evicted by volatile-* policies
    await this.redis.set(key, JSON.stringify(value));
  }

  // Monitor memory usage
  async checkMemoryUsage() {
    const info = await this.redis.info('memory');
    const lines = info.split('\r\n');

    const stats = {};
    lines.forEach(line => {
      const [key, value] = line.split(':');
      if (key === 'used_memory_human') stats.usedMemory = value;
      if (key === 'maxmemory_human') stats.maxMemory = value;
      if (key === 'mem_fragmentation_ratio') stats.fragmentation = value;
    });

    return stats;
  }
}

// Usage
const cache = new EvictionAwareCacheService(redis);

// Critical data (no eviction with noeviction or volatile-* policies)
await cache.setCritical('config:api_keys', apiKeys);

// Priority-based caching
await cache.cacheByPriority('user:123', userData, 'high');
await cache.cacheByPriority('analytics:daily', stats, 'low');

// Monitor memory
const memStats = await cache.checkMemoryUsage();
console.log('Memory:', memStats);
// { usedMemory: '1.2G', maxMemory: '2.0G', fragmentation: '1.05' }
```

---

## 💻 Common Use Cases

### 1. Cache-Aside Pattern (Most Common)

```javascript
// cache-aside.js
app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id;
  const cacheKey = `product:${productId}`;

  // 1. Check cache first
  let product = await redis.get(cacheKey);

  if (product) {
    console.log('CACHE HIT');
    return res.json(JSON.parse(product));
  }

  console.log('CACHE MISS');

  // 2. Query database
  product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);

  // 3. Store in cache
  await redis.setex(cacheKey, 3600, JSON.stringify(product));

  res.json(product);
});

// Invalidate cache on update
app.put('/api/products/:id', async (req, res) => {
  const productId = req.params.id;

  await db.query('UPDATE products SET ... WHERE id = $1', [productId]);

  // CRITICAL: Delete cache after update
  await redis.del(`product:${productId}`);

  res.json({ success: true });
});
```

---

### 2. Session Storage

```javascript
// session-store.js
const session = require('express-session');
const RedisStore = require('connect-redis').default;

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Store session data
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await authenticateUser(username, password);

  if (user) {
    req.session.userId = user.id;
    req.session.role = user.role;

    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Access session data
app.get('/api/profile', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await db.getUser(req.session.userId);
  res.json(user);
});

// Logout - destroy session
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});
```

---

### 3. Rate Limiting

```javascript
// rate-limiter-redis.js
class RedisRateLimiter {
  constructor(redis, maxRequests, windowSeconds) {
    this.redis = redis;
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  async isAllowed(userId) {
    const key = `rate_limit:${userId}`;
    const now = Date.now();
    const windowStart = now - (this.windowSeconds * 1000);

    // Use Redis transaction
    const multi = this.redis.multi();

    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);

    // Count requests in window
    multi.zcard(key);

    // Add current request
    multi.zadd(key, now, now);

    // Set expiry
    multi.expire(key, this.windowSeconds);

    const results = await multi.exec();
    const count = results[1][1]; // Get count from zcard

    return {
      allowed: count < this.maxRequests,
      remaining: Math.max(0, this.maxRequests - count - 1)
    };
  }
}

// Usage
const limiter = new RedisRateLimiter(redis, 100, 60); // 100 req/min

app.use(async (req, res, next) => {
  const userId = req.user?.id || req.ip;

  const { allowed, remaining } = await limiter.isAllowed(userId);

  res.set('X-RateLimit-Remaining', remaining);

  if (!allowed) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: 60
    });
  }

  next();
});
```

---

### 4. Leaderboard

```javascript
// leaderboard.js
class Leaderboard {
  constructor(redis, name) {
    this.redis = redis;
    this.key = `leaderboard:${name}`;
  }

  // Add or update score
  async updateScore(userId, score) {
    await this.redis.zadd(this.key, score, userId);
  }

  // Increment score
  async incrementScore(userId, points) {
    await this.redis.zincrby(this.key, points, userId);
  }

  // Get top N players
  async getTopPlayers(n = 10) {
    const results = await this.redis.zrevrange(
      this.key,
      0,
      n - 1,
      'WITHSCORES'
    );

    // Convert to array of objects
    const players = [];
    for (let i = 0; i < results.length; i += 2) {
      players.push({
        userId: results[i],
        score: parseInt(results[i + 1]),
        rank: (i / 2) + 1
      });
    }

    return players;
  }

  // Get player rank
  async getPlayerRank(userId) {
    const rank = await this.redis.zrevrank(this.key, userId);
    const score = await this.redis.zscore(this.key, userId);

    if (rank === null) return null;

    return {
      userId,
      rank: rank + 1, // Convert to 1-indexed
      score: parseInt(score)
    };
  }

  // Get players around a user (context)
  async getPlayersAround(userId, range = 5) {
    const rank = await this.redis.zrevrank(this.key, userId);
    if (rank === null) return null;

    const start = Math.max(0, rank - range);
    const end = rank + range;

    const results = await this.redis.zrevrange(
      this.key,
      start,
      end,
      'WITHSCORES'
    );

    const players = [];
    for (let i = 0; i < results.length; i += 2) {
      players.push({
        userId: results[i],
        score: parseInt(results[i + 1]),
        rank: start + (i / 2) + 1
      });
    }

    return players;
  }
}

// Usage in game API
const leaderboard = new Leaderboard(redis, 'global');

app.post('/api/game/score', async (req, res) => {
  const { userId, points } = req.body;

  await leaderboard.incrementScore(userId, points);

  const playerRank = await leaderboard.getPlayerRank(userId);

  res.json(playerRank);
});

app.get('/api/leaderboard', async (req, res) => {
  const topPlayers = await leaderboard.getTopPlayers(100);
  res.json(topPlayers);
});

app.get('/api/leaderboard/me', async (req, res) => {
  const userId = req.user.id;

  const context = await leaderboard.getPlayersAround(userId, 5);

  res.json(context);
});
```

---

## 🎯 Redis Best Practices

### 1. Key Naming Convention

```javascript
// GOOD: Hierarchical, descriptive keys
const goodKeys = [
  'user:1001:profile',
  'user:1001:sessions',
  'product:5001:details',
  'product:5001:reviews:count',
  'cache:api:users:1001',
  'rate_limit:user:1001:api',
  'leaderboard:game:daily:2024-01-15'
];

// BAD: Unclear, hard to debug
const badKeys = [
  'u1001',
  'prod5001',
  'cache123',
  'data'
];

// Use consistent separators
const SEPARATOR = ':';
const makeKey = (...parts) => parts.join(SEPARATOR);

const userKey = makeKey('user', userId, 'profile');
const cacheKey = makeKey('cache', 'api', endpoint, params);
```

---

### 2. Pipeline for Bulk Operations

```javascript
// BAD: Multiple round trips (slow!)
for (let i = 0; i < 1000; i++) {
  await redis.set(`key:${i}`, `value:${i}`); // 1000 network calls!
}

// GOOD: Pipeline (fast!)
const pipeline = redis.pipeline();

for (let i = 0; i < 1000; i++) {
  pipeline.set(`key:${i}`, `value:${i}`);
}

await pipeline.exec(); // Single network call!

// Example: Bulk cache population
async function cacheMultipleUsers(userIds) {
  const pipeline = redis.pipeline();

  userIds.forEach(userId => {
    const key = `user:${userId}`;
    const userData = fetchUserData(userId); // Assume this is sync or cached
    pipeline.setex(key, 3600, JSON.stringify(userData));
  });

  await pipeline.exec();
}
```

---

### 3. Handle Connection Failures

```javascript
// redis-client.js
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,

  // Retry strategy
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },

  // Max retry time
  maxRetriesPerRequest: 3,

  // Enable reconnect on error
  enableOfflineQueue: false // Don't queue commands when disconnected
});

// Event handlers
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('ready', () => {
  console.log('Redis ready to accept commands');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

// Graceful fallback when Redis is down
async function getCachedData(key, fallbackFn) {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error('Redis error, using fallback:', err);
  }

  // Fallback to database
  return await fallbackFn();
}
```

---

## 📈 Performance Impact

### Cache Hit Rates

```
No Cache:
- Database query: 50-200ms per request
- 1000 req/sec = Database overload

With Redis Cache (80% hit rate):
- Cache hit: 5ms
- Cache miss: 50ms (DB) + 2ms (cache write)
- Average: (0.8 × 5ms) + (0.2 × 52ms) = 14.4ms
- 3.5x faster!
```

### Memory Efficiency

```javascript
// JSON String (inefficient)
await redis.set('user:1001', JSON.stringify({
  name: 'Alice',
  email: 'alice@example.com',
  age: 28
}));
// Size: ~60 bytes

// Hash (efficient)
await redis.hset('user:1001', 'name', 'Alice');
await redis.hset('user:1001', 'email', 'alice@example.com');
await redis.hset('user:1001', 'age', 28);
// Size: ~40 bytes (33% smaller!)
```

---

## 🎓 Interview Tips

### Common Questions

**Q: When would you NOT use Redis?**
A: "When data must persist after restart (use database), when data is larger than RAM (use disk-based storage), or when strong consistency is required (use database with ACID transactions)."

**Q: How do you prevent cache stampede?**
A: "Use locks or the 'refresh ahead' pattern. When cache expires, first request gets a lock, fetches data, and updates cache. Other requests wait for the lock or use stale data temporarily."

**Q: Redis vs Memcached?**
A: "Redis has richer data structures (lists, sets, sorted sets), persistence options, pub/sub, and Lua scripting. Memcached is simpler and slightly faster for pure key-value caching."

---

## 🔗 Related Questions

- [Cache Strategies (cache-aside, write-through)](/interview-prep/caching-cdn/cache-strategies)
- [CDN Usage and Optimization](/interview-prep/caching-cdn/cdn-usage)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Rate Limiting Implementation](/interview-prep/system-design/rate-limiting)

---

## 📚 Additional Resources

- [Redis Official Documentation](https://redis.io/documentation)
- [Redis Command Reference](https://redis.io/commands)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Redis Data Types](https://redis.io/topics/data-types)
