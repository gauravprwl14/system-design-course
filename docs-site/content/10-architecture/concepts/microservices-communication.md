---
title: Microservices Communication
layer: solution
section: system-design/patterns
difficulty: intermediate
prerequisites:
  - system-design/scalability/microservices-architecture
  - system-design/queues/message-queue-basics
solves_with: []
related_problems:
  - problems-at-scale/availability/cascading-failures
  - problems-at-scale/availability/timeout-domino-effect
  - problems-at-scale/performance/thread-pool-exhaustion
case_studies: []
see_poc:
  - interview-prep/practice-pocs/grpc-protocol-buffers
  - interview-prep/practice-pocs/rest-api-best-practices
  - interview-prep/practice-pocs/kafka-basics-producer-consumer
  - interview-prep/practice-pocs/service-discovery
linked_from:
  - 12-interview-prep/system-design/fundamentals/api-design-rest-graphql-grpc
  - 12-interview-prep/system-design/scale-and-reliability/distributed-tracing
  - >-
    12-interview-prep/system-design/scale-and-reliability/monolith-to-microservices
  - 12-interview-prep/system-design/scale-and-reliability/service-discovery
tags:
  - microservices
  - grpc
  - rest
  - async
  - event-driven
  - communication
---

# Microservices Communication - Choose Wrong, Pay Forever

> **TL;DR:** Synchronous (REST/gRPC) for queries, asynchronous (events) for commands. Mix them wrong and watch your system crumble at 3 AM.

## 🗺️ Quick Overview

```mermaid
graph LR
    subgraph "Synchronous (query)"
        A["Service A"] -- "REST / gRPC\nwaits for reply" --> B["Service B"]
        B -- "response" --> A
    end
    subgraph "Asynchronous (command)"
        C["Service C"] -- "publish event" --> Q["Message Bus\nKafka / RabbitMQ"]
        Q -- "consume" --> D["Service D"]
        Q -- "consume" --> E["Service E"]
    end
```

*Microservices communicate synchronously (REST/gRPC) when the caller needs an immediate answer, and asynchronously (events) when the caller only needs to trigger work — choosing wrong couples services and turns one slowdown into a site-wide outage.*

## The $50M Architecture Mistake

**2019, Major E-commerce Platform:**

```
Original architecture: 200 microservices, ALL synchronous REST
Black Friday result:
├── 10:00 AM: Traffic 5x normal
├── 10:15 AM: Payment service slow (3s → 30s)
├── 10:20 AM: Checkout blocked waiting for payment
├── 10:25 AM: Cart service blocked waiting for checkout
├── 10:30 AM: Product service blocked waiting for cart
├── 10:35 AM: ENTIRE SITE DOWN (cascading failure)
├── Recovery time: 4 hours
└── Estimated loss: $50M+ in sales

Root cause: Synchronous chain of 8 services
One slow service = everything fails
```

**The fix that saved next Black Friday:**
```
After re-architecture:
├── Queries: Synchronous (read product, check price)
├── Commands: Asynchronous (place order, process payment)
├── Result: Payment delays don't block browsing
└── Black Friday 2020: Zero downtime
```

---

## Communication Patterns Overview

```
SYNCHRONOUS (Request-Response):
┌─────────┐    Request    ┌─────────┐
│Service A│──────────────▶│Service B│
│         │◀──────────────│         │
└─────────┘    Response   └─────────┘

Characteristics:
- Caller waits for response
- Tight coupling
- Simple to understand
- Cascading failures risk

ASYNCHRONOUS (Event-Driven):
┌─────────┐    Event     ┌─────────────┐    Event    ┌─────────┐
│Service A│─────────────▶│Message Queue│────────────▶│Service B│
└─────────┘              └─────────────┘             └─────────┘
     │                                                    │
     └── Continues immediately                 Processes when ready

Characteristics:
- Fire and forget
- Loose coupling
- Complex to debug
- Resilient to failures
```

---

## Pattern 1: REST (Synchronous)

### When to Use
- Simple CRUD operations
- Real-time data requirements
- Public APIs
- Small-scale systems

### Implementation

