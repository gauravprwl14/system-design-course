---
title: "Transactions, ACID, and BASE"
layer: interview-q
section: interview-prep/question-bank/databases
difficulty: intermediate
tags: [databases, transactions, acid, mvcc, concurrency]
---

# Transactions, ACID, and BASE

10 questions covering ACID properties, isolation levels, MVCC, optimistic concurrency, and distributed transactions.

---

## Q1: Explain ACID with a concrete bank transfer example

**Role:** Junior | **Difficulty:** 🟢 Junior | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can map abstract ACID properties to failure scenarios in a real transaction, not just recite the acronym.

### Answer in 60 seconds
- **Atomicity:** Transfer $100 from Alice to Bob — if the debit succeeds but credit fails, the entire transaction is rolled back; Alice keeps her $100; no money is created or lost
- **Consistency:** Constraints enforce that no account goes negative; the transaction takes DB from one valid state (Alice=$500, Bob=$200) to another (Alice=$400, Bob=$300)
- **Isolation:** Concurrent transfers from Alice's account don't see each other's intermediate state — Alice can't be double-debited by two concurrent transactions
- **Durability:** Once committed, the transfer survives a server crash — PostgreSQL WAL ensures the commit record is flushed to disk before returning OK

### Diagram

```mermaid
sequenceDiagram
  participant App
  participant DB
  participant Disk as WAL Disk

  App->>DB: BEGIN
  App->>DB: UPDATE alice SET balance = 400
  App->>DB: UPDATE bob SET balance = 300
  DB->>Disk: Write both changes to WAL
  App->>DB: COMMIT
  DB-->>App: OK (Durable: on disk)

  Note over DB: Crash here: WAL replays both updates on restart
  Note over DB: If COMMIT never received: WAL rolls back both
```

