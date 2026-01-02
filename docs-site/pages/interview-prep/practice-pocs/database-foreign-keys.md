# Foreign Keys - Stop Orphaned Data Before It Costs $1M

**The Problem**: Your database has 50,000 orders referencing deleted customers, causing crashes and data corruption.

**The Solution**: Foreign keys enforce referential integrity at the database level - preventing orphaned records automatically.

**Time to Implement**: 5 minutes to add your first foreign key.

---

## 📊 The Problem Everyone Faces

You're debugging a production crash. The API returns 500 errors for certain customer dashboards.

**The error**:
```
TypeError: Cannot read property 'name' of null
```

**The query**:
```sql
SELECT
  o.id,
  o.total,
  c.name AS customer_name
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
WHERE o.id = 12345;
```

**The result**:
```
id    | total  | customer_name
------|--------|---------------
12345 | 150.00 | NULL
```

**The order exists, but the customer doesn't.**

You check the database:
```sql
SELECT customer_id FROM orders WHERE id = 12345;
-- customer_id: 789

SELECT * FROM customers WHERE id = 789;
-- 0 rows (customer was deleted)
```

### How Did This Happen?

**6 months ago**: Customer support deleted a test customer:
```sql
DELETE FROM customers WHERE email = 'test@example.com';
-- 1 row deleted
```

**What they didn't know**: This customer had 150 orders in the system.

**Result**: 150 orphaned orders pointing to a non-existent customer.

**Impact**:
- ❌ Dashboards crash when loading orders
- ❌ Reports show NULL for customer names
- ❌ Analytics queries return wrong totals
- ❌ Billing system can't send invoices

### The Typical "Solutions" (That Don't Work)

**❌ Solution 1: Add Application-Level Checks**

```javascript
// Before deleting customer
async function deleteCustomer(customerId) {
  const orders = await db.query('SELECT COUNT(*) FROM orders WHERE customer_id = $1', [customerId]);

  if (orders.rows[0].count > 0) {
    throw new Error('Cannot delete customer with orders');
  }

  await db.query('DELETE FROM customers WHERE id = $1', [customerId]);
}
```

**Problems**:
1. **Race condition**: Another order can be created between the check and delete
2. **Bypassed**: Direct SQL deletes (admin tools, scripts) skip this logic
3. **Scattered**: Every delete operation needs this check
4. **Developer error**: Junior dev forgets the check

**❌ Solution 2: Cascade Deletes in Application**

```javascript
async function deleteCustomer(customerId) {
  // Delete orders first
  await db.query('DELETE FROM orders WHERE customer_id = $1', [customerId]);

  // Then delete customer
  await db.query('DELETE FROM customers WHERE id = $1', [customerId]);
}
```

**Problems**:
1. **Not transactional**: If second DELETE fails, orphaned orders still exist
2. **Scattered logic**: Cascade logic in 20+ files
3. **Incomplete**: Easy to miss related tables (addresses, payment_methods, etc.)

**❌ Solution 3: Periodic Cleanup Jobs**

```javascript
// Cron job: Delete orphaned orders every night
cron.schedule('0 2 * * *', async () => {
  await db.query(`
    DELETE FROM orders
    WHERE customer_id NOT IN (SELECT id FROM customers)
  `);
});
```

**Problems**:
1. **Orphans exist 24 hours**: Data corruption during the day
2. **Slow**: Scanning entire tables nightly
3. **Band-aid**: Fixes symptoms, not root cause

### The Hidden Cost

At a mid-sized e-commerce company:
- **Orphaned orders**: 50,000 (10% of total)
- **Crashed dashboards**: 3 per week
- **Support tickets**: 20 hours/month investigating data issues
- **Lost revenue**: $50,000/month (invoices not sent to orphaned orders)
- **Database cleanup cost**: 15 hours/quarter = **$1,125/quarter**

**Annual cost**: **$600,000 in lost revenue** + **$4,500 in cleanup** + **$18,000 in support time** = **$622,500**.

Plus the CEO asking "Why can't we trust our own data?"

---

## 💡 The Paradigm Shift

