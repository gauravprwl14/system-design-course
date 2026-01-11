# API Metrics: P50, P95, P99 Response Times & SLAs

## Question
**"Explain P95 and P99 response times. How do you measure and improve them? What's the difference between P95 and average response time?"**

Common in: Backend, DevOps, Site Reliability Engineering (SRE) interviews

---

## 📊 Quick Answer

**Percentiles** measure what percentage of requests are faster than a given time.

| Metric | Meaning | Example | Importance |
|--------|---------|---------|------------|
| **P50 (Median)** | 50% of requests faster | P50=100ms means half are <100ms | Typical user experience |
| **P95** | 95% of requests faster | P95=500ms means 5% are >500ms | Most users' experience |
| **P99** | 99% of requests faster | P99=2000ms means 1% are >2000ms | Worst-case scenarios |
| **P99.9** | 99.9% faster | P99.9=5000ms | Tail latency |
| **Average** | Mean of all requests | Average=200ms | Misleading! (affected by outliers) |

**Why Percentiles > Average**: One slow request (10 seconds) can skew average massively, but P95/P99 show real user experience.

---

## 🎯 Understanding Percentiles

### Example: API Response Times

```
100 requests to /api/users:
- 50 requests: 50ms
- 30 requests: 100ms
- 15 requests: 200ms
- 4 requests: 500ms
- 1 request: 5000ms (slow query!)

Metrics:
- Average: 155ms (misleading!)
- P50 (Median): 100ms (50th fastest)
- P95: 500ms (95th fastest)
- P99: 5000ms (99th fastest)
- Max: 5000ms
```

**Interpretation**:
- Average (155ms) looks good, but **hides** the 1 user who waited 5 seconds!
- P95 (500ms) shows that 95% of users get response in <500ms
- P99 (5000ms) reveals the bad tail latency affecting 1% of users

**In production with 1M requests/day**:
- 1% = 10,000 users experience slow response!
- P95/P99 help identify these users

---

## 💻 Measuring Percentiles

### 1. Node.js with express-prom-bundle (Prometheus)

```javascript
// metrics-setup.js
const express = require('express');
const promBundle = require('express-prom-bundle');
const client = require('prom-client');

const app = express();

// Prometheus metrics middleware
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: 'my-api' },
  promClient: {
    collectDefaultMetrics: {
      timeout: 1000
    }
  }
});

app.use(metricsMiddleware);

// Custom histogram for fine-grained percentiles
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000] // Define latency buckets
});

// Middleware to track custom metrics
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });

  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Sample API endpoint
app.get('/api/users/:id', async (req, res) => {
  const user = await db.getUser(req.params.id);
  res.json(user);
});

app.listen(3000);
```

**Query Prometheus for Percentiles**:

```promql
# P50 (median) response time
histogram_quantile(0.50, http_request_duration_ms_bucket)

# P95 response time
histogram_quantile(0.95, http_request_duration_ms_bucket)

# P99 response time
histogram_quantile(0.99, http_request_duration_ms_bucket)

# P99 by route
histogram_quantile(0.99,
  sum(rate(http_request_duration_ms_bucket[5m])) by (le, route)
)

# Average (for comparison)
rate(http_request_duration_ms_sum[5m]) / rate(http_request_duration_ms_count[5m])
```

---

### 2. Custom Percentile Tracking

```javascript
// percentile-tracker.js
class LatencyTracker {
  constructor() {
    this.latencies = [];
    this.maxSize = 10000; // Keep last 10k requests
  }

  record(latencyMs) {
    this.latencies.push(latencyMs);

    // Trim to maxSize
    if (this.latencies.length > this.maxSize) {
      this.latencies.shift();
    }
  }

  getPercentile(p) {
    if (this.latencies.length === 0) return 0;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;

    return sorted[index];
  }

  getStats() {
    if (this.latencies.length === 0) {
      return { count: 0 };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: this.getPercentile(50),
      p75: this.getPercentile(75),
      p90: this.getPercentile(90),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
      p999: this.getPercentile(99.9)
    };
  }

  reset() {
    this.latencies = [];
  }
}

// Usage
const tracker = new LatencyTracker();

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    tracker.record(duration);
  });

  next();
});

// Expose stats endpoint
app.get('/api/stats', (req, res) => {
  const stats = tracker.getStats();
  res.json(stats);
});

/*
Example output:
{
  "count": 10000,
  "min": 12,
  "max": 8532,
  "avg": 145,
  "p50": 98,
  "p75": 152,
  "p90": 287,
  "p95": 453,
  "p99": 1823,
  "p999": 4521
}
*/
```

---

### 3. Using Datadog APM

