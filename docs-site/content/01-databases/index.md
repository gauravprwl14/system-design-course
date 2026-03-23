# Databases

Databases are the foundation of nearly every system. This section covers everything from replication basics to advanced topics like MVCC, write-ahead logging, and zero-downtime migrations.

## What You'll Learn

- **Concepts**: Core database design theory — replication, sharding, indexing, transactions
- **Hands-On**: Practical POCs with real working code you can run
- **Failure Modes**: Real production failures and how to prevent them

## Where to Start

1. [Replication Basics](./concepts/replication-basics) — How data is copied across nodes
2. [Indexing Strategies](./concepts/indexing-strategies) — The single biggest lever for query performance
3. [Sharding Strategies](./concepts/sharding-strategies) — Horizontal scaling for write-heavy workloads
4. [CRUD Operations](./hands-on/database-crud) — Start building with real code

## Topic Map

| Topic | Concepts | Hands-On | Problems at Scale | Interview Prep |
|-------|----------|----------|-------------------|----------------|
| Replication | [replication-basics](./concepts/replication-basics) | — | — | [database-replication](/12-interview-prep/system-design/storage-and-databases/database-replication) |
| Read scaling | [read-replicas](./concepts/read-replicas) | [database-read-replicas](./hands-on/database-read-replicas) | [database-hotspots](/problems-at-scale/scalability/database-hotspots) | [database-sharding](/12-interview-prep/system-design/storage-and-databases/database-sharding) |
| Sharding | [sharding-strategies](./concepts/sharding-strategies) | [database-sharding](./hands-on/database-sharding) | [database-hotspots](/problems-at-scale/scalability/database-hotspots) | [database-sharding](/12-interview-prep/system-design/storage-and-databases/database-sharding) |
| Indexing | [indexing-strategies](./concepts/indexing-strategies), [indexing-deep-dive](./concepts/indexing-deep-dive) | [database-indexes](./hands-on/database-indexes), [postgresql-btree-hash-indexes](./hands-on/postgresql-btree-hash-indexes) | — | [database-indexing-deep-dive](/12-interview-prep/system-design/storage-and-databases/database-indexing-deep-dive) |
| Archival | [data-archival-strategies](./concepts/data-archival-strategies) | [database-archival-strategies](./hands-on/database-archival-strategies) | — | — |
| Transactions | — | [database-transactions](./hands-on/database-transactions) | — | — |
