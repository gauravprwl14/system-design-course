# ⚖️ Consistency & Integrity

## Overview

Problems where **data becomes inconsistent across different parts of a distributed system**. These failures occur when multiple copies of data diverge, transactions span multiple databases, or eventual consistency delays cause business logic errors.

**Why this matters**: "Eventual consistency" sounds good until a user pays for an item that's already out of stock. At scale, maintaining consistency across distributed systems is one of the hardest challenges in system design.

---

## Common Scenarios

### Distributed Transactions
- **Multi-service transaction failure**: Payment succeeds but inventory update fails
- **Two-phase commit deadlock**: Coordinators waiting indefinitely
- **Saga compensation failure**: Unable to rollback partial transaction

### Cache Consistency
- **Cache invalidation lag**: Cache shows old data after DB update
- **Cache stampede**: Simultaneous cache updates cause conflicts
- **Stale cache forever**: Cache never expires, shows wrong data

### Replication Lag
- **Read-after-write inconsistency**: User can't see their own updates
- **Monotonic read violation**: User sees data go backwards in time
- **Causal ordering broken**: Effects visible before causes

### Transaction Anomalies
- **Write skew**: Concurrent transactions violate constraints
- **Phantom reads**: Transaction sees different data on re-read
- **Lost updates**: Concurrent writes overwrite each other

---

## Key Patterns

### 1. Distributed Transaction Failure
```
Step 1: Charge user $100 → SUCCESS
Step 2: Reserve inventory → NETWORK TIMEOUT
Step 3: Should rollback payment, but payment service unreachable
Result: User charged, no item reserved
```

**Solution**: Saga pattern, idempotency, compensation

### 2. Cache-DB Divergence
```
T0: Cache = "price: $100", DB = "price: $100"
T1: Update DB to "price: $80"
T2: Cache still shows $100 (not invalidated yet)
T3: User sees $100, adds to cart
T4: Checkout fails: "Price changed to $80"
Result: Confused user, abandoned cart
```

**Solution**: Cache-aside pattern, TTL, write-through cache

### 3. Write Skew
```
Bank rule: Sum of accounts A + B must be >= $0
Account A = $100, Account B = $100

Transaction 1: Read A ($100), Read B ($100), Withdraw $150 from A
Transaction 2: Read A ($100), Read B ($100), Withdraw $150 from B
Both check: $100 + $100 = $200 >= $0 ✓
Both commit
Result: A = -$50, B = -$50, Sum = -$100 (violated constraint!)
```

**Solution**: Serializable isolation, application locks

---

## Problems in This Category

| Problem | Domain | Impact | Difficulty | Status |
|---------|--------|--------|------------|--------|
| [Distributed Transaction](/problems-at-scale/consistency/distributed-transaction) | E-commerce | Data inconsistency | 🔴 Advanced | 🚧 Problem documented |
| [Eventual Consistency Lag](/problems-at-scale/consistency/eventual-consistency-lag) | Distributed Systems | Logic errors | 🟡 Intermediate | 🚧 Problem documented |
| [Cache Invalidation](/problems-at-scale/consistency/cache-invalidation) | Web Apps | Stale content | 🟡 Intermediate | 🚧 Problem documented |
| [Stale Reads](/problems-at-scale/consistency/stale-reads) | SQL Databases | Confusing UX | 🟡 Intermediate | 🚧 Problem documented |
| [Write Skew](/problems-at-scale/consistency/write-skew) | Fintech | Constraint violations | 🔴 Advanced | 🚧 Problem documented |

---

## Common Solutions

### 1. Saga Pattern
**Coordinate distributed transactions with compensation**
- Pros: No distributed locks, scalable
- Cons: Complex, eventual consistency
- When: Microservices, long-running transactions

### 2. Event Sourcing
**Store all changes as immutable events**
- Pros: Complete audit trail, time travel
- Cons: Query complexity, storage overhead
- When: Need full history, complex domains

### 3. Read-Your-Writes Consistency
**Ensure users see their own updates**
- Pros: Better UX, appears strongly consistent
- Cons: Adds latency, routing complexity
- When: User-facing applications, social media

### 4. Serializable Isolation
**Strongest isolation level prevents anomalies**
- Pros: Prevents all anomalies, simple reasoning
- Cons: Performance impact, false conflicts
- When: Financial transactions, inventory management

---

## Real-World Impact

| Company | Problem | Scale | Impact |
|---------|---------|-------|--------|
| **Uber** | Transaction coordination | 100M rides/day | Payment vs ride mismatch |
| **Amazon** | DynamoDB consistency | Global | Read-after-write issues |
| **Reddit** | Cache invalidation | 50M users | Stale comments visible |
| **GitHub** | Read replica lag | 100M repos | User confusion |

---

## Detection & Prevention

### Monitoring
```sql
-- Detect replication lag
SELECT replica_name,
       EXTRACT(EPOCH FROM (NOW() - last_replay_timestamp)) as lag_seconds
FROM pg_stat_replication
WHERE lag_seconds > 5;

-- Detect write skew
SELECT account_id, SUM(balance) as total_balance
FROM accounts
GROUP BY account_group
HAVING SUM(balance) < 0;
```

### Prevention
- Use idempotency keys for all write operations
- Implement request-level tracing across services
- Set TTL on all cache entries
- Monitor replication lag aggressively (alert >1s)
- Use strongest isolation level feasible

---

## Related Categories

- [Concurrency](/problems-at-scale/concurrency) - Race conditions cause consistency issues
- [Availability](/problems-at-scale/availability) - Split-brain creates consistency problems
- [Data Integrity](/problems-at-scale/data-integrity) - Consistency failures corrupt data

---

## Learn More

- [System Design: Distributed Transactions](/system-design/distributed-systems/transactions)
- [System Design: Consistency Models](/system-design/distributed-systems/consistency)
- [POC: Saga Pattern](/interview-prep/practice-pocs/saga-pattern)

---

**Start exploring**: [Distributed Transactions](/problems-at-scale/consistency/distributed-transaction) | [All Problems](/problems-at-scale)
