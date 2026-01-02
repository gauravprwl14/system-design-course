# Rate Limiting - Implementation & Strategies

**Interview Question**: *"How will you design and implement rate limiting in your application?"*

**Difficulty**: 🟡 Intermediate
**Asked by**: HDFC, Amazon, Most Tech Companies
**Time to Answer**: 5-7 minutes

---

## 🎯 Quick Answer (30 seconds)

**Rate Limiting** = Controlling the number of requests a user/IP can make in a time window

**Common Algorithms**:
1. **Token Bucket** - Most flexible, allows bursts
2. **Leaky Bucket** - Smooth rate, no bursts
3. **Fixed Window** - Simple but has edge cases
4. **Sliding Window** - Accurate but more complex

**Implementation Options**:
- **Application Level**: Middleware (Express, Spring)
- **API Gateway**: AWS API Gateway, Kong, Nginx
- **Distributed**: Redis-based (for multiple servers)

**Typical Limits**: 100 requests/minute for APIs, 10 requests/minute for auth endpoints

---

## 📚 Detailed Explanation

### Why Rate Limiting?

**Problems it solves**:
1. **DDoS Protection**: Prevent abuse and attacks
2. **Cost Control**: Limit API usage costs
3. **Fair Usage**: Prevent one user from hogging resources
4. **Stability**: Protect backend from overload
5. **Monetization**: Different tiers (free, paid, enterprise)

---

## 🔧 Algorithm 1: Token Bucket (Most Popular)

### How it Works

```
Bucket has tokens (e.g., 100 tokens)
- Each request consumes 1 token
- Tokens refill at fixed rate (e.g., 10/second)
- If bucket empty → request rejected
- Allows bursts (use all tokens at once)
```

### Implementation (Node.js + Redis)

```javascript
const Redis = require('ioredis');
const redis = new Redis();

class TokenBucketRateLimiter {
  constructor(capacity, refillRate) {
    this.capacity = capacity;        // Max tokens
    this.refillRate = refillRate;    // Tokens added per second
  }

  async allowRequest(userId) {
    const key = `rate_limit:${userId}`;
    const now = Date.now();

    // Get current bucket state
    const data = await redis.hgetall(key);

    let tokens = data.tokens ? parseFloat(data.tokens) : this.capacity;
    let lastRefill = data.lastRefill ? parseInt(data.lastRefill) : now;

    // Calculate tokens to add based on time elapsed
    const timePassed = (now - lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;

    tokens = Math.min(this.capacity, tokens + tokensToAdd);

    // Check if request allowed
    if (tokens >= 1) {
      tokens -= 1; // Consume token

      // Update bucket state
      await redis.hmset(key, {
        tokens: tokens.toString(),
        lastRefill: now.toString()
      });
      await redis.expire(key, 3600); // Expire in 1 hour of inactivity

      return { allowed: true, remainingTokens: Math.floor(tokens) };
    }

    return { allowed: false, remainingTokens: 0 };
  }
}

// Usage
const limiter = new TokenBucketRateLimiter(100, 10); // 100 capacity, refill 10/sec

async function handleRequest(userId) {
  const result = await limiter.allowRequest(userId);

  if (result.allowed) {
    console.log(`Request allowed. Tokens left: ${result.remainingTokens}`);
    // Process request
  } else {
    console.log('Rate limit exceeded. Try again later.');
    // Return 429 Too Many Requests
  }
}
```

### Express Middleware

```javascript
function tokenBucketMiddleware(capacity, refillRate) {
  const limiter = new TokenBucketRateLimiter(capacity, refillRate);

  return async (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const result = await limiter.allowRequest(userId);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', capacity);
    res.setHeader('X-RateLimit-Remaining', result.remainingTokens);

    if (result.allowed) {
      next();
    } else {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(1 / refillRate) // seconds
      });
    }
  };
}

// Apply to routes
app.use('/api/', tokenBucketMiddleware(100, 10));
app.use('/api/auth/login', tokenBucketMiddleware(5, 0.1)); // Stricter for auth
```

