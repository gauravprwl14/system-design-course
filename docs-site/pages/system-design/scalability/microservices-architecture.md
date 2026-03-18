---
title: Microservices Architecture
layer: concept
section: system-design/scalability
difficulty: intermediate
prerequisites:
  - system-design/scalability/scaling-basics
  - system-design/queues/message-queue-basics
solves_with: []
related_problems:
  - problems-at-scale/availability/cascading-failures
  - problems-at-scale/performance/thread-pool-exhaustion
  - problems-at-scale/consistency/message-out-of-order
case_studies:
  - system-design/case-studies/netflix
  - system-design/case-studies/uber-backend
see_poc:
  - interview-prep/practice-pocs/service-discovery
  - interview-prep/practice-pocs/contract-testing
  - interview-prep/practice-pocs/integration-testing
  - interview-prep/practice-pocs/health-check-patterns
linked_from:
  - interview-prep/practice-pocs/circuit-breaker
  - interview-prep/practice-pocs/contract-testing
  - interview-prep/practice-pocs/distributed-tracing
  - interview-prep/practice-pocs/feature-flags
  - interview-prep/practice-pocs/integration-testing
  - interview-prep/practice-pocs/redis-distributed-lock
  - interview-prep/practice-pocs/saga-pattern
  - interview-prep/practice-pocs/service-discovery
  - interview-prep/system-design/api-design-rest-graphql-grpc
  - interview-prep/system-design/api-gateway-pattern
  - interview-prep/system-design/circuit-breaker-pattern
  - interview-prep/system-design/distributed-tracing
  - interview-prep/system-design/kubernetes-basics
  - interview-prep/system-design/monolith-to-microservices
  - interview-prep/system-design/observability-monitoring
  - interview-prep/system-design/saga-pattern
  - interview-prep/system-design/service-discovery
  - problems-at-scale/availability/cascading-failures
  - problems-at-scale/availability/timeout-domino-effect
  - problems-at-scale/scalability/memory-leak-long-running
  - system-design/api-design/idempotency
  - system-design/api-design/rest-graphql-grpc
  - system-design/case-studies/google-drive
  - system-design/case-studies/netflix
  - system-design/case-studies/notification-system
  - system-design/case-studies/spotify
  - system-design/case-studies/uber-backend
  - system-design/case-studies/unique-id-generator
  - system-design/consistency/distributed-consensus
  - system-design/monitoring/observability-slos
  - system-design/patterns/circuit-breaker
  - system-design/patterns/microservices-communication
  - system-design/patterns/timeouts-backpressure
  - system-design/scalability/chaos-engineering
  - system-design/scalability/cqrs
  - system-design/scalability/event-driven-architecture
tags:
  - microservices
  - architecture
  - distributed-systems
  - service-mesh
---

# Microservices Architecture - Breaking the Monolith

> **Reading Time:** 25 minutes
> **Difficulty:** Intermediate
> **Impact:** The architecture pattern behind Netflix, Uber, and Amazon at scale

## The Monolith Problem

**Your startup built a monolith. It worked great. Until it didn't.**

```
Year 1 (5 engineers):
┌─────────────────────────────────┐
│          Monolith               │
│  Auth + Orders + Payments +     │
│  Notifications + Search +       │
│  Recommendations                │
│                                 │
│  Deploy: 5 minutes              │
│  Team: Everyone knows everything│
│  Bugs: Easy to trace            │
└─────────────────────────────────┘
Status: ✅ Perfect choice

Year 3 (50 engineers):
┌─────────────────────────────────┐
│          MEGA Monolith          │
│  2M lines of code               │
│  45 minute builds               │
│  Deploy: 4 hours (with prayer)  │
│  Merge conflicts: Daily         │
│  "Who owns this code?": Nobody  │
│  One bug crashes everything     │
└─────────────────────────────────┘
Status: ❌ Burning dumpster fire
```

**Real numbers from companies that hit this wall:**

```
Amazon (2002): Monolith → 2-pizza teams with services
  - Deployment time: Hours → Minutes
  - Team autonomy: Zero → Full ownership

Netflix (2009): Monolith → 700+ microservices
  - Outage frequency: Weekly → Rare
  - Deploy frequency: Weekly → Thousands/day

Uber (2014): Monolith → 2,200+ microservices
  - Team count: 1 → 200+ independent teams
  - Feature velocity: 10x increase
```

