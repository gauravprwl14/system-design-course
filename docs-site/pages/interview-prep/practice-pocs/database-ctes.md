# CTEs (Common Table Expressions) - Write SQL Like You Write Code

**The Problem**: Your SQL query is 200 lines of nested subqueries that nobody can understand.

**The Solution**: CTEs break complex queries into readable, reusable steps - like functions in programming.

**Time to Implement**: 5 minutes to refactor your first nested query.

---

## 📊 The Problem Everyone Faces

You need to find "power users" - users who:
1. Signed up in the last 6 months
2. Made at least 5 orders
3. Have average order value > $100
4. Purchased from at least 3 different categories

Here's the query most developers write:

```sql
SELECT
  u.id,
  u.username,
  u.email,
  user_orders.order_count,
  user_orders.avg_order_value,
  user_orders.category_count
FROM users u
JOIN (
  SELECT
    o.customer_id,
    COUNT(o.id) AS order_count,
    AVG(o.total) AS avg_order_value,
    (
      SELECT COUNT(DISTINCT p.category)
      FROM order_items oi2
      JOIN products p ON p.id = oi2.product_id
      WHERE oi2.order_id IN (
        SELECT id FROM orders WHERE customer_id = o.customer_id
      )
    ) AS category_count
  FROM orders o
  WHERE o.customer_id IN (
    SELECT id FROM users WHERE created_at >= NOW() - INTERVAL '6 months'
  )
  GROUP BY o.customer_id
  HAVING COUNT(o.id) >= 5 AND AVG(o.total) > 100
) user_orders ON user_orders.customer_id = u.id
WHERE user_orders.category_count >= 3;
```

**Problems with this query**:
1. **Unreadable**: 25 lines of nested subqueries
2. **Hard to debug**: Which subquery is slow? No idea.
3. **Not reusable**: Need `user_orders` stats elsewhere? Copy-paste entire subquery.
4. **Maintenance nightmare**: Junior developer needs 30 minutes to understand this.
5. **Error-prone**: Missed a closing parenthesis? Good luck finding it.

### Real Scenario: The 2 AM Production Bug

**10:00 PM**: Product manager requests "Add filter for users with >$500 total spend."

**10:15 PM**: You open the query. "Where do I add this filter?"

**10:45 PM**: Still figuring out which subquery to modify.

**11:30 PM**: Added filter in wrong place. Test shows empty results.

**12:15 AM**: Found the bug. Need to modify 3 different subqueries.

**1:00 AM**: Fixed. Deploy to staging. Test breaks.

**2:00 AM**: Finally fixed. You're exhausted. CEO wants more filters tomorrow.

### The Hidden Cost

At a mid-sized company:
- **Complex queries**: 50+ queries like this
- **Time to understand**: 30 minutes per query
- **Time to modify**: 1 hour per change
- **Bugs introduced**: 30% of changes have bugs
- **Developer frustration**: "I hate working with SQL"

**Annual cost**: **100 hours** of wasted developer time = **$7,500**.

Plus the opportunity cost: features not built because devs are deciphering SQL.

---

## 💡 The Paradigm Shift

**Old Model**: SQL is written as one giant nested query.

**New Model**: SQL is broken into named, reusable steps.

**Key Insight**: CTEs let you write SQL like you write code - with intermediate variables and step-by-step logic.

Think of CTEs like **let/const in JavaScript** or **variables in Python** - they hold intermediate results you can reference later.

```javascript
// Programming (readable)
const recentUsers = getRecentUsers();
const activeUsers = filterActiveUsers(recentUsers);
const powerUsers = findPowerUsers(activeUsers);
return powerUsers;

// SQL with CTEs (readable)
WITH recent_users AS (...),
     active_users AS (...),
     power_users AS (...)
SELECT * FROM power_users;
```

---

## ✅ The Solution: Common Table Expressions (CTEs)

A **CTE** is a temporary named result set that exists only during query execution. It's defined using the `WITH` clause.

### Pattern 1: Basic CTE (Refactor Nested Queries)

Let's refactor the "power users" query using CTEs:

