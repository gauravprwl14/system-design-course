# Data Consistency

> Understanding consistency in distributed systems

## 📋 Overview

In distributed systems, achieving consistency while maintaining availability and performance is challenging. Learn about different consistency models and when to use them.

## 📚 Articles

### Fundamentals (🟢 Beginner)
1. ACID Properties - Database transactions *(Coming soon)*
2. CAP Theorem - Consistency, Availability, Partition Tolerance *(Coming soon)*
3. BASE Properties - Basically Available, Soft state, Eventual consistency *(Coming soon)*
4. Eventual Consistency - Async convergence *(Coming soon)*
5. Strong Consistency - Immediate consistency *(Coming soon)*

### Consistency Models (🟡 Intermediate)
6. Read Your Writes - Session consistency *(Coming soon)*
7. Monotonic Reads - No going backward *(Coming soon)*
8. Causal Consistency - Preserve causality *(Coming soon)*
9. Linearizability - Strongest consistency *(Coming soon)*
10. Quorum Consistency - Majority consensus *(Coming soon)*

### Advanced Topics (🔴 Advanced)
11. Two-Phase Commit - Distributed transactions *(Coming soon)*
12. Paxos Algorithm - Distributed consensus *(Coming soon)*
13. Raft Algorithm - Understandable consensus *(Coming soon)*
14. Vector Clocks - Detect conflicts *(Coming soon)*
15. CRDTs - Conflict-free replicated data types *(Coming soon)*

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

## 📖 Learning Path

These articles are planned as part of the system design knowledge base expansion. Check back soon for comprehensive guides on each consistency topic.
