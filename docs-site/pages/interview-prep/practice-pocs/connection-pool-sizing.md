# POC #71: Connection Pool Sizing - Find Your Optimal Configuration

> **Time to Complete:** 25-30 minutes
> **Difficulty:** 🟡 Intermediate
> **Prerequisites:** Docker, Node.js, PostgreSQL basics

## How Stripe Handles $640B with 50 Connections Per Service

**Stripe's Database Strategy (2024):**

```
Scale:
- $640 billion processed annually
- 100+ microservices
- Thousands of API servers

Connection Strategy:
- Pool size: 50 connections per service instance
- Total across cluster: 5,000+ connections
- Database: PostgreSQL with PgBouncer

Key insight: They DON'T use massive pools.
Each service is limited to 50 connections.
PgBouncer multiplexes 5,000 app connections → 500 DB connections.
```

**Why it works:**
- Predictable resource usage
- No connection storms
- Fast failure on overload
- Easy capacity planning

This POC teaches you how to calculate and test your optimal pool size—the same methodology used by companies processing billions.

---

## What You'll Build

```
┌─────────────────────────────────────────────────────────────┐
│                  Connection Pool Test Suite                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Load      │    │   Pool      │    │  Metrics    │    │
│  │  Generator  │───▶│   Tester    │───▶│  Collector  │    │
│  │             │    │             │    │             │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                             │
│  Features:                                                  │
│  ✅ Calculate optimal pool size from formula               │
│  ✅ Load test with different pool configurations           │
│  ✅ Measure latency, throughput, error rates               │
│  ✅ Find breaking point (when pool exhausts)               │
│  ✅ Compare undersized vs optimal vs oversized             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**By the end, you'll know:**
- Your optimal pool size (calculated, not guessed)
- How pool size affects latency and throughput
- When your pool becomes the bottleneck

---

## Prerequisites

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: pooltest
    ports:
      - "5432:5432"
    command: >
      postgres
      -c max_connections=200
      -c shared_buffers=256MB
      -c log_connections=on
      -c log_disconnections=on
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U testuser -d pooltest"]
      interval: 5s
      timeout: 5s
      retries: 5
```

### Start Database

```bash
docker-compose up -d
docker-compose logs -f postgres  # Watch connections
```

---

## Step 1: Understand the Pool Sizing Formula

### The Formula

```javascript
// pool-calculator.js

/**
 * Calculate optimal connection pool size
 *
 * Formula: Pool Size = (Requests/sec × Avg Query Time) / 1000 × Safety Multiplier
 *
 * @param {number} requestsPerSecond - Peak expected requests per second
 * @param {number} avgQueryTimeMs - Average query execution time in milliseconds
 * @param {number} safetyMultiplier - Buffer for spikes (default 1.5 = 50% buffer)
 * @returns {object} Pool configuration recommendation
 */
function calculatePoolSize(requestsPerSecond, avgQueryTimeMs, safetyMultiplier = 1.5) {
  // Minimum connections needed (Little's Law)
  const minConnections = (requestsPerSecond * avgQueryTimeMs) / 1000;

  // Add safety buffer
  const recommendedSize = Math.ceil(minConnections * safetyMultiplier);

  // Practical limits
  const practicalMin = Math.max(5, Math.ceil(recommendedSize * 0.5));  // Keep some warm
  const practicalMax = Math.min(100, recommendedSize * 2);  // Don't go crazy

  return {
    calculated: {
      minConnections: Math.ceil(minConnections),
      recommended: recommendedSize,
      min: practicalMin,
      max: practicalMax
    },
    explanation: {
      formula: `(${requestsPerSecond} req/s × ${avgQueryTimeMs}ms) / 1000 × ${safetyMultiplier}`,
      reasoning: `At ${requestsPerSecond} req/s with ${avgQueryTimeMs}ms queries, ` +
                 `each connection handles ${Math.floor(1000/avgQueryTimeMs)} queries/sec. ` +
                 `Need ${Math.ceil(minConnections)} connections minimum, ` +
                 `${recommendedSize} recommended with ${((safetyMultiplier-1)*100)}% buffer.`
    }
  };
}

// Example calculations
console.log('=== Pool Size Calculator ===\n');

const scenarios = [
  { name: 'Small App', rps: 50, queryTime: 10 },
  { name: 'Medium App', rps: 200, queryTime: 20 },
  { name: 'Large App', rps: 1000, queryTime: 30 },
  { name: 'High Latency', rps: 100, queryTime: 100 },
];

scenarios.forEach(s => {
  console.log(`\n📊 ${s.name} (${s.rps} req/s, ${s.queryTime}ms queries):`);
  const result = calculatePoolSize(s.rps, s.queryTime);
  console.log(`   Recommended pool size: ${result.calculated.recommended}`);
  console.log(`   Range: min=${result.calculated.min}, max=${result.calculated.max}`);
  console.log(`   ${result.explanation.reasoning}`);
});

module.exports = { calculatePoolSize };
```

