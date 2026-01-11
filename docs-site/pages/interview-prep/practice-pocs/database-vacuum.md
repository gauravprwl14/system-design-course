# VACUUM & Database Maintenance - Stop Query Slowdown & Bloat

**The Problem**: Your database is 3x larger than it should be, queries are getting slower every week, and you don't know why.

**The Solution**: Regular VACUUM removes dead rows and reclaims disk space - keeping your database healthy and fast.

**Time to Implement**: 5 minutes to run your first VACUUM.

---

## 📊 The Problem Everyone Faces

You deployed your SaaS app 6 months ago. Everything was fast. Now queries are slowing down mysteriously.

**6 months ago**:
```sql
SELECT * FROM orders WHERE customer_id = 123;
-- Execution time: 5ms
-- Database size: 2GB
```

**Today**:
```sql
SELECT * FROM orders WHERE customer_id = 123;
-- Execution time: 85ms  (17x slower!)
-- Database size: 8GB   (4x larger!)
```

**But you only have 2GB of actual data.**

Where did the extra 6GB come from?

### The Hidden Problem: Dead Rows

PostgreSQL uses **MVCC (Multi-Version Concurrency Control)**:
- UPDATE doesn't modify rows in-place
- Instead, it marks old row as "dead" and creates new row
- DELETE marks row as "dead" but doesn't remove it

**Example**:

```sql
-- Initial insert
INSERT INTO products (id, name, price) VALUES (1, 'Laptop', 1000.00);
-- Physical storage: 1 row

-- Update price 5 times
UPDATE products SET price = 950.00 WHERE id = 1;
UPDATE products SET price = 900.00 WHERE id = 1;
UPDATE products SET price = 850.00 WHERE id = 1;
UPDATE products SET price = 800.00 WHERE id = 1;
UPDATE products SET price = 750.00 WHERE id = 1;
-- Physical storage: 6 rows (1 live + 5 dead)

-- But SELECT only sees 1 row
SELECT * FROM products WHERE id = 1;
```

**Physical storage**:
```
Row 1: id=1, price=1000.00  [DEAD - created at txn 100, deleted at txn 101]
Row 2: id=1, price=950.00   [DEAD - created at txn 101, deleted at txn 102]
Row 3: id=1, price=900.00   [DEAD - created at txn 102, deleted at txn 103]
Row 4: id=1, price=850.00   [DEAD - created at txn 103, deleted at txn 104]
Row 5: id=1, price=800.00   [DEAD - created at txn 104, deleted at txn 105]
Row 6: id=1, price=750.00   [LIVE - created at txn 105]
```

**Result**: 1 logical row, 6 physical rows. **5 wasted rows**.

### Real-World Scenario

E-commerce site with 1M products:
- **Initial load**: 1M rows inserted
- **Daily updates**: 100K products updated (price changes, stock updates)
- **After 30 days**: 1M live rows + 3M dead rows = **4M total rows**
- **Database size**: 8GB (should be 2GB)

**Impact**:
```
Query performance:  5ms → 85ms (17x slower)
Sequential scans:   Scan 4M rows instead of 1M
Index bloat:        Index size grows 4x
Disk I/O:           4x more reads
Database cost:      $500/month → $2,000/month (need larger instance)
```

### The Hidden Cost

At a mid-sized SaaS company:
- **Database bloat**: 3x actual size (10GB live + 20GB dead)
- **Slow queries**: 10x slower after 6 months
- **Database cost**: $2,000/month premium instance (would be $500/month without bloat)
- **Customer complaints**: "Dashboard is slow"
- **Emergency maintenance**: 8 hours/quarter to clean up bloat

**Annual cost**: **$18,000 in unnecessary database costs** + **$12,000 in maintenance time** = **$30,000**.

Plus downtime during emergency cleanups.

---

## 💡 The Paradigm Shift

**Old Model**: Database automatically cleans itself.

**New Model**: Database needs periodic maintenance (VACUUM) to remove dead rows.

**Key Insight**: PostgreSQL marks rows as deleted but doesn't physically remove them - you must run VACUUM to reclaim space.

Think of VACUUM like **garbage collection in programming** - memory isn't freed until GC runs.

```
Without VACUUM:
  Dead rows accumulate
  Database bloats
  Queries scan dead rows (slow)

With VACUUM:
  Dead rows removed
  Disk space reclaimed
  Queries fast
```

---

## ✅ The Solution: VACUUM

**VACUUM** removes dead rows and updates statistics to optimize queries.

### Pattern 1: Manual VACUUM

```sql
-- VACUUM a specific table
VACUUM products;

-- VACUUM entire database
VACUUM;

-- VACUUM with verbose output (shows progress)
VACUUM VERBOSE products;
```

