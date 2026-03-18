---
title: Event-Driven Architecture
layer: concept
section: system-design/scalability
difficulty: advanced
prerequisites:
  - system-design/scalability/microservices-architecture
  - system-design/queues/message-queue-basics
  - system-design/queues/kafka-vs-rabbitmq
solves_with: []
related_problems:
  - problems-at-scale/consistency/message-out-of-order
  - problems-at-scale/data-integrity/duplicate-event-processing
  - problems-at-scale/availability/cascading-failures
case_studies:
  - system-design/case-studies/notification-system
  - system-design/case-studies/payment-system
  - system-design/case-studies/uber-backend
see_poc:
  - interview-prep/practice-pocs/kafka-basics-producer-consumer
  - interview-prep/practice-pocs/event-sourcing-basics
  - interview-prep/practice-pocs/event-store-implementation
  - interview-prep/practice-pocs/outbox-pattern
  - interview-prep/practice-pocs/redis-streams-event-sourcing
linked_from:
  - interview-prep/practice-pocs/cqrs-pattern
  - interview-prep/practice-pocs/event-sourcing-basics
  - interview-prep/practice-pocs/event-store-implementation
  - interview-prep/practice-pocs/kafka-streams-real-time-processing
  - interview-prep/practice-pocs/outbox-pattern
  - interview-prep/practice-pocs/redis-lua-workflows
  - interview-prep/practice-pocs/redis-pubsub
  - interview-prep/practice-pocs/redis-pubsub-patterns
  - interview-prep/practice-pocs/redis-streams
  - interview-prep/practice-pocs/redis-streams-event-sourcing
  - interview-prep/practice-pocs/saga-pattern
  - interview-prep/system-design/collaborative-editing-google-docs
  - interview-prep/system-design/cqrs-pattern
  - interview-prep/system-design/distributed-tracing
  - interview-prep/system-design/event-driven-architecture
  - interview-prep/system-design/message-queues-kafka-rabbitmq
  - interview-prep/system-design/monolith-to-microservices
  - interview-prep/system-design/saga-pattern
  - interview-prep/system-design/social-media-feed
  - problems-at-scale/concurrency/stock-order-matching-race
  - problems-at-scale/consistency/message-out-of-order
  - problems-at-scale/data-integrity/duplicate-event-processing
  - system-design/scalability/cqrs
tags:
  - event-driven
  - kafka
  - event-sourcing
  - microservices
  - loose-coupling
---

# Event-Driven Architecture - Loose Coupling at Scale

> **Reading Time:** 22 minutes
> **Difficulty:** Advanced
> **Impact:** Build systems where services evolve independently and failures don't cascade

## The Coupling Problem

**Your services are too friendly with each other.**

```
Tightly coupled (request-driven):

OrderService:
  async createOrder(data) {
    const order = await db.save(data);
    await paymentService.charge(order);       // Direct call
    await inventoryService.reserve(order);    // Direct call
    await emailService.sendConfirmation(order);// Direct call
    await analyticsService.trackOrder(order); // Direct call
    await loyaltyService.addPoints(order);    // Direct call
    return order;
  }

Problems:
  1. OrderService KNOWS about 5 other services
  2. Add notification service → change OrderService code
  3. PaymentService slow → OrderService slow
  4. AnalyticsService down → OrderService fails
  5. Can't deploy OrderService without testing all 5 services
  6. Circular dependencies emerge over time
```

```
Loosely coupled (event-driven):

OrderService:
  async createOrder(data) {
    const order = await db.save(data);
    await eventBus.publish('OrderCreated', order);  // That's it
    return order;
  }

  OrderService doesn't know WHO listens.
  Add a new service? Just subscribe to the event.
  Payment service slow? OrderService doesn't notice.
  Analytics down? Orders keep working.
```

---

## Core Concepts

### Events vs Commands vs Queries

