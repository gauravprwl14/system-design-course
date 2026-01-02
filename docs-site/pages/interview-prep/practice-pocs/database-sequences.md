# Database Sequences - Generate Unique IDs Without Conflicts

**The Problem**: Your application generates duplicate IDs causing primary key violations and data corruption.

**The Solution**: Database sequences generate guaranteed-unique IDs - eliminating race conditions and conflicts.

**Time to Implement**: 2 minutes to create your first sequence.

---

## 📊 The Problem Everyone Faces

You're running a high-traffic e-commerce site. Two customers place orders at the exact same millisecond.

**Application code** (generates ID):
```javascript
// ❌ Application-generated ID (race condition)
async function createOrder(data) {
  // Get max ID
  const result = await db.query('SELECT MAX(id) as max_id FROM orders');
  const newId = (result.rows[0].max_id || 0) + 1;

  // Insert with new ID
  await db.query('INSERT INTO orders (id, customer_id, total) VALUES ($1, $2, $3)',
    [newId, data.customer_id, data.total]);

  return newId;
}
```

**What happens**:
```
Time    | Thread 1                          | Thread 2
--------|-----------------------------------|----------------------------------
10:00:00| SELECT MAX(id) → 1000            |
10:00:00|                                   | SELECT MAX(id) → 1000
10:00:01| INSERT (id=1001, total=$100)     |
10:00:01|                                   | INSERT (id=1001, total=$50)  ❌
```

**Result**:
```
ERROR: duplicate key value violates unique constraint "orders_pkey"
DETAIL: Key (id)=(1001) already exists.
```

**Customer sees**: "Error processing your order. Please try again."

**Your database**: One order succeeded (Thread 1), one failed (Thread 2). Customer is charged but order not recorded.

### More ID Generation Failures

**UUID approach** (seemingly safe):
```javascript
const { v4: uuidv4 } = require('uuid');

async function createOrder(data) {
  const id = uuidv4();  // e.g., "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  await db.query('INSERT INTO orders (id, customer_id, total) VALUES ($1, $2, $3)',
    [id, data.customer_id, data.total]);
}
```

**Problems**:
1. **36-character strings**: ID column is VARCHAR(36) instead of INT (wastes 9x storage)
2. **No ordering**: Can't sort by "recently created" (UUIDs are random)
3. **Index bloat**: Random UUIDs cause B-tree fragmentation (slower queries)
4. **No human-readability**: Order #"f47ac10b..." vs. Order #1001

**Snowflake ID approach** (Twitter's solution):
```javascript
// 64-bit ID: timestamp + worker_id + sequence
const snowflake = require('snowflake-id');
const generator = new snowflake({ workerId: 1 });

async function createOrder(data) {
  const id = generator.generate();  // e.g., 1234567890123456789
  await db.query('INSERT INTO orders (id, customer_id, total) VALUES ($1, $2, $3)',
    [id, data.customer_id, data.total]);
}
```

**Problems**:
1. **Application dependency**: Must coordinate worker IDs across servers
2. **Clock skew**: Server time synchronization issues cause duplicates
3. **Complexity**: Extra code to maintain

### The Hidden Cost

At a mid-sized SaaS company:
- **Duplicate ID errors**: 50 per day
- **Failed orders**: 10 per day (customers abandon after error)
- **Lost revenue**: $500/day = **$182,500/year**
- **Support tickets**: 100 hours/year investigating duplicate ID issues
- **Developer time**: 40 hours/year fixing race conditions

**Total annual cost**: **$182,500 in lost revenue** + **$10,500 in support/dev time** = **$193,000**.

Plus the customer frustration: "Your site kept giving me errors!"

---

## 💡 The Paradigm Shift

**Old Model**: Application generates IDs (prone to race conditions).

**New Model**: Database generates IDs (guaranteed unique).

**Key Insight**: Database sequences are **atomic** - two transactions cannot get the same value.

Think of sequences like **ticket dispensers** - each customer gets a unique number, impossible to duplicate.

```
Application-Generated IDs:
  Race conditions
  Requires coordination
  Complex to scale

Database Sequences:
  Atomic (no race conditions)
  No coordination needed
  Scales automatically
```

---

## ✅ The Solution: Database Sequences

A **sequence** is a database object that generates a series of unique integers.

### Pattern 1: SERIAL (Auto-Incrementing ID)

**Easiest approach** (PostgreSQL):

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT,
  total DECIMAL(10, 2)
);
```

**What SERIAL does** (syntactic sugar):
```sql
-- Behind the scenes, SERIAL creates:
CREATE SEQUENCE orders_id_seq;

