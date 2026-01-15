# POC #72: Connection Leak Detection - Find Hidden Pool Drains

> **Time to Complete:** 20-25 minutes
> **Difficulty:** 🟡 Intermediate
> **Prerequisites:** Docker, Node.js, PostgreSQL basics

## The Slow Death: When Connections Disappear One by One

**Real Incident Pattern:**

```
Day 1: Deploy new feature, pool size 20, everything works ✅
Day 2: Occasional "connection timeout" errors (ignored)
Day 3: Errors increasing, "probably traffic spike"
Day 4: Pool exhausted, system frozen ❌

Investigation reveals:
- Pool size: 20
- Active connections: 20
- Idle connections: 0
- Queries running: 0  ← Wait, what?

All 20 connections are "active" but doing nothing.
They were never released back to the pool.

Root cause: Connection leak in error handling path.
```

**Cost:**
- 4 hours debugging
- System restart (data loss risk)
- Customer complaints
- Weekend ruined

This POC teaches you how to detect and prevent connection leaks before they kill your system.

---

## What You'll Build

```
┌─────────────────────────────────────────────────────────────┐
│              Connection Leak Detection System                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Leak      │    │   Monitor   │    │   Alert     │    │
│  │  Detector   │───▶│   Service   │───▶│   System    │    │
│  │             │    │             │    │             │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                             │
│  Features:                                                  │
│  ✅ Track connection checkout/checkin                      │
│  ✅ Detect connections held too long                       │
│  ✅ Stack trace capture (find the culprit code)           │
│  ✅ Automatic leak alerts                                  │
│  ✅ Force release of stuck connections                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Understanding Connection Leaks

### What Causes Leaks?

```javascript
// ❌ LEAK PATTERN #1: Missing release in error path
async function getUserData(userId) {
  const client = await pool.connect();

  const result = await client.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
    // ❌ Connection never released!
  }

  client.release();
  return result.rows[0];
}

// ❌ LEAK PATTERN #2: Early return without release
async function processOrder(orderId) {
  const client = await pool.connect();

  const order = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);

  if (order.rows[0].status === 'cancelled') {
    return { success: false, reason: 'Order cancelled' };
    // ❌ Connection never released!
  }

  await client.query('UPDATE orders SET status = $1 WHERE id = $2', ['processed', orderId]);

  client.release();
  return { success: true };
}

// ❌ LEAK PATTERN #3: Callback hell without proper cleanup
async function complexOperation() {
  const client = await pool.connect();

  await client.query('BEGIN');

  try {
    await step1(client);
    await step2(client);  // Throws error
    await step3(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;  // ❌ Connection never released!
  }

  client.release();
}
```

### The Correct Pattern

```javascript
// ✅ CORRECT: Always use try/finally
async function safeQuery(userId) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  } finally {
    client.release();  // ✅ Always runs, even on error
  }
}

// ✅ EVEN BETTER: Use pool.query() for simple queries
async function simpleQuery(userId) {
  // pool.query() automatically handles connection lifecycle
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}
```

---

## Step 2: Build the Leak Detection Pool Wrapper

```javascript
// leak-detecting-pool.js
const { Pool } = require('pg');

class LeakDetectingPool {
  constructor(config) {
    this.pool = new Pool(config);
    this.activeConnections = new Map();  // Track all checked-out connections
    this.leakThresholdMs = config.leakThresholdMs || 30000;  // 30 seconds default
    this.checkIntervalMs = config.checkIntervalMs || 5000;   // Check every 5s

    // Start leak detection
    this.startLeakDetection();

    // Pool event handlers
    this.pool.on('connect', () => {
      console.log('📗 New connection created');
    });

    this.pool.on('remove', () => {
      console.log('📕 Connection removed from pool');
    });

    this.pool.on('error', (err) => {
      console.error('🔴 Pool error:', err.message);
    });
  }