```
EVENT: "Something happened" (past tense)
  OrderCreated, PaymentProcessed, UserRegistered
  → Publisher doesn't care who listens
  → Zero, one, or many subscribers
  → Immutable fact

COMMAND: "Do something" (imperative)
  ProcessPayment, SendEmail, ReserveInventory
  → Sender expects a specific handler
  → Exactly one handler
  → Can be rejected

QUERY: "Tell me something" (question)
  GetOrder, FindUser, ListProducts
  → Synchronous request-response
  → Returns data
  → Side-effect free

In practice:
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  Event: "OrderCreated"                       │
  │    → Payment subscribes: Process payment     │
  │    → Inventory subscribes: Reserve stock     │
  │    → Email subscribes: Send confirmation     │
  │    → Analytics subscribes: Track metrics     │
  │    → Loyalty subscribes: Add points          │
  │                                              │
  │  OrderService published ONE event.           │
  │  5 services reacted independently.           │
  │  OrderService has ZERO knowledge of them.    │
  │                                              │
  └──────────────────────────────────────────────┘
```

### Event Types

```
1. Domain Events (business facts)
   OrderPlaced, PaymentReceived, ItemShipped
   → Business meaning, consumed by business services

2. Integration Events (cross-service)
   UserCreated → sync user data to search index
   PriceChanged → update cached prices
   → Technical integration between systems

3. Notification Events (side effects)
   OrderPlaced → send email, push notification
   → Trigger side effects, non-critical

4. Change Data Capture Events (data changes)
   INSERT into orders table → OrderRowInserted
   → Database-level events, used for data sync
```

---

## Architecture Patterns

### Pattern 1: Event Bus (Simple Pub/Sub)

```
Central event bus (Kafka, RabbitMQ, SNS):

┌──────────┐
│  Order   │──▶ OrderCreated ──┐
│ Service  │                   │
└──────────┘                   ▼
                         ┌───────────┐
┌──────────┐             │  Event    │
│ Payment  │◀────────────│   Bus     │
│ Service  │             │  (Kafka)  │
└──────────┘             │           │
                         │           │
┌──────────┐             │           │
│ Email    │◀────────────│           │
│ Service  │             │           │
└──────────┘             │           │
                         │           │
┌──────────┐             │           │
│Analytics │◀────────────│           │
│ Service  │             └───────────┘
└──────────┘

Each service:
  - Publishes events about things IT did
  - Subscribes to events from OTHER services
  - Processes events independently
  - Fails independently (no cascading)
```

### Pattern 2: Event Sourcing

```
Instead of storing current state, store all events:

Traditional (state-based):
  orders table:
    id: 123, status: "shipped", total: $99.99

Event sourcing:
  order_events table:
    1. OrderCreated    { id: 123, items: [...], total: $99.99 }
    2. PaymentReceived { id: 123, amount: $99.99 }
    3. OrderConfirmed  { id: 123 }
    4. ItemPicked      { id: 123, warehouse: "WH-5" }
    5. OrderShipped    { id: 123, tracking: "FX123" }

  Current state = replay all events
  Like a bank account: balance = sum of all transactions

Benefits:
  ✅ Complete audit trail (every change recorded)
  ✅ Time travel (rebuild state at any point in time)
  ✅ Debug issues (replay events to reproduce bugs)
  ✅ New projections (build new views from existing events)

Costs:
  ❌ More complex to query (need projections)
  ❌ Event schema evolution is tricky
  ❌ Storage grows indefinitely (snapshots help)
  ❌ Eventual consistency (projections lag behind)
```

```
Event Store + Projections:

Events (write side):
  ┌─────────────────────────────────┐
  │ Event Store (append-only log)   │
  │                                 │
  │ [OrderCreated] [PaymentDone]    │
  │ [OrderShipped] [ItemReturned]   │
  └─────────────┬───────────────────┘
                │
        ┌───────┼───────────┐
        ▼       ▼           ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Orders   │ │ Revenue  │ │ Search   │
  │ View     │ │Dashboard │ │ Index    │
  │ (read)   │ │ (read)   │ │ (read)   │
  └──────────┘ └──────────┘ └──────────┘

  Each projection subscribes to events
  Builds its own optimized read model
  Can be rebuilt from scratch anytime
```