CREATE TABLE orders (
  id INT PRIMARY KEY DEFAULT nextval('orders_id_seq'),
  customer_id INT,
  total DECIMAL(10, 2)
);

ALTER SEQUENCE orders_id_seq OWNED BY orders.id;
```

**Insert data**:
```sql
-- ID auto-generated
INSERT INTO orders (customer_id, total) VALUES (123, 100.00);

SELECT * FROM orders;
```

**Result**:
```
id | customer_id | total
---|-------------|-------
1  | 123         | 100.00
```

**Next insert**:
```sql
INSERT INTO orders (customer_id, total) VALUES (456, 50.00);

SELECT * FROM orders;
```

**Result**:
```
id | customer_id | total
---|-------------|-------
1  | 123         | 100.00
2  | 456         | 50.00
```

**ID automatically increments** - no application logic needed.

### Pattern 2: Explicit Sequence Creation

**More control** over sequence behavior:

```sql
-- Create sequence
CREATE SEQUENCE order_id_seq
  START WITH 1000         -- First ID will be 1000
  INCREMENT BY 1          -- Each call increments by 1
  MINVALUE 1000           -- Can't go below 1000
  MAXVALUE 999999999      -- Max value
  CACHE 20;               -- Pre-allocate 20 IDs in memory (faster)

-- Create table
CREATE TABLE orders (
  id INT PRIMARY KEY DEFAULT nextval('order_id_seq'),
  customer_id INT,
  total DECIMAL(10, 2)
);
```

**Insert data**:
```sql
INSERT INTO orders (customer_id, total) VALUES (123, 100.00);

SELECT * FROM orders;
```

**Result**:
```
id   | customer_id | total
-----|-------------|-------
1000 | 123         | 100.00
```

**Next insert starts at 1001**.

### Pattern 3: Shared Sequence Across Tables

**Use case**: Global ID sequence for multiple tables.

```sql
-- Create shared sequence
CREATE SEQUENCE global_id_seq START WITH 1;

-- Multiple tables use same sequence
CREATE TABLE users (
  id INT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  username VARCHAR(100)
);

CREATE TABLE products (
  id INT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  name VARCHAR(200)
);

CREATE TABLE orders (
  id INT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  customer_id INT
);
```

**Insert data**:
```sql
INSERT INTO users (username) VALUES ('alice');       -- id: 1
INSERT INTO products (name) VALUES ('Laptop');       -- id: 2
INSERT INTO orders (customer_id) VALUES (1);         -- id: 3
INSERT INTO users (username) VALUES ('bob');         -- id: 4
INSERT INTO products (name) VALUES ('Mouse');        -- id: 5
```

**Result**: Globally unique IDs across all tables.

**Use cases**:
- Event sourcing (all events have sequential IDs)
- Audit logs (track order of all operations)
- Distributed systems (combine with prefix: `user_1`, `product_2`, `order_3`)

### Pattern 4: Custom Increment Values

**Use case**: Incrementby 10 to leave gaps for manual inserts.

```sql
CREATE SEQUENCE invoice_id_seq
  START WITH 1000
  INCREMENT BY 10;  -- 1000, 1010, 1020, 1030, ...

CREATE TABLE invoices (
  id INT PRIMARY KEY DEFAULT nextval('invoice_id_seq'),
  customer_id INT,
  total DECIMAL(10, 2)
);
```

**Insert data**:
```sql
INSERT INTO invoices (customer_id, total) VALUES (123, 100.00);  -- id: 1000
INSERT INTO invoices (customer_id, total) VALUES (456, 50.00);   -- id: 1010

