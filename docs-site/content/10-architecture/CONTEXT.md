# 10-architecture/ — Layer 1 Module

Distributed systems architecture patterns — circuit breakers, sagas, microservices, event-driven design, CQRS, deployment strategies, service mesh, chaos engineering, and resilience patterns.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Theory articles covering resilience patterns, distributed design, and deployment strategies |
| hands-on/ | poc | Runnable implementations of circuit breakers, sagas, deployments, feature flags, and testing |
| failures/ | problem | Failure case studies: cascading failures, retry storms, split brain, thundering herd |

## Article Count
- concepts/: 17 articles (+ overview)
- hands-on/: 12 articles (+ overview)
- failures/: 6 articles (+ overview)
- Total: 35 articles + 3 overviews

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Implement a circuit breaker | concepts/ | circuit-breaker.md |
| Design service-to-service communication | concepts/ | microservices-communication.md |
| Handle distributed transactions | concepts/ | saga-pattern-deep-dive.md |
| Migrate a monolith to microservices | concepts/ | strangler-fig-migration.md |
| Isolate failures with bulkhead pattern | concepts/ | bulkhead-pattern.md |
| Manage inter-service traffic with a mesh | concepts/ | service-mesh-architecture.md |
| Choose a deployment strategy | concepts/ | deployment-strategies-deep-dive.md |
| Control feature rollouts | concepts/ | feature-flag-architecture.md |
| Design event-driven systems | concepts/ | event-driven-architecture.md |
| Separate reads and writes with CQRS | concepts/ | cqrs.md |
| Handle backpressure | concepts/ | backpressure.md, timeouts-backpressure.md |
| Build resilient infrastructure with chaos | concepts/ | chaos-engineering.md |
| Learn about CDN and edge computing | concepts/ | cdn-edge-computing.md |
| Implement circuit breaker in code | hands-on/ | circuit-breaker.md |
| Implement saga with compensation | hands-on/ | saga-pattern.md |
| Set up blue-green deployment | hands-on/ | blue-green-deployment.md |
| Roll out canary releases | hands-on/ | canary-releases.md |
| Use feature flags in production | hands-on/ | feature-flags.md |
| Add graceful degradation | hands-on/ | graceful-degradation.md |
| Configure retry with exponential backoff | hands-on/ | retry-backoff.md |
| Configure timeouts correctly | hands-on/ | timeout-configuration.md |
| Run chaos experiments | hands-on/ | chaos-engineering.md |
| Implement CQRS in code | hands-on/ | cqrs-pattern.md |
| Understand cascading failure propagation | failures/ | cascading-failures.md |
| Debug circuit breaker misbehavior | failures/ | circuit-breaker-failure.md |
| Avoid retry storms under load | failures/ | retry-storm.md |
| Handle thundering herd after recovery | failures/ | thundering-herd.md |
| Prevent timeout domino chain failures | failures/ | timeout-domino-effect.md |
| Resolve split-brain in distributed state | failures/ | split-brain.md |

## Prerequisites
- Basic understanding of microservices and distributed systems
- Familiarity with async communication patterns
- Recommended: 05-distributed-systems/ or 06-messaging/ first

## Connects To
- 09-observability/ — Observability required to detect and respond to architecture failures
- 11-real-world/ — These patterns appear in every real-world system design
- 12-interview-prep/system-design/scale-and-reliability/ — Architecture interview questions
