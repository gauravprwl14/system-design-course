# 03-redis/concepts/ — Layer 2 Router

Redis internals and design decisions: data structures, persistence, clustering, eviction, and messaging primitives.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to Redis and how the concept articles are organized |
| redis-data-structures-deep-dive | Strings, Lists, Hashes, Sets, Sorted Sets, HyperLogLog, Bitmaps — when to use each |
| redis-persistence-rdb-aof | RDB snapshots vs AOF logging: durability guarantees and performance trade-offs |
| redis-cluster-vs-sentinel | High availability comparison: Sentinel (failover) vs Cluster (horizontal scaling) |
| redis-eviction-policies | LRU, LFU, TTL-based, and noeviction policies — choosing the right one |
| redis-pub-sub-vs-streams | When to use Pub/Sub (fire-and-forget) vs Streams (durable, consumer groups) |
| redis-distributed-locking | Redlock algorithm and SET NX EX patterns for distributed mutual exclusion |
| redis-rate-limiting-patterns | Sliding window, token bucket, and fixed window rate limiting with Redis |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Choose the right data structure for a use case | redis-data-structures-deep-dive |
| Decide how to persist Redis data | redis-persistence-rdb-aof |
| Design Redis for high availability | redis-cluster-vs-sentinel |
| Prevent Redis from running out of memory | redis-eviction-policies |
| Build real-time messaging | redis-pub-sub-vs-streams |
| Implement a distributed lock | redis-distributed-locking |
| Implement rate limiting | redis-rate-limiting-patterns |
