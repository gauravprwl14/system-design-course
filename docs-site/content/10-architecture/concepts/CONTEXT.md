# 10-architecture/concepts/ — Layer 2 Router

Architecture pattern theory — resilience patterns, distributed communication, microservices decomposition, event-driven design, CQRS, deployment strategies, and edge computing.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to distributed architecture patterns and when to apply them |
| circuit-breaker | How circuit breakers prevent cascading failures by fast-failing unavailable dependencies |
| microservices-communication | Synchronous vs asynchronous communication, service discovery, and protocol selection |
| timeouts-backpressure | Setting timeouts defensively and handling backpressure to avoid resource exhaustion |
| saga-pattern-deep-dive | Choreography vs orchestration sagas for distributed transactions without 2PC |
| strangler-fig-migration | Incrementally decomposing a monolith by strangling it with new services |
| bulkhead-pattern | Isolating resource pools so one failing tenant or call doesn't drain all threads |
| service-mesh-architecture | Sidecar proxies, mTLS, traffic policies, and observability via Istio/Linkerd |
| deployment-strategies-deep-dive | Blue-green, canary, rolling, and feature-flag-driven deployment patterns |
| feature-flag-architecture | Managing feature flags at scale: targeting, rollout percentage, kill switches |
| load-balancing-strategies | Round-robin, least-connections, consistent hashing, and layer-7 load balancing |
| microservices-architecture | Service decomposition, bounded contexts, and team ownership patterns |
| event-driven-architecture | Event sourcing, pub/sub, event schema design, and consumer group patterns |
| cqrs | Command Query Responsibility Segregation — separating write and read models |
| async-processing | Job queues, worker pools, and async workflows for decoupling work from requests |
| backpressure | Detecting and propagating backpressure signals through a processing pipeline |
| chaos-engineering | GameDay design, fault injection, steady-state hypothesis, and tooling (Chaos Monkey) |
| cdn-edge-computing | CDN caching strategies, edge logic (Cloudflare Workers), and origin shield |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Stop cascading failures between services | circuit-breaker.md |
| Choose sync vs async inter-service calls | microservices-communication.md |
| Set timeouts without domino failures | timeouts-backpressure.md |
| Coordinate distributed writes safely | saga-pattern-deep-dive.md |
| Migrate off a monolith incrementally | strangler-fig-migration.md |
| Prevent one bad tenant from impacting others | bulkhead-pattern.md |
| Manage service-to-service auth and traffic | service-mesh-architecture.md |
| Choose a safe deployment strategy | deployment-strategies-deep-dive.md |
| Roll out features with kill switch capability | feature-flag-architecture.md |
| Design scalable load balancing | load-balancing-strategies.md |
| Decompose a domain into microservices | microservices-architecture.md |
| Build an event-driven system | event-driven-architecture.md |
| Scale reads independently from writes | cqrs.md |
| Offload heavy work from the request path | async-processing.md |
| Handle flow control in high-throughput systems | backpressure.md |
| Build confidence in system resilience | chaos-engineering.md |
| Reduce origin load with CDN/edge caching | cdn-edge-computing.md |
