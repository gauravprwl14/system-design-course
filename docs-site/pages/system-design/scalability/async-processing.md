# Async Processing & Message Queues

> **Reading Time:** 22 minutes
> **Difficulty:** Intermediate
> **Impact:** Turn a 30-second API response into 200ms — and never lose a message

## Why Synchronous Breaks at Scale

**Your checkout flow today:**

```
User clicks "Buy" → API receives request

Synchronous flow (everything in one request):
┌──────────────────────────────────────────────────┐
│ 1. Validate order         (10ms)                 │
│ 2. Check inventory        (50ms)                 │
│ 3. Process payment        (800ms)  ← Stripe API  │
│ 4. Update inventory       (30ms)                 │
│ 5. Send confirmation email(500ms)  ← SMTP slow   │
│ 6. Send SMS notification  (400ms)  ← Twilio API  │
│ 7. Update analytics       (100ms)                │
│ 8. Notify warehouse       (200ms)                │
│ 9. Generate invoice PDF   (300ms)                │
│ 10. Update loyalty points (50ms)                 │
├──────────────────────────────────────────────────┤
│ Total: 2,440ms                                   │
│ User waits: 2.4 seconds (if nothing fails)       │
│ If email service is down: ENTIRE ORDER FAILS     │
└──────────────────────────────────────────────────┘
```

**What the user actually needs to know immediately:** "Order placed successfully."

Everything else can happen in the background.

```
Async flow (only critical path is synchronous):
┌────────────────────────────────────┐
│ 1. Validate order      (10ms)     │  Synchronous
│ 2. Check inventory     (50ms)     │  (user waits)
│ 3. Process payment     (800ms)    │
│ 4. Publish OrderPlaced event      │  (5ms)
├────────────────────────────────────┤
│ Total: 865ms                      │
│ Response: "Order confirmed! ✓"    │
└────────────────────────────────────┘

Background (user doesn't wait):
  OrderPlaced event → Email service sends confirmation
  OrderPlaced event → SMS service sends notification
  OrderPlaced event → Analytics updates dashboard
  OrderPlaced event → Warehouse gets notified
  OrderPlaced event → Invoice service generates PDF
  OrderPlaced event → Loyalty service adds points
```

**Result: 2.4s → 865ms response time. Email down? Order still works.**

---

## Message Queue Fundamentals

### What Is a Message Queue?

```
Producer → Queue → Consumer

Think of it as a postal service:
1. You write a letter (produce a message)
2. Drop it in a mailbox (publish to queue)
3. Post office holds it (queue stores message)
4. Carrier delivers it (consumer processes it)

Key property: Producer doesn't wait for consumer
  - Producer succeeds even if consumer is down
  - Messages are durable (saved to disk)
  - Consumer processes at its own pace
```

### Core Concepts

```
┌──────────┐    ┌────────────────┐    ┌──────────┐
│ Producer │───▶│  Message Queue │───▶│ Consumer │
│          │    │                │    │          │
│ Sends    │    │ ┌──┬──┬──┬──┐ │    │ Reads &  │
│ messages │    │ │M5│M4│M3│M2│ │    │ processes│
│          │    │ └──┴──┴──┴──┘ │    │ messages │
└──────────┘    └────────────────┘    └──────────┘

Message: Data packet (JSON, protobuf, etc.)
Queue: Ordered buffer that stores messages
Producer: Application that sends messages
Consumer: Application that reads/processes messages
Broker: Server that manages queues (Kafka, RabbitMQ)
Topic: Named channel for message categories
```

---

## Message Queue Patterns

### Pattern 1: Point-to-Point (Work Queue)

```
One message → One consumer

Use case: Job processing, task distribution

Producer ───▶ ┌──────────┐ ───▶ Consumer 1
              │  Queue   │ ───▶ Consumer 2
              │ [J1][J2] │ ───▶ Consumer 3
              │ [J3][J4] │
              └──────────┘

Each job processed by exactly ONE consumer
Load balanced across consumers automatically

Example: Image resize queue
  Job: { imageId: 123, size: "thumbnail" }
  Consumer 1 gets J1, Consumer 2 gets J2, etc.
```

### Pattern 2: Publish/Subscribe (Fan-out)

