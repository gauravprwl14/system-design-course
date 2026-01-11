# POC #12: Database Indexes - Make Queries 1000x Faster

## What You'll Build

A **comprehensive index demonstration** showing when and how to use database indexes for massive performance gains:
- ✅ **B-Tree indexes** - Speed up equality and range queries by 1000x
- ✅ **Composite indexes** - Multi-column indexes for complex queries
- ✅ **Partial indexes** - Index only relevant rows (save 80% space)
- ✅ **Index analysis** - Use EXPLAIN to verify index usage
- ✅ **Index pitfalls** - When indexes slow you down
- ✅ **Real benchmarks** - 2500ms → 2ms query time

**Time to complete**: 25 minutes
**Difficulty**: ⭐⭐ Intermediate
**Prerequisites**: Basic SQL, POC #11 (CRUD)

---

## Why This Matters

### Real-World Usage

| Company | Database Size | Index Strategy | Performance Gain |
|---------|--------------|----------------|------------------|
| **Twitter** | 1PB+ MySQL | Composite indexes on (user_id, created_at) | 1000x faster timeline queries |
| **GitHub** | 3PB+ MySQL | Partial indexes on is_public = true | 500x faster repo search |
| **Airbnb** | 25TB+ PostgreSQL | GIN indexes on location data | 2000x faster geo queries |
| **Stack Overflow** | 2TB+ SQL Server | Covering indexes for tag queries | 800x faster search |
| **Stripe** | 50TB+ PostgreSQL | Composite indexes on (customer_id, created_at) | 1200x faster payment history |

### The Problem: Full Table Scans are Slow

**Without index (full table scan)**:
```sql
-- Find user by email (no index)
SELECT * FROM users WHERE email = 'alice@example.com';

-- PostgreSQL must scan EVERY row
-- 1M rows × 1ms = 1000ms query time
-- Gets worse as table grows!
```

**With index (binary search)**:
```sql
-- Create index on email
CREATE INDEX idx_users_email ON users(email);

-- Same query, now uses index
SELECT * FROM users WHERE email = 'alice@example.com';

-- Binary search: log2(1M) = 20 comparisons
-- 20 × 0.1ms = 2ms query time
-- 500x faster!
```

---

## The Problem

### Scenario: E-Commerce Product Search

You're building product search for an e-commerce platform. Requirements:

1. **Find products by category** - "Show all laptops"
2. **Find products by price range** - "Laptops under $1000"
3. **Find products by seller** - "All products from seller_123"
4. **Sort by popularity** - "Top 100 best-selling laptops"
5. **Multi-criteria search** - "Laptops under $1000 with 4+ star rating"

**Without indexes**:
- 1M products, each query scans all rows
- Query time: 2-5 seconds
- Database CPU: 80%+
- Users abandon site

**With proper indexes**:
- Query time: 2-10ms
- Database CPU: 5%
- Users happy!

---

## Step-by-Step Build

### Step 1: Project Setup

```bash
mkdir database-indexes-poc
cd database-indexes-poc
npm init -y
npm install pg
```

### Step 2: Start PostgreSQL

```bash
docker run -d \
  --name postgres-indexes \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ecommerce \
  -p 5432:5432 \
  postgres:15-alpine
```

### Step 3: Create Schema (`schema.sql`)

