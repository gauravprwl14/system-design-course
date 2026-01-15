export default {
  index: "🎯 Overview",

  // Redis Patterns (10 POCs)
  "redis-key-value-cache": "1️⃣ Redis Cache",
  "redis-counter": "2️⃣ Redis Counter",
  "redis-distributed-lock": "3️⃣ Distributed Lock",
  "redis-job-queue": "4️⃣ Job Queue",
  "redis-leaderboard": "5️⃣ Leaderboard",
  "redis-session-management": "6️⃣ Session Management",
  "redis-rate-limiting": "7️⃣ Rate Limiting",
  "redis-pubsub": "8️⃣ Pub/Sub",
  "redis-streams": "9️⃣ Event Sourcing",
  "redis-hyperloglog": "🔟 HyperLogLog",

  // Database Patterns (20 POCs)
  "database-crud": "1️⃣1️⃣ CRUD Operations",
  "database-indexes": "1️⃣2️⃣ B-Tree Indexes",
  "database-n-plus-one": "1️⃣3️⃣ N+1 Problem",
  "database-explain": "1️⃣4️⃣ EXPLAIN Analysis",
  "database-connection-pooling": "1️⃣5️⃣ Connection Pooling",
  "database-transactions": "1️⃣6️⃣ Transactions",
  "database-read-replicas": "1️⃣7️⃣ Read Replicas",
  "database-sharding": "1️⃣8️⃣ Sharding",
  "database-jsonb": "1️⃣9️⃣ JSONB",
  "database-full-text-search": "2️⃣0️⃣ Full-Text Search",
  "database-triggers": "2️⃣1️⃣ Triggers",
  "database-views": "2️⃣2️⃣ Views",
  "database-materialized-views": "2️⃣3️⃣ Materialized Views",
  "database-ctes": "2️⃣4️⃣ CTEs",
  "database-window-functions": "2️⃣5️⃣ Window Functions",
  "database-partitioning": "2️⃣6️⃣ Partitioning",
  "database-foreign-keys": "2️⃣7️⃣ Foreign Keys",
  "database-check-constraints": "2️⃣8️⃣ Check Constraints",
  "database-sequences": "2️⃣9️⃣ Sequences",
  "database-vacuum": "3️⃣0️⃣ VACUUM",

  // Redis Transactions (POCs #31-35)
  "redis-transactions-multi-exec": "3️⃣1️⃣ Redis MULTI/EXEC",
  "redis-watch-optimistic-locking": "3️⃣2️⃣ Optimistic Locking",
  "redis-atomic-inventory": "3️⃣3️⃣ Atomic Inventory",
  "redis-banking-transfers": "3️⃣4️⃣ Banking Transfers",
  "redis-transaction-rollback": "3️⃣5️⃣ Transaction Rollback",

  // Redis Lua Scripting (POCs #36-40)
  "redis-lua-scripting-basics": "3️⃣6️⃣ Lua Scripting Basics",
  "redis-lua-rate-limiting": "3️⃣7️⃣ Lua Rate Limiting",
  "redis-lua-leaderboards": "3️⃣8️⃣ Lua Leaderboards",
  "redis-lua-workflows": "3️⃣9️⃣ Lua Workflows",
  "redis-lua-performance-benchmarks": "4️⃣0️⃣ Lua Benchmarks",

  // Redis Advanced Operations (POCs #41-45)
  "redis-pubsub-patterns": "4️⃣1️⃣ Pub/Sub Patterns",
  "redis-streams-event-sourcing": "4️⃣2️⃣ Streams Event Sourcing",
  "redis-cluster-sharding": "4️⃣3️⃣ Cluster & Sharding",
  "redis-persistence-strategies": "4️⃣4️⃣ Persistence Strategies",
  "redis-monitoring-performance": "4️⃣5️⃣ Monitoring & Performance",

  // Kafka Message Queues (POCs #46-50)
  "kafka-basics-producer-consumer": "4️⃣6️⃣ Kafka Basics",
  "kafka-consumer-groups-load-balancing": "4️⃣7️⃣ Consumer Groups",
  "kafka-streams-real-time-processing": "4️⃣8️⃣ Kafka Streams",
  "kafka-exactly-once-semantics": "4️⃣9️⃣ Exactly-Once Semantics",
  "kafka-performance-tuning-monitoring": "5️⃣0️⃣ Kafka Performance",

  // PostgreSQL Optimization (POCs #51-56)
  "postgresql-btree-hash-indexes": "5️⃣1️⃣ B-Tree vs Hash Indexes",
  "postgresql-composite-covering-indexes": "5️⃣2️⃣ Composite & Covering Indexes",
  "postgresql-explain-analyze-optimization": "5️⃣3️⃣ EXPLAIN ANALYZE",
  "postgresql-partitioning-strategies": "5️⃣4️⃣ Partitioning Strategies",
  "postgresql-connection-pooling-replication": "5️⃣5️⃣ Connection Pooling & Replication",

  // API Design (POCs #56-60)
  "rest-api-best-practices": "5️⃣6️⃣ RESTful API Best Practices",
  "graphql-server-implementation": "5️⃣7️⃣ GraphQL Server",
  "grpc-protocol-buffers": "5️⃣8️⃣ gRPC & Protocol Buffers",
  "api-versioning-strategies": "5️⃣9️⃣ API Versioning Strategies",
  "api-gateway-rate-limiting": "6️⃣0️⃣ API Gateway & Rate Limiting",

  // Caching Strategies (POCs #61-65)
  "cache-aside-pattern": "6️⃣1️⃣ Cache-Aside Pattern",
  "write-through-caching": "6️⃣2️⃣ Write-Through Caching",
  "cache-invalidation-strategies": "6️⃣3️⃣ Cache Invalidation",
  "redis-cluster-caching": "6️⃣4️⃣ Redis Cluster Caching",
  "http-caching-headers": "6️⃣5️⃣ HTTP Caching Headers",

  // Load Balancing (POCs #66-70)
  "load-balancer-round-robin": "6️⃣6️⃣ Round-Robin LB",
  "load-balancer-least-connections": "6️⃣7️⃣ Least Connections LB",
  "load-balancer-consistent-hashing": "6️⃣8️⃣ Consistent Hashing",
  "circuit-breaker": "6️⃣9️⃣ Health Checks & Circuit Breaker",
  "nginx-load-balancer": "7️⃣0️⃣ NGINX Load Balancer",

  // Connection Pool Management (POCs #71-72)
  "connection-pool-sizing": "7️⃣1️⃣ Connection Pool Sizing",
  "connection-leak-detection": "7️⃣2️⃣ Connection Leak Detection",

  // Idempotency & Deduplication (POCs #73-74)
  "idempotency-keys": "7️⃣3️⃣ Idempotency Keys",
  "redis-deduplication": "7️⃣4️⃣ Redis Deduplication",

  // Resilience Patterns (POCs #75-80)
  "retry-backoff": "7️⃣5️⃣ Retry with Backoff",
  "timeout-configuration": "7️⃣6️⃣ Timeout Configuration",
  "backpressure-queues": "7️⃣7️⃣ Backpressure with Queues",
  "graceful-degradation": "7️⃣8️⃣ Graceful Degradation",
  "distributed-tracing": "7️⃣9️⃣ Distributed Tracing",
  "slo-dashboard": "8️⃣0️⃣ SLO Dashboard",

  // Event Sourcing & CQRS (POCs #81-85)
  "event-sourcing-basics": "8️⃣1️⃣ Event Sourcing Basics",
  "cqrs-pattern": "8️⃣2️⃣ CQRS Pattern",
  "event-store-implementation": "8️⃣3️⃣ Event Store Implementation",
  "saga-pattern": "8️⃣4️⃣ Saga Pattern",
  "outbox-pattern": "8️⃣5️⃣ Outbox Pattern",

  // Security Patterns (POCs #86-90)
  "jwt-authentication": "8️⃣6️⃣ JWT Authentication",
  "oauth-flows": "8️⃣7️⃣ OAuth 2.0 Flows",
  "api-key-management": "8️⃣8️⃣ API Key Management",
  "rate-limiting-algorithms": "8️⃣9️⃣ Rate Limiting Algorithms",
  "rbac-implementation": "9️⃣0️⃣ RBAC Implementation",

  // Testing & Quality (POCs #91-95)
  "load-testing-k6": "9️⃣1️⃣ Load Testing with k6",
  "chaos-engineering": "9️⃣2️⃣ Chaos Engineering",
  "contract-testing": "9️⃣3️⃣ Contract Testing",
  "database-testing": "9️⃣4️⃣ Database Testing",
  "integration-testing": "9️⃣5️⃣ Integration Testing",

  // Infrastructure Patterns (POCs #96-100)
  "feature-flags": "9️⃣6️⃣ Feature Flags",
  "blue-green-deployment": "9️⃣7️⃣ Blue-Green Deployment",
  "canary-releases": "9️⃣8️⃣ Canary Releases",
  "health-check-patterns": "9️⃣9️⃣ Health Check Patterns",
  "service-discovery": "🔟0️⃣ Service Discovery"
}
