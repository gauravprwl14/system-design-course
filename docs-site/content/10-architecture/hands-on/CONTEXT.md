# 10-architecture/hands-on/ — Layer 2 Router

Runnable implementations of resilience and architecture patterns — circuit breakers, sagas, deployment strategies, feature flags, chaos engineering, and testing patterns.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Setup guide and introduction to hands-on architecture exercises |
| circuit-breaker | POC implementing a circuit breaker with closed/open/half-open state transitions |
| saga-pattern | POC implementing a saga with choreography and compensating transactions |
| blue-green-deployment | POC demonstrating blue-green deployment with traffic switch and rollback |
| canary-releases | POC routing a percentage of traffic to a new version and monitoring for errors |
| feature-flags | POC integrating feature flag evaluation with targeting rules and kill switch |
| graceful-degradation | POC implementing fallbacks and degraded-mode responses when dependencies fail |
| retry-backoff | POC implementing exponential backoff with jitter for retry logic |
| timeout-configuration | POC configuring per-call, per-service, and end-to-end timeout budgets |
| chaos-engineering | POC running fault injection (latency, errors) against a service using chaos tooling |
| cqrs-pattern | POC separating command and query handlers with distinct read/write data stores |
| contract-testing | POC using Pact or similar to verify API contracts between services |
| integration-testing | POC setting up integration test harnesses with real dependencies via Docker Compose |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Implement a circuit breaker from scratch | circuit-breaker.md |
| Build distributed transactions with compensation | saga-pattern.md |
| Deploy without downtime using blue-green | blue-green-deployment.md |
| Gradually roll out a risky change | canary-releases.md |
| Gate a new feature in production | feature-flags.md |
| Keep the API responding when a backend is down | graceful-degradation.md |
| Retry failed calls safely | retry-backoff.md |
| Avoid cascading timeouts | timeout-configuration.md |
| Inject failures to test resilience | chaos-engineering.md |
| Build separate read and write models | cqrs-pattern.md |
| Verify service API compatibility | contract-testing.md |
| Test with real databases and queues | integration-testing.md |
