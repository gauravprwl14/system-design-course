# Database Query Optimization

## Question
**"How do you optimize slow database queries? Explain EXPLAIN ANALYZE, N+1 queries, and common optimization techniques."**

Common in: Backend, Database, Performance Engineering interviews

---

## 📊 Quick Answer

**Optimization Steps (in order)**:
1. **Identify slow queries** (pg_stat_statements, logs)
2. **Analyze execution plan** (EXPLAIN ANALYZE)
3. **Add indexes** (most common fix)
4. **Rewrite query** (avoid subqueries, use JOINs)
5. **Limit result set** (LIMIT, pagination)
6. **Cache results** (Redis)

**Common Problems**:
- **Sequential scans** → Add index
- **N+1 queries** → Use JOINs or eager loading
- **Large result sets** → Add LIMIT, pagination
- **Missing indexes** → CREATE INDEX
- **Complex subqueries** → Rewrite as JOINs

**80% of slow queries** = Missing or wrong indexes!

---

## 🎯 Complete Solutions

### 1. Identify Slow Queries

#### Using pg_stat_statements (PostgreSQL)

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slowest queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

/*
Example output:
query                                  | calls | total_exec_time | mean_exec_time | max_exec_time
---------------------------------------+-------+-----------------+----------------+--------------
SELECT * FROM orders WHERE user_id...  | 15234 | 456789.123      | 29.98          | 5234.56
SELECT * FROM products WHERE...       | 8234  | 234567.890      | 28.50          | 3456.78
*/

-- Find queries with high variance (inconsistent performance)
SELECT
  query,
  mean_exec_time,
  stddev_exec_time,
  stddev_exec_time / mean_exec_time AS variance_ratio
FROM pg_stat_statements
WHERE stddev_exec_time > 100
ORDER BY variance_ratio DESC;
```

#### Application-Level Tracking

```javascript
// query-tracker.js
const { Pool } = require('pg');

class ProfiledPool extends Pool {
  async query(text, params) {
    const start = Date.now();

    try {
      const result = await super.query(text, params);
      const duration = Date.now() - start;

      // Log slow queries
      if (duration > 100) {
        console.warn('SLOW QUERY:', {
          duration: `${duration}ms`,
          query: text.substring(0, 100),
          params,
          rows: result.rowCount
        });
      }

      return result;
    } catch (err) {
      console.error('Query error:', err);
      throw err;
    }
  }
}

const pool = new ProfiledPool({
  host: 'localhost',
  database: 'myapp'
});

// Usage - automatically logs slow queries
app.get('/api/users/:id/orders', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1',
    [req.params.id]
  );

  res.json(result.rows);
});
```

---

### 2. EXPLAIN ANALYZE - Understand Execution Plans

```sql
-- EXPLAIN: Show query plan (no execution)
EXPLAIN
SELECT * FROM orders
WHERE user_id = 123 AND status = 'completed'
ORDER BY created_at DESC;

/*
Output:
Seq Scan on orders  (cost=0.00..1234.56 rows=10 width=120)
  Filter: ((user_id = 123) AND (status = 'completed'))
*/

-- EXPLAIN ANALYZE: Show actual execution (runs the query!)
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123 AND status = 'completed'
ORDER BY created_at DESC;

/*
Output:
Seq Scan on orders  (cost=0.00..1234.56 rows=10 width=120) (actual time=0.123..145.678 rows=10 loops=1)
  Filter: ((user_id = 123) AND (status = 'completed'))
  Rows Removed by Filter: 98765
Planning Time: 0.234 ms
Execution Time: 145.912 ms
*/

-- EXPLAIN (BUFFERS): Show memory usage
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;

-- EXPLAIN (FORMAT JSON): JSON output
EXPLAIN (ANALYZE, FORMAT JSON)
SELECT * FROM orders WHERE user_id = 123;
```

**Reading EXPLAIN Output**:

```sql
-- BAD: Sequential Scan (slow - scans entire table)
Seq Scan on orders  (cost=0.00..1234.56 rows=10 width=120) (actual time=0.123..145.678 rows=10 loops=1)
  Filter: (user_id = 123)
  Rows Removed by Filter: 98765  ← Scanned 98,775 rows to find 10!

