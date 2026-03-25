# 03-redis/hands-on/ — Layer 2 Router

29 runnable Redis POCs covering key-value caching, data structures, transactions, Lua scripting, and cluster operations.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Guide to the Redis hands-on POCs |
| redis-key-value-cache | Basic key-value caching with TTL and retrieval |
| redis-counter | Atomic increment/decrement counters using INCR/DECR |
| redis-distributed-lock | Distributed lock implementation using SET NX EX |
| redis-rate-limiting | Rate limiter using sorted sets or counters |
| redis-session-management | Storing and retrieving user sessions with TTL |
| redis-job-queue | Simple job queue using LPUSH/BRPOP |
| redis-pubsub | Basic Pub/Sub messaging: publish and subscribe |
| redis-pubsub-patterns | Advanced Pub/Sub patterns: channels, patterns, fan-out |
| redis-streams | Redis Streams basics: XADD, XREAD, consumer groups |
| redis-streams-event-sourcing | Using Redis Streams as an event log for event sourcing |
| redis-leaderboard | Sorted Set leaderboard with ZADD, ZRANK, ZRANGE |
| redis-hyperloglog | Approximate unique count with HyperLogLog (PFADD/PFCOUNT) |
| redis-deduplication | Deduplication using Sets or Bloom filter patterns |
| redis-cluster-caching | Caching with Redis Cluster: key distribution and reads |
| redis-cluster-sharding | Sharding data across Redis Cluster slots |
| redis-persistence-strategies | Comparing RDB-only, AOF-only, and hybrid persistence in practice |
| redis-monitoring-performance | Monitoring Redis with INFO, MONITOR, slowlog, and latency tools |
| redis-atomic-inventory | Atomic inventory reservation using MULTI/EXEC or Lua |
| redis-banking-transfers | Safe balance transfer between accounts using transactions |
| redis-transaction-rollback | Handling errors and rollbacks in MULTI/EXEC blocks |
| redis-transactions-multi-exec | MULTI/EXEC transaction semantics and usage patterns |
| redis-watch-optimistic-locking | Optimistic locking with WATCH for conditional transactions |
| redis-lua-scripting-basics | Writing and running Lua scripts with EVAL and EVALSHA |
| redis-lua-rate-limiting | Rate limiting implemented atomically in Lua |
| redis-lua-leaderboards | Leaderboard operations implemented as atomic Lua scripts |
| redis-lua-workflows | Multi-step business workflows implemented in Lua for atomicity |
| redis-lua-performance-benchmarks | Benchmarking Lua scripts vs multi-round-trip Redis commands |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start with the simplest Redis use case | redis-key-value-cache |
| Build rate limiting | redis-rate-limiting, redis-lua-rate-limiting |
| Build a background job system | redis-job-queue |
| Build a leaderboard or ranking | redis-leaderboard, redis-lua-leaderboards |
| Use Redis for real-time events | redis-pubsub, redis-streams |
| Implement distributed transactions | redis-transactions-multi-exec, redis-watch-optimistic-locking |
| Use Lua for atomicity | redis-lua-scripting-basics, redis-lua-workflows |
| Handle inventory or payment use cases | redis-atomic-inventory, redis-banking-transfers |
| Monitor and tune Redis performance | redis-monitoring-performance, redis-lua-performance-benchmarks |
