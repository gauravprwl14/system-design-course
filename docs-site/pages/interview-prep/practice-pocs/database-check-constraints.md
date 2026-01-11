# Check Constraints - Stop Invalid Data at the Database Level

**The Problem**: Your application code validates data in 50 places, but invalid data still gets into the database through admin tools and scripts.

**The Solution**: Check constraints enforce validation rules at the database level - impossible to bypass.

**Time to Implement**: 2 minutes to add your first check constraint.

---

## 📊 The Problem Everyone Faces

You're debugging a production crash. The payment processing system is rejecting orders:

**The error**:
```
Payment failed: Invalid total amount: -$150.00
```

You check the database:
```sql
SELECT id, customer_id, total, status FROM orders WHERE id = 12345;
```

**Result**:
```
id    | customer_id | total   | status
------|-------------|---------|--------
12345 | 789         | -150.00 | pending
```

**Negative order total**. How is this possible?

You check the application code:
```javascript
// order-api.js (validates total)
async function createOrder(data) {
  if (data.total <= 0) {
    throw new Error('Total must be positive');
  }
  await db.query('INSERT INTO orders (customer_id, total) VALUES ($1, $2)',
    [data.customer_id, data.total]);
}
```

**Application has validation**. But the data came from a different source:

```sql
-- Admin script to apply refunds (bypasses application)
UPDATE orders SET total = total - 200 WHERE id = 12345;
-- Original total: $50
-- New total: -$150  ❌
```

**The validation was bypassed**.

### More Invalid Data Examples

**Your database has**:
- 🔴 Users with age = -5
- 🔴 Products with price = $0.00
- 🔴 Orders with quantity = 0
- 🔴 Email addresses without '@' symbol
- 🔴 Phone numbers with 50 digits
- 🔴 Inventory with stock = -1,000

**All bypassed application validation through**:
- Admin tools
- Direct SQL scripts
- CSV imports
- ETL pipelines
- Third-party integrations
- SQL injection attacks

### The Hidden Cost

At a mid-sized e-commerce company:
- **Invalid orders**: 500 per month (negative totals, zero quantities)
- **Payment failures**: 200 per month (invalid amounts)
- **Support tickets**: 50 hours/month investigating data issues
- **Lost revenue**: $25,000/month (failed payments)
- **Developer time**: 20 hours/month fixing data corruption
- **Database cleanup**: Quarterly manual fixes = 40 hours/year

**Annual cost**: **$300,000 in lost revenue** + **$22,500 in developer time** = **$322,500**.

Plus the CEO asking "How did negative prices get into production?"

---

## 💡 The Paradigm Shift

**Old Model**: Application code validates data before insert.

**New Model**: Database enforces validation rules automatically.

**Key Insight**: Check constraints are **database-level rules** that cannot be bypassed by any INSERT/UPDATE operation.

Think of check constraints like **compile-time type checking** - invalid data is rejected before it enters the database.

```
Application Validation:
  Can be bypassed (admin tools, scripts)
  Scattered across codebase
  Developer-dependent

Check Constraints:
  Enforced by database
  Single source of truth
  Impossible to bypass
```

---

## ✅ The Solution: Check Constraints

A **check constraint** is a rule that validates data before INSERT or UPDATE. The database rejects operations that violate the constraint.

### Pattern 1: Basic Check Constraint

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  price DECIMAL(10, 2) CHECK (price > 0),
  stock INT CHECK (stock >= 0)
);
```

**Test it**:

```sql
-- ✅ Valid insert
INSERT INTO products (name, price, stock) VALUES ('Laptop', 999.99, 50);
-- Success

-- ❌ Invalid price
INSERT INTO products (name, price, stock) VALUES ('Mouse', -10.00, 100);
-- ERROR: new row for relation "products" violates check constraint "products_price_check"
-- DETAIL: Failing row contains (2, Mouse, -10.00, 100).

-- ❌ Invalid stock
INSERT INTO products (name, price, stock) VALUES ('Keyboard', 50.00, -5);
-- ERROR: new row for relation "products" violates check constraint "products_stock_check"
```

**Result**: **Impossible** to insert invalid data.

### Pattern 2: Named Check Constraints

**Always name your constraints** for clarity:

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  price DECIMAL(10, 2),
  stock INT,

  CONSTRAINT chk_products_price_positive
    CHECK (price > 0),

  CONSTRAINT chk_products_stock_non_negative
    CHECK (stock >= 0)
);
```

