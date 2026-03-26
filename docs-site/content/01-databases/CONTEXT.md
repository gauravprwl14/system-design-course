# 01-databases/ — Layer 1 Module

Deep coverage of relational database internals, scaling patterns, and hands-on PostgreSQL practice.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Theory articles on replication, sharding, indexing, transactions, and advanced database types |
| hands-on/ | poc | Runnable PostgreSQL POCs covering CRUD through advanced features like partitioning and connection pooling |
| failures/ | problem | Real failure modes: N+1 queries, connection pool starvation, hot partitions, and memory leaks |

## Article Count
- concepts/: 16 articles
- hands-on/: 32 articles
- failures/: 5 articles
- Total: 53 articles (plus index)

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Understand how replication works | concepts/ | replication-basics.md, read-replicas.md |
| Learn sharding strategies | concepts/ | sharding-strategies.md |
| Understand indexing in depth | concepts/ | indexing-strategies.md, indexing-deep-dive.md |
| Learn about MVCC and locking | concepts/ | mvcc-concurrency-control.md |
| Understand distributed transactions | concepts/ | distributed-transactions.md |
| Practice SQL with real code examples | hands-on/ | database-crud.md, database-transactions.md |
| Debug slow queries | hands-on/ | database-explain.md, postgresql-explain-analyze-optimization.md |
| Set up connection pooling | hands-on/ | database-connection-pooling.md, postgresql-connection-pooling-replication.md |
| Learn PostgreSQL-specific features | hands-on/ | postgresql-btree-hash-indexes.md, postgresql-partitioning-strategies.md |
| Diagnose N+1 query issues | failures/ | n-plus-one-query.md |
| Understand connection pool exhaustion | failures/ | connection-pool-starvation.md |
| Understand hot partition problems | failures/ | hot-partition.md |

## Prerequisites
- 00-start-here/ — course orientation

## Connects To
- 02-caching/ — caching as a complement to database read scaling
- 03-redis/ — Redis for session/cache layer on top of databases
- 05-distributed-systems/ — distributed transactions, consistency guarantees
- 06-scalability/ — database read/write scaling patterns
