# problems-at-scale/consistency/ — Layer 2 Router

Routes across data consistency failure scenarios.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| cache-invalidation-race | problem | Cache and database out of sync due to race in invalidation |
| stale-read-after-write | problem | User reads old data immediately after writing due to replication lag |
| message-out-of-order | problem | Events processed in wrong order causing inconsistent state |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Users see old data after updating | stale-read-after-write | stale-read-after-write |
| Cache is showing stale data | cache-invalidation-race | cache-invalidation-race |
| Events are processed out of order | message-out-of-order | message-out-of-order |
| Solutions: cache invalidation | practice-pocs/ | cache-invalidation-strategies |
| Solutions: read-your-writes | system-design/ | system-design/databases/read-replicas |
| Solutions: Kafka ordering | practice-pocs/ | kafka-basics-producer-consumer |