**Benefits**:
- ✅ Clear error messages
- ✅ Easy to identify which constraint failed
- ✅ Easier to drop/modify specific constraints

### Pattern 3: Multi-Column Check Constraints

**Validate relationships between columns**:

```sql
CREATE TABLE discounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  discount_percent DECIMAL(5, 2),
  discount_amount DECIMAL(10, 2),

  -- Only one discount type can be set
  CONSTRAINT chk_discounts_one_type
    CHECK (
      (discount_percent IS NOT NULL AND discount_amount IS NULL) OR
      (discount_percent IS NULL AND discount_amount IS NOT NULL)
    )
);
```

**Test it**:

```sql
-- ✅ Percent discount only
INSERT INTO discounts (name, discount_percent) VALUES ('Summer Sale', 15.00);

-- ✅ Amount discount only
INSERT INTO discounts (name, discount_amount) VALUES ('$10 Off', 10.00);

-- ❌ Both set
INSERT INTO discounts (name, discount_percent, discount_amount) VALUES ('Invalid', 10.00, 5.00);
-- ERROR: violates check constraint "chk_discounts_one_type"

-- ❌ Neither set
INSERT INTO discounts (name) VALUES ('Invalid');
-- ERROR: violates check constraint "chk_discounts_one_type"
```

### Pattern 4: Range Check Constraints

```sql
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  age INT,
  salary DECIMAL(10, 2),

  CONSTRAINT chk_employees_age_range
    CHECK (age BETWEEN 18 AND 100),

  CONSTRAINT chk_employees_salary_range
    CHECK (salary BETWEEN 30000 AND 500000)
);
```

**Test it**:

```sql
-- ✅ Valid
INSERT INTO employees (name, age, salary) VALUES ('Alice', 30, 75000);

-- ❌ Age too low
INSERT INTO employees (name, age, salary) VALUES ('Bob', 12, 50000);
-- ERROR: violates check constraint "chk_employees_age_range"

-- ❌ Salary too high
INSERT INTO employees (name, age, salary) VALUES ('Carol', 35, 1000000);
-- ERROR: violates check constraint "chk_employees_salary_range"
```

### Pattern 5: String Format Validation

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100),
  email VARCHAR(200),
  phone VARCHAR(20),
  zipcode VARCHAR(10),

  CONSTRAINT chk_users_username_length
    CHECK (LENGTH(username) >= 3),

  CONSTRAINT chk_users_email_format
    CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),

  CONSTRAINT chk_users_phone_format
    CHECK (phone ~ '^\+?[0-9]{10,15}$'),

  CONSTRAINT chk_users_zipcode_format
    CHECK (zipcode ~ '^[0-9]{5}(-[0-9]{4})?$')
);
```

**Test it**:

```sql
-- ✅ Valid
INSERT INTO users (username, email, phone, zipcode)
VALUES ('alice', 'alice@example.com', '+12125551234', '10001');

-- ❌ Invalid username (too short)
INSERT INTO users (username, email, phone, zipcode)
VALUES ('ab', 'bob@example.com', '+12125555678', '10002');
-- ERROR: violates check constraint "chk_users_username_length"

-- ❌ Invalid email (no @)
INSERT INTO users (username, email, phone, zipcode)
VALUES ('carol', 'carolexample.com', '+12125559999', '10003');
-- ERROR: violates check constraint "chk_users_email_format"

-- ❌ Invalid phone (letters)
INSERT INTO users (username, email, phone, zipcode)
VALUES ('dave', 'dave@example.com', 'abc-def-ghij', '10004');
-- ERROR: violates check constraint "chk_users_phone_format"
```

**Regex operators**:
- `~` - Matches regex (case-sensitive)
- `~*` - Matches regex (case-insensitive)
- `!~` - Does NOT match regex

### Pattern 6: Enum-Style Constraints

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT,
  total DECIMAL(10, 2),
  status VARCHAR(20),
  priority VARCHAR(10),

  CONSTRAINT chk_orders_status_valid
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),

  CONSTRAINT chk_orders_priority_valid
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);
```

