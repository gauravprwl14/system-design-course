# Table Partitioning - Make 100M Row Queries 50x Faster

**The Problem**: Your queries are scanning 100M rows when they only need 2M - killing performance.

**The Solution**: Table partitioning splits large tables into smaller chunks - queries scan only relevant partitions.

**Time to Implement**: 15 minutes to partition your first table.

---

## 📊 The Problem Everyone Faces

You're running an analytics platform. Users query the `events` table to analyze their data:

```sql
SELECT
  user_id,
  COUNT(*) AS event_count
FROM events
WHERE event_date >= '2024-06-01' AND event_date < '2024-07-01'
GROUP BY user_id;
```

**The table**:
```
events table: 100,000,000 rows (5 years of data)
Rows for June 2024: 2,000,000 rows (2% of table)
```

**What actually happens**:
```
Seq Scan on events (100M rows scanned)
Filter: event_date >= '2024-06-01' AND event_date < '2024-07-01'
Rows removed by filter: 98M
Execution time: 45,000ms (45 seconds)
```

**The database scans ALL 100M rows** to find 2M matching rows.

### Why Indexes Don't Fully Solve This

**You add an index**:
```sql
CREATE INDEX idx_events_date ON events(event_date);
```

**Query now uses index**:
```sql
Index Scan using idx_events_date on events (2M rows)
Execution time: 8,500ms (8.5 seconds)
```

**Better, but still slow**. Why?
- Index lookup: 2M row locations to find
- Random I/O: Read 2M rows scattered across disk
- Table bloat: Dead rows from 5 years of updates/deletes

**User experience**:
- 😤 "Why does my monthly report take 8 seconds?"
- 💸 Premium database instance ($2,000/month) just to handle the I/O

### The Hidden Cost

At a mid-sized SaaS analytics platform:
- **Events table**: 100M rows (20GB)
- **Queries per day**: 5,000 queries
- **Average query time**: 8 seconds
- **Database I/O**: Constant 90%+ utilization
- **Database instance**: db.r5.4xlarge ($2,000/month)
- **User complaints**: "Dashboard is too slow"
- **Churn rate**: 12% cite performance issues

**Annual cost**: **$24,000** in database costs + **$120,000 ARR lost to churn** = **$144,000**.

---

## 💡 The Paradigm Shift

**Old Model**: One giant table, database filters rows after scanning.

**New Model**: Table split into smaller partitions, database scans only relevant partitions.

**Key Insight**: Partition pruning eliminates entire partitions from the query plan - **never even touching irrelevant data**.

Think of partitioning like **organizing files into folders by year** instead of dumping everything into one folder.

```
Without Partitioning:
Query scans entire table (100M rows)
  ↓ Filter
  2M rows returned

With Partitioning:
Query identifies partition (2M rows)
  ↓ Scan only 1 partition
  2M rows returned
```

---

## ✅ The Solution: Table Partitioning

**Table partitioning** splits a large table into smaller physical tables (partitions) based on a partition key.

### Pattern 1: Range Partitioning by Date

Most common use case: **Time-series data** (events, logs, orders).

**Setup** (PostgreSQL 10+):

```sql
-- Create partitioned table
CREATE TABLE events (
  id BIGSERIAL,
  user_id INT,
  event_type VARCHAR(50),
  event_data JSONB,
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (event_date);

-- Create partitions for each month
CREATE TABLE events_2024_01 PARTITION OF events
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE events_2024_03 PARTITION OF events
FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE events_2024_04 PARTITION OF events
FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE events_2024_05 PARTITION OF events
FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE events_2024_06 PARTITION OF events
FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

-- ... create more partitions as needed
```

**How it works**:
1. You insert into the parent table `events`
2. PostgreSQL routes the row to the correct partition based on `event_date`
3. Queries with date filters scan only matching partitions

**Insert data**:
```sql
-- Insert automatically goes to events_2024_06
INSERT INTO events (user_id, event_type, event_date)
VALUES (123, 'page_view', '2024-06-15');

-- Check which partition it's in
SELECT tableoid::regclass, *
FROM events
WHERE user_id = 123;
-- tableoid: events_2024_06
```

