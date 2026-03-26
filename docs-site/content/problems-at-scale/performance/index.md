---
title: "Performance Bottlenecks"
description: "When your system slows to a crawl at scale — and how to diagnose why"
---

# Performance Bottlenecks

Performance problems at scale are usually not about raw speed — they're about resource starvation, inefficient access patterns, and hot spots that weren't visible at low traffic.

```mermaid
graph TD
    NPLUS[N+1 Query Problem\n1 page load → 50,001 queries] -->|fix| EAGER[Eager loading\n+ JOIN or batch fetch]
    POOLSTARV[Connection Pool Starvation\n500 pods, 100 DB connections] -->|fix| PGBOUNCER[PgBouncer / connection pooler\n+ pool sizing formula]
    DBHOT[Database Hotspots\n31 shards idle, 1 at 99% CPU] -->|fix| RESHARDING[Shard re-balancing\n+ hot key scatter]
```

## Problems in This Section

| Problem | The Pain |
|---------|----------|
| [N+1 Query Problem](n-plus-one-query) | 1 page load → 50,001 database queries |
| [Connection Pool Starvation](connection-pool-starvation) | 500 pods, 100 DB connections, infinite wait |
| [Database Hotspots](database-hotspots) | 31 shards idle, 1 at 99% CPU |