### Pattern 3: Choreography vs Orchestration

```
CHOREOGRAPHY: Services react to events independently
  (No central coordinator - like a jazz band)

  OrderCreated ──▶ PaymentService ──▶ PaymentProcessed
  PaymentProcessed ──▶ InventoryService ──▶ InventoryReserved
  InventoryReserved ──▶ ShippingService ──▶ OrderShipped

  Pros: Loose coupling, services are autonomous
  Cons: Hard to track flow, difficult error handling

ORCHESTRATION: Central coordinator manages the flow
  (Like a conductor leading an orchestra)

  ┌─────────────────────────┐
  │    Order Saga           │
  │    (Orchestrator)       │
  │                         │
  │ 1. → PaymentService     │
  │    ← PaymentDone        │
  │                         │
  │ 2. → InventoryService   │
  │    ← InventoryReserved  │
  │                         │
  │ 3. → ShippingService    │
  │    ← ShipmentCreated    │
  │                         │
  │ Error? Run compensations│
  └─────────────────────────┘

  Pros: Clear flow, easy error handling, visible state
  Cons: Orchestrator is a single point of control

When to use which:
  Simple flows (3-4 steps): Choreography
  Complex flows (5+ steps, error handling): Orchestration
  Mix: Choreography between bounded contexts,
       Orchestration within a bounded context
```

---

## Implementing Event-Driven Architecture

### Event Schema Design

```json
// Event envelope (standard wrapper)
{
  "eventId": "evt-a1b2c3d4",
  "eventType": "OrderCreated",
  "aggregateId": "order-123",
  "aggregateType": "Order",
  "timestamp": "2026-01-15T10:30:00Z",
  "version": 1,
  "source": "order-service",
  "correlationId": "req-x1y2z3",
  "metadata": {
    "userId": "user-456",
    "traceId": "trace-abc",
    "environment": "production"
  },
  "data": {
    "orderId": "order-123",
    "customerId": "cust-789",
    "items": [
      { "productId": "prod-1", "quantity": 2, "price": 29.99 }
    ],
    "total": 59.98,
    "currency": "USD"
  }
}
```

```
Event schema best practices:

1. Use past tense for event names
   ✅ OrderCreated, PaymentProcessed
   ❌ CreateOrder, ProcessPayment

2. Include all data needed by consumers
   Consumer shouldn't need to call back to the publisher
   ✅ { orderId, customerId, items, total }
   ❌ { orderId } (forces consumer to call Order API)

3. Version your events
   v1: { total: 59.98 }
   v2: { total: 59.98, currency: "USD", tax: 4.50 }
   Consumers handle both versions during migration

4. Use correlation IDs for tracing
   Same correlationId across the entire order flow
   OrderCreated → PaymentProcessed → InventoryReserved
   All share the same correlationId for debugging
```

### Event Consumer Patterns

```javascript
// Idempotent consumer (processes each event AT MOST once)
class PaymentConsumer {
  async handle(event) {
    // 1. Check if already processed
    const processed = await this.db.processedEvents.findOne({
      eventId: event.eventId
    });
    if (processed) {
      return; // Already handled, skip
    }

    // 2. Process the event
    if (event.eventType === 'OrderCreated') {
      const payment = await this.stripe.charge({
        amount: event.data.total,
        currency: event.data.currency,
        customerId: event.data.customerId
      });

      // 3. Record processing (same transaction as business logic)
      await this.db.transaction(async (tx) => {
        await tx.payments.create({
          orderId: event.data.orderId,
          stripeId: payment.id,
          amount: event.data.total
        });
        await tx.processedEvents.create({
          eventId: event.eventId,
          processedAt: new Date()
        });
      });

      // 4. Publish result event
      await this.eventBus.publish({
        eventType: 'PaymentProcessed',
        aggregateId: event.data.orderId,
        correlationId: event.correlationId,
        data: {
          orderId: event.data.orderId,
          paymentId: payment.id,
          amount: event.data.total
        }
      });
    }
  }
}
```

