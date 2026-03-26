---
title: "Database Consistency Models"
layer: interview-q
section: interview-prep/question-bank/databases
difficulty: advanced
tags: [databases, consistency, distributed-systems, linearizability, eventual-consistency, crdt]
---

# Database Consistency Models

6 questions covering strong vs eventual vs causal consistency, linearizability, read-your-writes, session consistency, CockroachDB serializable isolation, and CRDTs.

---

## Q1: What is the difference between strong consistency, eventual consistency, and causal consistency?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can define each model with a concrete example and explain the latency-consistency trade-off — not just recite definitions.

### Answer in 60 seconds
- **Strong consistency:** Every read returns the most recently written value; all nodes see writes in the same order; requires coordination on every write (consensus); adds 50–200ms RTT for geo-distributed systems
- **Eventual consistency:** Writes propagate asynchronously; replicas converge to the same state given no new writes; reads may return stale data for seconds to minutes; used by DynamoDB, Cassandra by default
- **Causal consistency:** If operation A causes operation B, all nodes see A before B; unrelated operations may arrive in any order; more consistency than eventual, less than strong; used by MongoDB causal sessions, Facebook TAO
- **Real numbers:** Strong consistency → 150ms cross-region RTT; eventual consistency → <5ms local read but up to 500ms stale; causal consistency → ~20ms with vector clocks

### Diagram

```mermaid
graph TD
  A[Consistency Models - Weakest to Strongest]

  B[Eventual Consistency]
  B --> C[Writes: async replication - no wait]
  C --> D[Reads: may return stale value - up to 500ms lag]
  D --> E[Used by: DynamoDB, Cassandra default]

  F[Causal Consistency]
  F --> G[Writes: track causal dependencies with vector clocks]
  G --> H[Reads: guaranteed to see all causally prior writes]
  H --> I[Used by: MongoDB causal sessions, Facebook TAO]

  J[Strong Consistency]
  J --> K[Writes: wait for majority quorum before acknowledging]
  K --> L[Reads: always return latest committed value]
  L --> M[Used by: PostgreSQL, CockroachDB, Spanner]
```

### Trade-off Table

```mermaid
graph TD
  A[Choosing Consistency Level]
  A --> B{Can users tolerate seeing stale data?}
  B -->|Never: financial, inventory| C[Strong Consistency]
  B -->|Briefly OK: social feeds, likes| D[Eventual Consistency]
  B -->|Must see own writes but not others| E[Read-your-writes]
  B -->|Must see causally related writes| F[Causal Consistency]
```

| Model | Read Latency | Write Latency | Stale Read Risk | System Examples |
|-------|-------------|---------------|-----------------|-----------------|
| Strong | 5–200ms (regional) | 50–200ms (geo) | Zero | PostgreSQL, Spanner, CockroachDB |
| Causal | 5–30ms | 20–50ms | No (for causal chain) | MongoDB causal, Facebook TAO |
| Eventual | 1–5ms | 1–5ms | Yes (up to minutes) | DynamoDB, Cassandra, Redis replicas |

### Pitfalls
- ❌ **Assuming eventual consistency means "eventually correct":** Eventual consistency says replicas *converge* — it does NOT guarantee correctness if there are conflicting writes; last-write-wins may silently drop data
- ❌ **Choosing strong consistency for all use cases:** A social media "likes" counter doesn't need strong consistency — using eventual consistency saves 150ms per write at the cost of ±1 like lag, which is unnoticeable to users

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q2: What does linearizability mean — why is it the gold standard for distributed consistency?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P0 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand linearizability precisely — not as a synonym for "strong consistency" but as the specific formal property that makes distributed systems behave like a single machine.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Nodes | 3 replicas across 2 data centers |
| Network RTT between DCs | 80ms |
| Concurrent clients | 1,000 reads/writes per second |
| Consistency requirement | Every read returns the latest write, regardless of which replica serves it |

### What Linearizability Means

```mermaid
sequenceDiagram
  participant C1 as Client 1
  participant C2 as Client 2
  participant R1 as Replica 1 (Primary)
  participant R2 as Replica 2

  C1->>R1: WRITE x=1 (committed at T=100ms)
  R1-->>C1: OK

  C2->>R2: READ x (at T=101ms)
  Note over R2: Linearizable: must return x=1 even from replica
  R2-->>C2: x=1

  Note over C1,R2: Non-linearizable (eventual): R2 may return x=0 until replication catches up
```

### Linearizability vs Sequential Consistency

