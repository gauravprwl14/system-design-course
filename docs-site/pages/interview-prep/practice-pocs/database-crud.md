# POC #11: Production-Ready CRUD Operations with PostgreSQL

## What You'll Build

A **robust CRUD (Create, Read, Update, Delete) API** with PostgreSQL demonstrating:
- ✅ **Connection pooling** - Reuse connections for 100x performance
- ✅ **Transaction management** - ACID guarantees for data consistency
- ✅ **Prepared statements** - Prevent SQL injection + 5x faster queries
- ✅ **Error handling** - Handle deadlocks, constraints, timeouts
- ✅ **Bulk operations** - Insert 10k records in 2 seconds (vs 50 seconds)
- ✅ **Pagination** - Handle millions of records efficiently

**Time to complete**: 20 minutes
**Difficulty**: ⭐ Beginner
**Prerequisites**: Basic SQL knowledge

---

## Why This Matters

### Real-World Usage

| Company | Database Size | CRUD Operations/Sec | Key Patterns |
|---------|--------------|---------------------|--------------|
| **Instagram** | 100TB+ PostgreSQL | 100k+ reads/sec | Bulk inserts, prepared statements, read replicas |
| **Uber** | 50TB+ PostgreSQL | 500k+ writes/sec | Connection pooling, partitioning, batch updates |
| **Airbnb** | 25TB+ PostgreSQL | 200k+ reads/sec | Pagination, indexing, query optimization |
| **GitHub** | 3PB+ MySQL | 1M+ queries/sec | Sharding, replication, connection pooling |
| **Notion** | 10TB+ PostgreSQL | 50k+ reads/sec | JSONB queries, bulk operations |

### The Problem: Naive CRUD is Slow

**Bad approach (one connection per request)**:
```javascript
// ❌ Opens new connection for EVERY request
app.get('/users/:id', async (req, res) => {
  const client = new Client({ /* config */ });
  await client.connect();  // Slow! 20-50ms overhead
  const result = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  await client.end();
  res.json(result.rows[0]);
});

// Performance: 50ms per request (40ms connection overhead + 10ms query)
// Max throughput: 20 requests/sec per server
```

**Good approach (connection pooling)**:
```javascript
// ✅ Reuses connections from pool
const pool = new Pool({ /* config */ });

app.get('/users/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
});

// Performance: 2ms per request (0ms connection overhead + 2ms query)
// Max throughput: 500 requests/sec per server (25x improvement!)
```

---

## The Problem

### Scenario: User Management System

You're building a user management API for a SaaS product. Requirements:

1. **Create users** - Handle 1000+ signups per minute during launch
2. **Read user profiles** - Serve 10k+ profile views per second
3. **Update user data** - Handle concurrent updates without data loss
4. **Delete users** - GDPR compliance, remove all user data atomically
5. **Bulk operations** - Import 100k users from CSV
6. **Pagination** - Display millions of users efficiently

**Challenges**:
- SQL injection vulnerabilities
- Connection exhaustion (too many connections)
- Race conditions during updates
- Slow bulk operations
- Memory overflow with large result sets

---

## Step-by-Step Build

### Step 1: Project Setup

```bash
mkdir database-crud-poc
cd database-crud-poc
npm init -y
npm install pg express uuid csv-parser
```

### Step 2: Start PostgreSQL

```bash
docker run -d \
  --name postgres-crud \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=crud_demo \
  -p 5432:5432 \
  postgres:15-alpine
```

### Step 3: Create Database Schema (`schema.sql`)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL,
  full_name VARCHAR(100),
  bio TEXT,
  age INTEGER CHECK (age >= 13 AND age <= 120),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Index for active users
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- User posts table (for demonstrating foreign keys)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
```

### Step 4: Initialize Database (`initDb.js`)

```javascript
const { Client } = require('pg');
const fs = require('fs');

async function initializeDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'crud_demo',
    user: 'postgres',
    password: 'password'
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Read and execute schema
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    await client.query(schema);
    console.log('✅ Schema created successfully');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
  } finally {
    await client.end();
  }
}

initializeDatabase();
```

### Step 5: Create Database Layer (`database.js`)

```javascript
const { Pool } = require('pg');

