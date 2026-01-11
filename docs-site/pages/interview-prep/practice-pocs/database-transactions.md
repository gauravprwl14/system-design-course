# POC #16: Database Transactions & Isolation Levels

## What You'll Build

Master **ACID transactions and isolation levels** to prevent data corruption:
- ✅ **Transaction basics** - BEGIN, COMMIT, ROLLBACK
- ✅ **Isolation levels** - Read Uncommitted, Read Committed, Repeatable Read, Serializable
- ✅ **Concurrency problems** - Dirty reads, non-repeatable reads, phantom reads
- ✅ **Deadlock handling** - Detection and prevention
- ✅ **Real examples** - Banking transfers, inventory management

**Time to complete**: 25 minutes
**Difficulty**: ⭐⭐⭐ Advanced
**Prerequisites**: POC #11 (CRUD)

---

## Why This Matters

### Real-World Impact

| Company | Use Case | Transaction Strategy |
|---------|----------|---------------------|
| **Stripe** | Payment processing | Serializable isolation, idempotency keys |
| **Uber** | Trip pricing | Optimistic locking, retry logic |
| **Amazon** | Order checkout | Two-phase commit, saga pattern |
| **PayPal** | Money transfers | Distributed transactions, compensation |
| **Shopify** | Inventory updates | Row-level locking, SELECT FOR UPDATE |

### The Problem: Race Conditions

**Without transactions**:
```javascript
// Two users buy last item simultaneously
const stock = await db.query('SELECT stock FROM products WHERE id = 1');
// User A: stock = 1
// User B: stock = 1

if (stock.rows[0].stock > 0) {
  await db.query('UPDATE products SET stock = stock - 1 WHERE id = 1');
  // Both updates succeed → stock = -1 (OVERSOLD!)
}
```

**With transactions**:
```javascript
await db.query('BEGIN');
const stock = await db.query('SELECT stock FROM products WHERE id = 1 FOR UPDATE');

if (stock.rows[0].stock > 0) {
  await db.query('UPDATE products SET stock = stock - 1 WHERE id = 1');
  await db.query('COMMIT');
} else {
  await db.query('ROLLBACK');
  throw new Error('Out of stock');
}
// Second transaction waits → No overselling!
```

---

## Isolation Levels Explained

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Performance |
|-------|-----------|--------------------|--------------| ------------|
| **Read Uncommitted** | ✅ Possible | ✅ Possible | ✅ Possible | 🚀 Fastest |
| **Read Committed** | ❌ Prevented | ✅ Possible | ✅ Possible | 🏃 Fast (PostgreSQL default) |
| **Repeatable Read** | ❌ Prevented | ❌ Prevented | ✅ Possible | 🐌 Slower |
| **Serializable** | ❌ Prevented | ❌ Prevented | ❌ Prevented | 🐢 Slowest |

### Concurrency Anomalies

**Dirty Read**: Reading uncommitted data
```sql
-- Transaction A
UPDATE accounts SET balance = 1000 WHERE id = 1;
-- Not committed yet

-- Transaction B (dirty read)
SELECT balance FROM accounts WHERE id = 1;  -- Sees 1000

-- Transaction A
ROLLBACK;  -- Oops, data was never committed!

-- Transaction B used invalid data
```

**Non-Repeatable Read**: Same query returns different results
```sql
-- Transaction A
SELECT balance FROM accounts WHERE id = 1;  -- Returns 500

-- Transaction B
UPDATE accounts SET balance = 1000 WHERE id = 1;
COMMIT;

-- Transaction A (same query)
SELECT balance FROM accounts WHERE id = 1;  -- Returns 1000 (different!)
```

**Phantom Read**: New rows appear
```sql
-- Transaction A
SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- Returns 10

-- Transaction B
INSERT INTO orders (status) VALUES ('pending');
COMMIT;

-- Transaction A (same query)
SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- Returns 11 (phantom!)
```

---

## Step-by-Step Build

### Setup

```bash
mkdir transactions-poc && cd transactions-poc
npm init -y && npm install pg
```

### Schema

```sql
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  balance DECIMAL(10,2) NOT NULL CHECK (balance >= 0),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  price DECIMAL(10,2)
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  product_id INTEGER,
  quantity INTEGER,
  total DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sample data
INSERT INTO accounts (user_id, balance) VALUES
  (1, 1000.00),
  (2, 500.00),
  (3, 2000.00);

INSERT INTO products (name, stock, price) VALUES
  ('iPhone 15', 10, 999.99),
  ('MacBook Pro', 5, 2499.99),
  ('AirPods', 20, 199.99);
```

