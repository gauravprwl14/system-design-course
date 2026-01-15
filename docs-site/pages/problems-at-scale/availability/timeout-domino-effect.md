# Timeout Domino Effect - When One Slow Service Kills Everything

> **Category:** Availability
> **Frequency:** Common in microservices architectures
> **Detection Difficulty:** Medium (symptoms appear downstream)
> **Impact:** Complete system outage from a single slow dependency

## The Amazon Problem: 100ms = 1% Sales Loss

**Real Incident Pattern:**

```
Scenario: E-commerce checkout during flash sale

Architecture:
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │────►│ Gateway │────►│ Checkout│────►│ Payment │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                     │                               │
                     │                          [SLOW: 30s]
                     │                               │

Timeline:
T=0:      Payment service becomes slow (30s response time)
T=10s:    Checkout service threads blocked waiting for payment
T=30s:    Checkout service thread pool exhausted (100 threads)
T=35s:    Gateway threads backing up (waiting for checkout)
T=60s:    Gateway thread pool exhausted (200 threads)
T=65s:    All user requests timing out
T=70s:    Load balancer health checks failing
T=75s:    Complete outage

Impact:
├── Started with 1 slow service
├── Cascaded to take down 5 services
├── 100% of users affected
└── 45 minutes to recover
```

**The problem:** Missing or too-long timeouts allow slow services to consume all resources in calling services.

---

## Why This Happens

### Cause 1: No Timeout Configured

```javascript
// ❌ BAD: No timeout - waits forever
const response = await fetch('http://payment-service/charge', {
  method: 'POST',
  body: JSON.stringify(order)
});
// If payment-service takes 5 minutes, we wait 5 minutes

// ✅ GOOD: Explicit timeout
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

const response = await fetch('http://payment-service/charge', {
  method: 'POST',
  body: JSON.stringify(order),
  signal: controller.signal
});
clearTimeout(timeout);
```

### Cause 2: Timeout Too Long

```
Default timeouts that cause problems:

HTTP client default: 0 (infinite) or 120 seconds
Database connection: 30 seconds
AWS SDK: 60 seconds

User expectation: < 3 seconds

Result: Each request holds resources for 30-120 seconds
        With 100 concurrent requests, system exhausted in seconds
```

### Cause 3: Timeout Not Propagated

```
Request chain with 10-second timeout per hop:

Gateway ──► Service A ──► Service B ──► Service C ──► Database
  10s          10s          10s           10s          10s
           └──────────────── Total: 40+ seconds ────────────────┘

User timeout: 10 seconds
Actual request time: 40 seconds

Result: Gateway times out, but downstream services still working
        Resources wasted, potential duplicate processing
```

### The Domino Math

```
Thread pool: 100 threads
Normal request time: 50ms
Requests per second: 2000 (100 threads × 1000ms / 50ms)

When one dependency goes slow (30s response):
Threads blocked: All 100
Requests per second: 3.3 (100 threads / 30s)

Cascade effect:
├── Calling service can only handle 3 req/s
├── Queue builds up rapidly
├── Health checks fail
├── Load balancer removes server
├── More traffic goes to remaining servers
└── Remaining servers also overwhelmed
```

---

## Detection

### Symptom 1: Thread Pool Exhaustion

```javascript
// Monitor active threads/connections
setInterval(() => {
  const pool = connectionPool.getStats();

  metrics.gauge('pool.active', pool.active);
  metrics.gauge('pool.waiting', pool.waiting);
  metrics.gauge('pool.available', pool.available);

  // Alert if pool is near exhaustion
  const utilization = pool.active / pool.total;
  if (utilization > 0.8) {
    console.warn(`Thread pool at ${utilization * 100}% capacity`);
  }

  if (utilization > 0.95) {
    alert('CRITICAL: Thread pool nearly exhausted');
  }
}, 5000);
```

### Symptom 2: Latency Spike Correlation