-- GOOD: Index Scan (fast - uses index)
Index Scan using idx_orders_user_id on orders  (cost=0.42..12.45 rows=10 width=120) (actual time=0.012..0.234 rows=10 loops=1)
  Index Cond: (user_id = 123)

-- BETTER: Index Only Scan (fastest - no table access)
Index Only Scan using idx_orders_user_status on orders  (cost=0.42..8.45 rows=10 width=12) (actual time=0.005..0.012 rows=10 loops=1)
  Index Cond: (user_id = 123 AND status = 'completed')
  Heap Fetches: 0  ← Didn't need to access table!
```

**Cost Explanation**:
- `cost=0.42..12.45` = Estimated cost (startup..total)
- `rows=10` = Estimated rows returned
- `actual time=0.012..0.234` = Actual time (ms)
- `loops=1` = How many times this node executed

---

### 3. Adding Indexes (Most Important!)

#### Problem: Sequential Scan

```sql
-- SLOW: Sequential scan (1000ms)
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123;

/*
Seq Scan on orders  (actual time=0.123..1000.456 rows=10 loops=1)
  Filter: (user_id = 123)
  Rows Removed by Filter: 1000000  ← Scanned 1M rows!
*/

-- Solution: Add index
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- FAST: Index scan (5ms)
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123;

/*
Index Scan using idx_orders_user_id on orders  (actual time=0.012..5.234 rows=10 loops=1)
  Index Cond: (user_id = 123)
*/
```

#### Composite Index (Multiple Columns)

```sql
-- Query with multiple conditions
SELECT * FROM orders
WHERE user_id = 123
  AND status = 'completed'
  AND created_at > '2024-01-01'
ORDER BY created_at DESC;

-- Single-column index: Not optimal
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Better: Composite index
CREATE INDEX idx_orders_user_status_date ON orders(user_id, status, created_at DESC);

-- Index column order matters!
-- Rule: Equality (=) → Range (>, <) → Sort (ORDER BY)
```

#### Covering Index (Index-Only Scan)

```sql
-- Query selecting specific columns
SELECT id, total, status FROM orders
WHERE user_id = 123;

-- Regular index: Still needs table access
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Covering index: Includes all selected columns
CREATE INDEX idx_orders_user_covering ON orders(user_id) INCLUDE (id, total, status);

-- Result: Index-Only Scan (no table access!)
EXPLAIN ANALYZE
SELECT id, total, status FROM orders WHERE user_id = 123;

