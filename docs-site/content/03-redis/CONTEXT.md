# 03-redis/ — Layer 1 Module

Deep dive into Redis: data structures, persistence, clustering, and 30+ hands-on POCs covering real-world use cases.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Redis internals: data structures, persistence modes, clustering, eviction, pub/sub vs streams |
| hands-on/ | poc | 29 runnable Redis POCs from key-value caching through Lua scripting and distributed transactions |
| failures/ | problem | Redis failure modes (overview only — currently being expanded) |

## Article Count
- concepts/: 7 articles
- hands-on/: 29 articles
- failures/: 0 articles (overview only)
- Total: 36 articles (plus index)

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Understand Redis data structures | concepts/ | redis-data-structures-deep-dive.md |
| Choose between RDB and AOF persistence | concepts/ | redis-persistence-rdb-aof.md |
| Understand Cluster vs Sentinel | concepts/ | redis-cluster-vs-sentinel.md |
| Understand eviction policies (LRU, LFU) | concepts/ | redis-eviction-policies.md |
| Choose between Pub/Sub and Streams | concepts/ | redis-pub-sub-vs-streams.md |
| Implement distributed locking | concepts/ | redis-distributed-locking.md |
| Implement rate limiting | concepts/ | redis-rate-limiting-patterns.md |
| Run a basic cache | hands-on/ | redis-key-value-cache.md |
| Build a rate limiter | hands-on/ | redis-rate-limiting.md, redis-lua-rate-limiting.md |
| Build a job queue | hands-on/ | redis-job-queue.md |
| Build a leaderboard | hands-on/ | redis-leaderboard.md, redis-lua-leaderboards.md |
| Use Redis Streams | hands-on/ | redis-streams.md, redis-streams-event-sourcing.md |
| Use Lua scripting | hands-on/ | redis-lua-scripting-basics.md, redis-lua-workflows.md |
| Implement atomic inventory management | hands-on/ | redis-atomic-inventory.md |
| Handle banking transfers safely | hands-on/ | redis-banking-transfers.md |

## Prerequisites
- 02-caching/ — caching concepts before diving into Redis specifics

## Connects To
- 02-caching/ — Redis is the primary backend for caching patterns
- 04-messaging/ — Redis Streams as a lightweight alternative to Kafka
- 05-distributed-systems/ — distributed locking, consistency patterns