**Test it**:

```sql
-- ✅ Valid
INSERT INTO orders (customer_id, total, status, priority)
VALUES (123, 100.00, 'pending', 'high');

-- ❌ Invalid status
INSERT INTO orders (customer_id, total, status, priority)
VALUES (456, 50.00, 'invalid_status', 'low');
-- ERROR: violates check constraint "chk_orders_status_valid"
```

**Alternative**: Use actual ENUMs (PostgreSQL):
```sql
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  status order_status DEFAULT 'pending'
);
```

### Pattern 7: Date/Time Validation

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_events_end_after_start
    CHECK (end_date >= start_date),

  CONSTRAINT chk_events_future_dates
    CHECK (start_date >= CURRENT_DATE)
);
```

**Test it**:

```sql
-- ✅ Valid
INSERT INTO events (title, start_date, end_date)
VALUES ('Conference', '2025-06-01', '2025-06-03');

-- ❌ End before start
INSERT INTO events (title, start_date, end_date)
VALUES ('Invalid Event', '2025-06-10', '2025-06-05');
-- ERROR: violates check constraint "chk_events_end_after_start"

-- ❌ Past date
INSERT INTO events (title, start_date, end_date)
VALUES ('Old Event', '2020-01-01', '2020-01-05');
-- ERROR: violates check constraint "chk_events_future_dates"
```

---

## 🔧 Hands-On: Add Check Constraints (5 Minutes)

Let's add constraints to an e-commerce database.

### Step 1: Create Tables with Constraints

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL,
  weight_kg DECIMAL(8, 2),
  rating DECIMAL(2, 1),

  -- Constraints
  CONSTRAINT chk_products_price_positive
    CHECK (price > 0),

  CONSTRAINT chk_products_cost_positive
    CHECK (cost > 0),

  CONSTRAINT chk_products_price_above_cost
    CHECK (price > cost),

  CONSTRAINT chk_products_stock_non_negative
    CHECK (stock >= 0),

  CONSTRAINT chk_products_weight_positive
    CHECK (weight_kg IS NULL OR weight_kg > 0),

  CONSTRAINT chk_products_rating_range
    CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL,
  shipping DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT chk_orders_subtotal_positive
    CHECK (subtotal > 0),

  CONSTRAINT chk_orders_tax_non_negative
    CHECK (tax >= 0),

  CONSTRAINT chk_orders_shipping_non_negative
    CHECK (shipping >= 0),

  CONSTRAINT chk_orders_total_matches
    CHECK (total = subtotal + tax + shipping),

  CONSTRAINT chk_orders_status_valid
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),

  CONSTRAINT chk_orders_shipped_after_created
    CHECK (shipped_at IS NULL OR shipped_at >= created_at)
);
```

### Step 2: Test Constraints

```sql
-- ✅ Valid product
INSERT INTO products (name, price, cost, stock, rating)
VALUES ('Laptop', 999.99, 600.00, 50, 4.5);

-- ❌ Price < cost (violates chk_products_price_above_cost)
INSERT INTO products (name, price, cost, stock)
VALUES ('Mouse', 10.00, 15.00, 100);
-- ERROR

-- ❌ Negative stock
INSERT INTO products (name, price, cost, stock)
VALUES ('Keyboard', 50.00, 30.00, -10);
-- ERROR

-- ❌ Invalid rating
INSERT INTO products (name, price, cost, stock, rating)
VALUES ('Monitor', 300.00, 200.00, 20, 6.0);
-- ERROR: Rating must be between 0 and 5

-- ✅ Valid order
INSERT INTO orders (customer_id, subtotal, tax, shipping, total, status)
VALUES (123, 100.00, 8.00, 12.00, 120.00, 'pending');

-- ❌ Total doesn't match (violates chk_orders_total_matches)
INSERT INTO orders (customer_id, subtotal, tax, shipping, total, status)
VALUES (456, 100.00, 8.00, 12.00, 130.00, 'pending');
-- ERROR: total must equal subtotal + tax + shipping

-- ❌ Invalid status
INSERT INTO orders (customer_id, subtotal, tax, shipping, total, status)
VALUES (789, 50.00, 4.00, 5.00, 59.00, 'invalid_status');
-- ERROR
```

