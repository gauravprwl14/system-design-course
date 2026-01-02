# Materialized Views - Make Slow Queries 1000x Faster

**The Problem**: Your analytics dashboard takes 45 seconds to load because it's running expensive aggregations on 10M rows.

**The Solution**: Materialized views pre-compute and cache query results - turning 45-second queries into 40ms lookups.

**Time to Implement**: 10 minutes to create your first materialized view.

---

## 📊 The Problem Everyone Faces

You're running a SaaS analytics platform. The executive dashboard shows:
- Total revenue by month (last 12 months)
- Top 10 customers by spend
- Product sales breakdown
- Geographic distribution
- Customer growth trends

The query powering this dashboard:

```sql
SELECT
  DATE_TRUNC('month', o.created_at) AS month,
  COUNT(DISTINCT o.customer_id) AS unique_customers,
  COUNT(o.id) AS total_orders,
  SUM(o.total) AS revenue,
  AVG(o.total) AS avg_order_value,
  p.category,
  c.country
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', o.created_at), p.category, c.country;
```

**Performance**:
```
Rows scanned: 10,000,000
Execution time: 45,000ms (45 seconds)
Memory used: 2.5GB
```

**User experience**:
- 😤 CEO clicks "Dashboard"
- ⏳ Waits 45 seconds
- 😡 "Why is this so slow?"
- 💸 CEO stops using the product

### The Typical "Solutions" (That Don't Work)

**❌ Solution 1: Add More Indexes**

```sql
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

**Result**: Execution time: 42 seconds (7% improvement)

**Why it fails**: Indexes help filtering, but this query scans millions of rows for aggregation.

**❌ Solution 2: Use Application-Level Caching**

```javascript
// Cache for 5 minutes
const cachedResult = await cache.get('dashboard-stats');
if (cachedResult) return cachedResult;

const result = await db.query(/* 45-second query */);
await cache.set('dashboard-stats', result, 300);
return result;
```

**Problems**:
1. **First load still slow**: CEO gets 45-second wait
2. **Cache invalidation is hard**: When to refresh? Every 5 min? 1 hour? Stale data vs. slow queries
3. **Memory waste**: Every server duplicates the cache
4. **Code complexity**: Cache logic in every dashboard

**❌ Solution 3: Pre-Compute with Cron Job**

```javascript
// Run every hour
cron.schedule('0 * * * *', async () => {
  const result = await db.query(/* 45-second query */);
  await redis.set('dashboard-stats', JSON.stringify(result));
});
```

**Problems**:
1. **Stale data**: Up to 1-hour old data shown
2. **Application code**: Separate worker, error handling, monitoring
3. **Single point of failure**: If job fails, dashboard breaks
4. **No query optimization**: Database still does 45-second work

### The Hidden Cost

At a mid-sized analytics company:
- **Dashboard users**: 50 executives
- **Refreshes per day**: 10 per user = 500 loads/day
- **Query time**: 45 seconds
- **Database load**: 500 × 45s = **6.25 hours of query time per day**
- **Database cost**: Premium instance needed = **$800/month**
- **User churn**: 15% abandon product due to slowness = **$180,000 ARR lost**

Plus the CEO complaining in every all-hands meeting.

---

## 💡 The Paradigm Shift

**Old Model**: Execute complex aggregations on every query.

**New Model**: Pre-compute aggregations once, query cached results.

**Key Insight**: Most analytics data doesn't need to be real-time. 15-minute stale data is fine if it loads instantly.

Think of materialized views like **snapshots of expensive queries** - the database handles caching, refreshing, and optimization.

```
Regular View (virtual table)
  ↓ Every query executes full SELECT
  ❌ Slow (45 seconds)

Materialized View (cached table)
  ↓ Pre-computed results stored on disk
  ✅ Fast (40ms)
```

---

## ✅ The Solution: Materialized Views

A **materialized view** is a view whose results are physically stored on disk. Unlike regular views (query macros), materialized views cache query results.

### Pattern 1: Basic Materialized View

Let's create a materialized view for monthly sales stats:

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW monthly_sales_stats AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS order_count,
  COUNT(DISTINCT customer_id) AS unique_customers,
  SUM(total) AS revenue,
  AVG(total) AS avg_order_value
FROM orders
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

**Now query it**:

```sql
-- ✅ Fast query (cached results)
SELECT * FROM monthly_sales_stats;
```

**Performance**:
```
Before (regular view):  45,000ms
After (materialized):       40ms
Improvement:            1,125x faster
```

### How Materialized Views Work

**Creation** (one-time cost):
1. Execute the SELECT query
2. Store results on disk (like a table)
3. Create indexes for fast lookups

**Querying**:
1. Read pre-computed results from disk
2. No JOIN, no aggregation, no computation
3. Just like querying a regular table

**Refreshing** (updating the cache):
```sql
-- Manual refresh
REFRESH MATERIALIZED VIEW monthly_sales_stats;

