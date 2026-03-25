# 01-databases/concepts/ — Layer 2 Router

Theory articles covering database internals, scaling patterns, and advanced database types.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Module overview and how the concepts fit together |
| replication-basics | How database replication works: synchronous vs async, leader/follower setup |
| read-replicas | Using read replicas to scale read-heavy workloads |
| sharding-strategies | Horizontal partitioning strategies: range, hash, directory-based sharding |
| indexing-strategies | When and how to add indexes, trade-offs between index types |
| indexing-deep-dive | B-tree, hash, GIN, GiST internals; composite and partial indexes |
| data-archival-strategies | Strategies for archiving cold data without impacting production performance |
| mvcc-concurrency-control | Multi-Version Concurrency Control: how databases handle concurrent reads/writes |
| write-ahead-logging | WAL internals: how databases guarantee durability and enable replication |
| connection-pooling-deep-dive | Connection pooler architecture (PgBouncer), sizing formulas, modes |
| distributed-transactions | 2PC, saga pattern, and trade-offs when transactions span multiple databases |
| zero-downtime-migrations | Techniques to migrate schema without downtime: expand/contract, online DDL |
| time-series-databases | Purpose-built time-series databases (InfluxDB, TimescaleDB) vs general-purpose |
| column-store-databases | Column-oriented storage (Redshift, BigQuery): when to use instead of row stores |
| change-data-capture | CDC patterns: streaming database changes to downstream systems via WAL |
| data-warehouse-vs-lake | Comparison of data warehouse, data lake, and lakehouse architectures |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start with an overview of all concepts | overview |
| Learn how to scale reads | read-replicas |
| Learn how to scale writes across nodes | sharding-strategies |
| Understand locking and transaction isolation | mvcc-concurrency-control |
| Understand how durability is guaranteed | write-ahead-logging |
| Stream database changes to Kafka/queues | change-data-capture |
| Choose between analytical storage options | data-warehouse-vs-lake, column-store-databases |
| Migrate a live database schema safely | zero-downtime-migrations |
