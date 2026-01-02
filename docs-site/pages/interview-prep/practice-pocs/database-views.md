# Database Views - Eliminate 500 Lines of Duplicate SQL

**The Problem**: You're writing the same complex JOIN query in 15 different places across your codebase.

**The Solution**: Database views encapsulate complex queries into reusable "virtual tables" - reducing code by 80%.

**Time to Implement**: 5 minutes to create your first view.

---

## 📊 The Problem Everyone Faces

You're building a user dashboard that shows:
- Username
- Email
- Total orders
- Total spent
- Account status
- Last login date

Here's the query you need:

```sql
SELECT
  u.id,
  u.username,
  u.email,
  u.account_status,
  u.last_login,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON o.customer_id = u.id
WHERE u.deleted_at IS NULL
  AND u.email_verified = true
GROUP BY u.id, u.username, u.email, u.account_status, u.last_login
ORDER BY total_spent DESC;
```

**15 lines of SQL**. And you need this query in:
- User dashboard API endpoint
- Admin panel user list
- Monthly report generator
- Email campaign segmentation
- Analytics dashboard
- Customer support tool
- Billing system
- Fraud detection system

**Reality**: You copy-paste this query 15 times across your codebase.

### What Happens Next

**Month 1**: Product manager says "Add user's signup date to the dashboard."

You update... how many files? 15 files. One by one.

**Month 2**: Security audit says "Exclude deleted users from all queries."

You update... 15 files again. But you miss 2. Security vulnerability shipped to production.

**Month 3**: Performance issue. The query needs an index hint.