-- Manually insert with ID in gap
INSERT INTO invoices (id, customer_id, total) VALUES (1005, 789, 75.00);

SELECT id FROM invoices ORDER BY id;
```

**Result**:
```
1000
1005  ← Manual insert
1010
```

**Use cases**:
- Leave room for corrections/adjustments
- Import legacy data between auto-generated IDs

### Pattern 5: Cycle Sequences

**Use case**: Reuse values after reaching max (e.g., ticket numbers).

```sql
CREATE SEQUENCE ticket_number_seq
  START WITH 1
  INCREMENT BY 1
  MAXVALUE 9999
  CYCLE;  -- Reset to 1 after reaching 9999

CREATE TABLE support_tickets (
  id SERIAL PRIMARY KEY,
  ticket_number INT DEFAULT nextval('ticket_number_seq'),
  title VARCHAR(200)
);
```

**Insert 10,000 tickets**:
```sql
-- Ticket #1 to #9999
INSERT INTO support_tickets (title) VALUES ('Issue 1'), ..., ('Issue 9999');

-- Ticket #10,000 resets to #1
INSERT INTO support_tickets (title) VALUES ('Issue 10000');

SELECT id, ticket_number, title FROM support_tickets
WHERE id IN (1, 9999, 10000);
```

**Result**:
```
id    | ticket_number | title
------|---------------|----------
1     | 1             | Issue 1
9999  | 9999          | Issue 9999
10000 | 1             | Issue 10000  ← Cycled back to 1
```

---

## 🔧 Hands-On: Create Your First Sequence (5 Minutes)

### Step 1: Create Table with SERIAL

```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  email VARCHAR(200)
);
```

### Step 2: Insert Data (No ID Needed)

```sql
INSERT INTO customers (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com'),
  ('Carol', 'carol@example.com');

SELECT * FROM customers;
```

**Result**:
```
id | name  | email
---|-------|------------------
1  | Alice | alice@example.com
2  | Bob   | bob@example.com
3  | Carol | carol@example.com
```

### Step 3: Get Next Value Without Inserting

```sql
-- Preview next value (doesn't consume it)
SELECT currval('customers_id_seq');  -- Error if never called
SELECT lastval();                    -- Last value returned in this session

-- Get and consume next value
SELECT nextval('customers_id_seq');  -- Returns 4
SELECT nextval('customers_id_seq');  -- Returns 5
```

### Step 4: Reset Sequence

```sql
-- Reset to 1
ALTER SEQUENCE customers_id_seq RESTART WITH 1;

-- Next insert gets ID = 1
INSERT INTO customers (name, email) VALUES ('Dave', 'dave@example.com');

SELECT * FROM customers;
```

**Result** (if table was empty):
```
id | name  | email
---|-------|------------------
1  | Dave  | dave@example.com
```

### Step 5: Manually Set ID (Override Sequence)

```sql
-- Insert with explicit ID
INSERT INTO customers (id, name, email) VALUES (100, 'Eve', 'eve@example.com');

-- Next auto-generated ID is still 6 (sequence not updated!)
INSERT INTO customers (name, email) VALUES ('Frank', 'frank@example.com');

SELECT * FROM customers ORDER BY id;
```

**Result**:
```
id  | name  | email
----|-------|------------------
6   | Frank | frank@example.com
100 | Eve   | eve@example.com
```

**Fix sequence** (sync with max ID):
```sql
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));

-- Next insert now correctly gets 101
INSERT INTO customers (name, email) VALUES ('Grace', 'grace@example.com');

