# Database Indexing Strategies

## Question
**"Explain different types of database indexes (B-Tree, Hash, GiST, GIN). When would you use each? What are the trade-offs of adding indexes?"**

Common in: Backend, Database, System Design interviews

---

## 📊 Quick Answer

| Index Type | Use Case | Example | Speed (Lookup) |
|------------|----------|---------|----------------|
| **B-Tree** (default) | General purpose, range queries | WHERE id > 100, ORDER BY | O(log n) |
| **Hash** | Exact match only | WHERE email = 'alice@example.com' | O(1) |
| **GIN** (Generalized Inverted) | Full-text search, JSONB, arrays | WHERE tags @> ARRAY['javascript'] | Variable |
| **GiST** (Generalized Search Tree) | Geometric data, full-text | WHERE location <-> point | Variable |
| **Partial** | Subset of rows | WHERE active = true | O(log n) |
| **Covering** | Includes all SELECT columns | SELECT id, name WHERE... | O(log n) |

**Default**: Use **B-Tree** for 90% of cases

**Trade-offs**:
- ✅ **Faster SELECTs** (10-1000x speedup)
- ❌ **Slower INSERTs/UPDATEs** (~10% slower per index)
- ❌ **More disk space** (20-50% of table size per index)

---

## 🎯 Complete Guide

### 1. B-Tree Index (Default - 90% of use cases)

**How it works**: Balanced tree structure, sorted data

```sql
-- Create B-Tree index (default type)
CREATE INDEX idx_users_email ON users(email);

-- Explicit B-Tree
CREATE INDEX idx_users_created_at ON users USING btree(created_at);
```

**Good for**:
- ✅ Equality: `WHERE id = 123`
- ✅ Range: `WHERE created_at > '2024-01-01'`
- ✅ Sorting: `ORDER BY name`
- ✅ LIKE prefix: `WHERE name LIKE 'Alice%'`
- ✅ MIN/MAX: `SELECT MAX(created_at)`

