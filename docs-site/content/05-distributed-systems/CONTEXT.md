# 05-distributed-systems/ — Layer 1 Module

Foundational theory and failure case studies for distributed systems: consensus, consistency, CAP theorem, and real-world race conditions.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Core distributed systems theory: consensus algorithms, consistency models, CAP, 2PC, vector clocks |
| failures/ | problem | Real-world concurrency failures: race conditions, double charges, double booking, stale reads |

## Article Count
- concepts/: 10 articles
- failures/: 8 articles
- Total: 18 articles (plus index)

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Understand the CAP theorem practically | concepts/ | cap-theorem-practical.md |
| Understand ACID vs BASE trade-offs | concepts/ | acid-vs-base.md |
| Understand distributed consensus | concepts/ | distributed-consensus.md |
| Understand how Raft works | concepts/ | raft-consensus.md |
| Understand 2PC and its failure modes | concepts/ | two-phase-commit.md |
| Understand eventual consistency patterns | concepts/ | eventual-consistency-patterns.md |
| Understand read-your-writes consistency | concepts/ | read-your-writes-consistency.md |
| Understand linearizability vs serializability | concepts/ | linearizability-vs-serializability.md |
| Understand vector clocks | concepts/ | vector-clocks-logical-time.md |
| Design disaster recovery (RTO/RPO) | concepts/ | disaster-recovery-design.md |
| Understand double booking problems | failures/ | double-booking.md |
| Understand payment double charge risks | failures/ | double-charge-payment.md |
| Understand inventory race conditions | failures/ | race-condition-inventory.md |
| Understand stale reads after writes | failures/ | stale-read-after-write.md |

## Prerequisites
- 01-databases/ — ACID transactions and database locking
- 02-caching/ — consistency trade-offs with caching

## Connects To
- 01-databases/ — distributed transactions (2PC, saga)
- 04-messaging/ — Kafka's consistency and ordering guarantees
- 06-scalability/ — high availability and leader election
