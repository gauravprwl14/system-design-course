# system-design/databases/ — Layer 2 Router

Routes across database scaling concepts: replication, read replicas, sharding, indexing, and data archival.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| replication-basics | concept | How database replication works, leader-follower model |
| read-replicas | concept | Scaling reads with replica databases |
| sharding-strategies | concept | Horizontal partitioning: range, hash, directory-based |
| indexing-strategies | concept | Index types and when to use them |
| indexing-deep-dive | concept | Advanced indexing: composite, covering, partial indexes |
| data-archival-strategies | concept | Moving cold data out of hot databases |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| How do I scale database reads? | read-replicas | read-replicas |
| How do I split data across multiple databases? | sharding | sharding-strategies |
| How do I sync data across database instances? | replication | replication-basics |
| How do I make queries faster? | indexing | indexing-strategies, indexing-deep-dive |
| How do I handle growing table sizes? | archival | data-archival-strategies |
| Hands-on practice with databases | practice-pocs/ | database-crud, database-indexes, database-sharding |
| Real failure: database hotspots | problems-at-scale/ | problems-at-scale/scalability/database-hotspots |
| Interview question on DB scaling | interview-prep/ | interview-prep/system-design/database-sharding |