### Saga Pattern (Distributed Transactions)

```javascript
// Orchestration saga for order processing
class OrderSaga {
  constructor() {
    this.steps = [
      {
        action: 'processPayment',
        compensation: 'refundPayment'
      },
      {
        action: 'reserveInventory',
        compensation: 'releaseInventory'
      },
      {
        action: 'createShipment',
        compensation: 'cancelShipment'
      }
    ];
  }

  async execute(order) {
    const completedSteps = [];

    for (const step of this.steps) {
      try {
        const result = await this[step.action](order);
        completedSteps.push({ step, result });
      } catch (error) {
        // Step failed → compensate all completed steps (reverse order)
        for (const completed of completedSteps.reverse()) {
          try {
            await this[completed.step.compensation](order, completed.result);
          } catch (compError) {
            // Log compensation failure for manual intervention
            await this.alertOps(order, completed.step, compError);
          }
        }
        throw new SagaFailedError(step.action, error);
      }
    }

    await this.eventBus.publish({
      eventType: 'OrderCompleted',
      data: { orderId: order.id }
    });
  }

  async processPayment(order) {
    return await this.paymentService.charge(order);
  }

  async refundPayment(order, paymentResult) {
    return await this.paymentService.refund(paymentResult.paymentId);
  }

  async reserveInventory(order) {
    return await this.inventoryService.reserve(order.items);
  }

  async releaseInventory(order, reserveResult) {
    return await this.inventoryService.release(reserveResult.reservationId);
  }
}
```

---

## Event Infrastructure

### Event Store Options

```
Apache Kafka:
  - De facto standard for event streaming
  - Durable, ordered, replayable
  - High throughput (millions/sec)
  - Consumer groups for parallel processing
  Best for: Event streaming, high volume

EventStoreDB:
  - Purpose-built for event sourcing
  - Projections built-in
  - Subscriptions and catch-up
  - Optimistic concurrency
  Best for: Event sourcing, domain events

AWS EventBridge:
  - Serverless event bus
  - Schema registry built-in
  - Rule-based routing
  - Cross-account events
  Best for: AWS-native, serverless architectures

NATS / NATS JetStream:
  - Lightweight, high performance
  - JetStream adds persistence
  - Simple protocol
  Best for: Edge computing, IoT, microservices
```

### Schema Registry

```
Problem: Event schema changes break consumers

v1: { "orderId": "123", "amount": 99.99 }
v2: { "orderId": "123", "amount": 99.99, "currency": "USD" }
v3: { "orderId": "123", "total": { "amount": 99.99, "currency": "USD" } }

Schema Registry enforces compatibility:

┌──────────┐     ┌────────────────┐     ┌──────────┐
│ Producer │────▶│Schema Registry │────▶│  Kafka   │
│          │     │                │     │          │
│ Validates│     │ Checks:        │     │ Stores   │
│ schema   │     │ - Compatible?  │     │ events   │
│ before   │     │ - Valid format?│     │          │
│ publish  │     │ - Registered?  │     │          │
└──────────┘     └────────────────┘     └──────────┘

Compatibility modes:
  BACKWARD: New schema can read old events ✅
  FORWARD: Old consumers can read new events ✅
  FULL: Both directions compatible ✅ (recommended)

Rules:
  ✅ Add optional fields (backward compatible)
  ✅ Add fields with defaults (backward compatible)
  ❌ Remove required fields (breaks old consumers)
  ❌ Rename fields (breaks everything)
  ❌ Change field types (breaks everything)
```

---

## Eventual Consistency

### Embracing Eventual Consistency