/*
Index Only Scan using idx_orders_user_covering on orders  (actual time=0.005..0.012 rows=10 loops=1)
  Index Cond: (user_id = 123)
  Heap Fetches: 0  ← No table access!
*/
```

---

### 4. Fixing N+1 Query Problem

#### Problem: N+1 Queries

```javascript
// ❌ BAD: N+1 queries (1 + N database calls)
app.get('/api/users', async (req, res) => {
  // 1 query to get users
  const users = await pool.query('SELECT * FROM users LIMIT 10');

  // N queries (10 more!) to get orders for each user
  const usersWithOrders = [];
  for (const user of users.rows) {
    const orders = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1',
      [user.id]
    );
    usersWithOrders.push({ ...user, orders: orders.rows });
  }

  res.json(usersWithOrders);
  // Total: 11 database queries! (1 + 10)
});
```

#### Solution 1: JOIN Query

```javascript
// ✅ GOOD: Single JOIN query
app.get('/api/users', async (req, res) => {
  const result = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      json_agg(json_build_object(
        'id', o.id,
        'total', o.total,
        'status', o.status
      )) as orders
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE u.id IN (SELECT id FROM users LIMIT 10)
    GROUP BY u.id, u.name, u.email
  `);

  res.json(result.rows);
  // Total: 1 database query (10x faster!)
});
```

#### Solution 2: Bulk Loading (DataLoader Pattern)

```javascript
// dataloader-example.js
const DataLoader = require('dataloader');

// Batch load orders for multiple users
const orderLoader = new DataLoader(async (userIds) => {
  const result = await pool.query(
    'SELECT * FROM orders WHERE user_id = ANY($1::int[])',
    [userIds]
  );

  // Group orders by user_id
  const ordersByUser = {};
  result.rows.forEach(order => {
    if (!ordersByUser[order.user_id]) {
      ordersByUser[order.user_id] = [];
    }
    ordersByUser[order.user_id].push(order);
  });

  // Return orders in same order as userIds
  return userIds.map(id => ordersByUser[id] || []);
});

app.get('/api/users', async (req, res) => {
  const users = await pool.query('SELECT * FROM users LIMIT 10');

  // Load orders in batch (single query for all users!)
  const usersWithOrders = await Promise.all(
    users.rows.map(async (user) => ({
      ...user,
      orders: await orderLoader.load(user.id)
    }))
  );

  res.json(usersWithOrders);
  // Total: 2 database queries (1 for users + 1 batched for orders)
});
```

---

### 5. Query Rewriting

#### Avoid Subqueries in SELECT

```sql
-- ❌ BAD: Subquery in SELECT (runs for each row!)
SELECT
  u.id,
  u.name,
  (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
  (SELECT SUM(total) FROM orders WHERE user_id = u.id) as total_spent
FROM users u;

-- ✅ GOOD: JOIN with aggregation
SELECT
  u.id,
  u.name,
  COUNT(o.id) as order_count,
  COALESCE(SUM(o.total), 0) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;
```

#### Use EXISTS Instead of COUNT

```sql
-- ❌ BAD: COUNT (counts all rows)
SELECT * FROM users
WHERE (SELECT COUNT(*) FROM orders WHERE user_id = users.id) > 0;

-- ✅ GOOD: EXISTS (stops at first match)
SELECT * FROM users u
WHERE EXISTS (
  SELECT 1 FROM orders WHERE user_id = u.id
);
```

#### Avoid OR with Different Columns

```sql
-- ❌ BAD: OR prevents index usage
SELECT * FROM products
WHERE category = 'electronics' OR price < 100;

-- ✅ GOOD: UNION (uses indexes)
SELECT * FROM products WHERE category = 'electronics'
UNION
SELECT * FROM products WHERE price < 100;
```

#### Use LIMIT

```sql
-- ❌ BAD: Returns millions of rows
SELECT * FROM orders
WHERE status = 'completed'
ORDER BY created_at DESC;

-- ✅ GOOD: Limit results
SELECT * FROM orders
WHERE status = 'completed'
ORDER BY created_at DESC
LIMIT 100;
```

---

### 6. Pagination (Offset vs Cursor)

#### Offset Pagination (Simple but slow for large offsets)

```javascript
// ❌ SLOW: Offset pagination (skips 1M rows!)
app.get('/api/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const result = await pool.query(
    'SELECT * FROM products ORDER BY id LIMIT $1 OFFSET $2',
    [limit, offset]
  );

  res.json(result.rows);
});

// Page 50,000: OFFSET 1,000,000
// Database scans 1M rows just to skip them!
```

#### Cursor Pagination (Fast for any page)

```javascript
// ✅ FAST: Cursor pagination
app.get('/api/products', async (req, res) => {
  const cursor = req.query.cursor; // Last ID from previous page
  const limit = 20;

  const query = cursor
    ? 'SELECT * FROM products WHERE id > $1 ORDER BY id LIMIT $2'
    : 'SELECT * FROM products ORDER BY id LIMIT $1';

  const params = cursor ? [cursor, limit] : [limit];

  const result = await pool.query(query, params);

  res.json({
    products: result.rows,
    nextCursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null
  });
});

// Uses index on id - always fast!
// EXPLAIN: Index Scan (actual time=0.012..0.234)
```

---

### 7. Caching Query Results

```javascript
// cache-layer.js
const Redis = require('ioredis');
const redis = new Redis();

async function getCachedQuery(cacheKey, query, params, ttl = 300) {
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('CACHE HIT');
    return JSON.parse(cached);
  }

  console.log('CACHE MISS');

  // Query database
  const result = await pool.query(query, params);

  // Cache result
  await redis.setex(cacheKey, ttl, JSON.stringify(result.rows));

  return result.rows;
}

// Usage
app.get('/api/products', async (req, res) => {
  const products = await getCachedQuery(
    'products:active',
    'SELECT * FROM products WHERE active = true ORDER BY created_at DESC LIMIT 100',
    [],
    600 // 10 minutes
  );

  res.json(products);
});

// First request: 200ms (DB query)
// Subsequent requests: 5ms (cache hit) - 40x faster!
```

---

## 📊 Optimization Checklist

### Before Optimization

```sql
-- Example slow query (2000ms)
SELECT
  o.*,
  u.name as user_name,
  p.name as product_name
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.status = 'completed'
  AND o.created_at > '2024-01-01'
ORDER BY o.created_at DESC;

EXPLAIN ANALYZE:
Seq Scan on orders  (actual time=0.123..1500.456 rows=100000 loops=1)
  Filter: ((status = 'completed') AND (created_at > '2024-01-01'))
  Rows Removed by Filter: 500000
Hash Join  (actual time=50.123..2000.456 rows=100000 loops=1)
  ...
Execution Time: 2000.456 ms
```

### Optimization Steps

```sql
-- Step 1: Add indexes
CREATE INDEX idx_orders_status_date ON orders(status, created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Step 2: Rewrite query (select only needed columns)
SELECT
  o.id,
  o.total,
  o.created_at,
  u.name as user_name,
  p.name as product_name
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.status = 'completed'
  AND o.created_at > '2024-01-01'
ORDER BY o.created_at DESC
LIMIT 100;  -- Step 3: Add LIMIT

EXPLAIN ANALYZE:
Index Scan using idx_orders_status_date on orders  (actual time=0.012..15.234 rows=100 loops=1)
  Index Cond: ((status = 'completed') AND (created_at > '2024-01-01'))
Hash Join  (actual time=1.123..20.456 rows=100 loops=1)
  ...
Execution Time: 20.456 ms  ← 100x faster!
```

---

## 🎓 Interview Tips

### Common Questions

**Q: How do you find slow queries?**
A: "Use pg_stat_statements to find queries with high mean_exec_time, enable slow query logging (log_min_duration_statement = 100), use APM tools (Datadog, New Relic), or add application-level query tracking."

**Q: What's the first thing you check for slow queries?**
A: "EXPLAIN ANALYZE to see execution plan. Look for Sequential Scans (bad) vs Index Scans (good). Check 'Rows Removed by Filter' - high number means missing index."

**Q: When should you NOT add an index?**
A: "1) Write-heavy tables (indexes slow down INSERT/UPDATE), 2) Low cardinality columns (e.g., boolean), 3) Small tables (<10k rows), 4) Columns that change frequently. Every index slows writes by ~10%."

**Q: How do you optimize a query that's already using indexes?**
A: "1) Use covering index (INCLUDE columns), 2) Reduce result set (LIMIT, WHERE), 3) Cache results (Redis), 4) Denormalize data (avoid JOINs), 5) Partition table (for very large tables)."

---

## 🔗 Related Questions

- [Indexing Strategies](/interview-prep/database-storage/indexing-strategies)
- [Database Scaling Strategies](/interview-prep/database-storage/scaling-strategies)
- [Performance Bottleneck Identification](/interview-prep/caching-cdn/performance-bottlenecks)
- [API Metrics (P95/P99)](/interview-prep/caching-cdn/api-metrics)

---

## 📚 Additional Resources

- [PostgreSQL EXPLAIN Documentation](https://www.postgresql.org/docs/current/using-explain.html)
- [Use The Index, Luke!](https://use-the-index-luke.com/)
- [pgMustard - EXPLAIN Visualizer](https://www.pgmustard.com/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
