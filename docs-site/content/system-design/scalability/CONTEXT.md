> **Migrated to [/06-scalability](/06-scalability)**: Topic map and cross-references have been added to `/06-scalability/index.md`. Active content lives in `/06-scalability/concepts/` and `/06-scalability/hands-on/`. Load balancing hands-on POCs also exist in `/06-scalability/hands-on/`. This file is retained for historical reference.

# system-design/scalability/ — Layer 2 Router

Routes across scalability patterns: from basic scaling to multi-region, event-driven, and chaos engineering.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| scaling-basics | concept | Vertical vs horizontal scaling, when to use each |
| stateless-architecture | concept | Making services stateless for horizontal scale |
| high-availability | concept | Redundancy, failover, and uptime guarantees |
| microservices-architecture | concept | Decomposing monoliths into services |
| async-processing | concept | Decoupling work with queues and async patterns |
| auto-scaling | concept | Dynamic capacity based on load |
| cdn-edge-computing | concept | Pushing content and compute closer to users |
| multi-region | concept | Operating across geographic regions |
| event-driven-architecture | concept | Loosely coupled systems via events |
| cqrs | concept | Separating read and write models |
| backpressure | concept | Flow control to prevent overload |
| chaos-engineering | concept | Testing resilience by injecting failures |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| How do I scale my app from scratch? | scaling-basics | scaling-basics, stateless-architecture |
| How do I ensure my service stays up? | high-availability | high-availability |
| How do I break a monolith into microservices? | microservices-architecture | microservices-architecture |
| How do I handle bursty traffic? | auto-scaling | auto-scaling, backpressure |
| How do I serve global users fast? | cdn-edge-computing | cdn-edge-computing, multi-region |
| How do I use events to decouple services? | event-driven-architecture | event-driven-architecture, cqrs |
| How do I test if my system handles failures? | chaos-engineering | chaos-engineering |
| Interview questions on scalability | interview-prep/ | interview-prep/system-design/ |