```
One message → All subscribers

Use case: Event notifications, data sync

                    ┌──────────┐
              ┌────▶│ Email Svc│ (gets ALL events)
              │     └──────────┘
Producer ───▶ │     ┌──────────┐
 OrderPlaced  ├────▶│ SMS Svc  │ (gets ALL events)
              │     └──────────┘
              │     ┌──────────┐
              └────▶│Analytics │ (gets ALL events)
                    └──────────┘

Every subscriber gets a copy of every message
```

### Pattern 3: Topic-Based Routing

```
Messages routed by topic/key

OrderService publishes:
  Topic: "orders"
  Key: "order.created"  →  Fulfillment + Analytics
  Key: "order.cancelled" → Refund + Analytics
  Key: "order.shipped"  →  Notification + Analytics

┌────────────┐     order.created     ┌─────────────┐
│   Order    │ ────────────────────▶ │ Fulfillment │
│  Service   │     order.cancelled   ├─────────────┤
│            │ ────────────────────▶ │   Refund    │
│            │     order.*           ├─────────────┤
│            │ ────────────────────▶ │  Analytics  │
└────────────┘                       └─────────────┘

Analytics subscribes to "order.*" (wildcard - gets everything)
Fulfillment subscribes to "order.created" only
```

---

## Choosing a Message Queue

### Comparison Matrix

```
                  Kafka         RabbitMQ       AWS SQS
─────────────     ──────        ─────────      ─────────
Throughput        1M+ msg/sec   50K msg/sec    Unlimited*
Latency           Low (ms)      Very low (μs)  Higher (10-50ms)
Message size      1MB default   128MB          256KB
Retention         Configurable  Until consumed Until consumed
                  (days/weeks)
Ordering          Per partition  Per queue      Best effort**
Replay            ✅ Yes         ❌ No           ❌ No
Consumer groups   ✅ Built-in    ❌ Manual        ❌ Manual
Exactly-once      ✅ Yes         ❌ At-most-once  ❌ At-least-once
Hosted option     Confluent     CloudAMQP     AWS native
Best for          Event streams  Task queues   Simple async

* SQS: AWS manages scaling
** SQS FIFO queues guarantee ordering
```

### When to Use Each

```
Kafka:
✅ Event sourcing, event streaming
✅ Log aggregation (100K+ events/sec)
✅ Real-time analytics pipelines
✅ Change data capture (CDC)
✅ Need message replay
Example: "Process 500K clickstream events per second"

RabbitMQ:
✅ Task queues (background jobs)
✅ RPC (request-reply pattern)
✅ Complex routing (headers, topics, fanout)
✅ Low-latency requirements
✅ Smaller scale (< 100K msg/sec)
Example: "Send emails, resize images, generate PDFs"

AWS SQS:
✅ Simple async decoupling
✅ Serverless architectures (Lambda triggers)
✅ No infrastructure management
✅ Auto-scaling built in
Example: "Queue orders for processing, trigger Lambda"
```

---

## Kafka Deep Dive

### Architecture

```
Kafka Cluster:
┌─────────────────────────────────────────────────┐
│                                                 │
│  Topic: "orders" (3 partitions, replication=2)  │
│                                                 │
│  Broker 1          Broker 2          Broker 3   │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐│
│  │Partition 0│     │Partition 1│     │Partition 2││
│  │(Leader)   │     │(Leader)   │     │(Leader)   ││
│  │ [M0][M3]  │     │ [M1][M4]  │     │ [M2][M5]  ││
│  │ [M6][M9]  │     │ [M7][M10] │     │ [M8][M11] ││
│  └──────────┘     └──────────┘     └──────────┘│
│  ┌──────────┐     ┌──────────┐     ┌──────────┐│
│  │Partition 1│     │Partition 2│     │Partition 0││
│  │(Replica)  │     │(Replica)  │     │(Replica)  ││
│  └──────────┘     └──────────┘     └──────────┘│
│                                                 │
└─────────────────────────────────────────────────┘

Key concepts:
- Topic: Named category (like "orders", "payments")
- Partition: Ordered log within a topic
- Offset: Position of message in partition
- Consumer Group: Set of consumers that share work
- Replication: Copies for durability
```

### Consumer Groups