**Pros**:
- ✅ Allows traffic bursts
- ✅ Smooth average rate
- ✅ Memory efficient

**Cons**:
- ❌ Slightly complex implementation
- ❌ Requires state tracking

---

## 🔧 Algorithm 2: Fixed Window Counter

### How it Works

```
Window: 1 minute (00:00 - 00:59)
Limit: 100 requests
- Count requests in current minute
- Reset counter at minute boundary
- If count >= limit → reject
```

### Implementation (Simple Redis)

```javascript
class FixedWindowRateLimiter {
  constructor(limit, windowSize) {
    this.limit = limit;           // Max requests
    this.windowSize = windowSize; // Window in seconds
  }

  async allowRequest(userId) {
    const now = Date.now();
    const windowKey = Math.floor(now / (this.windowSize * 1000));
    const key = `rate_limit:${userId}:${windowKey}`;

    // Increment counter
    const count = await redis.incr(key);

    // Set expiry on first request in window
    if (count === 1) {
      await redis.expire(key, this.windowSize);
    }

    const allowed = count <= this.limit;
    const remaining = Math.max(0, this.limit - count);

    return {
      allowed,
      remaining,
      resetAt: (windowKey + 1) * this.windowSize * 1000
    };
  }
}

// Usage
const limiter = new FixedWindowRateLimiter(100, 60); // 100 requests per 60 seconds

app.use(async (req, res, next) => {
  const userId = req.user?.id || req.ip;
  const result = await limiter.allowRequest(userId);

  res.setHeader('X-RateLimit-Limit', limiter.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  if (result.allowed) {
    next();
  } else {
    res.status(429).json({
      error: 'Rate limit exceeded',
      resetAt: result.resetAt
    });
  }
});
```

**Pros**:
- ✅ Very simple to implement
- ✅ Memory efficient
- ✅ Easy to understand

**Cons**:
- ❌ Edge case: 2x limit at window boundary
  ```
  00:59 - 100 requests
  01:00 - 100 requests (reset)
  → 200 requests in 2 seconds!
  ```

---

## 🔧 Algorithm 3: Sliding Window Log

### How it Works

```
Keep timestamp of each request
Remove timestamps older than window
If count < limit → allow
```

### Implementation

```javascript
class SlidingWindowLogRateLimiter {
  constructor(limit, windowSize) {
    this.limit = limit;
    this.windowSize = windowSize * 1000; // Convert to ms
  }

  async allowRequest(userId) {
    const key = `rate_limit:${userId}`;
    const now = Date.now();
    const windowStart = now - this.windowSize;

    // Remove old entries (outside window)
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // Count requests in current window
    const count = await redis.zcard(key);

    if (count < this.limit) {
      // Add current request with timestamp as score
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.expire(key, Math.ceil(this.windowSize / 1000));

      return {
        allowed: true,
        remaining: this.limit - count - 1
      };
    }

    return {
      allowed: false,
      remaining: 0
    };
  }
}

// Usage
const limiter = new SlidingWindowLogRateLimiter(100, 60);
```

**Pros**:
- ✅ No edge cases (precise)
- ✅ Accurate rate limiting

**Cons**:
- ❌ Memory intensive (stores all timestamps)
- ❌ More complex

---

## 🔧 Algorithm 4: Sliding Window Counter (Hybrid)

### Best of Both Worlds

```javascript
class SlidingWindowCounterRateLimiter {
  constructor(limit, windowSize) {
    this.limit = limit;
    this.windowSize = windowSize;
  }

  async allowRequest(userId) {
    const now = Date.now();
    const currentWindow = Math.floor(now / (this.windowSize * 1000));
    const previousWindow = currentWindow - 1;

    const currentKey = `rate_limit:${userId}:${currentWindow}`;
    const previousKey = `rate_limit:${userId}:${previousWindow}`;

    // Get counts
    const currentCount = await redis.get(currentKey) || 0;
    const previousCount = await redis.get(previousKey) || 0;

    // Calculate weighted count
    const elapsedTime = now % (this.windowSize * 1000);
    const weight = 1 - (elapsedTime / (this.windowSize * 1000));
    const estimatedCount = previousCount * weight + parseInt(currentCount);

    if (estimatedCount < this.limit) {
      // Increment current window
      await redis.incr(currentKey);
      await redis.expire(currentKey, this.windowSize * 2);

      return {
        allowed: true,
        remaining: Math.floor(this.limit - estimatedCount - 1)
      };
    }

    return { allowed: false, remaining: 0 };
  }
}
```

