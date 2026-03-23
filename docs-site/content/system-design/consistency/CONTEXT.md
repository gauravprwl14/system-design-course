> **Migrated to [/05-distributed-systems](/05-distributed-systems)**: Topic map and cross-references for distributed consensus, stale reads, cache consistency, and split brain scenarios have been added to `/05-distributed-systems/index.md`. Active content lives in `/05-distributed-systems/concepts/`. Hands-on: `/03-redis/hands-on/redis-distributed-lock`. This file is retained for historical reference.

# system-design/consistency/ — Layer 2 Router

Routes across distributed consistency concepts.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| distributed-consensus | concept | Raft, Paxos, leader election — how distributed systems agree |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| How do distributed systems agree on a value? | distributed-consensus | distributed-consensus |
| Hands-on distributed locking practice | practice-pocs/ | redis-distributed-lock |
| Stale read after write failure | problems-at-scale/ | problems-at-scale/consistency/stale-read-after-write |
| Split brain scenario | problems-at-scale/ | problems-at-scale/availability/split-brain |
| Cache invalidation race | problems-at-scale/ | problems-at-scale/consistency/cache-invalidation-race |