**Old Model**: Application code is responsible for data consistency.

**New Model**: Database enforces consistency automatically.

**Key Insight**: Foreign keys are **database-level constraints** - they can't be bypassed, forgotten, or skipped.

Think of foreign keys like **type checking in programming** - the compiler (database) prevents invalid references before they happen.

```
Application-Level Checks:
  Can be bypassed
  Race conditions possible
  Developer error-prone

Foreign Keys:
  Enforced by database
  Atomic with transaction
  Impossible to forget
```

---

## ✅ The Solution: Foreign Keys

A **foreign key** is a column that references the primary key of another table. The database ensures the referenced row exists.

### Pattern 1: Basic Foreign Key

```sql
-- Parent table
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  email VARCHAR(200) UNIQUE
);

-- Child table with foreign key
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  total DECIMAL(10, 2),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

**How it works**:
1. **INSERT**: Database checks if customer exists
2. **UPDATE**: Database checks if new customer exists
3. **DELETE customer**: Database prevents delete if orders exist

**Test it**:

```sql
-- Insert customer
INSERT INTO customers (id, name, email) VALUES (1, 'Alice', 'alice@example.com');

-- ✅ Insert order (customer exists)
INSERT INTO orders (customer_id, total) VALUES (1, 100.00);
-- Success

-- ❌ Insert order (customer doesn't exist)
INSERT INTO orders (customer_id, total) VALUES (999, 50.00);
-- ERROR: insert or update on table "orders" violates foreign key constraint
-- DETAIL: Key (customer_id)=(999) is not present in table "customers".

-- ❌ Delete customer with orders
DELETE FROM customers WHERE id = 1;
-- ERROR: update or delete on table "customers" violates foreign key constraint
-- DETAIL: Key (id)=(1) is still referenced from table "orders".
```

**Result**: **Impossible** to create orphaned records.

### Pattern 2: ON DELETE CASCADE (Auto-Delete Children)

**Problem**: Deleting a customer should also delete their orders.

**Solution**: `ON DELETE CASCADE`.

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  total DECIMAL(10, 2),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE
);
```

**Test it**:

```sql
-- Insert customer and orders
INSERT INTO customers (id, name) VALUES (1, 'Alice');
INSERT INTO orders (customer_id, total) VALUES (1, 100.00), (1, 50.00);

-- Delete customer
DELETE FROM customers WHERE id = 1;
-- Success: Deletes customer AND all 2 orders automatically

-- Check orders
SELECT * FROM orders WHERE customer_id = 1;
-- 0 rows (cascaded delete)
```

**Result**: Customer and all related orders deleted atomically.

**Use cases**:
- User accounts (delete user → delete all sessions, preferences, tokens)
- Blog posts (delete post → delete all comments)
- Projects (delete project → delete all tasks)

### Pattern 3: ON DELETE SET NULL (Soft Delete)

**Problem**: Deleting a salesperson shouldn't delete their orders - just mark orders as "no longer assigned."

**Solution**: `ON DELETE SET NULL`.

```sql
CREATE TABLE salespeople (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200)
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  salesperson_id INT,  -- Nullable
  total DECIMAL(10, 2),
  FOREIGN KEY (salesperson_id) REFERENCES salespeople(id)
    ON DELETE SET NULL
);
```

**Test it**:

```sql
-- Insert salesperson and orders
INSERT INTO salespeople (id, name) VALUES (1, 'Bob');
INSERT INTO orders (salesperson_id, total) VALUES (1, 100.00), (1, 50.00);

-- Delete salesperson
DELETE FROM salespeople WHERE id = 1;
-- Success

-- Check orders (salesperson_id set to NULL)
SELECT id, salesperson_id, total FROM orders;
```

**Result**:
```
id | salesperson_id | total
---|----------------|-------
1  | NULL           | 100.00
2  | NULL           | 50.00
```

**Use cases**:
- Optional relationships (salesperson, assigned_to, created_by)
- Audit trails (keep records even if user deleted)

### Pattern 4: ON DELETE RESTRICT (Prevent Deletion)

**Default behavior**: Prevent deletion if child records exist.

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  total DECIMAL(10, 2),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT  -- Explicit (same as default)
);
```

**Result**: `DELETE` fails if orders exist (forces explicit handling).

**Use cases**:
- Financial records (never auto-delete transactions)
- Audit requirements (must keep historical data)
- Critical relationships (prevent accidental data loss)

### Pattern 5: ON UPDATE CASCADE (Auto-Update Foreign Keys)

**Problem**: Updating a customer's ID should update all their orders.

**Solution**: `ON UPDATE CASCADE`.

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  total DECIMAL(10, 2),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE
);
```

