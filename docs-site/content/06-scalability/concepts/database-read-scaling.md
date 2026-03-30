---
title: "Database Read Scaling: Read Replicas, Connection Routing, and Replication Lag"
date: "2026-03-18"
category: "system-design-playbook"
subcategories: ["databases", "scalability", "postgresql"]
personas: ["Mid-level Engineer", "Senior Engineer", "Tech Lead", "Staff Engineer", "Principal Engineer"]
tags: ["read-replicas", "pgbouncer", "proxysql", "replication-lag", "connection-pooling", "cqrs", "read-write-split"]
description: "Scale database reads beyond a single primary using read replicas, connection routing with pgBouncer/ProxySQL, and replication lag management."
reading_time: "22 min"
difficulty: "senior"
status: "published"
featured_image: "/assets/diagrams/database-read-scaling.png"
---

# Database Read Scaling: Read Replicas, Connection Routing, and Replication Lag

## 🗺️ Quick Overview

```mermaid
graph TD
    APP[Application] --> POOL[Connection Pool<br/>pgBouncer / ProxySQL]
    POOL --> PRIMARY[(Primary<br/>Writes only)]
    POOL --> R1[(Replica 1<br/>Reads)]
    POOL --> R2[(Replica 2<br/>Reads)]
    POOL --> R3[(Replica 3<br/>Reads)]
    PRIMARY -->|WAL Streaming| R1
    PRIMARY -->|WAL Streaming| R2
    PRIMARY -->|WAL Streaming| R3
    R1 --> LAG[Replication Lag<br/>SLO Check]
```

*A connection proxy routes writes to the primary and distributes reads across replicas; replication lag determines which reads are safe to offload.*

**Most applications are read-heavy: 90% reads, 10% writes is common. Yet most teams only scale the write path. The result is a primary database at 100% CPU while replicas sit idle at 5% — and users experiencing timeouts.**

This article covers every layer of the read-scaling stack, from physical replication to application-layer routing to the replication lag SLOs that determine which reads can safely go to replicas.

---

## The Problem Class `[Mid]`

An e-commerce platform handles 50k product page views per minute. Each page view triggers 8 database queries (product details, inventory, reviews, recommendations, user history, pricing, shipping, promotions). That's 400k queries/minute, or ~6,700 QPS.

```
Single PostgreSQL primary:
  Hardware: 32 vCPU, 128GB RAM, 4TB NVMe
  Benchmark capacity: ~10,000 QPS (simple reads)
  Headroom: 33% above current load

  Problem: 3 months until peak season (2× traffic)
  At 2× traffic: 13,400 QPS — primary is saturated
```

Vertical scaling (larger instance): the next tier up (64 vCPU) costs 2× but provides only ~1.4× query throughput due to lock contention and diminishing returns. There's no instance size that gives 3× throughput at 3× cost — the relationship is sublinear.

The answer is horizontal read scaling: distribute read queries across multiple replicas.

```mermaid
graph TD
    APP["Application\n50k page views/min"] --> LB["Connection Router\n(pgBouncer / ProxySQL)"]
    LB -->|"Writes"| PRI["Primary\n(writes + critical reads)\n2,000 QPS"]
    LB -->|"Reads"| R1["Replica-1\n(product, catalog reads)\n2,200 QPS"]
    LB -->|"Reads"| R2["Replica-2\n(reviews, social reads)\n2,200 QPS"]
    LB -->|"Reads"| R3["Replica-3\n(analytics, reporting)\n2,300 QPS"]
    PRI -->|"Streaming replication"| R1
    PRI -->|"Streaming replication"| R2
    PRI -->|"Streaming replication"| R3
```

---

## Why the Obvious Solution Fails `[Senior]`

### Application-Level Read/Write Split (Without Pooling)

The first attempt: add a "read replica URL" to your ORM configuration and route reads there.

```python
# Django settings — naive read/write split
DATABASES = {
    'default': {'HOST': 'primary.db.internal', ...},
    'replica': {'HOST': 'replica.db.internal', ...}
}

# Using django-db-router
class PrimaryReplicaRouter:
    def db_for_read(self, model, **hints):
        return 'replica'  # All reads go to replica

    def db_for_write(self, model, **hints):
        return 'default'  # All writes go to primary
```

**Problems:**

1. **Replication lag breaks read-your-own-write**: User posts a comment → write to primary → immediately reads their comment list from replica → comment not there (replica is 200ms behind) → user sees stale feed. "Did my post go through?"