You update... 14 files (you can't find the 15th).

**Month 6**: New developer writes a similar query, but gets the JOIN conditions slightly wrong.

Result: Dashboard shows $5M in revenue. Actual revenue: $2.8M. CFO is confused. You're fixing bugs at 11 PM.

### The Hidden Cost

At a mid-sized SaaS company:
- **Complex query duplicated**: 15 times
- **Time to update all copies**: 2 hours per change
- **Updates per quarter**: 4 changes
- **Developer time wasted**: 8 hours/quarter = **32 hours/year**
- **Bugs from inconsistency**: 2 per quarter = **8 bugs/year**
- **Time debugging**: 4 hours per bug = **32 hours/year**

**Total annual cost**: **64 hours** × **$75/hour** = **$4,800**

Plus the revenue impact from wrong data shown to executives.

---

## 💡 The Paradigm Shift

**Old Model**: Every query is written from scratch using base tables.

**New Model**: Complex queries are encapsulated in views - query the view like it's a table.

**Key Insight**: A view is a **stored query** that looks like a table. You can SELECT from it, JOIN it, filter it - but the database executes the underlying query.

Think of views like **functions in programming** - write once, call everywhere.

```
Base Tables (users, orders)
  ↓
View (user_stats)
  ↓
Application Code (simple SELECT)
```

---

## ✅ The Solution: Database Views

A **view** is a virtual table defined by a SELECT query. It doesn't store data - it's a saved query you can reuse.

### Pattern 1: Simple View (Encapsulate Complex Queries)

Let's create a view for the user stats query:

```sql
-- Create view
CREATE VIEW user_stats AS
SELECT
  u.id,
  u.username,
  u.email,
  u.account_status,
  u.last_login,
  u.created_at,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON o.customer_id = u.id
WHERE u.deleted_at IS NULL
  AND u.email_verified = true
GROUP BY u.id, u.username, u.email, u.account_status, u.last_login, u.created_at;
```

**Now query it like a table**:

```sql
-- User dashboard (top 10 customers)
SELECT username, email, total_spent
FROM user_stats
ORDER BY total_spent DESC
LIMIT 10;

-- Admin panel (search by email)
SELECT *
FROM user_stats
WHERE email LIKE '%@example.com';

-- Analytics (users who never ordered)
SELECT username, email, last_login
FROM user_stats
WHERE total_orders = 0;

-- Billing (high-value customers)
SELECT username, email, total_spent
FROM user_stats
WHERE total_spent > 1000;
```

**Result**: 15 lines of complex SQL → **1 simple SELECT**.

### Benefits

**Before (without views)**:
- ❌ 15 copies of complex query
- ❌ 2 hours to update all copies
- ❌ 8 bugs/year from inconsistency
- ❌ New developers copy-paste incorrectly

**After (with views)**:
- ✅ 1 source of truth
- ✅ 2 minutes to update view definition
- ✅ Zero inconsistency bugs
- ✅ New developers can't get it wrong

### Pattern 2: Security Views (Row-Level Filtering)

**Problem**: Different user roles see different data.

**Solution**: Create role-specific views.

```sql
-- Base table (all users)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100),
  email VARCHAR(200),
  role VARCHAR(50),
  is_active BOOLEAN,
  salary DECIMAL(10, 2),
  ssn VARCHAR(11),
  created_at TIMESTAMPTZ
);

-- Public view (safe for all employees)
CREATE VIEW users_public AS
SELECT
  id,
  username,
  email,
  role,
  is_active,
  created_at
FROM users
WHERE is_active = true;
-- ✅ Excludes: salary, ssn, inactive users

-- HR view (includes salary, no SSN)
CREATE VIEW users_hr AS
SELECT
  id,
  username,
  email,
  role,
  is_active,
  salary,
  created_at
FROM users;
-- ✅ Includes: salary
-- ❌ Excludes: ssn

-- Admin view (full access)
CREATE VIEW users_admin AS
SELECT * FROM users;
```

**Grant permissions**:

```sql
-- Revoke direct table access
REVOKE ALL ON users FROM PUBLIC;

-- Grant view-specific access
GRANT SELECT ON users_public TO employee_role;
GRANT SELECT ON users_hr TO hr_role;
GRANT SELECT ON users_admin TO admin_role;
```

**Result**:
- ✅ Employees can't see salaries or SSNs
- ✅ HR can see salaries but not SSNs
- ✅ Admins have full access
- ✅ Enforced at database level (can't be bypassed)

**Real-world impact**:
- **GDPR compliance**: Developers can't accidentally log PII
- **HIPAA compliance**: PHI (Protected Health Information) hidden from non-medical staff
- **SOX compliance**: Financial data restricted to authorized users

### Pattern 3: Column Renaming & Transformation

**Problem**: Legacy table names are confusing or need transformation.

**Solution**: View provides clean interface.

```sql
-- Legacy table (bad column names)
CREATE TABLE tbl_usr_data (
  usr_id INT PRIMARY KEY,
  usr_nm VARCHAR(100),
  usr_eml VARCHAR(200),
  usr_crt_dt TIMESTAMPTZ,
  usr_upd_dt TIMESTAMPTZ,
  usr_del_flg BOOLEAN DEFAULT FALSE
);

-- Clean view
CREATE VIEW users_clean AS
SELECT
  usr_id AS id,
  usr_nm AS name,
  usr_eml AS email,
  usr_crt_dt AS created_at,
  usr_upd_dt AS updated_at,
  CASE
    WHEN usr_del_flg = FALSE THEN 'active'
    ELSE 'deleted'
  END AS status
FROM tbl_usr_data;
```

**Query the clean view**:

```sql
-- ✅ Clean, readable queries
SELECT id, name, email, status
FROM users_clean
WHERE status = 'active';

-- vs.

-- ❌ Ugly legacy queries
SELECT usr_id, usr_nm, usr_eml
FROM tbl_usr_data
WHERE usr_del_flg = FALSE;
```

**Result**: Application code uses clean column names while database keeps legacy format.

### Pattern 4: Join Simplification

**Problem**: You always join the same 3 tables together.

**Solution**: Create a view with the JOIN already done.

```sql
-- Base tables
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT,
  product_id INT,
  quantity INT,
  total DECIMAL(10, 2),
  created_at TIMESTAMPTZ
);

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  email VARCHAR(200)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  price DECIMAL(10, 2)
);

-- View with joins already done
CREATE VIEW order_details AS
SELECT
  o.id AS order_id,
  o.quantity,
  o.total,
  o.created_at AS order_date,
  c.id AS customer_id,
  c.name AS customer_name,
  c.email AS customer_email,
  p.id AS product_id,
  p.name AS product_name,
  p.price AS product_price
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = o.product_id;
```

**Query the view**:

```sql
-- ✅ Simple query (no JOINs needed)
SELECT customer_name, product_name, total
FROM order_details
WHERE order_date > NOW() - INTERVAL '7 days'
ORDER BY total DESC;

-- vs.

-- ❌ Complex query (3-way JOIN)
SELECT c.name, p.name, o.total
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = o.product_id
WHERE o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.total DESC;
```

**Result**: 40% less code in every query.

### Pattern 5: Aggregation Views

**Problem**: You need summary statistics everywhere.

**Solution**: Pre-aggregate in a view.

```sql
-- Product sales summary view
CREATE VIEW product_sales_summary AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  COUNT(o.id) AS times_ordered,
  SUM(o.quantity) AS total_quantity_sold,
  SUM(o.total) AS total_revenue,
  AVG(o.total) AS avg_order_value,
  MAX(o.created_at) AS last_ordered_at
FROM products p
LEFT JOIN orders o ON o.product_id = p.id
GROUP BY p.id, p.name;
```

**Query the view**:

```sql
-- Top selling products
SELECT product_name, total_revenue
FROM product_sales_summary
ORDER BY total_revenue DESC
LIMIT 10;

-- Products never ordered
SELECT product_name
FROM product_sales_summary
WHERE times_ordered = 0;

-- High-value products
SELECT product_name, avg_order_value
FROM product_sales_summary
WHERE avg_order_value > 100;
```

**Result**: Complex aggregations become simple SELECT statements.

---

## 🔧 Hands-On: Create Your First View (5 Minutes)

Let's create a practical view for a blog platform.

### Step 1: Create Base Tables

```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200),
  content TEXT,
  author_id INT,
  published_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT FALSE
);

CREATE TABLE authors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(200)
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INT,
  content TEXT,
  created_at TIMESTAMPTZ
);
```

### Step 2: Insert Sample Data

```sql
INSERT INTO authors (id, name, email) VALUES
  (1, 'Alice', 'alice@example.com'),
  (2, 'Bob', 'bob@example.com');

INSERT INTO posts (id, title, author_id, published_at, is_published) VALUES
  (1, 'Intro to SQL', 1, NOW() - INTERVAL '2 days', true),
  (2, 'Advanced Queries', 1, NOW() - INTERVAL '1 day', true),
  (3, 'Draft Post', 2, NULL, false);

INSERT INTO comments (post_id, content, created_at) VALUES
  (1, 'Great post!', NOW() - INTERVAL '1 day'),
  (1, 'Very helpful', NOW() - INTERVAL '12 hours'),
  (2, 'Thanks!', NOW() - INTERVAL '6 hours');
```

### Step 3: Create View

```sql
CREATE VIEW published_posts_with_stats AS
SELECT
  p.id,
  p.title,
  a.name AS author_name,
  a.email AS author_email,
  p.published_at,
  COUNT(c.id) AS comment_count
FROM posts p
JOIN authors a ON a.id = p.author_id
LEFT JOIN comments c ON c.post_id = p.id
WHERE p.is_published = true
GROUP BY p.id, p.title, a.name, a.email, p.published_at
ORDER BY p.published_at DESC;
```

### Step 4: Query the View

```sql
-- ✅ Simple query
SELECT title, author_name, comment_count
FROM published_posts_with_stats;
```

**Result**:
```
title             | author_name | comment_count
------------------|-------------|-------------
Advanced Queries  | Alice       | 1
Intro to SQL      | Alice       | 2
```

**Benefits**:
- ✅ Only published posts (draft excluded)
- ✅ Author info already joined
- ✅ Comment count pre-calculated
- ✅ 1 simple SELECT instead of complex JOIN + GROUP BY

---

## 🏢 Real-World Examples

### **GitHub** (Code Hosting)
- **View**: `repository_stats` (stars, forks, issues, PRs)
- **Why**: Same stats shown on repo page, trending page, search results, user profile
- **Impact**: 1 view definition → used in 20+ places

### **Stripe** (Payment Processing)
- **View**: `customer_lifetime_value` (total charges, refunds, net revenue)
- **Why**: Same calculation in dashboard, reports, billing, analytics
- **Impact**: Reduced billing query complexity by 70%

### **Salesforce** (CRM Platform)
- **View**: Custom "Report Types" are database views
- **Example**: "Accounts with Opportunities" view joins 5 tables
- **Impact**: Non-technical users can create reports without SQL knowledge

### **Netflix** (Streaming)
- **View**: `user_watch_history` (shows watched, progress, ratings)
- **Why**: Powers "Continue Watching", recommendations, billing (watch time quotas)
- **Impact**: 1 complex view → 15 different features

---

## 🚀 Advanced View Patterns

### Updatable Views

Some views support INSERT, UPDATE, DELETE operations:

```sql
-- Simple view (updatable)
CREATE VIEW active_users AS
SELECT id, username, email
FROM users
WHERE is_active = true;

-- ✅ This works (view is updatable)
UPDATE active_users SET email = 'new@example.com' WHERE id = 1;
-- Translates to: UPDATE users SET email = 'new@example.com' WHERE id = 1;
```

**When views are updatable**:
- ✅ Single base table
- ✅ No GROUP BY, DISTINCT, aggregates
- ✅ No JOIN (in most databases)

**When views are NOT updatable**:
- ❌ Multiple tables joined
- ❌ Aggregations (COUNT, SUM, etc.)
- ❌ DISTINCT, GROUP BY

**Solution for complex views**: Use `INSTEAD OF` triggers (PostgreSQL):

```sql
CREATE VIEW order_details AS
SELECT o.id, o.total, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id;

-- Make it updatable with trigger
CREATE FUNCTION update_order_details()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET total = NEW.total WHERE id = NEW.id;
  UPDATE customers SET name = NEW.name WHERE id = (SELECT customer_id FROM orders WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_details_update
INSTEAD OF UPDATE ON order_details
FOR EACH ROW
EXECUTE FUNCTION update_order_details();
```

### Recursive Views (PostgreSQL 8.4+)

```sql
-- Organization hierarchy
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  manager_id INT
);

-- Recursive view (employee + all their reports)
CREATE VIEW employee_hierarchy AS
WITH RECURSIVE hierarchy AS (
  -- Base case: top-level employees
  SELECT id, name, manager_id, 1 AS level
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  -- Recursive case: employees reporting to previous level
  SELECT e.id, e.name, e.manager_id, h.level + 1
  FROM employees e
  JOIN hierarchy h ON h.id = e.manager_id
)
SELECT * FROM hierarchy;
```

**Query it**:

```sql
-- Show full org chart
SELECT
  REPEAT('  ', level - 1) || name AS employee
FROM employee_hierarchy
ORDER BY level, name;
```

**Result**:
```
employee
-----------
CEO
  VP Engineering
    Engineering Manager
      Software Engineer
  VP Sales
    Sales Manager
```

---

## 📈 Performance Considerations

### Views are NOT Cached

**Key Understanding**: Views are **query macros**, not cached data.

```sql
-- This view
CREATE VIEW user_stats AS
SELECT u.id, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.customer_id = u.id
GROUP BY u.id;

-- Querying the view
SELECT * FROM user_stats;

-- Executes this query EVERY TIME:
SELECT u.id, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.customer_id = u.id
GROUP BY u.id;
```

**Performance Impact**:
- ✅ Always fresh data (no staleness)
- ❌ No performance improvement (same query cost)

### When Views are Fast

Views improve **developer productivity**, not query performance:

**✅ Use views when**:
- Query is already fast (< 100ms)
- You need consistency across codebase
- You want to simplify complex JOINs
- You need row-level security

**❌ Don't use views when**:
- Query is slow (> 1 second)
- Data rarely changes
- You need query result caching

**Solution for slow queries**: Use **Materialized Views** (POC #23).

### View Query Planning

The database can optimize queries involving views:

```sql
-- View definition
CREATE VIEW active_users AS
SELECT * FROM users WHERE is_active = true;

-- Your query
SELECT * FROM active_users WHERE email = 'user@example.com';

-- Database executes (optimized):
SELECT * FROM users
WHERE is_active = true AND email = 'user@example.com';
-- ✅ Can use index on (is_active, email)
```

The database merges the view condition with your WHERE clause for efficient execution.

---

## 🎯 View Cheat Sheet

```sql
-- Create view
CREATE VIEW view_name AS
SELECT ... FROM ... WHERE ...;

-- Replace view
CREATE OR REPLACE VIEW view_name AS
SELECT ... FROM ... WHERE ...;

-- Drop view
DROP VIEW view_name;

-- Drop if exists
DROP VIEW IF EXISTS view_name;

-- Show view definition (PostgreSQL)
\d+ view_name

-- Show view definition (MySQL)
SHOW CREATE VIEW view_name;

-- Show view definition (SQL standard)
SELECT definition FROM information_schema.views
WHERE table_name = 'view_name';

-- List all views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public';

-- Grant permissions
GRANT SELECT ON view_name TO role_name;
```

---

## 💪 Common Use Cases

### 1. Reporting Dashboard

**Problem**: Analytics dashboard needs same complex query in 10 widgets.

**Solution**:
```sql
CREATE VIEW daily_sales_summary AS
SELECT
  DATE(created_at) AS sale_date,
  COUNT(*) AS order_count,
  SUM(total) AS revenue,
  AVG(total) AS avg_order_value
FROM orders
GROUP BY DATE(created_at);
```

**Usage**:
```sql
-- Widget 1: Last 7 days revenue
SELECT SUM(revenue) FROM daily_sales_summary
WHERE sale_date > CURRENT_DATE - 7;

-- Widget 2: Best sales day
SELECT sale_date, revenue FROM daily_sales_summary
ORDER BY revenue DESC LIMIT 1;

-- Widget 3: Average daily orders
SELECT AVG(order_count) FROM daily_sales_summary;
```

### 2. Multi-Tenant Filtering

**Problem**: SaaS app must filter by `tenant_id` in every query.

**Solution**:
```sql
-- Instead of giving access to base table
CREATE VIEW my_tenant_orders AS
SELECT * FROM orders
WHERE tenant_id = current_setting('app.current_tenant_id')::INT;

-- Set tenant context in application
SET app.current_tenant_id = 123;

-- Query view (tenant_id filter automatic)
SELECT * FROM my_tenant_orders;
```

**Result**: Impossible to accidentally leak data between tenants.

### 3. API Version Compatibility

**Problem**: New database schema, but old API version needs old column names.

**Solution**:
```sql
-- New table (renamed columns)
CREATE TABLE users_v2 (
  id INT PRIMARY KEY,
  full_name VARCHAR(200),
  email_address VARCHAR(200)
);

-- View for backward compatibility
CREATE VIEW users AS
SELECT
  id,
  full_name AS name,
  email_address AS email
FROM users_v2;
```

**Result**: Old application code keeps working while you migrate.

---

## 🔥 Before/After Comparison

### Scenario: E-Commerce Order Dashboard

**Without Views** (15 places with duplicate query):

```javascript
// orders-api.js
app.get('/orders', async (req, res) => {
  const result = await db.query(`
    SELECT o.id, o.total, c.name, c.email, p.name AS product
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    WHERE o.status = 'completed'
  `);
  res.json(result.rows);
});

// orders-report.js
async function generateReport() {
  const result = await db.query(`
    SELECT o.id, o.total, c.name, c.email, p.name AS product
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    WHERE o.status = 'completed'
  `);
  // ... 13 more copies
}
```

**Time to add "order_date" column**: 2 hours (update 15 files, test all).

**With Views**:

```sql
-- One-time view creation
CREATE VIEW completed_order_details AS
SELECT
  o.id,
  o.total,
  o.created_at AS order_date,
  c.name AS customer_name,
  c.email AS customer_email,
  p.name AS product_name
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = o.product_id
WHERE o.status = 'completed';
```

```javascript
// orders-api.js
app.get('/orders', async (req, res) => {
  const result = await db.query('SELECT * FROM completed_order_details');
  res.json(result.rows);
});

// orders-report.js
async function generateReport() {
  const result = await db.query('SELECT * FROM completed_order_details');
  // ... 13 more places, all using same simple query
}
```

**Time to add "order_date" column**: 2 minutes (update 1 view definition).

**Savings**: **98% less time**, **zero chance of inconsistency**.

---

## 💪 Next Steps

**1. Identify Duplicate Queries** (Today):
- Search codebase for duplicate SQL
- Find queries appearing 3+ times
- Measure total lines of SQL

**2. Create First View** (This Week):
- Pick most duplicated query
- Create view with meaningful name
- Replace duplicates with SELECT from view
- Test all code paths

**3. Security Views** (Next Week):
- Identify tables with sensitive columns
- Create public/private views
- Revoke direct table access
- Grant view-specific permissions

**Remember**: Views are free - create them liberally. One view is better than copy-pasted SQL.

---

## 🔗 Learn More

**Next POCs**:
- **POC #23: Materialized Views** - Cache expensive queries (1000x faster)
- **POC #24: CTEs (Common Table Expressions)** - Temporary result sets for complex queries
- **POC #25: Window Functions** - Running totals without GROUP BY

**Related Topics**:
- **POC #21: Database Triggers** - Auto-update derived data
- **POC #12: B-Tree Indexes** - Speed up view queries
- **POC #14: EXPLAIN Analysis** - Optimize view performance
