# POC #76: Timeout Configuration Patterns

> **Difficulty:** 🟡 Intermediate
> **Time:** 20 minutes
> **Prerequisites:** Node.js, HTTP basics

## What You'll Learn

Proper timeout configuration prevents cascading failures. Wrong timeouts cause either premature failures or resource exhaustion.

```
TIMEOUT LAYERS:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Client ──▶ Load Balancer ──▶ API Gateway ──▶ Service ──▶ DB   │
│    │            │                  │            │          │    │
│   30s          60s                10s          5s         2s    │
│                                                                 │
│  Rule: Each layer timeout < previous layer timeout             │
│  Otherwise: Upstream retries while downstream still processing │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// timeout-patterns.js
const http = require('http');
const https = require('https');

// ==========================================
// PATTERN 1: HTTP CLIENT TIMEOUTS
// ==========================================

class HttpClient {
  constructor(options = {}) {
    this.connectTimeout = options.connectTimeout || 3000;   // TCP connection
    this.socketTimeout = options.socketTimeout || 10000;    // Idle socket
    this.requestTimeout = options.requestTimeout || 30000;  // Total request
  }

  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      // Overall request timeout
      const requestTimer = setTimeout(() => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      const req = protocol.request(url, {
        ...options,
        timeout: this.connectTimeout  // Connection timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          clearTimeout(requestTimer);
          const elapsed = Date.now() - startTime;
          resolve({ status: res.statusCode, data, elapsed });
        });
      });

      // Socket timeout (idle)
      req.setTimeout(this.socketTimeout, () => {
        req.destroy();
        reject(new Error(`Socket timeout after ${this.socketTimeout}ms`));
      });

      req.on('error', (err) => {
        clearTimeout(requestTimer);
        reject(err);
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }
}

// ==========================================
// PATTERN 2: DATABASE QUERY TIMEOUTS
// ==========================================

class DatabaseClient {
  constructor(pool) {
    this.pool = pool;
    this.defaultTimeout = 5000;  // 5 seconds
  }

  async query(sql, params, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const client = await this.pool.connect();

    try {
      // Set statement timeout for this connection
      await client.query(`SET statement_timeout = ${timeout}`);

      const startTime = Date.now();
      const result = await client.query(sql, params);
      const elapsed = Date.now() - startTime;

      console.log(`Query completed in ${elapsed}ms`);
      return result;
    } catch (error) {
      if (error.message.includes('canceling statement due to statement timeout')) {
        throw new Error(`Query timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

// ==========================================
// PATTERN 3: CASCADING TIMEOUTS
// ==========================================

class OrderService {
  constructor() {
    // Each downstream call has smaller timeout than overall operation
    this.overallTimeout = 10000;  // 10s total for order
    this.inventoryTimeout = 2000; // 2s for inventory check
    this.paymentTimeout = 5000;   // 5s for payment
    this.notificationTimeout = 1000; // 1s for notification (non-critical)
  }