```mermaid
graph TD
  A[Linearizability - real-time order matters]
  A --> B[If write W completes before read R starts in real time]
  B --> C[R must return W or a later value]
  C --> D[Every operation appears to take effect at one instant between call and return]

  E[Sequential Consistency - program order matters]
  E --> F[All nodes see operations in SAME order]
  F --> G[But that order need not match real-world clock]
  G --> H[Weaker: writes may appear delayed but globally consistent order]

  I[Example where they differ]
  I --> J[Client 1 writes x=1 at T=100ms]
  I --> K[Client 2 reads x at T=101ms from replica]
  J --> L[Linearizable: must see x=1]
  K --> L
  J --> M[Sequentially consistent: may see x=0 IF all nodes agree to order it before write]
```

### Implementation Cost

```mermaid
graph TD
  A[Achieving Linearizability requires]
  A --> B[Consensus protocol on every write: Paxos or Raft]
  B --> C[Write waits for majority of nodes to acknowledge]
  C --> D[Majority = 2 of 3 nodes must confirm before client sees OK]

  E[Latency cost]
  E --> F[Single DC: 1ms RTT x 1 round = 1ms overhead]
  E --> G[Multi-DC: 80ms RTT x 1 round = 80ms overhead]
  E --> H[Network partition: system becomes unavailable - CAP theorem]

  I[Read linearizability also costly]
  I --> J[Read from primary only - no stale replicas]
  I --> K[OR: read with quorum - majority must agree on latest value]
  K --> L[Spanner: True Time + 2 phase commit achieves this]
```

| Property | Linearizable | Sequential | Eventual |
|----------|-------------|------------|---------|
| Real-time ordering | Yes | No | No |
| Global order agreement | Yes | Yes | Eventually |
| Availability on partition | No (CAP) | No | Yes |
| Write latency | High (consensus) | Medium | Low |
| Real systems | etcd, Zookeeper, Spanner | Older distributed DBs | Cassandra, DynamoDB |

### What a great answer includes
- [ ] CAP theorem connection: linearizability = Consistency in CAP — you must sacrifice it or Availability during network partition
- [ ] Why etcd/Zookeeper use it: configuration, leader election, distributed locks require linearizability — a wrong leader election can destroy a cluster
- [ ] Spanner's True Time: Google's TrueTime API provides bounded clock uncertainty (±7ms) — Spanner uses commit-wait to ensure linearizability across globally distributed nodes
- [ ] Read path: linearizable reads must read from the primary or use quorum reads — stale replica reads violate linearizability

### Pitfalls
- ❌ **Equating linearizability with ACID:** ACID transactions can be non-linearizable; a database can be linearizable without full ACID — they are orthogonal properties (linearizability is about cross-client ordering; ACID is about transaction atomicity)
- ❌ **Implementing linearizable reads by reading from the primary without lease:** Primary may be a stale ex-primary after a leader election — use lease-based reads (Raft ReadIndex) to ensure you're reading from the actual current leader

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q3: What is read-your-writes consistency and how does it affect caching strategies?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand the specific consistency guarantee users expect — you always see your own writes — and the cache invalidation challenge it creates.

### Answer in 60 seconds
- **Definition:** After a client performs a write, all subsequent reads by the SAME client return that write or a later value; other clients may still see the old value (eventual consistency for them)
- **Why it matters:** Users who submit a form and immediately reload the page must see their own submission — otherwise they assume the write failed and submit again (double write)
- **Implementation options:** (1) Route same user to same replica (sticky sessions); (2) piggyback write timestamp on response, reject reads from replicas lagging behind that timestamp; (3) always read from primary for 5 seconds after a write
- **Cache interaction:** If user writes to DB and cache serves stale data, read-your-writes is violated; fix with write-through cache or short TTL (500ms) after user's own writes

### Diagram

```mermaid
sequenceDiagram
  participant User
  participant App
  participant DB_Primary as DB Primary
  participant DB_Replica as DB Replica (200ms lag)
  participant Cache as Redis Cache

  User->>App: POST /update-profile name=NewName
  App->>DB_Primary: UPDATE users SET name=NewName WHERE id=123
  DB_Primary-->>App: OK (replication lag: replica has old data for ~200ms)

  User->>App: GET /profile (100ms later)
  App->>Cache: GET user:123
  Cache-->>App: name=OldName (stale! read-your-writes violated)
  App-->>User: Shows OldName - user thinks update failed

  Note over App,Cache: Fix: invalidate cache on write OR route user to primary for 5s
```

### Cache Strategy Fix