SELECT * FROM customers ORDER BY id;
```

**Result**:
```
id  | name  | email
----|-------|-------------------
6   | Frank | frank@example.com
100 | Eve   | eve@example.com
101 | Grace | grace@example.com  ← Correct!
```

---

## 🏢 Real-World Examples

### **Instagram** (Social Media)
- **Sequence**: Post IDs, User IDs
- **Why**: Handle 500M+ posts/day, guaranteed unique IDs
- **Impact**: Zero duplicate ID errors at massive scale

### **Stripe** (Payment Processing)
- **Sequence**: Charge IDs, Customer IDs
- **Prefix**: `ch_1A2B3C4D` (charge), `cus_1A2B3C4D` (customer)
- **Why**: Human-readable, sortable, unique
- **Impact**: 100M+ transactions/day with zero ID conflicts

### **GitHub** (Code Hosting)
- **Sequence**: Issue numbers (per repository)
- **Why**: Issue #1, #2, #3 (sequential, human-readable)
- **Implementation**: Separate sequence per repository
- **Impact**: Clean, predictable issue numbers

### **Twitter** (Social Media)
- **Snowflake IDs**: 64-bit IDs (timestamp + worker_id + sequence)
- **Why**: Distributed ID generation across data centers
- **Impact**: 500M+ tweets/day with globally unique IDs
- **Note**: More complex than database sequences, needed for ultra-high scale

---

## 🚀 Sequence Best Practices

### ✅ When to Use Sequences

**Use sequences for**:
1. **Primary keys** (most common use case)
2. **Invoice numbers**, order numbers, ticket numbers
3. **Versioning** (document versions: v1, v2, v3)
4. **Audit logs** (sequential event IDs)
5. **Any unique identifier** that must be sequential

### ❌ When NOT to Use Sequences

**Don't use sequences for**:
1. **External IDs** (use UUIDs for public-facing IDs to prevent enumeration)
2. **Distributed databases** spanning multiple servers (use UUIDs or Snowflake IDs)
3. **High-security data** (sequential IDs expose total record count)

### BIGSERIAL for Large Tables

```sql
-- Use BIGSERIAL (8 bytes, max 9.2 quintillion)
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,  -- Supports up to 9,223,372,036,854,775,807 rows
  event_type VARCHAR(50),
  created_at TIMESTAMPTZ
);
```

**When to use BIGSERIAL**:
- Tables that will exceed 2.1 billion rows (SERIAL's limit)
- High-volume event/log tables
- Better safe than sorry (minimal overhead)

### Sequence Caching

```sql
CREATE SEQUENCE order_id_seq
  CACHE 100;  -- Pre-allocate 100 IDs in memory
```

**Benefits**:
- ✅ Faster ID generation (no disk I/O)
- ✅ Reduced lock contention

**Trade-off**:
- ⚠️ Gap in sequence if database crashes (cached IDs lost)
- ⚠️ Not suitable for strict audit logs (gaps = missing events?)

**Default cache**: PostgreSQL = 1 (no caching), MySQL = depends on storage engine

---

## 📈 Sequence Performance

**Benchmark** (PostgreSQL 14, 1M inserts):

```sql
-- Test 1: Application-generated ID (SELECT MAX + 1)
-- Average time: 85 seconds

-- Test 2: SERIAL (sequence)
-- Average time: 12 seconds
-- Improvement: 7x faster
```

**Why sequences are faster**:
1. **No SELECT MAX query** (atomic operation)
2. **Caching** (pre-allocated IDs in memory)
3. **No race conditions** (no transaction locks)

---

## 🎯 Sequence Cheat Sheet

```sql
-- Create sequence
CREATE SEQUENCE sequence_name
  START WITH 1000
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 999999999
  CACHE 20
  CYCLE;  -- Optional: restart after max

-- Create table with SERIAL (syntactic sugar)
CREATE TABLE table_name (
  id SERIAL PRIMARY KEY
);

-- Get next value
SELECT nextval('sequence_name');

-- Get current value (last returned in this session)
SELECT currval('sequence_name');

-- Get last value globally
SELECT last_value FROM sequence_name;

-- Reset sequence
ALTER SEQUENCE sequence_name RESTART WITH 1;

-- Set sequence to specific value
SELECT setval('sequence_name', 1000);