  async connect() {
    const client = await this.pool.connect();
    const connectionId = this.generateId();

    // Capture stack trace to identify where connection was acquired
    const stackTrace = new Error().stack;

    // Track this connection
    this.activeConnections.set(connectionId, {
      acquiredAt: Date.now(),
      stackTrace: stackTrace,
      released: false
    });

    // Wrap the release method to track when connection is returned
    const originalRelease = client.release.bind(client);
    client.release = (err) => {
      this.activeConnections.delete(connectionId);
      console.log(`📗 Connection ${connectionId} released (held for ${Date.now() - this.activeConnections.get(connectionId)?.acquiredAt || 0}ms)`);
      return originalRelease(err);
    };

    // Store connection ID on client for debugging
    client._leakDetectionId = connectionId;

    console.log(`📙 Connection ${connectionId} acquired`);

    return client;
  }

  async query(text, params) {
    // Convenience method that handles connection lifecycle automatically
    return this.pool.query(text, params);
  }

  startLeakDetection() {
    this.leakCheckInterval = setInterval(() => {
      this.checkForLeaks();
    }, this.checkIntervalMs);
  }

  checkForLeaks() {
    const now = Date.now();
    const leaks = [];

    this.activeConnections.forEach((info, id) => {
      const heldTime = now - info.acquiredAt;

      if (heldTime > this.leakThresholdMs) {
        leaks.push({
          connectionId: id,
          heldTimeMs: heldTime,
          heldTimeFormatted: `${(heldTime / 1000).toFixed(1)}s`,
          stackTrace: info.stackTrace
        });
      }
    });

    if (leaks.length > 0) {
      console.error('\n🚨 POTENTIAL CONNECTION LEAKS DETECTED!\n');
      leaks.forEach(leak => {
        console.error(`Connection ${leak.connectionId} held for ${leak.heldTimeFormatted}`);
        console.error('Acquired at:');
        console.error(leak.stackTrace.split('\n').slice(2, 6).join('\n'));
        console.error('');
      });
    }

    // Log pool status
    const status = this.getPoolStatus();
    if (status.utilization > 80) {
      console.warn(`⚠️ Pool utilization: ${status.utilization}%`);
    }
  }

  getPoolStatus() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      active: this.activeConnections.size,
      utilization: this.pool.totalCount > 0
        ? ((this.pool.totalCount - this.pool.idleCount) / this.pool.totalCount * 100).toFixed(1)
        : 0,
      activeConnections: Array.from(this.activeConnections.entries()).map(([id, info]) => ({
        id,
        heldMs: Date.now() - info.acquiredAt,
        isPotentialLeak: (Date.now() - info.acquiredAt) > this.leakThresholdMs
      }))
    };
  }

  generateId() {
    return Math.random().toString(36).substring(2, 8);
  }

  async end() {
    clearInterval(this.leakCheckInterval);
    await this.pool.end();
  }
}

module.exports = { LeakDetectingPool };
```

---

## Step 3: Test with Leaky Code

```javascript
// leak-test.js
const { LeakDetectingPool } = require('./leak-detecting-pool');

const pool = new LeakDetectingPool({
  host: 'localhost',
  port: 5432,
  user: 'testuser',
  password: 'testpass',
  database: 'pooltest',
  max: 5,  // Small pool to see leaks faster
  leakThresholdMs: 5000,  // 5 seconds
  checkIntervalMs: 2000   // Check every 2 seconds
});

// ❌ LEAKY FUNCTION: Doesn't release on error
async function leakyFunction(shouldFail = false) {
  const client = await pool.connect();

  await client.query('SELECT 1');

  if (shouldFail) {
    throw new Error('Simulated error');
    // Connection leaked!
  }

  client.release();
}