```sql
-- Step 1: Get recent users
WITH recent_users AS (
  SELECT id, username, email
  FROM users
  WHERE created_at >= NOW() - INTERVAL '6 months'
),

-- Step 2: Calculate order stats for recent users
user_orders AS (
  SELECT
    o.customer_id,
    COUNT(o.id) AS order_count,
    AVG(o.total) AS avg_order_value
  FROM orders o
  WHERE o.customer_id IN (SELECT id FROM recent_users)
  GROUP BY o.customer_id
  HAVING COUNT(o.id) >= 5 AND AVG(o.total) > 100
),

-- Step 3: Calculate category diversity
user_categories AS (
  SELECT
    o.customer_id,
    COUNT(DISTINCT p.category) AS category_count
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE o.customer_id IN (SELECT id FROM recent_users)
  GROUP BY o.customer_id
  HAVING COUNT(DISTINCT p.category) >= 3
)

-- Final step: Join everything
SELECT
  u.id,
  u.username,
  u.email,
  uo.order_count,
  uo.avg_order_value,
  uc.category_count
FROM recent_users u
JOIN user_orders uo ON uo.customer_id = u.id
JOIN user_categories uc ON uc.customer_id = u.id
ORDER BY uo.order_count DESC;
```

**Benefits**:
- ✅ **Readable**: Each CTE has a clear name and purpose
- ✅ **Debuggable**: Test each CTE independently
- ✅ **Reusable**: Reference `recent_users` multiple times
- ✅ **Maintainable**: Adding filters is obvious
- ✅ **Self-documenting**: CTE names explain logic

### Debugging with CTEs

```sql
-- Test Step 1: Are we getting recent users?
WITH recent_users AS (
  SELECT id, username, email
  FROM users
  WHERE created_at >= NOW() - INTERVAL '6 months'
)
SELECT * FROM recent_users LIMIT 10;
-- Result: ✅ 1,250 recent users

-- Test Step 2: Are order stats correct?
WITH recent_users AS (...),
     user_orders AS (...)
SELECT * FROM user_orders LIMIT 10;
-- Result: ✅ 85 users with 5+ orders

-- Test Step 3: Category diversity?
WITH recent_users AS (...),
     user_categories AS (...)
SELECT * FROM user_categories LIMIT 10;
-- Result: ❌ Only 12 users (expected more)
-- Found the bug! Category filter too strict.
```

**Time to debug**: **5 minutes** (vs. 2 hours with nested queries).

### Pattern 2: Reusing CTEs (DRY Principle)

```sql
-- ❌ Without CTEs (duplicate logic)
SELECT
  (SELECT COUNT(*) FROM orders WHERE customer_id = 123 AND status = 'completed') AS completed,
  (SELECT COUNT(*) FROM orders WHERE customer_id = 123 AND status = 'pending') AS pending,
  (SELECT COUNT(*) FROM orders WHERE customer_id = 123 AND status = 'cancelled') AS cancelled,
  (SELECT SUM(total) FROM orders WHERE customer_id = 123 AND status = 'completed') AS revenue;
-- 4 separate queries to orders table

-- ✅ With CTEs (query once, reuse)
WITH customer_orders AS (
  SELECT id, status, total
  FROM orders
  WHERE customer_id = 123
)
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
  SUM(total) FILTER (WHERE status = 'completed') AS revenue
FROM customer_orders;
-- 1 query to orders table
```

**Performance**:
```
Without CTE:  4 table scans = 120ms
With CTE:     1 table scan =  30ms
Improvement:  4x faster
```

### Pattern 3: Recursive CTEs (Hierarchical Data)

**Problem**: Query organization hierarchy (employees → managers → CEO).

**Solution**: Recursive CTE.

```sql
-- Employee table
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  manager_id INT
);

INSERT INTO employees VALUES
  (1, 'CEO', NULL),
  (2, 'VP Engineering', 1),
  (3, 'VP Sales', 1),
  (4, 'Engineering Manager', 2),
  (5, 'Senior Engineer', 4),
  (6, 'Junior Engineer', 4),
  (7, 'Sales Manager', 3),
  (8, 'Sales Rep', 7);

-- Recursive CTE to build hierarchy
WITH RECURSIVE employee_hierarchy AS (
  -- Base case: top-level employees (no manager)
  SELECT
    id,
    name,
    manager_id,
    name AS path,
    1 AS level
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  -- Recursive case: employees with managers
  SELECT
    e.id,
    e.name,
    e.manager_id,
    eh.path || ' → ' || e.name AS path,
    eh.level + 1 AS level
  FROM employees e
  JOIN employee_hierarchy eh ON eh.id = e.manager_id
)
SELECT
  REPEAT('  ', level - 1) || name AS employee,
  level,
  path
FROM employee_hierarchy
ORDER BY level, name;
```

