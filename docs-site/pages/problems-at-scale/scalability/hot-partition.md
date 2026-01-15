# Hot Partition Problem - When One Shard Gets All the Traffic

> **Category:** Scalability
> **Frequency:** Very common in sharded systems
> **Detection Difficulty:** Medium
> **Impact:** Cascading failures, system-wide slowdown

## The DynamoDB Meltdown: When Justin Bieber Breaks Your Database

**Real Incident (Simplified):**

```
Scenario: Music streaming service during album release
Architecture: DynamoDB with partition key = artist_id

Normal day:
├── Partition A (artists 1-1000): 1,000 req/sec
├── Partition B (artists 1001-2000): 1,200 req/sec
├── Partition C (artists 2001-3000): 900 req/sec
└── Each partition handles load easily ✅

Album release day (Justin Bieber, artist_id = 1847):
├── Partition A: 1,000 req/sec
├── Partition B: 500,000 req/sec 🔥 (all Bieber traffic)
├── Partition C: 900 req/sec
└── Partition B is overwhelmed ❌

Result:
├── Bieber streams: Throttled, errors
├── Other artists on Partition B: Also failing!
├── Users: "Why can't I play Taylor Swift?" (same partition)
└── Revenue lost: $2M in 4 hours
```

**The problem:** All traffic for one popular entity goes to one partition.

---

## Why Hot Partitions Happen

### Cause 1: Bad Partition Key Choice

```javascript
// ❌ BAD: Partition by date
// All today's data goes to ONE partition
const partitionKey = `2024-01-15`;

// Traffic pattern:
// Partition "2024-01-14": 0 writes (yesterday)
// Partition "2024-01-15": 1,000,000 writes (today) 🔥
// Partition "2024-01-16": 0 writes (tomorrow)

// ❌ BAD: Partition by status
// Most active items in ONE partition
const partitionKey = order.status;  // "pending", "shipped", "delivered"

// Traffic pattern:
// Partition "pending": 100,000 writes (hot!) 🔥
// Partition "shipped": 10,000 writes
// Partition "delivered": 1,000 writes
```

### Cause 2: Celebrity/Viral Problem

```javascript
// Partition by user_id (seems reasonable)
const partitionKey = userId;

// Normal user: 10 followers, 10 reads/day
// Celebrity: 10M followers, 10M reads/day 🔥

// Even with good key design, some entities are just popular
```

### Cause 3: Time-Based Access Patterns

```javascript
// Event logging with timestamp partition
const partitionKey = `${eventType}-${hourBucket}`;

// All current-hour events hit ONE partition
// Partition "clicks-2024-01-15-14": 500,000 writes 🔥
// Partition "clicks-2024-01-15-13": 100 reads (old)
// Partition "clicks-2024-01-15-12": 10 reads (older)
```

---

## Detection: How to Spot Hot Partitions

### Metrics to Watch

```
HEALTHY DISTRIBUTION:
├── Partition 1: 1,000 req/sec
├── Partition 2: 1,100 req/sec
├── Partition 3: 950 req/sec
├── Partition 4: 1,050 req/sec
└── Standard deviation: ~50 req/sec ✅

HOT PARTITION:
├── Partition 1: 500 req/sec
├── Partition 2: 50,000 req/sec 🔥
├── Partition 3: 400 req/sec
├── Partition 4: 600 req/sec
└── Standard deviation: ~20,000 req/sec ❌
```

### AWS DynamoDB Detection

```javascript
// CloudWatch metrics to monitor
const metrics = [
  'ConsumedReadCapacityUnits',
  'ConsumedWriteCapacityUnits',
  'ThrottledRequests',  // Key indicator!
  'SystemErrors'
];

// Alert condition:
// IF ThrottledRequests > 0 for partition
// AND overall table capacity < 80%
// THEN hot partition detected

// DynamoDB Contributor Insights (enable this!)
// Shows: Top accessed partition keys
// Find: Which key is causing the problem
```

### Custom Sharded Database Detection