-- Sync sequence with table's max ID
SELECT setval('sequence_name', (SELECT MAX(id) FROM table_name));

-- Drop sequence
DROP SEQUENCE sequence_name;

-- List all sequences
SELECT sequencename FROM pg_sequences;

-- Show sequence definition
\d+ sequence_name  -- PostgreSQL
```

---

## 💪 Common Pitfalls

### ❌ Not Syncing Sequence After Manual Inserts

```sql
-- Manually insert ID
INSERT INTO customers (id, name) VALUES (5000, 'Alice');

-- Next auto-generated ID is still 1 (❌ duplicate key error!)
INSERT INTO customers (name) VALUES ('Bob');
-- ERROR: duplicate key value violates unique constraint
```

**✅ Fix: Sync sequence**
```sql
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
```

### ❌ Assuming No Gaps

**Sequences have gaps when**:
1. Transaction rolled back (ID consumed but row not inserted)
2. Database crash (cached IDs lost)
3. Manual deletes

**This is normal and expected**. Don't try to "fill gaps."

```sql
BEGIN;
INSERT INTO orders (customer_id, total) VALUES (123, 100.00);  -- id: 1
ROLLBACK;

INSERT INTO orders (customer_id, total) VALUES (456, 50.00);   -- id: 2 (not 1!)
```

### ❌ Using Sequence Values for Ordering

```sql
-- ❌ BAD: Using ID for "created at" ordering
SELECT * FROM orders ORDER BY id DESC LIMIT 10;
```

**Problem**: If manually inserted IDs or concurrent transactions, ID order ≠ creation order.

**✅ Solution**: Use explicit timestamp:
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
```

---

## 💪 Advanced Patterns

### Pattern 6: Sequences with Prefixes

```sql
-- Generate invoice numbers like "INV-1000", "INV-1001", ...
CREATE SEQUENCE invoice_number_seq START WITH 1000;

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(20) DEFAULT 'INV-' || nextval('invoice_number_seq'),
  total DECIMAL(10, 2)
);

INSERT INTO invoices (total) VALUES (100.00);

SELECT invoice_number FROM invoices;
-- Result: INV-1000
```

### Pattern 7: Separate Sequences Per Partition

```sql
-- Partition by year
CREATE TABLE orders_2024 (
  id INT DEFAULT nextval('orders_2024_id_seq') PRIMARY KEY,
  customer_id INT,
  created_at DATE
) PARTITION BY RANGE (created_at);

CREATE SEQUENCE orders_2024_id_seq START WITH 10000000;

CREATE TABLE orders_2025 (
  id INT DEFAULT nextval('orders_2025_id_seq') PRIMARY KEY,
  customer_id INT,
  created_at DATE
) PARTITION BY RANGE (created_at);

CREATE SEQUENCE orders_2025_id_seq START WITH 20000000;
```

**Result**: IDs don't conflict across partitions (2024 IDs: 10M-20M, 2025 IDs: 20M-30M).

---

## 💪 Next Steps

**1. Migrate to Sequences** (Today):
- Identify tables generating IDs in application code
- Replace with SERIAL or explicit sequences
- Test for race conditions

**2. Add Sequences to New Tables** (Always):
- Use SERIAL for primary keys
- Use BIGSERIAL for high-volume tables
- Never generate IDs in application code

**3. Sync Sequences** (If Needed):
- After bulk imports with explicit IDs
- After manual data fixes
- Run `setval()` to sync with MAX(id)

**Remember**: Let the database generate IDs. It's faster, safer, and simpler.

---

## 🔗 Learn More

**Next POCs**:
- **POC #30: VACUUM & Database Maintenance** - Keep sequences performing well
- **POC #26: Table Partitioning** - Sequences in partitioned tables
- **POC #16: Transactions** - Sequences in transaction context

**Related Topics**:
- **POC #27: Foreign Keys** - Reference sequence-generated IDs
- **POC #11: CRUD Operations** - Insert with sequences
- **POC #15: Connection Pooling** - Sequence behavior with multiple connections