**Not good for**:
- ❌ LIKE suffix: `WHERE name LIKE '%son'`
- ❌ Functions: `WHERE LOWER(name) = 'alice'` (won't use index on `name`)

**Example**:

```sql
-- Without index: Sequential scan (1000ms)
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 123;

/*
Seq Scan on orders  (cost=0.00..1234.56 rows=10 width=120) (actual time=0.123..1000.456 rows=10 loops=1)
  Filter: (user_id = 123)
  Rows Removed by Filter: 1000000
*/

-- Add index
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- With index: Index scan (5ms) - 200x faster!
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 123;

/*
Index Scan using idx_orders_user_id on orders  (cost=0.42..12.45 rows=10 width=120) (actual time=0.012..5.234 rows=10 loops=1)
  Index Cond: (user_id = 123)
*/
```

---

### 2. Composite Index (Multi-Column)

**Column order matters!**

**Rule**: Equality (=) → Range (>, <) → Sort (ORDER BY)

```sql
-- Query
SELECT * FROM orders
WHERE user_id = 123          -- Equality
  AND status = 'completed'   -- Equality
  AND created_at > '2024-01-01'  -- Range
ORDER BY created_at DESC;    -- Sort

-- Optimal index
CREATE INDEX idx_orders_composite ON orders(user_id, status, created_at DESC);

-- ✅ Uses index fully
-- Index Scan using idx_orders_composite (actual time=0.012..0.234)

-- ❌ WRONG order
CREATE INDEX idx_orders_wrong ON orders(created_at, status, user_id);
-- Won't use index for WHERE user_id = 123 alone!
```

**Index Column Order Examples**:

```sql
-- Good for: WHERE user_id = 123
CREATE INDEX idx_1 ON orders(user_id);

-- Good for:
--   WHERE user_id = 123
--   WHERE user_id = 123 AND status = 'completed'
CREATE INDEX idx_2 ON orders(user_id, status);

-- Good for:
--   WHERE user_id = 123
--   WHERE user_id = 123 AND status = 'completed'
--   WHERE user_id = 123 AND status = 'completed' AND created_at > '2024-01-01'
CREATE INDEX idx_3 ON orders(user_id, status, created_at);

-- ❌ Won't help WHERE status = 'completed' alone
-- (needs user_id first!)
```

**When to Use**:
- Multiple columns frequently queried together
- Follow the equality → range → sort rule

---

### 3. Partial Index (Conditional)

**Index only a subset of rows**

```sql
-- Only 10% of orders are 'pending'
-- Don't index the other 90%!

CREATE INDEX idx_orders_pending ON orders(user_id, created_at)
WHERE status = 'pending';

-- Query that uses partial index
SELECT * FROM orders
WHERE status = 'pending' AND user_id = 123
ORDER BY created_at DESC;

-- Index size: 90% smaller than full index!
```

**When to Use**:
- Query filters on specific value (status = 'active', deleted_at IS NULL)
- Subset is small (< 20% of rows)
- Frequent queries on that subset

**Real-World Example**:

```sql
-- E-commerce: Index only active products
CREATE INDEX idx_products_active ON products(category, price)
WHERE active = true;

-- Blog: Index only published posts
CREATE INDEX idx_posts_published ON posts(published_at DESC)
WHERE status = 'published';

-- Soft deletes: Index only non-deleted records
CREATE INDEX idx_users_not_deleted ON users(email)
WHERE deleted_at IS NULL;
```

---

### 4. Covering Index (Index-Only Scan)

**Include all columns needed by query in the index**

```sql
-- Query (selects specific columns)
SELECT id, total, status FROM orders
WHERE user_id = 123;

-- Regular index: Needs to access table
CREATE INDEX idx_orders_user ON orders(user_id);

-- EXPLAIN ANALYZE:
-- Index Scan + Heap Fetches (slow)

-- Covering index: Includes all SELECT columns
CREATE INDEX idx_orders_covering ON orders(user_id) INCLUDE (id, total, status);

-- EXPLAIN ANALYZE:
-- Index Only Scan (no table access!) - 2-5x faster

/*
Index Only Scan using idx_orders_covering on orders  (actual time=0.005..0.012 rows=10 loops=1)
  Index Cond: (user_id = 123)
  Heap Fetches: 0  ← No table access!
*/
```

**When to Use**:
- Frequently run queries selecting specific columns
- Index size is acceptable (adds column data to index)

---

### 5. Unique Index

**Enforce uniqueness + performance**

```sql
-- Unique constraint creates unique index automatically
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Or create unique index directly
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);

-- Composite unique index
CREATE UNIQUE INDEX idx_users_username_tenant ON users(username, tenant_id);
```

**Benefits**:
- ✅ Data integrity (prevents duplicates)
- ✅ Faster lookups (database knows only 1 result max)

---

### 6. Expression Index (Function-Based)

**Index on computed values**

```sql
-- Query searches lowercase email
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';

-- Regular index on email won't help!
-- Need expression index:
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- Now query uses index:
EXPLAIN ANALYZE
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';

/*
Index Scan using idx_users_email_lower on users  (actual time=0.012..0.023 rows=1 loops=1)
  Index Cond: (lower(email) = 'alice@example.com')
*/
```

**Common Use Cases**:

```sql
-- Case-insensitive search
CREATE INDEX idx_users_name_lower ON users(LOWER(name));

-- Date truncation
CREATE INDEX idx_orders_date_trunc ON orders(DATE_TRUNC('day', created_at));

-- JSON field
CREATE INDEX idx_users_meta_country ON users((metadata->>'country'));

-- Calculated field
CREATE INDEX idx_products_discounted_price ON products((price * (1 - discount)));
```

---

### 7. Full-Text Search Indexes (GIN)

**For text search and JSONB**

```sql
-- Setup: Add tsvector column
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Populate search vector
UPDATE articles
SET search_vector = to_tsvector('english', title || ' ' || body);

-- Create GIN index
CREATE INDEX idx_articles_search ON articles USING gin(search_vector);

-- Full-text search query
SELECT * FROM articles
WHERE search_vector @@ to_tsquery('english', 'postgresql & performance');

-- EXPLAIN ANALYZE:
-- Bitmap Index Scan using idx_articles_search  (actual time=0.123..1.234 rows=15 loops=1)
```

**JSONB Indexing**:

```sql
-- JSONB column
CREATE TABLE products (
  id serial PRIMARY KEY,
  name text,
  attributes jsonb
);

-- GIN index on JSONB
CREATE INDEX idx_products_attributes ON products USING gin(attributes);

-- Query JSONB
SELECT * FROM products
WHERE attributes @> '{"color": "red", "size": "large"}';

-- Or specific key
SELECT * FROM products
WHERE attributes->>'brand' = 'Nike';

-- Index specific JSONB key (faster)
CREATE INDEX idx_products_brand ON products((attributes->>'brand'));
```

---

### 8. Hash Index (Exact Match Only)

**Fast equality lookups, no range queries**

```sql
-- Create hash index
CREATE INDEX idx_users_email_hash ON users USING hash(email);

-- Good for: Exact match
SELECT * FROM users WHERE email = 'alice@example.com';

-- NOT good for:
-- WHERE email LIKE 'alice%'  (won't use hash index)
-- WHERE email > 'alice'       (won't use hash index)
-- ORDER BY email              (won't use hash index)
```

**When to Use**:
- Only equality queries (no ranges, no sorting)
- Very rarely used in practice (B-Tree is almost always better)

---

### 9. Geometric Indexes (GiST)

**For spatial data**

```sql
-- Setup PostGIS extension
CREATE EXTENSION postgis;

-- Create table with geography column
CREATE TABLE stores (
  id serial PRIMARY KEY,
  name text,
  location geography(POINT, 4326)
);

-- Create GiST index
CREATE INDEX idx_stores_location ON stores USING gist(location);

-- Find stores within 5km of a point
SELECT name FROM stores
WHERE ST_DWithin(
  location,
  ST_MakePoint(-122.4194, 37.7749)::geography,  -- San Francisco
  5000  -- 5km
);

-- EXPLAIN ANALYZE:
-- Index Scan using idx_stores_location  (actual time=0.123..1.234 rows=10 loops=1)
```

---

## ⚖️ Index Trade-offs

### When to Add an Index

✅ **Add index if**:
- Column is frequently in WHERE clause
- Table has > 10,000 rows
- Column has high cardinality (many unique values)
- Read-heavy workload (more SELECTs than INSERTs)

**Example**:

```sql
-- Add index: user_id in WHERE clause, read-heavy
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

---

### When NOT to Add an Index

❌ **Don't add index if**:
- Small table (< 10,000 rows)
- Low cardinality (e.g., boolean column with only true/false)
- Write-heavy workload (frequent INSERTs/UPDATEs)
- Column rarely queried

**Example**:

```sql
-- DON'T index: Boolean column (low cardinality)
-- CREATE INDEX idx_users_active ON users(active);  ❌

-- Instead: Use partial index
CREATE INDEX idx_users_active ON users(id) WHERE active = true;  ✅
```

---

### Index Overhead

**Every index adds**:
- **Disk space**: 20-50% of table size
- **Write overhead**: ~10% slower INSERT/UPDATE per index
- **Maintenance**: Periodic REINDEX or VACUUM

**Example**:

```sql
-- Table: 1 GB
-- Index 1: 200 MB
-- Index 2: 300 MB
-- Index 3: 250 MB
-- Total: 1 GB + 750 MB = 1.75 GB (75% overhead!)

-- Write performance:
-- No indexes: 10,000 inserts/sec
-- 3 indexes: 7,000 inserts/sec (30% slower)
```

---

## 🔍 Index Monitoring

### Find Missing Indexes

```sql
-- Queries scanning large tables without indexes
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / seq_scan as avg_seq_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND seq_tup_read / seq_scan > 10000  -- Scanning >10k rows on average
ORDER BY seq_tup_read DESC;
```

### Find Unused Indexes

```sql
-- Indexes never used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Drop unused indexes to save space and improve write speed
-- DROP INDEX idx_unused;
```

### Index Size

```sql
-- Show index sizes
SELECT
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 🎓 Interview Tips

### Common Questions

**Q: How do you decide which columns to index?**
A: "Analyze query patterns using pg_stat_statements. Index columns frequently in WHERE, JOIN, ORDER BY clauses. Consider cardinality (high is better), table size (> 10k rows), and read vs write ratio."

**Q: What's the difference between B-Tree and Hash indexes?**
A: "B-Tree supports ranges, sorting, and equality (>=, <, ORDER BY). Hash only supports equality (=). B-Tree is almost always the right choice. Hash is rarely used."

**Q: How many indexes is too many?**
A: "No hard limit, but each index slows writes ~10%. If table has >5-10 indexes, review if all are needed. For write-heavy tables (logs, analytics), minimize indexes. For read-heavy (reports), more indexes OK."

**Q: Composite index (A, B, C) - which queries use it?**
A: "Uses index for: WHERE A, WHERE A AND B, WHERE A AND B AND C. Doesn't use for: WHERE B, WHERE C, WHERE B AND C (needs A first). Leftmost prefix rule."

**Q: When would you use a partial index?**
A: "When queries filter on specific value frequently (e.g., status = 'active') and that subset is small (< 20% of rows). Saves disk space and improves write performance."

---

## 🔗 Related Questions

- [Query Optimization](/interview-prep/database-storage/query-optimization)
- [Database Scaling Strategies](/interview-prep/database-storage/scaling-strategies)
- [SQL vs NoSQL](/interview-prep/database-storage/sql-vs-nosql)
- [Performance Bottleneck Identification](/interview-prep/caching-cdn/performance-bottlenecks)

---

## 📚 Additional Resources

- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Use The Index, Luke!](https://use-the-index-luke.com/)
- [PostgreSQL Index Internals](https://www.postgresql.org/docs/current/btree-implementation.html)
- [Index Maintenance](https://www.postgresql.org/docs/current/routine-reindex.html)