```javascript
// ❌ WRONG: Long synchronous chain
async function placeOrder(order) {
  // Each call blocks until response
  const inventory = await fetch('http://inventory/check', { body: order });
  const payment = await fetch('http://payment/charge', { body: order });
  const shipping = await fetch('http://shipping/schedule', { body: order });
  const notification = await fetch('http://notification/send', { body: order });

  // If ANY service is slow, entire request is slow
  // If ANY service fails, entire request fails
  return { success: true };
}

// ✅ CORRECT: Parallel where possible + timeouts
async function placeOrderBetter(order) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Parallel independent calls
    const [inventory, userCredit] = await Promise.all([
      fetchWithTimeout('http://inventory/check', order, 2000),
      fetchWithTimeout('http://payment/verify', order, 2000)
    ]);

    if (!inventory.available || !userCredit.sufficient) {
      return { success: false, reason: 'Validation failed' };
    }

    // Only essential sync call
    const payment = await fetchWithTimeout('http://payment/charge', order, 5000);

    // Non-essential async (fire and forget)
    fetch('http://notification/send', { body: order }).catch(() => {});

    return { success: true, orderId: payment.orderId };
  } finally {
    clearTimeout(timeout);
  }
}
```

### REST Best Practices

```yaml
Design principles:
  - Timeout everything: 2-5 seconds max
  - Circuit breakers: Fail fast when downstream is unhealthy
  - Retry with backoff: Don't hammer failing services
  - Bulkheads: Isolate failure domains

Anti-patterns to avoid:
  - Long synchronous chains (> 3 services)
  - No timeouts (waiting forever)
  - Retry storms (immediate retries)
  - Shared databases (defeats microservices purpose)
```

---

## Pattern 2: gRPC (Synchronous, High Performance)

### When to Use
- Internal service-to-service communication
- High throughput requirements
- Streaming data
- Polyglot environments

### Comparison: REST vs gRPC

| Aspect | REST | gRPC |
|--------|------|------|
| Protocol | HTTP/1.1 (text) | HTTP/2 (binary) |
| Payload | JSON | Protocol Buffers |
| Performance | Slower | 2-10x faster |
| Streaming | Limited | Native support |
| Browser support | Native | Requires proxy |
| Schema | Optional (OpenAPI) | Required (protobuf) |

### Implementation

```protobuf
// order.proto
syntax = "proto3";

service OrderService {
  rpc PlaceOrder(OrderRequest) returns (OrderResponse);
  rpc StreamOrderUpdates(OrderId) returns (stream OrderUpdate);
}

message OrderRequest {
  string user_id = 1;
  repeated OrderItem items = 2;
}

message OrderResponse {
  string order_id = 1;
  OrderStatus status = 2;
}
```

```javascript
// gRPC client with deadline
const client = new OrderServiceClient('orders:50051');

async function placeOrder(order) {
  const deadline = new Date();
  deadline.setSeconds(deadline.getSeconds() + 5); // 5 second timeout

  return new Promise((resolve, reject) => {
    client.placeOrder(order, { deadline }, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}
```

---

## Pattern 3: Event-Driven (Asynchronous)

### When to Use
- Commands that don't need immediate response
- Decoupled services
- High scalability requirements
- Event sourcing / CQRS

### The Event-Driven Mental Model

```
CHOREOGRAPHY (Events):
┌─────────────┐
│ Order       │──OrderPlaced──▶┌──────────────┐
│ Service     │                │ Message Bus  │
└─────────────┘                └──────┬───────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│   Inventory  │             │   Payment    │             │ Notification │
│   Service    │             │   Service    │             │   Service    │
└──────────────┘             └──────────────┘             └──────────────┘
        │                             │                             │
        ▼                             ▼                             ▼
 InventoryReserved              PaymentCharged               EmailSent

Benefits:
- Services don't know about each other
- Add new consumers without changing producers
- Failure isolation
```

### Implementation