**What VACUUM does**:
1. Scans table for dead rows
2. Marks dead row space as reusable
3. Updates table statistics
4. **Does NOT shrink table file** (just marks space reusable)

**Example**:

```sql
-- Check table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows
FROM pg_stat_user_tables
WHERE tablename = 'products';
```

**Before VACUUM**:
```
tablename | size  | live_rows | dead_rows
----------|-------|-----------|----------
products  | 800MB | 1,000,000 | 3,000,000  ← 75% dead rows!
```

**Run VACUUM**:
```sql
VACUUM VERBOSE products;
```

**Output**:
```
INFO: vacuuming "public.products"
INFO: "products": removed 3000000 dead row versions in 50000 pages
INFO: "products": found 3000000 removable, 1000000 nonremovable row versions
INFO: "products": truncated 50000 to 12500 pages
DETAIL: CPU: user: 2.50 s, system: 1.20 s, elapsed: 5.30 s
```

**After VACUUM**:
```
tablename | size  | live_rows | dead_rows
----------|-------|-----------|----------
products  | 200MB | 1,000,000 | 0  ← Dead rows removed!
```

**Query performance**:
```
Before VACUUM:  85ms
After VACUUM:   5ms
Improvement:    17x faster
```

### Pattern 2: VACUUM FULL (Reclaim Disk Space)

**Problem**: Regular VACUUM marks space as reusable but doesn't return disk space to OS.

**Solution**: `VACUUM FULL` rewrites entire table, reclaiming disk space.

```sql
VACUUM FULL products;
```

**What VACUUM FULL does**:
1. Creates new table file
2. Copies only live rows to new file
3. Deletes old file
4. Rebuilds indexes
5. **Returns disk space to OS**

**⚠️ Warning**: `VACUUM FULL` locks table (no reads/writes during VACUUM).

**Before VACUUM FULL**:
```
Database size: 10GB (3GB live + 7GB dead)
Disk usage:    10GB
```

**Run VACUUM FULL**:
```sql
VACUUM FULL;
```

**After VACUUM FULL**:
```
Database size: 3GB
Disk usage:    3GB  ← 7GB reclaimed!
```

**Downside**: Table locked for duration (10-30 minutes for large tables).

**Alternative**: `pg_repack` (online VACUUM FULL, no table lock).

### Pattern 3: VACUUM ANALYZE (Update Statistics)

**Problem**: Query planner uses outdated statistics, chooses slow query plans.

**Solution**: `VACUUM ANALYZE` removes dead rows AND updates statistics.

```sql
-- VACUUM + update statistics
VACUUM ANALYZE products;

-- Or separately
VACUUM products;
ANALYZE products;
```

**What ANALYZE does**:
1. Samples table data
2. Updates column statistics (min, max, common values, histogram)
3. Query planner uses statistics to choose optimal indexes

**Example**:

```sql
-- Before ANALYZE (outdated statistics)
EXPLAIN ANALYZE SELECT * FROM products WHERE category = 'Electronics';
-- Seq Scan on products (cost=0.00..5000.00 rows=500000 width=100)
-- Actual rows: 10,000
-- Query planner thinks 500K rows, actually 10K (50x overestimate!)
```

**Run VACUUM ANALYZE**:
```sql
VACUUM ANALYZE products;
```

**After ANALYZE** (updated statistics):
```sql
EXPLAIN ANALYZE SELECT * FROM products WHERE category = 'Electronics';
-- Index Scan on products (cost=0.00..250.00 rows=10000 width=100)
-- Actual rows: 10,000
-- Query planner correctly estimates 10K rows, uses index!
```

**Query performance**:
```
Before ANALYZE:  500ms (sequential scan)
After ANALYZE:    15ms (index scan)
Improvement:     33x faster
```

### Pattern 4: Autovacuum (Automatic Maintenance)

**PostgreSQL has autovacuum** - runs VACUUM automatically in the background.

**Check autovacuum status**:
```sql
SHOW autovacuum;
-- Result: on

-- Check autovacuum settings
SELECT name, setting FROM pg_settings
WHERE name LIKE 'autovacuum%';
```

**Default settings**:
```
autovacuum = on
autovacuum_vacuum_threshold = 50        -- Min dead rows before vacuum
autovacuum_vacuum_scale_factor = 0.2    -- VACUUM when 20% of rows are dead
autovacuum_naptime = 60s                -- Check tables every 60 seconds
```

**When autovacuum runs**:
```
Trigger: dead_rows > (vacuum_threshold + vacuum_scale_factor * total_rows)

Example (1M row table):
  VACUUM when: dead_rows > (50 + 0.2 * 1,000,000) = 200,050 dead rows
```

