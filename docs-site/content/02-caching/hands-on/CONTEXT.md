# 02-caching/hands-on/ — Layer 2 Router

Runnable implementations of core caching patterns with working code examples.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Guide to the hands-on caching POCs |
| cache-aside-pattern | Implementing the cache-aside (lazy loading) pattern with Redis |
| cache-invalidation-strategies | Code examples for TTL-based and event-driven cache invalidation |
| write-through-caching | Implementing write-through caching to keep cache and DB in sync |
| http-caching-headers | Setting Cache-Control, ETag, and Last-Modified headers correctly |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Implement basic caching with Redis | cache-aside-pattern |
| Implement cache writes that stay consistent | write-through-caching |
| Handle cache expiry and invalidation in code | cache-invalidation-strategies |
| Cache HTTP responses at the browser/CDN layer | http-caching-headers |
