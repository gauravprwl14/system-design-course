# 06-scalability/ — Layer 1 Module

Horizontal and vertical scaling patterns, load balancing, consistent hashing, auto-scaling, rate limiting, and multi-region architecture.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Scaling theory: HA, auto-scaling, consistent hashing, rate limiting algorithms, global distribution |
| hands-on/ | poc | Runnable load balancer and consistent hashing implementations |
| failures/ | problem | Scalability failure modes (overview only — currently being expanded) |

## Article Count
- concepts/: 12 articles
- hands-on/: 7 articles
- failures/: 0 articles (overview only)
- Total: 19 articles (plus index)

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Understand scaling basics | concepts/ | scaling-basics.md |
| Design for high availability | concepts/ | high-availability.md |
| Set up auto-scaling | concepts/ | auto-scaling.md |
| Understand consistent hashing | concepts/ | consistent-hashing-deep-dive.md |
| Design rate limiting | concepts/ | rate-limiting-algorithms.md |
| Implement leader election | concepts/ | leader-election.md |
| Detect and fix hot spots | concepts/ | hot-spot-detection.md |
| Scale database reads | concepts/ | database-read-scaling.md |
| Scale database writes | concepts/ | write-scaling-patterns.md |
| Plan global distribution | concepts/ | global-distribution-strategy.md |
| Design stateless services | concepts/ | stateless-architecture.md |
| Design multi-region architecture | concepts/ | multi-region.md |
| Implement load balancing in code | hands-on/ | load-balancer-round-robin.md, load-balancer-least-connections.md |
| Implement consistent hashing in code | hands-on/ | consistent-hashing-poc.md |
| Configure Nginx as a load balancer | hands-on/ | nginx-load-balancer.md |
| Implement service discovery | hands-on/ | service-discovery.md |

## Prerequisites
- 01-databases/ — database scaling before learning broader scalability patterns
- 02-caching/ — caching as a read-scaling technique
- 05-distributed-systems/ — consistency trade-offs when scaling

## Connects To
- 04-messaging/ — async messaging for write scalability
- 10-architecture/ — system design patterns that compose scalability primitives
- 11-real-world/ — how real companies applied these patterns at scale
