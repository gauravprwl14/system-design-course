# Database & Storage - Interview Questions

## 📋 Questions Covered

1. [SQL vs NoSQL: When to Use Each](/interview-prep/database-storage/sql-vs-nosql)
2. [Database Scaling Strategies](/interview-prep/database-storage/scaling-strategies)
3. [Query Optimization with EXPLAIN ANALYZE](/interview-prep/database-storage/query-optimization)
4. [Indexing Strategies (B-Tree, Hash, GIN, etc.)](/interview-prep/database-storage/indexing-strategies)
5. [Connection Pooling Best Practices](/interview-prep/database-storage/connection-pooling)

## 🎯 Quick Reference

| Question | Quick Answer | Article |
|----------|--------------|---------|
| SQL vs NoSQL? | SQL: structured, ACID. NoSQL: flexible, scalable | [View Article](/interview-prep/database-storage/sql-vs-nosql) |
| How to scale DB? | Vertical scaling → Read replicas → Sharding | [View Article](/interview-prep/database-storage/scaling-strategies) |
| Slow query? | EXPLAIN ANALYZE → Add index → Optimize query | [View Article](/interview-prep/database-storage/query-optimization) |
| When to index? | Columns in WHERE, JOIN, ORDER BY (high cardinality) | [View Article](/interview-prep/database-storage/indexing-strategies) |
| Pool size? | CPU cores × 2 + 1, monitor utilization | [View Article](/interview-prep/database-storage/connection-pooling) |

## 💡 Interview Tips

**Common Follow-ups**:
- "How do you optimize a slow query?"
- "When would you use NoSQL over SQL?"
- "Explain sharding vs partitioning"
- "How do you prevent connection leaks?"

**Red Flags to Avoid**:
- ❌ "NoSQL is always faster than SQL" (depends on use case!)
- ❌ Not understanding EXPLAIN ANALYZE
- ❌ Adding indexes without considering write overhead
- ❌ Not using connection pooling

## 🔥 Real-World Scenarios

### Scenario 1: "Database is slow during peak hours"
**Answer**:
1. Identify slow queries (pg_stat_statements)
2. Use EXPLAIN ANALYZE to find sequential scans
3. Add indexes on WHERE/JOIN columns
4. Add read replicas for read-heavy workloads
5. Implement caching (Redis) for hot data

### Scenario 2: "Connection pool exhausted"
**Answer**:
1. Check pool size (should be: CPU cores × 2 + 1)
2. Look for connection leaks (missing client.release())
3. Identify slow queries holding connections
4. Consider separate pools for slow queries
5. Implement request queuing/rate limiting

### Scenario 3: "Query takes 5 seconds with 1M rows"
**Answer**:
1. EXPLAIN ANALYZE to see execution plan
2. Add composite index (equality → range → sort)
3. Use LIMIT for pagination
4. Consider cursor-based pagination for large offsets
5. Cache results if data doesn't change frequently

## 📊 Performance Benchmarks

### Index Impact
```
Without Index:
- Sequential scan: 1000ms
- Filters 1M rows to find 10

With Index:
- Index scan: 5ms
- Directly finds 10 rows
- Result: 200x faster!
```

### Connection Pooling Impact
```
Without Pool:
- Create connection: 50ms
- Query: 10ms
- Total: 60ms per request

With Pool (size 20):
- Get from pool: 0.5ms
- Query: 10ms
- Total: 10.5ms per request
- Result: 6x faster!
```

### Read Replicas Impact
```
Single Database:
- 1000 reads/sec = Overloaded

With 3 Read Replicas:
- 3000 reads/sec = Distributed load
- Result: 3x read capacity!
```

## 🛠️ Quick Wins

### 1. Add Index (Easiest)
```sql
-- Find slow query
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
-- Seq Scan (1000ms)

-- Add index
CREATE INDEX idx_orders_user_id ON orders(user_id);
-- Index Scan (5ms) - 200x faster!
```

### 2. Connection Pooling (5-minute setup)
```javascript
// Before: New connection per request
const client = new Client();
await client.connect(); // 50ms overhead!

// After: Connection pool
const pool = new Pool({ max: 20 });
await pool.query(...); // 0.5ms overhead - 100x faster!
```

### 3. Read Replicas (Scale reads 10x)
```javascript
// Route reads to replicas
const readPool = new Pool({ host: 'replica.db.com' });
const writePool = new Pool({ host: 'primary.db.com' });

app.get('/api/products', async (req, res) => {
  const result = await readPool.query('SELECT ...');
  res.json(result.rows);
});
```

---

Start with: [SQL vs NoSQL](/interview-prep/database-storage/sql-vs-nosql)
