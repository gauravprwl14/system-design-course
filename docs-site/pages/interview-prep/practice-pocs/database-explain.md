# POC #14: Master EXPLAIN - Read Query Plans Like a Pro

## What You'll Build

Learn to **read and optimize PostgreSQL query plans** using EXPLAIN:
- ✅ **EXPLAIN ANALYZE** - Understand execution plans
- ✅ **Seq Scan vs Index Scan** - When each is used
- ✅ **Cost estimation** - Read PostgreSQL costs
- ✅ **Query optimization** - Fix slow queries
- ✅ **Real examples** - From 500ms to 5ms

**Time to complete**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate
**Prerequisites**: POC #12 (Indexes)

---

## Why This Matters

**Real-World Usage**: Every major company uses EXPLAIN to optimize queries:

- **Twitter**: Optimized timeline queries from 800ms to 50ms
- **Uber**: Reduced trip query time from 1.2s to 80ms
- **Airbnb**: Improved search queries from 3s to 200ms

### The Problem

You have a slow query but don't know why:

```sql
-- Takes 2 seconds!
SELECT * FROM orders
WHERE user_id = 12345
  AND status = 'delivered'
  AND created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 100;
```

**Questions**:
- Is it using an index?
- Which index?
- Is it scanning too many rows?
- Is the sort expensive?

**Solution**: Use EXPLAIN!

---

## Understanding EXPLAIN Output

### Basic EXPLAIN

```sql
EXPLAIN
SELECT * FROM users WHERE email = 'alice@example.com';
```

**Output**:
```
Seq Scan on users  (cost=0.00..18334.00 rows=1 width=128)
  Filter: (email = 'alice@example.com'::text)
```

**Translation**:
- **Seq Scan**: Scanning entire table (slow!)
- **cost=0.00..18334.00**: Estimated cost (startup..total)
- **rows=1**: Expected rows returned
- **width=128**: Average row size in bytes

### With Index

```sql
CREATE INDEX idx_users_email ON users(email);

EXPLAIN
SELECT * FROM users WHERE email = 'alice@example.com';
```

**Output**:
```
Index Scan using idx_users_email on users  (cost=0.42..8.44 rows=1 width=128)
  Index Cond: (email = 'alice@example.com'::text)
```

**Translation**:
- **Index Scan**: Using index (fast!)
- **cost=0.42..8.44**: Much lower cost (2175x cheaper!)
- Using idx_users_email index

---

## Quick EXPLAIN Reference

### Node Types

| Node | Meaning | Speed |
|------|---------|-------|
| **Seq Scan** | Full table scan | 🐌 Slowest |
| **Index Scan** | Binary search on index | 🚀 Fast |
| **Index Only Scan** | Data from index (no table lookup) | ⚡ Fastest |
| **Bitmap Index Scan** | Scan multiple index entries | 🏃 Medium |
| **Nested Loop** | JOIN using loops | 🐌 Slow for large tables |
| **Hash Join** | JOIN using hash table | 🚀 Fast for large tables |
| **Merge Join** | JOIN on sorted data | 🏃 Medium |

### Cost Interpretation

```
cost=START..TOTAL
```

- **START**: Cost to retrieve first row
- **TOTAL**: Cost to retrieve all rows
- **Units**: Arbitrary (page reads, CPU time)
- **Lower is better**

**Rules of thumb**:
- cost < 100: Fast
- cost 100-1000: Okay
- cost > 10000: Slow, needs optimization

---

## Step-by-Step Build

### Setup

```bash
mkdir explain-poc && cd explain-poc
npm init -y && npm install pg
```

### Schema

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(50),
  age INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total DECIMAL(10,2),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Load 100k users
INSERT INTO users (email, username, age)
SELECT
  'user' || i || '@example.com',
  'user' || i,
  20 + (i % 60)
FROM generate_series(1, 100000) i;

-- Load 500k orders
INSERT INTO orders (user_id, total, status, created_at)
SELECT
  (random() * 99999 + 1)::int,
  (random() * 1000)::decimal(10,2),
  CASE (random() * 3)::int
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'processing'
    WHEN 2 THEN 'shipped'
    ELSE 'delivered'
  END,
  NOW() - (random() * INTERVAL '365 days')