### Transaction Manager (`transactions.js`)

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'transactions_demo',
  user: 'postgres',
  password: 'password'
});

class TransactionManager {
  /**
   * Example 1: Money Transfer (Classic Transaction)
   */
  async transferMoney(fromAccountId, toAccountId, amount) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Debit from sender
      const debitResult = await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING balance',
        [amount, fromAccountId]
      );

      if (debitResult.rows[0].balance < 0) {
        throw new Error('Insufficient funds');
      }

      // Credit to receiver
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
        [amount, toAccountId]
      );

      await client.query('COMMIT');
      console.log(`✅ Transferred $${amount} from account ${fromAccountId} to ${toAccountId}`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Transfer failed: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Example 2: Purchase with Stock Check (Pessimistic Locking)
   */
  async purchaseProduct(userId, productId, quantity) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // SELECT FOR UPDATE locks the row
      const product = await client.query(
        'SELECT * FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (product.rows[0].stock < quantity) {
        throw new Error('Insufficient stock');
      }

      // Update stock
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [quantity, productId]
      );

      // Create order
      const total = product.rows[0].price * quantity;
      await client.query(
        'INSERT INTO orders (user_id, product_id, quantity, total, status) VALUES ($1, $2, $3, $4, $5)',
        [userId, productId, quantity, total, 'confirmed']
      );

      await client.query('COMMIT');
      console.log(`✅ Purchased ${quantity}x ${product.rows[0].name}`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Purchase failed: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Example 3: Optimistic Locking (Version-Based)
   */
  async updateAccountOptimistic(accountId, newBalance, expectedVersion) {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `UPDATE accounts
         SET balance = $1, version = version + 1, updated_at = NOW()
         WHERE id = $2 AND version = $3
         RETURNING *`,
        [newBalance, accountId, expectedVersion]
      );

      if (result.rowCount === 0) {
        throw new Error('Concurrent modification detected - version mismatch');
      }

      console.log(`✅ Updated account ${accountId} (optimistic locking)`);
      return result.rows[0];

    } catch (error) {
      console.error(`❌ Optimistic update failed: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Example 4: Demonstrate Isolation Levels
   */
  async demonstrateIsolation(level) {
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      console.log(`\n=== Testing ${level} Isolation ===\n`);

      // Set isolation level
      await client1.query(`BEGIN ISOLATION LEVEL ${level}`);
      await client2.query(`BEGIN ISOLATION LEVEL ${level}`);

      // Transaction 1: Read balance
      const read1 = await client1.query('SELECT balance FROM accounts WHERE id = 1');
      console.log(`T1 Read #1: balance = ${read1.rows[0].balance}`);

      // Transaction 2: Update balance
      await client2.query('UPDATE accounts SET balance = balance + 100 WHERE id = 1');
      console.log('T2 Updated balance (+100)');

      // Transaction 1: Read again (before T2 commits)
      const read2 = await client1.query('SELECT balance FROM accounts WHERE id = 1');
      console.log(`T1 Read #2: balance = ${read2.rows[0].balance}`);

      if (read1.rows[0].balance === read2.rows[0].balance) {
        console.log('✅ No non-repeatable read detected');
      } else {
        console.log('⚠️ Non-repeatable read occurred!');
      }

      await client2.query('COMMIT');
      console.log('T2 Committed');

      // Transaction 1: Read after T2 commits
      const read3 = await client1.query('SELECT balance FROM accounts WHERE id = 1');
      console.log(`T1 Read #3: balance = ${read3.rows[0].balance}`);

      await client1.query('COMMIT');

    } finally {
      client1.release();
      client2.release();
    }
  }

  /**
   * Example 5: Deadlock Demonstration
   */
  async demonstrateDeadlock() {
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      console.log('\n=== Demonstrating Deadlock ===\n');

      await client1.query('BEGIN');
      await client2.query('BEGIN');

      // T1 locks account 1
      console.log('T1: Locking account 1...');
      await client1.query('SELECT * FROM accounts WHERE id = 1 FOR UPDATE');
      console.log('T1: Locked account 1');

      // T2 locks account 2
      console.log('T2: Locking account 2...');
      await client2.query('SELECT * FROM accounts WHERE id = 2 FOR UPDATE');
      console.log('T2: Locked account 2');

      // T1 tries to lock account 2 (waits for T2)
      console.log('T1: Trying to lock account 2...');
      const t1Promise = client1.query('SELECT * FROM accounts WHERE id = 2 FOR UPDATE');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // T2 tries to lock account 1 (waits for T1) → DEADLOCK!
      console.log('T2: Trying to lock account 1...');
      const t2Promise = client2.query('SELECT * FROM accounts WHERE id = 1 FOR UPDATE');

      await Promise.race([t1Promise, t2Promise]);

    } catch (error) {
      console.error(`❌ Deadlock detected: ${error.message}`);
    } finally {
      try { await client1.query('ROLLBACK'); } catch (e) {}
      try { await client2.query('ROLLBACK'); } catch (e) {}
      client1.release();
      client2.release();
    }
  }
}

