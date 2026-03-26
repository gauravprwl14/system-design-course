# 05-distributed-systems/concepts/ — Layer 2 Router

Core distributed systems theory: consensus, consistency models, CAP, two-phase commit, vector clocks, and disaster recovery.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to distributed systems concepts and why they are hard |
| distributed-consensus | The consensus problem: how nodes agree in the presence of failures |
| cap-theorem-practical | CAP theorem explained with real system examples: which systems sacrifice which property |
| acid-vs-base | ACID (strong consistency) vs BASE (eventual consistency): trade-offs and when to choose each |
| two-phase-commit | 2PC protocol: how it works, why it can block, and alternatives (saga, 3PC) |
| raft-consensus | Raft algorithm: leader election, log replication, and how Raft achieves consensus |
| vector-clocks-logical-time | Vector clocks and logical timestamps: tracking causality across distributed nodes |
| eventual-consistency-patterns | Conflict resolution, CRDTs, and patterns for building eventually consistent systems |
| read-your-writes-consistency | Session consistency guarantees and how to implement read-your-writes |
| linearizability-vs-serializability | Strict linearizability vs serializable isolation: what they guarantee and when each matters |
| disaster-recovery-design | RTO and RPO definitions, DR strategies, failover patterns, and multi-region recovery |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start with an overview of distributed systems | overview |
| Understand how distributed systems agree on a value | distributed-consensus, raft-consensus |
| Choose between CP and AP systems | cap-theorem-practical |
| Understand consistency trade-offs | acid-vs-base, linearizability-vs-serializability |
| Understand cross-service transactions | two-phase-commit |
| Track event ordering without a central clock | vector-clocks-logical-time |
| Build systems that tolerate network partitions | eventual-consistency-patterns |
| Ensure users see their own writes | read-your-writes-consistency |
| Design for disaster recovery | disaster-recovery-design |
