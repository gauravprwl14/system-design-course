# Database Scaling Strategies

## Question
**"How do you scale a database to handle millions of users? Explain vertical vs horizontal scaling, read replicas, and sharding."**

Common in: System Design, Backend, Database Architecture interviews

---

## 📊 Quick Answer

| Strategy | How It Works | Pros | Cons | Use Case |
|----------|--------------|------|------|----------|
| **Vertical Scaling** | Bigger server (more CPU/RAM) | Simple, no code changes | Limited, expensive | Quick fix, small-medium apps |
| **Read Replicas** | Copy DB for reads | Easy, 10x read capacity | Write bottleneck remains | Read-heavy apps (90% reads) |
| **Sharding** | Split data across servers | Unlimited scaling | Complex, rebalancing hard | Multi-tenant, global apps |
| **Caching** | Redis/Memcached | 100x faster reads | Stale data risk | All apps |
| **Connection Pooling** | Reuse connections | Reduce overhead | Limited connections | All apps |

**Scaling Ladder** (in order):
1. **Optimize queries** (indexes, EXPLAIN ANALYZE)
2. **Add caching** (Redis)
3. **Connection pooling**
4. **Vertical scaling** (bigger server)
5. **Read replicas** (for read-heavy)
6. **Sharding** (for massive scale)

---

## 🎯 Complete Solutions

### 1. Vertical Scaling (Scale Up)

**Definition**: Increase server resources (CPU, RAM, disk)

```
Before: 4 CPU, 16GB RAM → 1000 req/sec
After:  32 CPU, 128GB RAM → 5000 req/sec
```

**Implementation**:

```javascript
// No code changes needed!
// Just upgrade server specs

// AWS RDS example
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --db-instance-class db.r5.8xlarge \  // Bigger instance
  --allocated-storage 1000 \            // More storage
  --apply-immediately
```

**Pros**:
- ✅ Simple (no code changes)
- ✅ Fast to implement
- ✅ No data distribution complexity