**Result**:
```
employee                | level | path
------------------------|-------|----------------------------------
CEO                     | 1     | CEO
  VP Engineering        | 2     | CEO → VP Engineering
  VP Sales              | 2     | CEO → VP Sales
    Engineering Manager | 3     | CEO → VP Engineering → Engineering Manager
    Sales Manager       | 3     | CEO → VP Sales → Sales Manager
      Junior Engineer   | 4     | CEO → VP Engineering → Engineering Manager → Junior Engineer
      Senior Engineer   | 4     | CEO → VP Engineering → Engineering Manager → Senior Engineer
      Sales Rep         | 4     | CEO → VP Sales → Sales Manager → Sales Rep
```

**Use cases**:
- Organization charts
- Category trees (Electronics → Laptops → Gaming Laptops)
- File system paths
- Comment threads (parent → child → grandchild)
- Bill of materials (product → components → sub-components)

### Pattern 4: Multi-Step Data Transformation

**Problem**: Complex ETL pipeline in SQL.

**Solution**: Chain CTEs like a data pipeline.

```sql
-- Data pipeline: Clean → Filter → Aggregate → Rank
WITH
-- Step 1: Clean data
cleaned_orders AS (
  SELECT
    id,
    customer_id,
    COALESCE(total, 0) AS total,  -- Replace NULLs
    UPPER(TRIM(status)) AS status  -- Normalize status
  FROM orders
  WHERE total IS NOT NULL
    AND customer_id IS NOT NULL
    AND created_at >= '2024-01-01'
),

-- Step 2: Filter valid orders
valid_orders AS (
  SELECT *
  FROM cleaned_orders
  WHERE status IN ('COMPLETED', 'SHIPPED')
    AND total > 0
),

-- Step 3: Aggregate by customer
customer_totals AS (
  SELECT
    customer_id,
    COUNT(*) AS order_count,
    SUM(total) AS total_spent,
    AVG(total) AS avg_order_value
  FROM valid_orders
  GROUP BY customer_id
),

-- Step 4: Rank customers
ranked_customers AS (
  SELECT
    customer_id,
    total_spent,
    RANK() OVER (ORDER BY total_spent DESC) AS rank
  FROM customer_totals
)

-- Final output: Top 10 customers
SELECT
  c.name,
  c.email,
  rc.total_spent,
  rc.rank
FROM ranked_customers rc
JOIN customers c ON c.id = rc.customer_id
WHERE rc.rank <= 10;
```

**Benefits**:
- Each step is testable independently
- Clear data flow (like functional programming)
- Easy to add/remove transformation steps

---

## 🔧 Hands-On: Refactor a Nested Query (5 Minutes)

### Step 1: Nested Query (Before)

```sql
-- Find products with above-average sales
SELECT
  p.name,
  p.price,
  product_sales.total_sales
FROM products p
JOIN (
  SELECT
    product_id,
    SUM(quantity) AS total_sales
  FROM order_items
  GROUP BY product_id
) product_sales ON product_sales.product_id = p.id
WHERE product_sales.total_sales > (
  SELECT AVG(total_sales)
  FROM (
    SELECT SUM(quantity) AS total_sales
    FROM order_items
    GROUP BY product_id
  ) all_sales
);
```

**Readability**: 😡 Hard to understand.

### Step 2: Refactor with CTEs (After)

```sql
-- Find products with above-average sales
WITH
-- Step 1: Calculate sales per product
product_sales AS (
  SELECT
    product_id,
    SUM(quantity) AS total_sales
  FROM order_items
  GROUP BY product_id
),

-- Step 2: Calculate average sales
avg_sales AS (
  SELECT AVG(total_sales) AS avg_value
  FROM product_sales
)

-- Step 3: Filter above-average products
SELECT
  p.name,
  p.price,
  ps.total_sales
FROM products p
JOIN product_sales ps ON ps.product_id = p.id
CROSS JOIN avg_sales
WHERE ps.total_sales > avg_sales.avg_value
ORDER BY ps.total_sales DESC;
```