**Query with partition pruning**:
```sql
EXPLAIN SELECT * FROM events
WHERE event_date >= '2024-06-01' AND event_date < '2024-07-01';
```

**Execution plan**:
```
Seq Scan on events_2024_06 (2M rows)
  Filter: event_date >= '2024-06-01' AND event_date < '2024-07-01'
Execution time: 850ms

Partitions pruned: events_2024_01, events_2024_02, ..., events_2024_05 (NOT scanned)
```

**Performance**:
```
Before partitioning:  8,500ms (scans 100M rows)
After partitioning:     850ms (scans 2M rows)
Improvement:           10x faster
```

### Pattern 2: Automatic Partition Creation

**Problem**: Manually creating partitions every month is tedious.

**Solution**: Use `pg_partman` extension for automatic partition management.

```sql
-- Install pg_partman
CREATE EXTENSION pg_partman;

-- Create parent table
CREATE TABLE events (
  id BIGSERIAL,
  user_id INT,
  event_date DATE NOT NULL,
  event_data JSONB
) PARTITION BY RANGE (event_date);

-- Configure automatic partitioning
SELECT partman.create_parent(
  p_parent_table := 'public.events',
  p_control := 'event_date',
  p_type := 'native',
  p_interval := '1 month',
  p_premake := 3  -- Create 3 future partitions
);

-- Schedule automatic maintenance (creates future partitions, drops old ones)
SELECT cron.schedule('partition-maintenance', '0 3 * * *',
  'CALL partman.run_maintenance_proc()'
);
```

**Result**: Partitions auto-created 3 months in advance, old partitions auto-dropped.

### Pattern 3: List Partitioning (Categorical Data)

**Use case**: Partition by country, status, or other discrete values.

```sql
-- Partition by region
CREATE TABLE orders (
  id SERIAL,
  customer_id INT,
  total DECIMAL(10, 2),
  region VARCHAR(20) NOT NULL
) PARTITION BY LIST (region);

-- Create partitions per region
CREATE TABLE orders_us PARTITION OF orders
FOR VALUES IN ('US');

CREATE TABLE orders_eu PARTITION OF orders
FOR VALUES IN ('EU', 'UK', 'DE', 'FR');

CREATE TABLE orders_asia PARTITION OF orders
FOR VALUES IN ('IN', 'CN', 'JP', 'SG');

CREATE TABLE orders_other PARTITION OF orders
DEFAULT;  -- Catch-all for unlisted values
```

**Query with partition pruning**:
```sql
SELECT * FROM orders WHERE region = 'US';
-- Scans only orders_us partition
```

**Use cases**:
- Multi-tenant SaaS (partition by tenant_id)
- Global apps (partition by country/region)
- Status-based workflows (partition by order_status)

### Pattern 4: Hash Partitioning (Even Distribution)

**Use case**: Distribute data evenly across partitions (no natural range/list).

```sql
-- Partition by user_id hash
CREATE TABLE user_events (
  id BIGSERIAL,
  user_id INT NOT NULL,
  event_type VARCHAR(50),
  created_at TIMESTAMPTZ
) PARTITION BY HASH (user_id);

-- Create 8 partitions (powers of 2 recommended)
CREATE TABLE user_events_p0 PARTITION OF user_events
FOR VALUES WITH (MODULUS 8, REMAINDER 0);

CREATE TABLE user_events_p1 PARTITION OF user_events
FOR VALUES WITH (MODULUS 8, REMAINDER 1);

CREATE TABLE user_events_p2 PARTITION OF user_events
FOR VALUES WITH (MODULUS 8, REMAINDER 2);

-- ... create p3-p7
```

**How it works**:
- `HASH(user_id) % 8` determines partition
- Even distribution across partitions
- Parallel query execution across partitions

**Use cases**:
- High-volume ingestion (distribute write load)
- No obvious partition key (user_id, session_id)
- Parallel processing (scan all partitions in parallel)

### Pattern 5: Sub-Partitioning (Hierarchical)