```
Topic "orders" has 3 partitions

Consumer Group A (Order Processing):
  Consumer A1 ← reads Partition 0
  Consumer A2 ← reads Partition 1
  Consumer A3 ← reads Partition 2
  (Each partition assigned to ONE consumer in group)

Consumer Group B (Analytics):
  Consumer B1 ← reads ALL partitions
  (Single consumer gets everything)

Key rules:
1. Each partition → at most ONE consumer per group
2. Each consumer → can read multiple partitions
3. Consumers > Partitions = some consumers idle
4. Different groups read INDEPENDENTLY
```

### Kafka Ordering Guarantees

```
Messages with the same key go to the same partition:

Producer sends:
  { key: "user-123", value: "order-created" }  → Partition 0
  { key: "user-456", value: "order-created" }  → Partition 1
  { key: "user-123", value: "order-paid" }     → Partition 0

Partition 0: [order-created] → [order-paid] ✅ Ordered!
Partition 1: [order-created]

User-123's events are always in order
across partitions, order is NOT guaranteed
```

---

## Dead Letter Queues (DLQ)

### The Problem

```
Consumer processing message:
  1. Read message: { orderId: 123, action: "charge" }
  2. Call PaymentService → 500 Internal Error
  3. Retry → 500 again
  4. Retry → 500 again
  5. ...infinite retry loop? Drop message?

Neither option is acceptable:
  - Infinite retry = consumer is stuck
  - Drop message = lost payment
```

### The Solution: Dead Letter Queue

```
Main Queue → Consumer → Process
                ↓ (fails 3x)
           Dead Letter Queue → Alert → Manual review

┌──────────┐     ┌──────────┐     ┌──────────┐
│  Main    │────▶│ Consumer │────▶│ Success  │
│  Queue   │     │          │     └──────────┘
└──────────┘     │ Retries: │
                 │ 1: fail  │
                 │ 2: fail  │
                 │ 3: fail  │     ┌──────────┐
                 │──────────│────▶│   DLQ    │
                 └──────────┘     │          │
                                  │ ┌──────┐ │
                                  │ │Poison│ │
                                  │ │ msg  │ │
                                  │ └──────┘ │
                                  └──────────┘
                                       │
                                  Alert team
                                  Manual replay
                                  after fix
```

```javascript
// Pseudocode: DLQ implementation
async function processMessage(message) {
  const MAX_RETRIES = 3;
  let retries = message.headers['x-retry-count'] || 0;

  try {
    await handleOrder(message.body);
    await message.ack(); // Success - remove from queue
  } catch (error) {
    retries++;
    if (retries >= MAX_RETRIES) {
      // Send to Dead Letter Queue
      await dlqProducer.send({
        topic: 'orders-dlq',
        messages: [{
          key: message.key,
          value: message.value,
          headers: {
            'x-original-topic': 'orders',
            'x-retry-count': String(retries),
            'x-error': error.message,
            'x-failed-at': new Date().toISOString()
          }
        }]
      });
      await message.ack(); // Remove from main queue
      alertOps(`Message ${message.key} moved to DLQ`);
    } else {
      // Retry with backoff
      await sleep(Math.pow(2, retries) * 1000);
      message.headers['x-retry-count'] = retries;
      await message.nack(); // Re-queue for retry
    }
  }
}
```

---

## Backpressure: When Consumers Can't Keep Up

### The Problem

```
Producer: 10,000 messages/sec
Consumer: 1,000 messages/sec

After 1 hour:
  Queue depth: 32,400,000 messages
  Consumer lag: 9 hours behind

After 1 day:
  Queue depth: 777,600,000 messages
  Disk full, broker crashes
```

### Backpressure Strategies

```
Strategy 1: Add More Consumers (Scale Out)
  Consumer Group:
    Consumer 1 → Partition 0 (1K msg/sec)
    Consumer 2 → Partition 1 (1K msg/sec)
    ...
    Consumer 10 → Partition 9 (1K msg/sec)
    Total: 10K msg/sec ✅

Strategy 2: Rate Limit Producer
  Producer checks queue depth:
    if queue.depth > threshold:
      reject new messages with 429 Too Many Requests
      or slow down production rate

Strategy 3: Batch Processing
  Instead of: Process 1 message at a time
  Do: Collect 100 messages, process batch
  Result: 10x throughput improvement

Strategy 4: Drop Non-Critical Messages
  Priority queue:
    HIGH (payments): Always process
    MEDIUM (emails): Process if queue < 1M
    LOW (analytics): Drop if queue > 5M
```