### Step 3: Add Constraints to Existing Tables

```sql
-- Add constraint to existing table
ALTER TABLE products
ADD CONSTRAINT chk_products_name_not_empty
CHECK (LENGTH(TRIM(name)) > 0);

-- Test it
UPDATE products SET name = '   ' WHERE id = 1;
-- ERROR: violates check constraint "chk_products_name_not_empty"
```

---

## 🏢 Real-World Examples

### **Stripe** (Payment Processing)
- **Check Constraints**:
  - `charges.amount > 0` (no negative payments)
  - `charges.currency IN ('usd', 'eur', 'gbp', ...)` (valid currencies only)
  - `refunds.amount <= charges.amount` (can't refund more than charged)
- **Impact**: Zero invalid payment data in 10 years

### **Airbnb** (Travel Marketplace)
- **Check Constraints**:
  - `listings.price_per_night > 0` (no free listings by mistake)
  - `listings.max_guests BETWEEN 1 AND 16` (realistic guest limits)
  - `bookings.check_out > bookings.check_in` (checkout after checkin)
- **Impact**: Prevents common data entry errors

### **Uber** (Ride Sharing)
- **Check Constraints**:
  - `trips.distance_km > 0` (no zero-distance trips)
  - `trips.fare >= trips.base_fare` (fare can't be less than base)
  - `drivers.rating BETWEEN 1 AND 5` (valid rating range)
- **Impact**: Clean analytics data, no outliers

### **GitHub** (Code Hosting)
- **Check Constraints**:
  - `repositories.size_kb >= 0` (no negative sizes)
  - `pull_requests.additions >= 0` (line additions can't be negative)
  - `pull_requests.deletions >= 0` (line deletions can't be negative)
- **Impact**: Accurate repository statistics

---

## 🚀 Advanced Check Constraint Patterns

### Pattern 8: Conditional Constraints

**Only enforce constraint when certain conditions are met**:

```sql
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  employment_type VARCHAR(20),  -- 'full_time', 'part_time', 'contractor'
  salary DECIMAL(10, 2),
  hourly_rate DECIMAL(10, 2),

  -- Full-time employees must have salary
  CONSTRAINT chk_employees_fulltime_salary
    CHECK (employment_type != 'full_time' OR salary IS NOT NULL),

  -- Part-time/contractors must have hourly rate
  CONSTRAINT chk_employees_hourly_rate
    CHECK (employment_type = 'full_time' OR hourly_rate IS NOT NULL),

  -- Can't have both salary and hourly rate
  CONSTRAINT chk_employees_one_pay_type
    CHECK (
      (salary IS NOT NULL AND hourly_rate IS NULL) OR
      (salary IS NULL AND hourly_rate IS NOT NULL)
    )
);
```

### Pattern 9: Cross-Table Validation (Using Functions)

**Validate against data in other tables**:

```sql
-- Create validation function
CREATE OR REPLACE FUNCTION check_order_quantity(product_id INT, quantity INT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN quantity <= (SELECT stock FROM products WHERE id = product_id);
END;
$$ LANGUAGE plpgsql;

-- Use function in check constraint
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT,
  product_id INT,
  quantity INT,

  CONSTRAINT chk_order_items_quantity_available
    CHECK (check_order_quantity(product_id, quantity))
);
```

**⚠️ Warning**: Cross-table constraints can be slow. Use triggers instead for complex validation.

### Pattern 10: JSON Data Validation

```sql
CREATE TABLE user_settings (
  id SERIAL PRIMARY KEY,
  user_id INT,
  preferences JSONB,

  -- Validate JSON structure
  CONSTRAINT chk_settings_has_theme
    CHECK (preferences ? 'theme'),

  CONSTRAINT chk_settings_theme_valid
    CHECK (preferences->>'theme' IN ('light', 'dark', 'auto')),

  CONSTRAINT chk_settings_notifications_boolean
    CHECK (jsonb_typeof(preferences->'notifications') = 'boolean')
);
```

---

## 📈 Check Constraints vs. Application Validation

| Aspect | Application Validation | Check Constraints |
|--------|----------------------|-------------------|
| **Coverage** | Only application code paths | All INSERT/UPDATE (scripts, admin tools, etc.) |
| **Bypass** | Easy to bypass | Impossible to bypass |
| **Location** | Scattered across codebase | Single source of truth (schema) |
| **Performance** | Adds network round-trip | Atomic with database operation |
| **Maintenance** | Must update in multiple places | Update once in schema |
| **Testing** | Must test every code path | Enforced by database automatically |

**Best Practice**: Use **both**:
1. **Application validation**: User-friendly error messages, complex business logic
2. **Check constraints**: Final safety net, prevent invalid data from any source

---

## 🎯 Check Constraint Cheat Sheet

```sql
-- Basic constraint (inline)
CREATE TABLE products (
  price DECIMAL(10, 2) CHECK (price > 0)
);

-- Named constraint (table level)
CREATE TABLE products (
  price DECIMAL(10, 2),
  CONSTRAINT chk_products_price_positive CHECK (price > 0)
);

-- Add constraint to existing table
ALTER TABLE products
ADD CONSTRAINT chk_products_price_positive
CHECK (price > 0);

-- Drop constraint
ALTER TABLE products
DROP CONSTRAINT chk_products_price_positive;

-- Temporarily disable constraint
ALTER TABLE products
DISABLE TRIGGER ALL;  -- PostgreSQL

-- Re-enable
ALTER TABLE products
ENABLE TRIGGER ALL;

-- Check which constraints exist
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid = 'products'::regclass;
```

---

## 💪 Common Use Cases

### 1. E-Commerce

```sql
-- Products must have positive price and cost
price > 0
cost > 0
price > cost  -- Ensure profit margin

-- Orders must have valid status
status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')

-- Discount can't exceed price
discount_amount < price

-- Quantity must be positive
quantity > 0
```

### 2. User Management

```sql
-- Username length
LENGTH(username) BETWEEN 3 AND 30

-- Email format
email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'

-- Age range
age BETWEEN 13 AND 120

-- Password strength (at least 8 characters)
LENGTH(password_hash) >= 60  -- bcrypt hash length
```

### 3. Financial Systems

```sql
-- Amount precision (max 2 decimal places)
amount = ROUND(amount, 2)

-- Amount range
amount BETWEEN 0.01 AND 1000000.00

-- Currency code (ISO 4217)
currency_code ~ '^[A-Z]{3}$'

-- Account balance can't be negative (unless overdraft allowed)
balance >= 0 OR overdraft_enabled = true
```

### 4. Inventory Management

```sql
-- Stock level
stock >= 0

-- Reorder point < max stock
reorder_point < max_stock

-- Lead time (days)
lead_time_days BETWEEN 1 AND 365

-- Warehouse capacity
current_units <= max_capacity
```

---

## 💪 Next Steps

**1. Audit Existing Tables** (Today):
- Identify columns with validation logic in application
- Check for data that violates expected rules
- List tables without check constraints

**2. Add Check Constraints** (This Week):
- Start with critical tables (orders, products, users)
- Add constraints for:
  - Positive amounts (price, quantity, stock)
  - Valid enum values (status, type, category)
  - Format validation (email, phone, zipcode)
  - Date ranges (start < end, created < updated)

**3. Clean Up Invalid Data** (Before Adding Constraints):
```sql
-- Find invalid data
SELECT * FROM products WHERE price <= 0;

-- Fix invalid data
UPDATE products SET price = 0.01 WHERE price <= 0;

-- Add constraint
ALTER TABLE products
ADD CONSTRAINT chk_products_price_positive CHECK (price > 0);
```

**Remember**: Check constraints are your last line of defense against invalid data. Use them everywhere.

---

## 🔗 Learn More

**Next POCs**:
- **POC #29: Database Sequences & Auto-Increment** - Generate unique IDs safely
- **POC #30: VACUUM & Database Maintenance** - Keep database performing well
- **POC #21: Database Triggers** - Complex validation beyond check constraints

**Related Topics**:
- **POC #27: Foreign Keys** - Referential integrity (another constraint type)
- **POC #16: Transactions** - Check constraints validated within transactions
- **POC #19: JSONB** - Validating JSON data with check constraints