**Use case**: Partition by date, then sub-partition by region.

```sql
-- Parent table: partition by year
CREATE TABLE sales (
  id SERIAL,
  sale_date DATE NOT NULL,
  region VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2)
) PARTITION BY RANGE (sale_date);

-- Partition for 2024, sub-partitioned by region
CREATE TABLE sales_2024 PARTITION OF sales
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01')
PARTITION BY LIST (region);

-- Sub-partitions for 2024
CREATE TABLE sales_2024_us PARTITION OF sales_2024
FOR VALUES IN ('US');

CREATE TABLE sales_2024_eu PARTITION OF sales_2024
FOR VALUES IN ('EU');

CREATE TABLE sales_2024_asia PARTITION OF sales_2024
FOR VALUES IN ('Asia');

-- Partition for 2025
CREATE TABLE sales_2025 PARTITION OF sales
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01')
PARTITION BY LIST (region);

CREATE TABLE sales_2025_us PARTITION OF sales_2025
FOR VALUES IN ('US');

-- etc.
```

**Query pruning**:
```sql
SELECT * FROM sales
WHERE sale_date >= '2024-06-01'
  AND sale_date < '2024-07-01'
  AND region = 'US';
-- Scans only sales_2024_us partition
```

---

## 🔧 Hands-On: Partition Your First Table (15 Minutes)

Let's partition an `orders` table by month.

### Step 1: Create Partitioned Table

```sql
-- Create parent table
CREATE TABLE orders (
  id SERIAL,
  customer_id INT,
  total DECIMAL(10, 2),
  status VARCHAR(20),
  created_at DATE NOT NULL
) PARTITION BY RANGE (created_at);
```

### Step 2: Create Partitions

```sql
-- Create monthly partitions for 2024
CREATE TABLE orders_2024_01 PARTITION OF orders
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE orders_2024_02 PARTITION OF orders
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE orders_2024_03 PARTITION OF orders
FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE orders_2024_04 PARTITION OF orders
FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE orders_2024_05 PARTITION OF orders
FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE orders_2024_06 PARTITION OF orders
FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
```

### Step 3: Insert Test Data

```sql
-- Insert sample orders
INSERT INTO orders (customer_id, total, status, created_at)
SELECT
  (random() * 1000)::int,
  (random() * 500 + 10)::numeric(10,2),
  CASE (random() * 2)::int
    WHEN 0 THEN 'completed'
    ELSE 'pending'
  END,
  '2024-01-01'::date + (random() * 180)::int  -- Random date in first 6 months
FROM generate_series(1, 1000000);  -- 1M orders

-- Check partition distribution
SELECT
  tableoid::regclass AS partition,
  COUNT(*) AS row_count
FROM orders
GROUP BY tableoid
ORDER BY partition;
```

**Result**:
```
partition        | row_count
-----------------|----------
orders_2024_01   | 172458
orders_2024_02   | 160394
orders_2024_03   | 172105
orders_2024_04   | 166238
orders_2024_05   | 171652
orders_2024_06   | 157153
```

### Step 4: Query with Partition Pruning

```sql
-- Query June 2024 orders
EXPLAIN ANALYZE
SELECT COUNT(*), AVG(total)
FROM orders
WHERE created_at >= '2024-06-01' AND created_at < '2024-07-01';
```

**Execution plan**:
```
Aggregate (actual time=45.123..45.124 rows=1 loops=1)
  -> Seq Scan on orders_2024_06 (actual time=0.015..28.456 rows=157153 loops=1)
        Filter: created_at >= '2024-06-01' AND created_at < '2024-07-01'
Execution Time: 45.234 ms

Partitions pruned: 5 (orders_2024_01 to orders_2024_05)
```

**Without partitioning** (same query):
```
Execution time: 850ms (scans all 1M rows)
```

**Improvement**: **18.8x faster**.

### Step 5: Add Indexes to Partitions

```sql
-- Create index on customer_id (applies to all partitions)
CREATE INDEX idx_orders_customer ON orders(customer_id);

-- Check indexes on partitions
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename LIKE 'orders_2024%'
ORDER BY tablename, indexname;
```