```javascript
// Publisher (Order Service)
async function placeOrder(order) {
  // 1. Save order locally (immediate)
  const savedOrder = await db.orders.create({
    ...order,
    status: 'PENDING'
  });

  // 2. Publish event (async, fire-and-forget)
  await kafka.send({
    topic: 'orders',
    messages: [{
      key: savedOrder.id,
      value: JSON.stringify({
        type: 'ORDER_PLACED',
        orderId: savedOrder.id,
        userId: order.userId,
        items: order.items,
        timestamp: Date.now()
      })
    }]
  });

  // 3. Return immediately (don't wait for downstream)
  return { orderId: savedOrder.id, status: 'PENDING' };
}

// Consumer (Inventory Service)
async function handleOrderPlaced(event) {
  const { orderId, items } = event;

  try {
    // Reserve inventory
    await db.transaction(async (trx) => {
      for (const item of items) {
        await trx.inventory
          .where('product_id', item.productId)
          .decrement('available', item.quantity);
      }
    });

    // Emit success event
    await kafka.send({
      topic: 'inventory',
      messages: [{
        key: orderId,
        value: JSON.stringify({
          type: 'INVENTORY_RESERVED',
          orderId,
          timestamp: Date.now()
        })
      }]
    });
  } catch (error) {
    // Emit failure event
    await kafka.send({
      topic: 'inventory',
      messages: [{
        key: orderId,
        value: JSON.stringify({
          type: 'INVENTORY_FAILED',
          orderId,
          reason: error.message,
          timestamp: Date.now()
        })
      }]
    });
  }
}
```

---

## Pattern 4: Saga Pattern (Distributed Transactions)

### The Problem

```
Traditional transaction (single DB):
BEGIN TRANSACTION
  debit_account(A, $100)
  credit_account(B, $100)
COMMIT  -- All or nothing

Microservices (multiple DBs):
Order Service DB     Payment Service DB     Inventory Service DB
      │                      │                       │
      └──────── No single transaction possible ──────┘

What if payment succeeds but inventory fails?
```

### Saga Solution

```
SAGA: Sequence of local transactions with compensating actions

Happy path:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Create  │───▶│ Reserve │───▶│ Charge  │───▶│  Ship   │
│ Order   │    │Inventory│    │ Payment │    │ Order   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘

Failure path (payment fails):
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Create  │───▶│ Reserve │───▶│ Charge  │──X (fails)
│ Order   │    │Inventory│    │ Payment │
└─────────┘    └─────────┘    └─────────┘
                    │                │
                    ▼                │
            ┌──────────────┐        │
            │   Release    │◀───────┘ (compensate)
            │  Inventory   │
            └──────────────┘
```

### Implementation (Orchestrator Pattern)

```javascript
// Saga Orchestrator
class OrderSaga {
  constructor(orderId) {
    this.orderId = orderId;
    this.steps = [];
  }

  async execute() {
    const completedSteps = [];

    try {
      // Step 1: Reserve Inventory
      await this.reserveInventory();
      completedSteps.push('inventory');

      // Step 2: Charge Payment
      await this.chargePayment();
      completedSteps.push('payment');

      // Step 3: Schedule Shipping
      await this.scheduleShipping();
      completedSteps.push('shipping');

      // Step 4: Confirm Order
      await this.confirmOrder();

      return { success: true };

    } catch (error) {
      // Compensate in reverse order
      await this.compensate(completedSteps);
      return { success: false, error: error.message };
    }
  }

  async compensate(completedSteps) {
    for (const step of completedSteps.reverse()) {
      try {
        switch (step) {
          case 'shipping':
            await this.cancelShipping();
            break;
          case 'payment':
            await this.refundPayment();
            break;
          case 'inventory':
            await this.releaseInventory();
            break;
        }
      } catch (compensationError) {
        // Log for manual intervention
        console.error(`Compensation failed for ${step}:`, compensationError);
        await this.alertOps(step, compensationError);
      }
    }
  }
}
```

---

## Decision Framework

### When to Use What