**Pros**:
- ✅ Memory efficient (only 2 counters)
- ✅ No edge cases
- ✅ Smooth rate limiting

---

## 🏢 Real-World Examples

### Example 1: Multi-Tier Rate Limiting

```javascript
class TieredRateLimiter {
  constructor() {
    this.tiers = {
      free: new TokenBucketRateLimiter(100, 1),      // 100 requests, refill 1/sec
      pro: new TokenBucketRateLimiter(1000, 10),     // 1000 requests, refill 10/sec
      enterprise: new TokenBucketRateLimiter(10000, 100) // 10k requests, refill 100/sec
    };
  }

  async allowRequest(userId, tier = 'free') {
    const limiter = this.tiers[tier];
    return await limiter.allowRequest(userId);
  }
}

// Middleware
async function rateLimitByTier(req, res, next) {
  const userId = req.user.id;
  const tier = req.user.subscription; // 'free', 'pro', 'enterprise'

  const limiter = new TieredRateLimiter();
  const result = await limiter.allowRequest(userId, tier);

  res.setHeader('X-RateLimit-Tier', tier);
  res.setHeader('X-RateLimit-Remaining', result.remainingTokens);

  if (result.allowed) {
    next();
  } else {
    res.status(429).json({
      error: 'Rate limit exceeded',
      tier,
      message: `Upgrade to ${tier === 'free' ? 'pro' : 'enterprise'} for higher limits`
    });
  }
}
```

### Example 2: Distributed Rate Limiting (Multiple Servers)

```javascript
const Redis = require('ioredis');
const redis = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 }
]);

class DistributedRateLimiter {
  async allowRequest(userId, limit, window) {
    const key = `rate_limit:${userId}`;

    // Use Lua script for atomic operation
    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])

      local current = redis.call('GET', key)
      if current and tonumber(current) >= limit then
        return 0
      end

      local count = redis.call('INCR', key)
      if count == 1 then
        redis.call('EXPIRE', key, window)
      end

      return limit - count
    `;

    const remaining = await redis.eval(
      script,
      1,
      key,
      limit,
      window,
      Date.now()
    );

    return {
      allowed: remaining >= 0,
      remaining: Math.max(0, remaining)
    };
  }
}
```

### Example 3: API Gateway Rate Limiting (Nginx)

```nginx
# nginx.conf
http {
    # Define rate limit zone
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $http_x_user_id zone=user_limit:10m rate=100r/m;

    server {
        listen 80;

        # API routes
        location /api/ {
            # Apply rate limit
            limit_req zone=api_limit burst=20 nodelay;
            limit_req_status 429;

            # Custom error response
            error_page 429 /rate_limit_error.json;

            proxy_pass http://backend:3000;
        }

        # Auth endpoints (stricter)
        location /api/auth/ {
            limit_req zone=user_limit burst=5;
            limit_req_status 429;

            proxy_pass http://backend:3000;
        }

        # Rate limit error response
        location = /rate_limit_error.json {
            internal;
            return 429 '{"error": "Rate limit exceeded"}';
            add_header Content-Type application/json;
        }
    }
}
```

### Example 4: AWS API Gateway Rate Limiting

```javascript
// serverless.yml
service: api-with-rate-limiting

provider:
  name: aws
  runtime: nodejs18.x
  apiGateway:
    # Default rate limiting
    throttle:
      rateLimit: 1000   # requests per second
      burstLimit: 2000  # burst capacity

