# Idempotency in Distributed Systems - Make Your APIs Safe to Retry

> **Reading Time:** 18 minutes
> **Difficulty:** 🔴 Advanced
> **Impact:** Prevents duplicate charges, double bookings, and data corruption

## The Stripe Problem: $2.4M in Double Charges

**Real Incident Pattern (Composite from Industry):**

```
Scenario: Payment API during network instability

Timeline:
1. Customer clicks "Pay Now" → Request sent
2. Network timeout after 5 seconds → No response
3. Customer clicks again → Second request sent
4. First request: Processed successfully, $500 charged
5. Second request: Also processed, another $500 charged
6. Customer charged: $1,000 (double!)

Scale impact:
├── 1,000 affected customers in 2 hours
├── $500,000 in duplicate charges
├── 3 weeks to reconcile and refund
├── Customer trust: Damaged
└── Engineering cost: 200+ hours
```

**The solution:** Idempotency keys ensure the same operation produces the same result, no matter how many times it's called.

---

## The Problem: Why Retries Are Dangerous

### The Network Uncertainty

```
Client                    Server
  │                         │
  │──── Request ───────────►│
  │                         │ ← Processing...
  │        ??? ◄────────────│ ← Response lost!
  │                         │
  │──── Same Request ──────►│ ← Retry
  │                         │ ← Process again?
```

**The three outcomes you can't distinguish:**
1. Request never arrived (safe to retry)
2. Request arrived, processing failed (safe to retry)
3. Request arrived, processing succeeded, response lost (NOT safe to retry!)

### Real-World Failure Scenarios

```javascript
// Scenario 1: Network timeout
try {
  await paymentAPI.charge({ amount: 500, customerId: 123 });
} catch (error) {
  if (error.code === 'ETIMEDOUT') {
    // Did the charge go through or not?
    // If we retry, we might double-charge!
  }
}

// Scenario 2: Load balancer 502
// Request reached one server, processed, but LB returned error
// Client retries to different server → duplicate!

// Scenario 3: Database commit race
// Transaction committed, server crashed before responding
// Client retries → duplicate row!
```

---

## The Paradigm Shift: Idempotent Design

### Old Mental Model
```
"Each request is independent"
→ Server processes every request
→ Duplicates create duplicate results
```

### New Mental Model
```
"Each operation has a unique identity"
→ Server tracks operation identity
→ Duplicates return cached result
```

### The Idempotency Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Idempotency Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client                    Server                            │
│    │                         │                               │
│    │─── Request + Key ──────►│                               │
│    │                         │──► Check: Key exists?         │
│    │                         │     │                         │
│    │                         │     ├── NO: Process & Store   │
│    │                         │     │                         │
│    │                         │     └── YES: Return Stored    │
│    │◄─── Response ───────────│                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation: The Idempotency Key Pattern

### Stripe's Approach (Industry Standard)

```javascript
// Client sends unique key with request
POST /v1/charges
Idempotency-Key: "order_12345_charge_attempt_1"
Content-Type: application/json

{
  "amount": 5000,
  "currency": "usd",
  "customer": "cus_ABC123"
}

// Server behavior:
// 1st request: Process charge, store result with key
// 2nd request (same key): Return stored result (no new charge)
// Different key: Process as new charge
```

### Server-Side Implementation

```javascript
class IdempotentAPI {
  constructor(storage) {
    this.storage = storage;  // Redis or database
    this.lockTTL = 60000;    // 1 minute lock
    this.resultTTL = 86400;  // 24 hour result cache
  }

  async executeIdempotent(idempotencyKey, operation) {
    // Step 1: Check for existing result
    const existing = await this.storage.get(`result:${idempotencyKey}`);
    if (existing) {
      console.log(`Returning cached result for key: ${idempotencyKey}`);
      return JSON.parse(existing);
    }

    // Step 2: Acquire lock to prevent concurrent execution
    const lockAcquired = await this.storage.set(
      `lock:${idempotencyKey}`,
      'processing',
      'NX',  // Only set if not exists
      'PX',  // Expiry in milliseconds
      this.lockTTL
    );

    if (!lockAcquired) {
      // Another request is processing this key
      throw new Error('Request already in progress. Please retry.');
    }

    try {
      // Step 3: Execute the operation
      const result = await operation();

      // Step 4: Store result for future duplicate requests
      await this.storage.set(
        `result:${idempotencyKey}`,
        JSON.stringify(result),
        'PX',
        this.resultTTL
      );

      return result;
    } finally {
      // Step 5: Release lock
      await this.storage.del(`lock:${idempotencyKey}`);
    }
  }
}

// Usage in Express route
app.post('/api/charges', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'Idempotency-Key header required'
    });
  }

  try {
    const result = await idempotentAPI.executeIdempotent(
      idempotencyKey,
      async () => {
        // This only runs once per idempotency key
        return await paymentProcessor.charge({
          amount: req.body.amount,
          customerId: req.body.customerId
        });
      }
    );

    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});
```