**Test it**:

```sql
-- Insert customer and orders
INSERT INTO customers (id, name) VALUES (1, 'Alice');
INSERT INTO orders (customer_id, total) VALUES (1, 100.00), (1, 50.00);

-- Update customer ID
UPDATE customers SET id = 100 WHERE id = 1;

-- Check orders (customer_id auto-updated)
SELECT id, customer_id, total FROM orders;
```

**Result**:
```
id | customer_id | total
---|-------------|-------
1  | 100         | 100.00
2  | 100         | 50.00
```

**⚠️ Note**: Rarely needed (IDs are usually immutable). Use only if you have natural keys that can change.

### Pattern 6: Composite Foreign Keys

**Problem**: Reference multiple columns.

```sql
CREATE TABLE order_items (
  order_id INT,
  product_id INT,
  quantity INT,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE shipments (
  id SERIAL PRIMARY KEY,
  order_id INT,
  product_id INT,
  tracking_number VARCHAR(100),
  FOREIGN KEY (order_id, product_id) REFERENCES order_items(order_id, product_id)
);
```

**Result**: Shipment must reference a valid (order_id, product_id) combination.

---

## 🔧 Hands-On: Add Foreign Keys (5 Minutes)

Let's add foreign keys to a blog database.

### Step 1: Create Tables

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(200) UNIQUE
);

-- Posts table (with foreign key to users)
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL,
  title VARCHAR(200),
  content TEXT,
  FOREIGN KEY (author_id) REFERENCES users(id)
    ON DELETE CASCADE  -- Delete user → delete all posts
);

-- Comments table (with foreign key to posts and users)
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE CASCADE,  -- Delete post → delete all comments
  FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL  -- Delete user → keep comments but set user_id to NULL
);
```

### Step 2: Test Constraints

```sql
-- Insert user
INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com');

-- ✅ Insert post (author exists)
INSERT INTO posts (author_id, title) VALUES (1, 'Hello World');