### Pitfalls
- ❌ **Confusing Consistency with Integrity:** ACID Consistency means constraints are satisfied at transaction boundaries — it does NOT mean replicas are in sync (that's a different type of consistency)
- ❌ **Assuming Isolation means full serialization by default:** PostgreSQL default isolation is READ COMMITTED — allows non-repeatable reads; SERIALIZABLE prevents all anomalies but reduces throughput

### Concept Reference

---

## Q2: What is an isolation level and what problems does each level prevent?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can match isolation levels to anomalies they prevent and understand the throughput cost of each level.

### Answer in 60 seconds
- **READ UNCOMMITTED:** Reads uncommitted data from other transactions (dirty reads); theoretically possible but MySQL/PG don't implement it this way
- **READ COMMITTED (PostgreSQL default):** Prevents dirty reads; allows non-repeatable reads (a row read twice in one transaction may change between reads)
- **REPEATABLE READ:** Prevents dirty reads and non-repeatable reads; allows phantom reads (a range query may return different rows on second execution)
- **SERIALIZABLE:** Prevents all anomalies including phantom reads; implemented via predicate locking or SSI — reduces throughput by 50–80%

### Diagram

```mermaid
graph TD
  A[Isolation Levels]
  A --> B[READ COMMITTED - prevents: dirty reads]
  A --> C[REPEATABLE READ - prevents: dirty + non-repeatable reads]
  A --> D[SERIALIZABLE - prevents: all anomalies]

  B --> E[Throughput: ~100% of baseline]
  C --> F[Throughput: ~80% of baseline]
  D --> G[Throughput: ~20-50% of baseline]

  H[Anomaly Reference]
  H --> I[Dirty read: see uncommitted data]
  H --> J[Non-repeatable read: same row changes mid-txn]
  H --> K[Phantom read: new rows appear in range query]
```

### Pitfalls
- ❌ **Using SERIALIZABLE for all transactions:** Booking confirmation needs SERIALIZABLE; reading a user profile does not — scope serializable isolation to only the transactions that need it
- ❌ **Assuming REPEATABLE READ prevents phantoms in PostgreSQL:** PostgreSQL's REPEATABLE READ uses snapshot isolation which actually prevents most phantoms in practice, but SERIALIZABLE is the only standard guarantee

### Concept Reference

---

## Q3: How do MVCC databases handle concurrent transactions?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P0 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand Multi-Version Concurrency Control — that readers don't block writers and writers don't block readers, and why this is key to PostgreSQL/MySQL InnoDB performance.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Concurrent transactions | 1,000/sec |
| Read:write ratio | 9:1 |
| Isolation level | READ COMMITTED (default) |

### How MVCC Works

```mermaid
sequenceDiagram
  participant T1 as T1 (reader, txn_id=100)
  participant T2 as T2 (writer, txn_id=101)
  participant DB

  T1->>DB: BEGIN (snapshot at txn_id=100)
  T2->>DB: BEGIN
  T2->>DB: UPDATE accounts SET balance=400 WHERE id=1
  Note over DB: Old row (balance=500, xmin=50, xmax=101) kept
  Note over DB: New row (balance=400, xmin=101, xmax=0) created
  T1->>DB: SELECT balance WHERE id=1
  DB-->>T1: Returns 500 (old version, T2 not committed yet)
  T2->>DB: COMMIT
  T1->>DB: SELECT balance WHERE id=1 (new statement)
  DB-->>T1: Returns 400 (READ COMMITTED: sees latest committed)
```

### Key MVCC Mechanics

```mermaid
graph TD
  A[Each row has: xmin, xmax]
  A --> B[xmin: transaction that created this version]
  A --> C[xmax: transaction that deleted or updated it]

  D[Visibility rule: row visible to T if]
  D --> E[xmin committed before T started]
  D --> F[AND xmax is NULL or not yet committed]

  G[Dead tuples: xmax committed]
  G --> H[Invisible to all transactions]
  H --> I[VACUUM: physically removes dead tuples]
  I --> J[Without VACUUM: table grows forever - table bloat]
```

| Property | MVCC Behavior |
|----------|--------------|
| Read blocks write? | No — readers see old version |
| Write blocks read? | No — readers see old version |
| Write blocks write? | Yes — competing updates to same row |
| Storage cost | 2x row versions during active update |
| Cleanup cost | VACUUM required to reclaim dead tuples |

### Recommended Answer
MVCC maintains multiple row versions — each transaction sees a consistent snapshot based on when it started. This enables concurrent reads and writes without locking, which is why PostgreSQL can handle 10,000+ concurrent connections efficiently. The cost is dead tuple accumulation requiring AUTOVACUUM.

### What a great answer includes
- [ ] xmin/xmax visibility rule (the actual mechanism, not just the concept)
- [ ] Why VACUUM is critical: dead tuples from MVCC cause table bloat and eventually transaction ID wraparound
- [ ] MVCC vs lock-based: lock-based systems (DB2, older Oracle) block readers on write — MVCC systems don't
- [ ] Write-write conflict: MVCC doesn't eliminate write conflicts — two concurrent UPDATEs to the same row still result in one waiting

### Pitfalls
- ❌ **Thinking MVCC eliminates all locking:** MVCC eliminates read-write locks; write-write conflicts still cause row-level locking
- ❌ **Disabling AUTOVACUUM:** MVCC dead tuples accumulate without VACUUM — disabling AUTOVACUUM causes table bloat and eventually transaction ID wraparound (requires emergency VACUUM FREEZE)

### Concept Reference

---

## Q4: What is a phantom read, dirty read, and non-repeatable read?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can give precise definitions with examples that distinguish these three anomalies.

### Answer in 60 seconds
- **Dirty read:** Transaction T1 reads data written by uncommitted T2; T2 rolls back — T1 now has data that never officially existed; prevented by READ COMMITTED+
- **Non-repeatable read:** T1 reads a row, T2 commits an update to that row, T1 reads the same row again — gets different value mid-transaction; prevented by REPEATABLE READ+
- **Phantom read:** T1 runs a range query, T2 inserts a new row matching that range and commits, T1 runs the range query again — new row appears; prevented by SERIALIZABLE only
- **Real-world impact:** Non-repeatable read causes wrong inventory deduction; phantom read causes double-booking of the last seat

### Diagram

```mermaid
sequenceDiagram
  participant T1
  participant T2
  participant DB

  Note over T1,DB: Dirty Read (READ UNCOMMITTED)
  T2->>DB: UPDATE balance=0 (uncommitted)
  T1->>DB: READ balance → 0 (dirty!)
  T2->>DB: ROLLBACK
  Note over T1: T1 saw balance=0 which never existed

  Note over T1,DB: Non-Repeatable Read (READ COMMITTED)
  T1->>DB: READ balance → 500
  T2->>DB: UPDATE balance=400, COMMIT
  T1->>DB: READ balance → 400 (different!)
  Note over T1: Same row, different value in same transaction

  Note over T1,DB: Phantom Read (REPEATABLE READ)
  T1->>DB: SELECT * WHERE amount > 100 → 3 rows
  T2->>DB: INSERT amount=200, COMMIT
  T1->>DB: SELECT * WHERE amount > 100 → 4 rows (phantom!)
  Note over T1: New row appeared mid-transaction
```

### Pitfalls
- ❌ **Confusing phantom reads with non-repeatable reads:** Non-repeatable = same row changes value; phantom = new rows appear in a range — the isolation fix is different
- ❌ **Assuming PostgreSQL REPEATABLE READ allows phantoms:** PostgreSQL's REPEATABLE READ snapshot isolation prevents most phantoms in practice (via snapshot), but the SQL standard says REPEATABLE READ should allow them

### Concept Reference

---

## Q5: When would you use SERIALIZABLE isolation and what is the cost?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you can identify scenarios that require serializable isolation and quantify the throughput trade-off.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Use case | Airline seat booking |
| Concurrent booking requests | 500/sec |
| Seats available | 1 per flight |
| Acceptable double-booking rate | 0 |

### When Serializable is Required

```mermaid
graph TD
  A[Serializable required when:] --> B[Check-then-act on shared resources]
  A --> C[Aggregate-then-write: sum before credit limit check]
  A --> D[Multi-row invariant: exactly 1 user per slot]

  E[Serializable NOT needed for:] --> F[Simple CRUD: insert/update single row]
  E --> G[Idempotent updates: SET status=active]
  E --> H[Monotonic increments: UPDATE counter = counter + 1]
```

### Cost of Serializable

```mermaid
graph TD
  A[PostgreSQL SSI - Serializable Snapshot Isolation]
  A --> B[Tracks read-write dependencies between txns]
  B --> C[If dependency cycle detected: abort and retry one txn]

  D[Performance impact]
  D --> E[Memory: 64 bytes per active transaction for tracking]
  D --> F[Throughput: 20-50% reduction under high contention]
  D --> G[Abort rate: 5-30% under high contention - app must retry]
  D --> H[Latency: +1-5ms per transaction for conflict detection]
```

| Isolation | Throughput | Abort Rate | Use When |
|-----------|------------|------------|----------|
| READ COMMITTED | Baseline 100% | ~0% | Default CRUD |
| REPEATABLE READ | ~80% | ~1% | Consistent reports |
| SERIALIZABLE | 20–50% | 5–30% | Financial, booking, inventory |

### Recommended Answer
Use SERIALIZABLE only for transactions that have a true check-then-act pattern on shared data: seat booking, inventory deduction, credit limit checks, unique resource allocation. The application must handle `SQLSTATE 40001` (serialization failure) with retry logic. For all other transactions, lower isolation levels with explicit SELECT FOR UPDATE on specific rows are more efficient.

### What a great answer includes
- [ ] SSI (Serializable Snapshot Isolation) in PostgreSQL vs traditional 2PL-based serializable
- [ ] Retry logic requirement: serialization failures must be caught and retried in application code
- [ ] SELECT FOR UPDATE as alternative: explicit locking on specific rows with READ COMMITTED — simpler, less aborts, but more deadlock risk
- [ ] Scope: run SERIALIZABLE for the critical path only, not for the entire connection

### Pitfalls
- ❌ **Using SERIALIZABLE without retry logic:** SQLSTATE 40001 errors bubble up as exceptions to users — the app must catch and retry serialization failures automatically
- ❌ **Serializable for all reads:** Reads in a serializable transaction also track dependencies — use it only for transactions that both read and write shared state

### Concept Reference

---

## Q6: How do you implement optimistic concurrency control without locking?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you know OCC as an alternative to pessimistic locking that reduces contention when conflicts are rare.

### Answer in 60 seconds
- **Pattern:** Add a `version` or `updated_at` column to each row; read it with the data; include it in the UPDATE WHERE clause; if 0 rows updated, another writer modified it first — retry
- **When to use:** Low-conflict scenarios where reads >> writes; pessimistic locking (SELECT FOR UPDATE) would hold locks too long (e.g., user editing a form for minutes)
- **Conflict rate matters:** OCC performs better than pessimistic locking when conflict rate < 5%; above 20% conflicts, retry overhead exceeds lock wait overhead
- **Real example:** Stripe uses version fields on API objects; Etsy uses OCC for cart updates

### Diagram

```mermaid
sequenceDiagram
  participant App1
  participant App2
  participant DB

  App1->>DB: SELECT id, stock, version=5 WHERE product_id=1
  App2->>DB: SELECT id, stock, version=5 WHERE product_id=1

  App1->>DB: UPDATE SET stock=9, version=6 WHERE id=1 AND version=5
  DB-->>App1: 1 row updated (success)

  App2->>DB: UPDATE SET stock=9, version=6 WHERE id=1 AND version=5
  DB-->>App2: 0 rows updated (conflict — version already 6)
  App2->>App2: Retry: re-read version=6, update with version=7
```

### Pitfalls
- ❌ **OCC in high-contention scenarios:** A flash sale with 10K concurrent requests buying the last item causes 9,999 retries — use pessimistic locking (SELECT FOR UPDATE) or atomic decrement instead
- ❌ **Not indexing the version column:** The WHERE clause includes version — ensure the index includes it for efficient conflict detection

### Concept Reference

---

## Q7: How does PostgreSQL implement MVCC under the hood?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P2 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand PostgreSQL-specific MVCC internals including xmin/xmax, transaction ID wraparound, and VACUUM's role.

### Answer in 60 seconds
- **Row versioning:** Each physical row tuple has `xmin` (creating transaction ID) and `xmax` (deleting/updating transaction ID) — a row is visible to T if xmin < T.txn_id and (xmax=0 or xmax > T.txn_id)
- **Transaction ID (XID):** 32-bit counter — wraps around after ~2.1 billion transactions; PostgreSQL must run VACUUM FREEZE before wraparound to mark rows with a frozen xmin, preventing visibility confusion
- **pg_clog / pg_xact:** PostgreSQL maintains a commit log that maps each XID to committed/aborted/in-progress — visibility check looks up xmin in pg_xact
- **Dead tuple cleanup:** VACUUM scans tables, marks dead tuples (where xmax is a committed transaction) as free space — AUTOVACUUM does this automatically based on dead tuple count threshold

### Diagram

```mermaid
graph TD
  A[Physical Row Structure]
  A --> B[xmin: 1050 - created by txn 1050]
  A --> C[xmax: 1075 - deleted by txn 1075]
  A --> D[heap_tuple_data: actual column values]

  E[Visibility Check for T=1060]
  E --> F[xmin=1050 < 1060? YES - row was created before T]
  E --> G[xmax=1075 > 1060? YES - row not yet deleted when T started]
  E --> H[Result: ROW IS VISIBLE to T=1060]

  I[Transaction ID Wraparound Risk]
  I --> J[XID is 32-bit: wraps at 2.1 billion]
  J --> K[Old rows with xmin > current xid appear in the future]
  K --> L[VACUUM FREEZE: set xmin to FrozenTransactionId 2]
  L --> M[Frozen rows visible to all transactions forever]
```

### Pitfalls
- ❌ **Ignoring transaction ID wraparound warnings:** PostgreSQL will shut down automatically when approaching XID wraparound to prevent data corruption — monitor `pg_stat_user_tables.n_dead_tup` and `age(relfrozenxid)`
- ❌ **Not understanding why VACUUM can't always reclaim space:** VACUUM marks pages as free but doesn't return disk space to OS; `VACUUM FULL` reclaims disk but locks table — only use VACUUM FULL during maintenance windows

### Concept Reference

---

## Q8: How do you design a distributed transaction across PostgreSQL + Redis + Kafka?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P2 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand that true ACID across heterogeneous systems is impractical and know the saga/outbox patterns as alternatives.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Systems | PostgreSQL (orders) + Redis (inventory cache) + Kafka (events) |
| Requirement | Order creation must update all 3 atomically |
| Failure tolerance | Zero lost orders |

### Approach A — 2PC across all systems (not recommended)

```mermaid
graph TD
  A[2PC Coordinator] -->|PREPARE| B[PostgreSQL]
  A -->|PREPARE| C[Redis]
  A -->|PREPARE| D[Kafka]
  B --> E[Lock row]
  C --> F[Lock key]
  D --> G[Lock partition]
  A -->|COMMIT all| B
  A -->|COMMIT all| C
  A -->|COMMIT all| D
  H[Problem: Redis has no 2PC; Kafka has no 2PC] --> I[This is not implementable]
```

### Approach B — Outbox Pattern (recommended)

```mermaid
graph TD
  A[Order creation request]
  A --> B[PostgreSQL ACID transaction]
  B --> C[INSERT into orders table]
  B --> D[INSERT into outbox table: event=order_created]
  B --> E[COMMIT - both rows atomic]

  F[Outbox relay worker]
  F -->|Poll outbox table| G[Read unprocessed events]
  G -->|Publish to Kafka| H[Kafka: order_created event]
  G -->|Invalidate Redis| I[Redis: delete inventory key]
  G -->|Mark processed| J[UPDATE outbox SET processed=true]

  K[Downstream consumers] --> L[Update Redis from Kafka event]
  K --> M[Update inventory counts]
```

| Dimension | 2PC | Outbox Pattern |
|-----------|-----|----------------|
| Atomicity | Strong (if supported) | Eventual (~100ms) |
| Implementability | Impossible across Redis+Kafka | Fully implementable |
| Complexity | Very high | Medium |
| Failure recovery | Manual coordinator recovery | Auto-retry via Kafka |
| Data loss risk | Coordinator crash loses state | Zero (outbox in PostgreSQL) |

### Recommended Answer
Use the **Outbox pattern**: write the event to the same PostgreSQL transaction as the business operation. The outbox relay reads committed events and publishes to Kafka and invalidates Redis. This guarantees exactly-once delivery (idempotency key) and zero event loss because the outbox is part of the ACID PostgreSQL transaction.

### What a great answer includes
- [ ] Why 2PC is impossible with Redis (no XA support) and unreliable with Kafka (producer idempotency ≠ 2PC)
- [ ] Outbox relay idempotency: Kafka deduplication using event_id as idempotency key
- [ ] Redis cache invalidation vs update: invalidate (delete) is safer than update (avoids stale write ordering)
- [ ] At-least-once delivery: outbox relay may republish; consumers must be idempotent

### Pitfalls
- ❌ **Writing to Kafka before PostgreSQL COMMIT:** Kafka publish succeeds but PostgreSQL rolls back — Kafka has a phantom event; consumers process an order that doesn't exist
- ❌ **Not making Kafka consumers idempotent:** Outbox relay will retry on failure — consumers receive the same event twice; must handle duplicate order_created events gracefully

### Concept Reference

---

## Q9: What is the difference between 2PL and MVCC?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P2 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand the fundamental philosophical difference between lock-based (2PL) and version-based (MVCC) concurrency control.

### Answer in 60 seconds
- **2PL (Two-Phase Locking):** Acquiring phase — transaction acquires all needed locks; releasing phase — releases them at commit; reads block writes and vice versa; strong consistency, lower concurrency
- **MVCC:** Each write creates a new version; readers see a consistent snapshot without locking any rows; readers never block writers, writers never block readers; implemented by PostgreSQL, MySQL InnoDB, Oracle
- **Key difference:** 2PL is pessimistic (assume conflict, lock proactively); MVCC is optimistic for reads (assume no conflict, use versioning)
- **Throughput:** MVCC achieves 3–10x higher read throughput than 2PL under concurrent workloads because reads are never blocked

### Diagram

```mermaid
graph LR
  A[Concurrent Read + Write]
  A -->|2PL| B[Writer locks row]
  B --> C[Reader waits for lock]
  C --> D[Reader blocked until writer commits]

  A -->|MVCC| E[Writer creates new version]
  E --> F[Reader reads old version - no wait]
  F --> G[Both complete concurrently]
```

### Pitfalls
- ❌ **Thinking MVCC eliminates all locking:** MVCC eliminates read-write conflicts; write-write conflicts (two transactions updating same row) still require row-level locks even in MVCC systems
- ❌ **Assuming all databases use MVCC:** DB2 and SQL Server traditionally use lock-based (2PL); PostgreSQL, MySQL InnoDB, Oracle use MVCC — database selection matters for workload type

### Concept Reference

---

## Q10: You have a race condition causing double inventory deductions — fix it without table locks

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Scenario
**Real Company:** Common e-commerce platform challenge (Amazon, Shopify, eBay)

### The Brief
> "Your inventory service has a bug: two concurrent order requests for the same product both succeed when only 1 item is in stock. The current code reads inventory, checks if > 0, then deducts. Fix this race condition without locking the entire inventory table."

### Clarifying Questions to Ask First
1. What database are you using (PostgreSQL / MySQL)?
2. Is the inventory check and deduction in a single service or across microservices?
3. Can you tolerate occasional oversell with compensation, or must it be zero oversell?
4. What is the expected concurrency level — 10 concurrent requests or 10,000?

### Back-of-Envelope Estimation
| Metric | Value |
|--------|-------|
| Race window | Time between SELECT and UPDATE: ~1ms |
| Concurrent requests | 100/sec for same popular SKU |
| Probability of race without fix | 1 - (1 - 0.001)^100 ≈ 10% of requests could race |
| Target | 0 oversells |

### High-Level Architecture

```mermaid
graph TD
  A[BROKEN: Read-Check-Write - Race condition]
  A --> B[T1: SELECT stock WHERE sku=X → 1]
  A --> C[T2: SELECT stock WHERE sku=X → 1]
  B --> D[T1: stock > 0? Yes - proceed]
  C --> E[T2: stock > 0? Yes - proceed]
  D --> F[T1: UPDATE SET stock=0]
  E --> G[T2: UPDATE SET stock=0 - oversell!]

  H[FIXED: Atomic conditional update]
  H --> I[T1: UPDATE inventory SET stock=stock-1 WHERE sku=X AND stock > 0]
  H --> J[T2: UPDATE inventory SET stock=stock-1 WHERE sku=X AND stock > 0]
  I --> K[T1: 1 row affected - success]
  J --> L[T2: 0 rows affected - stock already 0 - fail gracefully]
```

### Trade-off Decisions
| Decision | Option A | Option B | Chosen | Why |
|----------|----------|----------|--------|-----|
| Locking strategy | SELECT FOR UPDATE (row lock) | Atomic conditional update | Atomic update | No explicit lock; single statement; same atomicity guarantee |
| Redis optimization | Check Redis before DB | Go straight to DB | Redis check first | Redis decrement is atomic; reduces DB load by 90% |
| Oversell tolerance | Zero oversell | Allow 1% oversell with compensation | Zero oversell | Requirement: refunds are expensive and damage trust |
| High concurrency | Queued reservation system | Optimistic retry | Queued reservation | At >1K req/sec per SKU, retry storms cause cascading load |

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| DB and Redis out of sync | Redis shows stock > 0 but DB = 0 | Use Redis as cache only; DB atomic update is source of truth |
| Redis DECR race | Redis goes to -1 | Check after decrement: if stock < 0, INCR back and reject |
| High retry rate under flash sale | 10K retries overload DB | Queue-based reservation with distributed lock (Redis SETNX) |

