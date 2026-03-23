# problems-at-scale/availability/ — Layer 2 Router

Routes across availability and resilience failure scenarios.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| cascading-failures | problem | One service failing taking down the entire dependency chain |
| timeout-domino-effect | problem | Timeouts propagating upstream and amplifying latency |
| circuit-breaker-failure | problem | Circuit breaker stuck open or closed — when the pattern fails |
| retry-storm | problem | Retries overwhelming a recovering service |
| split-brain | problem | Network partition causing two nodes to act as primary |
| thundering-herd | problem | Massive simultaneous requests after cache expiry or server restart |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| My services are failing in a chain | cascading-failures | cascading-failures, timeout-domino-effect |
| Retries are making things worse | retry-storm | retry-storm |
| Circuit breaker isn't helping | circuit-breaker-failure | circuit-breaker-failure |
| Cache restart is killing my DB | thundering-herd | thundering-herd |
| Database cluster has two primaries | split-brain | split-brain |
| Solutions: circuit breaker pattern | system-design/ | system-design/patterns/circuit-breaker |
| Solutions: retry with backoff | practice-pocs/ | retry-backoff, timeout-configuration |
| Solutions: graceful degradation | practice-pocs/ | graceful-degradation |