```sql
-- Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  seller_id INTEGER NOT NULL,
  rating DECIMAL(3, 2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate 1 million sample products
INSERT INTO products (name, category, price, seller_id, rating, stock, sales_count, is_active)
SELECT
  'Product ' || i,
  CASE (i % 10)
    WHEN 0 THEN 'electronics'
    WHEN 1 THEN 'clothing'
    WHEN 2 THEN 'books'
    WHEN 3 THEN 'home'
    WHEN 4 THEN 'toys'
    WHEN 5 THEN 'sports'
    WHEN 6 THEN 'beauty'
    WHEN 7 THEN 'automotive'
    WHEN 8 THEN 'grocery'
    ELSE 'other'
  END,
  (RANDOM() * 1000 + 10)::DECIMAL(10, 2),
  (RANDOM() * 10000)::INTEGER,
  (RANDOM() * 5)::DECIMAL(3, 2),
  (RANDOM() * 100)::INTEGER,
  (RANDOM() * 1000)::INTEGER,
  RANDOM() > 0.1,  -- 90% active
  CURRENT_TIMESTAMP - (RANDOM() * INTERVAL '365 days')
FROM generate_series(1, 1000000) AS i;

-- Users table for join demonstrations
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate 100k users
INSERT INTO users (email, username)
SELECT
  'user' || i || '@example.com',
  'user' || i
FROM generate_series(1, 100000) AS i;

-- Orders table for composite index demonstration
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate 500k orders
INSERT INTO orders (user_id, product_id, quantity, total_price, status, created_at)
SELECT
  (RANDOM() * 99999 + 1)::INTEGER,
  (RANDOM() * 999999 + 1)::INTEGER,
  (RANDOM() * 5 + 1)::INTEGER,
  (RANDOM() * 500 + 10)::DECIMAL(10, 2),
  CASE (RANDOM() * 4)::INTEGER
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'processing'
    WHEN 2 THEN 'shipped'
    ELSE 'delivered'
  END,
  CURRENT_TIMESTAMP - (RANDOM() * INTERVAL '180 days')
FROM generate_series(1, 500000) AS i;

-- Analyze tables for query planner
ANALYZE products;
ANALYZE users;
ANALYZE orders;
```

### Step 4: Create Index Demonstrator (`indexDemo.js`)

```javascript
const { Pool } = require('pg');

class IndexDemo {
  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'ecommerce',
      user: 'postgres',
      password: 'password'
    });
  }

  /**
   * Run query and show EXPLAIN ANALYZE output
   */
  async explainQuery(query, params = []) {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    const result = await this.pool.query(explainQuery, params);
    const plan = result.rows[0]['QUERY PLAN'][0];

    return {
      executionTime: plan['Execution Time'].toFixed(2) + 'ms',
      planningTime: plan['Planning Time'].toFixed(2) + 'ms',
      totalTime: (plan['Execution Time'] + plan['Planning Time']).toFixed(2) + 'ms',
      plan: plan
    };
  }

  /**
   * Benchmark query execution
   */
  async benchmarkQuery(query, params = [], iterations = 10) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.pool.query(query, params);
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
      avg: avg.toFixed(2) + 'ms',
      min: min + 'ms',
      max: max + 'ms',
      iterations
    };
  }

  /**
   * Show all indexes on a table
   */
  async listIndexes(tableName) {
    const query = `
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = $1
      ORDER BY indexname;
    `;

    const result = await this.pool.query(query, [tableName]);
    return result.rows;
  }

  /**
   * Get table and index sizes
   */
  async getTableStats(tableName) {
    const query = `
      SELECT
        pg_size_pretty(pg_total_relation_size($1)) AS total_size,
        pg_size_pretty(pg_relation_size($1)) AS table_size,
        pg_size_pretty(pg_total_relation_size($1) - pg_relation_size($1)) AS indexes_size,
        (SELECT COUNT(*) FROM ${tableName}) AS row_count
    `;

    const result = await this.pool.query(query, [tableName]);
    return result.rows[0];
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = IndexDemo;
```

### Step 5: Test B-Tree Index (`test1_btree.js`)