```javascript
// Track requests per shard
class ShardMonitor {
  constructor(shardCount) {
    this.counts = new Array(shardCount).fill(0);
    this.windowStart = Date.now();
  }

  recordRequest(shardId) {
    this.counts[shardId]++;
  }

  checkForHotSpots() {
    const total = this.counts.reduce((a, b) => a + b, 0);
    const avg = total / this.counts.length;

    const hotShards = this.counts
      .map((count, id) => ({ id, count, ratio: count / avg }))
      .filter(s => s.ratio > 3)  // 3x average = hot
      .sort((a, b) => b.ratio - a.ratio);

    if (hotShards.length > 0) {
      console.error('🔥 HOT SHARDS DETECTED:', hotShards);
      return hotShards;
    }

    return null;
  }
}
```

---

## Prevention Strategies

### Strategy 1: Better Partition Key Design

```javascript
// ❌ BAD: Partition by date alone
partitionKey = "2024-01-15"

// ✅ GOOD: Add randomness (write sharding)
partitionKey = `2024-01-15#${randomInt(0, 10)}`

// Distributes today's writes across 10 partitions
// Trade-off: Reads need to query all 10 and merge

// ❌ BAD: Partition by category
partitionKey = product.category  // "electronics" is huge

// ✅ GOOD: Partition by item ID
partitionKey = product.id  // Evenly distributed
```

### Strategy 2: Write Sharding (Scatter-Gather)

```javascript
// For hot keys, spread writes across multiple shards
class WriteShardedStore {
  constructor(baseKey, shardCount = 10) {
    this.baseKey = baseKey;
    this.shardCount = shardCount;
  }

  // Write: Pick random shard
  async write(value) {
    const shardId = Math.floor(Math.random() * this.shardCount);
    const key = `${this.baseKey}#${shardId}`;
    await db.put(key, value);
  }

  // Read: Query all shards, merge results
  async read() {
    const promises = [];
    for (let i = 0; i < this.shardCount; i++) {
      promises.push(db.get(`${this.baseKey}#${i}`));
    }
    const results = await Promise.all(promises);
    return this.merge(results);
  }
}

// Usage for hot entity (e.g., celebrity follower count)
const bieberFollowers = new WriteShardedStore('followers:bieber', 100);
await bieberFollowers.write({ followerId: 123 });
const count = await bieberFollowers.read();  // Aggregates from 100 shards
```

### Strategy 3: Caching Hot Data

```javascript
// Cache the hot partition's data
class HotKeyCache {
  constructor(cache, db, hotKeyThreshold = 1000) {
    this.cache = cache;
    this.db = db;
    this.accessCounts = new Map();
    this.hotKeyThreshold = hotKeyThreshold;
  }

  async get(key) {
    // Track access
    const count = (this.accessCounts.get(key) || 0) + 1;
    this.accessCounts.set(key, count);

    // If hot, use cache
    if (count > this.hotKeyThreshold) {
      const cached = await this.cache.get(key);
      if (cached) return cached;

      const value = await this.db.get(key);
      await this.cache.set(key, value, { ttl: 60 });  // Cache for 1 min
      return value;
    }

    // Normal keys go to DB
    return this.db.get(key);
  }
}
```

### Strategy 4: Adaptive Sharding

```javascript
// Dynamically split hot partitions
class AdaptiveShardManager {
  constructor() {
    this.shardMap = new Map();  // key prefix → shard count
    this.loadMetrics = new Map();
  }

  async routeRequest(key) {
    const shardCount = this.shardMap.get(key) || 1;

    if (shardCount === 1) {
      return this.getBaseShard(key);
    }

    // Distributed across multiple shards
    const subShard = this.hash(key) % shardCount;
    return `${this.getBaseShard(key)}-${subShard}`;
  }

  async monitorAndAdapt() {
    for (const [key, load] of this.loadMetrics) {
      if (load > THRESHOLD) {
        // Double the shards for this key
        const current = this.shardMap.get(key) || 1;
        this.shardMap.set(key, current * 2);
        console.log(`🔄 Split shard for ${key}: ${current} → ${current * 2}`);
      }
    }
  }
}
```

---

## Real-World Solutions

### How Instagram Handles Hot Users

```
Problem: Celebrities have 100M+ followers

