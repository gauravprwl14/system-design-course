---
title: Timeouts and Backpressure
layer: solution
section: system-design/patterns
difficulty: intermediate
prerequisites:
  - system-design/scalability/microservices-architecture
  - system-design/scalability/backpressure
solves_with: []
related_problems:
  - problems-at-scale/availability/cascading-failures
  - problems-at-scale/availability/timeout-domino-effect
  - problems-at-scale/performance/thread-pool-exhaustion
  - problems-at-scale/performance/connection-pool-starvation
case_studies: []
see_poc:
  - interview-prep/practice-pocs/timeout-configuration
  - interview-prep/practice-pocs/backpressure-queues
  - interview-prep/practice-pocs/retry-backoff
  - interview-prep/practice-pocs/graceful-degradation
linked_from:
  - interview-prep/practice-pocs/retry-backoff
  - interview-prep/practice-pocs/timeout-configuration
  - interview-prep/system-design/circuit-breaker-pattern
  - problems-at-scale/availability/retry-storm
  - problems-at-scale/availability/timeout-domino-effect
  - problems-at-scale/performance/thread-pool-exhaustion
tags:
  - timeouts
  - backpressure
  - resilience
  - flow-control
  - microservices
---

# Timeouts & Backpressure - Fail Fast, Protect Your System

> **Reading Time:** 18 minutes
> **Difficulty:** 🟡 Intermediate
> **Impact:** Prevent cascading failures, maintain system stability under load

## The Amazon Problem: Every 100ms Costs 1% Sales

**How slow dependencies destroy your entire system:**

```
Scenario: E-commerce checkout without proper timeouts

Normal flow (200ms total):
├── Auth service: 20ms
├── Inventory service: 50ms
├── Payment service: 80ms
├── Order service: 50ms
└── Customer: Happy ✅

When payment service is slow (no timeout):
├── Auth service: 20ms
├── Inventory service: 50ms
├── Payment service: 30,000ms (30 seconds!) ← stuck
├── Order service: never reached
├── Thread: blocked for 30 seconds
├── Thread pool: exhausted in 2 minutes
├── All requests: timing out
└── Customer: "Site is down!" ❌

Impact:
├── 100% of requests affected (not just payment)
├── Cascading failure to all services
└── $6.6M/hour revenue loss (Amazon scale)
```

**The lesson:** A single slow dependency without timeouts can take down your entire system.

---

## The Problem: Slow Is Worse Than Down

### Why Slow Services Are Dangerous

```
Dead service:
├── Fails immediately
├── Connection refused in <100ms
├── Circuit breaker trips fast
└── System recovers quickly

Slow service:
├── Holds connections open
├── Exhausts thread pools
├── Backs up request queues
├── Cascades to calling services
└── Takes down entire system
```

### The Domino Effect

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │────►│ Gateway │────►│ Service │────►│Database │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                     │               │               │
                     │               │          [SLOW!]
                     │               │               │
                     │          [Waiting...]         │
                     │               │               │
                [Backing up...]      │               │
                     │               │               │
               [Exhausted!]          │               │

Timeline:
T=0:     Database becomes slow (100ms → 30,000ms)
T=1m:    Service A thread pool exhausted
T=2m:    Gateway thread pool exhausted
T=3m:    All user requests failing
T=5m:    Cascaded to Services B, C, D (they call A)
T=10m:   Complete system outage
```

---

## Timeout Strategies

### 1. Connection Timeout

```javascript
// Time to establish TCP connection
const http = require('http');

const options = {
  hostname: 'api.example.com',
  port: 80,
  path: '/users',
  method: 'GET',
  timeout: 3000  // Connection timeout: 3 seconds
};

const req = http.request(options, (res) => {
  // Handle response
});

req.on('timeout', () => {
  req.destroy();
  console.error('Connection timeout');
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
});

req.end();
```

### 2. Read/Socket Timeout

```javascript
// Time to receive data after connection established
const axios = require('axios');

const client = axios.create({
  timeout: 5000,  // Total timeout for request

  // Or more granular:
  // connectTimeout: 3000,  // Time to establish connection
  // socketTimeout: 10000   // Time waiting for response
});

async function fetchUser(userId) {
  try {
    const response = await client.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out');
    }
    throw error;
  }
}
```

### 3. Request Timeout with Deadline Propagation

```javascript
// Propagate remaining time budget through service calls
class DeadlineContext {
  constructor(timeoutMs) {
    this.deadline = Date.now() + timeoutMs;
  }

  remaining() {
    return Math.max(0, this.deadline - Date.now());
  }

  isExpired() {
    return Date.now() >= this.deadline;
  }

  childContext(bufferMs = 100) {
    // Child gets remaining time minus buffer for overhead
    return new DeadlineContext(this.remaining() - bufferMs);
  }
}

