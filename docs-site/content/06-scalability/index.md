# Scalability

Scaling is not just about adding more servers — it requires rethinking how data flows through your system. This section covers the core techniques used at FAANG scale.

```mermaid
graph TD
    subgraph "Horizontal"
        LB[Load Balancer] --> S1[Server 1]
        LB --> S2[Server 2]
        LB --> S3[Server N...]
    end
    subgraph "Data"
        SHARD[Sharding]
        REP[Read Replicas]
    end
    subgraph "Traffic"
        RL[Rate Limiting]
        CB[Circuit Breaker]
        CDN[CDN]
    end
```

## What You'll Learn

- **Concepts**: Consistent hashing, rate limiting, leader election, global distribution
- **Hands-On**: Implement load balancers, consistent hashing, rate limiters
- **Failure Modes**: Hot spot detection and mitigation

## Where to Start

1. [Scaling Basics](/06-scalability/concepts/scaling-basics) — Vertical vs horizontal, stateless design
2. [Consistent Hashing Deep Dive](/06-scalability/concepts/consistent-hashing-deep-dive) — The foundation of distributed data
3. [Rate Limiting Algorithms](/06-scalability/concepts/rate-limiting-algorithms) — Token bucket, sliding window, fixed window
4. [Load Balancer: Round Robin](/06-scalability/hands-on/load-balancer-round-robin) — Implement from scratch

## Topic Map

| Topic | Concepts | Hands-On | Problems at Scale | Interview Prep |
|-------|----------|----------|-------------------|----------------|
| Scaling basics | [scaling-basics](/06-scalability/concepts/scaling-basics), [stateless-architecture](/06-scalability/concepts/stateless-architecture) | — | — | [load-balancing-strategies](/12-interview-prep/system-design/fundamentals/load-balancing-strategies) |
| High availability | [high-availability](/06-scalability/concepts/high-availability) | — | — | [scale-and-reliability](/12-interview-prep/system-design/scale-and-reliability/) |
| Auto-scaling | [auto-scaling](/06-scalability/concepts/auto-scaling) | — | — | [auto-scaling](/12-interview-prep/quick-reference/aws-cloud/auto-scaling) |
| CDN & edge computing | [global-distribution-strategy](/06-scalability/concepts/global-distribution-strategy), [multi-region](/06-scalability/concepts/multi-region) | — | — | [cdn-edge-computing-media](/12-interview-prep/system-design/scale-and-reliability/cdn-edge-computing-media) |
| Load balancing | — | [load-balancer-round-robin](/06-scalability/hands-on/load-balancer-round-robin), [load-balancer-least-connections](/06-scalability/hands-on/load-balancer-least-connections), [load-balancer-consistent-hashing](/06-scalability/hands-on/load-balancer-consistent-hashing), [nginx-load-balancer](/06-scalability/hands-on/nginx-load-balancer) | — | [load-balancing-strategies](/12-interview-prep/system-design/fundamentals/load-balancing-strategies) |
| Chaos engineering | — | [chaos-engineering](/06-scalability/hands-on/chaos-engineering) | — | — |