```
Event-driven systems are eventually consistent by nature:

1. OrderService saves order (status: PENDING)
2. Publishes OrderCreated event
3. PaymentService processes payment (takes 2 seconds)
4. PaymentService publishes PaymentProcessed
5. OrderService receives event, updates status: CONFIRMED

Between step 2 and 5 (2+ seconds):
  OrderService: status = PENDING
  PaymentService: payment = COMPLETE
  State is INCONSISTENT (but temporarily)

This is fine! Users see: "Processing your order..."
Then: "Order confirmed!" (once consistent)
```

### Patterns for Handling Eventual Consistency

```
1. Optimistic UI
   Show success immediately, update if it fails
   "Order placed!" → background processing → "Confirmed!"

2. Polling / WebSocket
   Client polls for status updates
   Or server pushes via WebSocket when state changes

3. Read Your Own Writes
   After writing, read from same source (not replica)
   Ensures user sees their own changes immediately

4. Compensation
   If eventual state is wrong, fix it
   Double charge? Issue automatic refund
   Oversold? Cancel and notify customer
```

---

## Real-World Example: Uber

```
Uber's Event-Driven Architecture:

Trip lifecycle as events:

  DriverAvailable → RideRequested → DriverMatched
  → DriverEnRoute → DriverArrived → TripStarted
  → TripCompleted → PaymentProcessed → DriverPaid

Each event triggers multiple reactions:

TripCompleted:
  ├── PaymentService → charges rider
  ├── PricingService → calculates surge
  ├── ETAService → updates ETA model
  ├── FraudService → checks for anomalies
  ├── AnalyticsService → updates metrics
  ├── NotificationService → notifies rider+driver
  └── ReceiptService → generates receipt

Infrastructure:
  - Apache Kafka: 1 trillion+ messages/day
  - 4,000+ topics
  - Event sourcing for trip state
  - Choreography between services
  - Saga for payment flow (orchestrated)
```

---

## Common Mistakes

### 1. Event as Remote Procedure Call

```
❌ Publishing events that are actually commands:
   Event: "SendEmailToUser123"
   → This is a command disguised as an event
   → Creates hidden coupling

✅ Publish facts, let consumers decide what to do:
   Event: "OrderShipped"
   → EmailService decides to send a shipping notification
   → SMSService decides to send tracking link
   → Publisher doesn't know or care
```

### 2. Putting Too Much in One Event

```
❌ Giant events with everything:
   OrderCreated: { order, customer, products, pricing,
     inventory, shipping, recommendations, ... }
   10KB per event × 1M events = 10GB/day of bloat

✅ Include what consumers need, reference the rest:
   OrderCreated: { orderId, customerId, items, total }
   Consumer needs customer details? Call Customer API
   (Or subscribe to CustomerCreated events for local cache)
```

### 3. No Dead Letter Queue

```
❌ Consumer fails → message lost or retried forever

✅ Max retries → Dead Letter Queue → alert → manual fix
   Every event consumer needs a DLQ strategy
```

### 4. Ignoring Event Ordering

```
❌ Processing OrderShipped before OrderCreated
   Out-of-order events break business logic

✅ Use partition keys (same entity → same partition)
   Order events partitioned by orderId
   All events for order-123 are in order
```

---

## Key Takeaways

```
1. Events decouple services
   Publishers don't know about subscribers
   Add new services without changing existing ones

2. Use events for facts, commands for requests
   "OrderCreated" (event) vs "ProcessPayment" (command)
   Events = past tense, Commands = imperative

3. Event sourcing is powerful but complex
   Complete audit trail and time travel
   Use it where audit trails matter (finance, healthcare)
   Don't use it everywhere

4. Choreography for simple flows, orchestration for complex
   3-4 steps: let services react to events
   5+ steps with error handling: use a saga orchestrator

5. Every consumer must be idempotent
   Events will be delivered at least once
   Design for duplicate processing

6. Schema evolution requires planning
   Use a schema registry
   Only make backward-compatible changes
   Version your events

7. Eventual consistency is a feature, not a bug
   Design UIs for optimistic updates
   Use polling/WebSocket for status updates
   Compensation for error correction
```