// Usage in service chain
async function handleRequest(req, res) {
  // Start with 5 second budget
  const ctx = new DeadlineContext(5000);

  // Each service call uses remaining time
  const user = await userService.get(userId, { timeout: ctx.remaining() });

  if (ctx.isExpired()) {
    return res.status(504).json({ error: 'Request timeout' });
  }

  const orders = await orderService.list(userId, { timeout: ctx.remaining() });

  if (ctx.isExpired()) {
    return res.status(504).json({ error: 'Request timeout' });
  }

  res.json({ user, orders });
}
```

### 4. Timeout with Fallback

```javascript
async function withTimeout(promise, timeoutMs, fallback) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.message.includes('Timeout')) {
      // Return fallback value instead of failing
      console.warn('Using fallback due to timeout');
      return typeof fallback === 'function' ? fallback() : fallback;
    }

    throw error;
  }
}

// Usage
const recommendations = await withTimeout(
  recommendationService.getForUser(userId),
  2000,  // 2 second timeout
  []     // Fallback to empty array
);
```

---

## Backpressure Strategies

### What Is Backpressure?

```
Without backpressure:
Producer: 1000 msg/sec ───────► Consumer: 100 msg/sec
                                     │
                              [Queue growing!]
                                     │
                              [Memory exhausted]
                                     │
                              [System crash!]

With backpressure:
Producer: 1000 msg/sec ───────► Consumer: 100 msg/sec
         │                           │
         │◄── "Slow down!" ──────────│
         │                           │
Producer: 100 msg/sec ────────► Consumer: 100 msg/sec
         │                           │
    [System stable]            [Processing normally]
```

### Strategy 1: Bounded Queues

```javascript
class BoundedQueue {
  constructor(maxSize) {
    this.queue = [];
    this.maxSize = maxSize;
  }

  async enqueue(item) {
    if (this.queue.length >= this.maxSize) {
      // Option 1: Reject
      throw new Error('Queue full');

      // Option 2: Block until space available
      // await this.waitForSpace();

      // Option 3: Drop oldest
      // this.queue.shift();
    }

    this.queue.push(item);
  }

  dequeue() {
    return this.queue.shift();
  }

  isFull() {
    return this.queue.length >= this.maxSize;
  }
}

// Usage with rejection
async function handleRequest(req, res) {
  try {
    await requestQueue.enqueue(req);
    res.status(202).json({ message: 'Accepted' });
  } catch (error) {
    // Backpressure: tell client to slow down
    res.status(503).json({
      error: 'Service overloaded',
      retryAfter: 5
    });
  }
}
```

### Strategy 2: Rate Limiting with Token Bucket

```javascript
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;  // tokens per second
    this.lastRefill = Date.now();
  }

  tryConsume(tokens = 1) {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return { allowed: true, remaining: this.tokens };
    }

    const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
    return { allowed: false, retryAfter: waitTime };
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Middleware
function backpressureMiddleware(bucket) {
  return (req, res, next) => {
    const result = bucket.tryConsume();

    if (!result.allowed) {
      res.status(429)
        .set('Retry-After', Math.ceil(result.retryAfter / 1000))
        .json({ error: 'Rate limited', retryAfter: result.retryAfter });
      return;
    }

    next();
  };
}
```

### Strategy 3: Load Shedding

```javascript
class LoadShedder {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 100;
    this.maxQueueSize = options.maxQueueSize || 500;
    this.current = 0;
    this.queued = 0;
  }

  async execute(fn, priority = 'normal') {
    // High priority never shed
    if (priority !== 'high' && this.shouldShed()) {
      throw new LoadSheddingError('System overloaded');
    }

    if (this.current >= this.maxConcurrent) {
      if (this.queued >= this.maxQueueSize) {
        throw new LoadSheddingError('Queue full');
      }

      this.queued++;
      await this.waitForSlot();
      this.queued--;
    }

    this.current++;
    try {
      return await fn();
    } finally {
      this.current--;
    }
  }

  shouldShed() {
    // Shed load based on current pressure
    const pressure = this.current / this.maxConcurrent;

    if (pressure > 0.9) {
      // Over 90% capacity: shed 50% of requests
      return Math.random() < 0.5;
    }

    if (pressure > 0.8) {
      // Over 80% capacity: shed 20% of requests
      return Math.random() < 0.2;
    }

    return false;
  }
}
```

---

## Circuit Breaker Pattern

### How It Works

```
States:
                    ┌─────────────────────────┐
                    │                         │
                    ▼                         │
┌────────┐   failure   ┌────────┐   timeout  │   success
│ CLOSED │────────────►│  OPEN  │────────────┼──►┌──────────┐
└────────┘             └────────┘            │   │HALF-OPEN │
    │                      │                 │   └──────────┘
    │                      │                 │        │
    │    success           │ (blocks all    │        │ failure
    │◄─────────────────────┼─ requests)     │        ▼
    │                      │                 └───── OPEN
