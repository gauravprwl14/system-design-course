# 01-databases/hands-on/ — Layer 2 Router

Runnable PostgreSQL proof-of-concepts covering core operations through advanced database features.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Guide to the hands-on POCs and how to run them |
| database-crud | Basic CRUD operations with PostgreSQL |
| database-indexes | Creating and using indexes to speed up queries |
| database-transactions | Transaction isolation levels and commit/rollback patterns |
| database-partitioning | Table partitioning by range and list |
| database-sharding | Manual sharding strategies with PostgreSQL |
| database-read-replicas | Setting up and querying read replicas |
| database-connection-pooling | PgBouncer connection pooling setup and usage |
| database-explain | Using EXPLAIN and EXPLAIN ANALYZE to inspect query plans |
| database-n-plus-one | Reproducing and fixing the N+1 query problem |
| database-window-functions | ROW_NUMBER, RANK, LAG, LEAD and other window functions |
| database-materialized-views | Creating, refreshing, and querying materialized views |
| database-views | Standard views for encapsulating complex queries |
| database-triggers | Row-level and statement-level triggers for audit logging and automation |
| database-check-constraints | Enforcing business rules at the database level with CHECK constraints |
| database-foreign-keys | Referential integrity with foreign keys and cascading rules |
| database-full-text-search | Full-text search with tsvector, tsquery, and GIN indexes |
| database-jsonb | Storing and querying semi-structured data with JSONB |
| database-ctes | Common Table Expressions for recursive and stepwise queries |
| database-sequences | Sequence objects for custom ID generation |
| database-vacuum | Manual VACUUM and autovacuum configuration for table bloat |
| database-testing | Testing database logic with pgTAP or application-level patterns |
| database-archival-strategies | Strategies for moving cold data out of hot tables |
| database-archival-poc | Working POC for automated data archival |
| postgresql-btree-hash-indexes | Comparing B-tree and hash index performance in PostgreSQL |
| postgresql-composite-covering-indexes | Composite and covering indexes for multi-column query optimization |
| postgresql-connection-pooling-replication | Connection pooling combined with replication setup |
| postgresql-explain-analyze-optimization | Advanced query optimization using EXPLAIN ANALYZE output |
| postgresql-partitioning-strategies | Declarative partitioning strategies in PostgreSQL |
| connection-leak-detection | Detecting and diagnosing connection leaks in production |
| connection-pool-sizing | Formula-driven approach to sizing connection pools correctly |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start with basic SQL operations | database-crud |
| Learn how to speed up queries with indexes | database-indexes, postgresql-btree-hash-indexes |
| Practice query optimization | database-explain, postgresql-explain-analyze-optimization |
| Set up connection pooling | database-connection-pooling, connection-pool-sizing |
| Work with JSON data in PostgreSQL | database-jsonb |
| Search text efficiently | database-full-text-search |
| Archive old data from production tables | database-archival-strategies, database-archival-poc |
| Fix connection leaks | connection-leak-detection |
