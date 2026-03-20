---
title: "Databases Cheat Sheet"
description: "SQL vs NoSQL, indexing, replication, sharding, and query optimization quick reference"
---

# Databases Cheat Sheet

> Scan time: ~5 min. Every line is interview-relevant.

---

## 1. SQL vs NoSQL Decision Matrix

| Factor | SQL (Relational) | Document (MongoDB) | KV (Redis/DynamoDB) | Wide-Column (Cassandra) | Graph (Neo4j) | Time-Series (InfluxDB) |
|--------|------------------|--------------------|---------------------|-------------------------|---------------|------------------------|
| Schema | Fixed, enforced | Flexible, per-doc | None | Column families | Nodes + edges | Tag-based |
| Consistency | **ACID** | Tunable | Eventual / strong | Tunable (quorum) | ACID | Eventual |
| Scale | Vertical (+ read replicas) | Horizontal | **Horizontal** | **Horizontal** | Vertical | Horizontal |
| Query complexity | Complex JOINs, aggregations | Nested doc queries | Key lookups only | CQL (no JOINs) | Graph traversal | Time-range queries |
| Use case | Banking, payments, inventory | Catalogs, CMS, user profiles | Sessions, caches, leaderboards | IoT, logs, messaging | Social graphs, recommendations | Metrics, monitoring, analytics |
| Examples | PostgreSQL, MySQL, Aurora | MongoDB, Firestore | Redis, DynamoDB | Cassandra, HBase | Neo4j, Amazon Neptune | InfluxDB, TimescaleDB, Timestream |

**Use SQL when:** ACID transactions required (payments, inventory), complex JOINs needed, data is relational with foreign keys, strong consistency mandatory.

**Use NoSQL when:** **100M+ records**, horizontal write scale needed, flexible/evolving schema, document/graph/KV access patterns dominate.

---

## 2. ACID Properties

| Property | Meaning | Failure example if absent |
|----------|---------|--------------------------|
| **Atomicity** | All-or-nothing — full commit or full rollback | Transfer deducts $100 but never credits recipient |
| **Consistency** | DB constraints always maintained | Foreign key violation allowed, referential integrity broken |
| **Isolation** | Concurrent transactions don't interfere | Two users book last seat simultaneously |
| **Durability** | Committed data survives crashes | Power loss wipes last 1000 transactions |

### Isolation Levels

| Level | Dirty Reads | Non-Repeatable Reads | Phantom Reads | Performance |
|-------|-------------|----------------------|---------------|-------------|
| READ UNCOMMITTED | Allowed | Allowed | Allowed | Fastest |
| **READ COMMITTED** (default PG) | Prevented | Allowed | Allowed | Fast |
| **REPEATABLE READ** (default MySQL) | Prevented | Prevented | Allowed | Medium |
| SERIALIZABLE | Prevented | Prevented | Prevented | Slowest |

- **Dirty read**: read uncommitted data from another transaction
- **Non-repeatable read**: same row returns different value within one transaction
- **Phantom read**: re-query returns different set of rows (another tx inserted/deleted)

---

## 3. Indexing

| Index Type | Best For | Limitations |
|------------|----------|-------------|
| **B-tree** (default) | Range queries, =, >, <, ORDER BY, LIKE 'prefix%' | Not useful for: full-text, arbitrary LIKE |
| **Hash** | Exact equality only (`=`) | **No range queries, no ORDER BY** |
| **Composite** | Multi-column WHERE clauses | **Leading column rule** — must include leftmost column |
| **Covering / Index-only** | Query fully answered from index — **no table lookup** | Extra storage |
| **Partial** | `WHERE status = 'active'` — index subset of rows | Specific to condition |
| **Full-text** | Text search (`MATCH AGAINST`, `tsvector`) | Not for exact KV lookups |

### Key Rules

- **Composite index `(a, b, c)`**: usable for `WHERE a=`, `WHERE a= AND b=`, **not** `WHERE b=` alone
- **Covering index**: if all columns in SELECT + WHERE are in index → **zero table access**
- **Cardinality matters**: index on `gender` (2 values) → useless. Index on `email` (unique) → perfect
- Indexes slow **INSERT/UPDATE/DELETE** — each write updates all indexes on that table

