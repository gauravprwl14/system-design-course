# 🔄 Concurrency & Race Conditions

## Overview

Problems arising from **simultaneous operations competing for shared resources**. These failures occur when multiple users or processes attempt to access and modify the same data at the exact same time.

**Why this matters**: At small scale (10-100 users), race conditions are rare. At scale (10K+ concurrent users), they become inevitable and can cause catastrophic failures like overselling inventory, duplicate charges, or data corruption.

---

## Common Scenarios

### E-commerce
- **Inventory overselling**: Two users buy the last item simultaneously
- **Price race conditions**: Price changes mid-checkout
- **Duplicate orders**: User clicks "Buy" twice, creates two orders

### Fintech
- **Payment double-charge**: User charged multiple times for one transaction
- **Account balance inconsistency**: Concurrent withdrawals exceed balance
- **Transaction ordering**: Out-of-order processing violates business rules

### Booking Systems
- **Double-booking**: Same resource (seat, room, appointment) sold twice
- **Abandoned locks**: Reserved items never released
- **Reservation timeouts**: Locks held too long, blocking others

### Social Media
- **Counter race conditions**: Like/view counts inaccurate
- **Notification duplicates**: Same event triggers multiple notifications
- **Follow/unfollow races**: Inconsistent follower counts

---

## Key Patterns

### 1. Check-Then-Act Race Condition
```
Thread A: Check if inventory > 0 → TRUE
Thread B: Check if inventory > 0 → TRUE
Thread A: Decrement inventory → 0
Thread B: Decrement inventory → -1 (OVERSOLD!)
```

**Solution**: Make check and act atomic

### 2. Lost Updates
```
Thread A: Read balance = $100
Thread B: Read balance = $100
Thread A: Write balance = $50 (withdrew $50)
Thread B: Write balance = $75 (withdrew $25)
Result: Balance shows $75, but $75 was withdrawn (should be $25)
```

**Solution**: Optimistic locking with version numbers

### 3. Deadlock
```
Thread A: Lock resource 1, wait for resource 2
Thread B: Lock resource 2, wait for resource 1
Result: Both threads stuck forever
```

**Solution**: Lock ordering, timeouts, deadlock detection

### 4. Lock Contention
```
1000 threads all waiting for same database row lock
Result: Throughput collapses, timeouts everywhere
```

**Solution**: Distributed locks, partition data, queue

---

## Problems in This Category

| Problem | Domain | Impact | Difficulty | Status |
|---------|--------|--------|------------|--------|
| [Inventory Overselling](/problems-at-scale/concurrency/race-condition-inventory) | E-commerce | Revenue loss | 🟡 Intermediate | 🚧 Problem documented |
| [Payment Double-Charge](/problems-at-scale/concurrency/double-charge-payment) | Fintech | Customer trust | 🟡 Intermediate | 🚧 Problem documented |
| [Seat Double-Booking](/problems-at-scale/concurrency/double-booking) | Ticketing | Customer satisfaction | 🟡 Intermediate | 🚧 Problem documented |
| [Duplicate Orders](/problems-at-scale/concurrency/duplicate-orders) | E-commerce | Refunds, logistics | 🟢 Beginner | 🚧 Problem documented |
| [Counter Race Conditions](/problems-at-scale/concurrency/counter-race) | Social Media | Analytics accuracy | 🟢 Beginner | 🚧 Problem documented |

---

## Common Solutions

### 1. Distributed Locks
**Use Redis SETNX for atomic lock acquisition**
- Pros: Fast (2ms), automatic expiration, horizontal scaling
- Cons: Additional infrastructure, single point of failure
- When: >1000 concurrent users, high contention

### 2. Optimistic Locking
**Use version numbers, retry on conflict**
- Pros: No locks, high concurrency, simple
- Cons: Retry storms under high contention
- When: Low-moderate contention, acceptable retries

### 3. Atomic Operations
**Use database/Redis atomic commands**
- Pros: Guaranteed correctness, fast
- Cons: Limited to specific operations
- When: Simple counters, increments, decrements

### 4. Queue-based Serialization
**Process operations sequentially through queue**
- Pros: Guaranteed ordering, no race conditions
- Cons: Higher latency, throughput limited
- When: Strong ordering required, latency acceptable

---

## Real-World Impact

| Company | Problem | Scale | Impact |
|---------|---------|-------|--------|
| **Amazon** | Prime Day overselling | 10M concurrent | $2.5M refunds |
| **Ticketmaster** | Taylor Swift double-booking | 14M users | Congressional hearing |
| **Shopify** | Black Friday race conditions | 500K checkouts | Merchant complaints |
| **Stripe** | Payment double-charge | 1M transactions | Compliance issues |

---

## Detection & Prevention

### Monitoring
```sql
-- Detect overselling
SELECT COUNT(*) FROM orders
WHERE quantity > (SELECT stock FROM inventory WHERE id = orders.product_id);

-- Detect duplicate payments
SELECT user_id, COUNT(*) as duplicate_charges
FROM payments
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, amount
HAVING COUNT(*) > 1;
```

### Prevention
- Load test with >1000 concurrent users
- Chaos engineering: inject delays to expose races
- Code review: flag check-then-act patterns
- Static analysis: detect unsynchronized access

---

## Related Categories

- [Availability](/problems-at-scale/availability) - Race conditions can cause cascading failures
- [Data Integrity](/problems-at-scale/data-integrity) - Concurrent writes cause corruption
- [Consistency](/problems-at-scale/consistency) - Related to distributed consistency challenges

---

## Learn More

- [System Design: Distributed Locks](/system-design/distributed-systems/distributed-locks)
- [POC: Redis Distributed Lock](/interview-prep/practice-pocs/redis-distributed-lock)
- [POC: Optimistic Locking](/interview-prep/practice-pocs/database-optimistic-locking)

---

**Start exploring**: [Inventory Overselling](/problems-at-scale/concurrency/race-condition-inventory) | [All Problems](/problems-at-scale)