functions:
  getUser:
    handler: handler.getUser
    events:
      - http:
          path: /users/{id}
          method: get
          # Override rate limit for this endpoint
          throttle:
            rateLimit: 100
            burstLimit: 200

  login:
    handler: handler.login
    events:
      - http:
          path: /auth/login
          method: post
          # Stricter limits for auth
          throttle:
            rateLimit: 10
            burstLimit: 20
```

---

## 📊 Algorithm Comparison

| Algorithm | Memory | Accuracy | Burst Handling | Complexity | Best For |
|-----------|--------|----------|----------------|------------|----------|
| **Token Bucket** | Low | High | ✅ Allows | Medium | APIs, general use |
| **Leaky Bucket** | Low | High | ❌ Smooths | Medium | Streaming, video |
| **Fixed Window** | Very Low | Low (edge case) | ✅ Allows | Very Easy | Simple apps |
| **Sliding Window Log** | High | Perfect | ✅ Allows | Hard | Critical systems |
| **Sliding Window Counter** | Low | High | ✅ Allows | Medium | Production recommended |

---

## 💡 Best Practices

### 1. Return Proper Headers

```javascript
res.setHeader('X-RateLimit-Limit', limit);
res.setHeader('X-RateLimit-Remaining', remaining);
res.setHeader('X-RateLimit-Reset', resetTimestamp);
res.setHeader('Retry-After', retryAfterSeconds);
```

### 2. Different Limits for Different Endpoints

```javascript
const limits = {
  '/api/public': { limit: 1000, window: 3600 },
  '/api/auth/login': { limit: 5, window: 60 },
  '/api/sensitive': { limit: 10, window: 60 },
  '/api/upload': { limit: 10, window: 3600 }
};
```

### 3. Whitelist Important IPs

```javascript
const WHITELISTED_IPS = ['10.0.0.1', '192.168.1.1'];

if (WHITELISTED_IPS.includes(req.ip)) {
  return next(); // Skip rate limiting
}
```

### 4. Use Redis for Distributed Systems

```javascript
// All servers share same Redis for consistent rate limiting
const redis = new Redis({
  host: 'redis.example.com',
  port: 6379,
  password: process.env.REDIS_PASSWORD
});
```

---

## 🎓 Interview Follow-up Questions

### Q: "How do you handle rate limiting in a distributed system with multiple servers?"

**Answer**:
- Use **centralized Redis** cluster
- All servers check/update same counters
- Use **Lua scripts** for atomic operations
- Alternative: **Sticky sessions** (less ideal)

### Q: "What happens if Redis goes down?"

**Answer**:
- **Fail-open**: Allow all requests (business continues)
- **Fail-closed**: Reject all requests (secure but harsh)
- **Best**: Redis cluster with replication + circuit breaker

### Q: "How do you prevent users from bypassing rate limits?"

**Answer**:
- Rate limit by **user ID** (authenticated)
- Rate limit by **IP** (unauthenticated)
- Use **fingerprinting** (device, browser)
- Combine multiple identifiers

---

## 💡 Key Takeaways

1. ✅ **Token Bucket** - Most versatile, allows bursts
2. ✅ **Fixed Window** - Simplest but has edge cases
3. ✅ **Sliding Window** - Best accuracy, higher cost
4. ✅ **Use Redis** - For distributed rate limiting
5. ✅ **Different limits** - Per endpoint, per tier
6. ✅ **Return headers** - X-RateLimit-* for client info
7. ✅ **Fail gracefully** - Handle Redis failures

---

## 🔗 Related Questions

- [Flash Sales Architecture](/interview-prep/system-design/flash-sales)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)

---

## 📚 Further Reading

- **IETF Rate Limiting**: https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
- **Redis Rate Limiting**: https://redis.io/docs/reference/patterns/rate-limiter/
- **Kong Rate Limiting**: https://docs.konghq.com/hub/kong-inc/rate-limiting/
- **Nginx Rate Limiting**: https://www.nginx.com/blog/rate-limiting-nginx/