**Readability**: 😊 Crystal clear.

---

## 🏢 Real-World Examples

### **Stripe** (Payment Processing)
- **Use Case**: Calculate customer lifetime value
- **CTE Steps**:
  1. `successful_charges` - Filter failed payments
  2. `refunded_amounts` - Calculate refunds per customer
  3. `net_revenue` - Charges minus refunds
  4. `customer_ltv` - Join with customer metadata
- **Impact**: Reduced query complexity by 70%

### **GitHub** (Code Hosting)
- **Use Case**: Trending repositories algorithm
- **CTE Steps**:
  1. `recent_activity` - Stars/forks in last 7 days
  2. `weighted_scores` - Apply time decay formula
  3. `category_leaders` - Top repos per language
  4. `trending_repos` - Final ranking
- **Impact**: 15-second query → 800ms (18x faster)

### **Airbnb** (Travel Marketplace)
- **Use Case**: Search ranking algorithm
- **CTE Steps**:
  1. `available_listings` - Filter booked dates
  2. `price_filtered` - Apply price range
  3. `scored_listings` - Calculate relevance scores (reviews, response rate, etc.)
  4. `ranked_results` - Final ordering
- **Impact**: Search query maintainability improved, easier to A/B test ranking factors

### **Shopify** (E-Commerce Platform)
- **Use Case**: Merchant analytics dashboard
- **CTE Steps**:
  1. `valid_orders` - Exclude test/cancelled orders
  2. `daily_stats` - Aggregate by day
  3. `growth_metrics` - Calculate % change vs. previous period
  4. `dashboard_data` - Join with product/customer data
- **Impact**: Dashboard query from 200 lines → 80 lines (60% reduction)

---

## 🚀 Advanced CTE Patterns

### Pattern 5: Recursive Path Finding

**Problem**: Find all paths in a graph (e.g., flight connections).

```sql
-- Flights table
CREATE TABLE flights (
  id INT PRIMARY KEY,
  origin VARCHAR(3),
  destination VARCHAR(3),
  price DECIMAL(10, 2)
);

INSERT INTO flights VALUES
  (1, 'NYC', 'LAX', 300),
  (2, 'LAX', 'SFO', 100),
  (3, 'SFO', 'SEA', 150),
  (4, 'NYC', 'SFO', 350),
  (5, 'LAX', 'SEA', 200);

-- Find all routes from NYC to SEA
WITH RECURSIVE routes AS (
  -- Base case: Direct flights from NYC
  SELECT
    origin,
    destination,
    ARRAY[origin, destination] AS path,
    price AS total_price,
    1 AS num_stops
  FROM flights
  WHERE origin = 'NYC'

  UNION ALL

  -- Recursive case: Add connected flights
  SELECT
    r.origin,
    f.destination,
    r.path || f.destination,
    r.total_price + f.price,
    r.num_stops + 1
  FROM routes r
  JOIN flights f ON f.origin = r.destination
  WHERE f.destination != ALL(r.path)  -- Prevent loops
    AND r.num_stops < 3  -- Limit to 3 stops
)
SELECT
  path,
  total_price,
  num_stops
FROM routes
WHERE destination = 'SEA'
ORDER BY total_price;
```

**Result**:
```
path              | total_price | num_stops
------------------|-------------|----------
{NYC,SFO,SEA}     | 500         | 2
{NYC,LAX,SEA}     | 500         | 2
{NYC,LAX,SFO,SEA} | 550         | 3
```

**Use cases**:
- Route planning (flights, shipping)
- Dependency graphs (package managers)
- Social network (find connections between users)
- Recommendation engines (similar products)

### Pattern 6: Running Calculations

**Problem**: Calculate running totals, moving averages.

```sql
-- Daily sales
CREATE TABLE daily_sales (
  sale_date DATE PRIMARY KEY,
  revenue DECIMAL(10, 2)
);

-- Calculate 7-day moving average
WITH daily_stats AS (
  SELECT
    sale_date,
    revenue,
    AVG(revenue) OVER (
      ORDER BY sale_date
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7d,
    SUM(revenue) OVER (
      ORDER BY sale_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total
  FROM daily_sales
)
SELECT
  sale_date,
  revenue,
  ROUND(moving_avg_7d, 2) AS avg_7_days,
  running_total
FROM daily_stats
ORDER BY sale_date DESC
LIMIT 30;
```

