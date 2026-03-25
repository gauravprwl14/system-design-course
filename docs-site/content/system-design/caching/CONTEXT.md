> **Migrated to [/02-caching](/02-caching)**: Topic map and cross-references have been added to `/02-caching/index.md`. Active article content lives in `/02-caching/concepts/` and `/02-caching/hands-on/`. This file is retained for historical reference.

# system-design/caching/ — Layer 2 Router

Routes across caching theory: fundamentals and strategy patterns.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| caching-fundamentals | concept | Cache hits/misses, eviction policies, cache levels |
| caching-strategies | concept | Cache-aside, write-through, write-behind, read-through |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| What is caching and how does it work? | caching-fundamentals | caching-fundamentals |
| Which caching strategy should I use? | caching-strategies | caching-strategies |
| Hands-on Redis caching practice | practice-pocs/ | redis-key-value-cache, cache-aside-pattern, write-through-caching |
| Cache invalidation failures | problems-at-scale/ | problems-at-scale/consistency/cache-invalidation-race |
| Thundering herd on cache miss | problems-at-scale/ | problems-at-scale/availability/thundering-herd |
| Interview question on caching | interview-prep/ | interview-prep/system-design/caching-strategies |
| CDN and edge caching | interview-prep/ | interview-prep/caching-cdn/cdn-usage |