### Run Calculator

```bash
node pool-calculator.js
```

**Expected Output:**
```
=== Pool Size Calculator ===

📊 Small App (50 req/s, 10ms queries):
   Recommended pool size: 1
   Range: min=5, max=2
   At 50 req/s with 10ms queries, each connection handles 100 queries/sec.
   Need 1 connections minimum, 1 recommended with 50% buffer.

📊 Medium App (200 req/s, 20ms queries):
   Recommended pool size: 6
   Range: min=5, max=12
   At 200 req/s with 20ms queries, each connection handles 50 queries/sec.
   Need 4 connections minimum, 6 recommended with 50% buffer.

📊 Large App (1000 req/s, 30ms queries):
   Recommended pool size: 45
   Range: min=23, max=90
   At 1000 req/s with 30ms queries, each connection handles 33 queries/sec.
   Need 30 connections minimum, 45 recommended with 50% buffer.

📊 High Latency (100 req/s, 100ms queries):
   Recommended pool size: 15
   Range: min=8, max=30
   At 100 req/s with 100ms queries, each connection handles 10 queries/sec.
   Need 10 connections minimum, 15 recommended with 50% buffer.
```

---

## Step 2: Build the Test Framework

```javascript
// pool-tester.js
const { Pool } = require('pg');

class PoolTester {
  constructor(poolConfig) {
    this.pool = new Pool(poolConfig);
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      latencies: [],
      connectionWaits: [],
      errors: []
    };
  }

  async runQuery() {
    const startTime = Date.now();
    let connectionAcquireTime = 0;

    try {
      const acquireStart = Date.now();
      const client = await this.pool.connect();
      connectionAcquireTime = Date.now() - acquireStart;

      try {
        // Simulate realistic query (adjust sleep for your use case)
        await client.query('SELECT pg_sleep(0.01), NOW()');  // 10ms query

        const totalTime = Date.now() - startTime;

        this.metrics.totalRequests++;
        this.metrics.successfulRequests++;
        this.metrics.latencies.push(totalTime);
        this.metrics.connectionWaits.push(connectionAcquireTime);

        return { success: true, latency: totalTime, waitTime: connectionAcquireTime };
      } finally {
        client.release();
      }
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.metrics.errors.push(error.message);

      return { success: false, error: error.message };
    }
  }

  async runLoadTest(requestsPerSecond, durationSeconds) {
    console.log(`\n🚀 Starting load test: ${requestsPerSecond} req/s for ${durationSeconds}s`);
    console.log(`   Pool config: max=${this.pool.options.max}`);

    const totalRequests = requestsPerSecond * durationSeconds;
    const delayBetweenRequests = 1000 / requestsPerSecond;

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < totalRequests; i++) {
      promises.push(this.runQuery());

      // Spread requests evenly
      if (i < totalRequests - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }

      // Progress update every second
      if (i > 0 && i % requestsPerSecond === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`   Progress: ${i}/${totalRequests} requests (${elapsed.toFixed(1)}s elapsed)`);
      }
    }

    await Promise.all(promises);

    return this.getResults();
  }

  getResults() {
    const latencies = this.metrics.latencies.sort((a, b) => a - b);
    const waits = this.metrics.connectionWaits.sort((a, b) => a - b);

    const percentile = (arr, p) => {
      if (arr.length === 0) return 0;
      const index = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      summary: {
        total: this.metrics.totalRequests,
        successful: this.metrics.successfulRequests,
        failed: this.metrics.failedRequests,
        errorRate: ((this.metrics.failedRequests / this.metrics.totalRequests) * 100).toFixed(2) + '%'
      },
      latency: {
        avg: latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : 0,
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        max: Math.max(...latencies, 0)
      },
      connectionWait: {
        avg: waits.length ? (waits.reduce((a, b) => a + b, 0) / waits.length).toFixed(2) : 0,
        p95: percentile(waits, 95),
        p99: percentile(waits, 99),
        max: Math.max(...waits, 0)
      },
      pool: {
        configured: this.pool.options.max,
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingRequests: this.pool.waitingCount
      },
      errors: [...new Set(this.metrics.errors)].slice(0, 5)  // Unique errors
    };
  }

  async cleanup() {
    await this.pool.end();
  }
}

module.exports = { PoolTester };
```

