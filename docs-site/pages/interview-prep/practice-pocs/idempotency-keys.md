# POC #73: Idempotency Keys Implementation

> **Difficulty:** 🔴 Advanced
> **Time:** 45 minutes
> **Prerequisites:** Redis, Express.js, understanding of distributed systems

## What You'll Build

A production-grade idempotency system that:
- Prevents duplicate operations on retry
- Handles concurrent requests safely
- Caches responses for identical requests
- Validates request consistency

## The Problem

```javascript
// Without idempotency: Double charge on network retry
async function chargeCustomer(amount, customerId) {
  // Network timeout after charge succeeds
  // Client retries → another charge!
  return await paymentGateway.charge(amount, customerId);
}

// With idempotency: Safe to retry
async function chargeCustomer(amount, customerId, idempotencyKey) {
  // Same key → returns cached result
  // No duplicate charge!
}
```

## Implementation

### Step 1: Core Idempotency Handler

```javascript
// idempotency.js
const crypto = require('crypto');

class IdempotencyHandler {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.lockTTL = options.lockTTL || 60;        // 1 minute lock
    this.resultTTL = options.resultTTL || 86400; // 24 hour cache
    this.prefix = options.prefix || 'idem';
  }

  // Generate hash of request body for validation
  hashRequest(body) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(this.sortObject(body)))
      .digest('hex');
  }

  // Sort object keys for consistent hashing
  sortObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObject(item));

    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = this.sortObject(obj[key]);
        return sorted;
      }, {});
  }

  async execute(key, requestBody, operation) {
    const requestHash = this.hashRequest(requestBody);

    // Step 1: Check for existing result
    const existing = await this.getExistingResult(key);
    if (existing) {
      // Validate request matches
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyError(
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency key was used with a different request body'
        );
      }

      // Return cached result
      if (existing.status === 'completed') {
        return {
          cached: true,
          result: existing.result
        };
      }

      // Still processing
      if (existing.status === 'processing') {
        throw new IdempotencyError(
          'REQUEST_IN_PROGRESS',
          'A request with this idempotency key is currently being processed'
        );
      }
    }

    // Step 2: Acquire lock
    const lockAcquired = await this.acquireLock(key, requestHash);
    if (!lockAcquired) {
      throw new IdempotencyError(
        'LOCK_FAILED',
        'Could not acquire lock for this idempotency key'
      );
    }

    try {
      // Step 3: Execute operation
      const result = await operation();

      // Step 4: Store result
      await this.storeResult(key, requestHash, result);

      return {
        cached: false,
        result
      };
    } catch (error) {
      // Store error for consistent error responses on retry
      await this.storeError(key, requestHash, error);
      throw error;
    } finally {
      // Release lock (but keep result)
      await this.releaseLock(key);
    }
  }

  async getExistingResult(key) {
    const data = await this.redis.get(`${this.prefix}:result:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async acquireLock(key, requestHash) {
    const lockKey = `${this.prefix}:lock:${key}`;
    const result = await this.redis.set(
      lockKey,
      JSON.stringify({ requestHash, status: 'processing', timestamp: Date.now() }),
      'NX',
      'EX',
      this.lockTTL
    );
    return result === 'OK';
  }

  async releaseLock(key) {
    await this.redis.del(`${this.prefix}:lock:${key}`);
  }

  async storeResult(key, requestHash, result) {
    const data = {
      requestHash,
      status: 'completed',
      result,
      completedAt: Date.now()
    };

    await this.redis.set(
      `${this.prefix}:result:${key}`,
      JSON.stringify(data),
      'EX',
      this.resultTTL
    );
  }

  async storeError(key, requestHash, error) {
    const data = {
      requestHash,
      status: 'failed',
      error: {
        message: error.message,
        code: error.code
      },
      failedAt: Date.now()
    };

    await this.redis.set(
      `${this.prefix}:result:${key}`,
      JSON.stringify(data),
      'EX',
      this.resultTTL
    );
  }
}

class IdempotencyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'IdempotencyError';
  }
}

module.exports = { IdempotencyHandler, IdempotencyError };
```

### Step 2: Express Middleware

```javascript
// middleware/idempotency.js
const { IdempotencyHandler, IdempotencyError } = require('../idempotency');

function idempotencyMiddleware(redis, options = {}) {
  const handler = new IdempotencyHandler(redis, options);
  const {
    headerName = 'Idempotency-Key',
    required = false,
    methods = ['POST', 'PUT', 'PATCH']
  } = options;

  return async (req, res, next) => {
    // Skip non-mutating methods
    if (!methods.includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[headerName.toLowerCase()];

    // Check if key is required
    if (!idempotencyKey) {
      if (required) {
        return res.status(400).json({
          error: 'IDEMPOTENCY_KEY_REQUIRED',
          message: `${headerName} header is required for this endpoint`
        });
      }
      return next();
    }

    // Validate key format (UUID recommended)
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return res.status(400).json({
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency key must be a valid UUID or alphanumeric string (max 255 chars)'
      });
    }

    // Store handler on request for use in route
    req.idempotency = {
      key: idempotencyKey,
      handler,
      execute: async (operation) => {
        return handler.execute(idempotencyKey, req.body, operation);
      }
    };

    next();
  };
}

function isValidIdempotencyKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.length > 255) return false;
  return /^[a-zA-Z0-9_-]+$/.test(key);
}

module.exports = idempotencyMiddleware;
```

### Step 3: API Usage Example

```javascript
// routes/payments.js
const express = require('express');
const router = express.Router();