---

## What Are Microservices (Really)?

### It's NOT Just "Small Services"

```
Common misconception:
"Microservices = breaking code into smaller pieces"

Reality:
"Microservices = organizing teams and systems around
 business capabilities with independent deployment"
```

### The Key Properties

```
1. Single Responsibility
   Each service owns ONE business capability
   ✅ OrderService - manages orders
   ❌ OrderAndPaymentAndNotificationService

2. Independent Deployment
   Deploy OrderService without touching PaymentService
   ✅ "I deployed 3 times today, nobody noticed"
   ❌ "We need to coordinate with 5 teams to deploy"

3. Own Their Data
   Each service has its own database
   ✅ OrderService → orders_db
   ❌ All services → shared_mega_db

4. Technology Agnostic
   OrderService (Java) talks to PaymentService (Go)
   via well-defined APIs

5. Failure Isolation
   PaymentService down ≠ Search is down
   (Unlike a monolith where everything crashes together)
```

---

## Service Decomposition: How to Split

### Strategy 1: Decompose by Business Capability

```
E-commerce platform:

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Product    │  │    Order     │  │   Payment    │
│   Catalog    │  │  Management  │  │  Processing  │
│              │  │              │  │              │
│ - Search     │  │ - Cart       │  │ - Checkout   │
│ - Browse     │  │ - Checkout   │  │ - Refunds    │
│ - Reviews    │  │ - History    │  │ - Invoices   │
│ - Inventory  │  │ - Tracking   │  │ - Fraud      │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
  product_db         orders_db         payments_db
```

### Strategy 2: Decompose by Subdomain (DDD)

```
Domain-Driven Design approach:

Core Domain (competitive advantage):
├── Recommendation Engine
├── Search & Personalization
└── Pricing Strategy

Supporting Domain (necessary but not differentiating):
├── Order Management
├── Inventory
└── Shipping

Generic Domain (buy, don't build):
├── Authentication (Auth0)
├── Email (SendGrid)
└── Payment Processing (Stripe)
```

### Strategy 3: Strangler Fig Pattern (Migration)

```
Gradual migration from monolith:

Phase 1: Identify boundaries
┌─────────────────────────────┐
│         Monolith            │
│  [Auth] [Orders] [Payments] │
│  [Search] [Notifications]   │
└─────────────────────────────┘

Phase 2: Extract one service
┌─────────────────────────┐     ┌──────────────┐
│       Monolith          │     │ Notification │
│  [Auth] [Orders]        │────▶│   Service    │
│  [Payments] [Search]    │     │  (extracted) │
└─────────────────────────┘     └──────────────┘

Phase 3: Continue extracting
┌───────────────┐  ┌──────────┐  ┌──────────────┐
│   Monolith    │  │ Payment  │  │ Notification │
│  [Auth]       │  │ Service  │  │   Service    │
│  [Orders]     │  │          │  │              │
│  [Search]     │  │          │  │              │
└───────────────┘  └──────────┘  └──────────────┘

Phase 4: Monolith becomes just another service
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Auth    │ │  Order   │ │ Payment  │ │ Notify   │
│ Service  │ │ Service  │ │ Service  │ │ Service  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Netflix used this exact approach over 7 years (2009-2016).**

---

## Communication Patterns

### Synchronous: REST / gRPC

```
REST (HTTP/JSON):
┌──────────┐   GET /users/123    ┌──────────┐
│  Order   │ ──────────────────▶ │   User   │
│ Service  │ ◀────────────────── │ Service  │
└──────────┘   { "name": "..." } └──────────┘

Pros: Simple, widely understood, great for CRUD
Cons: Tight coupling, cascading failures, latency chains

gRPC (HTTP/2 + Protobuf):
┌──────────┐   Binary protobuf   ┌──────────┐
│  Order   │ ══════════════════▶ │   User   │
│ Service  │ ◀══════════════════ │ Service  │
└──────────┘   10x faster        └──────────┘