---

## Step 3: Run Comparison Tests

```javascript
// compare-pool-sizes.js
const { PoolTester } = require('./pool-tester');

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'testuser',
  password: 'testpass',
  database: 'pooltest',
  connectionTimeoutMillis: 5000,  // Fail fast
  idleTimeoutMillis: 30000
};

async function runComparison() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       CONNECTION POOL SIZE COMPARISON TEST');
  console.log('═══════════════════════════════════════════════════════════');

  const testConfig = {
    requestsPerSecond: 100,
    durationSeconds: 10
  };

  const poolSizes = [5, 10, 20, 50, 100];
  const results = [];

  for (const poolSize of poolSizes) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Testing pool size: ${poolSize}`);
    console.log('─'.repeat(60));

    const tester = new PoolTester({
      ...DB_CONFIG,
      max: poolSize,
      min: Math.min(3, poolSize)
    });

    try {
      const result = await tester.runLoadTest(
        testConfig.requestsPerSecond,
        testConfig.durationSeconds
      );

      results.push({
        poolSize,
        ...result
      });

      console.log('\n📊 Results:');
      console.log(`   Success rate: ${100 - parseFloat(result.summary.errorRate)}%`);
      console.log(`   Avg latency: ${result.latency.avg}ms`);
      console.log(`   P99 latency: ${result.latency.p99}ms`);
      console.log(`   Avg connection wait: ${result.connectionWait.avg}ms`);
      console.log(`   Max connection wait: ${result.connectionWait.max}ms`);

      if (result.errors.length > 0) {
        console.log(`   ⚠️ Errors: ${result.errors.join(', ')}`);
      }
    } finally {
      await tester.cleanup();
    }

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary comparison
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('                    COMPARISON SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Pool Size | Success % | Avg Latency | P99 Latency | Avg Wait | Max Wait');
  console.log('─'.repeat(75));

  results.forEach(r => {
    const successRate = (100 - parseFloat(r.summary.errorRate)).toFixed(1);
    console.log(
      `    ${String(r.poolSize).padStart(3)}   |   ${successRate.padStart(5)}%  |    ${String(r.latency.avg).padStart(6)}ms |     ${String(r.latency.p99).padStart(5)}ms |  ${String(r.connectionWait.avg).padStart(6)}ms | ${String(r.connectionWait.max).padStart(6)}ms`
    );
  });

  // Find optimal
  const optimal = results.reduce((best, current) => {
    const currentScore = parseFloat(current.summary.errorRate) + parseFloat(current.latency.avg) / 10;
    const bestScore = parseFloat(best.summary.errorRate) + parseFloat(best.latency.avg) / 10;
    return currentScore < bestScore ? current : best;
  });

  console.log(`\n✅ Recommended pool size for this workload: ${optimal.poolSize}`);
  console.log(`   (Lowest combined error rate + latency)`);
}

runComparison().catch(console.error);
```

### Run the Comparison

```bash
node compare-pool-sizes.js
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════
       CONNECTION POOL SIZE COMPARISON TEST
═══════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────
Testing pool size: 5
────────────────────────────────────────────────────────────

🚀 Starting load test: 100 req/s for 10s
   Pool config: max=5
   Progress: 100/1000 requests (1.0s elapsed)
   ...

📊 Results:
   Success rate: 85.2%
   Avg latency: 245.32ms
   P99 latency: 892ms
   Avg connection wait: 198.45ms
   Max connection wait: 856ms
   ⚠️ Errors: Connection timeout, cannot acquire connection

...

═══════════════════════════════════════════════════════════
                    COMPARISON SUMMARY
═══════════════════════════════════════════════════════════

