# POC #74: Deduplication with Redis

> **Difficulty:** 🟡 Intermediate
> **Time:** 30 minutes
> **Prerequisites:** Redis, understanding of message queues

## What You'll Build

A Redis-based deduplication system for:
- Event processing (webhooks, message queues)
- Form submission protection
- Request fingerprinting
- Time-windowed deduplication

## The Problem

```javascript
// Without deduplication: Process same event multiple times
webhookHandler.on('payment.completed', async (event) => {
  // Webhook delivered 3 times (retry logic)
  // Customer gets 3 confirmation emails!
  await sendConfirmationEmail(event.data.customer);
});

// With deduplication: Process exactly once
webhookHandler.on('payment.completed', async (event) => {
  if (await dedup.isDuplicate(event.id)) return;
  await sendConfirmationEmail(event.data.customer);
});
```

## Implementation

### Step 1: Basic Deduplication

```javascript
// deduplication.js
class RedisDeduplicator {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.prefix = options.prefix || 'dedup';
    this.defaultTTL = options.ttlSeconds || 86400; // 24 hours
  }

  // Check if ID has been seen, mark as seen if not
  async checkAndMark(id, ttlSeconds = this.defaultTTL) {
    const key = `${this.prefix}:${id}`;

    // SETNX returns 1 if key was set, 0 if already exists
    const result = await this.redis.set(key, '1', 'NX', 'EX', ttlSeconds);

    // Returns true if this is a NEW id (not duplicate)
    return result === 'OK';
  }

  // Check if ID is duplicate (already processed)
  async isDuplicate(id) {
    const key = `${this.prefix}:${id}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  // Mark ID as processed
  async markProcessed(id, ttlSeconds = this.defaultTTL) {
    const key = `${this.prefix}:${id}`;
    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }

  // Remove ID (allow reprocessing)
  async unmark(id) {
    const key = `${this.prefix}:${id}`;
    await this.redis.del(key);
  }
}

module.exports = RedisDeduplicator;
```

### Step 2: Event Processor with Deduplication

```javascript
// event-processor.js
class DeduplicatedEventProcessor {
  constructor(redis, options = {}) {
    this.dedup = new RedisDeduplicator(redis, {
      prefix: options.prefix || 'events',
      ttlSeconds: options.ttlSeconds || 7 * 24 * 60 * 60 // 7 days
    });
    this.handlers = new Map();
  }

  on(eventType, handler) {
    this.handlers.set(eventType, handler);
  }

  async process(event) {
    const eventId = event.id || this.generateEventId(event);

    // Check for duplicate
    const isNew = await this.dedup.checkAndMark(eventId);

    if (!isNew) {
      console.log(`Duplicate event ${eventId}, skipping`);
      return { status: 'duplicate', eventId };
    }

    const handler = this.handlers.get(event.type);
    if (!handler) {
      console.log(`No handler for event type: ${event.type}`);
      return { status: 'unhandled', eventId };
    }

    try {
      await handler(event);
      return { status: 'processed', eventId };
    } catch (error) {
      // On failure, remove from dedup set to allow retry
      await this.dedup.unmark(eventId);
      throw error;
    }
  }

  generateEventId(event) {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex')
      .substring(0, 32);
  }
}

module.exports = DeduplicatedEventProcessor;
```

### Step 3: Form Submission Protection

```javascript
// form-dedup.js
class FormSubmissionProtector {
  constructor(redis) {
    this.redis = redis;
    this.windowSeconds = 60; // 1 minute window
  }

  // Generate fingerprint from form data
  generateFingerprint(userId, formId, data) {
    const crypto = require('crypto');
    const normalized = JSON.stringify({
      userId,
      formId,
      data: this.sortObject(data)
    });

    return crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex');
  }

  sortObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    return Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = this.sortObject(obj[key]);
      return acc;
    }, {});
  }

  async checkSubmission(userId, formId, data) {
    const fingerprint = this.generateFingerprint(userId, formId, data);
    const key = `form:${fingerprint}`;

    // Try to set with NX (only if not exists)
    const result = await this.redis.set(
      key,
      JSON.stringify({ userId, formId, timestamp: Date.now() }),
      'NX',
      'EX',
      this.windowSeconds
    );

    if (result !== 'OK') {
      // Duplicate submission
      const existing = await this.redis.get(key);
      return {
        isDuplicate: true,
        originalSubmission: JSON.parse(existing)
      };
    }

    return { isDuplicate: false };
  }
}

// Express middleware
function formDeduplicationMiddleware(redis) {
  const protector = new FormSubmissionProtector(redis);

  return async (req, res, next) => {
    if (req.method !== 'POST') return next();

    const userId = req.user?.id || req.ip;
    const formId = req.path;

    const result = await protector.checkSubmission(userId, formId, req.body);

    if (result.isDuplicate) {
      return res.status(409).json({
        error: 'DUPLICATE_SUBMISSION',
        message: 'This form was already submitted',
        originalTimestamp: result.originalSubmission.timestamp
      });
    }

    next();
  };
}

module.exports = { FormSubmissionProtector, formDeduplicationMiddleware };
```

### Step 4: Sliding Window Deduplication

```javascript
// sliding-window-dedup.js
class SlidingWindowDeduplicator {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.prefix = options.prefix || 'swdedup';
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxPerWindow = options.maxPerWindow || 1; // Allow 1 per window
  }

  async checkAndIncrement(key, id) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const redisKey = `${this.prefix}:${key}`;

    // Lua script for atomic sliding window check
    const script = `
      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])

      -- Check if this ID exists in window
      local score = redis.call('ZSCORE', KEYS[1], ARGV[3])
      if score then
        return {0, 'duplicate'}
      end

      -- Count entries in window
      local count = redis.call('ZCARD', KEYS[1])

      if count >= tonumber(ARGV[2]) then
        return {0, 'rate_limited'}
      end

      -- Add new entry
      redis.call('ZADD', KEYS[1], ARGV[4], ARGV[3])
      redis.call('EXPIRE', KEYS[1], ARGV[5])

      return {1, 'ok'}
    `;

    const [allowed, reason] = await this.redis.eval(
      script,
      1,
      redisKey,
      windowStart,        // ARGV[1]: window start
      this.maxPerWindow,  // ARGV[2]: max allowed
      id,                 // ARGV[3]: entry ID
      now,                // ARGV[4]: current timestamp
      Math.ceil(this.windowMs / 1000) * 2 // ARGV[5]: TTL
    );

    return {
      allowed: allowed === 1,
      reason,
      windowMs: this.windowMs
    };
  }

  async getWindowEntries(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const redisKey = `${this.prefix}:${key}`;

    await this.redis.zremrangebyscore(redisKey, 0, windowStart);
    return await this.redis.zrange(redisKey, 0, -1, 'WITHSCORES');
  }
}

module.exports = SlidingWindowDeduplicator;
```

### Step 5: Message Queue Consumer

```javascript
// queue-consumer.js
const DeduplicatedEventProcessor = require('./event-processor');

class DeduplicatedQueueConsumer {
  constructor(queue, redis, options = {}) {
    this.queue = queue;
    this.processor = new DeduplicatedEventProcessor(redis, options);
    this.batchSize = options.batchSize || 10;
  }

  registerHandler(eventType, handler) {
    this.processor.on(eventType, handler);
  }

  async start() {
    console.log('Starting deduplicated queue consumer...');

    while (true) {
      try {
        const messages = await this.queue.receive(this.batchSize);

        for (const message of messages) {
          await this.processMessage(message);
        }
      } catch (error) {
        console.error('Error processing messages:', error);
        await this.sleep(5000);
      }
    }
  }

