> **Migrated to [/10-architecture](/10-architecture)**: Topic map and cross-references for circuit breaker, microservices communication, timeouts/backpressure, event-driven, CQRS, and saga patterns have been added to `/10-architecture/index.md`. Active article content lives in `/10-architecture/concepts/` and `/10-architecture/hands-on/`. This file is retained for historical reference.

# system-design/patterns/ — Layer 2 Router

Routes across resilience and communication design patterns.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| circuit-breaker | solution | Stop cascading failures by tripping a circuit on repeated errors |
| microservices-communication | solution | Sync vs async inter-service communication patterns |
| timeouts-backpressure | solution | Preventing overload with timeouts and backpressure |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| How do I prevent cascading failures? | circuit-breaker | circuit-breaker |
| How should microservices talk to each other? | microservices-communication | microservices-communication |
| How do I handle overloaded downstream services? | timeouts-backpressure | timeouts-backpressure |
| Hands-on circuit breaker practice | practice-pocs/ | circuit-breaker |
| Hands-on retry/backoff practice | practice-pocs/ | retry-backoff, timeout-configuration |
| Cascading failure scenario | problems-at-scale/ | problems-at-scale/availability/cascading-failures |
| Circuit breaker failure scenario | problems-at-scale/ | problems-at-scale/availability/circuit-breaker-failure |
| Interview question on circuit breaker | interview-prep/ | interview-prep/system-design/circuit-breaker-pattern |