---

## Idempotency: Processing Messages Safely

### The Problem

```
At-least-once delivery means duplicates happen:

1. Consumer processes message
2. Consumer sends ACK
3. Network blip - ACK lost
4. Broker re-delivers message
5. Consumer processes AGAIN

Without idempotency:
  "Charge $99.99" processed twice = $199.98 charged!
```

### The Solution

```javascript
// Idempotent message processing
async function processPayment(message) {
  const idempotencyKey = message.headers['idempotency-key'];

  // Check if already processed
  const existing = await redis.get(`processed:${idempotencyKey}`);
  if (existing) {
    console.log(`Already processed ${idempotencyKey}, skipping`);
    return; // Skip duplicate
  }

  // Process the payment
  await chargeCustomer(message.body);

  // Mark as processed (with TTL for cleanup)
  await redis.set(`processed:${idempotencyKey}`, 'done', 'EX', 86400);
}

// Producer includes idempotency key:
await producer.send({
  topic: 'payments',
  messages: [{
    key: orderId,
    value: JSON.stringify({ amount: 99.99, currency: 'USD' }),
    headers: {
      'idempotency-key': `payment-${orderId}-${timestamp}`
    }
  }]
});
```

---

## Real-World Architecture: Uber

```
Uber's Async Processing Pipeline:

Trip Request Flow:
┌──────────┐     ┌──────────────┐
│  Rider   │────▶│  Trip Service│──┐
│   App    │     │              │  │
└──────────┘     └──────────────┘  │
                                   ▼
                         ┌──────────────────┐
                         │   Apache Kafka   │
                         │                  │
                         │ Topics:          │
                         │  trip.requested  │
                         │  trip.accepted   │
                         │  trip.started    │
                         │  trip.completed  │
                         │  trip.cancelled  │
                         └────────┬─────────┘
                                  │
              ┌───────────┬───────┼──────────┬────────────┐
              ▼           ▼       ▼          ▼            ▼
        ┌──────────┐ ┌────────┐ ┌───────┐ ┌─────────┐ ┌──────┐
        │ Matching │ │Pricing │ │ ETA   │ │Analytics│ │Fraud │
        │ Service  │ │Service │ │Service│ │ Service │ │ Svc  │
        └──────────┘ └────────┘ └───────┘ └─────────┘ └──────┘

Scale:
- 1 trillion+ messages per day
- Peak: 15M+ messages per second
- Kafka cluster: 1000+ brokers
- Topics: 4000+
- Consumer groups: 5000+
```

---

## Implementation: Building an Async Order Pipeline

```javascript
// Order Service - produces events
class OrderService {
  async createOrder(orderData) {
    // 1. Synchronous: Validate and save order
    const order = await this.db.orders.create({
      ...orderData,
      status: 'PENDING'
    });

    // 2. Synchronous: Process payment (critical path)
    const payment = await this.paymentService.charge({
      amount: order.total,
      customerId: order.customerId
    });

    if (!payment.success) {
      await this.db.orders.update(order.id, { status: 'FAILED' });
      throw new PaymentError('Payment failed');
    }

    // 3. Update order status
    await this.db.orders.update(order.id, { status: 'CONFIRMED' });

    // 4. Async: Publish event for everything else
    await this.kafka.produce('order-events', {
      key: order.id,
      value: JSON.stringify({
        type: 'ORDER_CONFIRMED',
        orderId: order.id,
        customerId: order.customerId,
        items: order.items,
        total: order.total,
        timestamp: Date.now()
      })
    });

    // Return immediately - user doesn't wait for email/SMS/etc.
    return { orderId: order.id, status: 'CONFIRMED' };
  }
}
```

```javascript
// Email Consumer - processes events asynchronously
class EmailConsumer {
  async handleMessage(message) {
    const event = JSON.parse(message.value);

    switch (event.type) {
      case 'ORDER_CONFIRMED':
        await this.emailService.send({
          to: await this.getCustomerEmail(event.customerId),
          template: 'order-confirmation',
          data: {
            orderId: event.orderId,
            items: event.items,
            total: event.total
          }
        });
        break;

      case 'ORDER_SHIPPED':
        await this.emailService.send({
          to: await this.getCustomerEmail(event.customerId),
          template: 'shipping-notification',
          data: { trackingNumber: event.trackingNumber }
        });
        break;
    }
  }
}
```