  async placeOrder(order) {
    const startTime = Date.now();

    const withTimeout = async (promise, timeout, name) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${name} timeout after ${timeout}ms`)), timeout);
      });
      return Promise.race([promise, timeoutPromise]);
    };

    const remainingTime = () => this.overallTimeout - (Date.now() - startTime);

    try {
      // Check if we have enough time
      if (remainingTime() < this.inventoryTimeout) {
        throw new Error('Insufficient time for order processing');
      }

      // Step 1: Check inventory (2s timeout)
      console.log(`Checking inventory (timeout: ${this.inventoryTimeout}ms)...`);
      await withTimeout(
        this.checkInventory(order),
        Math.min(this.inventoryTimeout, remainingTime()),
        'Inventory check'
      );

      // Step 2: Process payment (5s timeout)
      if (remainingTime() < this.paymentTimeout) {
        throw new Error('Insufficient time for payment processing');
      }

      console.log(`Processing payment (timeout: ${this.paymentTimeout}ms)...`);
      const payment = await withTimeout(
        this.processPayment(order),
        Math.min(this.paymentTimeout, remainingTime()),
        'Payment processing'
      );

      // Step 3: Send notification (1s timeout, non-critical)
      console.log(`Sending notification (timeout: ${this.notificationTimeout}ms)...`);
      try {
        await withTimeout(
          this.sendNotification(order),
          Math.min(this.notificationTimeout, remainingTime()),
          'Notification'
        );
      } catch (e) {
        // Non-critical, log and continue
        console.log(`Notification failed (non-critical): ${e.message}`);
      }

      return { success: true, orderId: payment.orderId, elapsed: Date.now() - startTime };
    } catch (error) {
      return { success: false, error: error.message, elapsed: Date.now() - startTime };
    }
  }

  // Simulated downstream calls
  async checkInventory(order) {
    await new Promise(r => setTimeout(r, 500)); // 500ms
    return { available: true };
  }

  async processPayment(order) {
    await new Promise(r => setTimeout(r, 2000)); // 2s
    return { orderId: 'ord_' + Date.now() };
  }

  async sendNotification(order) {
    await new Promise(r => setTimeout(r, 300)); // 300ms
    return { sent: true };
  }
}

// ==========================================
// PATTERN 4: ADAPTIVE TIMEOUTS
// ==========================================

class AdaptiveTimeout {
  constructor(options = {}) {
    this.baseTimeout = options.baseTimeout || 1000;
    this.maxTimeout = options.maxTimeout || 10000;
    this.minTimeout = options.minTimeout || 100;
    this.percentile = options.percentile || 99;  // p99

    this.latencies = [];
    this.windowSize = options.windowSize || 100;
  }

  recordLatency(latency) {
    this.latencies.push(latency);
    if (this.latencies.length > this.windowSize) {
      this.latencies.shift();
    }
  }

  getTimeout() {
    if (this.latencies.length < 10) {
      return this.baseTimeout;  // Not enough data
    }

    // Calculate percentile
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * this.percentile / 100) - 1;
    const p99 = sorted[index];

    // Add 20% buffer
    const timeout = Math.round(p99 * 1.2);

    // Clamp to bounds
    return Math.max(this.minTimeout, Math.min(this.maxTimeout, timeout));
  }

  async execute(fn) {
    const timeout = this.getTimeout();
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      this.recordLatency(Date.now() - startTime);
      return result;
    } catch (error) {
      if (error.message !== 'Timeout') {
        this.recordLatency(Date.now() - startTime);
      }
      throw error;
    }
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('TIMEOUT CONFIGURATION PATTERNS');
  console.log('='.repeat(60));

  // Demo 1: HTTP Client Timeouts
  console.log('\n--- HTTP Client Timeouts ---');
  const client = new HttpClient({
    connectTimeout: 2000,
    socketTimeout: 5000,
    requestTimeout: 10000
  });

  try {
    const result = await client.request('https://httpbin.org/delay/1');
    console.log(`Success: ${result.status} in ${result.elapsed}ms`);
  } catch (e) {
    console.log(`Failed: ${e.message}`);
  }

  // Demo 2: Cascading Timeouts
  console.log('\n--- Cascading Timeouts ---');
  const orderService = new OrderService();
  const orderResult = await orderService.placeOrder({ items: ['item1'] });
  console.log('Order result:', orderResult);

  // Demo 3: Adaptive Timeouts
  console.log('\n--- Adaptive Timeouts ---');
  const adaptive = new AdaptiveTimeout({ baseTimeout: 1000 });

  // Simulate varying latencies
  const latencies = [100, 150, 120, 200, 180, 500, 130, 140, 160, 170];
  latencies.forEach(l => adaptive.recordLatency(l));

  console.log(`Recorded latencies: ${latencies.join(', ')}ms`);
  console.log(`Calculated timeout (p99 + 20%): ${adaptive.getTimeout()}ms`);

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Timeout Guidelines

| Layer | Typical Timeout | Rationale |
|-------|----------------|-----------|
| Client → LB | 30-60s | User patience limit |
| LB → API Gateway | 20-30s | Less than client |
| API → Service | 5-15s | Leave room for retries |
| Service → DB | 2-5s | Queries should be fast |
| Service → Cache | 100-500ms | Cache should be instant |

---

## Anti-Patterns

```javascript
// ❌ WRONG: No timeout
const response = await fetch(url);  // Can hang forever

// ❌ WRONG: Downstream timeout > upstream
// Gateway: 5s, Service: 10s
// Service still processing when gateway gives up

// ❌ WRONG: Same timeout everywhere
// All services: 30s timeout
// Slow service blocks everything

// ✅ CORRECT: Cascading timeouts
// Gateway: 10s
// Service A: 5s
// Service B: 3s
// Database: 2s
```

---

## Related POCs

- [Retry with Backoff](/interview-prep/practice-pocs/retry-backoff)
- [Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)
- [Timeouts & Backpressure](/system-design/patterns/timeouts-backpressure)
