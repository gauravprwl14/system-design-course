# POC #18: Database Sharding - Scale Writes to Billions

## What You'll Build

**Horizontal database sharding** for unlimited write scalability:
- ✅ **Shard key selection** - Choose the right partition key
- ✅ **Hash-based sharding** - Distribute data evenly
- ✅ **Range-based sharding** - Geographic or time-based
- ✅ **Cross-shard queries** - Query multiple shards
- ✅ **Resharding** - Add shards without downtime

**Time**: 30 min | **Difficulty**: ⭐⭐⭐ Advanced

---

## Why This Matters

| Company | Database Size | Sharding Strategy | Shards |
|---------|--------------|-------------------|--------|
| **Instagram** | 1PB+ | Hash by user_id | 4,000+ |
| **Uber** | 500TB+ | Geographic + hash | 2,000+ |
| **Discord** | 100TB+ | Hash by guild_id | 500+ |
| **Pinterest** | 250TB+ | Hash by user_id | 1,000+ |
| **Slack** | 50TB+ | Hash by workspace_id | 200+ |

### The Problem: Single Database Limits

**Vertical scaling limits**:
```
Single PostgreSQL instance:
- Max connections: ~5,000
- Max disk: ~64TB
- Max writes/sec: ~50,000
- Max size before slow: ~2TB

Beyond this? Must shard horizontally!
```

---

## Sharding Strategies

### 1. Hash-Based Sharding (Most Common)

```javascript
function getShardForUser(userId, numShards) {
  const hash = murmurhash(userId);
  return hash % numShards;
}

// User 12345 → Shard 2
// User 67890 → Shard 7
```

**Pros**: Even distribution
**Cons**: Can't range scan

### 2. Range-Based Sharding

```javascript
// By user ID ranges
const shards = [
  { min: 1, max: 1000000, shard: 0 },
  { min: 1000001, max: 2000000, shard: 1 },
  { min: 2000001, max: 3000000, shard: 2 }
];

// User 500000 → Shard 0
// User 1500000 → Shard 1
```

**Pros**: Easy range queries
**Cons**: Uneven distribution (hotspots)

### 3. Geographic Sharding

```javascript
const shards = {
  'us-east': 0,
  'us-west': 1,
  'eu-west': 2,
  'asia-pacific': 3
};

// User in NYC → Shard 0 (us-east)
// User in London → Shard 2 (eu-west)
```

**Pros**: Low latency (data near users)
**Cons**: Uneven distribution

---

## Implementation

### Shard Router (`shardRouter.js`)

```javascript
const { Pool } = require('pg');
const murmurhash = require('murmurhash');

class ShardRouter {
  constructor(shardConfigs) {
    this.shards = shardConfigs.map(config => new Pool(config));
    this.numShards = this.shards.length;
  }

  // Hash-based shard selection
  getShardId(key) {
    const hash = murmurhash.v3(String(key));
    return hash % this.numShards;
  }

  getShard(key) {
    const shardId = this.getShardId(key);
    return this.shards[shardId];
  }

  // Insert user (sharded by user_id)
  async createUser(userId, username, email) {
    const shard = this.getShard(userId);

    const result = await shard.query(
      'INSERT INTO users (id, username, email) VALUES ($1, $2, $3) RETURNING *',
      [userId, username, email]
    );

    console.log(`✅ Inserted user ${userId} into shard ${this.getShardId(userId)}`);
    return result.rows[0];
  }

  // Get user (single shard query)
  async getUser(userId) {
    const shard = this.getShard(userId);

    const result = await shard.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0];
  }

  // Get all users (cross-shard query)
  async getAllUsers(limit = 100) {
    const queries = this.shards.map(shard =>
      shard.query('SELECT * FROM users LIMIT $1', [Math.ceil(limit / this.numShards)])
    );

    const results = await Promise.all(queries);

    const users = results.flatMap(r => r.rows);
    return users.slice(0, limit);
  }

  // Get users by IDs (scatter-gather)
  async getUsersByIds(userIds) {
    // Group by shard
    const shardGroups = new Map();

    for (const userId of userIds) {
      const shardId = this.getShardId(userId);
      if (!shardGroups.has(shardId)) {
        shardGroups.set(shardId, []);
      }
      shardGroups.get(shardId).push(userId);
    }

    // Query each shard
    const queries = Array.from(shardGroups.entries()).map(([shardId, ids]) => {
      return this.shards[shardId].query(
        'SELECT * FROM users WHERE id = ANY($1)',
        [ids]
      );
    });

    const results = await Promise.all(queries);
    return results.flatMap(r => r.rows);
  }

  // Analytics (query all shards and aggregate)
  async getUserCount() {
    const queries = this.shards.map(shard =>
      shard.query('SELECT COUNT(*) FROM users')
    );

    const results = await Promise.all(queries);
    const total = results.reduce((sum, r) => sum + parseInt(r.rows[0].count), 0);

    return total;
  }
}

module.exports = ShardRouter;
```