router.post('/charge', async (req, res) => {
  try {
    const { amount, customerId, currency } = req.body;

    // If idempotency key provided, use it
    if (req.idempotency) {
      const { cached, result } = await req.idempotency.execute(async () => {
        // This only executes once per idempotency key
        const charge = await paymentGateway.createCharge({
          amount,
          customerId,
          currency
        });

        return {
          id: charge.id,
          amount: charge.amount,
          status: charge.status,
          createdAt: new Date().toISOString()
        };
      });

      // Add header to indicate if response was cached
      res.set('Idempotency-Cached', cached ? 'true' : 'false');
      return res.json(result);
    }

    // No idempotency key - process normally (not recommended for payments!)
    const charge = await paymentGateway.createCharge({ amount, customerId, currency });
    return res.json(charge);

  } catch (error) {
    if (error.name === 'IdempotencyError') {
      const statusMap = {
        'IDEMPOTENCY_KEY_REUSED': 422,
        'REQUEST_IN_PROGRESS': 409,
        'LOCK_FAILED': 503
      };

      return res.status(statusMap[error.code] || 500).json({
        error: error.code,
        message: error.message
      });
    }

    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
```

### Step 4: Application Setup

```javascript
// app.js
const express = require('express');
const Redis = require('ioredis');
const idempotencyMiddleware = require('./middleware/idempotency');
const paymentsRouter = require('./routes/payments');

const app = express();
const redis = new Redis(process.env.REDIS_URL);

app.use(express.json());

// Apply idempotency middleware
app.use('/api/payments', idempotencyMiddleware(redis, {
  headerName: 'Idempotency-Key',
  required: true,  // Require for all payment endpoints
  resultTTL: 86400 // Cache results for 24 hours
}));

app.use('/api/payments', paymentsRouter);

app.listen(3000);
```

## Testing

### Test Script

```javascript
// test-idempotency.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_URL = 'http://localhost:3000/api/payments/charge';

async function testIdempotency() {
  const idempotencyKey = uuidv4();
  const payload = {
    amount: 5000,
    customerId: 'cus_123',
    currency: 'usd'
  };

  console.log('Test 1: First request should process');
  const response1 = await axios.post(API_URL, payload, {
    headers: { 'Idempotency-Key': idempotencyKey }
  });
  console.log('Response:', response1.data);
  console.log('Cached:', response1.headers['idempotency-cached']);

  console.log('\nTest 2: Retry with same key should return cached result');
  const response2 = await axios.post(API_URL, payload, {
    headers: { 'Idempotency-Key': idempotencyKey }
  });
  console.log('Response:', response2.data);
  console.log('Cached:', response2.headers['idempotency-cached']);

  console.log('\nTest 3: Same key with different body should fail');
  try {
    await axios.post(API_URL, { ...payload, amount: 10000 }, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
  } catch (error) {
    console.log('Expected error:', error.response.data);
  }

  console.log('\nTest 4: Different key should create new charge');
  const response4 = await axios.post(API_URL, payload, {
    headers: { 'Idempotency-Key': uuidv4() }
  });
  console.log('Response:', response4.data);
  console.log('Cached:', response4.headers['idempotency-cached']);
}

testIdempotency();
```

### Concurrent Request Test

```javascript
// test-concurrent.js
async function testConcurrentRequests() {
  const idempotencyKey = uuidv4();
  const payload = { amount: 5000, customerId: 'cus_123' };

  console.log('Sending 10 concurrent requests with same key...');

  const promises = Array(10).fill().map(() =>
    axios.post(API_URL, payload, {
      headers: { 'Idempotency-Key': idempotencyKey }
    }).catch(e => ({ error: e.response?.data || e.message }))
  );

  const results = await Promise.all(promises);

  const successes = results.filter(r => !r.error);
  const conflicts = results.filter(r => r.error?.error === 'REQUEST_IN_PROGRESS');

  console.log(`Successes: ${successes.length}`);
  console.log(`Conflicts (409): ${conflicts.length}`);
  console.log('All responses have same charge ID:',
    new Set(successes.map(r => r.data?.id)).size === 1);
}
```

## Expected Output

```
Test 1: First request should process
Response: { id: 'ch_abc123', amount: 5000, status: 'succeeded' }
Cached: false

Test 2: Retry with same key should return cached result
Response: { id: 'ch_abc123', amount: 5000, status: 'succeeded' }
Cached: true

Test 3: Same key with different body should fail
Expected error: { error: 'IDEMPOTENCY_KEY_REUSED', message: '...' }

Test 4: Different key should create new charge
Response: { id: 'ch_def456', amount: 5000, status: 'succeeded' }
Cached: false
```

## Key Takeaways

1. **Always hash and validate request body** - Prevent key reuse with different payloads
2. **Use distributed locks** - Handle concurrent duplicate requests
3. **Cache errors too** - Consistent error responses on retry
4. **Set appropriate TTLs** - Balance storage vs retry window
5. **Make it transparent** - Headers indicate cached responses

## Common Mistakes to Avoid

- Not validating request body matches original
- Forgetting to handle the "in progress" state
- Using sequential IDs instead of UUIDs
- Not cleaning up locks on failure
- Caching results indefinitely

## Related POCs

- [POC #74: Deduplication with Redis](/interview-prep/practice-pocs/redis-deduplication)
- [POC #7: Redis Rate Limiting](/interview-prep/practice-pocs/redis-rate-limiting)
- [POC #3: Distributed Lock](/interview-prep/practice-pocs/redis-distributed-lock)