Pros: Fast (binary), type-safe, streaming, code generation
Cons: Harder to debug, browser support limited
```

**When to use which:**

```
REST:  Public APIs, simple CRUD, browser-facing
gRPC:  Internal service-to-service, high throughput,
       streaming (real-time feeds, file transfer)

Netflix: gRPC internally, REST for public API
Google:  gRPC everywhere (they invented it)
```

### Asynchronous: Events / Messages

```
Event-Driven:
┌──────────┐                      ┌──────────┐
│  Order   │──▶ OrderPlaced ──────│ Payment  │
│ Service  │   (event to Kafka)   │ Service  │
└──────────┘         │            └──────────┘
                     │
                     ├────────────┌──────────┐
                     │            │ Inventory │
                     │            │ Service   │
                     │            └──────────┘
                     │
                     └────────────┌──────────┐
                                  │  Email   │
                                  │ Service  │
                                  └──────────┘

Pros: Loose coupling, resilient, scalable
Cons: Complex debugging, eventual consistency
```

### The Communication Matrix

```
                    Sync (REST/gRPC)    Async (Events)
─────────────────   ────────────────    ──────────────
Need response now?  ✅ Yes              ❌ No
Can tolerate delay? ❌ No               ✅ Yes
Fan-out needed?     ❌ Point-to-point   ✅ One-to-many
Failure tolerance?  ❌ Cascading risk   ✅ Decoupled
Debugging?          ✅ Easy to trace    ❌ Hard to trace
Data consistency?   ✅ Immediate        ❌ Eventual
```

---

## Service Discovery

### The Problem

```
In a monolith:
  OrderModule.processPayment()  // Just a function call

In microservices:
  Where is PaymentService running?
  - Which IP?
  - Which port?
  - Is it healthy?
  - There are 12 instances, which one?
```

### Solution: Service Registry

```
                    ┌──────────────────┐
                    │ Service Registry │
                    │ (Consul / Eureka)│
                    │                  │
                    │ PaymentService:  │
                    │  - 10.0.1.5:8080│
                    │  - 10.0.1.6:8080│
                    │  - 10.0.1.7:8080│
                    └───────┬──────────┘
                     ▲      │
          Register   │      │  Discover
          (heartbeat)│      ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Payment  │    │  Order   │    │ Payment  │
│ Svc (1)  │    │ Service  │───▶│ Svc (2)  │
└──────────┘    └──────────┘    └──────────┘
```

### Kubernetes Service Discovery (Modern Approach)

```yaml
# PaymentService deployment
apiVersion: v1
kind: Service
metadata:
  name: payment-service
spec:
  selector:
    app: payment
  ports:
    - port: 80
      targetPort: 8080

# OrderService just calls:
# http://payment-service/api/charge
# Kubernetes DNS resolves it automatically
```

```
Most teams today: Use Kubernetes DNS
  - No separate service registry needed
  - Built-in health checks
  - Automatic load balancing

Legacy systems: Consul, Eureka, ZooKeeper
  - Still valid for non-K8s environments
  - More configuration overhead
```

---

## Data Management: The Hardest Part

### Database Per Service

```
Rule #1: Each service owns its data

❌ WRONG: Shared database
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Order   │  │ Payment  │  │ Shipping │
│ Service  │  │ Service  │  │ Service  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │              │
     └─────────────┼──────────────┘
                   │
            ┌──────┴──────┐
            │  SHARED DB  │ ← Schema changes break everyone
            └─────────────┘

✅ RIGHT: Separate databases
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Order   │  │ Payment  │  │ Shipping │
│ Service  │  │ Service  │  │ Service  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
┌────┴────┐  ┌─────┴────┐  ┌─────┴────┐
│orders_db│  │payments_db│  │shipping_db│
└─────────┘  └──────────┘  └──────────┘
```

### The Join Problem

```
Monolith:
  SELECT o.*, u.name, p.status
  FROM orders o
  JOIN users u ON o.user_id = u.id
  JOIN payments p ON o.id = p.order_id
  -- Easy! One query!

Microservices:
  1. OrderService.getOrder(123)
  2. UserService.getUser(order.userId)     // Separate call
  3. PaymentService.getStatus(order.id)     // Another call
  4. Merge results in application code

  -- 3 network calls instead of 1 SQL query