module.exports = TransactionManager;
```

### Demo Script (`demo.js`)

```javascript
const TransactionManager = require('./transactions');

async function runDemos() {
  const tm = new TransactionManager();

  console.log('\n=== Demo 1: Money Transfer ===');
  await tm.transferMoney(1, 2, 100);

  console.log('\n=== Demo 2: Purchase Product ===');
  await tm.purchaseProduct(1, 1, 2);

  console.log('\n=== Demo 3: Isolation Levels ===');
  await tm.demonstrateIsolation('READ COMMITTED');
  await tm.demonstrateIsolation('REPEATABLE READ');

  console.log('\n=== Demo 4: Deadlock ===');
  await tm.demonstrateDeadlock();

  process.exit(0);
}

runDemos().catch(console.error);
```

---

## Run It

```bash
# Start PostgreSQL
docker run -d --name postgres-txn \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=transactions_demo \
  -p 5432:5432 postgres:15-alpine

# Load schema
psql -h localhost -U postgres -d transactions_demo -f schema.sql

# Run demo
node demo.js
```

### Expected Output

```
=== Demo 1: Money Transfer ===
✅ Transferred $100 from account 1 to 2

=== Demo 2: Purchase Product ===
✅ Purchased 2x iPhone 15

=== Demo 3: Isolation Levels ===

=== Testing READ COMMITTED Isolation ===

T1 Read #1: balance = 900
T2 Updated balance (+100)
T1 Read #2: balance = 900
✅ No non-repeatable read detected
T2 Committed
T1 Read #3: balance = 1000

=== Testing REPEATABLE READ Isolation ===

T1 Read #1: balance = 1000
T2 Updated balance (+100)
T1 Read #2: balance = 1000
✅ No non-repeatable read detected
T2 Committed
T1 Read #3: balance = 1000

=== Demo 4: Deadlock ===

T1: Locking account 1...
T1: Locked account 1
T2: Locking account 2...
T2: Locked account 2
T1: Trying to lock account 2...
T2: Trying to lock account 1...
❌ Deadlock detected: deadlock detected
```

---

## Key Takeaways

### Transaction Best Practices

1. **Keep transactions short** - Long transactions hold locks
2. **Use appropriate isolation level** - Read Committed for most cases
3. **Handle rollbacks** - Always catch errors and ROLLBACK
4. **Avoid deadlocks** - Lock resources in consistent order
5. **Use SELECT FOR UPDATE** - Pessimistic locking for critical updates

### When to Use Each Isolation Level

| Use Case | Isolation Level | Why |
|----------|----------------|-----|
| **Banking transfers** | Serializable | Prevent any anomalies |
| **E-commerce checkout** | Repeatable Read | Prevent inventory overselling |
| **User profile updates** | Read Committed | Balance consistency and performance |
| **Analytics queries** | Read Uncommitted | Performance over accuracy |

### Pessimistic vs Optimistic Locking

**Pessimistic** (SELECT FOR UPDATE):
- ✅ Guarantees no conflicts
- ❌ Holds locks, reduces concurrency
- Use for: High contention (inventory, payments)

**Optimistic** (Version column):
- ✅ No locks, high concurrency
- ❌ Fails on conflict, requires retry
- Use for: Low contention (user profiles)

---

## Related POCs

- **POC #11: CRUD** - Foundation
- **POC #3: Distributed Lock** - Redis-based locking
- **POC #18: Sharding** - Distributed transactions

---

## Cleanup

```bash
docker stop postgres-txn && docker rm postgres-txn
rm -rf transactions-poc
```

---

**Production examples**:
- **Stripe**: Serializable isolation for payment processing
- **Uber**: Optimistic locking for trip updates
- **Amazon**: Two-phase commit for cross-service transactions
- **PayPal**: Saga pattern for distributed transactions

**Remember**: Transactions guarantee ACID properties - Atomicity, Consistency, Isolation, Durability!