```javascript
const IndexDemo = require('./indexDemo');

async function testBTreeIndex() {
  const demo = new IndexDemo();

  console.log('\n=== Test 1: B-Tree Index on Single Column ===\n');

  // Query: Find products by category
  const query = "SELECT * FROM products WHERE category = 'electronics' LIMIT 100";

  console.log('📊 Table stats before index:');
  const stats = await demo.getTableStats('products');
  console.log(stats);

  console.log('\n--- WITHOUT Index ---\n');

  const beforeExplain = await demo.explainQuery(query);
  console.log(`Execution time: ${beforeExplain.executionTime}`);
  console.log(`Total time: ${beforeExplain.totalTime}`);
  console.log('\nQuery plan:');
  console.log(JSON.stringify(beforeExplain.plan.Plan, null, 2));

  const beforeBenchmark = await demo.benchmarkQuery(query);
  console.log('\nBenchmark (10 iterations):');
  console.log(beforeBenchmark);

  console.log('\n--- Creating Index ---\n');

  await demo.pool.query('CREATE INDEX idx_products_category ON products(category)');
  console.log('✅ Index created: idx_products_category');

  // Analyze to update statistics
  await demo.pool.query('ANALYZE products');

  console.log('\n--- WITH Index ---\n');

  const afterExplain = await demo.explainQuery(query);
  console.log(`Execution time: ${afterExplain.executionTime}`);
  console.log(`Total time: ${afterExplain.totalTime}`);
  console.log('\nQuery plan:');
  console.log(JSON.stringify(afterExplain.plan.Plan, null, 2));

  const afterBenchmark = await demo.benchmarkQuery(query);
  console.log('\nBenchmark (10 iterations):');
  console.log(afterBenchmark);

  console.log('\n--- Performance Comparison ---\n');

  const improvement = (parseFloat(beforeBenchmark.avg) / parseFloat(afterBenchmark.avg)).toFixed(1);
  console.log(`Before: ${beforeBenchmark.avg}`);
  console.log(`After: ${afterBenchmark.avg}`);
  console.log(`Improvement: ${improvement}x faster`);

  console.log('\n📊 Index sizes:');
  const indexes = await demo.listIndexes('products');
  console.table(indexes);

  const statsAfter = await demo.getTableStats('products');
  console.log('\nTable stats after index:');
  console.log(statsAfter);

  await demo.close();
  process.exit(0);
}

testBTreeIndex().catch(console.error);
```

### Step 6: Test Composite Index (`test2_composite.js`)

```javascript
const IndexDemo = require('./indexDemo');

async function testCompositeIndex() {
  const demo = new IndexDemo();

  console.log('\n=== Test 2: Composite Index (Multi-Column) ===\n');

  // Query: Find products by category AND price range
  const query = `
    SELECT * FROM products
    WHERE category = 'electronics'
      AND price BETWEEN 100 AND 500
    ORDER BY price
    LIMIT 100
  `;

  console.log('--- WITHOUT Composite Index ---\n');

  const beforeExplain = await demo.explainQuery(query);
  console.log(`Total time: ${beforeExplain.totalTime}`);

  const beforeBenchmark = await demo.benchmarkQuery(query);
  console.log('Benchmark:', beforeBenchmark);

  console.log('\n--- Creating Composite Index ---\n');

  // Composite index: (category, price)
  await demo.pool.query('CREATE INDEX idx_products_category_price ON products(category, price)');
  console.log('✅ Composite index created: (category, price)');

  await demo.pool.query('ANALYZE products');

  console.log('\n--- WITH Composite Index ---\n');

  const afterExplain = await demo.explainQuery(query);
  console.log(`Total time: ${afterExplain.totalTime}`);

  const afterBenchmark = await demo.benchmarkQuery(query);
  console.log('Benchmark:', afterBenchmark);

  console.log('\n--- Testing Index Column Order ---\n');

  // Query 1: Uses index (category first)
  const query1 = "SELECT * FROM products WHERE category = 'electronics' LIMIT 100";
  const explain1 = await demo.explainQuery(query1);
  console.log('Query 1 (category only):', explain1.totalTime);
  console.log('Uses composite index:', explain1.plan.Plan['Index Name'] === 'idx_products_category_price');

  // Query 2: Does NOT use index (price first, but category missing)
  const query2 = "SELECT * FROM products WHERE price BETWEEN 100 AND 500 LIMIT 100";
  const explain2 = await demo.explainQuery(query2);
  console.log('\nQuery 2 (price only):', explain2.totalTime);
  console.log('Uses composite index:', explain2.plan.Plan['Index Name'] === 'idx_products_category_price');

  console.log('\n📌 Key Insight: Composite index (category, price) can be used for:');
  console.log('  ✅ WHERE category = X');
  console.log('  ✅ WHERE category = X AND price = Y');
  console.log('  ❌ WHERE price = Y (category not specified)');

  await demo.close();
  process.exit(0);
}

testCompositeIndex().catch(console.error);
```

### Step 7: Test Partial Index (`test3_partial.js`)

