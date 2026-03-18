# problems-at-scale/scalability/ — Layer 2 Router

Routes across scalability failure scenarios.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| database-hotspots | problem | Single database row/shard receiving disproportionate traffic |
| hot-partition | problem | Kafka or database partition overwhelmed by key skew |
| memory-leak-long-running | problem | Memory growing unbounded in long-running services |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| One DB row is getting hammered | database-hotspots | database-hotspots |
| One Kafka partition is overloaded | hot-partition | hot-partition |
| Service memory keeps growing | memory-leak-long-running | memory-leak-long-running |
| Solutions: sharding to spread load | system-design/ | system-design/databases/sharding-strategies |
| Solutions: consistent hashing | practice-pocs/ | load-balancer-consistent-hashing |
| Solutions: Kafka consumer groups | practice-pocs/ | kafka-consumer-groups-load-balancing |