### Traps

- `WHERE YEAR(created_at) = 2024` → **index not used** (function on column breaks index)
- Use: `WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'`
- `WHERE email = 123` (int vs varchar mismatch) → implicit cast → **index skipped**

---

## 4. Query Optimization

**Always start with:** `EXPLAIN ANALYZE <query>` — look for Seq Scan on large tables.

### N+1 Problem

```
// BAD — 1 query for posts + N queries for each author
posts = db.query("SELECT * FROM posts")
posts.forEach(p => db.query("SELECT * FROM users WHERE id = " + p.user_id))

// GOOD — 1 query with JOIN
db.query("SELECT posts.*, users.* FROM posts JOIN users ON posts.user_id = users.id")
```

### Pagination at Scale

```sql
-- BAD: OFFSET 100000 scans and discards 100k rows
SELECT * FROM posts ORDER BY id LIMIT 20 OFFSET 100000;

-- GOOD: cursor-based (O(log n) with index)
SELECT * FROM posts WHERE id > :last_id ORDER BY id LIMIT 20;
```

### Avoid These Patterns

| Anti-pattern | Fix |
|-------------|-----|
| `SELECT *` | Select only needed columns |
| `WHERE LOWER(email) = ?` | Store email lowercase, index that column |
| `WHERE status != 'deleted'` | Partial index: `WHERE status = 'active'` |
| Implicit type cast in WHERE | Match column type exactly |
| Too many indexes | Benchmark — writes get slower with each index |

---

## 5. Replication

| Mode | Sync | Reads | Writes | Failover | Use case |
|------|------|-------|--------|----------|----------|
| **Primary-Replica (async)** | Async | Scale reads | Primary only | Manual | Read-heavy apps |
| **Multi-AZ (sync)** | Sync | Primary only | Primary only | **Auto ~1-2 min** | HA / DR |
| **Read Replicas** | Async | Up to **5** (MySQL/PG), **15** (Aurora) | Primary only | N/A | Read scale-out |

**Replication lag trap:** Read replica can be 100ms–seconds behind. Critical reads (post-write) → **always route to primary**.

**Aurora advantage:** Up to **15** read replicas, sub-10ms replication lag, storage shared across all nodes.

---

## 6. Sharding

| Strategy | How | Pros | Cons |
|----------|-----|------|------|
| **Range** | `user_id 1–1M → shard1`, `1M–2M → shard2` | Range queries easy | **Hot spots** (new users flood last shard) |
| **Hash** | `hash(user_id) % num_shards` | Even distribution | **Range queries require scatter-gather** |
| **Directory** | Lookup table: key → shard ID | Flexible, relocatable | Lookup table = **single point of failure** |
| **Consistent hashing** | Hash ring, each shard owns an arc | **Minimal rebalancing** on add/remove | More complex |

**Consistent hashing used in:** Cassandra, Redis Cluster, DynamoDB, Memcached.

**Cross-shard operations are painful:** Avoid JOINs across shards. Denormalize data or use scatter-gather + application-level merge.

---

## 7. Connection Pooling

**Problem:** DB supports **100–500 max connections**. 1000 app instances × 10 connections = 10,000 → DB crashes.

| Pooler | Mode | Notes |
|--------|------|-------|
| **PgBouncer** | Transaction / session | Lightweight, most common for PostgreSQL |
| **RDS Proxy** | Session | AWS managed, IAM auth, SSL, **essential for Lambda** |
| **HikariCP** | App-level | Built into Spring Boot, fastest JVM pool |

**Pooling modes:**
- **Transaction pooling** (most efficient): connection returned to pool after each transaction — stateful features (SET, temp tables, prepared statements) **don't work**
- **Session pooling**: connection held for entire client session — stateful but fewer benefits

**Lambda trap:** Each cold start = new DB connection. **100 concurrent Lambdas = 100 new connections**. Always use RDS Proxy with Lambda.

---

## 8. CAP Theorem Applied

> In a network partition, choose **C** (consistency) or **A** (availability) — not both.