-- ❌ Insert post (author doesn't exist)
INSERT INTO posts (author_id, title) VALUES (999, 'Invalid Post');
-- ERROR: foreign key constraint violated

-- Insert comment
INSERT INTO comments (post_id, user_id, content) VALUES (1, 1, 'Great post!');

-- Delete post (cascades to comments)
DELETE FROM posts WHERE id = 1;

SELECT * FROM comments;
-- 0 rows (comment deleted via CASCADE)
```

### Step 3: Test ON DELETE SET NULL

```sql
-- Re-insert data
INSERT INTO users (id, username) VALUES (2, 'bob');
INSERT INTO posts (id, author_id, title) VALUES (2, 2, 'Second Post');
INSERT INTO comments (post_id, user_id, content) VALUES (2, 2, 'Nice!');

-- Delete user (posts CASCADE deleted, comments keep but user_id set to NULL)
DELETE FROM users WHERE id = 2;

-- Check posts (deleted via CASCADE)
SELECT * FROM posts WHERE id = 2;
-- 0 rows

-- Check comments (user_id set to NULL)
SELECT * FROM comments WHERE post_id = 2;
-- 0 rows (post deleted, so comment CASCADE deleted)
```

---

## 🏢 Real-World Examples

### **Stripe** (Payment Processing)
- **Foreign Keys**:
  - `charges.customer_id → customers.id` (RESTRICT)
  - `refunds.charge_id → charges.id` (CASCADE)
- **Why**: Financial data must be consistent (no orphaned charges)
- **Impact**: Zero data corruption incidents in 10 years

### **GitHub** (Code Hosting)
- **Foreign Keys**:
  - `commits.repository_id → repositories.id` (CASCADE)
  - `issues.repository_id → repositories.id` (CASCADE)
  - `pull_requests.repository_id → repositories.id` (CASCADE)
- **Why**: Deleting repo should delete all commits, issues, PRs
- **Impact**: Consistent data cleanup, zero orphaned records

### **Shopify** (E-Commerce)
- **Foreign Keys**:
  - `orders.customer_id → customers.id` (RESTRICT)
  - `order_items.order_id → orders.id` (CASCADE)
  - `order_items.product_id → products.id` (RESTRICT)
- **Why**: Can't delete customers/products with orders (audit requirements)
- **Impact**: Compliance with financial regulations (Sarbanes-Oxley)

### **Airbnb** (Travel Marketplace)
- **Foreign Keys**:
  - `bookings.listing_id → listings.id` (RESTRICT)
  - `bookings.guest_id → users.id` (RESTRICT)
  - `reviews.booking_id → bookings.id` (CASCADE)
- **Why**: Can't delete listings/users with active bookings
- **Impact**: Prevents accidental deletion of revenue-generating data

---

## 🚀 Foreign Key Best Practices

### ✅ When to Use Foreign Keys

**Always use foreign keys when**:
1. **Relationship exists**: Table A references Table B
2. **Data integrity matters**: Orphaned records = bugs
3. **Multiple developers**: Can't trust everyone to remember checks
4. **Direct DB access**: Admin tools, scripts, ORMs
5. **Compliance**: Regulations require data integrity (SOX, HIPAA)

### ❌ When NOT to Use Foreign Keys

**Consider skipping when**:
1. **Very high write volume**: Foreign key checks add overhead (but usually negligible)
2. **Sharded databases**: Foreign keys can't span databases
3. **Temporary/staging tables**: ETL pipelines with partial data
4. **Analytics databases**: Read-only, data already validated

**Performance note**: Foreign key overhead is **usually <5%** of INSERT/UPDATE time. Always measure before skipping.

### Naming Conventions

```sql
-- ✅ Clear naming
CONSTRAINT fk_orders_customer
FOREIGN KEY (customer_id) REFERENCES customers(id);

-- ❌ Auto-generated naming (unclear)
FOREIGN KEY (customer_id) REFERENCES customers(id);
-- Creates: orders_customer_id_fkey
```

**Good naming**: `fk_{child_table}_{parent_table}` or `fk_{child_table}_{column}`

### Add Indexes on Foreign Keys

```sql
-- Create foreign key
ALTER TABLE orders
ADD CONSTRAINT fk_orders_customer
FOREIGN KEY (customer_id) REFERENCES customers(id);

-- ✅ Add index on foreign key column
CREATE INDEX idx_orders_customer ON orders(customer_id);
```

**Why**: Speeds up:
- JOIN queries
- ON DELETE CASCADE (database must find child rows)
- Foreign key violation checks

**Performance**:
```
Without index: DELETE customer (2,500ms to find orders)
With index:    DELETE customer (15ms to find orders)
Improvement:   166x faster
```

---

## 📈 Foreign Key Actions Cheat Sheet

| Action | Behavior | Use Case |
|--------|----------|----------|
| **RESTRICT** | Prevent parent delete if children exist (default) | Financial records, critical data |
| **CASCADE** | Auto-delete children when parent deleted | User accounts, blog posts, projects |
| **SET NULL** | Set foreign key to NULL when parent deleted | Optional relationships, soft delete |
| **SET DEFAULT** | Set foreign key to DEFAULT value | Reassign to default account |
| **NO ACTION** | Same as RESTRICT (but check deferred to end of transaction) | Complex multi-table operations |

### Examples

```sql
-- Prevent deletion (default)
FOREIGN KEY (customer_id) REFERENCES customers(id)
ON DELETE RESTRICT;

-- Auto-delete children
FOREIGN KEY (post_id) REFERENCES posts(id)
ON DELETE CASCADE;

-- Set to NULL
FOREIGN KEY (assigned_to) REFERENCES users(id)
ON DELETE SET NULL;

-- Set to default value
FOREIGN KEY (status_id) REFERENCES statuses(id)
ON DELETE SET DEFAULT;
```

---

## 🎯 Adding Foreign Keys to Existing Tables

### Step 1: Clean Up Orphaned Data

```sql
-- Find orphaned orders
SELECT o.*
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
WHERE c.id IS NULL;

-- Delete orphaned orders (or fix them)
DELETE FROM orders
WHERE customer_id NOT IN (SELECT id FROM customers);
```

### Step 2: Add Foreign Key

```sql
ALTER TABLE orders
ADD CONSTRAINT fk_orders_customer
FOREIGN KEY (customer_id) REFERENCES customers(id)
ON DELETE CASCADE;
```

### Step 3: Add Index

```sql
CREATE INDEX idx_orders_customer ON orders(customer_id);
```

### Dealing with Large Tables

**Problem**: Adding foreign key to 100M row table locks table for hours.

**Solution**: Use `NOT VALID` (PostgreSQL 9.1+):

```sql
-- Step 1: Add constraint as NOT VALID (fast, no table scan)
ALTER TABLE orders
ADD CONSTRAINT fk_orders_customer
FOREIGN KEY (customer_id) REFERENCES customers(id)
NOT VALID;
-- Takes seconds, allows INSERT/UPDATE/DELETE to continue

-- Step 2: Validate constraint (scans table, but no exclusive lock)
ALTER TABLE orders
VALIDATE CONSTRAINT fk_orders_customer;
-- Takes time, but table is still usable
```

**Result**: Constraint added with minimal downtime.

---

## 💪 Common Pitfalls

### ❌ Circular Dependencies

```sql
-- BAD: Table A references B, B references A
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  last_order_id INT,
  FOREIGN KEY (last_order_id) REFERENCES orders(id)
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT,
  FOREIGN KEY (customer_id) REFERENCES users(id)
);
-- ERROR: circular dependency
```

**✅ Solution**: Make one foreign key nullable or use triggers:
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  last_order_id INT  -- No foreign key
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT,
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

-- Update last_order_id via trigger
CREATE TRIGGER update_last_order
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_user_last_order();
```