2. **Connection count explosion**: 100 application pods × 1 connection to primary × 1 connection to each replica × 3 replicas = 400 connections. At 500 pods: 2,000 connections. PostgreSQL default max: 100. Even at max_connections=500, you're at the limit with no headroom.

3. **No health awareness**: If replica-1 is behind by 30 seconds, your router doesn't know — it keeps sending reads there regardless.

---

## The Solution Landscape `[Senior]`

### Solution 1: pgBouncer for Connection Pooling + Read Routing

**What it is**

pgBouncer is a lightweight PostgreSQL connection pooler that multiplexes thousands of application connections onto a small pool of actual PostgreSQL connections. A single pgBouncer instance can handle 10,000 client connections while maintaining only 20-50 server connections.

**How it actually works at depth**

```ini
# pgbouncer.ini — two pools: primary (writes) and replica (reads)

[databases]
primary  = host=primary.db.internal  port=5432 dbname=myapp
replica1 = host=replica1.db.internal port=5432 dbname=myapp
replica2 = host=replica2.db.internal port=5432 dbname=myapp

[pgbouncer]
pool_mode = transaction         # Return connection to pool after each transaction
max_client_conn = 10000         # Application-facing connections
default_pool_size = 25          # Actual server connections per pool
min_pool_size = 5
reserve_pool_size = 5           # Emergency connections for queued clients
server_idle_timeout = 600       # Close idle server connections after 10 min

# Authentication
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
```

```python
# Application connection routing with pgBouncer
class DatabaseRouter:
    def __init__(self):
        # Point to pgBouncer, not directly to PostgreSQL
        self.primary = create_engine(
            "postgresql://app:pass@pgbouncer:5432/primary",
            pool_size=5,          # Application-side pool (pgBouncer handles the rest)
            max_overflow=10
        )
        self.replicas = [
            create_engine(f"postgresql://app:pass@pgbouncer:5432/replica{i}")
            for i in range(1, 4)
        ]
        self._replica_index = 0

    def get_read_connection(self, consistency: str = "eventual"):
        if consistency == "strong":
            # Read from primary if read-your-own-write required
            return self.primary
        # Round-robin across replicas
        replica = self.replicas[self._replica_index % len(self.replicas)]
        self._replica_index += 1
        return replica

    def get_write_connection(self):
        return self.primary
```

**Sizing guidance** `[Staff+]`

```
pgBouncer sizing:
  max_client_conn: set to total expected app connections
    = app_pods × connections_per_pod
    = 100 pods × 20 conn/pod = 2000 max_client_conn

  default_pool_size: PostgreSQL max_connections / (pgBouncer instances × db_pools)
    PostgreSQL max_connections = 200
    pgBouncer instances = 2 (for HA)
    DB pools = 4 (1 primary + 3 replicas)
    pool_size = 200 / (2 × 4) = 25 per pool

  Transaction mode vs. session mode:
    Transaction mode: connection returned to pool after each transaction
      - Best for OLTP (90% use case)
      - Incompatible with: SET commands, advisory locks, LISTEN/NOTIFY
    Session mode: connection held for entire client session
      - Compatible with all PostgreSQL features
      - Less efficient (application holds connection even when idle)

Connection ratio improvement:
  Without pgBouncer: 500 pods × 4 connections = 2000 server connections
  With pgBouncer (transaction mode): 2000 client connections → 25 server connections/pool
  Reduction: 80× fewer actual database connections
```

**Configuration decisions that matter** `[Staff+]`

- `server_check_query`: Set to `SELECT 1` — pgBouncer validates server connections before use
- `server_reset_query`: Set to `DISCARD ALL` in session mode to clear session state between clients
- `server_fast_close`: Enable — immediately close server connections when PostgreSQL sends a signal (for graceful reload)
- Enable `stats_users` for monitoring: `show pools;` gives per-pool connection counts and wait times

**Failure modes** `[Staff+]`

- **Client wait queue overflow**: `max_client_conn` reached → new connections rejected with "too many clients." Set `max_client_conn` conservatively; use circuit breakers in application to avoid piling up.
- **Replica lag blind routing**: pgBouncer doesn't check replica lag. If replica1 is 60s behind, pgBouncer still routes reads there. Solution: application-side lag check (see Replication Lag section below).
- **Authentication passthrough**: pgBouncer uses its own auth file, not PostgreSQL roles. User rotation requires updating both pgBouncer and PostgreSQL.

