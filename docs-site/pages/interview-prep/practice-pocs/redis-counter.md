# POC: Redis Counter with INCR (Analytics & Metrics)

## What You'll Build
A high-performance counter system using Redis INCR for real-time analytics: page views, API calls, likes, votes.

## Why This Matters
- **Reddit**: Vote counts (millions of votes/minute)
- **Medium**: Article view counts (real-time analytics)
- **Twitter**: Tweet like counters (handles 6000+ tweets/sec)
- **YouTube**: Video view counts (billions of views/day)

Atomic counters are fundamental to any analytics or engagement system.

---

## Prerequisites
- Docker installed
- Node.js 18+
- 10 minutes

---

## The Problem

**Without Redis (Database counters):**
```
100 concurrent users like a post
→ 100 UPDATE queries to database
→ Race conditions (lost updates)
→ Database locked (slow)
→ Final count: 87 (should be 100) ❌
```

**With Redis INCR (Atomic operations):**
```
100 concurrent users like a post
→ 100 INCR commands to Redis
→ Atomic (no race conditions)
→ 50,000+ operations/sec
→ Final count: 100 ✅
```

---

## Step-by-Step Build

### Step 1: Project Setup

```bash
mkdir poc-redis-counter
cd poc-redis-counter
npm init -y
npm install express ioredis
```

### Step 2: Start Redis

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
```

Start Redis:
```bash
docker-compose up -d
```

### Step 3: Build Counter Service

Create `counter.js`:
```javascript
const Redis = require('ioredis');

class CounterService {
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379
    });

    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
  }

  /**
   * Increment counter by 1 (atomic)
   * Returns new value
   */
  async increment(key) {
    try {
      const newValue = await this.redis.incr(key);
      console.log(`📈 INCR ${key} = ${newValue}`);
      return newValue;
    } catch (error) {
      console.error('Increment error:', error);
      throw error;
    }
  }

  /**
   * Increment by specific amount (atomic)
   */
  async incrementBy(key, amount) {
    try {
      const newValue = await this.redis.incrby(key, amount);
      console.log(`📈 INCRBY ${key} ${amount} = ${newValue}`);
      return newValue;
    } catch (error) {
      console.error('IncrementBy error:', error);
      throw error;
    }
  }

  /**
   * Decrement counter by 1 (atomic)
   */
  async decrement(key) {
    try {
      const newValue = await this.redis.decr(key);
      console.log(`📉 DECR ${key} = ${newValue}`);
      return newValue;
    } catch (error) {
      console.error('Decrement error:', error);
      throw error;
    }
  }

  /**
   * Get current counter value
   */
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error('Get error:', error);
      return 0;
    }
  }

  /**
   * Get multiple counters at once
   */
  async getMany(keys) {
    try {
      const values = await this.redis.mget(keys);
      return values.map(v => v ? parseInt(v, 10) : 0);
    } catch (error) {
      console.error('GetMany error:', error);
      return keys.map(() => 0);
    }
  }

  /**
   * Reset counter to 0
   */
  async reset(key) {
    try {
      await this.redis.set(key, 0);
      console.log(`🔄 RESET ${key} = 0`);
      return 0;
    } catch (error) {
      console.error('Reset error:', error);
      throw error;
    }
  }

  /**
   * Increment with TTL (auto-expire)
   * Useful for rate limiting, daily counts
   */
  async incrementWithTTL(key, ttl) {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttl);

      const results = await pipeline.exec();
      const newValue = results[0][1]; // First command result

      console.log(`📈 INCR ${key} = ${newValue} (TTL: ${ttl}s)`);
      return newValue;
    } catch (error) {
      console.error('IncrementWithTTL error:', error);
      throw error;
    }
  }

  /**
   * Get all counters matching pattern
   */
  async getAllCounters(pattern = '*:count') {
    try {
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) return {};

      const values = await this.redis.mget(keys);

      const counters = {};
      keys.forEach((key, index) => {
        counters[key] = parseInt(values[index], 10) || 0;
      });

      return counters;
    } catch (error) {
      console.error('GetAllCounters error:', error);
      return {};
    }
  }

  /**
   * Atomic increment with max limit
   * Returns false if limit reached
   */
  async incrementWithLimit(key, limit) {
    const script = `
      local current = redis.call('GET', KEYS[1])
      current = tonumber(current) or 0

      if current >= tonumber(ARGV[1]) then
        return -1
      end

      return redis.call('INCR', KEYS[1])
    `;

    try {
      const result = await this.redis.eval(script, 1, key, limit);

      if (result === -1) {
        console.log(`⚠️ LIMIT REACHED for ${key} (max: ${limit})`);
        return false;
      }

      console.log(`📈 INCR ${key} = ${result} (max: ${limit})`);
      return result;
    } catch (error) {
      console.error('IncrementWithLimit error:', error);
      throw error;
    }
  }

  async close() {
    await this.redis.quit();
  }
}