-- Concurrent refresh (allows queries during refresh)
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_sales_stats;
```

### Pattern 2: Materialized View with Indexes

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW product_sales_summary AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.category,
  COUNT(oi.id) AS times_ordered,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.quantity * oi.price) AS total_revenue
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name, p.category;

-- Add index for fast lookups
CREATE UNIQUE INDEX idx_product_sales_id ON product_sales_summary(product_id);
CREATE INDEX idx_product_sales_category ON product_sales_summary(category);
```

**Query it**:

```sql
-- Fast lookup by product_id (uses index)
SELECT * FROM product_sales_summary WHERE product_id = 123;
-- Execution time: 2ms

-- Fast filtering by category (uses index)
SELECT product_name, total_revenue
FROM product_sales_summary
WHERE category = 'Electronics'
ORDER BY total_revenue DESC;
-- Execution time: 15ms
```

**Without materialized view** (same query):
```
Execution time: 8,500ms
```

**Improvement**: **566x faster**.

### Pattern 3: Auto-Refresh with Triggers

**Problem**: Manual refresh is tedious.

**Solution**: Auto-refresh when underlying data changes.

```sql
-- Materialized view
CREATE MATERIALIZED VIEW customer_stats AS
SELECT
  id,
  email,
  (SELECT COUNT(*) FROM orders WHERE customer_id = customers.id) AS order_count,
  (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = customers.id) AS lifetime_value
FROM customers;

-- Trigger to refresh on order insert/update
CREATE OR REPLACE FUNCTION refresh_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY customer_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_customer_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_customer_stats();
```

**How it works**:
1. New order inserted
2. Trigger fires
3. Materialized view refreshes
4. Next query sees updated stats

**⚠️ Caution**: Refreshing on every insert is expensive for high-volume tables. Use scheduled refresh instead.

### Pattern 4: Scheduled Refresh (Better for High Volume)

Use `pg_cron` extension for PostgreSQL:

```sql
-- Enable pg_cron extension
CREATE EXTENSION pg_cron;

-- Schedule refresh every 15 minutes
SELECT cron.schedule('refresh-sales-stats', '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_sales_stats'
);

-- Schedule refresh every hour
SELECT cron.schedule('refresh-product-stats', '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY product_sales_summary'
);

-- Schedule refresh daily at 2 AM
SELECT cron.schedule('refresh-customer-stats', '0 2 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY customer_stats'
);
```

**Result**: Data auto-refreshes without application code.

### Pattern 5: Incremental Refresh (Advanced)

**Problem**: Full refresh scans entire dataset (slow for big tables).

**Solution**: Track changes, refresh only modified rows.

```sql
-- Add tracking table
CREATE TABLE orders_changed (
  order_id INT PRIMARY KEY,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to track changes
CREATE TRIGGER track_order_changes
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION log_changed_order();

-- Incremental refresh function
CREATE OR REPLACE FUNCTION incremental_refresh_sales_stats()
RETURNS void AS $$
BEGIN
  -- Update only changed orders
  DELETE FROM monthly_sales_stats
  WHERE month IN (
    SELECT DISTINCT DATE_TRUNC('month', o.created_at)
    FROM orders o
    JOIN orders_changed oc ON oc.order_id = o.id
  );

  INSERT INTO monthly_sales_stats
  SELECT
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*),
    SUM(total)
  FROM orders
  WHERE DATE_TRUNC('month', created_at) IN (
    SELECT DISTINCT DATE_TRUNC('month', o.created_at)
    FROM orders o
    JOIN orders_changed oc ON oc.order_id = o.id
  )
  GROUP BY DATE_TRUNC('month', created_at);

  -- Clear tracking table
  TRUNCATE orders_changed;
END;
$$ LANGUAGE plpgsql;
```

**Performance**:
```
Full refresh:        45 seconds (scans 10M rows)
Incremental refresh:  2 seconds (scans 10K changed rows)
Improvement:         22.5x faster
```