---

### Solution 2: ProxySQL for MySQL Read/Write Split

**What it is**

ProxySQL is the MySQL equivalent of pgBouncer with built-in read/write splitting logic based on query analysis.

```ini
# ProxySQL configuration — auto-detect read vs write queries
[mysql_query_rules]
rule_id=1
active=1
match_pattern="^SELECT"          # Any SELECT query
destination_hostgroup=20          # Read hostgroup (replicas)
apply=1

rule_id=2
active=1
match_pattern=".*"               # Everything else
destination_hostgroup=10          # Write hostgroup (primary)
apply=1

[mysql_servers]
hostgroup_id=10, hostname=primary.db.internal, port=3306
hostgroup_id=20, hostname=replica1.db.internal, port=3306
hostgroup_id=20, hostname=replica2.db.internal, port=3306

# Replication lag awareness
[mysql_servers]
max_replication_lag=30  # Don't route to replica if lag > 30s
```

**Sizing guidance** `[Staff+]`

```
ProxySQL connection sizing:
  max_connections (per thread): target 10-50 connections per backend
  mysql-threads: typically 4 × CPU cores

  Throughput: 1 ProxySQL instance handles ~100,000 QPS
  For > 100k QPS: deploy 2+ ProxySQL instances behind a TCP load balancer

  Query analysis overhead: ~0.1ms per query (regex matching on query text)
  Disable for ultra-low-latency paths; use explicit routing hints instead
```

---

### Solution 3: Replication Lag Management `[Staff+]`

**What it is**

PostgreSQL streaming replication is asynchronous by default. The primary writes to WAL (Write-Ahead Log) and replication happens in the background. Replicas are always some milliseconds to seconds behind the primary.

**Measuring replication lag:**

```sql
-- On primary: check lag per replica
SELECT
    application_name,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn)) AS send_lag,
    pg_size_pretty(pg_wal_lsn_diff(sent_lsn, write_lsn)) AS write_lag,
    pg_size_pretty(pg_wal_lsn_diff(write_lsn, flush_lsn)) AS flush_lag,
    pg_size_pretty(pg_wal_lsn_diff(flush_lsn, replay_lsn)) AS replay_lag,
    write_lag AS write_lag_time,
    flush_lag AS flush_lag_time,
    replay_lag AS replay_lag_time
FROM pg_stat_replication;
```

```python
# Application-side lag check before routing to replica
class LagAwareRouter:
    def __init__(self, primary, replicas: list, max_lag_ms: int = 500):
        self.primary = primary
        self.replicas = replicas
        self.max_lag_ms = max_lag_ms
        self.lag_cache = {}  # replica -> (lag_ms, checked_at)
        self.lag_cache_ttl = 5  # check lag every 5 seconds

    def get_available_replicas(self) -> list:
        now = time.time()
        available = []
        for replica in self.replicas:
            cached = self.lag_cache.get(id(replica))
            if cached:
                lag_ms, checked_at = cached
                if now - checked_at < self.lag_cache_ttl:
                    if lag_ms <= self.max_lag_ms:
                        available.append(replica)
                    continue
            # Check lag from replica itself
            lag_ms = self._check_replica_lag(replica)
            self.lag_cache[id(replica)] = (lag_ms, now)
            if lag_ms <= self.max_lag_ms:
                available.append(replica)
        return available

    def _check_replica_lag(self, replica) -> float:
        result = replica.execute(
            "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 AS lag_ms"
        ).scalar()
        return result or 0

    def route_read(self, requires_fresh: bool = False):
        if requires_fresh:
            return self.primary
        available = self.get_available_replicas()
        if not available:
            return self.primary  # Fall back to primary if all replicas too lagged
        return random.choice(available)
```

**Sizing guidance for replication lag SLO** `[Staff+]`

```
Replication lag components:
  WAL generation → WAL sender → Network → WAL receiver → WAL writer → Replay

  Typical same-region lag: 5-50ms (usually < 10ms under normal load)
  Cross-AZ lag: 10-50ms
  Cross-region lag: 50-300ms (depends on distance)

Lag SLO by use case:
  User feed reads (social): 500ms lag acceptable (user doesn't notice)
  Search index reads: 5s lag acceptable
  Inventory availability: 100ms lag maximum (overselling risk)
  Financial balances: 0ms — route to primary only
  Session/auth state: 0ms — route to primary only

Write amplification and lag relationship:
  Heavy write load → WAL generation rate high → replication lag increases
  At 10,000 writes/s: lag typically < 100ms on modern hardware
  At 100,000 writes/s: lag can reach 1-5s if replicas can't keep up
  Rule: add replicas before lag SLO is breached; each replica adds replay capacity
```