```javascript
// datadog-apm.js
const tracer = require('dd-trace').init({
  service: 'my-api',
  env: 'production',
  analytics: true,
  runtimeMetrics: true
});

// Datadog automatically tracks:
// - P50, P75, P90, P95, P99 latencies
// - Error rates
// - Request rates (throughput)
// - Resource usage (CPU, memory)

app.get('/api/users/:id', async (req, res) => {
  // Datadog automatically instruments this
  const user = await db.getUser(req.params.id);
  res.json(user);
});

// Custom metrics
const StatsD = require('hot-shots');
const dogstatsd = new StatsD();

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Send custom timing metric
    dogstatsd.timing('api.request.duration', duration, {
      method: req.method,
      route: req.route?.path,
      status: res.statusCode
    });
  });

  next();
});

// Query in Datadog:
// p95:api.request.duration{route:/api/users/:id}
// p99:api.request.duration{status:200}
```

---

## 📈 Setting SLAs (Service Level Agreements)

### Example SLA Definitions

```javascript
// sla-config.js
const SLA_TARGETS = {
  // 95% of requests should complete in <500ms
  p95: {
    threshold: 500, // ms
    target: 0.95    // 95%
  },

  // 99% of requests should complete in <2000ms
  p99: {
    threshold: 2000, // ms
    target: 0.99     // 99%
  },

  // Overall uptime should be >99.9% (8.76 hours downtime/year)
  availability: {
    target: 0.999   // 99.9%
  },

  // Error rate should be <0.1%
  errorRate: {
    threshold: 0.001 // 0.1%
  }
};

class SLAMonitor {
  constructor(tracker) {
    this.tracker = tracker;
  }

  checkSLA() {
    const stats = this.tracker.getStats();

    const results = {
      p95: {
        current: stats.p95,
        target: SLA_TARGETS.p95.threshold,
        met: stats.p95 <= SLA_TARGETS.p95.threshold
      },
      p99: {
        current: stats.p99,
        target: SLA_TARGETS.p99.threshold,
        met: stats.p99 <= SLA_TARGETS.p99.threshold
      }
    };

    // Alert if SLA is breached
    if (!results.p95.met) {
      this.alert('P95 SLA breached', results.p95);
    }

    if (!results.p99.met) {
      this.alert('P99 SLA breached', results.p99);
    }

    return results;
  }

  alert(message, data) {
    console.error(`[SLA ALERT] ${message}:`, data);

    // Send to Slack/PagerDuty
    // webhook.send({ message, data });
  }
}

// Run SLA checks every minute
const slaMonitor = new SLAMonitor(tracker);
setInterval(() => {
  const slaStatus = slaMonitor.checkSLA();
  console.log('SLA Status:', slaStatus);
}, 60000);
```

---

## 🔍 Improving P95/P99 Latencies

### 1. Identify Slow Endpoints

```javascript
// slow-endpoint-detector.js
class SlowEndpointDetector {
  constructor() {
    this.endpoints = new Map();
  }

  record(route, latency) {
    if (!this.endpoints.has(route)) {
      this.endpoints.set(route, []);
    }

    this.endpoints.get(route).push(latency);
  }

  getSlowEndpoints(p99Threshold = 1000) {
    const results = [];

    for (const [route, latencies] of this.endpoints.entries()) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const p99Index = Math.ceil(0.99 * sorted.length) - 1;
      const p99 = sorted[p99Index];

      if (p99 > p99Threshold) {
        results.push({
          route,
          p99,
          count: latencies.length,
          avg: latencies.reduce((a, b) => a + b, 0) / latencies.length
        });
      }
    }

    // Sort by worst P99
    return results.sort((a, b) => b.p99 - a.p99);
  }
}

// Usage
const detector = new SlowEndpointDetector();

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    detector.record(req.route?.path || req.path, duration);
  });

  next();
});

// Report slow endpoints
app.get('/api/slow-endpoints', (req, res) => {
  const slow = detector.getSlowEndpoints(1000); // P99 > 1000ms
  res.json(slow);
});

/*
Output:
[
  { route: '/api/analytics', p99: 8532, count: 1523, avg: 2341 },
  { route: '/api/reports', p99: 5234, count: 423, avg: 1832 },
  { route: '/api/users/:id', p99: 1234, count: 8234, avg: 234 }
]
*/
```

---

### 2. Optimize Slow Queries