**Check last autovacuum**:
```sql
SELECT
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  n_dead_tup AS dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;
```

**Result**:
```
relname  | last_vacuum         | last_autovacuum     | dead_rows
---------|---------------------|---------------------|----------
products | 2024-06-01 10:00:00 | 2024-06-15 14:30:00 | 50,000
orders   | NULL                | 2024-06-15 14:25:00 | 120,000
users    | NULL                | 2024-06-15 13:00:00 | 5,000
```

**Tune autovacuum per table**:
```sql
-- VACUUM more aggressively for high-churn table
ALTER TABLE products SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- VACUUM when 5% dead (instead of 20%)
  autovacuum_vacuum_threshold = 1000      -- VACUUM after 1,000 dead rows
);

-- Disable autovacuum for specific table (rarely needed)
ALTER TABLE logs SET (autovacuum_enabled = false);
```

---

## 🔧 Hands-On: VACUUM Your Database (10 Minutes)

### Step 1: Check Table Bloat

```sql
-- Find tables with most dead rows
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS table_size
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 10;
```

**Example output**:
```
table_name | live_rows | dead_rows | dead_pct | table_size
-----------|-----------|-----------|----------|------------
products   | 1,000,000 | 3,000,000 | 75.00%   | 800MB
orders     | 5,000,000 | 1,500,000 | 23.08%   | 1.2GB
users      | 500,000   | 50,000    | 9.09%    | 120MB
```

### Step 2: VACUUM High-Bloat Tables

```sql
-- VACUUM table with verbose output
VACUUM VERBOSE products;

-- VACUUM and update statistics
VACUUM ANALYZE orders;

-- VACUUM entire database
VACUUM VERBOSE ANALYZE;
```

### Step 3: Check Index Bloat

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) AS index_size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC
LIMIT 10;
```

**VACUUM doesn't fix index bloat**. Reindex instead:
```sql
REINDEX TABLE products;

-- Or reindex specific index
REINDEX INDEX idx_products_category;

-- Reindex entire database (slow, locks tables)
REINDEX DATABASE mydb;

-- PostgreSQL 12+: REINDEX CONCURRENTLY (no locks)
REINDEX TABLE CONCURRENTLY products;
```

### Step 4: Monitor Autovacuum Activity

```sql
-- Check if autovacuum is running
SELECT
  pid,
  datname,
  usename,
  query,
  query_start,
  state
FROM pg_stat_activity
WHERE query LIKE '%autovacuum%'
  AND query NOT LIKE '%pg_stat_activity%';