### ❌ Cascading Deletes Too Aggressively

```sql
-- BAD: Deleting user cascades to EVERYTHING
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
-- Deleting user deletes all content they created (unintended!)
```

**✅ Solution**: Use SET NULL for optional relationships:
```sql
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
```

### ❌ Missing Indexes

```sql
-- BAD: No index on foreign key column
CREATE TABLE orders (
  customer_id INT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
-- JOINs and CASCADE deletes are slow
```

**✅ Solution**: Always index foreign key columns:
```sql
CREATE INDEX idx_orders_customer ON orders(customer_id);
```

---

## 💪 Next Steps

**1. Audit Existing Tables** (Today):
- Find tables with `*_id` columns (potential foreign keys)
- Check for orphaned records
- List relationships without foreign keys

**2. Add Foreign Keys** (This Week):
- Start with critical tables (users, orders, payments)
- Clean up orphaned data first
- Add foreign keys with appropriate ON DELETE action
- Add indexes on foreign key columns

**3. Enforce in New Tables** (Ongoing):
- Always add foreign keys to new tables
- Document relationships in schema
- Test CASCADE behavior before production

**Remember**: Foreign keys are free data integrity. Use them everywhere.

---

## 🔗 Learn More

**Next POCs**:
- **POC #28: Check Constraints** - Validate data beyond referential integrity
- **POC #29: Database Sequences** - Generate unique IDs safely
- **POC #30: VACUUM & Maintenance** - Keep database healthy

**Related Topics**:
- **POC #21: Database Triggers** - Auto-update fields on foreign key actions
- **POC #16: Transactions** - Foreign keys checked within transactions
- **POC #26: Table Partitioning** - Foreign keys on partitioned tables
