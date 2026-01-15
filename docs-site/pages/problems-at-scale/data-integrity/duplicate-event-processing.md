# Duplicate Event Processing - When At-Least-Once Becomes At-Least-Twice

> **Category:** Data Integrity
> **Frequency:** Very common in event-driven systems
> **Detection Difficulty:** Medium (often silent corruption)
> **Impact:** Double charges, duplicate emails, corrupted state

## The Shopify Problem: 400,000 Duplicate Orders During Black Friday

**Real Incident Pattern (Composite from Industry):**

```
Scenario: E-commerce platform during peak traffic

Architecture:
├── Order Service → Kafka → Fulfillment Service
├── Fulfillment Service → Kafka → Shipping Service
└── Each Kafka consumer: At-least-once delivery

Black Friday timeline:
├── 09:00: Traffic spike, consumer lag builds
├── 09:15: Consumer rebalance triggered
├── 09:20: Uncommitted offsets replayed
├── 09:25: 50,000 orders processed twice
├── 10:00: Shipping labels created twice
├── 12:00: Customers receiving duplicate shipments
├── 14:00: Incident detected via inventory mismatch
└── Post-mortem: $2.3M in duplicate shipments

Root cause: Consumer crashed after processing but before committing offset
```

**The problem:** In distributed systems, "exactly-once" is a lie. Messages will be delivered multiple times, and your system must handle it.

---

## Why Duplicates Happen

### Cause 1: At-Least-Once Delivery Semantics

```
Standard message queue behavior:

1. Consumer receives message
2. Consumer processes message
3. Consumer acknowledges message
4. Queue removes message

What can go wrong:

Step 2-3: Consumer crashes after processing, before ack
          → Queue redelivers message
          → Duplicate processing!

Step 3-4: Network timeout on ack
          → Queue thinks ack failed
          → Queue redelivers message
          → Duplicate processing!

Timeline:
Consumer A                Queue               Consumer B
    │                       │                     │
    │◄── Message X ─────────│                     │
    │                       │                     │
    │ [Process message]     │                     │
    │ [SUCCESS]             │                     │
    │ [Crash before ack!]   │                     │
    │       ✗               │                     │
    │                       │                     │
    │                       │── Timeout ──────────│
    │                       │                     │
    │                       │── Redeliver X ─────►│
    │                       │                     │
    │                       │     [Process again] │
    │                       │     [DUPLICATE!]    │
```

### Cause 2: Producer Retries

```javascript
// Producer sends message, network timeout, retries
async function sendEvent(event) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await kafka.send(event);
      return; // Success
    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        // Did the message get through or not?
        // We don't know! Retry anyway...
        console.log(`Attempt ${attempt + 1} failed, retrying...`);
      }
    }
  }
}

// Result: Same event might be in queue 3 times!
```

### Cause 3: Consumer Rebalancing

```
Kafka consumer group rebalance:

Before rebalance:
├── Consumer A: Partitions 0, 1, 2
├── Consumer B: Partitions 3, 4, 5
└── Consumer A has processed offset 100-110, not committed

Rebalance triggered (new consumer joins):
├── Consumer A: Partitions 0, 1
├── Consumer B: Partitions 2, 3 ← Now has partition 2!
├── Consumer C: Partitions 4, 5
└── Consumer B reads from last committed offset (100)

Result: Messages 100-110 processed again by Consumer B
```

---

## Detection: How to Spot Duplicate Processing

### Symptom 1: Inconsistent Counts

```sql
-- Orders table shows 10,000 orders
SELECT COUNT(*) FROM orders WHERE date = '2024-01-15';
-- Result: 10,000

-- But payment gateway shows 10,847 charges
-- 847 duplicate charges!

-- Find duplicates by correlation ID
SELECT order_id, COUNT(*) as charge_count
FROM payments
WHERE date = '2024-01-15'
GROUP BY order_id
HAVING COUNT(*) > 1;
```

### Symptom 2: Customer Complaints

```
Common reports indicating duplicates:
├── "I got charged twice for the same order"
├── "I received two confirmation emails"
├── "My account balance decreased twice"
├── "I got duplicate shipping notifications"
└── "Same item appears twice in my order history"
```

### Monitoring for Duplicates

