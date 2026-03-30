---
title: "Design an Order Tracking System"
layer: case-study
section: "16-system-design-problems/04-reservation-scheduling"
difficulty: intermediate
tags: [order-tracking, state-machine, event-driven, push-notifications, webhooks, eta, kafka]
category: architecture
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "Uber Eats Order Tracking Architecture"
    url: "https://eng.uber.com/uber-eats-order-tracking/"
    type: article
  - title: "Amazon Order Management System"
    url: "https://aws.amazon.com/blogs/architecture/"
    type: article
  - title: "ByteByteGo — Notification System Design"
    url: "https://www.youtube.com/@ByteByteGo"
    type: article
---

# Design an Order Tracking System

**Difficulty**: 🟡 Intermediate
**Reading Time**: ~25 minutes
**The Core Problem**: How do you track 10M orders per day across 6 states — from placement to delivery — with real-time customer notifications, logistics partner webhooks, and ML-based ETA estimation?

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Capacity Estimation](#2-capacity-estimation)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Order State Machine](#4-order-state-machine)
5. [Event-Driven State Updates](#5-event-driven-state-updates)
6. [Customer Notifications](#6-customer-notifications)
7. [ETA Calculation](#7-eta-calculation)
8. [Logistics Partner Integration](#8-logistics-partner-integration)
9. [Key Design Decisions](#9-key-design-decisions)
10. [Interview Questions](#10-interview-questions)
11. [Key Takeaways](#11-key-takeaways)
12. [References](#12-references)

---

## 1. Requirements

### Functional
- Track order through states: placed → confirmed → packed → shipped → out-for-delivery → delivered
- Real-time status push to customer (push notification + in-app)
- ETA displayed and updated in real-time
- Logistics partner webhooks (FedEx, UPS) integrated for shipping events
- Order timeline history (all state transitions with timestamps)
- Support for cancellation and returns

### Non-Functional
- **Scale**: 10M orders/day = ~115 orders/sec avg; 10k orders/sec peak
- **Notification latency**: State change → customer notified < 2 seconds
- **Availability**: 99.99% (customers panic if tracking is down)
- **Durability**: Every state transition persisted, never lost

---

## 2. Capacity Estimation

| Metric | Estimate |
|--------|----------|
| Orders/day | 10M |
| State transitions/order | ~8 events avg |
| Total events/day | 80M |
| Events/sec (avg) | 925; peak: 10k/sec |
| Active orders at peak | ~500k (avg 1hr active) |
| Notification fanout | 10M/day × 3 notifications = **30M pushes/day** |
| Tracking page views/day | 50M (customers check 5× each) |
| Order state storage | 10M × 500B = **5 GB/day** |

---

## 3. High-Level Architecture

```mermaid
graph TD
    OrderSvc[Order Service] -->|order.created| Kafka[Kafka Event Bus]
    FulfillmentSvc[Fulfillment Service] -->|order.packed, order.shipped| Kafka
    LogisticsWebhook[Logistics Webhooks\nFedEx/UPS] --> WebhookHandler[Webhook Handler]
    WebhookHandler -->|order.out_for_delivery, order.delivered| Kafka
    Kafka --> StateMgr[Order State Manager\nConsumer]
    StateMgr --> StateDB[(State DB\nPostgres)]
    StateMgr --> NotifSvc[Notification Service]
    StateMgr --> ETASvc[ETA Service]
    NotifSvc --> FCM[FCM / APNs\nPush]
    NotifSvc --> WS[WebSocket\nIn-app]
    NotifSvc --> SMS[SMS Gateway]
    ETASvc --> ML[ML ETA Model]
    Customer[Customer App] -->|GET /orders/{id}/track| API[API Gateway]
    API --> StateDB
```

---

## 4. Order State Machine

```
States and valid transitions:

  PLACED ──────────────→ CONFIRMED
     |                       |
     ↓                       ↓
  CANCELLED ←────────── PACKED
                            |
                            ↓
                         SHIPPED
                            |
                            ↓
                     OUT_FOR_DELIVERY
                            |
                    ┌───────┴───────┐
                    ↓               ↓
                DELIVERED      FAILED_DELIVERY
                                    |
                                    ↓
                               RETURN_REQUESTED

Invariants (enforced in state manager):
  - Only forward transitions allowed (no SHIPPED → CONFIRMED)
  - CANCELLED only from PLACED or CONFIRMED
  - DELIVERED is terminal (no further transitions)
```

### State Storage Schema
```sql
CREATE TABLE order_states (
  order_id        BIGINT,
  state           VARCHAR(30),
  previous_state  VARCHAR(30),
  transitioned_at TIMESTAMPTZ DEFAULT NOW(),
  actor           VARCHAR(50),     -- 'system', 'fulfillment', 'fedex', 'customer'
  metadata        JSONB,           -- tracking_number, carrier, etc.
  PRIMARY KEY (order_id, transitioned_at)
);

CREATE TABLE orders (
  order_id     BIGINT PRIMARY KEY,
  customer_id  BIGINT,
  current_state VARCHAR(30),
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  eta          TIMESTAMPTZ
);

CREATE INDEX ON orders(customer_id, current_state);
CREATE INDEX ON order_states(order_id);
```

---

## 5. Event-Driven State Updates

### Kafka Event Flow
```
Each state change published as event:
{
  "event_type": "order.state_changed",
  "order_id": 12345,
  "from_state": "PACKED",
  "to_state": "SHIPPED",
  "tracking_number": "1Z999AA10123456784",
  "carrier": "UPS",
  "timestamp": "2024-03-15T14:30:00Z",
  "actor": "fulfillment_service"
}

Topic: order-state-events
Partitions: keyed by order_id (all events for same order → same partition = ordered)

Consumers:
  - state-manager: validates transition, persists, updates orders.current_state
  - notification-service: triggers push/SMS/email
  - eta-service: recomputes ETA based on new state
  - analytics-service: updates funnel metrics
```

### Idempotency
```
At-least-once delivery means duplicate events possible.
Guard: each event has event_id (UUID).
State manager: INSERT INTO processed_events (event_id) ON CONFLICT DO NOTHING
If INSERT succeeds: process event
If INSERT fails (duplicate): skip, already processed
```

---

## 6. Customer Notifications

### Notification Rules
```
CONFIRMED: "Your order has been confirmed! 🎉"
PACKED: "Your order is packed and ready for pickup"
SHIPPED: "Your order is on its way! Tracking: {tracking_number}"
OUT_FOR_DELIVERY: "Your delivery is arriving today! ETA: {eta_window}"
DELIVERED: "Your order has been delivered. Enjoy! ⭐ Rate your experience"
FAILED_DELIVERY: "Delivery attempted. We'll retry tomorrow or you can reschedule."
```

### Notification Channels
```
Priority 1 — Push notification (FCM/APNs): < 1s delivery
Priority 2 — In-app WebSocket: for app-open customers, real-time banner
Priority 3 — SMS: for SHIPPED and DELIVERED (high-importance milestones)
Priority 4 — Email: for SHIPPED (with tracking link)

User preferences respected:
  - Opt-out of SMS (but push always sent)
  - Quiet hours (no push 10pm–8am except DELIVERED)
```

### Push Notification Volume Management
```
10M orders × 4 avg notifications = 40M pushes/day
Peak: 500k pushes in 1 hour

Architecture: Fan-out service
  - Batch pushes to FCM in groups of 500 (FCM batch API)
  - Deduplicate: don't send same state to same user twice
  - Rate limit: 1 push per order per state change (no re-sends for retries)
```

---

## 7. ETA Calculation

### Heuristic ETA (simple, fast)
```
State: PLACED → ETA = ordered_at + sla_by_category
  Electronics: +2 days
  Grocery: +2 hours
  Same-day: +4 hours

State: SHIPPED → ETA = ship_date + carrier_transit_days
  FedEx express: ship_date + 1 day
  Standard: ship_date + 3-5 days

State: OUT_FOR_DELIVERY → ETA = current_time + avg_stops_remaining × avg_time_per_stop
  avg_time_per_stop: 4 minutes (metro) / 8 minutes (suburban)
```

### ML ETA Model (more accurate)
```
Features:
  - Distance to delivery address
  - Current rider/driver position and speed
  - Time of day (traffic proxy)
  - Weather (rain adds 20% to ETA)
  - Historical delivery time for this zip code + time of day

Model: Gradient boosted trees (LightGBM)
  P50 ETA accuracy: ±5 minutes
  P90 ETA accuracy: ±12 minutes

ETA update trigger:
  - Every state change
  - Every 5 minutes during OUT_FOR_DELIVERY
  - On GPS position update (significant deviation)
```

---

## 8. Logistics Partner Integration

### Inbound Webhooks (FedEx, UPS → Our System)
```
FedEx sends webhook to: POST /webhooks/fedex
Payload: tracking_number, event_type, timestamp, location

Webhook Handler:
  1. Validate HMAC signature (FedEx signs payload with shared secret)
  2. Map FedEx event → our internal state:
       FedEx "DELIVERED" → order.DELIVERED
       FedEx "OUT_FOR_DELIVERY" → order.OUT_FOR_DELIVERY
  3. Lookup order_id by tracking_number
  4. Publish state change event to Kafka

Reliability:
  - FedEx expects 200 response within 5s (or retry)
  - Acknowledge immediately, process async via Kafka
  - Idempotent handler (same tracking event replayed = no duplicate state change)
```

### Outbound Polling (fallback for partners without webhooks)
```
Poll FedEx tracking API every 15 minutes for orders in SHIPPED state:
  GET https://api.fedex.com/track/v1/trackingnumbers?trackingNumbers={numbers}
  Batch: 30 tracking numbers per request
  Compare latest status with stored state → trigger state change if different
```

---

## 9. Key Design Decisions

| Decision | Option A | Option B | Choice & Reason |
|----------|----------|----------|-----------------|
| Customer status delivery | Push (server→client) | Poll (client→server) | **Push** — customers check every 30s if polling; push reduces server load 10× |
| State storage | Event sourcing (full history) | Latest state only | **Both** — `orders` table for latest state (fast reads); `order_states` for full history (audit) |
| ETA model | Static rules | ML model | **ML for OUT_FOR_DELIVERY** where accuracy matters most; static rules for earlier states |
| Logistics integration | Webhooks | Polling | **Webhooks primary** + polling fallback — webhooks for real-time, polling for reliability |
| Notification channel | Push only | Multi-channel (push+SMS+email) | **Multi-channel** — DELIVERED via SMS ensures delivery even if app is uninstalled |

---

## 10. Interview Questions

| Question | Key Answer |
|----------|-----------|
| How do you prevent duplicate notifications on retry? | Idempotency key: state + order_id; SET NX in Redis before sending |
| What if Kafka consumer falls behind (lag)? | Scale consumer group; reduce notification to most recent state only (skip intermediate) |
| How do you handle wrong delivery status from carrier? | Dispute state: carrier says DELIVERED, customer says not received → dispute workflow, don't auto-close |
| How do you scale notification service for peak? | Fan-out to FCM batches; 500 per batch; horizontal scale notification workers |
| How does order tracking page work at 50M views/day? | Cache latest state in Redis with 10s TTL; 99% cache hits; only state changes invalidate |

---

## 11. Key Takeaways

- **State machine with explicit valid transitions** prevents corrupt states — enforce in state manager, not application code
- **Kafka keyed by order_id** guarantees ordered state transitions per order — prevents out-of-order processing
- **Push notifications (not polling)** reduce infrastructure load by 10× — 50M tracking page views become 40M pushes/day
- **Idempotency on webhook processing** handles carrier retries gracefully — same event replayed must not cause duplicate state changes
- **Dual storage**: latest state in `orders` table (fast reads) + full history in `order_states` (audit, debugging)

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [Uber Eats Order Tracking](https://eng.uber.com/uber-eats-order-tracking/) | 📖 Blog | Real-time order state and rider tracking at Uber |
| [ByteByteGo — Notification System](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Push notification architecture and fan-out |
| [AWS EventBridge — Event-Driven Architecture](https://aws.amazon.com/blogs/architecture/) | 📖 Blog | Webhook integration and event routing patterns |
| [Designing Data-Intensive Applications — Kleppmann](https://dataintensive.net/) | 📚 Book | Event sourcing and state machine patterns |