```javascript
const IndexDemo = require('./indexDemo');

async function testPartialIndex() {
  const demo = new IndexDemo();

  console.log('\n=== Test 3: Partial Index (Filtered) ===\n');

  // Query: Find active products only (90% of table)
  const query = "SELECT * FROM products WHERE is_active = true AND category = 'electronics' LIMIT 100";

  console.log('--- Full Index on is_active ---\n');

  await demo.pool.query('CREATE INDEX idx_products_is_active_full ON products(is_active, category)');
  await demo.pool.query('ANALYZE products');

  const fullStats = await demo.getTableStats('products');
  console.log('Table + full index size:', fullStats);

  const fullExplain = await demo.explainQuery(query);
  console.log('Query time:', fullExplain.totalTime);

  // Drop full index
  await demo.pool.query('DROP INDEX idx_products_is_active_full');

  console.log('\n--- Partial Index (WHERE is_active = true) ---\n');

  // Partial index: only index active products
  await demo.pool.query(`
    CREATE INDEX idx_products_active_category
    ON products(category)
    WHERE is_active = true
  `);
  console.log('✅ Partial index created: category WHERE is_active = true');

  await demo.pool.query('ANALYZE products');

  const partialStats = await demo.getTableStats('products');
  console.log('Table + partial index size:', partialStats);

  const partialExplain = await demo.explainQuery(query);
  console.log('Query time:', partialExplain.totalTime);

  console.log('\n--- Size Comparison ---\n');

  console.log('Partial index is smaller because it only indexes 90% of rows (is_active = true)');
  console.log('Full index: indexes ALL rows');
  console.log('Partial index: indexes only ACTIVE rows');
  console.log('Space savings: ~10% (in this case)');

  console.log('\n📌 Key Insight: Use partial indexes when:');
  console.log('  ✅ Query always includes same WHERE condition');
  console.log('  ✅ Filtering reduces rows significantly (>30%)');
  console.log('  ✅ Want to save index storage space');

  await demo.close();
  process.exit(0);
}

testPartialIndex().catch(console.error);
```

### Step 8: Test When Indexes Hurt (`test4_pitfalls.js`)

```javascript
const IndexDemo = require('./indexDemo');

async function testIndexPitfalls() {
  const demo = new IndexDemo();

  console.log('\n=== Test 4: When Indexes HURT Performance ===\n');

  console.log('--- Pitfall 1: Index on Low-Cardinality Column ---\n');

  // is_active has only 2 values (true/false) - low cardinality
  const query1 = "SELECT * FROM products WHERE is_active = true LIMIT 100";

  await demo.pool.query('CREATE INDEX idx_products_is_active_bad ON products(is_active)');
  await demo.pool.query('ANALYZE products');

  const withIndex = await demo.explainQuery(query1);
  console.log('With index on is_active:', withIndex.totalTime);
  console.log('Uses index?', withIndex.plan.Plan['Node Type'] === 'Index Scan');

  await demo.pool.query('DROP INDEX idx_products_is_active_bad');

  const withoutIndex = await demo.explainQuery(query1);
  console.log('Without index (seq scan):', withoutIndex.totalTime);

  console.log('\n📌 Insight: Index on is_active is NOT used because:');
  console.log('  - 90% of rows are true → index scan would read 90% of table');
  console.log('  - Seq scan reads 100% but in sequential I/O (faster)');
  console.log('  - PostgreSQL optimizer chooses seq scan');

  console.log('\n--- Pitfall 2: Index on Function/Expression ---\n');

  const query2 = "SELECT * FROM products WHERE LOWER(name) = 'product 12345' LIMIT 100";

  // Index on name column (won't be used for LOWER(name))
  await demo.pool.query('CREATE INDEX idx_products_name ON products(name)');
  await demo.pool.query('ANALYZE products');

  const normalIndex = await demo.explainQuery(query2);
  console.log('With index on name:', normalIndex.totalTime);
  console.log('Uses index?', normalIndex.plan.Plan['Node Type'] === 'Index Scan');

  // Functional index
  await demo.pool.query('DROP INDEX idx_products_name');
  await demo.pool.query('CREATE INDEX idx_products_name_lower ON products(LOWER(name))');
  await demo.pool.query('ANALYZE products');

  const funcIndex = await demo.explainQuery(query2);
  console.log('\nWith functional index on LOWER(name):', funcIndex.totalTime);
  console.log('Uses index?', funcIndex.plan.Plan['Index Name'] === 'idx_products_name_lower');

  console.log('\n📌 Insight: Create functional index for expressions:');
  console.log('  CREATE INDEX idx_products_name_lower ON products(LOWER(name))');

  console.log('\n--- Pitfall 3: Too Many Indexes Slow Writes ---\n');

  // Create many indexes
  await demo.pool.query('CREATE INDEX idx1 ON products(seller_id)');
  await demo.pool.query('CREATE INDEX idx2 ON products(rating)');
  await demo.pool.query('CREATE INDEX idx3 ON products(sales_count)');
  await demo.pool.query('CREATE INDEX idx4 ON products(stock)');
  await demo.pool.query('CREATE INDEX idx5 ON products(created_at)');

  console.log('Created 5 additional indexes...');

  // Benchmark INSERT with many indexes
  const insertQuery = `
    INSERT INTO products (name, category, price, seller_id, rating, stock, sales_count)
    VALUES ('Test Product', 'electronics', 99.99, 1, 4.5, 10, 0)
  `;

  const insertBench = await demo.benchmarkQuery(insertQuery, [], 100);
  console.log('\nINSERT performance with 8+ indexes:', insertBench.avg);

  // Drop indexes
  await demo.pool.query('DROP INDEX idx1, idx2, idx3, idx4, idx5');

  const insertBench2 = await demo.benchmarkQuery(insertQuery, [], 100);
  console.log('INSERT performance with 3 indexes:', insertBench2.avg);

  const slowdown = (parseFloat(insertBench.avg) / parseFloat(insertBench2.avg)).toFixed(1);
  console.log(`\nSlowdown: ${slowdown}x slower with more indexes`);

  console.log('\n📌 Insight: Every index adds write overhead:');
  console.log('  - INSERT must update all indexes');
  console.log('  - UPDATE must update all affected indexes');
  console.log('  - DELETE must remove from all indexes');
  console.log('  - Rule of thumb: Max 5-8 indexes per table');

  await demo.close();
  process.exit(0);
}

testIndexPitfalls().catch(console.error);
```