```javascript
// Inventory Consumer - updates stock levels
class InventoryConsumer {
  async handleMessage(message) {
    const event = JSON.parse(message.value);

    if (event.type === 'ORDER_CONFIRMED') {
      for (const item of event.items) {
        await this.db.inventory.decrement(item.productId, item.quantity);

        // Check for low stock alert
        const remaining = await this.db.inventory.getStock(item.productId);
        if (remaining < item.reorderThreshold) {
          await this.kafka.produce('inventory-alerts', {
            key: item.productId,
            value: JSON.stringify({
              type: 'LOW_STOCK',
              productId: item.productId,
              remaining: remaining
            })
          });
        }
      }
    }
  }
}
```

---

## Monitoring Async Systems

### Key Metrics

```
Queue Health:
├── Queue Depth (messages waiting)
│   Normal: < 1000
│   Warning: > 10,000
│   Critical: > 100,000 (consumers can't keep up)
│
├── Consumer Lag (how far behind)
│   Normal: < 100 messages
│   Warning: > 1,000 messages
│   Critical: > 10,000 messages
│
├── Processing Rate (messages/sec)
│   Track: Consumer throughput vs producer throughput
│   Alert if: Consumer rate < Producer rate for > 5 min
│
├── Error Rate
│   Normal: < 0.1% messages fail
│   Warning: > 1% messages fail
│   Critical: > 5% messages fail
│
└── DLQ Size
    Normal: 0 messages
    Warning: > 0 (investigate immediately)
    Critical: Growing (systematic failure)
```

### Dashboard Example

```
┌─────────────────────────────────────────────────┐
│        Async Processing Dashboard               │
├──────────────────┬──────────────────────────────┤
│ Queue Depth      │ ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁ (healthy)  │
│ Consumer Lag     │ 45 messages (normal)          │
│ Processing Rate  │ 5,230 msg/sec                 │
│ Error Rate       │ 0.02%                         │
│ DLQ Messages     │ 3 (needs review)              │
│ Avg Process Time │ 12ms                          │
│ P99 Process Time │ 145ms                         │
│ Active Consumers │ 12/12                         │
└──────────────────┴──────────────────────────────┘
```

---

## Common Mistakes

### 1. Making Everything Async

```
❌ User clicks "Login"
   → Publish LoginRequest to queue
   → Consumer processes login
   → Publish LoginResponse to queue
   → "Please wait while we log you in..."
   User: Logs into competitor's site

✅ Login should be synchronous (< 100ms)
   Only async for things user doesn't need immediately
```

### 2. No Idempotency

```
❌ Process payment message twice = charge twice
   Process email message twice = send email twice
   Process inventory message twice = deduct inventory twice

✅ Every consumer MUST be idempotent
   Use idempotency keys for all side effects
```

### 3. Ignoring Message Ordering

```
❌ Events processed out of order:
   1. OrderShipped (processed first)
   2. OrderCreated (processed second)
   Result: "Can't ship an order that doesn't exist"

✅ Use partition keys for related messages
   Same orderId → same partition → ordered processing
```

### 4. No Dead Letter Queue

```
❌ Poison message blocks consumer forever
   Consumer retries infinitely
   All other messages wait behind it

✅ Max retries → DLQ → alert → manual review
   Never let one bad message block the queue
```

---

## Key Takeaways

```
1. Only the critical path should be synchronous
   User-facing response = fast
   Everything else = queue it

2. Choose the right queue for the job
   Kafka = event streams, high throughput, replay
   RabbitMQ = task queues, routing, low latency
   SQS = simple async, serverless, managed

3. Every consumer must be idempotent
   Assume messages will be delivered at least once

4. Dead Letter Queues are not optional
   Failed messages need somewhere to go

5. Monitor queue depth and consumer lag
   These are your early warning systems

6. Use partition keys for ordering
   Related events must be in the same partition

7. Backpressure protects your system
   Know what to do when consumers fall behind
```