```

### Saga Pattern: Distributed Transactions

```
Problem: Order requires payment AND inventory deduction
  In a monolith: BEGIN TRANSACTION ... COMMIT
  In microservices: No distributed transactions!

Solution: Saga (sequence of local transactions + compensations)

Choreography Saga (event-driven):
┌──────────┐    OrderCreated    ┌──────────┐
│  Order   │ ─────────────────▶ │ Payment  │
│ Service  │                    │ Service  │
└──────────┘                    └─────┬────┘
     ▲                                │
     │          PaymentCompleted      │
     │  ◀─────────────────────────────┘
     │                                │
     │                          ┌─────▼────┐
     │                          │Inventory │
     │  InventoryReserved       │ Service  │
     │  ◀───────────────────────│          │
     │                          └──────────┘

If Payment fails:
  → OrderService receives PaymentFailed
  → OrderService sets order status = CANCELLED
  → No inventory was reserved (it waits for payment first)

If Inventory fails:
  → PaymentService receives InventoryFailed
  → PaymentService issues refund (compensation)
  → OrderService sets order status = CANCELLED
```

### CQRS: Separate Read and Write Models

```
Problem: Need to join data across services for reads

Solution: Maintain a denormalized read model

Write Side:                    Read Side:
┌──────────┐                   ┌──────────────┐
│  Order   │──OrderCreated───▶│ Order View   │
│ Service  │                   │ Service      │
└──────────┘                   │              │
┌──────────┐                   │ Contains:    │
│ Payment  │──PaymentDone───▶ │ - Order data │
│ Service  │                   │ - User name  │
└──────────┘                   │ - Payment    │
┌──────────┐                   │   status     │
│  User    │──UserUpdated───▶ │ - All joined │
│ Service  │                   └──────────────┘
└──────────┘
                               API reads from here
                               (single query, fast!)
```

---

## Resilience Patterns

### Circuit Breaker

```
Problem: PaymentService is slow/down
  → OrderService waits 30s for response
  → OrderService threads exhausted
  → OrderService goes down too
  → Cascade failure!

Solution: Circuit Breaker (like electrical fuse)

States:
┌────────┐  failures > threshold  ┌────────┐
│ CLOSED │ ─────────────────────▶ │  OPEN  │
│(normal)│                        │ (fail  │
│        │ ◀───────────────────── │  fast) │
└────────┘  timeout expires       └────┬───┘
                                       │
                                  ┌────▼───┐
                                  │  HALF  │
                                  │  OPEN  │ test one request
                                  └────────┘
                                  success → CLOSED
                                  failure → OPEN
```

```javascript
// Pseudocode: Circuit Breaker
class CircuitBreaker {
  constructor(service, options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30s
    this.state = 'CLOSED';
    this.failures = 0;
  }

  async call(request) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit is OPEN - failing fast');
        // Return cached/default response instead
      }
    }

    try {
      const response = await this.service.call(request);
      this.onSuccess();
      return response;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailure = Date.now();
    }
  }
}
```

### Bulkhead Pattern

```
Problem: One slow dependency uses all threads

Without Bulkhead:
┌──────────────────────────────────┐
│         Thread Pool (100)        │
│                                  │
│  PaymentService calls: 95       │ ← Slow service eating all threads
│  UserService calls: 3           │
│  InventoryService calls: 2      │
│  Available: 0                   │ ← Nothing left!
└──────────────────────────────────┘

With Bulkhead (isolated pools):
┌──────────────┐ ┌────────────┐ ┌──────────────┐
│ Payment Pool │ │ User Pool  │ │ Inventory    │
│   (40 max)   │ │ (30 max)   │ │ Pool (30 max)│
│              │ │            │ │              │
│ Using: 40    │ │ Using: 5   │ │ Using: 3     │
│ (maxed out)  │ │ (healthy)  │ │ (healthy)    │
└──────────────┘ └────────────┘ └──────────────┘
Payment is slow but others are unaffected!
```

### Retry with Exponential Backoff

```
Attempt 1: Wait 100ms  → Fail
Attempt 2: Wait 200ms  → Fail
Attempt 3: Wait 400ms  → Fail
Attempt 4: Wait 800ms  → Success!

