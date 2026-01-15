# POC #94: Database Testing Patterns

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Node.js, SQL basics, Testing fundamentals

## What You'll Learn

Database testing ensures data integrity, query correctness, and performance. This covers unit testing repositories, integration testing with real databases, and data seeding strategies.

```
DATABASE TESTING PYRAMID:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      ┌─────────┐                                │
│                     /  E2E     \     Few, slow, expensive       │
│                    /  Tests     \                               │
│                   ┌─────────────┐                               │
│                  / Integration   \   Some, medium speed         │
│                 /    Tests        \                             │
│                ┌───────────────────┐                            │
│               /    Repository       \  Many, fast, cheap        │
│              /    Unit Tests         \                          │
│             └─────────────────────────┘                         │
│                                                                 │
│  STRATEGIES:                                                    │
│  ─────────────────────────────────────                         │
│  Unit Tests:        Mock the database                           │
│  Integration Tests: Real DB in Docker                           │
│  E2E Tests:         Full application with seeded data           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// database-testing.js

// ==========================================
// TEST DATABASE MANAGER
// ==========================================

class TestDatabaseManager {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.schemas = new Map();
  }

  async connect() {
    // In real code: use pg, mysql2, etc.
    console.log(`📦 Connecting to test database: ${this.config.database}`);
    this.pool = new MockPool();
    return this;
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      console.log('📦 Disconnected from test database');
    }
  }

  // Create isolated schema for test suite
  async createSchema(name) {
    const schemaName = `test_${name}_${Date.now()}`;
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    this.schemas.set(name, schemaName);
    console.log(`📋 Created schema: ${schemaName}`);
    return schemaName;
  }

  // Drop schema after tests
  async dropSchema(name) {
    const schemaName = this.schemas.get(name);
    if (schemaName) {
      await this.pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      this.schemas.delete(name);
      console.log(`🗑️ Dropped schema: ${schemaName}`);
    }
  }

  // Run migrations
  async migrate(schemaName) {
    const migrations = [
      `CREATE TABLE ${schemaName}.users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE ${schemaName}.orders (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES ${schemaName}.users(id),
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX idx_orders_user ON ${schemaName}.orders(user_id)`,
      `CREATE INDEX idx_orders_status ON ${schemaName}.orders(status)`
    ];

    for (const migration of migrations) {
      await this.pool.query(migration);
    }
    console.log(`🔄 Applied ${migrations.length} migrations`);
  }

  // Truncate all tables
  async truncateAll(schemaName) {
    await this.pool.query(`
      TRUNCATE TABLE ${schemaName}.orders CASCADE;
      TRUNCATE TABLE ${schemaName}.users CASCADE;
    `);
    console.log(`🧹 Truncated all tables in ${schemaName}`);
  }
}

// ==========================================
// TEST DATA FACTORY
// ==========================================

class TestDataFactory {
  constructor(pool, schemaName) {
    this.pool = pool;
    this.schema = schemaName;
    this.sequences = new Map();
  }

  // Generate unique sequence
  sequence(name) {
    const current = this.sequences.get(name) || 0;
    this.sequences.set(name, current + 1);
    return current + 1;
  }

  // Create user with defaults
  async createUser(overrides = {}) {
    const seq = this.sequence('user');
    const user = {
      email: `user${seq}@test.com`,
      name: `Test User ${seq}`,
      ...overrides
    };

    const result = await this.pool.query(
      `INSERT INTO ${this.schema}.users (email, name) VALUES ($1, $2) RETURNING *`,
      [user.email, user.name]
    );

    return result.rows[0];
  }

  // Create order with defaults
  async createOrder(userId, overrides = {}) {
    const order = {
      total: 99.99,
      status: 'pending',
      ...overrides
    };

    const result = await this.pool.query(
      `INSERT INTO ${this.schema}.orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *`,
      [userId, order.total, order.status]
    );

    return result.rows[0];
  }

  // Create complete test scenario
  async createScenario(name) {
    switch (name) {
      case 'user-with-orders':
        const user = await this.createUser();
        const orders = await Promise.all([
          this.createOrder(user.id, { status: 'completed', total: 50 }),
          this.createOrder(user.id, { status: 'completed', total: 75 }),
          this.createOrder(user.id, { status: 'pending', total: 100 })
        ]);
        return { user, orders };

      case 'multiple-users':
        const users = await Promise.all([
          this.createUser({ name: 'Alice' }),
          this.createUser({ name: 'Bob' }),
          this.createUser({ name: 'Charlie' })
        ]);
        return { users };

      default:
        throw new Error(`Unknown scenario: ${name}`);
    }
  }
}

// ==========================================
// REPOSITORY (Code Under Test)
// ==========================================

class UserRepository {
  constructor(pool, schema) {
    this.pool = pool;
    this.schema = schema;
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT * FROM ${this.schema}.users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email) {
    const result = await this.pool.query(
      `SELECT * FROM ${this.schema}.users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  async create(userData) {
    const result = await this.pool.query(
      `INSERT INTO ${this.schema}.users (email, name) VALUES ($1, $2) RETURNING *`,
      [userData.email, userData.name]
    );
    return result.rows[0];
  }

  async update(id, updates) {
    const result = await this.pool.query(
      `UPDATE ${this.schema}.users SET name = $2 WHERE id = $1 RETURNING *`,
      [id, updates.name]
    );
    return result.rows[0];
  }

  async delete(id) {
    const result = await this.pool.query(
      `DELETE FROM ${this.schema}.users WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }
}

class OrderRepository {
  constructor(pool, schema) {
    this.pool = pool;
    this.schema = schema;
  }

  async findByUser(userId) {
    const result = await this.pool.query(
      `SELECT * FROM ${this.schema}.orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async getUserOrderStats(userId) {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_orders,
        SUM(total) as total_spent,
        AVG(total) as avg_order_value
       FROM ${this.schema}.orders
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    return result.rows[0];
  }
}

// ==========================================
// TEST RUNNER
// ==========================================

class DatabaseTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  describe(name, fn) {
    this.currentSuite = name;
    fn();
    this.currentSuite = null;
  }

  it(name, testFn) {
    this.tests.push({
      suite: this.currentSuite,
      name,
      fn: testFn
    });
  }

  async run(context) {
    console.log('\n🧪 Running database tests...\n');

    for (const test of this.tests) {
      const fullName = test.suite ? `${test.suite} > ${test.name}` : test.name;

      try {
        await test.fn(context);
        this.results.push({ name: fullName, passed: true });
        console.log(`  ✅ ${fullName}`);
      } catch (error) {
        this.results.push({ name: fullName, passed: false, error: error.message });
        console.log(`  ❌ ${fullName}`);
        console.log(`     Error: ${error.message}`);
      }
    }

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    return { passed, failed, results: this.results };
  }
}

// Assertion helpers
function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected truthy value, got ${actual}`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`Expected falsy value, got ${actual}`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, got ${actual}`);
    },
    toHaveLength: (length) => {
      if (actual.length !== length) {
        throw new Error(`Expected length ${length}, got ${actual.length}`);
      }
    },
    toBeGreaterThan: (value) => {
      if (actual <= value) {
        throw new Error(`Expected ${actual} to be greater than ${value}`);
      }
    }
  };
}