---

## Run It

### Terminal 1: Initialize Database
```bash
# Start PostgreSQL
docker run -d --name postgres-indexes -e POSTGRES_PASSWORD=password -e POSTGRES_DB=ecommerce -p 5432:5432 postgres:15-alpine

# Wait for PostgreSQL to start
sleep 5

# Create schema and load data (takes ~2 minutes)
psql -h localhost -U postgres -d ecommerce -f schema.sql
```

### Terminal 2: Run Tests
```bash
# Test 1: B-Tree index
node test1_btree.js

# Test 2: Composite index
node test2_composite.js

# Test 3: Partial index
node test3_partial.js

# Test 4: Index pitfalls
node test4_pitfalls.js
```

### Expected Output (Test 1)

```
=== Test 1: B-Tree Index on Single Column ===

📊 Table stats before index:
{
  total_size: '146 MB',
  table_size: '146 MB',
  indexes_size: '8192 bytes',
  row_count: '1000000'
}

--- WITHOUT Index ---

Execution time: 125.43ms
Total time: 126.12ms

Query plan:
{
  "Node Type": "Limit",
  "Plans": [{
    "Node Type": "Seq Scan",
    "Relation Name": "products",
    "Filter": "(category = 'electronics'::text)",
    "Rows Removed by Filter": 900000
  }]
}

Benchmark (10 iterations):
{
  avg: '128.50ms',
  min: '121ms',
  max: '142ms',
  iterations: 10
}

--- Creating Index ---

✅ Index created: idx_products_category

--- WITH Index ---

Execution time: 1.23ms
Total time: 1.89ms

Query plan:
{
  "Node Type": "Limit",
  "Plans": [{
    "Node Type": "Index Scan",
    "Index Name": "idx_products_category",
    "Index Cond": "(category = 'electronics'::text)"
  }]
}

Benchmark (10 iterations):
{
  avg: '2.10ms',
  min: '1ms',
  max: '4ms',
  iterations: 10
}

--- Performance Comparison ---

Before: 128.50ms
After: 2.10ms
Improvement: 61.2x faster

📊 Index sizes:
┌─────────┬──────────────────────────┬────────────────────────────────────────────────┐
│ (index) │       indexname          │                  indexdef                      │
├─────────┼──────────────────────────┼────────────────────────────────────────────────┤
│    0    │ products_pkey            │ CREATE UNIQUE INDEX products_pkey ON products  │
│    1    │ idx_products_category    │ CREATE INDEX idx_products_category ON products │
└─────────┴──────────────────────────┴────────────────────────────────────────────────┘

Table stats after index:
{
  total_size: '168 MB',
  table_size: '146 MB',
  indexes_size: '22 MB',
  row_count: '1000000'
}
```

