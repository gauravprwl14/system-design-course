# interview-prep/practice-pocs/ — Layer 2 Router

Routes across 101 hands-on POCs grouped by technology and pattern category.

## Files in This Section

| Category | Files | Description |
|----------|-------|-------------|
| Redis (core) | redis-key-value-cache, redis-counter, redis-distributed-lock, redis-job-queue, redis-rate-limiting, redis-session-management, redis-pubsub, redis-deduplication, redis-hyperloglog, redis-leaderboard | Fundamental Redis patterns |
| Redis (advanced) | redis-cluster-caching, redis-cluster-sharding, redis-streams, redis-streams-event-sourcing, redis-pubsub-patterns, redis-persistence-strategies, redis-monitoring-performance | Advanced Redis operations |
| Redis (transactions) | redis-transactions-multi-exec, redis-watch-optimistic-locking, redis-transaction-rollback, redis-atomic-inventory, redis-banking-transfers | Redis atomic operations |
| Redis (Lua) | redis-lua-scripting-basics, redis-lua-leaderboards, redis-lua-rate-limiting, redis-lua-workflows, redis-lua-performance-benchmarks | Redis Lua scripting |
| Database (basics) | database-crud, database-indexes, database-transactions, database-views, database-triggers, database-sequences | Core DB operations |
| Database (advanced) | database-partitioning, database-sharding, database-read-replicas, database-materialized-views, database-jsonb, database-window-functions, database-ctes, database-full-text-search | Advanced DB patterns |
| Database (PostgreSQL) | postgresql-btree-hash-indexes, postgresql-composite-covering-indexes, postgresql-explain-analyze-optimization, postgresql-partitioning-strategies, postgresql-connection-pooling-replication | PostgreSQL-specific |
| Database (ops) | database-connection-pooling, database-explain, database-n-plus-one, database-testing, database-vacuum, database-check-constraints, database-foreign-keys, database-archival-strategies | DB operational patterns |
| Kafka | kafka-basics-producer-consumer, kafka-consumer-groups-load-balancing, kafka-exactly-once-semantics, kafka-performance-tuning-monitoring, kafka-streams-real-time-processing | Kafka event streaming |
| API Design | rest-api-best-practices, graphql-server-implementation, grpc-protocol-buffers, api-gateway-rate-limiting, api-key-management, api-versioning-strategies | API implementation patterns |
| Caching | cache-aside-pattern, write-through-caching, cache-invalidation-strategies, http-caching-headers | Cache implementation patterns |
| Load Balancing | load-balancer-round-robin, load-balancer-least-connections, load-balancer-consistent-hashing, nginx-load-balancer | Load balancer implementations |
| Resilience | circuit-breaker, retry-backoff, timeout-configuration, graceful-degradation, backpressure-queues, health-check-patterns | Fault tolerance patterns |
| Deployment | blue-green-deployment, canary-releases, feature-flags, chaos-engineering | Deployment and reliability patterns |
| Observability | distributed-tracing, slo-dashboard | Monitoring implementations |
| Security | jwt-authentication, oauth-flows, rbac-implementation | Auth and authorization |
| Event Patterns | event-sourcing-basics, event-store-implementation, outbox-pattern, saga-pattern | Event-driven patterns |
| Infrastructure | service-discovery, integration-testing, contract-testing, load-testing-k6 | Infrastructure and testing |
| Connection Mgmt | connection-pool-sizing, connection-leak-detection | Connection management |
| Idempotency | idempotency-keys | Idempotent operation patterns |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Practice Redis basics | Redis (core) | redis-key-value-cache, redis-distributed-lock, redis-job-queue |
| Practice Redis advanced | Redis (advanced/Lua) | redis-streams, redis-lua-scripting-basics |
| Practice database operations | Database (basics) | database-crud, database-indexes, database-transactions |
| Practice Kafka streaming | Kafka | kafka-basics-producer-consumer, kafka-streams-real-time-processing |
| Practice API design | API Design | rest-api-best-practices, grpc-protocol-buffers |
| Practice resilience patterns | Resilience | circuit-breaker, retry-backoff, timeout-configuration |
| Practice deployment patterns | Deployment | blue-green-deployment, canary-releases |
| Theory behind any POC | system-design/ | system-design/CONTEXT.md |
