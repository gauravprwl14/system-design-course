# 01-databases/failures/ — Layer 2 Router

Real-world database failure modes with root causes, symptoms, and remediation patterns.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Guide to common database failure patterns and how to read these case studies |
| n-plus-one-query | N+1 query problem: how lazy loading generates O(n) queries and how to fix it |
| connection-pool-starvation | What happens when all connection pool slots are exhausted under load |
| database-hotspots | When a single row or table becomes a write bottleneck (counters, locks) |
| memory-leak-long-running | Memory leak patterns in long-running database-connected services |
| hot-partition | Uneven sharding or partitioning causing one shard to receive most traffic |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Diagnose why my app is making too many queries | n-plus-one-query |
| Understand why my service slows under connection load | connection-pool-starvation |
| Understand why one shard is overwhelmed | hot-partition |
| Investigate a write contention bottleneck | database-hotspots |
| Track down a memory leak in a service | memory-leak-long-running |
