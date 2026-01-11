# ⚡ Performance Degradation

## Overview

Problems where **system response times increase dramatically under load** or certain operations become unacceptably slow. Performance issues often start small but compound at scale.

**Why this matters**: Every 100ms of latency costs Amazon 1% in sales. Google found 500ms slower search results led to 20% traffic drop. Performance directly impacts revenue and user retention.

---

## Common Scenarios

### Database Performance
- **N+1 query problem**: Loading 100 posts generates 101 database queries
- **Slow queries**: Missing indexes cause full table scans
- **Query timeout**: Complex joins take 30+ seconds
- **Connection overhead**: Opening new connections for each request

### Application Performance
- **Memory leaks**: Application memory grows until OOM crash
- **Blocking I/O**: Synchronous operations block all request processing
- **CPU-bound operations**: Heavy computation blocks event loop
- **Large payloads**: Returning 100MB JSON causes timeouts

### Network Performance
- **Chatty APIs**: Multiple round-trips for single operation
- **No compression**: Large responses without gzip
- **HTTP/1.1 limits**: Head-of-line blocking

---

## Key Patterns

### 1. N+1 Query Problem
```javascript
// Load 100 posts
posts = db.query("SELECT * FROM posts LIMIT 100");

// For each post, load author (101 queries total!)
for (post of posts) {
  post.author = db.query("SELECT * FROM users WHERE id = ?", post.author_id);
}

Result: 1 query + 100 queries = 101 database round-trips
At 5ms per query = 505ms just for data fetching
```

**Solution**: DataLoader, eager loading, JOIN queries

### 2. Slow Query (Missing Index)
```sql
-- Find all orders for user (no index on user_id)
SELECT * FROM orders WHERE user_id = 12345;

Execution plan:
  Seq Scan on orders (100,000,000 rows)
  Time: 45,000ms

With index:
  Index Scan using idx_user_id (50 rows)
  Time: 2ms
```

**Solution**: Add indexes, query optimization

### 3. Memory Leak
```javascript
// Event listeners never removed
function addHandler() {
  const bigData = new Array(1000000);
  element.addEventListener('click', () => {
    console.log(bigData.length); // bigData never GC'd
  });
}

// Called 10,000 times
for (let i = 0; i < 10000; i++) {
  addHandler(); // Memory grows by 100MB each call
}

Result: 1GB memory leak, eventually OOM crash
```

**Solution**: Remove event listeners, weak references

---

## Problems in This Category

| Problem | Domain | Impact | Difficulty | Status |
|---------|--------|--------|------------|--------|
| [N+1 Query Problem](/problems-at-scale/performance/n-plus-one) | Web Apps | Slow page loads | 🟡 Intermediate | 🚧 Problem documented |
| [Slow Database Queries](/problems-at-scale/performance/slow-queries) | Analytics | Timeouts | 🟡 Intermediate | 🚧 Problem documented |
| [Memory Leaks](/problems-at-scale/performance/memory-leak) | Backend Services | Crashes | 🔴 Advanced | 🚧 Problem documented |
| [Blocking I/O](/problems-at-scale/performance/blocking-io) | Web Servers | Low throughput | 🟡 Intermediate | 🚧 Problem documented |
| [Large API Payloads](/problems-at-scale/performance/large-payload) | APIs | Timeouts, bandwidth | 🟢 Beginner | 🚧 Problem documented |

---

## Common Solutions

### 1. Query Optimization
**Add indexes, optimize query plans**
- Pros: Dramatic performance improvement, low cost
- Cons: Writes slower, storage overhead
- When: Slow queries identified, high read volume

### 2. Caching
**Cache expensive operations in memory**
- Pros: 100-1000x faster, reduces load
- Cons: Stale data, cache invalidation complexity
- When: Expensive computations, hot data

### 3. Async/Non-blocking I/O
**Don't block threads waiting for I/O**
- Pros: Higher throughput, better resource usage
- Cons: Complex code, callback hell
- When: I/O-bound operations, high concurrency

### 4. Pagination
**Return data in chunks, not all at once**
- Pros: Lower latency, lower bandwidth
- Cons: Multiple requests, state management
- When: Large result sets, list views

---

## Real-World Impact

| Company | Problem | Scale | Impact |
|---------|---------|-------|--------|
| **Facebook** | N+1 queries | 1B users | Created DataLoader |
| **LinkedIn** | Slow feed queries | 800M users | 10s page loads |
| **Node.js** | Memory leaks | Widespread | App crashes |
| **Netflix** | Blocking I/O | 200M users | Built reactive framework |

---

## Detection & Prevention

### Monitoring
```sql
-- Detect slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Detect missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE correlation < 0.1
AND n_distinct > 1000;
```

### Prevention
- Use APM tools (New Relic, DataDog) to trace queries
- Set query timeouts (<5s for most operations)
- Load test with realistic data volumes
- Profile memory usage regularly
- Monitor P95/P99 latency (not just average)

---

## Related Categories

- [Scalability](/problems-at-scale/scalability) - Performance issues prevent scaling
- [Availability](/problems-at-scale/availability) - Slow performance causes timeouts
- [Cost Optimization](/problems-at-scale/cost-optimization) - Inefficient code wastes money

---

## Learn More

- [System Design: Database Indexing](/system-design/databases/indexing)
- [System Design: Caching Strategies](/system-design/caching)
- [POC: Query Optimization](/interview-prep/practice-pocs/query-optimization)

---

**Start exploring**: [N+1 Query Problem](/problems-at-scale/performance/n-plus-one) | [All Problems](/problems-at-scale)