### Database-Backed Idempotency

```sql
-- Idempotency table
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  request_hash VARCHAR(64) NOT NULL,
  response_body JSONB,
  response_status INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

```javascript
async function executeWithIdempotency(key, requestHash, operation) {
  // Use transaction for atomicity
  return await db.transaction(async (trx) => {
    // Check for existing
    const existing = await trx('idempotency_keys')
      .where('key', key)
      .first();

    if (existing) {
      // Verify request matches (prevent key reuse with different data)
      if (existing.request_hash !== requestHash) {
        throw new Error('Idempotency key already used with different request');
      }
      return {
        status: existing.response_status,
        body: existing.response_body
      };
    }

    // Insert placeholder to acquire "lock"
    await trx('idempotency_keys').insert({
      key,
      request_hash: requestHash,
      response_body: null,
      response_status: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Execute operation
    const result = await operation();

    // Store result
    await trx('idempotency_keys')
      .where('key', key)
      .update({
        response_body: result.body,
        response_status: result.status
      });

    return result;
  });
}
```

---

## Advanced Patterns

### Compound Idempotency Keys

```javascript
// Pattern 1: Entity + Action + Timestamp Window
function generateIdempotencyKey(entity, action, data) {
  const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute window
  const dataHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .substring(0, 16);

  return `${entity}_${action}_${timeWindow}_${dataHash}`;
}

// Usage
const key = generateIdempotencyKey(
  'order_123',
  'charge',
  { amount: 500, currency: 'usd' }
);
// Result: "order_123_charge_5765432_a1b2c3d4e5f6g7h8"
```

### Request Fingerprinting

```javascript
// Automatically detect duplicate requests without explicit key
function computeRequestFingerprint(req) {
  const normalized = {
    method: req.method,
    path: req.path,
    body: sortObjectKeys(req.body),
    userId: req.user?.id
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

// Middleware
app.use(async (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return next();
  }

  const fingerprint = computeRequestFingerprint(req);
  const recentDuplicate = await redis.get(`fingerprint:${fingerprint}`);

  if (recentDuplicate) {
    console.warn(`Duplicate request detected: ${fingerprint}`);
    return res.status(409).json({
      error: 'Duplicate request',
      originalRequestId: recentDuplicate
    });
  }

  // Store fingerprint for 30 seconds (rapid retry window)
  await redis.set(`fingerprint:${fingerprint}`, req.id, 'EX', 30);
  next();
});
```

### Idempotent Event Processing

```javascript
// For message queues (Kafka, RabbitMQ, SQS)
class IdempotentEventProcessor {
  constructor(redis, db) {
    this.redis = redis;
    this.db = db;
  }

  async processEvent(event) {
    const eventId = event.id || event.messageId;

    // Check if already processed
    const processed = await this.redis.get(`event:${eventId}`);
    if (processed) {
      console.log(`Event ${eventId} already processed, skipping`);
      return { skipped: true };
    }

    // Process with optimistic locking
    const lockKey = `lock:event:${eventId}`;
    const acquired = await this.redis.set(lockKey, '1', 'NX', 'EX', 300);

    if (!acquired) {
      throw new Error('Event being processed by another worker');
    }

    try {
      // Execute business logic
      const result = await this.handleEvent(event);

      // Mark as processed (keep for 7 days for deduplication)
      await this.redis.set(`event:${eventId}`, '1', 'EX', 7 * 24 * 60 * 60);

      return result;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async handleEvent(event) {
    // Actual event handling logic
    switch (event.type) {
      case 'payment.completed':
        return await this.handlePaymentCompleted(event.data);
      case 'order.created':
        return await this.handleOrderCreated(event.data);
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }
}
```

---

## Real-World: How Companies Handle Idempotency

### Stripe's Implementation

```
Stripe's Idempotency System:
├── Key stored for 24 hours
├── Request body hashed and compared
├── Same key + different body = Error
├── Result cached and returned on retry
├── In-flight requests return 409
└── Keys are scoped per API key

Best practices from Stripe:
├── Generate UUID for each logical operation
├── Include in client-side SDK automatically
├── Retry with same key on network errors
└── New key for genuinely new operations
```

### AWS SQS/SNS Deduplication

```
AWS MessageDeduplicationId:
├── 5-minute deduplication window
├── Content-based (hash of body)
├── Or explicit deduplication ID
├── FIFO queues: Guaranteed exactly-once
└── Standard queues: At-least-once

Implementation:
├── Producer: Attach deduplication ID
├── SQS: Checks against 5-min window
├── Duplicate: Accepted but not delivered
└── Consumer: Still needs idempotent processing!
```

### Database-Level Idempotency

```sql
-- PostgreSQL: Use UPSERT for idempotent writes
INSERT INTO payments (payment_id, amount, status, created_at)
VALUES ('pay_123', 500, 'completed', NOW())
ON CONFLICT (payment_id)
DO NOTHING
RETURNING *;

-- If payment_id exists: Returns nothing (no duplicate)
-- If payment_id new: Inserts and returns the row

-- MySQL equivalent
INSERT IGNORE INTO payments (payment_id, amount, status)
VALUES ('pay_123', 500, 'completed');
```

---

## Common Pitfalls

### Pitfall 1: Key Reuse Across Different Operations

```javascript
// ❌ BAD: Same key for different amounts
await charge({ amount: 500, key: 'order_123' });
// Customer updates cart
await charge({ amount: 750, key: 'order_123' }); // Returns old $500 result!

// ✅ GOOD: Include relevant data in key
await charge({ amount: 500, key: 'order_123_500_v1' });
await charge({ amount: 750, key: 'order_123_750_v1' }); // Different key, new charge
```

### Pitfall 2: Not Handling In-Flight Duplicates

```javascript
// ❌ BAD: Two requests with same key hit different servers simultaneously
// Both check Redis, neither finds existing result, both process!

// ✅ GOOD: Use distributed lock
const lock = await acquireLock(`processing:${key}`, { timeout: 30000 });
if (!lock) {
  return res.status(409).json({ error: 'Request in progress' });
}
```

### Pitfall 3: Idempotency Key Without Request Validation

```javascript
// ❌ BAD: Accept any request body with same key
// Attacker could replay key with malicious payload

// ✅ GOOD: Hash request body and validate
const requestHash = hash(req.body);
if (stored.requestHash !== requestHash) {
  throw new Error('Idempotency key used with different request body');
}
```

---

## Quick Win: Add Idempotency Today

### Express Middleware

```javascript
const idempotencyMiddleware = (options = {}) => {
  const { redis, ttl = 86400, methods = ['POST', 'PUT', 'PATCH'] } = options;

  return async (req, res, next) => {
    if (!methods.includes(req.method)) {
      return next();
    }

    const key = req.headers['idempotency-key'];
    if (!key) {
      return next(); // Optional: require key for certain routes
    }

    // Check for cached response
    const cached = await redis.get(`idempotency:${key}`);
    if (cached) {
      const { status, body } = JSON.parse(cached);
      return res.status(status).json(body);
    }

    // Capture response
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      await redis.set(
        `idempotency:${key}`,
        JSON.stringify({ status: res.statusCode, body }),
        'EX',
        ttl
      );
      return originalJson(body);
    };

    next();
  };
};

// Usage
app.use('/api/payments', idempotencyMiddleware({ redis }));
```

---

## Key Takeaways

### Idempotency Design Checklist

```
1. IDENTIFY non-idempotent operations
   └── POST endpoints, state changes, external calls

2. GENERATE unique keys
   └── UUID per logical operation, include relevant data

3. STORE results with key
   └── Redis (fast) or database (durable)

4. HANDLE concurrent requests
   └── Distributed locks, 409 responses

5. VALIDATE request consistency
   └── Hash body, reject mismatched replays

6. SET appropriate TTLs
   └── Balance storage vs retry window
```

### The Rules

| Scenario | Key Strategy | TTL |
|----------|--------------|-----|
| Payment processing | Order ID + amount + version | 24 hours |
| Form submission | User ID + form ID + timestamp window | 1 hour |
| API webhooks | Event ID from source | 7 days |
| Message processing | Message ID | 24 hours |
| Email sending | Recipient + template + day | 24 hours |

---

## Related Content

- [POC #73: Idempotency Keys Implementation](/interview-prep/practice-pocs/idempotency-keys)
- [POC #74: Deduplication with Redis](/interview-prep/practice-pocs/redis-deduplication)
- [Duplicate Event Processing](/problems-at-scale/data-integrity/duplicate-event-processing)
- [Rate Limiting Strategies](/system-design/api-design/rate-limiting)

---

**Remember:** In distributed systems, "exactly once" is impossible to guarantee at the network level. Idempotency is how you achieve "effectively once" at the application level. Make every mutating operation safe to retry.