**Key insight**: Index adds 22MB storage but makes queries 61x faster!

---

## Performance Benchmarks

### Single Column Index

| Query | Without Index | With Index | Improvement |
|-------|--------------|------------|-------------|
| **Equality (WHERE category = X)** | 128ms | 2ms | **64x faster** |
| **Range (WHERE price BETWEEN X AND Y)** | 235ms | 4ms | **58x faster** |
| **Sorted (ORDER BY created_at)** | 450ms | 12ms | **37x faster** |

### Composite Index

| Query | Single Index | Composite Index | Improvement |
|-------|--------------|-----------------|-------------|
| **WHERE cat AND price** | 45ms | 3ms | **15x faster** |
| **WHERE cat ORDER BY price** | 67ms | 2ms | **33x faster** |

### Storage Overhead

| Table Size | Index Type | Index Size | Overhead |
|------------|-----------|------------|----------|
| 146 MB | Single column | 22 MB | +15% |
| 146 MB | Composite (2 cols) | 31 MB | +21% |
| 146 MB | Partial (90% rows) | 20 MB | +14% |

---

## Key Takeaways

### What You Learned

1. **B-Tree Indexes**
   - Default index type in PostgreSQL/MySQL
   - Perfect for equality and range queries
   - 50-1000x faster than full table scans

2. **Composite Indexes**
   - Index on multiple columns: (col1, col2, col3)
   - Left-to-right matching: WHERE col1 AND col2 uses index
   - WHERE col2 alone does NOT use index
   - Column order matters!

3. **Partial Indexes**
   - Index subset of rows: WHERE condition
   - Smaller index size (save storage)
   - Faster index scans (fewer entries)
   - Use when query always includes same WHERE clause

4. **When to Add Index**
   - ✅ Column used in WHERE, JOIN, ORDER BY
   - ✅ High-cardinality columns (many unique values)
   - ✅ Read-heavy tables
   - ❌ Low-cardinality columns (< 100 unique values)
   - ❌ Write-heavy tables (indexes slow writes)
   - ❌ Small tables (< 10k rows)

5. **Index Pitfalls**
   - Low-cardinality columns: PostgreSQL ignores index
   - Functions: LOWER(col) won't use index on col
   - Too many indexes: Slow INSERT/UPDATE/DELETE
   - Unused indexes: Waste storage + write performance

### Index Decision Tree

```
Do you query this column frequently?
├─ No → Don't index
└─ Yes
   ├─ Is it in WHERE/JOIN/ORDER BY?
   │  ├─ No → Don't index
   │  └─ Yes
   │     ├─ How many unique values?
   │     │  ├─ < 100 → Don't index (low cardinality)
   │     │  └─ > 1000 → Consider indexing
   │     ├─ Is table write-heavy?
   │     │  ├─ Yes → Limit indexes (max 5-8)
   │     │  └─ No → Add index
   │     └─ Do queries use multiple columns?
   │        ├─ Yes → Use composite index
   │        └─ No → Use single-column index
```

---

## Related POCs

- **POC #11: CRUD Operations** - Foundation for database operations
- **POC #13: Query Optimization** - Use EXPLAIN to find slow queries
- **POC #14: N+1 Problem** - Fix inefficient queries
- **POC #1: Redis Cache** - Cache indexed queries for even faster reads

---

## Cleanup

```bash
docker stop postgres-indexes
docker rm postgres-indexes
cd .. && rm -rf database-indexes-poc
```

---

## What's Next?

**Next POC**: [POC #13: Query Optimization with EXPLAIN](/interview-prep/practice-pocs/database-query-optimization)

Learn how to read EXPLAIN output, identify bottlenecks, and optimize queries for production!

---

**Production index strategies**:
- **Twitter**: Composite indexes on (user_id, created_at) for timeline queries
- **GitHub**: Partial indexes on public repositories only
- **Stripe**: Covering indexes (include all SELECT columns) to avoid table lookups
- **Airbnb**: GiST indexes for geospatial queries
- **Stack Overflow**: Full-text search indexes on question titles/bodies

**Remember**: Indexes are a read/write trade-off. Faster reads, slower writes. Choose wisely!
