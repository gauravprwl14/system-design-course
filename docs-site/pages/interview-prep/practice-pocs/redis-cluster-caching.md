# POC #64: Distributed Caching with Redis Cluster

> **Difficulty:** 🔴 Advanced
> **Time:** 30 minutes
> **Prerequisites:** Redis basics, Clustering concepts

## What You'll Learn

How Redis Cluster distributes data across multiple nodes using hash slots:

```
REDIS CLUSTER ARCHITECTURE:
┌─────────────────────────────────────────────────────────────┐
│                    Hash Slot Distribution                   │
│                     (16,384 total slots)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Node 1    │  │   Node 2    │  │   Node 3    │         │
│  │ Slots 0-5461│  │Slots 5462-  │  │Slots 10923- │         │
│  │             │  │   10922     │  │   16383     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Replica 1  │  │  Replica 2  │  │  Replica 3  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  Key routing: CRC16(key) mod 16384 → slot → node          │
└─────────────────────────────────────────────────────────────┘
```

---

## Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes --port 7001
    ports:
      - "7001:7001"
    networks:
      redis-cluster:
        ipv4_address: 172.20.0.11

  redis-node-2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes --port 7002
    ports:
      - "7002:7002"
    networks:
      redis-cluster:
        ipv4_address: 172.20.0.12

  redis-node-3:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes --port 7003
    ports:
      - "7003:7003"
    networks:
      redis-cluster:
        ipv4_address: 172.20.0.13

  redis-node-4:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes --port 7004
    ports:
      - "7004:7004"
    networks:
      redis-cluster:
        ipv4_address: 172.20.0.14

  redis-node-5:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes --port 7005
    ports:
      - "7005:7005"
    networks:
      redis-cluster:
        ipv4_address: 172.20.0.15

  redis-node-6:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes --port 7006
    ports:
      - "7006:7006"
    networks:
      redis-cluster:
        ipv4_address: 172.20.0.16

networks:
  redis-cluster:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

## Cluster Initialization

```bash
# init-cluster.sh
#!/bin/bash

echo "Waiting for nodes to start..."
sleep 5

echo "Creating Redis Cluster..."
docker exec -it $(docker ps -qf "name=redis-node-1") redis-cli --cluster create \
  172.20.0.11:7001 \
  172.20.0.12:7002 \
  172.20.0.13:7003 \
  172.20.0.14:7004 \
  172.20.0.15:7005 \
  172.20.0.16:7006 \
  --cluster-replicas 1 \
  --cluster-yes

echo "Cluster created!"

# Verify cluster
docker exec -it $(docker ps -qf "name=redis-node-1") redis-cli -p 7001 cluster info
```

---

## Implementation