```mermaid
graph TD
  A[Read-Your-Writes with Cache - Fix Options]

  B[Option 1: Invalidate cache on write]
  B --> C[On successful DB write: DELETE cache key user:123]
  C --> D[Next read: cache miss - fetch from DB primary]
  D --> E[Repopulate cache with fresh data]
  E --> F[Downside: thundering herd if many users write simultaneously]

  G[Option 2: Write timestamp token]
  G --> H[Write returns token: version=1050]
  H --> I[Client sends version=1050 on next read]
  I --> J[App checks: replica at version 1060 - serve from replica]
  J --> K[If replica at version 1020: route to primary instead]

  L[Option 3: Sticky routing for 5 seconds]
  L --> M[After write: set user cookie primary_read_until=now+5s]
  M --> N[All reads within 5s go to primary]
  N --> O[After 5s: replica has caught up - serve from replica again]
```

### Pitfalls
- ❌ **Using cache TTL of 60s after user writes:** A 60-second stale window means users see old data for a full minute after their own update — use 500ms or invalidate explicitly
- ❌ **Routing all reads to primary to guarantee read-your-writes:** This defeats the purpose of read replicas — 100% of read traffic hits the primary; use one of the targeted strategies above

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q4: What is session consistency — how does DynamoDB implement it?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand session consistency as a practical middle ground between eventual and strong consistency and can explain DynamoDB's specific mechanism.

### Answer in 60 seconds
- **Session consistency:** Within a single client session, reads are guaranteed to reflect all writes made in that same session; across sessions (different users), eventual consistency applies
- **Stronger than eventual:** Eventual consistency allows any replica to serve reads; session consistency guarantees reads within a session see the same or newer state than the last write
- **DynamoDB implementation:** By default DynamoDB reads are eventually consistent (fastest/cheapest); to get session consistency use `ConsistentRead=true` on reads — DynamoDB routes read to the partition leader (primary) which has the latest committed write
- **Token approach:** DynamoDB Global Tables use a replication token — write returns a global version number; subsequent reads include this token to wait for replicas to catch up before serving
- **Cost:** Consistent reads cost 2x read capacity units vs eventually consistent reads; latency increases by ~5ms for cross-AZ coordination

### Diagram

```mermaid
sequenceDiagram
  participant App
  participant DDB_Leader as DynamoDB Partition Leader
  participant DDB_Replica as DynamoDB Replica (50ms lag)

  Note over App,DDB_Replica: Eventual Consistency (default)
  App->>DDB_Replica: GetItem (eventually consistent)
  DDB_Replica-->>App: old value (50ms stale - OK for most cases)

  Note over App,DDB_Replica: Session Consistency (ConsistentRead=true)
  App->>DDB_Leader: PutItem key=X value=NewVal
  DDB_Leader-->>App: OK + version token=1050

  App->>DDB_Leader: GetItem key=X ConsistentRead=true
  Note over DDB_Leader: Routes to partition leader - has latest committed data
  DDB_Leader-->>App: NewVal (guaranteed - same leader served the write)
```

### DynamoDB Consistency Options Comparison

```mermaid
graph TD
  A[DynamoDB Consistency Choices]

  B[Eventually Consistent Read default]
  B --> C[Routes to any replica - any AZ]
  C --> D[Cost: 0.5 Read Capacity Units per 4KB]
  D --> E[Latency: single-digit ms]
  E --> F[Stale risk: up to 100ms behind]

  G[Strongly Consistent Read ConsistentRead=true]
  G --> H[Routes to partition leader only]
  H --> I[Cost: 1 Read Capacity Unit per 4KB - 2x expensive]
  I --> J[Latency: 5-10ms higher]
  J --> K[Stale risk: zero]

  L[Transactional Read TransactGetItems]
  L --> M[ACID read across multiple items]
  M --> N[Cost: 2 Read Capacity Units per 4KB - 4x]
  N --> O[Latency: 10-20ms higher]
  O --> P[Use for: cart checkout, balance check]
```

### Pitfalls
- ❌ **Using ConsistentRead=true everywhere to be safe:** 2x capacity cost on read-heavy tables doubles the bill; use consistent reads only where session consistency is required (e.g., right after a user write), not for analytics or search queries
- ❌ **Assuming DynamoDB Streams give session consistency:** DynamoDB Streams are eventually consistent; a consumer reading a stream may process events out of order relative to the write — use DynamoDB Transactions for true session consistency across multiple items

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q5: How does CockroachDB achieve serializable isolation across geo-distributed nodes?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand how modern distributed databases achieve both ACID and geo-distribution using consensus protocols — not just that "it uses Raft."

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Nodes | 9 nodes across 3 regions: US-East, EU-West, APAC |
| Replication | 3 replicas per range (Raft consensus) |
| Isolation | Serializable (strictest) |
| Target write latency | p99 < 200ms cross-region |