| Type | Databases | Behavior during partition |
|------|-----------|--------------------------|
| **CP** (Consistency + Partition tolerance) | PostgreSQL (single leader), HBase, ZooKeeper, etcd | Refuse writes, remain consistent |
| **AP** (Availability + Partition tolerance) | Cassandra, DynamoDB, CouchDB, Riak | Accept writes, resolve conflicts later |
| CA (no partition) | SQLite, single-node MySQL | Not distributed — partition impossible by design |

**Cassandra tuning:** `QUORUM` reads + `QUORUM` writes → strong consistency at write cost. `ONE` reads → max availability, may read stale.

---

## 9. DynamoDB Quick Reference

### Key Design

| Concept | Rule |
|---------|------|
| **Partition key** | Must be **high cardinality** — avoid `status`, `country`, `boolean` as PK |
| **Sort key** | Enables range queries within a partition: `WHERE pk = X AND sk BETWEEN a AND b` |
| **GSI** | New PK + optional SK, **eventually consistent**, add anytime |
| **LSI** | Same PK + new SK, **strongly consistent**, **must define at CREATE time** |

### Single-Table Design Pattern

```
Entity      PK              SK
User        USER#u123       PROFILE
Post        USER#u123       POST#2024-01-15T10:00
Comment     POST#p456       COMMENT#2024-01-15T11:00
```

Access patterns drive table design — model for queries, not for normalization.

### Key Numbers

| Limit | Value |
|-------|-------|
| Max item size | **400 KB** |
| Transaction limit | **25 items / 4 MB** per transaction |
| GSI count | **20 per table** |
| On-demand throughput | Auto-scales, higher cost |
| Provisioned throughput | Fixed RCU/WCU, cheaper at steady load |

**DAX (DynamoDB Accelerator):** Microsecond reads, write-through cache. **Not for strongly consistent reads** — DAX always returns eventually consistent cached data.

---

## 10. PostgreSQL vs MySQL vs DynamoDB vs Cassandra

| Feature | PostgreSQL | MySQL | DynamoDB | Cassandra |
|---------|------------|-------|----------|-----------|
| ACID | Full | Full (InnoDB) | Per-item / transactions (limited) | Per-row (Lightweight Transactions) |
| Horizontal scale | Read replicas only | Read replicas only | **Native** | **Native** |
| Consistency | Strong | Strong | Tunable (eventual / strong) | Tunable (ONE/QUORUM/ALL) |
| Schema | Strict | Strict | Schemaless | Schemaless (CQL defined) |
| JOINs | Full | Full | **None** | **None** |
| Best for | Analytics, complex queries, PostGIS | Web apps, high-read workloads | Serverless, variable scale | Write-heavy, time-series, IoT |
| AWS managed | **RDS / Aurora PostgreSQL** | **RDS / Aurora MySQL** | **DynamoDB** | **Keyspaces** |

---

## 11. Database Scaling Ladder

Start here — move down only when you've exhausted the current step:

```
1. Add indexes              → 10x read speedup, zero infra cost
2. Add read replicas        → read scale-out, async replication
3. Caching layer (Redis)    → reduce DB load by 80–95%
4. Vertical scaling         → more RAM (buffer pool), faster CPU
5. Connection pooling       → handle 10x more app instances
6. Read/write split         → dedicate replicas to reporting queries
7. Sharding                 → horizontal write scale-out
8. Archive/TTL old data     → reduce table size, faster scans
9. Async writes via queue   → absorb write spikes, decouple producers
```

**Rule of thumb:** Most apps never need sharding. Get to step 4–5 before considering step 7.

---

## Deep Dives

- [SQL vs NoSQL](../12-interview-prep/quick-reference/databases/sql-vs-nosql)
- [Indexing Strategies](../12-interview-prep/quick-reference/databases/indexing-strategies)
- [Query Optimization](../12-interview-prep/quick-reference/databases/query-optimization)
- [Database Replication](../12-interview-prep/quick-reference/databases/database-replication)
- [Connection Pooling](../12-interview-prep/quick-reference/databases/connection-pooling)
- [Scaling Strategies](../12-interview-prep/quick-reference/databases/scaling-strategies)
- [DynamoDB (AWS)](../12-interview-prep/quick-reference/aws-cloud/dynamodb-nosql)
- [RDS on AWS](../12-interview-prep/quick-reference/aws-cloud/rds-databases)
