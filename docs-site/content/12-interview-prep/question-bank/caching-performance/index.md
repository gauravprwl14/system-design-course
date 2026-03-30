[← Question Bank](/12-interview-prep/question-bank) / Caching & Performance

# ⚡ Caching & Performance — Question Bank

**10 topics · ~60 interview questions**

Caching questions appear in 90%+ of system design interviews. Invalidation and stampede are the most common gotchas.

## All Topics

| Topic | Difficulty | Priority | Questions |
|-------|-----------|----------|-----------|
| [Cache Invalidation Strategies](cache-invalidation-strategies) | 🟡 Mid | P0 | TTL, event-driven, cache-aside, write-through |
| [CDN Caching Strategies](cdn-caching-strategies) | 🟡 Mid | P0 | Edge caching, Cache-Control, purge strategies |
| [Database Query Caching](database-query-caching) | 🟡 Mid | P0 | Query cache, result cache, materialized views |
| [Application Layer Caching](application-layer-caching) | 🟡 Mid | P0 | In-process cache, distributed cache, patterns |
| [Redis Advanced Patterns](redis-advanced-patterns) | 🔴 Senior | P1 | Pub/sub, sorted sets, Lua scripts, clustering |
| [Cache Stampede / Thundering Herd](cache-stampede-thundering-herd) | 🔴 Senior | P1 | Lock, probabilistic early expiry, XFetch |
| [Cache Sizing & Eviction](cache-sizing-eviction) | 🔴 Senior | P1 | LRU, LFU, ARC, hit rate modeling |
| [Write-Behind & Write-Through](write-behind-write-through) | 🟡 Mid | P1 | Durability trade-offs, consistency guarantees |
| [Multi-Level Caching](multi-level-caching) | 🔴 Senior | P1 | L1/L2/L3 hierarchy, coherence, invalidation |
| [Cache Warming Strategies](cache-warming-strategies) | 🔴 Senior | P2 | Cold start, pre-warming, lazy vs eager loading |

## Start Here: P0 Questions

For most interviews, focus on these first:
1. [Cache Invalidation Strategies](cache-invalidation-strategies) — "cache invalidation is one of the two hard problems"
2. [CDN Caching Strategies](cdn-caching-strategies) — asked whenever a system serves static or semi-static content
3. [Database Query Caching](database-query-caching) — first optimization lever for read-heavy systems
4. [Application Layer Caching](application-layer-caching) — cache-aside pattern is the most common interview answer

---

[← Back to Question Bank](/12-interview-prep/question-bank)
