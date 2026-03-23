# problems-at-scale/ — Layer 2 Router

Routes across real-world failure scenarios grouped by problem category.

## Files in This Section

| Folder | Layer | Description |
|--------|-------|-------------|
| concurrency/ | problem | Race conditions, double-booking, duplicate processing (6 problems) |
| availability/ | problem | Thundering herd, cascading failures, split brain (6 problems) |
| consistency/ | problem | Stale reads, cache invalidation races, out-of-order messages (3 problems) |
| performance/ | problem | Connection pool starvation, N+1 queries, thread exhaustion (3 problems) |
| scalability/ | problem | Database hotspots, hot partitions, memory leaks (3 problems) |
| data-integrity/ | problem | Duplicate events, orphaned records (2 problems) |
| cost-optimization/ | problem | Storage bloat (1 problem) |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| My service is having race conditions | concurrency/ | counter-race, double-booking, race-condition-inventory |
| My service keeps going down | availability/ | thundering-herd, cascading-failures, circuit-breaker-failure |
| My data is inconsistent across services | consistency/ | stale-read-after-write, cache-invalidation-race |
| My service is slow | performance/ | n-plus-one-query, connection-pool-starvation |
| My database can't handle the load | scalability/ | database-hotspots, hot-partition |
| I have duplicate data or orphaned records | data-integrity/ | duplicate-event-processing, orphaned-records |
| My storage costs keep growing | cost-optimization/ | storage-bloat |
| Solutions to these problems | system-design/ | system-design/patterns/, system-design/databases/ |