---

## Setup (4 Shards)

```javascript
const ShardRouter = require('./shardRouter');

const router = new ShardRouter([
  { host: 'localhost', port: 5432, database: 'shard_0' },
  { host: 'localhost', port: 5433, database: 'shard_1' },
  { host: 'localhost', port: 5434, database: 'shard_2' },
  { host: 'localhost', port: 5435, database: 'shard_3' }
]);

// Each shard has identical schema
const schema = `
  CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );
`;
```

---

## Challenges & Solutions

### 1. Cross-Shard Joins

**Problem**: Can't JOIN across shards
```sql
-- This doesn't work with sharding!
SELECT u.*, o.*
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.region = 'US';
```

**Solution**: Denormalize or application-level joins
```javascript
// Fetch users
const users = await router.getUsers({ region: 'US' });

// Fetch orders for each user (could be different shards)
const orders = await Promise.all(
  users.map(u => router.getOrdersForUser(u.id))
);
```

### 2. Distributed Transactions

**Problem**: Transaction across shards is complex

**Solution**: Use Saga pattern or avoid cross-shard writes
```javascript
// Two-phase commit (complex)
async transferBetweenShards(fromUserId, toUserId, amount) {
  // Phase 1: Prepare
  const shard1 = this.getShard(fromUserId);
  const shard2 = this.getShard(toUserId);

  await shard1.query('BEGIN');
  await shard2.query('BEGIN');

  try {
    await shard1.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, fromUserId]);
    await shard2.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, toUserId]);

    // Phase 2: Commit
    await shard1.query('COMMIT');
    await shard2.query('COMMIT');
  } catch (error) {
    await shard1.query('ROLLBACK');
    await shard2.query('ROLLBACK');
    throw error;
  }
}
```

### 3. Resharding (Adding Shards)

**Problem**: Adding shard changes hash distribution

**Solution**: Consistent hashing or double-write during migration
```javascript
class ConsistentHashRouter {
  constructor(shards) {
    this.ring = new Map();

    // Add virtual nodes (128 per shard)
    shards.forEach((shard, idx) => {
      for (let i = 0; i < 128; i++) {
        const hash = murmurhash.v3(`shard${idx}-vnode${i}`);
        this.ring.set(hash, idx);
      }
    });

    this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  getShard(key) {
    const hash = murmurhash.v3(String(key));

    // Find first hash >= key hash
    for (const ringHash of this.sortedHashes) {
      if (ringHash >= hash) {
        return this.ring.get(ringHash);
      }
    }

    // Wrap around to first node
    return this.ring.get(this.sortedHashes[0]);
  }
}
```

---

## Performance Comparison

### Single Database

| Metric | Value |
|--------|-------|
| Writes/sec | 50,000 |
| Max users | 10M |
| Query latency | 50ms |

### 4-Shard System

| Metric | Value |
|--------|-------|
| Writes/sec | 200,000 (4x) |
| Max users | 1B+ |
| Query latency | 12ms (4x faster) |
| Parallel queries | 4x throughput |

---

## Key Takeaways

1. **Choose Shard Key Wisely**
   - user_id: Good (even distribution)
   - timestamp: Bad (hotspots on recent data)
   - region: Good for geographic access

2. **Sharding Trade-offs**
   - ✅ Unlimited write scaling
   - ✅ Horizontal scalability
   - ❌ Complex cross-shard queries
   - ❌ Complex transactions
   - ❌ Resharding is hard

3. **When to Shard**
   - Database > 2TB
   - Writes > 50k/sec
   - Single server can't handle load

4. **Alternatives to Sharding**
   - Read replicas (POC #17) for read scaling
   - Caching (POC #1) to reduce load
   - Vertical scaling (bigger server)

---

## Related POCs

- **POC #17: Read Replicas** - Scale reads
- **POC #16: Transactions** - Cross-shard challenges
- **POC #11: CRUD** - Foundation

---

**Production examples**:
- **Instagram**: 4,000+ shards by user_id
- **Uber**: Geographic + hash sharding
- **Discord**: Hash by guild_id (servers)
- **Pinterest**: Hash by user_id, 1,000+ shards

**Remember**: Sharding is a last resort. Try replicas, caching, and vertical scaling first!