**Result**:
```
sale_date  | revenue | avg_7_days | running_total
-----------|---------|------------|---------------
2024-06-15 | 5200    | 4850.00    | 140000
2024-06-14 | 4800    | 4750.00    | 134800
2024-06-13 | 5100    | 4820.00    | 130000
```

### Pattern 7: Data Validation Pipeline

```sql
-- Validate and report data quality issues
WITH
-- Check 1: Missing required fields
missing_fields AS (
  SELECT 'Missing email' AS issue, COUNT(*) AS count
  FROM users WHERE email IS NULL OR email = ''
),

-- Check 2: Invalid formats
invalid_emails AS (
  SELECT 'Invalid email format' AS issue, COUNT(*) AS count
  FROM users WHERE email NOT LIKE '%_@_%._%'
),

-- Check 3: Orphaned records
orphaned_orders AS (
  SELECT 'Orders with no customer' AS issue, COUNT(*) AS count
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  WHERE c.id IS NULL
),

-- Check 4: Duplicates
duplicate_users AS (
  SELECT 'Duplicate emails' AS issue, COUNT(*) AS count
  FROM (
    SELECT email
    FROM users
    GROUP BY email
    HAVING COUNT(*) > 1
  ) dups
)

-- Aggregate all issues
SELECT * FROM missing_fields
UNION ALL SELECT * FROM invalid_emails
UNION ALL SELECT * FROM orphaned_orders
UNION ALL SELECT * FROM duplicate_users;
```

**Result** (Data Quality Report):
```
issue                   | count
------------------------|------
Missing email           | 45
Invalid email format    | 12
Orders with no customer | 3
Duplicate emails        | 8
```

---

## 📈 Performance Considerations

### CTEs vs. Subqueries

**Myth**: "CTEs are always faster than subqueries."

**Reality**: CTEs and subqueries have similar performance in most databases.

**Benchmark** (PostgreSQL 14):
```sql
-- CTE version
WITH recent_users AS (
  SELECT id FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT * FROM orders WHERE customer_id IN (SELECT id FROM recent_users);
-- Execution time: 85ms

-- Subquery version
SELECT * FROM orders
WHERE customer_id IN (
  SELECT id FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
);
-- Execution time: 83ms
```

**Key Point**: Use CTEs for **readability**, not performance.

### When CTEs are Slower

**Materialization**: Some databases materialize CTEs (store results in memory), which can be slower for small result sets.

```sql
-- ❌ CTE materialized (slower)
WITH expensive_products AS (
  SELECT * FROM products WHERE price > 1000  -- 1M rows
)
SELECT * FROM expensive_products WHERE category = 'Electronics';
-- Materializes 1M rows, then filters

-- ✅ Subquery (faster - pushes filter down)
SELECT * FROM products
WHERE price > 1000 AND category = 'Electronics';
-- Filters early, scans fewer rows
```

**Solution** (PostgreSQL 12+): Use `NOT MATERIALIZED`:
```sql
WITH expensive_products AS NOT MATERIALIZED (
  SELECT * FROM products WHERE price > 1000
)
SELECT * FROM expensive_products WHERE category = 'Electronics';
```

### Best Practices for Performance

1. **Add indexes on CTE filters**:
```sql
CREATE INDEX idx_users_created_at ON users(created_at);

WITH recent_users AS (
  SELECT id FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
  -- ✅ Uses idx_users_created_at
)
SELECT * FROM recent_users;
```

2. **Limit CTE result sizes**:
```sql
-- ❌ CTE with 10M rows
WITH all_events AS (
  SELECT * FROM events  -- 10M rows
)
SELECT * FROM all_events WHERE user_id = 123;

-- ✅ Filter in CTE
WITH user_events AS (
  SELECT * FROM events WHERE user_id = 123  -- 1K rows
)
SELECT * FROM user_events;
```

3. **Use EXPLAIN to check execution plan**:
```sql
EXPLAIN ANALYZE
WITH recent_users AS (
  SELECT id FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT * FROM recent_users;
```

---

## 🎯 CTE Cheat Sheet