```javascript
// Add duplicate detection to event processing
class DuplicateMonitor {
  constructor(redis) {
    this.redis = redis;
    this.windowMs = 3600000; // 1 hour
  }

  async trackEvent(eventId, eventType) {
    const key = `events:${eventType}:${eventId}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, this.windowMs / 1000);
    }

    if (count > 1) {
      // Duplicate detected!
      await this.recordDuplicate(eventId, eventType, count);
    }

    return { isDuplicate: count > 1, count };
  }

  async recordDuplicate(eventId, eventType, count) {
    console.warn(`Duplicate detected: ${eventType}:${eventId} (count: ${count})`);

    // Track in metrics
    metrics.increment('events.duplicates', {
      eventType,
      count
    });

    // Store for analysis
    await this.redis.zadd(
      'duplicates:recent',
      Date.now(),
      JSON.stringify({ eventId, eventType, count, timestamp: Date.now() })
    );
  }

  async getDuplicateStats(hours = 24) {
    const since = Date.now() - (hours * 3600000);
    const duplicates = await this.redis.zrangebyscore(
      'duplicates:recent',
      since,
      '+inf'
    );

    return duplicates.map(d => JSON.parse(d));
  }
}
```

---

## Prevention: Idempotent Event Processing

### Strategy 1: Deduplication with Event IDs

```javascript
class IdempotentEventProcessor {
  constructor(redis, db) {
    this.redis = redis;
    this.db = db;
    this.dedupTTL = 7 * 24 * 60 * 60; // 7 days
  }