  async processMessage(message) {
    const event = JSON.parse(message.body);

    try {
      const result = await this.processor.process(event);

      if (result.status === 'duplicate') {
        // Acknowledge duplicate (don't process again)
        await this.queue.ack(message);
        return;
      }

      if (result.status === 'processed') {
        await this.queue.ack(message);
        return;
      }

      // Unhandled event type - dead letter or log
      console.warn('Unhandled event:', event.type);
      await this.queue.ack(message);

    } catch (error) {
      console.error('Processing failed:', error);
      // Don't ack - message will be redelivered
      // Dedup mark was removed on failure, so retry will work
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DeduplicatedQueueConsumer;
```

## Testing

### Test Script

```javascript
// test-dedup.js
const Redis = require('ioredis');
const RedisDeduplicator = require('./deduplication');

const redis = new Redis();
const dedup = new RedisDeduplicator(redis, { prefix: 'test' });

async function runTests() {
  // Clean up
  await redis.flushdb();

  console.log('Test 1: First occurrence should not be duplicate');
  const isNew1 = await dedup.checkAndMark('event_123');
  console.log('Is new:', isNew1); // true

  console.log('\nTest 2: Second occurrence should be duplicate');
  const isNew2 = await dedup.checkAndMark('event_123');
  console.log('Is new:', isNew2); // false

  console.log('\nTest 3: Different ID should not be duplicate');
  const isNew3 = await dedup.checkAndMark('event_456');
  console.log('Is new:', isNew3); // true

  console.log('\nTest 4: Check isDuplicate');
  console.log('event_123 is duplicate:', await dedup.isDuplicate('event_123')); // true
  console.log('event_789 is duplicate:', await dedup.isDuplicate('event_789')); // false

  console.log('\nTest 5: Unmark and reprocess');
  await dedup.unmark('event_123');
  const isNew5 = await dedup.checkAndMark('event_123');
  console.log('Is new after unmark:', isNew5); // true

  await redis.quit();
}

runTests();
```

### Concurrent Test

```javascript
// test-concurrent-dedup.js
async function testConcurrentDedup() {
  const eventId = 'concurrent_event_' + Date.now();
  let processedCount = 0;

  // Simulate 100 concurrent attempts to process same event
  const promises = Array(100).fill().map(async () => {
    const isNew = await dedup.checkAndMark(eventId);
    if (isNew) {
      processedCount++;
      // Simulate processing
      await new Promise(r => setTimeout(r, 10));
    }
    return isNew;
  });

  const results = await Promise.all(promises);
  const newCount = results.filter(r => r).length;

  console.log('Concurrent requests:', 100);
  console.log('Processed (should be 1):', newCount);
  console.log('Deduplicated:', 100 - newCount);
}
```

## Expected Output

```
Test 1: First occurrence should not be duplicate
Is new: true

Test 2: Second occurrence should be duplicate
Is new: false

Test 3: Different ID should not be duplicate
Is new: true

Test 4: Check isDuplicate
event_123 is duplicate: true
event_789 is duplicate: false

Test 5: Unmark and reprocess
Is new after unmark: true

Concurrent requests: 100
Processed (should be 1): 1
Deduplicated: 99
```

## Key Takeaways

1. **Use SETNX for atomic check-and-set** - Prevents race conditions
2. **Include TTL** - Don't let dedup set grow forever
3. **Handle failures** - Unmark on processing failure to allow retry
4. **Use Lua scripts** - For complex atomic operations
5. **Consider window size** - Balance memory vs dedup accuracy

## Production Considerations

- **Memory**: Each ID uses ~50 bytes in Redis
- **TTL**: 24 hours = 1M events/day = ~50MB
- **Cleanup**: Redis handles TTL automatically
- **Clustering**: Ensure consistent hashing for distributed Redis

## Related POCs

- [POC #73: Idempotency Keys](/interview-prep/practice-pocs/idempotency-keys)
- [POC #49: Kafka Exactly-Once](/interview-prep/practice-pocs/kafka-exactly-once-semantics)
- [POC #3: Distributed Lock](/interview-prep/practice-pocs/redis-distributed-lock)