```

---

## 🏢 Real-World Examples

### **Instagram** (Social Media)
- **Challenge**: 100M+ posts/day, constant updates (likes, comments)
- **Solution**: Aggressive autovacuum settings (every 10 seconds)
- **Impact**: Database bloat < 10%, query performance stable

### **Stripe** (Payment Processing)
- **Challenge**: High-volume transactions, frequent updates
- **Solution**: Scheduled VACUUM during low-traffic hours (3 AM)
- **Impact**: Reduced database size by 60%, reclaimed 300GB

### **GitHub** (Code Hosting)
- **Challenge**: Commits, issues, PRs constantly updated
- **Solution**: Per-table autovacuum tuning (aggressive for high-churn tables)
- **Impact**: 95% of tables stay < 5% bloated

### **Reddit** (Social Platform)
- **Challenge**: Vote counts updated millions of times/day
- **Solution**: Partitioned tables + per-partition VACUUM
- **Impact**: Queries 10x faster after cleanup

---

## 🚀 VACUUM Best Practices

### ✅ When to VACUUM

**Run VACUUM when**:
1. **After bulk operations** (millions of INSERT/UPDATE/DELETE)
2. **Table >20% dead rows** (check with pg_stat_user_tables)
3. **Queries suddenly slow** (outdated statistics)
4. **Disk space running low** (run VACUUM FULL to reclaim space)

### ❌ When NOT to VACUUM FULL

**Don't run VACUUM FULL on**:
1. **Production during business hours** (locks table)
2. **Tables >100GB** (takes hours, locks table entire time)
3. **Tables with heavy write traffic** (blocks writes)

**Alternative**: Use `pg_repack` for online table rewrites.

### Optimal Autovacuum Settings

**For high-churn tables** (orders, events, logs):
```sql
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- VACUUM at 5% dead
  autovacuum_analyze_scale_factor = 0.02, -- ANALYZE at 2% changed
  autovacuum_vacuum_cost_delay = 10,      -- Reduce I/O impact
  autovacuum_vacuum_cost_limit = 2000     -- Process more rows per round
);
```

**For low-churn tables** (users, products):
```sql
-- Use default settings (20% dead rows before VACUUM)
```

### Monitor Bloat Regularly

```sql
-- Add to monitoring dashboard
SELECT
  SUM(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
  SUM(pg_total_relation_size(schemaname||'.'||relname)) FILTER (WHERE n_dead_tup > n_live_tup * 0.2) AS bloated_size,
  ROUND(100.0 * SUM(pg_total_relation_size(schemaname||'.'||relname)) FILTER (WHERE n_dead_tup > n_live_tup * 0.2) / NULLIF(SUM(pg_total_relation_size(schemaname||'.'||relname)), 0), 2) AS bloat_pct
FROM pg_stat_user_tables;
```

**Alert when**: bloat_pct > 30%

---

## 📈 VACUUM Performance

**VACUUM is I/O intensive**. Control impact:

```sql
-- Reduce VACUUM I/O impact (slow but gentle)
SET vacuum_cost_delay = 20;          -- Pause 20ms between I/O operations
SET vacuum_cost_limit = 200;         -- Process fewer pages per round

-- Aggressive VACUUM (fast but I/O heavy)
SET vacuum_cost_delay = 0;           -- No pauses
SET vacuum_cost_limit = 10000;       -- Process many pages per round
```

**Benchmark** (1GB table with 50% bloat):
```
Gentle VACUUM:     5 minutes (low I/O impact)
Aggressive VACUUM: 30 seconds (high I/O impact)
VACUUM FULL:       10 minutes (locks table, highest I/O)
```

---

## 🎯 VACUUM Cheat Sheet

```sql
-- Basic VACUUM
VACUUM table_name;

-- VACUUM entire database
VACUUM;

-- VACUUM with verbose output
VACUUM VERBOSE table_name;

-- VACUUM and update statistics
VACUUM ANALYZE table_name;

-- VACUUM FULL (reclaim disk space, locks table)
VACUUM FULL table_name;

-- Check table bloat
SELECT schemaname, relname, n_live_tup, n_dead_tup,
       ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC;

-- Check last autovacuum
SELECT relname, last_vacuum, last_autovacuum, n_dead_tup
FROM pg_stat_user_tables
ORDER BY last_autovacuum DESC NULLS LAST;

-- Tune autovacuum for table
ALTER TABLE table_name SET (
  autovacuum_vacuum_scale_factor = 0.05
);

-- Disable autovacuum for table
ALTER TABLE table_name SET (autovacuum_enabled = false);

-- Reindex (fix index bloat)
REINDEX TABLE table_name;

-- Reindex concurrently (PostgreSQL 12+, no locks)
REINDEX TABLE CONCURRENTLY table_name;
```

---

## 💪 Common Pitfalls

### ❌ Disabling Autovacuum

**Never disable autovacuum globally**:
```sql
-- ❌ BAD
ALTER SYSTEM SET autovacuum = off;
```

**Result**: Database bloats uncontrollably, queries become unusable.

**✅ Solution**: Tune autovacuum, don't disable it.

### ❌ Running VACUUM FULL During Peak Hours

```sql
-- ❌ BAD: Locks table during peak traffic
VACUUM FULL orders;  -- at 2 PM
```

**Result**: All queries to `orders` blocked, site down.

**✅ Solution**: Run VACUUM FULL during maintenance window (3 AM).

### ❌ Ignoring Index Bloat

**VACUUM doesn't fix index bloat**. Must REINDEX:
```sql
-- Check index size
SELECT pg_size_pretty(pg_relation_size('idx_orders_customer'));
-- Before: 500MB
-- Expected (if not bloated): 150MB

-- Fix with REINDEX
REINDEX INDEX CONCURRENTLY idx_orders_customer;

-- After: 150MB
```

---

## 💪 Next Steps

**1. Audit Table Bloat** (Today):
- Check dead row percentage for all tables
- Identify tables with >20% bloat
- Check when autovacuum last ran

**2. VACUUM High-Bloat Tables** (This Week):
- Run `VACUUM ANALYZE` on tables with >20% bloat
- Monitor query performance before/after
- Set up bloat monitoring alerts

**3. Tune Autovacuum** (Ongoing):
- Adjust autovacuum settings for high-churn tables
- Schedule VACUUM during low-traffic windows
- Monitor autovacuum activity logs

**Remember**: VACUUM is essential maintenance. Don't skip it.

---

## 🔗 Learn More

**Next POCs**:
- **POC #26: Table Partitioning** - VACUUM partitioned tables
- **POC #12: B-Tree Indexes** - Index bloat and REINDEX
- **POC #16: Transactions** - MVCC and dead rows

**Related Topics**:
- **POC #14: EXPLAIN Analysis** - Verify VACUUM improved query plans
- **POC #15: Connection Pooling** - Autovacuum contention with connections
- **POC #23: Materialized Views** - VACUUM materialized views
