# Data Consistency

> Understanding consistency in distributed systems

## 📋 Overview

In distributed systems, achieving consistency while maintaining availability and performance is challenging. Learn about different consistency models and when to use them.

## 📚 Articles

### Fundamentals (🟢 Beginner)
1. [ACID Properties](./01-acid.md) - Database transactions
2. [CAP Theorem](./02-cap-theorem.md) - Consistency, Availability, Partition Tolerance
3. [BASE Properties](./03-base.md) - Basically Available, Soft state, Eventual consistency
4. [Eventual Consistency](./04-eventual-consistency.md) - Async convergence
5. [Strong Consistency](./05-strong-consistency.md) - Immediate consistency

### Consistency Models (🟡 Intermediate)
6. [Read Your Writes](./06-read-your-writes.md) - Session consistency
7. [Monotonic Reads](./07-monotonic-reads.md) - No going backward
8. [Causal Consistency](./08-causal-consistency.md) - Preserve causality
9. [Linearizability](./09-linearizability.md) - Strongest consistency
10. [Quorum Consistency](./10-quorum.md) - Majority consensus

### Advanced Topics (🔴 Advanced)
11. [Two-Phase Commit](./11-two-phase-commit.md) - Distributed transactions
12. [Paxos Algorithm](./12-paxos.md) - Distributed consensus
13. [Raft Algorithm](./13-raft.md) - Understandable consensus
14. [Vector Clocks](./14-vector-clocks.md) - Detect conflicts
15. [CRDTs](./15-crdts.md) - Conflict-free replicated data types

## 🎯 Choosing Consistency Level

| Use Case | Consistency | Example |
|----------|-------------|---------|
| Bank transfers | Strong | Transactions |
| Social media feed | Eventual | Timeline |
| Shopping cart | Session | User cart |
| Leaderboard | Eventual | Game scores |
| Inventory | Strong | Stock levels |

## 📊 CAP Theorem

Pick any 2:
- **Consistency**: All nodes see same data
- **Availability**: Every request gets response
- **Partition Tolerance**: System works despite network failures

Most systems choose **AP** or **CP**, not **CA** (network failures happen!).

Start with [ACID Properties](./01-acid.md)!