// ==========================================
// MOCK POOL (for demo)
// ==========================================

class MockPool {
  constructor() {
    this.data = { users: [], orders: [] };
    this.idCounters = { users: 0, orders: 0 };
  }

  async query(sql, params = []) {
    // Simplified SQL parsing for demo
    if (sql.includes('INSERT INTO') && sql.includes('users')) {
      const user = {
        id: ++this.idCounters.users,
        email: params[0],
        name: params[1],
        created_at: new Date()
      };
      this.data.users.push(user);
      return { rows: [user], rowCount: 1 };
    }

    if (sql.includes('INSERT INTO') && sql.includes('orders')) {
      const order = {
        id: ++this.idCounters.orders,
        user_id: params[0],
        total: params[1],
        status: params[2],
        created_at: new Date()
      };
      this.data.orders.push(order);
      return { rows: [order], rowCount: 1 };
    }

    if (sql.includes('SELECT') && sql.includes('users') && sql.includes('id =')) {
      const user = this.data.users.find(u => u.id === params[0]);
      return { rows: user ? [user] : [] };
    }

    if (sql.includes('SELECT') && sql.includes('users') && sql.includes('email =')) {
      const user = this.data.users.find(u => u.email === params[0]);
      return { rows: user ? [user] : [] };
    }

    if (sql.includes('SELECT') && sql.includes('orders') && sql.includes('user_id')) {
      const orders = this.data.orders.filter(o => o.user_id === params[0]);
      return { rows: orders };
    }

    if (sql.includes('UPDATE') && sql.includes('users')) {
      const user = this.data.users.find(u => u.id === params[0]);
      if (user) user.name = params[1];
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    if (sql.includes('DELETE') && sql.includes('users')) {
      const index = this.data.users.findIndex(u => u.id === params[0]);
      if (index >= 0) this.data.users.splice(index, 1);
      return { rowCount: index >= 0 ? 1 : 0 };
    }

    if (sql.includes('COUNT') && sql.includes('orders')) {
      const orders = this.data.orders.filter(o =>
        o.user_id === params[0] && o.status === 'completed'
      );
      return {
        rows: [{
          total_orders: orders.length,
          total_spent: orders.reduce((sum, o) => sum + o.total, 0),
          avg_order_value: orders.length > 0
            ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length
            : 0
        }]
      };
    }

    return { rows: [], rowCount: 0 };
  }

  async end() {}
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('DATABASE TESTING PATTERNS');
  console.log('='.repeat(60));

  // Setup
  const dbManager = new TestDatabaseManager({ database: 'test_db' });
  await dbManager.connect();

  const schemaName = 'test_schema';
  const pool = dbManager.pool;
  const factory = new TestDataFactory(pool, schemaName);

  const userRepo = new UserRepository(pool, schemaName);
  const orderRepo = new OrderRepository(pool, schemaName);

  // Define tests
  const runner = new DatabaseTestRunner();

  runner.describe('UserRepository', () => {
    runner.it('creates a new user', async () => {
      const user = await userRepo.create({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(user.id).toBeTruthy();
      expect(user.email).toBe('test@example.com');
    });

    runner.it('finds user by id', async () => {
      const created = await factory.createUser({ name: 'Find Me' });
      const found = await userRepo.findById(created.id);

      expect(found).toBeTruthy();
      expect(found.name).toBe('Find Me');
    });

    runner.it('finds user by email', async () => {
      await factory.createUser({ email: 'unique@test.com' });
      const found = await userRepo.findByEmail('unique@test.com');

      expect(found).toBeTruthy();
    });

    runner.it('returns null for non-existent user', async () => {
      const found = await userRepo.findById(99999);
      expect(found).toBeNull();
    });

    runner.it('updates user name', async () => {
      const user = await factory.createUser({ name: 'Original' });
      const updated = await userRepo.update(user.id, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
    });

    runner.it('deletes user', async () => {
      const user = await factory.createUser();
      const deleted = await userRepo.delete(user.id);

      expect(deleted).toBeTruthy();
    });
  });

  runner.describe('OrderRepository', () => {
    runner.it('finds orders by user', async () => {
      const { user, orders } = await factory.createScenario('user-with-orders');
      const found = await orderRepo.findByUser(user.id);

      expect(found).toHaveLength(3);
    });

    runner.it('calculates user order stats', async () => {
      const { user } = await factory.createScenario('user-with-orders');
      const stats = await orderRepo.getUserOrderStats(user.id);

      expect(stats.total_orders).toBe(2);  // Only completed
      expect(stats.total_spent).toBe(125);  // 50 + 75
    });
  });

  // Run tests
  await runner.run({ userRepo, orderRepo, factory });

  // Cleanup
  await dbManager.disconnect();

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Testing Strategies

| Strategy | When to Use | Pros | Cons |
|----------|-------------|------|------|
| **In-Memory DB** | Unit tests | Fast, isolated | Limited SQL support |
| **Docker Container** | Integration | Real DB behavior | Slower setup |
| **Shared Test DB** | CI pipeline | Simple setup | Potential conflicts |
| **Transaction Rollback** | Any | Clean after each test | Connection overhead |

---

## Best Practices

```
✅ DO:
├── Use factories for test data
├── Isolate tests (schema/transaction)
├── Test edge cases and constraints
├── Clean up after each test
├── Use realistic data volumes
└── Test indexes with EXPLAIN

❌ DON'T:
├── Share state between tests
├── Hardcode IDs
├── Test framework code
├── Skip constraint testing
├── Ignore query performance
└── Use production data
```

---

## Related POCs

- [Integration Testing](/interview-prep/practice-pocs/integration-testing)
- [Connection Pooling](/interview-prep/practice-pocs/database-connection-pooling)
- [Database Transactions](/interview-prep/practice-pocs/database-transactions)
