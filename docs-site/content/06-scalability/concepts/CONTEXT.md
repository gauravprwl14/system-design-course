# 06-scalability/concepts/ — Layer 2 Router

Scaling theory and architectural patterns: high availability, auto-scaling, consistent hashing, rate limiting, and global distribution.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to scalability concepts and the scaling dimensions |
| scaling-basics | Vertical vs horizontal scaling, scale-out principles, stateless services |
| high-availability | HA design: redundancy, health checks, failover, SLA targets |
| auto-scaling | Reactive and predictive auto-scaling: metrics, thresholds, warm-up lag |
| consistent-hashing-deep-dive | Consistent hashing ring, virtual nodes, handling node joins/leaves without reshuffling |
| rate-limiting-algorithms | Fixed window, sliding window, token bucket, leaky bucket — trade-offs and use cases |
| leader-election | Leader election algorithms: Bully, Raft-based, and ZooKeeper/etcd approaches |
| hot-spot-detection | Detecting and mitigating traffic hot spots in distributed systems |
| database-read-scaling | Read replicas, CQRS, and read-scaling patterns for high-traffic applications |
| write-scaling-patterns | Sharding, write buffering, CQRS, and event sourcing for scaling writes |
| global-distribution-strategy | Multi-region data residency, latency optimization, and geo-routing strategies |
| stateless-architecture | Making services stateless: externalizing state to cache/DB for horizontal scale |
| multi-region | Active-active vs active-passive multi-region deployments and data synchronization |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start with scaling fundamentals | scaling-basics |
| Design for 99.99% uptime | high-availability |
| Handle traffic spikes automatically | auto-scaling |
| Distribute load across nodes without rehashing | consistent-hashing-deep-dive |
| Protect services from traffic floods | rate-limiting-algorithms |
| Elect a primary node in a distributed cluster | leader-election |
| Scale read-heavy workloads | database-read-scaling |
| Scale write-heavy workloads | write-scaling-patterns |
| Serve users globally with low latency | global-distribution-strategy, multi-region |
| Make services horizontally scalable | stateless-architecture |