// ✅ SAFE FUNCTION: Always releases
async function safeFunction(shouldFail = false) {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');

    if (shouldFail) {
      throw new Error('Simulated error');
    }

    return { success: true };
  } finally {
    client.release();  // Always runs
  }
}

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           CONNECTION LEAK DETECTION TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Initial pool status:', pool.getPoolStatus());

  // Test 1: Normal operations (no leak)
  console.log('\n--- Test 1: Normal operations ---');
  for (let i = 0; i < 3; i++) {
    await safeFunction(false);
  }
  console.log('Pool status:', pool.getPoolStatus());

  // Test 2: Safe function with errors (no leak)
  console.log('\n--- Test 2: Safe function with errors ---');
  for (let i = 0; i < 3; i++) {
    try {
      await safeFunction(true);
    } catch (e) {
      // Error handled, connection released
    }
  }
  console.log('Pool status:', pool.getPoolStatus());

  // Test 3: LEAKY function (causes leak!)
  console.log('\n--- Test 3: Leaky function (will cause leaks!) ---');
  console.log('⚠️ Calling leaky function that will leak connections...\n');

  for (let i = 0; i < 4; i++) {
    try {
      await leakyFunction(true);  // This will leak!
    } catch (e) {
      console.log(`   Error caught, but connection leaked!`);
    }
  }

  console.log('\nPool status after leaks:', pool.getPoolStatus());

  // Wait for leak detection to fire
  console.log('\n⏳ Waiting for leak detection (10 seconds)...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Try to get more connections - will fail!
  console.log('\n--- Test 4: Try to get connection after leaks ---');
  try {
    const client = await pool.connect();
    console.log('Got connection!');
    client.release();
  } catch (e) {
    console.log(`❌ Failed to get connection: ${e.message}`);
  }

  console.log('\nFinal pool status:', pool.getPoolStatus());

  await pool.end();
}

runTest().catch(console.error);
```

### Run the Test

```bash
node leak-test.js
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════
           CONNECTION LEAK DETECTION TEST
═══════════════════════════════════════════════════════════

Initial pool status: { total: 0, idle: 0, waiting: 0, active: 0 }

--- Test 1: Normal operations ---
📗 New connection created
📙 Connection abc123 acquired
📗 Connection abc123 released
...
Pool status: { total: 3, idle: 3, waiting: 0, active: 0 }

--- Test 2: Safe function with errors ---
📙 Connection def456 acquired
📗 Connection def456 released
...
Pool status: { total: 3, idle: 3, waiting: 0, active: 0 }

--- Test 3: Leaky function (will cause leaks!) ---
⚠️ Calling leaky function that will leak connections...

📙 Connection ghi789 acquired
   Error caught, but connection leaked!
📙 Connection jkl012 acquired
   Error caught, but connection leaked!
...

Pool status after leaks: {
  total: 5,
  idle: 1,
  waiting: 0,
  active: 4,  // ← These are leaked!
  utilization: 80
}

⏳ Waiting for leak detection (10 seconds)...

🚨 POTENTIAL CONNECTION LEAKS DETECTED!

Connection ghi789 held for 6.2s
Acquired at:
    at leakyFunction (leak-test.js:12:30)
    at runTest (leak-test.js:52:13)
    at processTicksAndRejections

Connection jkl012 held for 5.8s
Acquired at:
    at leakyFunction (leak-test.js:12:30)
    at runTest (leak-test.js:52:13)
...

--- Test 4: Try to get connection after leaks ---
❌ Failed to get connection: Connection timeout - pool exhausted

Final pool status: {
  total: 5,
  idle: 1,
  waiting: 1,
  active: 4,
  activeConnections: [
    { id: 'ghi789', heldMs: 11234, isPotentialLeak: true },
    { id: 'jkl012', heldMs: 10891, isPotentialLeak: true }
  ]
}
```

---

## Step 4: Production Leak Detection

```javascript
// production-pool.js
const { Pool } = require('pg');
const { EventEmitter } = require('events');

class ProductionPool extends EventEmitter {
  constructor(config) {
    super();
    this.pool = new Pool(config);
    this.connections = new Map();
    this.config = {
      leakThresholdMs: config.leakThresholdMs || 60000,  // 1 minute
      maxLeaksBeforeAlert: config.maxLeaksBeforeAlert || 3,
      forceReleaseAfterMs: config.forceReleaseAfterMs || 300000  // 5 minutes
    };

    this.stats = {
      totalAcquired: 0,
      totalReleased: 0,
      leaksDetected: 0,
      forcedReleases: 0
    };

    setInterval(() => this.checkForLeaks(), 10000);
  }