  async process(event) {
    const eventId = event.id || this.generateEventId(event);

    // Check if already processed
    const dedupKey = `processed:${eventId}`;
    const alreadyProcessed = await this.redis.get(dedupKey);

    if (alreadyProcessed) {
      console.log(`Event ${eventId} already processed, skipping`);
      return { status: 'duplicate', eventId };
    }

    // Try to acquire processing lock
    const lockAcquired = await this.redis.set(
      `lock:${eventId}`,
      'processing',
      'NX',
      'EX',
      300 // 5 minute lock
    );

    if (!lockAcquired) {
      console.log(`Event ${eventId} being processed by another worker`);
      return { status: 'in_progress', eventId };
    }

    try {
      // Process the event
      const result = await this.handleEvent(event);

      // Mark as processed
      await this.redis.set(dedupKey, JSON.stringify({
        processedAt: Date.now(),
        result: result
      }), 'EX', this.dedupTTL);

      return { status: 'processed', eventId, result };
    } finally {
      await this.redis.del(`lock:${eventId}`);
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
```

### Strategy 2: Database-Level Idempotency

```sql
-- Use UPSERT with unique constraint
CREATE TABLE processed_events (
  event_id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  result JSONB
);

-- Idempotent insert (PostgreSQL)
INSERT INTO processed_events (event_id, event_type, result)
VALUES ($1, $2, $3)
ON CONFLICT (event_id) DO NOTHING
RETURNING *;

-- If returns row: First time processing
-- If returns nothing: Duplicate, skip processing
```

```javascript
async function processEventIdempotently(event, db) {
  // Start transaction
  return await db.transaction(async (trx) => {
    // Try to insert event record
    const result = await trx.raw(`
      INSERT INTO processed_events (event_id, event_type)
      VALUES (?, ?)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING *
    `, [event.id, event.type]);

    if (result.rows.length === 0) {
      // Duplicate - already processed
      return { status: 'duplicate' };
    }

    // First time - process the event
    await handleEvent(event, trx);

    // Update with result
    await trx('processed_events')
      .where('event_id', event.id)
      .update({ result: { success: true } });

    return { status: 'processed' };
  });
}
```

### Strategy 3: Idempotent Operations

```javascript
// Make the operation itself idempotent
class IdempotentOrderService {
  async createOrder(orderId, orderData) {
    // Use orderId as primary key - duplicate inserts fail
    try {
      await this.db('orders').insert({
        id: orderId,
        ...orderData,
        created_at: new Date()
      });
      return { status: 'created', orderId };
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        // Order already exists - return existing
        const existing = await this.db('orders').where('id', orderId).first();
        return { status: 'already_exists', orderId, order: existing };
      }
      throw error;
    }
  }

  async updateInventory(productId, changeId, quantity) {
    // Use change_id to track each inventory change
    const result = await this.db.raw(`
      INSERT INTO inventory_changes (change_id, product_id, quantity_delta)
      VALUES (?, ?, ?)
      ON CONFLICT (change_id) DO NOTHING
      RETURNING *
    `, [changeId, productId, quantity]);

    if (result.rows.length === 0) {
      // Already applied this change
      return { status: 'already_applied' };
    }

    // Apply to inventory
    await this.db('products')
      .where('id', productId)
      .decrement('inventory', quantity);

    return { status: 'applied' };
  }
}
```

### Strategy 4: Outbox Pattern

```javascript
// Ensure exactly-once between database and message queue
class OutboxProcessor {
  async processBusinessLogic(data) {
    // Single transaction: business logic + outbox entry
    await this.db.transaction(async (trx) => {
      // 1. Business logic
      const order = await trx('orders').insert(data.order).returning('*');

      // 2. Write to outbox (same transaction)
      await trx('outbox').insert({
        id: data.eventId,
        event_type: 'order.created',
        payload: JSON.stringify(order),
        created_at: new Date()
      });
    });
    // Transaction commits: both succeed or both fail
  }

  async publishOutboxEvents() {
    // Separate process reads outbox and publishes
    const events = await this.db('outbox')
      .where('published_at', null)
      .orderBy('created_at')
      .limit(100);

    for (const event of events) {
      try {
        await this.messageQueue.publish(event.event_type, event.payload);

        // Mark as published (idempotent - won't publish again)
        await this.db('outbox')
          .where('id', event.id)
          .update({ published_at: new Date() });
      } catch (error) {
        // Will retry on next poll
        console.error('Failed to publish event:', event.id);
      }
    }
  }
}
```

---

## Real-World Solutions

### How Stripe Handles It

```
Stripe's Idempotency:
├── Every API request can include Idempotency-Key header
├── Keys are stored for 24 hours
├── Same key → returns cached response
├── Prevents double charges on retry
└── Client libraries auto-generate keys

Implementation:
1. Request arrives with Idempotency-Key
2. Check Redis: key exists?
   ├── YES: Return cached response
   └── NO: Continue processing
3. Process payment
4. Store response in Redis with key
5. Return response to client
```

### How Kafka Guarantees Exactly-Once

```
Kafka Exactly-Once Semantics (EOS):

Producer side:
├── enable.idempotence=true
├── Kafka assigns producer ID
├── Each message has sequence number
├── Broker deduplicates by (producer_id, sequence)
└── Result: No duplicate messages in topic

Consumer side:
├── Use Kafka Transactions
├── Read → Process → Write → Commit (atomic)
├── Consumer offsets stored in Kafka
└── Result: No duplicate processing

Full pipeline:
├── Idempotent producer → No duplicates on produce
├── Transactional consumer → No duplicates on consume
├── Atomic commit → All-or-nothing processing
└── Result: Exactly-once end-to-end
```

### How AWS SQS Handles It

```
SQS FIFO Queues:
├── MessageDeduplicationId required
├── 5-minute deduplication window
├── Same ID → message not delivered again
└── Content-based deduplication option

Standard Queues:
├── At-least-once delivery
├── No built-in deduplication
├── Consumer must handle duplicates
└── Use visibility timeout wisely
```

---

## Quick Win: Add Deduplication Now

```javascript
// Minimal deduplication middleware
const processedEvents = new Map();
const DEDUP_TTL = 5 * 60 * 1000; // 5 minutes

function deduplicateEvents(handler) {
  return async (event) => {
    const eventId = event.id;

    // Check cache
    if (processedEvents.has(eventId)) {
      console.log(`Duplicate event ${eventId}, skipping`);
      return { status: 'duplicate' };
    }

    // Mark as processing
    processedEvents.set(eventId, Date.now());

    // Clean old entries periodically
    if (processedEvents.size > 10000) {
      const cutoff = Date.now() - DEDUP_TTL;
      for (const [id, timestamp] of processedEvents) {
        if (timestamp < cutoff) processedEvents.delete(id);
      }
    }

    // Process
    return handler(event);
  };
}

// Usage
const handler = deduplicateEvents(async (event) => {
  // Your event processing logic
  await processOrder(event.data);
  return { status: 'processed' };
});
```

---

## Key Takeaways

### Prevention Checklist

```
□ Every event has a unique, stable ID
□ Events are checked against processed set before handling
□ Database operations use UPSERT or unique constraints
□ External API calls include idempotency keys
□ Outbox pattern for database-to-queue consistency
□ Monitoring alerts on duplicate detection
```

### The Rules

| Message Queue | Deduplication Strategy |
|---------------|------------------------|
| Kafka | Idempotent producer + Transactions |
| RabbitMQ | Message ID + Consumer dedup |
| SQS FIFO | MessageDeduplicationId |
| SQS Standard | Consumer-side deduplication |
| Redis Streams | Consumer groups + XACK |

---

## Related Content

- [POC #73: Idempotency Keys](/interview-prep/practice-pocs/idempotency-keys)
- [POC #74: Redis Deduplication](/interview-prep/practice-pocs/redis-deduplication)
- [Idempotency in Distributed Systems](/system-design/api-design/idempotency)
- [Message Ordering Problem](/problems-at-scale/consistency/message-out-of-order)

---

**Remember:** In distributed systems, assume every message will be delivered at least twice. Design every handler to be idempotent. The question isn't "will we get duplicates?" but "when we get duplicates, will they break anything?"