```
┌────────────────────────────────────────────────────────────┐
│                  COMMUNICATION PATTERN SELECTION           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Need immediate response?                                  │
│       │                                                    │
│       ├── YES ──▶ Is it a query (read)?                   │
│       │              │                                     │
│       │              ├── YES ──▶ REST or gRPC             │
│       │              │                                     │
│       │              └── NO (command) ──▶ Consider async  │
│       │                   with sync acknowledgment         │
│       │                                                    │
│       └── NO ──▶ Event-driven (Kafka, RabbitMQ)           │
│                                                            │
│  High throughput internal?                                 │
│       │                                                    │
│       ├── YES ──▶ gRPC                                    │
│       └── NO ──▶ REST                                     │
│                                                            │
│  Need distributed transaction?                             │
│       │                                                    │
│       └── YES ──▶ Saga pattern                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Quick Reference

| Scenario | Pattern | Example |
|----------|---------|---------|
| Get product details | REST/gRPC sync | `GET /products/123` |
| Place order | Event + sync ack | Return orderId, process async |
| Real-time dashboard | gRPC streaming | Stock prices |
| User signup | Event-driven | Welcome email, analytics |
| Money transfer | Saga | Debit → Credit with rollback |
| Service mesh | gRPC | Internal high-volume calls |

---

## Anti-Patterns to Avoid

### 1. Distributed Monolith

```
❌ WRONG: Microservices that can't deploy independently
┌─────────┐     ┌─────────┐     ┌─────────┐
│Service A│────▶│Service B│────▶│Service C│
└─────────┘     └─────────┘     └─────────┘
     │               │               │
     └───────────────┴───────────────┘
              Shared Database

Result: All the complexity of microservices,
        none of the benefits
```

### 2. Chatty Services

```
❌ WRONG: Multiple calls for one operation
for (item in order.items) {
  await fetch(`http://inventory/check/${item.id}`);  // N calls!
}

✅ CORRECT: Batch operations
await fetch('http://inventory/check-batch', {
  body: order.items.map(i => i.id)
});
```

### 3. No Timeouts

```
❌ WRONG: Wait forever
const response = await fetch('http://slow-service/api');