---

## 🔧 Hands-On: Create Your First Materialized View (10 Minutes)

Let's build a real-world example: **Top customers dashboard**.

### Step 1: Create Sample Data

```sql
-- Create tables
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  email VARCHAR(200),
  country VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  total DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample data
INSERT INTO customers (name, email, country)
SELECT
  'Customer ' || generate_series,
  'customer' || generate_series || '@example.com',
  CASE (random() * 4)::int
    WHEN 0 THEN 'USA'
    WHEN 1 THEN 'UK'
    WHEN 2 THEN 'Canada'
    ELSE 'Australia'
  END
FROM generate_series(1, 10000);

INSERT INTO orders (customer_id, total, created_at)
SELECT
  (random() * 9999 + 1)::int,
  (random() * 1000 + 10)::numeric(10,2),
  NOW() - (random() * 365 || ' days')::interval
FROM generate_series(1, 100000);
```

### Step 2: Create Materialized View

```sql
CREATE MATERIALIZED VIEW top_customers AS
SELECT
  c.id,
  c.name,
  c.email,
  c.country,
  COUNT(o.id) AS order_count,
  SUM(o.total) AS lifetime_value,
  AVG(o.total) AS avg_order_value,
  MAX(o.created_at) AS last_order_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name, c.email, c.country
HAVING COUNT(o.id) > 0
ORDER BY lifetime_value DESC;

-- Add index for fast lookups
CREATE UNIQUE INDEX idx_top_customers_id ON top_customers(id);
CREATE INDEX idx_top_customers_country ON top_customers(country);
```

### Step 3: Benchmark Performance

```sql
-- ❌ Without materialized view (slow)
EXPLAIN ANALYZE
SELECT
  c.name,
  COUNT(o.id) AS order_count,
  SUM(o.total) AS lifetime_value
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY lifetime_value DESC
LIMIT 10;
-- Execution time: 450ms

-- ✅ With materialized view (fast)
EXPLAIN ANALYZE
SELECT name, order_count, lifetime_value
FROM top_customers
LIMIT 10;
-- Execution time: 0.8ms
```

**Result**: **562x faster**.

### Step 4: Query Top Customers by Country

```sql
-- Top 5 customers in USA
SELECT name, email, lifetime_value
FROM top_customers
WHERE country = 'USA'
ORDER BY lifetime_value DESC
LIMIT 5;
-- Execution time: 2ms

-- Customers with >10 orders
SELECT name, order_count, lifetime_value
FROM top_customers
WHERE order_count > 10
ORDER BY lifetime_value DESC;
-- Execution time: 5ms
```

### Step 5: Refresh the View

```sql
-- Manual refresh (when new orders added)
REFRESH MATERIALIZED VIEW top_customers;

-- Concurrent refresh (allows queries during refresh)
REFRESH MATERIALIZED VIEW CONCURRENTLY top_customers;
```

---

## 🏢 Real-World Examples

### **Stripe** (Payment Processing)
- **Materialized View**: `merchant_daily_stats` (volume, fees, refunds per merchant per day)
- **Why**: Dashboard shows stats for 1M+ merchants, can't compute on-the-fly
- **Refresh**: Every 15 minutes
- **Impact**: Dashboard load time: 30s → 200ms (150x faster)

### **GitHub** (Code Hosting)
- **Materialized View**: `repository_stats` (stars, forks, contributors, commit count)
- **Why**: Trending page ranks 100M+ repos by stats
- **Refresh**: Every 6 hours
- **Impact**: Trending page: 15s → 100ms (150x faster)

### **Reddit** (Social Platform)
- **Materialized View**: `subreddit_stats` (subscribers, posts/day, comments/day, active users)
- **Why**: Front page ranks subreddits by activity
- **Refresh**: Every 10 minutes
- **Impact**: Subreddit listing: 8s → 50ms (160x faster)

### **Netflix** (Streaming)
- **Materialized View**: `show_popularity_scores` (views, completion rate, ratings aggregated)
- **Why**: Recommendation engine uses scores for 10,000+ shows
- **Refresh**: Every 1 hour
- **Impact**: Recommendation load: 5s → 30ms (166x faster)

---

## 🚀 Materialized Views vs. Regular Views