**Result**: Index automatically created on each partition.

---

## 🏢 Real-World Examples

### **Instagram** (Social Media)
- **Table**: `posts` (100B+ rows)
- **Partition**: By `created_at` (daily partitions)
- **Why**: User feeds query recent posts (last 7 days)
- **Impact**: Query time: 30s → 400ms (75x faster)

### **Uber** (Ride Sharing)
- **Table**: `trips` (10B+ rows)
- **Partition**: By `trip_date` (monthly partitions)
- **Why**: Analytics queries focus on recent months
- **Impact**: Dropped old partitions save 80% storage

### **Stripe** (Payment Processing)
- **Table**: `balance_transactions` (50B+ rows)
- **Partition**: By `created` timestamp (monthly partitions)
- **Why**: Merchant dashboards show last 30-90 days
- **Impact**: Dashboard queries: 15s → 300ms (50x faster)

### **GitHub** (Code Hosting)
- **Table**: `events` (commits, issues, PRs - 100B+ rows)
- **Partition**: By `created_at` (monthly partitions)
- **Why**: Activity feeds, trending repos query recent data
- **Impact**: Dropped partitions >1 year old, saved 60% storage

---

## 🚀 Advanced Partitioning Strategies

### Strategy 1: Partition Retention Policies

**Problem**: Old data never used, wastes storage.

**Solution**: Drop old partitions.

```sql
-- Drop partition for January 2023 (data >1 year old)
DROP TABLE events_2023_01;

-- Or detach (keeps table, removes from partition set)
ALTER TABLE events DETACH PARTITION events_2023_01;

-- Archive detached partition to cheaper storage
pg_dump events_2023_01 | gzip > events_2023_01.sql.gz
DROP TABLE events_2023_01;
```

**Automated retention** (with pg_partman):
```sql
UPDATE partman.part_config
SET retention = '90 days',
     retention_keep_table = false
WHERE parent_table = 'public.events';
```

**Result**: Auto-drops partitions older than 90 days.

### Strategy 2: Parallel Queries

**Partitioning enables parallel execution**:

```sql
-- Enable parallel queries
SET max_parallel_workers_per_gather = 4;

-- Query across all partitions
EXPLAIN ANALYZE
SELECT event_type, COUNT(*)
FROM events
WHERE event_date >= '2024-01-01'
GROUP BY event_type;
```

**Execution plan**:
```
Finalize GroupAggregate
  -> Gather (4 workers)
    -> Partial GroupAggregate
      -> Parallel Append
        -> Parallel Seq Scan on events_2024_01
        -> Parallel Seq Scan on events_2024_02
        -> Parallel Seq Scan on events_2024_03
        ...
```

**4 workers scan partitions in parallel** → 4x faster.

### Strategy 3: Partition-Wise Join

**Problem**: Joining two large partitioned tables.

**Solution**: Enable partition-wise join (joins matching partitions).

```sql
SET enable_partitionwise_join = on;

-- Both tables partitioned by date
SELECT
  o.id,
  o.total,
  i.product_name
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.created_at >= '2024-06-01' AND o.created_at < '2024-07-01';
```

**Execution plan**:
```
Append
  -> Hash Join
    -> Seq Scan on orders_2024_06
    -> Hash
      -> Seq Scan on order_items_2024_06
```

**Joins only June partitions** (not all partitions).

### Strategy 4: Partition-Wise Aggregate

```sql
SET enable_partitionwise_aggregate = on;

SELECT created_at, SUM(total)
FROM orders
GROUP BY created_at;
```

**Execution plan**:
```
Append
  -> HashAggregate on orders_2024_01
  -> HashAggregate on orders_2024_02
  -> HashAggregate on orders_2024_03
  ...
```

**Each partition aggregated separately**, then combined → faster.

---

## 📈 Partitioning Best Practices

### ✅ When to Use Partitioning

**Partition when**:
1. **Table >10GB** and growing
2. **Queries filter by specific column** (date, region, status)
3. **Retention policies** (drop old data periodically)
4. **Parallel processing** needed (ETL, analytics)
5. **Frequent full-table scans** (even with indexes)