### Architecture Overview

```mermaid
graph TD
  A[CockroachDB Architecture for Geo-Distributed ACID]

  B[Data partitioned into ranges - 512MB each]
  B --> C[Each range replicated to 3 nodes via Raft]

  D[Write path]
  D --> E[Client writes to any node - gateway node]
  E --> F[Gateway routes to range leaseholder - current Raft leader]
  F --> G[Leaseholder proposes to Raft group - 3 nodes]
  G --> H[Majority 2 of 3 must acknowledge - one RTT]
  H --> I[Write committed - leaseholder responds to gateway]
  I --> J[Gateway responds to client]

  K[Cross-range transactions]
  K --> L[CockroachDB uses 2-phase commit across range leaseholders]
  L --> M[Coordinator = first range involved]
  M --> N[Phase 1: write intents to all ranges]
  N --> O[Phase 2: commit or abort - based on all ranges confirming]
```

### Serializable Isolation via HLC

```mermaid
sequenceDiagram
  participant C1 as Client 1 (US-East)
  participant C2 as Client 2 (EU-West)
  participant Node1 as Node US-East (Leaseholder for Range A)
  participant Node2 as Node EU-West (Leaseholder for Range B)

  C1->>Node1: BEGIN at HLC timestamp T=1000
  C2->>Node2: BEGIN at HLC timestamp T=1001

  C1->>Node1: READ x=5 (snapshot at T=1000)
  C2->>Node2: WRITE x=10 (commits at T=1001)

  C1->>Node1: WRITE y=x+1=6 (using read value x=5)
  Node1->>Node1: Detect conflict: C2 wrote x=10 after C1's read snapshot
  Node1-->>C1: Serialization conflict - retry transaction

  Note over C1,Node2: HLC = Hybrid Logical Clock - wall clock + logical counter
  Note over C1,Node2: Ensures causal ordering across nodes without GPS clock
```

### Leaseholder and Raft

```mermaid
graph TD
  A[Raft Consensus per Range]
  A --> B[One leaseholder per range - handles all reads and writes for that range]
  B --> C[Leaseholder lease: 9 seconds - renewable]
  C --> D[Reads: served locally by leaseholder - no Raft round trip needed]
  D --> E[Reads are linearizable: leaseholder has authoritative latest value]

  F[What happens when leaseholder fails]
  F --> G[Raft elects new leader from remaining 2 replicas]
  G --> H[Election timeout: 300ms default]
  H --> I[New leaseholder starts serving - RPO = 0, RTO = 300ms]

  J[Follower reads - optional optimization]
  J --> K[Non-leaseholder can serve reads with timestamp bound]
  K --> L[Stale read but avoids cross-region hop]
  L --> M[Tradeoff: 10ms stale vs 80ms cross-region RTT]
```

| Dimension | PostgreSQL | CockroachDB | Google Spanner |
|-----------|-----------|------------|----------------|
| Isolation | Serializable (SSI) | Serializable (HLC + SSI) | Serializable (TrueTime) |
| Distribution | Single-node or Citus | Native multi-region | Native global |
| Clock mechanism | System clock | Hybrid Logical Clock | GPS + atomic clocks (TrueTime) |
| Cross-region write latency | N/A (single node) | ~80–200ms | ~100–200ms |
| Automatic failover | Patroni/external | Built-in Raft | Built-in Paxos |