```javascript
// query-optimization.js
const { Pool } = require('pg');
const pool = new Pool();

// BAD: Slow query (P99: 2000ms)
app.get('/api/users/:id/orders', async (req, res) => {
  const result = await pool.query(`
    SELECT o.*, p.name as product_name, p.price
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = $1
    ORDER BY o.created_at DESC
  `, [req.params.id]);

  res.json(result.rows);
});

// GOOD: Optimized query (P99: 150ms)
app.get('/api/users/:id/orders', async (req, res) => {
  // 1. Add index
  // CREATE INDEX idx_orders_user_id ON orders(user_id, created_at DESC);
  // CREATE INDEX idx_order_items_order_id ON order_items(order_id);

  // 2. Limit results
  // 3. Use materialized view for complex aggregations
  const result = await pool.query(`
    SELECT o.*, p.name as product_name, p.price
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = $1
    ORDER BY o.created_at DESC
    LIMIT 20
  `, [req.params.id]);

  res.json(result.rows);
});
```

---

### 3. Add Caching for Slow Operations

```javascript
// caching-for-p99.js
const Redis = require('ioredis');
const redis = new Redis();

// Before caching: P99 = 2500ms
app.get('/api/analytics/dashboard', async (req, res) => {
  // Expensive aggregation query
  const stats = await db.query(`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as orders,
      SUM(total) as revenue
    FROM orders
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);

  res.json(stats);
});

// After caching: P99 = 50ms
app.get('/api/analytics/dashboard', async (req, res) => {
  const cacheKey = 'analytics:dashboard:30d';

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // Cache miss - query DB
  const stats = await db.query(`...`);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(stats));

  res.json(stats);
});

// Result: 95% cache hit rate → P99 reduced from 2500ms to 50ms!
```

---

### 4. Implement Timeouts

```javascript
// timeout-middleware.js
function timeoutMiddleware(timeoutMs = 5000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Request timeout',
          timeout: timeoutMs
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

// Apply timeout to all routes
app.use(timeoutMiddleware(5000)); // 5 second max

// Different timeouts for different routes
app.get('/api/quick-data', timeoutMiddleware(1000), async (req, res) => {
  // Must respond in <1 second
});

app.get('/api/slow-report', timeoutMiddleware(30000), async (req, res) => {
  // Can take up to 30 seconds
});
```

---

### 5. Database Connection Pooling

```javascript
// connection-pool-optimization.js
// Before: P99 = 1500ms (connection overhead)
const badPool = new Pool({
  max: 10, // Too small!
  idleTimeoutMillis: 1000 // Too short!
});

// After: P99 = 200ms
const goodPool = new Pool({
  max: 100,                    // More connections
  min: 10,                     // Keep idle connections
  idleTimeoutMillis: 30000,    // 30 seconds
  connectionTimeoutMillis: 2000 // Wait up to 2s for connection
});

// Monitor pool stats
setInterval(() => {
  console.log('Pool stats:', {
    total: goodPool.totalCount,
    idle: goodPool.idleCount,
    waiting: goodPool.waitingCount
  });

  // Alert if pool is exhausted
  if (goodPool.waitingCount > 10) {
    console.error('⚠️ Pool exhausted! Increase max connections.');
  }
}, 10000);
```

---

## 🎓 Interview Tips

### Common Questions

**Q: Why use P95/P99 instead of average?**
A: "Average is misleading because outliers skew it. If 99 requests take 100ms and 1 takes 10 seconds, average is 199ms, but P99 shows the real 10-second experience. For 1M requests/day, that's 10,000 users with terrible experience."

**Q: What's an acceptable P95/P99?**
A: "Depends on the endpoint:
- Simple API (user profile): P95 <200ms, P99 <500ms
- Complex API (analytics): P95 <1s, P99 <3s
- Real-time (chat): P95 <100ms, P99 <300ms"

**Q: How do you improve P99?**
A: "1) Identify slow endpoints via APM tools, 2) Optimize DB queries (indexes, limits), 3) Add caching (Redis), 4) Use connection pooling, 5) Implement timeouts to prevent hanging requests, 6) Scale horizontally (more servers)."

**Q: P99 vs P99.9?**
A: "P99 = 99% of requests, P99.9 = 99.9%. P99.9 catches rare but catastrophic issues. For 1M requests, P99 affects 10k users, P99.9 affects 1k users. Both matter!"

---

## 🔗 Related Questions

- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Performance Bottleneck Identification](/interview-prep/caching-cdn/performance-bottlenecks)
- [Redis Caching Fundamentals](/interview-prep/caching-cdn/redis-fundamentals)
- [Database Scaling Strategies](/interview-prep/database/scaling-strategies)

---

## 📚 Additional Resources

- [Google SRE Book - SLIs, SLOs, and SLAs](https://sre.google/sre-book/service-level-objectives/)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Prometheus Histograms](https://prometheus.io/docs/practices/histograms/)
- [How NOT to Measure Latency](https://www.youtube.com/watch?v=lJ8ydIuPFeU)