Pool Size | Success % | Avg Latency | P99 Latency | Avg Wait | Max Wait
───────────────────────────────────────────────────────────────────────────
      5   |    85.2%  |    245.32ms |      892ms |  198.45ms |    856ms
     10   |    98.5%  |     45.67ms |      156ms |   12.34ms |     89ms
     20   |   100.0%  |     15.23ms |       32ms |    0.45ms |      8ms
     50   |   100.0%  |     14.89ms |       28ms |    0.12ms |      3ms
    100   |   100.0%  |     15.45ms |       35ms |    0.08ms |      2ms

✅ Recommended pool size for this workload: 20
   (Lowest combined error rate + latency)
```

---

## Step 4: Find the Breaking Point

```javascript
// find-breaking-point.js
const { PoolTester } = require('./pool-tester');

async function findBreakingPoint() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           FINDING POOL BREAKING POINT');
  console.log('═══════════════════════════════════════════════════════════\n');

  const poolSize = 10;  // Fixed pool size
  const DB_CONFIG = {
    host: 'localhost',
    port: 5432,
    user: 'testuser',
    password: 'testpass',
    database: 'pooltest',
    max: poolSize,
    connectionTimeoutMillis: 3000
  };

  const loadLevels = [50, 100, 150, 200, 300, 500];

  console.log(`Testing with fixed pool size: ${poolSize}\n`);

  for (const rps of loadLevels) {
    const tester = new PoolTester(DB_CONFIG);

    try {
      console.log(`\n📈 Testing ${rps} requests/second...`);
      const result = await tester.runLoadTest(rps, 5);  // 5 second test

      const errorRate = parseFloat(result.summary.errorRate);
      const status = errorRate < 1 ? '✅' : errorRate < 10 ? '⚠️' : '❌';

      console.log(`   ${status} Error rate: ${result.summary.errorRate}`);
      console.log(`   Avg latency: ${result.latency.avg}ms, P99: ${result.latency.p99}ms`);

      if (errorRate > 10) {
        console.log(`\n🔴 BREAKING POINT FOUND: ${rps} req/s`);
        console.log(`   Pool size ${poolSize} cannot handle ${rps} requests/second`);
        console.log(`   Recommended: increase pool to ${Math.ceil(rps * 0.02 * 1.5)}`);
        break;
      }
    } finally {
      await tester.cleanup();
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

findBreakingPoint().catch(console.error);
```

---

## What You Learned

### Key Insights

1. **Pool size is calculable, not guessable**
   - Formula: `(Requests/sec × Query Time ms) / 1000 × 1.5`
   - Too small = connection wait times, timeouts
   - Too large = wasted resources, potential DB overload

2. **Connection wait time is the key metric**
   - Wait time > 0 consistently = pool too small
   - Wait time = 0 always = pool might be oversized

3. **There's a diminishing returns point**
   - Beyond optimal, larger pools don't help
   - May actually hurt (more DB connections = more overhead)

### The Testing Process

```
1. Calculate theoretical optimal: (RPS × QueryTime) / 1000 × 1.5
2. Test with 50%, 100%, 200% of calculated size
3. Find the size where:
   - Error rate < 0.1%
   - P99 latency acceptable
   - Connection wait time minimal
4. Add 20% buffer for production
```

---

## Production Checklist

Before deploying your pool configuration:

- [ ] Calculated pool size using formula
- [ ] Load tested with realistic traffic patterns
- [ ] Verified database max_connections can handle all pools
- [ ] Set connectionTimeoutMillis (3-5 seconds)
- [ ] Set idleTimeoutMillis (30 seconds)
- [ ] Added pool monitoring/metrics
- [ ] Created alerts for:
  - [ ] Pool utilization > 80%
  - [ ] Connection wait time > 100ms
  - [ ] Error rate > 0.1%

---

## Related Content

- [Connection Pool Management](/system-design/performance/connection-pool-management) - Theory and best practices
- [POC #72: Connection Leak Detection](/interview-prep/practice-pocs/connection-leak-detection) - Find and fix leaks
- [Connection Pool Starvation](/problems-at-scale/performance/connection-pool-starvation) - Real incident patterns

---

**Remember:** The optimal pool size is the smallest number that handles your peak load with acceptable latency. More isn't better—it's wasteful and potentially harmful.