```
Healthy state:
├── Service A latency: 50ms
├── Service B latency: 100ms
└── Service C latency: 30ms

During incident:
├── Service A latency: 50ms (unaffected)
├── Service B latency: 30,000ms (slow!)
├── Service C latency: 29,000ms (waiting for B)
└── Gateway latency: 28,500ms (waiting for C)

Pattern: Latency spike propagates upstream
         Root cause is furthest downstream slow service
```

### Symptom 3: Increased Error Rates

```sql
-- Find correlation between timeouts and downstream latency
SELECT
  date_trunc('minute', timestamp) AS minute,
  service,
  COUNT(*) FILTER (WHERE error_type = 'timeout') AS timeouts,
  AVG(duration_ms) AS avg_latency,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_latency
FROM requests
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY minute, service
ORDER BY minute DESC, timeouts DESC;
```

---

## Prevention Strategies

### Strategy 1: Aggressive Timeouts

```javascript
// Set timeouts shorter than user patience
const TIMEOUT_CONFIG = {
  // External services: aggressive
  'payment-service': 3000,    // 3 seconds max
  'inventory-service': 2000,  // 2 seconds max
  'notification-service': 1000, // 1 second max (non-critical)

  // Database: based on query complexity
  'database-simple': 1000,    // 1 second
  'database-complex': 5000,   // 5 seconds
  'database-batch': 30000,    // 30 seconds (background jobs only)

  // User-facing total
  'api-request-total': 5000   // 5 seconds end-to-end
};

class TimeoutManager {
  constructor(config) {
    this.config = config;
  }

  getTimeout(service) {
    return this.config[service] || 5000; // Default 5s
  }

  withTimeout(service, promise) {
    const timeout = this.getTimeout(service);
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new TimeoutError(service, timeout)), timeout)
      )
    ]);
  }
}
```

### Strategy 2: Deadline Propagation

```javascript
// Propagate remaining time budget through call chain
class RequestContext {
  constructor(deadline) {
    this.deadline = deadline || Date.now() + 5000;
  }

  remainingTime() {
    return Math.max(0, this.deadline - Date.now());
  }

  isExpired() {
    return Date.now() >= this.deadline;
  }

  // Create child context with buffer for overhead
  child(bufferMs = 100) {
    return new RequestContext(this.deadline - bufferMs);
  }

  // Get timeout for next call
  timeoutForNextCall(overhead = 100) {
    return this.remainingTime() - overhead;
  }
}

// Usage in service chain
async function handleCheckout(req, res) {
  // Start with 5-second budget
  const ctx = new RequestContext(Date.now() + 5000);

  // Pass remaining time to each service
  const inventory = await inventoryService.check(items, {
    timeout: ctx.timeoutForNextCall()
  });

  if (ctx.isExpired()) {
    return res.status(504).json({ error: 'Request timeout' });
  }

  const payment = await paymentService.charge(amount, {
    timeout: ctx.timeoutForNextCall()
  });

  if (ctx.isExpired()) {
    // Compensate: refund payment
    await paymentService.refund(payment.id);
    return res.status(504).json({ error: 'Request timeout' });
  }

  res.json({ orderId: order.id });
}
```

### Strategy 3: Bulkhead Pattern

```javascript
// Isolate thread pools per dependency
class BulkheadManager {
  constructor() {
    this.pools = new Map();
  }

  getPool(service, options = {}) {
    if (!this.pools.has(service)) {
      this.pools.set(service, new Semaphore(options.maxConcurrent || 20));
    }
    return this.pools.get(service);
  }

  async execute(service, fn, options = {}) {
    const pool = this.getPool(service, options);

    if (!await pool.tryAcquire(options.waitTimeout || 0)) {
      throw new BulkheadFullError(service);
    }

    try {
      return await fn();
    } finally {
      pool.release();
    }
  }
}

// Usage
const bulkhead = new BulkheadManager();

async function callPaymentService(order) {
  return bulkhead.execute('payment-service', async () => {
    return await paymentClient.charge(order);
  }, {
    maxConcurrent: 20,  // Max 20 concurrent calls to payment service
    waitTimeout: 1000   // Wait 1s max for slot
  });
}

// Benefits:
// - Payment service slow? Only 20 threads affected
// - Inventory service still has its own pool
// - System partially degraded, not dead
```