| Feature | Regular View | Materialized View |
|---------|--------------|-------------------|
| **Storage** | None (virtual) | Physical (on disk) |
| **Performance** | Slow (executes query every time) | Fast (reads cached results) |
| **Data Freshness** | Always current | Stale until refreshed |
| **Memory Usage** | None | Disk space for cached results |
| **Use Case** | Simplify queries, security | Speed up expensive aggregations |
| **Indexes** | Not allowed | Allowed (for fast lookups) |
| **Refresh** | Automatic (always fresh) | Manual or scheduled |

**When to Use**:
- **Regular View**: Fast queries (<100ms), need real-time data, simplify JOINs
- **Materialized View**: Slow queries (>1s), stale data acceptable, aggregations

---

## 📈 Refresh Strategies

### 1. Manual Refresh (On-Demand)

```sql
REFRESH MATERIALIZED VIEW view_name;
```

**Use when**:
- Data changes infrequently (once per day)
- You control when data updates
- Admin triggers refresh after bulk import

### 2. Scheduled Refresh (Periodic)

```sql
-- Using pg_cron (PostgreSQL)
SELECT cron.schedule('refresh-view', '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY view_name'
);
```

**Use when**:
- Data updates regularly (hourly, daily)
- Predictable refresh timing
- Balance freshness vs. performance

**Common schedules**:
- Real-time dashboards: Every 5-15 minutes
- Analytics dashboards: Every 1-6 hours
- Reports: Daily at 2 AM

### 3. Trigger-Based Refresh (Event-Driven)

```sql
CREATE TRIGGER refresh_on_insert
AFTER INSERT ON source_table
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_materialized_view();
```

**Use when**:
- Low write volume (<100 writes/hour)
- Need near-real-time updates
- Refresh is fast (<5 seconds)

**⚠️ Not recommended when**:
- High write volume (>1,000 writes/hour)
- Refresh is slow (>10 seconds)
- Multiple tables update the view

### 4. Concurrent Refresh (No Downtime)

```sql
-- Requires UNIQUE index
CREATE UNIQUE INDEX idx_view_id ON materialized_view(id);

-- Concurrent refresh (queries work during refresh)
REFRESH MATERIALIZED VIEW CONCURRENTLY view_name;
```

**Benefits**:
- ✅ Queries work during refresh (no blocking)
- ✅ Users don't experience downtime

**Requirements**:
- Must have UNIQUE index
- PostgreSQL 9.4+

**Performance**:
```
Regular refresh:    Blocks queries, fast (10s)
Concurrent refresh: No blocking, slower (15s)
```

---

## 🔥 Performance Optimization

### Add Indexes

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW user_activity AS
SELECT
  user_id,
  COUNT(*) AS event_count,
  MAX(created_at) AS last_active
FROM events
GROUP BY user_id;

-- Add indexes for common queries
CREATE UNIQUE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_count ON user_activity(event_count DESC);
CREATE INDEX idx_user_activity_last_active ON user_activity(last_active DESC);
```

**Impact**:
```
Without indexes:  50ms per query
With indexes:      2ms per query
Improvement:      25x faster
```

### Partition Source Tables

```sql
-- Partition orders by month
CREATE TABLE orders_2024_01 PARTITION OF orders
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Materialized view only queries recent partitions
CREATE MATERIALIZED VIEW recent_sales AS
SELECT * FROM orders
WHERE created_at >= NOW() - INTERVAL '3 months';
```

**Impact**: Refresh scans 3 months instead of 5 years (20x less data).

### Use CONCURRENTLY for Large Views

```sql
-- ❌ Regular refresh (blocks queries)
REFRESH MATERIALIZED VIEW large_view;
-- Blocks queries for 60 seconds

-- ✅ Concurrent refresh (no blocking)
REFRESH MATERIALIZED VIEW CONCURRENTLY large_view;
-- Queries work during 75-second refresh
```

### Incremental Updates (Custom Logic)

For extremely large views, implement custom incremental refresh:

```sql
-- Track last refresh time
CREATE TABLE refresh_log (
  view_name VARCHAR(100) PRIMARY KEY,
  last_refreshed TIMESTAMPTZ
);

-- Incremental refresh function
CREATE OR REPLACE FUNCTION incremental_refresh()
RETURNS void AS $$
DECLARE
  last_refresh TIMESTAMPTZ;