```javascript
// redis-cluster.js
const Redis = require('ioredis');

// Create cluster client
const cluster = new Redis.Cluster([
  { host: 'localhost', port: 7001 },
  { host: 'localhost', port: 7002 },
  { host: 'localhost', port: 7003 },
], {
  redisOptions: {
    password: undefined,
  },
  scaleReads: 'slave', // Read from replicas for scaling
  enableReadyCheck: true,
  maxRedirections: 16,
});

// ==========================================
// HASH SLOT CALCULATION
// ==========================================

function calculateHashSlot(key) {
  // Redis uses CRC16 mod 16384 for slot calculation
  // For hash tags: {user:123}:profile -> uses "user:123" for slot
  const crc16Table = new Uint16Array([
    0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7,
    // ... (abbreviated - use actual CRC16-CCITT table)
  ]);

  // Simplified: Use Redis CLUSTER KEYSLOT command instead
  return cluster.cluster('KEYSLOT', key);
}

// ==========================================
// DISTRIBUTED CACHING PATTERNS
// ==========================================

class DistributedCache {
  constructor() {
    this.stats = {
      hits: 0,
      misses: 0,
      nodeDistribution: {}
    };
  }

  async get(key) {
    const startTime = Date.now();
    const value = await cluster.get(key);

    if (value) {
      this.stats.hits++;
      console.log(`✅ HIT: ${key} (${Date.now() - startTime}ms)`);
      return JSON.parse(value);
    }

    this.stats.misses++;
    console.log(`❌ MISS: ${key}`);
    return null;
  }

  async set(key, value, ttl = 3600) {
    const startTime = Date.now();
    await cluster.setex(key, ttl, JSON.stringify(value));

    // Track which slot (and thus node) this key went to
    const slot = await cluster.cluster('KEYSLOT', key);
    this.stats.nodeDistribution[slot] = (this.stats.nodeDistribution[slot] || 0) + 1;

    console.log(`📝 SET: ${key} -> slot ${slot} (${Date.now() - startTime}ms)`);
  }

  async mget(keys) {
    // MGET only works if all keys are in same slot!
    // Use hash tags for multi-key operations
    const values = await cluster.mget(keys);
    return values.map(v => v ? JSON.parse(v) : null);
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }
}

// ==========================================
// HASH TAGS FOR RELATED KEYS
// ==========================================

class UserCache {
  // Using hash tags to keep user data on same node
  // {user:123}:profile, {user:123}:settings -> same slot

  async cacheUserData(userId, profile, settings) {
    const pipeline = cluster.pipeline();

    // Hash tag {user:X} ensures same slot
    pipeline.setex(`{user:${userId}}:profile`, 3600, JSON.stringify(profile));
    pipeline.setex(`{user:${userId}}:settings`, 3600, JSON.stringify(settings));
    pipeline.setex(`{user:${userId}}:lastActive`, 3600, Date.now().toString());

    await pipeline.exec();

    const slot = await cluster.cluster('KEYSLOT', `{user:${userId}}:profile`);
    console.log(`👤 User ${userId} data cached on slot ${slot}`);
  }

  async getUserData(userId) {
    // MGET works because all keys have same hash tag
    const [profile, settings, lastActive] = await cluster.mget([
      `{user:${userId}}:profile`,
      `{user:${userId}}:settings`,
      `{user:${userId}}:lastActive`
    ]);

    return {
      profile: profile ? JSON.parse(profile) : null,
      settings: settings ? JSON.parse(settings) : null,
      lastActive: lastActive ? parseInt(lastActive) : null
    };
  }
}

// ==========================================
// CLUSTER OPERATIONS
// ==========================================

async function getClusterInfo() {
  const info = await cluster.cluster('INFO');
  const nodes = await cluster.cluster('NODES');

  console.log('\n📊 CLUSTER INFO:');
  console.log(info);

  console.log('\n📍 CLUSTER NODES:');
  const nodeLines = nodes.split('\n').filter(l => l.trim());
  for (const line of nodeLines) {
    const parts = line.split(' ');
    const nodeId = parts[0].substring(0, 8);
    const address = parts[1];
    const role = parts[2].includes('master') ? 'MASTER' : 'SLAVE';
    const slots = parts.slice(8).join(' ');
    console.log(`  ${nodeId}... | ${address.padEnd(20)} | ${role.padEnd(6)} | ${slots}`);
  }
}

async function demonstrateKeyDistribution() {
  console.log('\n🔀 KEY DISTRIBUTION DEMO:');

  const products = [
    { id: 1, name: 'Laptop' },
    { id: 2, name: 'Phone' },
    { id: 3, name: 'Tablet' },
    { id: 4, name: 'Monitor' },
    { id: 5, name: 'Keyboard' },
    { id: 6, name: 'Mouse' },
    { id: 7, name: 'Headphones' },
    { id: 8, name: 'Webcam' },
  ];

  const slotDistribution = {};

  for (const product of products) {
    const key = `product:${product.id}`;
    await cluster.set(key, JSON.stringify(product));
    const slot = await cluster.cluster('KEYSLOT', key);
    slotDistribution[slot] = slotDistribution[slot] || [];
    slotDistribution[slot].push(key);
  }

  console.log('\nSlot distribution:');
  for (const [slot, keys] of Object.entries(slotDistribution)) {
    console.log(`  Slot ${slot}: ${keys.join(', ')}`);
  }
}

// ==========================================
// FAILOVER DEMONSTRATION
// ==========================================

async function demonstrateResilience() {
  console.log('\n🛡️ RESILIENCE DEMO:');

  // Write data
  await cluster.set('resilience-test', 'important-data');
  console.log('Written: resilience-test = important-data');

  // Read back
  const value = await cluster.get('resilience-test');
  console.log(`Read back: ${value}`);

  console.log('\n💡 In production, you would:');
  console.log('   1. Stop a master node: docker stop redis-node-1');
  console.log('   2. Watch replica promote to master');
  console.log('   3. Verify data still accessible');
  console.log('   4. Restart old node: docker start redis-node-1');
  console.log('   5. Watch it rejoin as replica');
}

// ==========================================
// MAIN DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('REDIS CLUSTER DISTRIBUTED CACHING');
  console.log('='.repeat(60));

  await cluster.flushall();

  // Show cluster info
  await getClusterInfo();

  // Demonstrate key distribution
  await demonstrateKeyDistribution();

  // Demonstrate hash tags
  console.log('\n🏷️ HASH TAG DEMO:');
  const userCache = new UserCache();
  await userCache.cacheUserData(123, { name: 'John' }, { theme: 'dark' });
  const userData = await userCache.getUserData(123);
  console.log('User data:', userData);

  // Demonstrate resilience
  await demonstrateResilience();

  // Cache performance
  console.log('\n⚡ PERFORMANCE TEST:');
  const cache = new DistributedCache();
  const startTime = Date.now();

  for (let i = 0; i < 100; i++) {
    await cache.set(`perf:${i}`, { value: i });
  }

  for (let i = 0; i < 100; i++) {
    await cache.get(`perf:${i}`);
  }

  console.log(`100 writes + 100 reads: ${Date.now() - startTime}ms`);
  console.log('Stats:', cache.getStats());

  // Cleanup
  await cluster.quit();
}

// Handle cluster ready event
cluster.on('ready', () => {
  console.log('✅ Connected to Redis Cluster');
  demonstrate().catch(console.error);
});

cluster.on('error', (err) => {
  console.error('❌ Cluster error:', err.message);
});
```

