# 02-caching/concepts/ — Layer 2 Router

Theory articles covering caching from fundamentals through distributed cache design, CDNs, and advanced patterns.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to caching concepts and how they fit together |
| caching-fundamentals | What caching is, why it works, cache hit/miss ratios, eviction basics |
| caching-strategies | Cache-aside, read-through, write-through, write-behind — when to use each |
| cache-invalidation-strategies | TTL, event-driven invalidation, versioning, and the hardest problem in caching |
| distributed-cache-design | Designing a horizontally scaled cache layer: sharding, replication, consistency |
| cdn-cache-deep-dive | How CDN caching works: edge nodes, cache-control, purging strategies |
| cache-stampede-prevention | Techniques to prevent multiple requests simultaneously regenerating a cold cache entry |
| hot-key-problem | Causes and solutions for hot keys overloading a single cache node |
| write-behind-caching | Asynchronous write-behind (write-back) caching: benefits and durability risks |
| multi-layer-caching | L1 (in-process), L2 (Redis), L3 (CDN) caching strategies in combination |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start learning about caching | caching-fundamentals |
| Choose the right caching strategy | caching-strategies |
| Understand how to keep cache in sync | cache-invalidation-strategies |
| Design a scalable cache tier | distributed-cache-design |
| Speed up static assets globally | cdn-cache-deep-dive |
| Handle traffic spikes that hit cold cache | cache-stampede-prevention |
| Handle uneven load across cache nodes | hot-key-problem |
| Implement async writes to improve latency | write-behind-caching |
| Design a layered caching architecture | multi-layer-caching |