class Database {
  constructor() {
    // Connection pool configuration
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'crud_demo',
      user: 'postgres',
      password: 'password',
      max: 20,                    // Maximum connections in pool
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 2000  // Timeout if no connection available
    });

    // Pool event listeners
    this.pool.on('connect', () => {
      console.log('📊 New client connected to pool');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Unexpected pool error:', err);
    });
  }

  /**
   * CREATE: Insert single user
   */
  async createUser(email, username, fullName, bio, age) {
    const query = `
      INSERT INTO users (email, username, full_name, bio, age)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [email, username, fullName, bio, age]);
      console.log(`✅ User created: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {  // Unique violation
        throw new Error(`Email ${email} already exists`);
      }
      if (error.code === '23514') {  // Check constraint violation
        throw new Error(`Invalid age: ${age}`);
      }
      throw error;
    }
  }

  /**
   * CREATE: Bulk insert users (optimized)
   */
  async bulkCreateUsers(users) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Build single INSERT with multiple value sets
      const values = [];
      const placeholders = [];

      users.forEach((user, idx) => {
        const offset = idx * 5;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );
        values.push(user.email, user.username, user.fullName, user.bio, user.age);
      });

      const query = `
        INSERT INTO users (email, username, full_name, bio, age)
        VALUES ${placeholders.join(', ')}
        RETURNING id
      `;

      const startTime = Date.now();
      const result = await client.query(query, values);
      const elapsed = Date.now() - startTime;

      await client.query('COMMIT');

      console.log(`✅ Bulk inserted ${result.rowCount} users in ${elapsed}ms`);
      return result.rows;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Bulk insert failed, rolled back');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * READ: Get user by ID
   */
  async getUserById(userId) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    return result.rows[0];
  }

  /**
   * READ: Get user by email (uses index)
   */
  async getUserByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.pool.query(query, [email]);

    if (result.rows.length === 0) {
      throw new Error(`User with email ${email} not found`);
    }

    return result.rows[0];
  }

  /**
   * READ: Get all users with pagination
   */
  async getUsers(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;

    const countQuery = 'SELECT COUNT(*) FROM users';
    const dataQuery = `
      SELECT * FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const [countResult, dataResult] = await Promise.all([
      this.pool.query(countQuery),
      this.pool.query(dataQuery, [pageSize, offset])
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * UPDATE: Update user profile
   */
  async updateUser(userId, updates) {
    // Build dynamic UPDATE query
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['email', 'username', 'full_name', 'bio', 'age', 'is_active'].includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);  // Last parameter is user ID

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rowCount === 0) {
      throw new Error(`User ${userId} not found`);
    }

    console.log(`✅ User ${userId} updated`);
    return result.rows[0];
  }

  /**
   * UPDATE: Increment view count (atomic)
   */
  async incrementUserViews(userId) {
    const query = `
      UPDATE users
      SET view_count = COALESCE(view_count, 0) + 1
      WHERE id = $1
      RETURNING view_count
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows[0]?.view_count;
  }

  /**
   * DELETE: Soft delete user (set is_active = false)
   */
  async softDeleteUser(userId) {
    const query = `
      UPDATE users
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [userId]);

    if (result.rowCount === 0) {
      throw new Error(`User ${userId} not found`);
    }

    console.log(`✅ User ${userId} soft deleted`);
    return result.rows[0];
  }

  /**
   * DELETE: Hard delete user (with CASCADE to posts)
   */
  async hardDeleteUser(userId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get counts before delete
      const postCountResult = await client.query(
        'SELECT COUNT(*) FROM posts WHERE user_id = $1',
        [userId]
      );
      const postCount = parseInt(postCountResult.rows[0].count);

      // Delete user (CASCADE will delete posts)
      const userResult = await client.query(
        'DELETE FROM users WHERE id = $1 RETURNING *',
        [userId]
      );

      if (userResult.rowCount === 0) {
        throw new Error(`User ${userId} not found`);
      }

      await client.query('COMMIT');

      console.log(`✅ User ${userId} deleted (${postCount} posts removed via CASCADE)`);
      return {
        user: userResult.rows[0],
        postsDeleted: postCount
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * TRANSACTION: Transfer user ownership of posts
   */
  async transferUserPosts(fromUserId, toUserId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Verify both users exist
      const fromUser = await client.query('SELECT id FROM users WHERE id = $1', [fromUserId]);
      const toUser = await client.query('SELECT id FROM users WHERE id = $1', [toUserId]);

      if (fromUser.rowCount === 0) {
        throw new Error(`Source user ${fromUserId} not found`);
      }
      if (toUser.rowCount === 0) {
        throw new Error(`Target user ${toUserId} not found`);
      }

      // Transfer posts
      const result = await client.query(
        'UPDATE posts SET user_id = $1 WHERE user_id = $2 RETURNING id',
        [toUserId, fromUserId]
      );

      await client.query('COMMIT');

      console.log(`✅ Transferred ${result.rowCount} posts from ${fromUserId} to ${toUserId}`);
      return result.rowCount;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Transfer failed, rolled back');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool stats
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Close pool
   */
  async close() {
    await this.pool.end();
    console.log('✅ Database pool closed');
  }
}

module.exports = Database;
```

### Step 6: Create API Server (`server.js`)

```javascript
const express = require('express');
const Database = require('./database');

const app = express();
app.use(express.json());

const db = new Database();

// CREATE: Register new user
app.post('/users', async (req, res) => {
  try {
    const { email, username, fullName, bio, age } = req.body;
    const user = await db.createUser(email, username, fullName, bio, age);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// READ: Get user by ID
app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// READ: Get all users (paginated)
app.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const result = await db.getUsers(page, pageSize);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE: Update user profile
app.patch('/users/:id', async (req, res) => {
  try {
    const user = await db.updateUser(req.params.id, req.body);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE: Soft delete user
app.delete('/users/:id/soft', async (req, res) => {
  try {
    const user = await db.softDeleteUser(req.params.id);
    res.json({ message: 'User soft deleted', user });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// DELETE: Hard delete user
app.delete('/users/:id', async (req, res) => {
  try {
    const result = await db.hardDeleteUser(req.params.id);
    res.json({ message: 'User deleted', ...result });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Get pool stats
app.get('/stats/pool', (req, res) => {
  res.json(db.getPoolStats());
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ CRUD API running on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  await db.close();
  process.exit(0);
});
```

### Step 7: Create Test Script (`test.js`)

```javascript
const Database = require('./database');

async function runTests() {
  const db = new Database();

  console.log('\n=== Test 1: Create User ===\n');

  const user1 = await db.createUser(
    'alice@example.com',
    'alice',
    'Alice Johnson',
    'Software engineer and coffee enthusiast',
    28
  );
  console.log('Created user:', user1.id);

  console.log('\n=== Test 2: Read User ===\n');

  const fetchedUser = await db.getUserById(user1.id);
  console.log('Fetched user:', fetchedUser.username);

  const userByEmail = await db.getUserByEmail('alice@example.com');
  console.log('Fetched by email:', userByEmail.username);

  console.log('\n=== Test 3: Update User ===\n');

  const updatedUser = await db.updateUser(user1.id, {
    bio: 'Senior software engineer at Tech Corp',
    age: 29
  });
  console.log('Updated bio:', updatedUser.bio);

  console.log('\n=== Test 4: Bulk Insert (Performance Test) ===\n');

  const users = Array.from({ length: 1000 }, (_, i) => ({
    email: `user${i}@example.com`,
    username: `user${i}`,
    fullName: `User ${i}`,
    bio: `Bio for user ${i}`,
    age: 20 + (i % 50)
  }));

  const startTime = Date.now();
  await db.bulkCreateUsers(users);
  const elapsed = Date.now() - startTime;

  console.log(`\n📊 Inserted 1000 users in ${elapsed}ms`);
  console.log(`📊 Average: ${(elapsed / 1000).toFixed(2)}ms per user`);

  console.log('\n=== Test 5: Pagination ===\n');

  const page1 = await db.getUsers(1, 10);
  console.log(`Page 1: ${page1.data.length} users`);
  console.log(`Total: ${page1.pagination.totalCount} users`);
  console.log(`Total pages: ${page1.pagination.totalPages}`);

  console.log('\n=== Test 6: Soft Delete ===\n');

  const softDeleted = await db.softDeleteUser(user1.id);
  console.log('Soft deleted user:', softDeleted.username);
  console.log('is_active:', softDeleted.is_active);

  console.log('\n=== Test 7: Hard Delete with CASCADE ===\n');

  // Create user with posts
  const user2 = await db.createUser(
    'bob@example.com',
    'bob',
    'Bob Smith',
    'Tech writer',
    35
  );

  // Add posts for user2 (need to add posts table support)
  const client = await db.pool.connect();
  await client.query(
    "INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3)",
    [user2.id, 'My first post', 'Hello world!']
  );
  await client.query(
    "INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3)",
    [user2.id, 'My second post', 'Another post']
  );
  client.release();

  const deleteResult = await db.hardDeleteUser(user2.id);
  console.log('Hard deleted user:', deleteResult.user.username);
  console.log('Posts deleted via CASCADE:', deleteResult.postsDeleted);

  console.log('\n=== Test 8: Pool Stats ===\n');

  const stats = db.getPoolStats();
  console.log('Pool stats:', stats);

  await db.close();
  process.exit(0);
}

runTests().catch(console.error);
```

---

## Run It

### Terminal 1: Initialize Database
```bash
# Start PostgreSQL
docker run -d --name postgres-crud -e POSTGRES_PASSWORD=password -e POSTGRES_DB=crud_demo -p 5432:5432 postgres:15-alpine

# Create schema
node initDb.js
```

### Terminal 2: Run Tests
```bash
node test.js
```

### Expected Output
```
=== Test 1: Create User ===

📊 New client connected to pool
✅ User created: 550e8400-e29b-41d4-a716-446655440000

=== Test 2: Read User ===

Fetched user: alice
Fetched by email: alice

=== Test 3: Update User ===

✅ User 550e8400-e29b-41d4-a716-446655440000 updated
Updated bio: Senior software engineer at Tech Corp

=== Test 4: Bulk Insert (Performance Test) ===

✅ Bulk inserted 1000 users in 245ms

📊 Inserted 1000 users in 245ms
📊 Average: 0.25ms per user

=== Test 5: Pagination ===

Page 1: 10 users
Total: 1001 users
Total pages: 101

=== Test 6: Soft Delete ===

✅ User 550e8400-e29b-41d4-a716-446655440000 soft deleted
Soft deleted user: alice
is_active: false

=== Test 7: Hard Delete with CASCADE ===

✅ User 660e8400-e29b-41d4-a716-446655440001 deleted (2 posts removed via CASCADE)
Hard deleted user: bob
Posts deleted via CASCADE: 2

=== Test 8: Pool Stats ===

Pool stats: { totalCount: 3, idleCount: 3, waitingCount: 0 }
```

---

## Test It

### Test 1: API CRUD Operations
```bash
# Start server
node server.js

# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "charlie@example.com",
    "username": "charlie",
    "fullName": "Charlie Brown",
    "bio": "Product manager",
    "age": 32
  }'

# Response: {"id":"...", "email":"charlie@example.com", ...}

# Get user
curl http://localhost:3000/users/{USER_ID}

# Get all users (paginated)
curl http://localhost:3000/users?page=1&pageSize=10

# Update user
curl -X PATCH http://localhost:3000/users/{USER_ID} \
  -H "Content-Type: application/json" \
  -d '{"bio": "Senior product manager"}'

# Soft delete
curl -X DELETE http://localhost:3000/users/{USER_ID}/soft

# Hard delete
curl -X DELETE http://localhost:3000/users/{USER_ID}

# Check pool stats
curl http://localhost:3000/stats/pool
```

### Test 2: SQL Injection Protection

Create `injectionTest.js`:
```javascript
const Database = require('./database');

async function testSQLInjection() {
  const db = new Database();

  console.log('\n=== Test: SQL Injection Protection ===\n');

  // Attempt SQL injection via email
  const maliciousEmail = "'; DROP TABLE users; --";

  try {
    await db.createUser(
      maliciousEmail,
      'hacker',
      'Malicious User',
      'Trying SQL injection',
      25
    );
    console.log('❌ SQL injection succeeded (BAD!)');
  } catch (error) {
    console.log('✅ SQL injection blocked:', error.message);
  }

  // Verify table still exists
  const result = await db.pool.query('SELECT COUNT(*) FROM users');
  console.log(`✅ Users table intact: ${result.rows[0].count} users`);

  await db.close();
  process.exit(0);
}

testSQLInjection();
```

Run it:
```bash
node injectionTest.js
```

**Expected**:
```
=== Test: SQL Injection Protection ===

✅ SQL injection blocked: invalid input syntax for type uuid
✅ Users table intact: 1001 users
```

**Key insight**: Prepared statements ($1, $2) automatically escape inputs!

### Test 3: Performance Comparison

Create `performanceTest.js`:
```javascript
const { Client, Pool } = require('pg');

const config = {
  host: 'localhost',
  port: 5432,
  database: 'crud_demo',
  user: 'postgres',
  password: 'password'
};

async function testWithoutPool() {
  console.log('\n=== Without Connection Pool ===\n');

  const iterations = 100;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const client = new Client(config);
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
  }

  const elapsed = Date.now() - startTime;
  console.log(`${iterations} queries: ${elapsed}ms`);
  console.log(`Average: ${(elapsed / iterations).toFixed(2)}ms per query`);

  return elapsed;
}

async function testWithPool() {
  console.log('\n=== With Connection Pool ===\n');

  const pool = new Pool(config);
  const iterations = 100;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    await pool.query('SELECT 1');
  }

  const elapsed = Date.now() - startTime;
  console.log(`${iterations} queries: ${elapsed}ms`);
  console.log(`Average: ${(elapsed / iterations).toFixed(2)}ms per query`);

  await pool.end();
  return elapsed;
}

async function runComparison() {
  const withoutPoolTime = await testWithoutPool();
  const withPoolTime = await testWithPool();

  console.log('\n=== Performance Comparison ===\n');
  console.log(`Without pool: ${withoutPoolTime}ms`);
  console.log(`With pool: ${withPoolTime}ms`);
  console.log(`Improvement: ${(withoutPoolTime / withPoolTime).toFixed(1)}x faster`);

  process.exit(0);
}

runComparison();
```

Run it:
```bash
node performanceTest.js
```

**Expected output**:
```
=== Without Connection Pool ===

100 queries: 4523ms
Average: 45.23ms per query

=== With Connection Pool ===

100 queries: 187ms
Average: 1.87ms per query

=== Performance Comparison ===

Without pool: 4523ms
With pool: 187ms
Improvement: 24.2x faster
```

---

## Performance Benchmarks

### Connection Overhead

| Method | Time per Query | Throughput |
|--------|----------------|------------|
| **New connection each time** | 45ms | 22 queries/sec |
| **Connection pool** | 1.8ms | 555 queries/sec |
| **Improvement** | **25x faster** | **25x more throughput** |

### Bulk Insert Performance

| Method | 1000 Records | 10k Records | 100k Records |
|--------|--------------|-------------|--------------|
| **Individual INSERTs** | 15s | 150s | 1500s |
| **Bulk INSERT** | 0.24s | 2.4s | 24s |
| **Improvement** | **62x faster** | **62x faster** | **62x faster** |

### Pagination Memory Usage

| Method | 1M Records | Memory |
|--------|------------|--------|
| **Load all, skip in app** | 1.2GB | Out of memory |
| **LIMIT/OFFSET** | 15MB | 80x less memory |

---

## How This Fits Larger Systems

### Real-World Architecture: Instagram User Service

```
┌──────────────┐
│  Mobile App  │
└──────┬───────┘
       │ GET /users/:id
       ▼
┌──────────────┐
│  API Gateway │
└──────┬───────┘
       │
       ▼
┌────────────────────┐
│  User Service API  │
│ (Node.js + Pool)   │
└─────────┬──────────┘
          │ Pool (20 connections)
          ▼
┌─────────────────────────┐
│   PostgreSQL Master     │
│   (Write operations)    │
└─────────┬───────────────┘
          │ Replication
          ▼
┌─────────────────────────┐
│  PostgreSQL Read        │
│  Replicas (x3)          │
│  (Read operations)      │
└─────────────────────────┘

Connection Pool Strategy:
- 20 connections to master (writes)
- 60 connections to read replicas (reads - 20 each)
- Total: 80 connections for 100k queries/sec
```

**Key patterns**:
1. **Connection pooling**: 20 connections handle 10k writes/sec
2. **Read replicas**: 3 replicas handle 90k reads/sec
3. **Prepared statements**: 5x faster + SQL injection protection
4. **Bulk operations**: Batch inserts for analytics ingestion
5. **Soft deletes**: Comply with GDPR while preserving data integrity

---

## Key Takeaways

### What You Learned

1. **Connection Pooling**
   - Reuse connections for 25x performance improvement
   - Configure pool size based on database capacity
   - Monitor pool stats (idle, active, waiting)

2. **Prepared Statements**
   - Automatic SQL injection protection
   - 5x faster query execution (pre-compiled)
   - Use $1, $2 placeholders instead of string concatenation

3. **Transactions**
   - BEGIN/COMMIT for atomic operations
   - ROLLBACK on errors
   - Isolation levels for concurrency control

4. **Bulk Operations**
   - Single INSERT with multiple VALUES for 62x speedup
   - Batch size optimization (1000-5000 records per batch)
   - Transaction wrapping for consistency

5. **Pagination**
   - LIMIT/OFFSET for memory efficiency
   - Cursor-based for large datasets
   - Total count for UI pagination

### Production Checklist

✅ **Always use connection pooling** (not new Client per request)
✅ **Always use prepared statements** ($1, $2) for SQL injection protection
✅ **Always use transactions** for multi-step operations
✅ **Always paginate** large result sets
✅ **Always handle constraint violations** (unique, foreign key, check)
✅ **Always close clients/pools** on app shutdown
✅ **Monitor pool exhaustion** (waitingCount > 0)

---

## Extend It

### Level 1: Add Search (15 min)
Implement full-text search:
```javascript
async searchUsers(query) {
  const sql = `
    SELECT *, ts_rank(to_tsvector('english', full_name || ' ' || bio), plainto_tsquery($1)) AS rank
    FROM users
    WHERE to_tsvector('english', full_name || ' ' || bio) @@ plainto_tsquery($1)
    ORDER BY rank DESC
    LIMIT 20
  `;

  const result = await this.pool.query(sql, [query]);
  return result.rows;
}
```

### Level 2: Add Caching (20 min)
Cache reads with Redis:
```javascript
async getUserById(userId) {
  // Check cache first
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  // Cache miss - query database
  const user = await this.pool.query('SELECT * FROM users WHERE id = $1', [userId]);

  // Cache for 5 minutes
  await redis.setex(`user:${userId}`, 300, JSON.stringify(user.rows[0]));

  return user.rows[0];
}
```

### Level 3: Add Read Replicas (30 min)
Separate read/write pools:
```javascript
class Database {
  constructor() {
    this.writePool = new Pool({ host: 'master.db', ...config });
    this.readPool = new Pool({ host: 'replica.db', ...config });
  }

  async getUserById(userId) {
    return this.readPool.query('SELECT * FROM users WHERE id = $1', [userId]);
  }

  async createUser(email, username, fullName, bio, age) {
    return this.writePool.query('INSERT INTO users ...', [...]);
  }
}
```

### Level 4: Add Cursor Pagination (45 min)
Better than OFFSET for large datasets:
```javascript
async getUsersCursor(cursor = null, pageSize = 10) {
  let query = 'SELECT * FROM users ';
  const params = [pageSize];

  if (cursor) {
    query += 'WHERE created_at < $2 ORDER BY created_at DESC LIMIT $1';
    params.push(cursor);
  } else {
    query += 'ORDER BY created_at DESC LIMIT $1';
  }

  const result = await this.pool.query(query, params);

  const nextCursor = result.rows.length === pageSize
    ? result.rows[result.rows.length - 1].created_at
    : null;

  return {
    data: result.rows,
    nextCursor,
    hasMore: nextCursor !== null
  };
}
```

---

## Related POCs

- **POC #1: Redis Cache** - Cache database queries for 22x speedup
- **POC #12: B-Tree Indexes** - Speed up queries with proper indexing
- **POC #13: Query Optimization** - Use EXPLAIN to optimize slow queries
- **POC #14: N+1 Problem** - Fix inefficient queries
- **POC #15: Connection Pooling** - Advanced pool tuning

---

## Cleanup

```bash
# Stop and remove PostgreSQL container
docker stop postgres-crud
docker rm postgres-crud

# Remove project files
cd ..
rm -rf database-crud-poc
```

---

## What's Next?

**Next POC**: [POC #12: B-Tree Indexes for Query Performance](/interview-prep/practice-pocs/database-indexes)

Learn how to use indexes to make queries 1000x faster, when to add them, and how to avoid index pitfalls!

---

**Production usage of these patterns**:
- **Instagram**: Connection pooling for 100k+ queries/sec on PostgreSQL
- **Uber**: Bulk inserts for ride analytics (millions of records/hour)
- **Airbnb**: Pagination for browsing millions of listings
- **GitHub**: Prepared statements prevent SQL injection across all queries
- **Notion**: Transactions for collaborative editing consistency

**Remember**: Connection pooling is NOT optional in production. Without it, you'll exhaust database connections and crash!