```

### Implementation

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenMax = options.halfOpenMax || 3;

    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    this.halfOpenAttempts = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure < this.resetTimeout) {
        throw new CircuitOpenError('Circuit is open');
      }
      this.state = 'HALF_OPEN';
      this.halfOpenAttempts = 0;
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenAttempts >= this.halfOpenMax) {
        throw new CircuitOpenError('Circuit is half-open, max attempts reached');
      }
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.halfOpenMax) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        console.log('Circuit closed');
      }
    } else {
      this.failures = 0;
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.log('Circuit opened (half-open failed)');
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log('Circuit opened (threshold exceeded)');
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure
    };
  }
}

// Usage
const paymentCircuit = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000
});

async function processPayment(order) {
  try {
    return await paymentCircuit.execute(() =>
      paymentService.charge(order.amount)
    );
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Fast fail - don't even try
      return { status: 'pending', message: 'Payment service unavailable' };
    }
    throw error;
  }
}
```

---

## Retry with Exponential Backoff

```javascript
class RetryWithBackoff {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.factor = options.factor || 2;
    this.jitter = options.jitter || 0.1;
  }

  async execute(fn, options = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry certain errors
        if (!this.isRetryable(error)) {
          throw error;
        }

        if (attempt === this.maxRetries) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  calculateDelay(attempt) {
    // Exponential: 1s, 2s, 4s, 8s...
    let delay = this.baseDelay * Math.pow(this.factor, attempt);

    // Cap at max delay
    delay = Math.min(delay, this.maxDelay);

    // Add jitter (±10%)
    const jitterAmount = delay * this.jitter;
    delay += (Math.random() * 2 - 1) * jitterAmount;

    return Math.round(delay);
  }

  isRetryable(error) {
    // Retry on network errors and 5xx responses
    const retryableErrors = [
      'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'
    ];

    if (retryableErrors.includes(error.code)) return true;
    if (error.response?.status >= 500) return true;
    if (error.response?.status === 429) return true;  // Rate limited

    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const retry = new RetryWithBackoff({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
});

const result = await retry.execute(() => externalApi.fetchData());
```

---

## Real-World: How Netflix Implements Resilience

```
Netflix Hystrix (now resilience4j):

1. Timeout
   └── Every external call has timeout
   └── Default: 1 second

2. Circuit Breaker
   └── Opens after 50% failure rate
   └── Half-opens after 5 seconds
   └── Closes after 10 successes

3. Bulkhead
   └── Thread pool per dependency
   └── Prevents one slow service from blocking others

4. Fallback
   └── Every call has fallback behavior
   └── Cached data, default values, or graceful degradation

Result:
├── Single service failure doesn't cascade
├── Users see degraded but functional experience
├── System recovers automatically
└── 99.99% availability
```

---

## Quick Win: Add Resilience Today

```javascript
// Combined timeout + retry + circuit breaker
class ResilientClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || 5000;
    this.retry = new RetryWithBackoff(options.retry);
    this.circuit = new CircuitBreaker(options.circuit);
  }

  async request(path, options = {}) {
    return this.circuit.execute(() =>
      this.retry.execute(() =>
        this.doRequest(path, options)
      )
    );
  }

  async doRequest(path, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new HttpError(response.status, await response.text());
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Usage
const client = new ResilientClient('https://api.example.com', {
  timeout: 3000,
  retry: { maxRetries: 2, baseDelay: 500 },
  circuit: { failureThreshold: 5, resetTimeout: 30000 }
});

const data = await client.request('/users/123');
```

---

## Key Takeaways

### Resilience Checklist

```
□ Every external call has a timeout
□ Timeouts are shorter than user patience
□ Retries use exponential backoff with jitter
□ Circuit breakers protect against slow services
□ Bounded queues prevent memory exhaustion
□ Load shedding prioritizes important requests
□ Fallbacks provide degraded but functional experience
```

### Timeout Guidelines

| Operation | Recommended Timeout |
|-----------|---------------------|
| DNS lookup | 1-2 seconds |
| TCP connect | 3-5 seconds |
| HTTP request | 5-10 seconds |
| Database query | 5-30 seconds |
| Batch job | 1-5 minutes |

---

## Related Content

- [POC #75: Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)
- [POC #76: Retry with Backoff](/interview-prep/practice-pocs/retry-backoff)
- [Cascading Failures](/problems-at-scale/availability/cascading-failures)
- [Connection Pool Management](/system-design/performance/connection-pool-management)

---

**Remember:** Slow is worse than down. A service that responds in 30 seconds is worse than one that fails in 100ms. Set aggressive timeouts, implement retries with backoff, and use circuit breakers to fail fast. Your system's resilience is only as strong as its weakest timeout.