With jitter (randomness to prevent thundering herd):
Attempt 1: Wait 100ms + random(0-50ms)
Attempt 2: Wait 200ms + random(0-100ms)
Attempt 3: Wait 400ms + random(0-200ms)
```

---

## API Gateway Pattern

```
Without API Gateway:
┌────────┐
│ Mobile │──▶ UserService (auth check)
│  App   │──▶ OrderService (auth check)
│        │──▶ PaymentService (auth check)
│        │──▶ ProductService (auth check)
└────────┘
Problems: Multiple calls, auth duplication, CORS mess

With API Gateway:
┌────────┐     ┌─────────────┐     ┌──────────┐
│ Mobile │────▶│ API Gateway │────▶│  User    │
│  App   │     │             │────▶│  Order   │
│        │     │ - Auth      │────▶│  Payment │
│  Web   │────▶│ - Rate limit│────▶│  Product │
│  App   │     │ - Routing   │     └──────────┘
└────────┘     │ - Caching   │
               │ - Transform │
               └─────────────┘

Popular choices:
- Kong (open source, Lua plugins)
- AWS API Gateway (serverless)
- Envoy (service mesh, C++ performance)
- NGINX (reverse proxy + more)
```

### Backend for Frontend (BFF)

```
Different clients need different data:

Mobile: Small payload, minimal data
Web: Rich data, full details
Internal: Raw data, admin fields

┌────────┐    ┌───────────┐
│ Mobile │───▶│ Mobile BFF│──▶ Services
└────────┘    └───────────┘    (compact responses)

┌────────┐    ┌───────────┐
│  Web   │───▶│  Web BFF  │──▶ Services
└────────┘    └───────────┘    (rich responses)

┌────────┐    ┌───────────┐
│ Admin  │───▶│ Admin BFF │──▶ Services
└────────┘    └───────────┘    (full access)
```

---

## Observability: You Can't Debug What You Can't See

### The Three Pillars

```
1. LOGGING (What happened)
   - Structured JSON logs
   - Centralized (ELK Stack / Datadog)
   - Correlation IDs across services

2. METRICS (How is it performing)
   - Request rate, error rate, duration (RED)
   - Saturation, utilization (USE)
   - Business metrics (orders/sec)

3. TRACING (Where did time go)
   - Distributed tracing (Jaeger / Zipkin)
   - Request flow across services
   - Latency breakdown per service
```

### Distributed Tracing Example

```
User Request: GET /order/123

Trace ID: abc-def-123
├── API Gateway (2ms)
│   └── Auth check (1ms)
├── OrderService (15ms)
│   ├── DB query (5ms)
│   ├── UserService call (45ms)    ← Bottleneck!
│   │   └── DB query (40ms)        ← Slow query!
│   └── PaymentService call (8ms)
│       └── Stripe API (6ms)
└── Total: 70ms

Without tracing: "The order page is slow"
With tracing: "UserService DB query takes 40ms, needs an index"
```

### Correlation IDs

```
Every request gets a unique ID that flows through all services:

Request → API Gateway
  X-Correlation-ID: req-abc-123

API Gateway → OrderService
  X-Correlation-ID: req-abc-123

OrderService → PaymentService
  X-Correlation-ID: req-abc-123

All logs include this ID:
[req-abc-123] OrderService: Processing order 456
[req-abc-123] PaymentService: Charging $99.99
[req-abc-123] PaymentService: Payment successful

Now you can grep ONE ID and see the entire request flow!
```

---

## Real-World Architecture: Netflix

```
Netflix Microservices Architecture (simplified):

┌──────────────────────────────────────────────────────┐
│                    CDN (Open Connect)                 │
│              95% of traffic served from edge          │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                   Zuul (API Gateway)                 │
│            Authentication, routing, filtering         │
└───────┬───────────┬──────────┬──────────┬────────────┘
        │           │          │          │
   ┌────▼────┐ ┌────▼────┐ ┌──▼──┐ ┌────▼────────┐
   │ Browse  │ │ Play    │ │ My  │ │Recommendation│
   │ Service │ │ Service │ │List │ │   Service    │
   └────┬────┘ └────┬────┘ └──┬──┘ └────┬────────┘
        │           │         │          │
   ┌────▼──────────▼─────────▼──────────▼────┐
   │           Eureka (Service Discovery)     │
   └────────────────────┬────────────────────┘
                        │
   ┌────────────────────▼────────────────────┐
   │        Cassandra + EVCache + S3         │
   │    (Distributed storage + caching)      │
   └─────────────────────────────────────────┘

