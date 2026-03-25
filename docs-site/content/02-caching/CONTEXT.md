# 02-caching/ — Layer 1 Module

Comprehensive coverage of caching theory, strategies, failure modes, and hands-on patterns for building fast, cache-backed systems.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Theory articles on caching fundamentals, strategies, invalidation, distributed caches, and CDNs |
| hands-on/ | poc | Runnable implementations of core caching patterns: cache-aside, write-through, HTTP caching |
| failures/ | problem | Cache failure modes including invalidation race conditions |

## Article Count
- concepts/: 9 articles
- hands-on/: 4 articles
- failures/: 1 article
- Total: 14 articles (plus index)

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Understand caching from scratch | concepts/ | caching-fundamentals.md |
| Learn the main caching strategies | concepts/ | caching-strategies.md |
| Understand cache invalidation approaches | concepts/ | cache-invalidation-strategies.md |
| Design a distributed cache | concepts/ | distributed-cache-design.md |
| Understand CDN caching | concepts/ | cdn-cache-deep-dive.md |
| Prevent cache stampede / thundering herd | concepts/ | cache-stampede-prevention.md |
| Deal with hot key problems | concepts/ | hot-key-problem.md |
| Implement write-behind caching | concepts/ | write-behind-caching.md |
| Design multi-layer caching | concepts/ | multi-layer-caching.md |
| Implement cache-aside pattern in code | hands-on/ | cache-aside-pattern.md |
| Implement write-through caching in code | hands-on/ | write-through-caching.md |
| Set HTTP cache headers correctly | hands-on/ | http-caching-headers.md |
| Understand invalidation race conditions | failures/ | cache-invalidation-race.md |

## Prerequisites
- 01-databases/ — understanding what is being cached

## Connects To
- 03-redis/ — Redis as the primary cache backend
- 06-scalability/ — caching as a read-scaling technique
- 05-distributed-systems/ — consistency trade-offs with distributed caches