---

## Run the POC

```bash
# Start the cluster
docker-compose up -d
sleep 10

# Initialize the cluster
chmod +x init-cluster.sh
./init-cluster.sh

# Install dependencies
npm install ioredis

# Run demonstration
node redis-cluster.js
```

---

## Expected Output

```
============================================================
REDIS CLUSTER DISTRIBUTED CACHING
============================================================

📊 CLUSTER INFO:
cluster_state:ok
cluster_slots_assigned:16384
cluster_slots_ok:16384
cluster_known_nodes:6
cluster_size:3

📍 CLUSTER NODES:
  a1b2c3d4... | 172.20.0.11:7001  | MASTER | 0-5460
  e5f6g7h8... | 172.20.0.12:7002  | MASTER | 5461-10922
  i9j0k1l2... | 172.20.0.13:7003  | MASTER | 10923-16383
  m3n4o5p6... | 172.20.0.14:7004  | SLAVE  | 0-5460
  q7r8s9t0... | 172.20.0.15:7005  | SLAVE  | 5461-10922
  u1v2w3x4... | 172.20.0.16:7006  | SLAVE  | 10923-16383

🔀 KEY DISTRIBUTION DEMO:
Slot distribution:
  Slot 7186: product:1
  Slot 12392: product:2, product:5
  Slot 4567: product:3, product:7
  Slot 15234: product:4, product:8
  Slot 9876: product:6

🏷️ HASH TAG DEMO:
👤 User 123 data cached on slot 5619
User data: { profile: { name: 'John' }, settings: { theme: 'dark' }, lastActive: 1704067200000 }

🛡️ RESILIENCE DEMO:
Written: resilience-test = important-data
Read back: important-data

⚡ PERFORMANCE TEST:
100 writes + 100 reads: 245ms
Stats: { hits: 100, misses: 0, hitRate: 1, nodeDistribution: { ... } }
```

---

## Key Concepts

### Hash Slots

```
Redis Cluster uses 16,384 hash slots
Key assignment: slot = CRC16(key) mod 16384
Each master node owns a range of slots
```

### Hash Tags

```javascript
// Without hash tags - keys may be on different nodes
'user:123:profile'    -> slot 7890
'user:123:settings'   -> slot 4567
// MGET fails! Keys on different slots

// With hash tags - same slot guaranteed
'{user:123}:profile'  -> slot 5619
'{user:123}:settings' -> slot 5619
// MGET works! Same slot
```

### Cross-Slot Operations

```javascript
// ❌ WRONG: Keys on different slots
await cluster.mget(['user:1', 'user:2', 'user:3']); // CROSSSLOT error!

// ✅ CORRECT: Use hash tags or pipeline
await cluster.pipeline()
  .get('user:1')
  .get('user:2')
  .get('user:3')
  .exec();
```

---

## Production Checklist

- [ ] Minimum 3 master nodes for proper quorum
- [ ] Each master has at least 1 replica
- [ ] Use hash tags for related data
- [ ] Handle MOVED and ASK redirections
- [ ] Monitor cluster health (`CLUSTER INFO`)
- [ ] Set up automatic failover alerts
- [ ] Regular backup of RDB/AOF files

---

## Related POCs

- [POC #43: Redis Cluster & Sharding](/interview-prep/practice-pocs/redis-cluster-sharding)
- [POC #61: Cache-Aside Pattern](/interview-prep/practice-pocs/cache-aside-pattern)
- [Database Sharding](/system-design/databases/sharding-strategies)