**Synchronous replication for zero-lag** `[Staff+]`

```sql
-- PostgreSQL synchronous replication (zero lag guarantee)
-- Primary waits for replica acknowledgment before committing

-- postgresql.conf on primary:
synchronous_standby_names = 'FIRST 1 (replica1, replica2)'
-- Waits for at least 1 of (replica1, replica2) to confirm receipt

-- Trade-off:
-- Write latency increases by network RTT to replica (5-50ms)
-- If synchronous replica is down, primary blocks until replica returns
-- Use only for high-value data (payments, financial records)
```

---

### Solution 4: CQRS Read Models as Read Replica Alternative `[Staff+]`

**What it is**

Instead of replicating the write database to read replicas, maintain a separate read-optimized data store (Elasticsearch, Cassandra, DynamoDB) that is updated via events. Read queries go to the read store; write queries go to the primary database.

```mermaid
graph LR
    W["Write Path"] --> PG["PostgreSQL Primary\n(normalized, ACID)"]
    PG -->|"CDC / events"| KAFKA["Kafka Event Stream"]
    KAFKA --> ES["Elasticsearch\n(search, full-text)"]
    KAFKA --> CACHE["Redis\n(precomputed views)"]
    KAFKA --> ANALYTICS["ClickHouse\n(analytics queries)"]
    R["Read Path"] --> ES
    R --> CACHE
    R --> ANALYTICS
```

**Sizing guidance** `[Staff+]`

```
When to use CQRS read models vs. replicas:

Use replicas when:
  - Queries are simple (SELECT with indexes)
  - Replication lag < SLO tolerance
  - Team is familiar with SQL routing

Use CQRS read models when:
  - Queries require different data models (denormalized for reads)
  - Search requirements (full-text, faceted filtering → Elasticsearch)
  - Analytics queries that would overload PostgreSQL even with replicas
  - Read latency SLO < 10ms (Redis pre-computed views)

Cost comparison (10M users, 1TB database):
  3 PostgreSQL replicas: ~$2,400/month (same instance type as primary)
  Elasticsearch + Redis: ~$1,000/month for equivalent read capacity
  BUT: 3-4× more engineering complexity for CDC pipeline maintenance

Event lag in CQRS:
  Kafka CDC lag: 50-500ms (Debezium typical latency)
  Elasticsearch indexing lag: 1-5s after Kafka message
  Total read staleness: 1.5-6s (acceptable for search, not for inventory)
```

---

## Trade-off Matrix `[Senior]` → `[Staff+]`

| Approach | Read Scalability | Consistency | Complexity | Cost |
|---|---|---|---|---|
| Single primary | None | Perfect | Low | Baseline |
| Read replicas + manual routing | 3-10× reads | Eventual (50-500ms lag) | Medium | 2-3× |
| pgBouncer + replicas | 3-10× reads | Eventual | Low-Medium | 2-3× |
| ProxySQL (MySQL) | 3-10× reads | Configurable | Medium | 2-3× |
| Cache as read replica | 100-1000× reads | TTL-based (30s-5min) | Medium | 1.5-2× |
| CQRS read models | Unlimited (separate store) | Event lag (1-10s) | High | Variable |

---

## Decision Framework `[Senior]` → `[Staff+]`

```mermaid
flowchart TD
    A["Database read bottleneck"] --> B{"Read-to-write ratio?"}
    B -->|"< 5:1 (write-heavy)"| C["Optimize queries\n+ write sharding"]
    B -->|"> 5:1 (read-heavy)"| D{"Consistency requirement?"}
    D -->|"Strict (balances, auth)"| E["Cache primary reads\n(short TTL: 1-5s)\nNO replica routing"]
    D -->|"Eventual OK"| F{"Query type?"}
    F -->|"Simple selects by PK/FK"| G["Read replicas\n+ pgBouncer routing\n(start here)"]
    F -->|"Complex analytics"| H["CQRS: ClickHouse\nor Redshift"]
    F -->|"Full-text search"| I["CQRS: Elasticsearch\nor Typesense"]
    G --> J{"Replica lag within SLO?"}
    J -->|"No"| K["Add more replicas\nor reduce write load"]
    J -->|"Yes"| L["Deploy and monitor\nlag alerting required"]
```