### Strategy 4: Circuit Breaker + Timeout

```javascript
// Combine timeouts with circuit breaker for fast failure
class ResilientClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 5000;
    this.circuit = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000
    });
  }

  async call(fn) {
    // Circuit breaker: fail fast if service is known to be down
    return this.circuit.execute(async () => {
      // Timeout: don't wait forever
      return this.withTimeout(fn, this.timeout);
    });
  }

  async withTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new TimeoutError()), timeout)
      )
    ]);
  }
}

// Result:
// - If service is healthy: 5s max wait
// - If service is slow: Circuit opens after 5 failures
// - Once open: Immediate failure (no waiting)
// - System stays responsive
```

---

## Real-World Solutions

### How Netflix Handles It

```
Netflix Hystrix (resilience4j):

1. Command timeout: Every service call wrapped
   └── Default: 1 second

2. Thread pool per service: Bulkhead isolation
   └── Payment: 20 threads
   └── Recommendations: 50 threads
   └── User profile: 30 threads

3. Circuit breaker: Fast failure on known issues
   └── Opens after 50% failure rate

4. Fallback: Degraded experience when failing
   └── Show cached recommendations
   └── Skip personalization

Result:
├── Single slow service isolated
├── Other services unaffected
├── User sees partial functionality
└── System recovers automatically
```

### How Amazon Handles It

```
Amazon's timeout strategy:

1. Aggressive timeouts based on P99 latency
   └── If P99 is 200ms, timeout at 500ms

2. Retry budget: Track retries across system
   └── Stop retrying if too many failures

3. Hedge requests: Send duplicate request after delay
   └── Cancel slower one when first completes

4. Load shedding: Reject low-priority requests when overloaded
   └── Protect checkout flow at all costs
```

---

## Quick Win: Add Timeouts Today

```javascript
// Express middleware for request timeouts
function requestTimeout(timeout) {
  return (req, res, next) => {
    // Set timeout on request
    req.setTimeout(timeout, () => {
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Request timeout',
          timeout
        });
      }
    });

    // Track start time for logging
    req.startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      if (duration > timeout * 0.8) {
        console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
      }
    });

    next();
  };
}

// Apply to all routes
app.use(requestTimeout(5000));

// Or per-route
app.get('/fast-endpoint', requestTimeout(1000), handler);
app.post('/slow-endpoint', requestTimeout(30000), handler);
```

---

## Key Takeaways

### Prevention Checklist

```
□ Every external call has explicit timeout
□ Timeouts are shorter than user patience (< 5s)
□ Deadline/context propagated through service chain
□ Thread pools isolated per dependency (bulkhead)
□ Circuit breakers fail fast on known issues
□ Fallbacks provide degraded functionality
□ Monitoring alerts on thread pool saturation
```

### Timeout Guidelines

| Dependency Type | Timeout | Rationale |
|-----------------|---------|-----------|
| Fast service (cache) | 500ms | Should be instant |
| Typical service | 2-5s | User patience limit |
| Slow service (search) | 5-10s | Only if user expects wait |
| Background job | 30s-5m | Not user-facing |
| Never | Infinite | Always set explicit timeout |

---

## Related Content

- [Timeouts & Backpressure](/system-design/patterns/timeouts-backpressure)
- [Cascading Failures](/problems-at-scale/availability/cascading-failures)
- [POC #75: Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)
- [Connection Pool Management](/system-design/performance/connection-pool-management)

---

**Remember:** A slow service is worse than a dead service. Dead services fail fast; slow services hold resources and cascade failures. Set aggressive timeouts, use circuit breakers, and isolate dependencies with bulkheads. Your system is only as fast as its slowest timeout.