### What a great answer includes
- [ ] HLC (Hybrid Logical Clock): combines wall clock with logical counter — ensures causality without GPS; CockroachDB's alternative to Spanner's TrueTime
- [ ] Write intents: CockroachDB writes "intents" (provisional records) during 2PC; readers encountering an intent wait or push the conflicting transaction
- [ ] Leaseholder placement: you can configure leaseholder preference per region to minimize read latency (e.g., EU users' leaseholders prefer EU nodes)
- [ ] Follower reads: setting `AS OF SYSTEM TIME -10s` allows reads from any follower — trades 10 seconds staleness for avoiding cross-region hop

### Pitfalls
- ❌ **Assuming Raft alone gives serializable isolation:** Raft provides consensus for replication (durability + linearizability per range); serializable isolation across ranges requires the additional SSI (Serializable Snapshot Isolation) layer on top
- ❌ **Placing all leaseholders in one region for simplicity:** Majority of writes go cross-region for all other-region clients — co-locate leaseholders with the primary writer region; use multi-region table configuration for globally even traffic

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q6: What is CRDT and how does it achieve eventual consistency without coordination?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P2 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand CRDTs as a mathematical solution to conflict-free merging — where convergence is guaranteed by data structure design, not coordination protocols.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| System | Collaborative document editor — Google Docs style |
| Nodes | 5 geo-distributed replicas |
| Requirement | All replicas converge to the same document state |
| Constraint | No coordination on writes — full availability |

### What Makes a CRDT

```mermaid
graph TD
  A[CRDT - Conflict-free Replicated Data Type]
  A --> B[Two categories]

  B --> C[CvRDT - Convergent CRDT - State-based]
  C --> D[Nodes exchange full state]
  D --> E[Merge function: commutative, associative, idempotent]
  E --> F[Any merge order produces same result]

  B --> G[CmRDT - Commutative CRDT - Operation-based]
  G --> H[Nodes exchange operations not full state]
  H --> I[Operations must be commutative: A then B = B then A]
  I --> J[Requires exactly-once delivery channel]
```

### CRDT Examples

```mermaid
graph TD
  A[G-Counter - Grow-only Counter]
  A --> B[Each node has its own counter slot]
  B --> C[Node 1: counter = 5, Node 2: counter = 3, Node 3: counter = 2]
  C --> D[Merge: take max per node slot]
  D --> E[Total = sum of max values = 5+3+2 = 10]
  E --> F[Never decrements - always converges]

  G[OR-Set - Observed-Remove Set]
  G --> H[Each add operation tagged with unique ID]
  H --> I[Remove removes specific tag not the value]
  I --> J[Concurrent add and remove: add wins for that tag]
  J --> K[Converges without coordination - conflict impossible by design]

  L[LWW-Element-Set - Last-Write-Wins]
  L --> M[Each element tagged with timestamp]
  M --> N[Merge: highest timestamp wins]
  N --> O[Concurrent writes: higher timestamp survives]
  O --> P[Risk: requires synchronized clocks - use HLC]
```

### Collaborative Editing with CRDT

```mermaid
sequenceDiagram
  participant User1 as User 1 (EU)
  participant Node1 as Node EU
  participant Node2 as Node US
  participant User2 as User 2 (US)

  Note over User1,User2: Both users edit offline (network partition)
  User1->>Node1: Insert 'Hello' at position 0 (op-id: EU-1)
  User2->>Node2: Insert 'World' at position 0 (op-id: US-1)

  Note over Node1,Node2: Network reconnects - operations exchanged
  Node1->>Node2: Broadcast op EU-1: Insert 'Hello'
  Node2->>Node1: Broadcast op US-1: Insert 'World'

  Note over Node1,Node2: Both nodes apply both ops deterministically
  Note over Node1: Result: 'Hello World' (EU-1 < US-1 by ID order)
  Note over Node2: Result: 'Hello World' (same deterministic order)
  Note over Node1,Node2: Converged to same state without coordination
```

| CRDT Type | Use Case | Convergence Guarantee | Real Systems |
|-----------|----------|----------------------|--------------|
| G-Counter | View counts, analytics | Max-merge per node | Redis, Riak |
| PN-Counter | Inventory (add/remove) | G-Counter pairs | Riak, Cassandra counters |
| OR-Set | Shopping cart, tags | Unique-ID tagged ops | Amazon Dynamo |
| LWW-Register | User profile, settings | Last timestamp wins | Cassandra cells |
| RGA (Sequence) | Collaborative text | Unique position IDs | Google Docs, Figma |

### What a great answer includes
- [ ] Mathematical foundation: CRDTs form a join-semilattice — any merge order produces the same least-upper-bound result; this is the formal guarantee of convergence
- [ ] Trade-offs: CRDTs sacrifice rich semantics — a G-Counter can never decrement; OR-Set "add wins" over concurrent removes may surprise users who expect remove to be final
- [ ] Tombstones: OR-Set and sequence CRDTs accumulate tombstones for removed elements — garbage collection requires coordination (the only coordination in a CRDT system)
- [ ] Figma uses RGA (Replicated Growable Array) for collaborative vector editing — each shape insertion/deletion is a CRDT operation; no server round-trip needed for real-time collaboration

### Pitfalls
- ❌ **Choosing CRDTs for financial data:** CRDTs are eventually consistent by design — two concurrent withdrawals from the same account could both succeed; financial systems need strong consistency, not CRDTs
- ❌ **Ignoring tombstone accumulation:** An OR-Set CRDT that processes 1M add/remove operations over 6 months accumulates 1M tombstones — without garbage collection, memory grows unbounded; plan GC with a coordinator election phase

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)