### ❌ When NOT to Use Partitioning

**Don't partition when**:
1. **Table <1GB** (overhead > benefit)
2. **No common filter column** (queries scan all partitions anyway)
3. **Too many partitions** (>1,000 partitions = slow planning)
4. **Frequent cross-partition queries** (negates benefit)

### Optimal Partition Size

**Goal**: 1-10GB per partition

```
Too small (<100MB):  Too many partitions, query planning overhead
Just right (1-10GB): Fast scans, manageable partition count
Too large (>50GB):   Loses benefit, still scans too much data
```

**Example**:
- Table: 500GB
- Partition by month
- Growth: 10GB/month
- Result: 50 partitions of ~10GB each ✅

### Partition Key Selection

**Good partition keys**:
- ✅ Date/timestamp (most common: created_at, updated_at)
- ✅ Status (active/archived, pending/completed)
- ✅ Region (US, EU, Asia)
- ✅ Tenant ID (multi-tenant SaaS)

**Bad partition keys**:
- ❌ ID (sequential, no query benefit)
- ❌ Highly unique columns (email, UUID - too many partitions)
- ❌ Columns rarely in WHERE clause

### Indexes on Partitions

```sql
-- ✅ Create index on parent (applies to all partitions)
CREATE INDEX idx_orders_customer ON orders(customer_id);

-- ❌ Don't create on each partition individually (tedious, error-prone)
CREATE INDEX idx_orders_2024_01_customer ON orders_2024_01(customer_id);
CREATE INDEX idx_orders_2024_02_customer ON orders_2024_02(customer_id);
-- ... repeat for every partition
```

---

## 🎯 Partitioning Cheat Sheet

```sql
-- Create partitioned table
CREATE TABLE table_name (...)
PARTITION BY RANGE (column);

-- Create partition
CREATE TABLE partition_name PARTITION OF table_name
FOR VALUES FROM (start) TO (end);

-- List partitioning
CREATE TABLE table_name (...)
PARTITION BY LIST (column);

CREATE TABLE partition_name PARTITION OF table_name
FOR VALUES IN (value1, value2);

-- Hash partitioning
CREATE TABLE table_name (...)
PARTITION BY HASH (column);

CREATE TABLE partition_name PARTITION OF table_name
FOR VALUES WITH (MODULUS n, REMAINDER r);

-- Drop partition
DROP TABLE partition_name;

-- Detach partition (keeps table)
ALTER TABLE table_name DETACH PARTITION partition_name;

-- Attach partition
ALTER TABLE table_name ATTACH PARTITION partition_name
FOR VALUES FROM (start) TO (end);

-- List partitions
SELECT
  schemaname,
  tablename AS partition,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'parent_table%'
ORDER BY tablename;

-- Check partition pruning
EXPLAIN SELECT * FROM table_name WHERE partition_column = value;
```

---

## 💪 Next Steps

**1. Identify Partition Candidates** (Today):
- Find tables >10GB
- Check query patterns (what's in WHERE clauses?)
- Measure current query performance

**2. Create First Partition** (This Week):
- Pick largest table with date filter
- Partition by month or year
- Create partitions for last 2 years
- Test query performance (EXPLAIN ANALYZE)

**3. Implement Retention** (Next Week):
- Set up pg_partman for auto-creation
- Configure retention policy (drop partitions >90 days)
- Schedule maintenance job

**Remember**: Partition tables >10GB with common filter columns. Start with date-based range partitioning.

---

## 🔗 Learn More

**Next POCs**:
- **POC #27: Foreign Keys & Referential Integrity** - Cascading deletes across partitions
- **POC #28: Check Constraints** - Partition constraints for optimization
- **POC #29: Sequences & Auto-Increment** - ID generation in partitioned tables

**Related Topics**:
- **POC #23: Materialized Views** - Cache results from partitioned tables
- **POC #25: Window Functions** - Optimize with partitioning
- **POC #14: EXPLAIN Analysis** - Verify partition pruning
