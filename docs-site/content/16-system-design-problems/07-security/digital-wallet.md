---
title: "Design a Digital Wallet (PayPal/Venmo)"
layer: case-study
section: "16-system-design-problems/07-security"
difficulty: advanced
tags: [balance, ledger, double-entry, consistency, fraud, lock, paypal, venmo]
category: security
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "System Design Interview – Alex Xu Vol 2"
    url: "https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119"
    type: article
  - title: "PayPal Engineering — Ledger Architecture"
    url: "https://medium.com/paypal-tech/scaling-paypal-s-internal-ledger-system-for-high-throughput-6b6edf9cb6d4"
    type: article
  - title: "Avoiding Double Payments in Distributed Systems — Airbnb"
    url: "https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb"
    type: article
---

# Design a Digital Wallet (PayPal/Venmo)

**Difficulty**: 🔴 Advanced
**Reading Time**: Coming Soon
**Interview Frequency**: High

---

> 🚧 **Full article coming soon.** This stub gives you the essentials to start thinking about this problem.

---

## The Core Problem

Managing balances for 100 million users with ACID guarantees on transfers means every "send $100 from Alice to Bob" must be atomic — Alice's balance decreases AND Bob's balance increases in the same transaction, or neither happens. In a distributed system where Alice and Bob might be on different database shards, achieving this atomicity without 2-phase commit is the central challenge.

## Functional Requirements

- Send money between users instantly
- Receive money and see real-time balance update
- Link bank accounts and credit cards for top-up
- Transaction history with filtering
- Request money from other users

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Consistency | ACID: balance never incorrect |
| Availability | 99.99% (52 min/year) |
| Transfer latency | < 500ms for peer-to-peer |
| Scale | 100M users, 10M transactions/day |

## Back-of-Envelope Estimates

- **Transaction rate**: 10M transactions/day ÷ 86,400 = ~116 tx/sec (peak 10x = 1,160 tx/sec)
- **Ledger entries**: 116 tx/sec × 2 entries per tx (debit + credit) = 232 ledger writes/sec
- **Balance computation**: Current balance = SUM of all ledger entries for user — too slow; maintain running balance column updated atomically with each transaction

## Key Design Decisions

1. **Double-Entry Bookkeeping** — every transaction creates two ledger entries: debit (sender -$100) and credit (recipient +$100); ledger is append-only; balance = SUM(credits) - SUM(debits); immutable audit trail for every dollar movement.
2. **Same-Shard Transactions for Common Case** — co-locate users on same shard by user_id hash; most peer-to-peer payments happen between users on same shard; enabling single-DB transaction for 95% of transfers; cross-shard uses Saga.
3. **Optimistic Locking on Balance** — read balance + version; verify sufficient funds; write new balance with version+1; if version conflict (concurrent tx), retry; prevents negative balance without holding long DB locks.

## High-Level Architecture

```mermaid
graph TD
    User[User App] --> WalletAPI[Wallet API]
    WalletAPI --> FraudCheck[Fraud Check Service]
    FraudCheck --> TxSvc[Transaction Service]
    TxSvc --> LedgerDB[(Ledger DB\nPostgres — append-only)]
    TxSvc --> BalanceDB[(Balance Cache\nMaterialized View]
    TxSvc --> EventBus[Event Bus\nNotifications]
    EventBus --> NotifySvc[Notification Service]
    TxSvc --> AuditLog[(Audit Log\nImmutable S3)]
```

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| How do you transfer money between users on different database shards atomically? | Distributed transactions, Saga pattern |
| How do you prevent a user from spending the same balance twice (race condition)? | Optimistic locking, serialization |
| How would you reconstruct a user's balance from scratch if the balance column is corrupted? | Double-entry ledger, event sourcing |

## Related Concepts

- [Online payment service for card processing layer](./online-payment)
- [Payment gateway for bank connectivity](./payment-gateway)

---

*📚 Full deep-dive with multiple approaches, trade-off tables, and pseudocode coming soon.*

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [System Design Interview Vol 2 — Alex Xu](https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119) | 📚 Book | Chapter on designing a digital wallet / payment system |
| [ByteByteGo — Design a Digital Wallet](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Search "digital wallet design" — balance management, transfers, fraud prevention |
| [Stripe Engineering: Financial Infrastructure](https://stripe.com/blog/idempotency) | 📖 Blog | Idempotent API design for payment operations — critical for wallet reliability |
| [PayPal Engineering: Money Movement](https://medium.com/paypal-tech) | 📖 Blog | How PayPal handles multi-currency wallets and cross-border transfers |
| [PCI DSS Compliance Requirements](https://www.pcisecuritystandards.org/merchants/what_is_pci_compliance.php) | 📚 Docs | Security standards for storing, processing, and transmitting payment card data |