FROM generate_series(1, 500000) i;
```

### EXPLAIN Demo (`explain.js`)

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'explain_demo',
  user: 'postgres',
  password: 'password'
});

async function explain(query, params = []) {
  const result = await pool.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
    params
  );

  const plan = result.rows[0]['QUERY PLAN'][0];

  console.log('\n' + '='.repeat(60));
  console.log('Query:', query.substring(0, 80) + '...');
  console.log('='.repeat(60));
  console.log(`Execution Time: ${plan['Execution Time'].toFixed(2)}ms`);
  console.log(`Planning Time: ${plan['Planning Time'].toFixed(2)}ms`);
  console.log(`Total Time: ${(plan['Execution Time'] + plan['Planning Time']).toFixed(2)}ms`);
  console.log('\nExecution Plan:');
  printPlan(plan.Plan, 0);
  console.log('='.repeat(60) + '\n');
}

function printPlan(plan, indent = 0) {
  const prefix = '  '.repeat(indent);

  console.log(`${prefix}→ ${plan['Node Type']}`);

  if (plan['Relation Name']) {
    console.log(`${prefix}  Table: ${plan['Relation Name']}`);
  }

  if (plan['Index Name']) {
    console.log(`${prefix}  Index: ${plan['Index Name']}`);
  }

  console.log(`${prefix}  Cost: ${plan['Total Cost'].toFixed(2)}`);
  console.log(`${prefix}  Rows: ${plan['Actual Rows']} (estimated: ${plan['Plan Rows']})`);
  console.log(`${prefix}  Time: ${plan['Actual Total Time'].toFixed(2)}ms`);

  if (plan['Filter']) {
    console.log(`${prefix}  Filter: ${plan['Filter']}`);
  }

  if (plan['Index Cond']) {
    console.log(`${prefix}  Index Cond: ${plan['Index Cond']}`);
  }

  if (plan['Plans']) {
    plan['Plans'].forEach(subPlan => {
      printPlan(subPlan, indent + 1);
    });
  }
}

async function demo() {
  console.log('\n🔍 EXPLAIN Demo\n');

  // Example 1: Seq Scan vs Index Scan
  console.log('Example 1: Full Table Scan');
  await explain("SELECT * FROM users WHERE email = 'user50000@example.com'");

  console.log('Creating index...');
  await pool.query('CREATE INDEX idx_users_email ON users(email)');

  console.log('\nExample 1b: With Index');
  await explain("SELECT * FROM users WHERE email = 'user50000@example.com'");

  // Example 2: Range Query
  console.log('\nExample 2: Range Query (needs index)');
  await explain('SELECT * FROM orders WHERE created_at > NOW() - INTERVAL \'30 days\'');

  console.log('Creating index on created_at...');
  await pool.query('CREATE INDEX idx_orders_created_at ON orders(created_at)');

  console.log('\nExample 2b: Range Query with Index');
  await explain('SELECT * FROM orders WHERE created_at > NOW() - INTERVAL \'30 days\'');

  // Example 3: JOIN
  console.log('\nExample 3: JOIN (inefficient)');
  await explain(`
    SELECT u.username, COUNT(o.id) as order_count
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.age > 50
    GROUP BY u.id, u.username
    LIMIT 10
  `);

  console.log('Creating indexes for JOIN...');
  await pool.query('CREATE INDEX idx_users_age ON users(age)');
  await pool.query('CREATE INDEX idx_orders_user_id ON orders(user_id)');

  console.log('\nExample 3b: JOIN with Indexes');
  await explain(`
    SELECT u.username, COUNT(o.id) as order_count
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.age > 50
    GROUP BY u.id, u.username
    LIMIT 10
  `);

  await pool.end();
}

demo().catch(console.error);
```

---

## Run It

```bash
# Start PostgreSQL
docker run -d --name postgres-explain -e POSTGRES_PASSWORD=password -e POSTGRES_DB=explain_demo -p 5432:5432 postgres:15-alpine

# Load data
psql -h localhost -U postgres -d explain_demo -f schema.sql

# Run demo
node explain.js
```

---

## Common Patterns to Optimize

### Pattern 1: Missing Index

**EXPLAIN shows**:
```
Seq Scan on orders (cost=0.00..12500.00)
  Filter: (status = 'delivered')
```

**Fix**: Add index
```sql
CREATE INDEX idx_orders_status ON orders(status);
```

### Pattern 2: Unused Index

**EXPLAIN shows**:
```
Seq Scan on products (cost=0.00..8500.00)
  Filter: (LOWER(name) = 'laptop')
```

**Fix**: Functional index
```sql
CREATE INDEX idx_products_name_lower ON products(LOWER(name));
```

### Pattern 3: Expensive Sort

**EXPLAIN shows**:
```
Sort  (cost=5000.00..5500.00)
  Sort Key: created_at DESC
  -> Seq Scan on orders
```

**Fix**: Index on sort column
```sql
CREATE INDEX idx_orders_created_at_desc ON orders(created_at DESC);
```

### Pattern 4: Slow JOIN

**EXPLAIN shows**:
```
Nested Loop  (cost=0.00..50000.00)
  -> Seq Scan on users
  -> Seq Scan on orders
```

**Fix**: Index foreign keys
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

---

## EXPLAIN Checklist

When analyzing slow queries:

1. ✅ **Check node types**: Seq Scan = bad, Index Scan = good
2. ✅ **Check row estimates**: If "Actual Rows" >> "Plan Rows", stats are stale
3. ✅ **Check costs**: Look for nodes with cost > 10000
4. ✅ **Check filters**: Rows removed by filter = wasted work
5. ✅ **Check indexes**: Are the right indexes being used?
6. ✅ **Check joins**: Nested Loop on large tables = slow

---

## Key Takeaways

1. **Always use EXPLAIN ANALYZE** - Shows actual vs estimated performance
2. **Seq Scan ≠ Always Bad** - For small tables (<1000 rows), seq scan is fine
3. **Index Scan ≠ Always Good** - If scanning >30% of table, seq scan is faster
4. **Cost is relative** - Compare before/after, not absolute numbers
5. **ANALYZE tables** - Keeps statistics fresh for query planner

---

## Related POCs

- **POC #12: Indexes** - Create the right indexes
- **POC #13: N+1 Problem** - Fix inefficient queries
- **POC #11: CRUD** - Foundation

---

## Cleanup

```bash
docker stop postgres-explain && docker rm postgres-explain
rm -rf explain-poc
```

---

**Production tips**:
- **Twitter**: Uses EXPLAIN to optimize every slow query (>100ms)
- **Uber**: Auto-logs EXPLAIN for queries >500ms
- **Airbnb**: CI/CD fails if new queries lack proper indexes

**Remember**: EXPLAIN is your best friend for query optimization!