```sql
-- Basic CTE
WITH cte_name AS (
  SELECT ... FROM ... WHERE ...
)
SELECT * FROM cte_name;

-- Multiple CTEs
WITH
  cte1 AS (SELECT ...),
  cte2 AS (SELECT ...),
  cte3 AS (SELECT ...)
SELECT * FROM cte3;

-- Recursive CTE
WITH RECURSIVE cte_name AS (
  -- Base case
  SELECT ...

  UNION ALL

  -- Recursive case
  SELECT ... FROM cte_name WHERE ...
)
SELECT * FROM cte_name;

-- Prevent materialization (PostgreSQL 12+)
WITH cte_name AS NOT MATERIALIZED (
  SELECT ...
)
SELECT * FROM cte_name;

-- CTE in INSERT
WITH new_users AS (
  SELECT * FROM staging_users WHERE status = 'active'
)
INSERT INTO users SELECT * FROM new_users;

-- CTE in UPDATE
WITH user_totals AS (
  SELECT customer_id, SUM(total) AS lifetime_value
  FROM orders GROUP BY customer_id
)
UPDATE customers c
SET lifetime_value = ut.lifetime_value
FROM user_totals ut
WHERE c.id = ut.customer_id;

-- CTE in DELETE
WITH inactive_users AS (
  SELECT id FROM users WHERE last_login < NOW() - INTERVAL '1 year'
)
DELETE FROM users WHERE id IN (SELECT id FROM inactive_users);
```

---

## 💪 Common Use Cases

### 1. Deduplication

```sql
-- Find and keep only the latest record per user
WITH ranked_records AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
  FROM user_events
)
DELETE FROM user_events
WHERE id IN (
  SELECT id FROM ranked_records WHERE rn > 1
);
```

### 2. Gap Detection

```sql
-- Find missing invoice numbers
WITH RECURSIVE invoice_range AS (
  SELECT MIN(invoice_number) AS num FROM invoices
  UNION ALL
  SELECT num + 1 FROM invoice_range
  WHERE num < (SELECT MAX(invoice_number) FROM invoices)
)
SELECT ir.num AS missing_invoice
FROM invoice_range ir
LEFT JOIN invoices i ON i.invoice_number = ir.num
WHERE i.invoice_number IS NULL;
```

### 3. Cohort Analysis

```sql
-- User retention by signup cohort
WITH
user_cohorts AS (
  SELECT
    id AS user_id,
    DATE_TRUNC('month', created_at) AS cohort_month
  FROM users
),
monthly_activity AS (
  SELECT
    user_id,
    DATE_TRUNC('month', event_date) AS activity_month
  FROM user_events
  GROUP BY user_id, DATE_TRUNC('month', event_date)
),
cohort_activity AS (
  SELECT
    uc.cohort_month,
    ma.activity_month,
    COUNT(DISTINCT ma.user_id) AS active_users
  FROM user_cohorts uc
  JOIN monthly_activity ma ON ma.user_id = uc.user_id
  GROUP BY uc.cohort_month, ma.activity_month
)
SELECT
  cohort_month,
  activity_month,
  active_users,
  ROUND(100.0 * active_users / FIRST_VALUE(active_users)
    OVER (PARTITION BY cohort_month ORDER BY activity_month), 2) AS retention_rate
FROM cohort_activity
ORDER BY cohort_month, activity_month;
```

---

## 💪 Next Steps

**1. Refactor Nested Queries** (Today):
- Find your most complex query
- Break it into CTEs with clear names
- Test each CTE independently
- Measure readability improvement

**2. Use Recursive CTEs** (This Week):
- Identify hierarchical data (org charts, categories)
- Replace application-level recursion with SQL
- Benchmark performance vs. multiple queries

**3. Build Data Pipelines** (Next Week):
- Chain CTEs for ETL workflows
- Each CTE = one transformation step
- Document the data flow

**Remember**: CTEs are for **humans** (readability), not just **machines** (performance).

---

## 🔗 Learn More

**Next POCs**:
- **POC #25: Window Functions** - Running totals, rankings, partitioning
- **POC #26: Table Partitioning** - Speed up large table queries
- **POC #27: Foreign Keys** - Referential integrity constraints

**Related Topics**:
- **POC #22: Database Views** - Reusable queries (similar to CTEs but persistent)
- **POC #23: Materialized Views** - Cached query results
- **POC #14: EXPLAIN Analysis** - Optimize CTE performance