---

## Production Failure Story `[Staff+]`

**System**: B2B SaaS platform, analytics dashboard
**Architecture**: PostgreSQL primary + 2 replicas, Django ORM with db router
**Scale**: 5,000 businesses, each with analytics dashboard showing last-30-days data

**The incident**: Heavy batch import job (customer uploaded 50M rows via CSV) ran for 6 hours. During the import:
- Primary WAL generation rate: 500 MB/s (normal is 10 MB/s)
- Replica-1 lag: climbed from 200ms → 45 minutes
- Replica-2 lag: climbed from 200ms → 38 minutes
- Django ORM router: still routing ALL reads to replicas (no lag check)
- Result: analytics dashboards showing data from 38-45 minutes ago

**User impact**: Customers called support saying their "real-time" analytics showed wrong numbers. Customer success team panicked — they thought there was data loss.

**Root cause:**
1. No replication lag monitoring — team didn't know replicas were 45 minutes behind
2. No lag check in read router — reads went to lagged replicas regardless
3. No circuit breaker — when lag exceeded SLO, reads should have fallen back to primary

**Remediation:**
1. Added lag check before replica routing: if lag > 30s, route to primary
2. Added `pg_stat_replication.replay_lag` metric to Grafana dashboard + alert at 10s lag
3. Import jobs now use `SET synchronous_commit = off` with explicit primary-only reads during import
4. Added read-your-own-write pattern: any request that recently did a write goes to primary for 5s

---

## Observability Playbook `[Staff+]`

```yaml
metrics:
  replication_health:
    - pg_replication_lag_bytes{replica}     # alert: > 10MB (indicates falling behind)
    - pg_replication_lag_seconds{replica}   # alert: > 5s (SLO breach)
    - pg_replication_slots_inactive_total   # alert: > 0 (unused slot bloating WAL)

  connection_pooling:
    - pgbouncer_pool_waiting_clients{pool}  # alert: > 0 sustained for 30s
    - pgbouncer_pool_active_server_conns    # near default_pool_size → add capacity
    - pgbouncer_query_wait_time_ms          # alert: p99 > 100ms

  query_routing:
    - db_reads_to_primary_fraction          # should be < 0.2 if replicas healthy
    - db_reads_to_replica_fraction          # monitor distribution across replicas
    - read_your_own_write_fallback_total    # how often post-write reads fall to primary

  business:
    - db_query_latency_p99{db_role}        # primary vs. replica latency comparison

alerts:
  - replication_lag > 30s → route all reads to primary (automated)
  - replication_lag > 5s for 2 minutes → page on-call
  - pgbouncer_pool_waiting_clients > 0 for 60s → investigate connection leak
```

---

## Architectural Evolution `[Staff+]`

```
Stage 1 (< 1,000 QPS):
  Single primary, no replicas
  pgBouncer for connection pooling only (reduces connection count)

Stage 2 (1k-10k QPS):
  1 read replica + pgBouncer
  Manual routing: ORM db_for_read() → replica
  Lag monitoring alerts (> 10s → alert)

Stage 3 (10k-100k QPS):
  3-5 read replicas, lag-aware routing
  Read-your-own-write pattern in application framework
  Separate replica for analytics (can tolerate higher lag)
  Redis cache layer for hot queries (reduces replica load)

Stage 4 (100k+ QPS):
  pgBouncer poolers in front of each replica
  CQRS: Elasticsearch for search, ClickHouse for analytics
  Primary replicas in sync mode for financial data
  Geographic replicas for multi-region read locality
  Automated replica health checks + lag-based traffic shifting
```

---

## Decision Framework Checklist `[All Levels]`

- [ ] Do I know my read-to-write ratio? Is it > 5:1 (worth adding replicas)?
- [ ] Have I implemented connection pooling (pgBouncer/HikariCP)? Max connections without pooling is a common early bottleneck.
- [ ] Do I monitor replication lag per replica? (Not just "replication is running")
- [ ] Does my read router check replication lag before sending reads to a replica?
- [ ] Have I identified which reads require strong consistency (fall to primary) vs. eventual (OK for replica)?
- [ ] Is my read-your-own-write pattern implemented? (User writes then reads back immediately)
- [ ] Do I have an analytics replica with a higher lag tolerance to isolate heavy reporting queries?
- [ ] Are my replication slots cleaned up? (Unused slots block WAL cleanup and can fill disk)
- [ ] Have I tested failover: what happens to reads when a replica goes down?
- [ ] Is my pgBouncer/ProxySQL itself HA (at least 2 instances)? A pooler is a SPOF.