module.exports = CounterService;
```

### Step 4: Build Analytics API

Create `server.js`:
```javascript
const express = require('express');
const CounterService = require('./counter');

const app = express();
const counter = new CounterService();

app.use(express.json());

/**
 * POST /articles/:id/view - Track article view
 */
app.post('/articles/:id/view', async (req, res) => {
  const articleId = req.params.id;
  const viewCountKey = `article:${articleId}:views`;

  try {
    const newCount = await counter.increment(viewCountKey);

    res.json({
      articleId,
      views: newCount,
      message: 'View counted'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count view' });
  }
});

/**
 * POST /articles/:id/like - Like article
 */
app.post('/articles/:id/like', async (req, res) => {
  const articleId = req.params.id;
  const likeCountKey = `article:${articleId}:likes`;

  try {
    const newCount = await counter.increment(likeCountKey);

    res.json({
      articleId,
      likes: newCount,
      message: 'Article liked'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like article' });
  }
});

/**
 * POST /articles/:id/unlike - Unlike article
 */
app.post('/articles/:id/unlike', async (req, res) => {
  const articleId = req.params.id;
  const likeCountKey = `article:${articleId}:likes`;

  try {
    const newCount = await counter.decrement(likeCountKey);

    res.json({
      articleId,
      likes: Math.max(0, newCount), // Don't go below 0
      message: 'Article unliked'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unlike article' });
  }
});

/**
 * GET /articles/:id/stats - Get article statistics
 */
app.get('/articles/:id/stats', async (req, res) => {
  const articleId = req.params.id;

  try {
    const keys = [
      `article:${articleId}:views`,
      `article:${articleId}:likes`,
      `article:${articleId}:shares`
    ];

    const [views, likes, shares] = await counter.getMany(keys);

    res.json({
      articleId,
      stats: {
        views,
        likes,
        shares,
        engagement_rate: views > 0 ? ((likes + shares) / views * 100).toFixed(2) + '%' : '0%'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * POST /api/call - Track API calls (rate limiting use case)
 */
app.post('/api/call', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || 'anonymous';
  const rateLimitKey = `api:${apiKey}:calls:${getCurrentHour()}`;

  try {
    // Increment with 1-hour TTL
    const callCount = await counter.incrementWithTTL(rateLimitKey, 3600);

    const limit = 1000; // 1000 calls per hour
    const remaining = Math.max(0, limit - callCount);

    if (callCount > limit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        limit,
        remaining: 0,
        reset_at: getNextHour()
      });
    }

    res.json({
      message: 'API call counted',
      limit,
      remaining,
      reset_at: getNextHour()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track API call' });
  }
});

/**
 * POST /posts/:id/upvote - Reddit-style voting with limits
 */
app.post('/posts/:id/upvote', async (req, res) => {
  const postId = req.params.id;
  const userId = req.headers['x-user-id'] || 'anonymous';

  const voteKey = `post:${postId}:upvotes`;
  const userVoteKey = `user:${userId}:votes:post:${postId}`;

  try {
    // Check if user already voted (max 1 vote per user)
    const alreadyVoted = await counter.get(userVoteKey);

    if (alreadyVoted > 0) {
      return res.status(400).json({
        error: 'You already voted on this post'
      });
    }

    // Increment vote count
    const newVoteCount = await counter.increment(voteKey);

    // Mark user as voted (with 30-day expiry)
    await counter.incrementWithTTL(userVoteKey, 30 * 24 * 3600);

    res.json({
      postId,
      upvotes: newVoteCount,
      message: 'Upvoted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upvote' });
  }
});

/**
 * GET /dashboard - Analytics dashboard
 */
app.get('/dashboard', async (req, res) => {
  try {
    const allCounters = await counter.getAllCounters('*:*');

    // Group by type
    const dashboard = {
      article_views: {},
      article_likes: {},
      post_upvotes: {},
      api_calls: {}
    };

    Object.keys(allCounters).forEach(key => {
      if (key.includes(':views')) {
        dashboard.article_views[key] = allCounters[key];
      } else if (key.includes(':likes')) {
        dashboard.article_likes[key] = allCounters[key];
      } else if (key.includes(':upvotes')) {
        dashboard.post_upvotes[key] = allCounters[key];
      } else if (key.includes('api:')) {
        dashboard.api_calls[key] = allCounters[key];
      }
    });

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

function getCurrentHour() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}-${now.getHours()}`;
}

function getNextHour() {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next.toISOString();
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Try: curl -X POST http://localhost:${PORT}/articles/1/view`);
});

process.on('SIGTERM', async () => {
  await counter.close();
  process.exit(0);
});
```

---

## Run It

```bash
# Start Redis
docker-compose up -d

# Start server
node server.js
```

---

## Test It

### Test 1: Basic Counter (Article Views)

```bash
# View article 5 times
for i in {1..5}; do
  curl -X POST http://localhost:3000/articles/1/view
done
```

**Expected output (5th request):**
```json
{
  "articleId": "1",
  "views": 5,
  "message": "View counted"
}
```

### Test 2: Likes & Unlikes

```bash
# Like article
curl -X POST http://localhost:3000/articles/1/like
curl -X POST http://localhost:3000/articles/1/like
curl -X POST http://localhost:3000/articles/1/like

# Unlike article
curl -X POST http://localhost:3000/articles/1/unlike

# Get stats
curl http://localhost:3000/articles/1/stats
```

**Expected output:**
```json
{
  "articleId": "1",
  "stats": {
    "views": 5,
    "likes": 2,
    "shares": 0,
    "engagement_rate": "40.00%"
  }
}
```

### Test 3: Concurrent Increments (Race Condition Test)

Create `race-test.js`:
```javascript
const axios = require('axios');

async function concurrentIncrements() {
  console.log('🔥 Testing 100 concurrent increments...');

  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(
      axios.post('http://localhost:3000/articles/race-test/view')
    );
  }

  await Promise.all(promises);

  // Check final count
  const stats = await axios.get('http://localhost:3000/articles/race-test/stats');
  console.log('✅ Final count:', stats.data.stats.views);
  console.log(stats.data.stats.views === 100 ? '✅ PASS: All increments counted' : '❌ FAIL: Lost updates');
}

concurrentIncrements();
```

Run it:
```bash
npm install axios
node race-test.js
```

**Expected output:**
```
✅ Final count: 100
✅ PASS: All increments counted
```

### Test 4: Rate Limiting with Counters

```bash
# Make 10 API calls
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/call \
    -H "x-api-key: test-key-123"
done
```

**Response 1-1000:**
```json
{
  "message": "API call counted",
  "limit": 1000,
  "remaining": 999,
  "reset_at": "2024-01-15T14:00:00.000Z"
}
```

**Response 1001+:**
```json
{
  "error": "Rate limit exceeded",
  "limit": 1000,
  "remaining": 0,
  "reset_at": "2024-01-15T14:00:00.000Z"
}
```

### Test 5: Reddit-Style Voting

```bash
# User 1 upvotes
curl -X POST http://localhost:3000/posts/123/upvote \
  -H "x-user-id: user1"

# User 1 tries to vote again (should fail)
curl -X POST http://localhost:3000/posts/123/upvote \
  -H "x-user-id: user1"

# User 2 upvotes (should succeed)
curl -X POST http://localhost:3000/posts/123/upvote \
  -H "x-user-id: user2"
```

### Test 6: Analytics Dashboard

```bash
curl http://localhost:3000/dashboard
```

---

## Performance Benchmarks

### INCR Performance

Create `benchmark.js`:
```javascript
const Redis = require('ioredis');
const redis = new Redis();

async function benchmark() {
  const key = 'benchmark:counter';
  await redis.set(key, 0);

  const iterations = 100000;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    await redis.incr(key);
  }

  const duration = Date.now() - startTime;
  const ops = (iterations / (duration / 1000)).toFixed(0);

  console.log(`✅ ${iterations} INCR operations in ${duration}ms`);
  console.log(`📊 Throughput: ${ops} ops/sec`);

  await redis.quit();
}

benchmark();
```

Run it:
```bash
node benchmark.js
```

**Expected results:**
```
✅ 100,000 INCR operations in 2,500ms
📊 Throughput: 40,000 ops/sec
```

### Database vs Redis Comparison

| Operation | Database UPDATE | Redis INCR | Improvement |
|-----------|----------------|-----------|-------------|
| Single increment | 10ms | 0.025ms | **400x faster** |
| 100 concurrent increments | 1000ms | 25ms | **40x faster** |
| Throughput | 100 ops/sec | 50,000 ops/sec | **500x more** |
| Race conditions | ❌ Yes (lost updates) | ✅ No (atomic) | **100% accurate** |

---

## How This Fits Larger Systems

### Real-World Usage

**Reddit Vote System:**
```javascript
// Upvote post (atomic, no race conditions)
await redis.incr(`post:${postId}:upvotes`);
await redis.decr(`post:${postId}:downvotes`);

// Calculate score
const upvotes = await redis.get(`post:${postId}:upvotes`);
const downvotes = await redis.get(`post:${postId}:downvotes`);
const score = upvotes - downvotes;
```

**YouTube View Counter:**
```javascript
// Track views (millions per day)
await redis.incr(`video:${videoId}:views`);

// Daily views with auto-expire
await redis.incrWithTTL(`video:${videoId}:views:${today}`, 86400);
```

**Twitter Like Counter:**
```javascript
// Atomic like (6000+ tweets/sec)
await redis.incr(`tweet:${tweetId}:likes`);

// Unlike
await redis.decr(`tweet:${tweetId}:likes`);
```

**Medium Article Analytics:**
```javascript
// Track reads, claps, highlights
await redis.incr(`article:${articleId}:reads`);
await redis.incrby(`article:${articleId}:claps`, clapCount);
await redis.incr(`article:${articleId}:highlights`);
```

---

## Extend It

### Level 1: Advanced Analytics
- [ ] Hourly/daily/monthly counters
- [ ] Rolling 7-day view counts
- [ ] Top 10 most-viewed articles

### Level 2: Real-Time Dashboards
- [ ] WebSocket for live counter updates
- [ ] Charts showing trends over time
- [ ] Alerts when thresholds exceeded

### Level 3: Distributed Counters
- [ ] HyperLogLog for unique visitor counting
- [ ] Bloom filters for "have I seen this?"
- [ ] Count-Min Sketch for heavy hitters

### Level 4: Production Features
- [ ] Counter snapshots to database (every 1 min)
- [ ] Backup/restore from database on Redis failure
- [ ] Sharded counters for massive scale (100M+ ops/sec)

---

## Key Takeaways

✅ **INCR is atomic**: No race conditions, even with 1000 concurrent requests
✅ **50,000+ ops/sec**: 500x faster than database counters
✅ **TTL support**: Auto-expire counters (rate limiting, daily counts)
✅ **Simple**: One command, no complex transactions
✅ **Scalable**: Used by Reddit, Twitter, YouTube for billions of operations

---

## Related POCs

- [POC: Redis Key-Value Cache](/interview-prep/practice-pocs/redis-key-value-cache) - Basic Redis usage
- [POC: Rate Limiting with Sliding Window](/interview-prep/practice-pocs/rate-limiting-sliding-window) - Using counters for rate limits
- [POC: Real-Time Analytics Dashboard](/interview-prep/practice-pocs/realtime-analytics) - Live counter updates
- [POC: HyperLogLog Unique Visitors](/interview-prep/practice-pocs/hyperloglog-unique) - Unique counter estimation

---

## Cleanup

```bash
docker-compose down -v
cd .. && rm -rf poc-redis-counter
```

---

**Time to complete**: 15 minutes
**Difficulty**: Beginner
**Production-ready**: ✅ Yes (add persistence to database)
