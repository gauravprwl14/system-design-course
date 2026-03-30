---
title: "Design a Payment Gateway (Stripe)"
layer: case-study
section: "16-system-design-problems/07-security"
difficulty: advanced
tags: [gateway, idempotency, retry, 3ds, tokenization, webhook, stripe, payment]
category: security
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "System Design Interview – Alex Xu"
    url: "https://www.amazon.com/System-Design-Interview-insiders-Second/dp/B08CMF2CQF"
    type: article
  - title: "Stripe Engineering — Designing Robust Payments"
    url: "https://stripe.com/blog/payment-api-design"
    type: article
  - title: "Stripe — Payment Intents API"
    url: "https://stripe.com/docs/payments/payment-intents"
    type: article
---

# Design a Payment Gateway (Stripe)

**Difficulty**: 🔴 Advanced
**Reading Time**: Coming Soon
**Interview Frequency**: High

---

> 🚧 **Full article coming soon.** This stub gives you the essentials to start thinking about this problem.

---

## The Core Problem

Routing payments through multiple acquiring banks with retry logic and idempotency — when Acquirer A is down or has low approval rates for a card type, the gateway must transparently failover to Acquirer B without double-charging the customer. This requires knowing payment state at all times and making retries safe.

## Functional Requirements

- Accept card payments from merchants via API
- Route to appropriate acquirer based on card type, geography, approval rates
- Handle 3DS authentication for European cards (SCA mandate)
- Provide webhooks to merchants for payment status updates
- Support refunds and dispute management

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Availability | 99.999% (5 min/year) — revenue depends on uptime |
| Transaction latency | p99 < 2 seconds end-to-end |
| PCI-DSS Level 1 | Full compliance required |
| Throughput | 100K transactions/sec at peak |

## Back-of-Envelope Estimates

- **Transaction volume**: 100K tx/sec peak × 100 bytes = 10MB/sec transaction log
- **Acquirer fallback rate**: 2% acquirer failure rate × 100K tx/sec = 2,000 fallback attempts/sec
- **Webhook delivery**: 100K tx/sec × 3 webhook events avg = 300K webhook deliveries/sec

## Key Design Decisions

1. **State Machine for Payment** — payment states: created → authenticating → authorizing → capturing → succeeded/failed; each transition is atomic; gateway can determine current state on any retry and only advance forward, never re-execute completed steps.
2. **Acquirer Routing with Fallback** — maintain real-time approval rate per (acquirer × card_type × geography); route to highest approval-rate acquirer; if 3 consecutive failures, mark acquirer degraded and route to secondary; retest primary every 5 minutes.
3. **Card Data Vault with Tokens** — on card entry, immediately replace PAN with vault token; all downstream processing uses token; only the vault (isolated, PCI Level 1 system) can decrypt PAN; reduces attack surface for the rest of the system.

## High-Level Architecture

```mermaid
graph TD
    Merchant[Merchant App] --> GatewayAPI[Payment Gateway API]
    GatewayAPI --> Vault[Card Vault\nTokenization PCI L1]
    GatewayAPI --> ThreeDS[3DS Authentication\nLiability shift]
    GatewayAPI --> Router[Acquirer Router\napproval rate + fallback]
    Router --> AcquirerA[Acquirer A\nChase/Wells Fargo]
    Router --> AcquirerB[Acquirer B\nFallback]
    AcquirerA --> CardNetwork[Card Network\nVisa/Mastercard]
    GatewayAPI --> WebhookSvc[Webhook Service\nMerchant notifications]
    GatewayAPI --> StateMachine[Payment State Machine\npostgres]
```

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| How do you ensure a payment isn't charged twice if the acquirer connection drops mid-request? | Idempotency, state machine |
| How do you handle acquirer outages without merchants knowing? | Failover routing, circuit breaker |
| What is 3DS and when is it required? | European SCA, liability shift |

## Related Concepts

- [Online payment service for merchant-level design](./online-payment)
- [Digital wallet for stored-value balance management](./digital-wallet)

---

*📚 Full deep-dive with multiple approaches, trade-off tables, and pseudocode coming soon.*