*Written by Gaurav Porwal — 10+ Year Engineer | Tech Lead | Product Owner | Business-Minded Builder*
*Last updated: 2026-03-18*

---

## 🧠 Test Your Understanding

*Don't re-read before attempting. The goal is retrieval, not recognition.*

<details>
<summary>Q1 — Surface Check: Name the two main approaches to scaling database reads and state when you reach for each.</summary>

**Answer**: (1) Read replicas: copy all data to additional nodes, route reads there. Reach for this when reads >> writes and latency is caused by DB load (not data volume). Works until replica lag or replication throughput becomes the bottleneck. (2) Sharding (horizontal partitioning): split data across multiple databases by a shard key. Reach for this when data volume exceeds a single node's capacity or when write throughput exceeds what one primary can handle. Much higher operational complexity — use read replicas first, shard only when necessary.

</details>

<details>
<summary>Q2 — Failure Scenario: You have a primary + 3 read replicas. You add a 4th replica to handle increasing read traffic. Read latency is unchanged. What are the two most likely causes?</summary>

**Answer**: (1) All reads still route to primary — your application/ORM/connection pool is not configured to use replicas. Check the connection string and load balancer config. PgBouncer or RDS Proxy can route SELECTs to replicas automatically. (2) The bottleneck isn't DB CPU — it's query inefficiency. If queries are doing full table scans or missing indexes, more replicas each do the same slow scan. `EXPLAIN ANALYZE` is your diagnostic tool. Check buffer cache hit rate (should be 99%+) and look for sequential scans on large tables.

</details>

<details>
<summary>Q3 — Cross-Concept: A user updates their shipping address. Immediately after, they see their old address when viewing their profile. Your system uses 3 read replicas. Explain exactly what happened and give two fixes.</summary>

**Answer**: Read-your-writes violation caused by replication lag. Write went to primary → primary acknowledged → user immediately read → read routed to replica → replica hasn't yet received the write (replication lag was 100ms, but the read happened in 20ms) → replica returned old address. Fix 1: route all reads immediately following a user-initiated write to the primary for N seconds (set a session flag after writes, middleware checks it). Fix 2: for critical reads (profile page after save), always read from primary. Use replicas only for reads where staleness is acceptable (e.g., analytics, leaderboards). This connects to CAP: read replicas are an AP optimization — you trade strict consistency for availability and throughput.

</details>

<details>
<summary>Q4 — Trade-off Challenge: At what point does adding more read replicas start hurting performance? Explain the mechanism.</summary>

**Answer**: When replication from primary saturates primary I/O. Each replica consumes a replication stream from the primary — this is disk reads (WAL) + network sends. At high replica counts (typically 10+), the primary spends significant I/O serving replicas rather than user queries. Also: if write volume is high, replicas spend most of their CPU applying WAL (write-ahead log) and permanently lag behind. Reads from lagging replicas are increasingly stale. The right fix at this point is not more replicas — it's sharding (splitting to multiple primaries). Instagram hit this at ~12 replicas per primary, with replication lag exceeding 60 seconds under peak write load. They then sharded Postgres.

</details>

---

## 📚 Ready for Interview Level?

You just tested your understanding with 4 application questions. The interview versions go deeper on replication lag, cross-shard queries, and the point where sharding becomes necessary.

**Curated questions from the interview bank (do these in order):**

| Question | Tests | Level |
|----------|-------|-------|
| [What are leader-follower, multi-master, and synchronous replication patterns?](../../12-interview-prep/question-bank/databases/database-replication-patterns) | Replication topology trade-offs | 🟡 Mid |
| [When is it time to shard? And how do you do it without downtime?](../../12-interview-prep/question-bank/databases/database-sharding-deep-dive) | Sharding strategy + migration planning | 🔴 Senior |
| [Cross-shard join: orders and users on different shard keys — what are your options?](../../12-interview-prep/question-bank/databases/database-sharding-deep-dive) | Cross-concept: sharding + CQRS + query design | ⚫ Staff |

> The Staff question (⚫) requires understanding CQRS. Read [Event Sourcing & CQRS](../../05-distributed-systems/concepts/cqrs) if you haven't.