Solution: Sharded follower storage
├── Followers split across 1000 shards
├── Shard key = hash(follower_id) % 1000
├── Each shard handles ~100K followers
├── Reads: Parallel query all shards, merge
└── Writes: Single shard per follower (no conflict)

Result: Even Selena Gomez (300M followers) doesn't create hot partition
```

### How Discord Handles Hot Channels

```
Problem: Announcement channels with 1M+ members

Solution: Message fanout with bucketing
├── Channel messages written to single partition
├── Read replicas per 10K members
├── Members bucketed: bucket = member_id % 100
├── Each bucket has dedicated read path
└── Hot channel → 100 read paths instead of 1

Result: @everyone in 1M member server works
```

### How DynamoDB Adaptive Capacity Works

```
DynamoDB automatically handles hot partitions (to a degree):

1. Detects hot partition via metrics
2. Allocates more capacity to hot partition
3. Borrows capacity from cold partitions
4. Automatically rebalances

Limitations:
- Only works within provisioned capacity
- Can't fix fundamentally bad key design
- Still throttles if truly extreme

Best practice: Design good keys + rely on adaptive capacity as backup
```

---

## Quick Win: Detect Hot Partitions Now

```sql
-- PostgreSQL: Find hot tables (proxy for hot partitions)
SELECT
  schemaname,
  relname,
  seq_scan,
  idx_scan,
  n_tup_ins + n_tup_upd + n_tup_del AS writes,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY (n_tup_ins + n_tup_upd + n_tup_del) DESC
LIMIT 10;

-- For sharded tables, query each shard:
SELECT
  'shard_1' AS shard,
  COUNT(*) AS recent_writes
FROM shard_1.events
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 'shard_2', COUNT(*) FROM shard_2.events WHERE created_at > NOW() - INTERVAL '1 hour'
-- ... repeat for all shards

-- Alert if any shard has 10x average writes
```

```javascript
// Application-level detection
const shardCounts = new Map();

function trackShardAccess(shardId) {
  shardCounts.set(shardId, (shardCounts.get(shardId) || 0) + 1);
}

setInterval(() => {
  const values = Array.from(shardCounts.values());
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);

  if (max > avg * 5) {
    console.error(`🔥 Hot partition detected! Max: ${max}, Avg: ${avg}`);
  }

  shardCounts.clear();  // Reset for next interval
}, 60000);  // Check every minute
```

---

## Key Takeaways

### Prevention Checklist

- [ ] Partition key has high cardinality (many unique values)
- [ ] No temporal clustering (today's data spread across partitions)
- [ ] Hot entities use write sharding (scatter-gather)
- [ ] Caching layer protects hot data
- [ ] Monitoring alerts on partition imbalance

### Partition Key Design Rules

```
1. HIGH CARDINALITY
   ✅ user_id, order_id, product_id
   ❌ status, category, date

2. EVEN DISTRIBUTION
   ✅ UUID, hash of entity
   ❌ Sequential ID, timestamp

3. ACCESS PATTERN MATCH
   ✅ Query pattern matches partition key
   ❌ Frequent cross-partition queries
```

### When Hot Partitions Happen Anyway

```
1. DETECT: Monitor partition-level metrics
2. CACHE: Put hot data in Redis/Memcached
3. SHARD: Split hot partition into sub-partitions
4. RATE LIMIT: Protect system from overload
5. COMMUNICATE: Inform users of degradation
```

---

## Related Content

- [Database Sharding](/system-design/databases/sharding) - Sharding strategies
- [POC #18: Sharding Implementation](/interview-prep/practice-pocs/database-sharding)
- [Database Hotspots](/problems-at-scale/scalability/database-hotspots) - Related pattern

---

**Remember:** The best partition key is one where no single key gets more than 1% of traffic. If you have celebrities, viral content, or time-series data—plan for hot partitions from day one.