**Cons**:
- ❌ Limited (can't exceed largest server)
- ❌ Expensive (exponential cost increase)
- ❌ Single point of failure
- ❌ Downtime during upgrade

**When to Use**:
- Quick wins for small-medium apps
- Temporary fix while planning horizontal scaling
- Total data < 1TB

---

### 2. Read Replicas (Horizontal Scaling for Reads)

**Architecture**:

```
              ┌─────────────┐
              │   Primary   │ ◄─── All WRITES
              │  (Master)   │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │Replica1│  │Replica2│  │Replica3│ ◄─── All READS
    └────────┘  └────────┘  └────────┘
```

**Implementation**:

```javascript
// database-cluster.js
const { Pool } = require('pg');

class DatabaseCluster {
  constructor() {
    // Write pool (primary)
    this.primary = new Pool({
      host: 'primary.db.example.com',
      port: 5432,
      database: 'myapp',
      user: 'admin',
      password: 'secret',
      max: 50
    });

    // Read pools (replicas)
    this.replicas = [
      new Pool({
        host: 'replica1.db.example.com',
        port: 5432,
        database: 'myapp',
        user: 'readonly',
        password: 'secret',
        max: 50
      }),
      new Pool({
        host: 'replica2.db.example.com',
        port: 5432,
        database: 'myapp',
        user: 'readonly',
        password: 'secret',
        max: 50
      }),
      new Pool({
        host: 'replica3.db.example.com',
        port: 5432,
        database: 'myapp',
        user: 'readonly',
        password: 'secret',
        max: 50
      })
    ];

    this.currentReplicaIndex = 0;
  }

  // All writes go to primary
  async write(query, params) {
    return await this.primary.query(query, params);
  }

  // Reads go to replicas (round-robin)
  async read(query, params) {
    const replica = this.replicas[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicas.length;

    return await replica.query(query, params);
  }

  // Force read from primary (for critical data)
  async readFromPrimary(query, params) {
    return await this.primary.query(query, params);
  }
}

// Usage
const db = new DatabaseCluster();

// Write operations
app.post('/api/users', async (req, res) => {
  const result = await db.write(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [req.body.name, req.body.email]
  );

  res.json(result.rows[0]);
});

// Read operations (from replicas)
app.get('/api/users', async (req, res) => {
  const result = await db.read('SELECT * FROM users ORDER BY created_at DESC LIMIT 100');
  res.json(result.rows);
});

// Critical read (must be fresh - from primary)
app.get('/api/users/:id/balance', async (req, res) => {
  // Account balance must be accurate - read from primary
  const result = await db.readFromPrimary(
    'SELECT balance FROM accounts WHERE user_id = $1',
    [req.params.id]
  );

  res.json(result.rows[0]);
});
```

**Replication Lag Handling**:

```javascript
// replication-lag-handler.js
class ReplicationAwareDB extends DatabaseCluster {
  async writeAndRead(writeQuery, writeParams, readQuery, readParams) {
    // 1. Write to primary
    await this.write(writeQuery, writeParams);

    // 2. Read from primary (avoid replication lag)
    return await this.readFromPrimary(readQuery, readParams);
  }
}

// Example: Update user, then read updated data
app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  // Write and immediately read from primary (avoid stale data)
  const user = await db.writeAndRead(
    'UPDATE users SET name = $1 WHERE id = $2',
    [req.body.name, userId],
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  res.json(user.rows[0]);
});
```

**Setup Read Replicas (PostgreSQL)**:

```sql
-- On Primary
-- Enable WAL archiving
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 10;
SELECT pg_reload_conf();

-- Create replication user
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'secret';

-- On Replica
-- Stop PostgreSQL
sudo systemctl stop postgresql

-- Copy data from primary
pg_basebackup -h primary.db.example.com -D /var/lib/postgresql/data -U replicator -P -v -R

-- Start PostgreSQL
sudo systemctl start postgresql

-- Replica will automatically sync from primary!
```

**Pros**:
- ✅ 10x read capacity (add more replicas)
- ✅ Relatively simple to set up
- ✅ No application logic changes (just routing)

**Cons**:
- ❌ Write bottleneck (all writes to one server)
- ❌ Replication lag (eventual consistency)
- ❌ Doesn't help with data size

**When to Use**:
- 90%+ read workload (social media, news sites)
- Data fits on one server (< 5TB)
- Eventual consistency acceptable

---

### 3. Sharding (Horizontal Scaling for Writes)

**Definition**: Split data across multiple databases

**Sharding Strategies**:

#### A. Hash-Based Sharding

```
User ID: 12345
Shard = hash(12345) % num_shards
Shard = 12345 % 4 = 1

User 12345 → Shard 1
User 67890 → Shard 2
```

```javascript
// hash-sharding.js
const crypto = require('crypto');

class ShardedDatabase {
  constructor(shardConfigs) {
    // Connect to multiple shards
    this.shards = shardConfigs.map(config => new Pool(config));
  }

  // Hash function to determine shard
  getShardIndex(key) {
    const hash = crypto.createHash('md5').update(key.toString()).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return hashInt % this.shards.length;
  }

  getShard(key) {
    const index = this.getShardIndex(key);
    return this.shards[index];
  }

  // Write to specific shard
  async write(key, query, params) {
    const shard = this.getShard(key);
    return await shard.query(query, params);
  }

  // Read from specific shard
  async read(key, query, params) {
    const shard = this.getShard(key);
    return await shard.query(query, params);
  }

  // Query all shards (scatter-gather)
  async readAll(query, params) {
    const results = await Promise.all(
      this.shards.map(shard => shard.query(query, params))
    );

    // Combine results from all shards
    return results.flatMap(r => r.rows);
  }
}

// Setup
const db = new ShardedDatabase([
  { host: 'shard0.db.example.com', database: 'myapp' },
  { host: 'shard1.db.example.com', database: 'myapp' },
  { host: 'shard2.db.example.com', database: 'myapp' },
  { host: 'shard3.db.example.com', database: 'myapp' }
]);

// Usage
app.post('/api/users', async (req, res) => {
  const userId = generateUserId();

  // User 12345 → Shard 1
  await db.write(
    userId,
    'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
    [userId, req.body.name, req.body.email]
  );

  res.json({ id: userId });
});

app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  // Query correct shard
  const result = await db.read(
    userId,
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  res.json(result.rows[0]);
});

// Expensive: Query all shards
app.get('/api/users/search', async (req, res) => {
  const users = await db.readAll(
    'SELECT * FROM users WHERE name LIKE $1 LIMIT 100',
    [`%${req.query.q}%`]
  );

  res.json(users);
});
```

---

#### B. Range-Based Sharding

```
Users 0-999,999     → Shard 0
Users 1M-1,999,999  → Shard 1
Users 2M-2,999,999  → Shard 2
```

```javascript
// range-sharding.js
class RangeShardedDatabase {
  constructor(shards) {
    this.shards = shards;
    this.ranges = [
      { min: 0, max: 999999, shard: 0 },
      { min: 1000000, max: 1999999, shard: 1 },
      { min: 2000000, max: 2999999, shard: 2 },
      { min: 3000000, max: 9999999, shard: 3 }
    ];
  }

  getShardIndex(userId) {
    const range = this.ranges.find(r => userId >= r.min && userId <= r.max);
    return range ? range.shard : 0;
  }

  getShard(userId) {
    const index = this.getShardIndex(userId);
    return this.shards[index];
  }
}
```

**Pros**:
- ✅ Easy to add new shards (expand range)
- ✅ Range queries efficient (query one shard)

**Cons**:
- ❌ Uneven distribution (hot shards)
- ❌ Hard to rebalance

---

#### C. Geographic Sharding

```
Users in US    → US Shard (us-east-1)
Users in EU    → EU Shard (eu-west-1)
Users in Asia  → Asia Shard (ap-south-1)
```

```javascript
// geo-sharding.js
class GeoShardedDatabase {
  constructor() {
    this.shards = {
      'US': new Pool({ host: 'us-east-1.db.example.com' }),
      'EU': new Pool({ host: 'eu-west-1.db.example.com' }),
      'ASIA': new Pool({ host: 'ap-south-1.db.example.com' })
    };
  }

  getShard(region) {
    return this.shards[region] || this.shards['US'];
  }

  async write(region, query, params) {
    const shard = this.getShard(region);
    return await shard.query(query, params);
  }
}

// Usage
app.post('/api/users', async (req, res) => {
  const region = req.body.region || 'US';

  await db.write(
    region,
    'INSERT INTO users (name, email, region) VALUES ($1, $2, $3)',
    [req.body.name, req.body.email, region]
  );

  res.json({ success: true });
});
```

**Pros**:
- ✅ Data locality (low latency)
- ✅ Data sovereignty compliance (GDPR)

**Cons**:
- ❌ Uneven distribution
- ❌ Cross-region queries expensive

---

### Sharding Challenges

#### 1. JOINs Across Shards

```javascript
// ❌ Problem: Users and Orders on different shards
app.get('/api/users/:id/orders', async (req, res) => {
  const userId = req.params.id;

  // User on Shard 1
  const user = await db.read(userId, 'SELECT * FROM users WHERE id = $1', [userId]);

  // Orders on Shard 2 (different shard!)
  // Can't JOIN across shards!
});

// ✅ Solution: Denormalize or use application-level JOINs
app.get('/api/users/:id/orders', async (req, res) => {
  const userId = req.params.id;

  // Both queries on same shard (shard by user_id)
  const [user, orders] = await Promise.all([
    db.read(userId, 'SELECT * FROM users WHERE id = $1', [userId]),
    db.read(userId, 'SELECT * FROM orders WHERE user_id = $1', [userId])
  ]);

  res.json({ ...user.rows[0], orders: orders.rows });
});
```

#### 2. Rebalancing Shards

```javascript
// Adding a new shard (4 → 5 shards)
// Problem: Existing data needs to move!

// Before: 4 shards
// User 12345 → hash(12345) % 4 = 1 (Shard 1)

// After: 5 shards
// User 12345 → hash(12345) % 5 = 0 (Shard 0) ← Data moved!

// Solution: Consistent hashing or virtual shards
```

---

## 📈 Real-World Example: Scaling an E-commerce Database

```javascript
// Phase 1: Single database (0-10K users)
const db = new Pool({ host: 'localhost', database: 'ecommerce' });

// Phase 2: Vertical scaling (10K-100K users)
// Upgrade to bigger server (32 CPU, 128GB RAM)

// Phase 3: Add caching (100K-500K users)
const redis = new Redis();

app.get('/api/products/:id', async (req, res) => {
  const cached = await redis.get(`product:${req.params.id}`);
  if (cached) return res.json(JSON.parse(cached));

  const product = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  await redis.setex(`product:${req.params.id}`, 3600, JSON.stringify(product.rows[0]));

  res.json(product.rows[0]);
});

// Phase 4: Read replicas (500K-2M users, read-heavy)
const dbCluster = new DatabaseCluster();

app.get('/api/products', async (req, res) => {
  const products = await dbCluster.read('SELECT * FROM products WHERE active = true');
  res.json(products.rows);
});

app.post('/api/orders', async (req, res) => {
  const order = await dbCluster.write('INSERT INTO orders ...');
  res.json(order.rows[0]);
});

// Phase 5: Sharding (2M+ users, write-heavy)
const shardedDB = new ShardedDatabase([...]);

app.get('/api/users/:id', async (req, res) => {
  const user = await shardedDB.read(
    req.params.id,
    'SELECT * FROM users WHERE id = $1',
    [req.params.id]
  );

  res.json(user.rows[0]);
});
```

---

## 🎓 Interview Tips

### Common Questions

**Q: When do you need sharding?**
A: "When: 1) Single database can't handle write load, 2) Data > 5TB (doesn't fit on one server), 3) Need geographic distribution. Start with vertical scaling + read replicas first. Sharding is complex and should be last resort."

**Q: How do you handle transactions across shards?**
A: "Avoid if possible! Redesign schema to keep related data on same shard. If unavoidable, use 2-phase commit (slow) or Saga pattern (eventual consistency)."

**Q: What's the difference between sharding and partitioning?**
A: "Partitioning = splitting data on ONE server (table partitioning). Sharding = splitting data across MULTIPLE servers. Sharding is distributed, partitioning is local."

**Q: How do you rebalance shards?**
A: "Use consistent hashing (minimal data movement), add virtual shards (logical shards map to physical), or use tools like Vitess (for MySQL) that handle rebalancing automatically."

---

## 🔗 Related Questions

- [SQL vs NoSQL](/interview-prep/database-storage/sql-vs-nosql)
- [Query Optimization](/interview-prep/database-storage/query-optimization)
- [Connection Pooling](/interview-prep/database-storage/connection-pooling)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)

---

## 📚 Additional Resources

- [PostgreSQL Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [Database Sharding](https://www.digitalocean.com/community/tutorials/understanding-database-sharding)
- [Vitess - Sharding for MySQL](https://vitess.io/)
- [Consistent Hashing](https://en.wikipedia.org/wiki/Consistent_hashing)
