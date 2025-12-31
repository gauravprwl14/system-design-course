# Caching Strategies

> Speed up your application by 10-100× with intelligent caching

## 📋 Overview

Caching is the most impactful performance optimization. By storing frequently accessed data in fast storage (memory), you can dramatically reduce database load and response times.

## 📚 Articles

### Fundamentals (🟢 Beginner)
1. [Caching Fundamentals](./01-caching-fundamentals.md) - What, why, when to cache
2. [Cache-Aside Pattern](./02-cache-aside.md) - Most common caching pattern
3. [Write-Through Cache](./03-write-through.md) - Write to cache and DB together
4. [Write-Back Cache](./04-write-back.md) - Write to cache, async to DB
5. [Cache Invalidation](./05-cache-invalidation.md) - Keeping cache fresh

### Intermediate Topics (🟡 Intermediate)
6. [Distributed Caching with Redis](./06-redis-distributed.md) - Shared cache across servers
7. [Cache Warming Strategies](./07-cache-warming.md) - Pre-populate cache
8. [Cache Stampede Prevention](./08-cache-stampede.md) - Thundering herd problem
9. [Multi-Layer Caching](./09-multi-layer-cache.md) - L1/L2 cache hierarchy
10. [CDN Caching](./10-cdn-caching.md) - Edge caching for static assets

### Advanced Topics (🔴 Advanced)
11. [Cache Consistency Patterns](./11-cache-consistency.md) - Strong vs eventual consistency
12. [Probabilistic Data Structures](./12-bloom-filters.md) - Bloom filters, HyperLogLog
13. [Session Store Patterns](./13-session-store.md) - User session caching
14. [Query Result Caching](./14-query-result-cache.md) - Database query caching
15. [Cache Eviction Policies](./15-eviction-policies.md) - LRU, LFU, TTL strategies

## 🎯 Quick Reference

| Use Case | Strategy | Article |
|----------|----------|---------|
| Read-heavy app | Cache-Aside | [#02](./02-cache-aside.md) |
| Strong consistency | Write-Through | [#03](./03-write-through.md) |
| High write volume | Write-Back | [#04](./04-write-back.md) |
| Multiple servers | Redis/Memcached | [#06](./06-redis-distributed.md) |
| Static assets | CDN | [#10](./10-cdn-caching.md) |
| API responses | Multi-layer | [#09](./multi-layer-cache.md) |

## 🚀 Impact

**Before Caching**:
- Database queries: 50ms average
- API response: 100ms
- Database load: 10,000 queries/sec

**After Caching**:
- Cache hits: 0.5ms (100× faster)
- API response: 5ms (20× faster)
- Database load: 1,000 queries/sec (90% reduction)

Start learning with [Caching Fundamentals](./01-caching-fundamentals.md)!