Key numbers:
- 700+ microservices
- 10,000+ deployments per day
- Eureka handles 30M+ service lookups/min
- EVCache serves 30M+ requests/sec
- Zuul processes 50B+ requests/day
```

---

## When NOT to Use Microservices

### The Decision Framework

```
Team size < 10?                    → Monolith
Product not yet proven?            → Monolith
Simple CRUD application?           → Monolith
Just starting out?                 → Monolith
Team has no DevOps culture?        → Monolith

Team size > 20?                    → Consider microservices
Multiple teams own different areas?→ Consider microservices
Need independent scaling?          → Consider microservices
Need technology diversity?         → Consider microservices
Deploy frequency > daily?          → Consider microservices
```

### The Modular Monolith (Best of Both Worlds)

```
Instead of jumping to microservices:

┌─────────────────────────────────────┐
│          Modular Monolith           │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │  Auth   │  │ Orders  │          │
│  │ Module  │  │ Module  │          │
│  │         │  │         │          │
│  │ Own DB  │  │ Own DB  │          │
│  │ schema  │  │ schema  │          │
│  └────┬────┘  └────┬────┘          │
│       │ API         │ API           │
│  ┌────▼────┐  ┌────▼────┐          │
│  │Payment │  │Shipping │          │
│  │ Module  │  │ Module  │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  Single deployment, clear boundaries│
│  Extract to microservice when needed│
└─────────────────────────────────────┘

Benefits:
- Simple deployment (single artifact)
- Clear module boundaries
- Easy to extract later
- No network latency between modules
- Shopify runs this way at massive scale
```

---

## Migration Checklist

```
Before migrating to microservices, ensure you have:

Infrastructure:
□ Container orchestration (Kubernetes)
□ CI/CD pipeline per service
□ Service mesh or API gateway
□ Centralized logging (ELK/Datadog)
□ Distributed tracing (Jaeger/Zipkin)
□ Container registry

Team & Process:
□ Team owns service end-to-end (you build it, you run it)
□ Clear service ownership boundaries
□ On-call rotation per service
□ Documented API contracts
□ Automated testing per service

Architecture:
□ Service discovery mechanism
□ Circuit breakers implemented
□ Retry + backoff policies
□ Health check endpoints
□ Graceful degradation strategy
□ Data consistency approach (sagas/events)
```

---

## Common Mistakes

### 1. Too Many Services Too Soon

```
❌ Day 1: "Let's have 50 microservices!"
   Result: Distributed monolith (worst of both worlds)

✅ Start with modular monolith
   Extract services as team/scale demands
   Rule of thumb: 1 service per 5-8 engineers
```

### 2. Shared Database

```
❌ All services use the same PostgreSQL instance
   Result: Coupled deployments, schema lock-in

✅ Each service owns its data
   Use events to sync data between services
```

### 3. Synchronous Everything

```
❌ Order → Payment → Inventory → Shipping → Email
   All synchronous REST calls in sequence
   Total latency: Sum of all services
   One failure = entire chain fails

✅ Order → Event Bus → Services react independently
   Latency: Only critical path
   One failure = graceful degradation
```

### 4. No Observability

```
❌ "Something is slow but I don't know which service"
   50 services, no tracing = nightmare debugging

✅ Implement tracing, logging, metrics BEFORE
   extracting services. Not after.
```

---

## Key Takeaways

```
1. Microservices solve ORGANIZATIONAL problems
   (team independence, deployment speed)
   NOT technical problems (speed, simplicity)

2. Start with a modular monolith
   Extract services when team size/scale demands

3. Communication choices matter:
   Sync (REST/gRPC) for queries
   Async (events) for commands/notifications

4. Data management is the hardest part
   Database per service + Saga pattern + CQRS

5. Resilience is not optional
   Circuit breakers, bulkheads, retries, timeouts

6. Observability comes FIRST
   Logging + Metrics + Tracing before microservices

7. Conway's Law is real
   Your architecture will mirror your org structure
   Design teams around services, not the other way
```