✅ CORRECT: Always timeout
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
const response = await fetch('http://slow-service/api', {
  signal: controller.signal
});
```

---

## Real-World Examples

### Netflix

```
Pattern: Event-driven + sync for critical path
- Playback start: Sync (must work)
- Recommendations: Async (can be stale)
- Analytics: Event-driven (fire and forget)
- Result: 200M+ users, high availability
```

### Uber

```
Pattern: gRPC internal + events for dispatch
- Driver location: gRPC streaming
- Ride matching: Event-driven
- Payment: Saga pattern
- Result: Millions of rides/day
```

### Amazon

```
Pattern: Heavy event-driven
- Order placement: Event → queued processing
- Inventory: Eventually consistent
- "1-Click" separation: Different bounded contexts
- Result: Handles Prime Day traffic
```

---

## 🎯 Interview Questions

### Common Interview Questions on Microservices Communication

#### Q1: When do you choose REST over gRPC for inter-service communication? Give concrete examples.
**What interviewers look for**: Understanding that it's not just about performance — protocol choice affects debugging, ecosystem fit, team skill, and browser compatibility.

**Answer framework**:
1. **REST for external/public APIs**: Browser clients can't call gRPC natively without a proxy; REST with JSON is universally tooled (Postman, curl, browser DevTools); webhook payloads and third-party integrations expect JSON.
2. **gRPC for internal high-throughput**: Protobuf binary is 2–10x smaller and faster than JSON; HTTP/2 multiplexing means hundreds of concurrent streams over one connection; bidirectional streaming for real-time feeds (driver location, live metrics).
3. **Practical factors**: gRPC requires schema management (proto files) which adds coordination overhead; REST is easier to debug with raw HTTP tools; many teams start with REST and add gRPC only for proven hot paths.

**Key numbers to mention**: gRPC is 5–10x faster than REST for high-throughput internal calls; proto serialization is 3–5x smaller than JSON; Uber uses gRPC for internal RPC handling millions of driver-location updates/sec; Google uses gRPC for almost all internal services; REST JSON adds ~30% overhead vs. binary for the same payload.

---

#### Q2: Describe the event-driven choreography vs. orchestration pattern. What are the trade-offs?
**What interviewers look for**: Ability to articulate the debugging and coupling implications, not just the surface-level description.

**Answer framework**:
1. **Choreography** (services react to events independently): Each service listens to events and publishes its own; no central coordinator; services are fully decoupled and can be added/removed without changing others; debugging requires tracing events across multiple topics.
2. **Orchestration** (central saga controller directs steps): One orchestrator calls each service in sequence and handles compensation; single place to see the workflow state; easier to debug and change flow; orchestrator becomes a coupling point.
3. **Decision rule**: Choreography for simple fan-out (≤3 steps, no complex rollback); orchestration for complex business processes (>3 steps, compensation logic, audit requirements) — Uber Cadence/Temporal are popular orchestration engines.

**Key numbers to mention**: Netflix uses choreography for analytics pipelines (simple fan-out); Amazon uses orchestrated sagas for multi-step order workflows; Temporal handles 10M+ workflow executions/day; typical choreography event processing adds 10–50ms vs. direct call; orchestration adds 1 hop but gives full auditability.

---

#### Q3: A synchronous REST call chain is causing cascading failures. How would you diagnose and fix it?
**What interviewers look for**: Structured debugging approach + concrete architectural remediation, not just "add a circuit breaker".

**Answer framework**:
1. **Diagnose**: Use distributed tracing (Jaeger/Zipkin) to identify the slowest span in the chain; check thread pool metrics for exhaustion; look for the first service whose P99 latency spiked — that's the root cause.
2. **Immediate mitigation**: Add timeouts (2–5 seconds) to every HTTP call; add circuit breakers so downstream failures fail fast; add bulkheads (separate thread pools per downstream dependency) to prevent one slow service from blocking all others.
3. **Architectural fix**: Identify which calls in the chain are truly synchronous requirements vs. fire-and-forget; move non-essential calls (notifications, analytics, audit logs) to async events; parallelize independent sync calls with `Promise.all()` to cut total latency from sum to max.

**Key numbers to mention**: Without timeouts, a 30s slow service exhausts a 200-thread pool in ~60 seconds; circuit breaker with 50% error threshold at 10 req minimum; bulkhead: 30 threads max per downstream dependency; parallelizing 3 independent 50ms calls reduces total latency from 150ms to 50ms; the Black Friday example: 8-service sync chain → $50M loss.

---

#### Q4: How do you ensure exactly-once processing in an event-driven microservices system?
**What interviewers look for**: Understanding that exactly-once is very hard; at-least-once + idempotency is the practical standard.

**Answer framework**:
1. **At-least-once delivery is the default**: Kafka guarantees at-least-once delivery; consumers can receive the same event twice on retry, rebalance, or crash recovery — design consumers to be idempotent.
2. **Idempotency key pattern**: Include a unique `eventId` or `messageId` in every event; consumer tracks processed IDs (in a DB or Redis `SETNX`); if the ID exists, skip processing and acknowledge the message — deduplication window of 24 hours covers all reasonable retry scenarios.
3. **Transactional outbox for producer reliability**: Instead of publishing to Kafka directly in application code (which can fail after DB write), write to an `outbox` table in the same transaction; a separate relay process reads and publishes — guarantees the event is always published if the DB commit succeeded.

**Key numbers to mention**: Kafka default delivery: at-least-once; Kafka exactly-once semantics (EOS) available but adds ~20% throughput overhead; Redis `SETNX` deduplication adds ~1ms per event; transactional outbox delay is typically <100ms; idempotency key storage TTL of 24 hours handles 99.99% of retry scenarios.

---

#### Q5: How would you implement the Saga pattern for an order placement flow involving inventory, payment, and shipping?
**What interviewers look for**: Concrete sequence design including the compensation steps, not just a high-level description.

**Answer framework**:
1. **Happy path sequence**: Create order (PENDING) → Reserve inventory → Charge payment → Schedule shipping → Update order (CONFIRMED); each step publishes an event that triggers the next.
2. **Compensation chain** (payment fails): Publish `PaymentFailed` → Inventory service receives event, releases reservation → Order service receives event, marks order CANCELLED; compensations must be idempotent (release an already-released reservation should be a no-op).
3. **Idempotency and locking**: Use a saga state machine with persistent state (DB); if the orchestrator crashes mid-saga, replay from the last recorded state; use optimistic locking on inventory (`UPDATE inventory SET reserved = reserved + qty WHERE available >= qty`) to prevent race conditions.

**Key numbers to mention**: Compensation transactions must be idempotent and complete within SLA (typically <5 seconds per step); saga state should be persisted in durable storage (not in-memory); max saga duration should be bounded (e.g., 30 minutes — after which alert and compensate); Amazon processes millions of order sagas/day with <0.001% requiring manual intervention.

---

#### Q6: What is the "distributed monolith" anti-pattern and how do you avoid it?
**What interviewers look for**: Recognition that microservices without proper boundaries are worse than a monolith — all the operational complexity, none of the deployment independence.

**Answer framework**:
1. **Symptoms**: Services that must deploy together (tight coupling via shared library versions or synchronous call expectations); services that share a database schema; long synchronous chains of 5+ services where one failure takes down the whole request.
2. **Root cause**: Incorrect decomposition — splitting by technical layer (UserController, UserRepository, UserService) instead of by business capability (OrderDomain, PaymentDomain); or premature decomposition before domain boundaries are understood.
3. **Fixes**: Apply domain-driven design to find bounded contexts; enforce "database per service" strictly; replace synchronous chains with async events; test independent deployability in CI (deploy Service A alone and run its full test suite).

**Key numbers to mention**: A distributed monolith has 3x the operational complexity of a monolith with zero of the deployment benefits; 60% of teams that adopt microservices without DDD end up with distributed monoliths (Martin Fowler); independent deployment test: if changing Service A requires testing Service B, you have a distributed monolith; chatty services (>5 calls per request) is a smell.

---

#### Q7: How do you handle schema evolution in event-driven systems where multiple consumers depend on event structure?
**What interviewers look for**: Forward and backward compatibility strategies for Kafka/event schemas — a common operational challenge at scale.

**Answer framework**:
1. **Schema registry with compatibility rules**: Use Confluent Schema Registry (or AWS Glue) with `BACKWARD` compatibility mode — new schema must be able to read old messages; consumers don't need to be updated before producers.
2. **Additive-only changes**: Add new fields as optional with defaults; never remove or rename fields (use deprecation markers instead); never change field types; version the event type name only for truly breaking changes (`order.placed.v2`).
3. **Consumer-side tolerance**: Use the "robustness principle" — consumers should ignore unknown fields; producer can add new fields without breaking consumers; maintain two event versions in parallel during migration (produce both, consume the new one, deprecate old after all consumers migrate).

**Key numbers to mention**: Confluent Schema Registry supports BACKWARD, FORWARD, and FULL compatibility modes; Avro/Protobuf support schema evolution natively; JSON Schema requires manual enforcement; Kafka topic retention of 7 days allows consumers to replay if they miss an event; deprecation window should be ≥30 days with consumer lag monitoring.

---

## Key Takeaways

### The Golden Rules

```
1. QUERIES = Synchronous (REST/gRPC)
   - Need the data now
   - Can cache results
   - Timeout aggressively

2. COMMANDS = Asynchronous (Events)
   - Don't need immediate result
   - Should be idempotent
   - Use saga for transactions

3. ALWAYS
   - Set timeouts
   - Use circuit breakers
   - Make operations idempotent
   - Design for failure
```

### Migration Path

```
Monolith → Microservices:
1. Start with REST (simple, familiar)
2. Add events for cross-cutting concerns
3. Move to gRPC for high-volume internal
4. Implement sagas as needed

Don't start with events everywhere!
```

---

## Related Content

- [Kafka vs RabbitMQ](/04-messaging/concepts/kafka-vs-rabbitmq)
- [Circuit Breaker Pattern](/10-architecture/concepts/circuit-breaker)
- [Timeouts & Backpressure](/10-architecture/concepts/timeouts-backpressure)
- [Idempotency](/07-api-design/concepts/idempotency)
- [Monolith to Microservices Interview Prep](/12-interview-prep/system-design/scale-and-reliability/monolith-to-microservices)
- [API Design: REST, GraphQL, gRPC Interview Prep](/12-interview-prep/system-design/fundamentals/api-design-rest-graphql-grpc)