  async connect() {
    const client = await this.pool.connect();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    this.connections.set(id, {
      acquiredAt: Date.now(),
      stack: new Error().stack
    });

    this.stats.totalAcquired++;

    const originalRelease = client.release.bind(client);
    client.release = () => {
      this.connections.delete(id);
      this.stats.totalReleased++;
      return originalRelease();
    };

    client._connectionId = id;
    return client;
  }

  async query(text, params) {
    return this.pool.query(text, params);
  }

  checkForLeaks() {
    const now = Date.now();
    const leaks = [];

    this.connections.forEach((info, id) => {
      const age = now - info.acquiredAt;

      if (age > this.config.leakThresholdMs) {
        leaks.push({ id, age, stack: info.stack });
      }

      // Force release very old connections
      if (age > this.config.forceReleaseAfterMs) {
        this.connections.delete(id);
        this.stats.forcedReleases++;
        this.emit('forceRelease', { id, age });
      }
    });

    if (leaks.length >= this.config.maxLeaksBeforeAlert) {
      this.stats.leaksDetected += leaks.length;
      this.emit('leaksDetected', {
        count: leaks.length,
        leaks: leaks.map(l => ({
          id: l.id,
          ageMs: l.age,
          location: l.stack.split('\n')[3]?.trim()
        }))
      });
    }
  }

  getMetrics() {
    return {
      pool: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      },
      connections: {
        active: this.connections.size,
        oldest: this.connections.size > 0
          ? Math.max(...Array.from(this.connections.values()).map(c => Date.now() - c.acquiredAt))
          : 0
      },
      stats: this.stats,
      leakRate: this.stats.totalAcquired > 0
        ? ((this.stats.totalAcquired - this.stats.totalReleased) / this.stats.totalAcquired * 100).toFixed(2)
        : '0.00'
    };
  }

  async end() {
    await this.pool.end();
  }
}

// Usage with alerting
const pool = new ProductionPool({
  host: 'localhost',
  port: 5432,
  user: 'app',
  password: 'secret',
  database: 'myapp',
  max: 20,
  leakThresholdMs: 30000,
  maxLeaksBeforeAlert: 2
});

// Set up alerts
pool.on('leaksDetected', (data) => {
  console.error('🚨 CONNECTION LEAKS DETECTED:', data);
  // Send to monitoring: Datadog, PagerDuty, Slack, etc.
  // sendAlert('connection-leak', data);
});

pool.on('forceRelease', (data) => {
  console.error('⚠️ Connection force released:', data);
  // sendAlert('connection-force-release', data);
});

// Health endpoint
// app.get('/health/db', (req, res) => res.json(pool.getMetrics()));

module.exports = { ProductionPool };
```

---

## Key Takeaways

### Common Leak Patterns

```javascript
// ❌ Pattern 1: No try/finally
const client = await pool.connect();
doSomething();  // If this throws, connection leaks
client.release();

// ❌ Pattern 2: Early return
const client = await pool.connect();
if (condition) return;  // Leak!
client.release();

// ❌ Pattern 3: Callback without cleanup
pool.connect((err, client) => {
  if (err) return;  // Ok
  client.query('...', (err, res) => {
    if (err) return;  // Leak!
    client.release();
  });
});
```

### Prevention Rules

1. **Always use try/finally** for connection release
2. **Prefer pool.query()** for simple queries (auto-manages connections)
3. **Set connection timeouts** to fail fast
4. **Monitor active connections** - alert if growing
5. **Track connection age** - anything over 30s is suspicious

### Detection Checklist

- [ ] Pool tracks all connection checkouts
- [ ] Stack traces captured at acquisition
- [ ] Alert when connections held > threshold
- [ ] Metrics exposed for monitoring
- [ ] Forced release for stuck connections (last resort)

---

## Related Content

- [POC #71: Connection Pool Sizing](/interview-prep/practice-pocs/connection-pool-sizing) - Find optimal size
- [Connection Pool Management](/system-design/performance/connection-pool-management) - Full guide
- [Connection Pool Starvation](/problems-at-scale/performance/connection-pool-starvation) - Real incidents

---

**Remember:** A single leaked connection per request can exhaust your pool in minutes. Prevention (try/finally) is 1000x better than detection.
