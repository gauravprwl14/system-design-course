# problems-at-scale/performance/ — Layer 2 Router

Routes across performance and resource exhaustion failure scenarios.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| n-plus-one-query | problem | ORM generating N+1 queries — exponential DB round trips |
| connection-pool-starvation | problem | All DB connections consumed, new requests queue or fail |
| thread-pool-exhaustion | problem | Thread pool saturated, blocking all request processing |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| My API is very slow, ORM queries are many | n-plus-one-query | n-plus-one-query |
| Database connections are timing out | connection-pool-starvation | connection-pool-starvation |
| Service is unresponsive, threads are stuck | thread-pool-exhaustion | thread-pool-exhaustion |
| Solutions: query optimization | practice-pocs/ | database-n-plus-one, database-explain |
| Solutions: connection pool tuning | practice-pocs/ | connection-pool-sizing, database-connection-pooling |
| Theory: connection pool management | system-design/ | system-design/performance/connection-pool-management |