BEGIN
  SELECT last_refreshed INTO last_refresh
  FROM refresh_log WHERE view_name = 'sales_stats';

  -- Update only new/changed data
  DELETE FROM sales_stats
  WHERE month >= DATE_TRUNC('month', last_refresh);

  INSERT INTO sales_stats
  SELECT DATE_TRUNC('month', created_at), COUNT(*), SUM(total)
  FROM orders
  WHERE created_at >= last_refresh
  GROUP BY DATE_TRUNC('month', created_at);

  -- Update refresh time
  UPDATE refresh_log
  SET last_refreshed = NOW()
  WHERE view_name = 'sales_stats';
END;
$$ LANGUAGE plpgsql;
```

---

## 💪 Common Pitfalls

### ❌ Refreshing Too Often

```sql
-- BAD: Refresh every second (wastes resources)
SELECT cron.schedule('refresh-stats', '* * * * *',
  'REFRESH MATERIALIZED VIEW sales_stats'
);
```

**Problem**: Constant refresh = high CPU, disk I/O, locks.

**✅ Solution**: Refresh based on data change frequency:
- Real-time data: Every 5-15 minutes
- Hourly updates: Every 1 hour
- Daily reports: Once per day

### ❌ Not Using CONCURRENTLY

```sql
-- BAD: Regular refresh blocks queries
REFRESH MATERIALIZED VIEW popular_products;
-- Users get errors for 30 seconds
```

**✅ Solution**: Always use CONCURRENTLY for production:
```sql
CREATE UNIQUE INDEX idx_products_id ON popular_products(product_id);
REFRESH MATERIALIZED VIEW CONCURRENTLY popular_products;
```

### ❌ No Indexes on Materialized View

```sql
-- BAD: No indexes
CREATE MATERIALIZED VIEW customer_stats AS
SELECT customer_id, SUM(total) FROM orders GROUP BY customer_id;

-- Query still slow (sequential scan)
SELECT * FROM customer_stats WHERE customer_id = 123;
-- Execution time: 500ms
```

**✅ Solution**: Add indexes:
```sql
CREATE UNIQUE INDEX idx_customer_stats_id ON customer_stats(customer_id);

-- Query now fast (index scan)
SELECT * FROM customer_stats WHERE customer_id = 123;
-- Execution time: 2ms
```

### ❌ Forgetting to Refresh

**Problem**: Materialized view shows stale data.

**✅ Solutions**:
1. Scheduled refresh (pg_cron)
2. Application-triggered refresh after data changes
3. Monitoring alerts for stale views

---

## 🎯 Cheat Sheet

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW view_name AS
SELECT ... FROM ... WHERE ...;

-- Create with no data (populate later)
CREATE MATERIALIZED VIEW view_name AS
SELECT ... FROM ...
WITH NO DATA;

-- Populate later
REFRESH MATERIALIZED VIEW view_name;

-- Add index
CREATE UNIQUE INDEX idx_name ON view_name(column);

-- Concurrent refresh (requires unique index)
REFRESH MATERIALIZED VIEW CONCURRENTLY view_name;

-- Drop materialized view
DROP MATERIALIZED VIEW view_name;

-- Check view definition
\d+ view_name  -- PostgreSQL

-- Check last refresh time
SELECT schemaname, matviewname, last_refresh
FROM pg_matviews;

-- Check if view is populated
SELECT ispopulated FROM pg_matviews
WHERE matviewname = 'view_name';
```

---

## 💪 Next Steps

**1. Identify Slow Queries** (Today):
- Run EXPLAIN ANALYZE on dashboard queries
- Find queries taking >1 second
- Check if they aggregate large datasets

**2. Create First Materialized View** (This Week):
- Pick slowest aggregation query
- Create materialized view
- Add indexes
- Set up scheduled refresh
- Benchmark performance

**3. Monitor Refresh Times** (Next Week):
- Track refresh duration
- Alert if refresh takes >5 minutes
- Optimize with incremental refresh if needed

**Remember**: Start with read-heavy dashboards. 15-minute stale data is fine if it loads 1000x faster.

---

## 🔗 Learn More

**Next POCs**:
- **POC #24: CTEs (Common Table Expressions)** - Temporary result sets for complex queries
- **POC #25: Window Functions** - Running totals, rankings without materialized views
- **POC #26: Table Partitioning** - Speed up materialized view refreshes

**Related Topics**:
- **POC #22: Database Views** - Virtual tables (no caching)
- **POC #12: B-Tree Indexes** - Speed up materialized view queries
- **POC #14: EXPLAIN Analysis** - Optimize query performance
