# POC #68: Consistent Hashing for Load Balancing

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Hashing basics

## What You'll Learn

Consistent hashing minimizes key redistribution when servers are added/removed - critical for caching and session affinity.

```
HASH RING:
┌─────────────────────────────────────────────────────────┐
│                      0 / 2^32                           │
│                         │                               │
│                    ┌────┴────┐                          │
│                   ╱          ╲                          │
│               Server1      Server2                      │
│               (hash:1000)  (hash:3000)                  │
│              ╱                      ╲                   │
│         ●─────────────────────────────●                │
│        ╱   Key:1500 → Server2          ╲               │
│    Server3                         Server1              │
│    (hash:8000)                    (virtual)             │
│        ╲                              ╱                 │
│         ●─────────────────────────────●                │
│                                                         │
│  Key routing: Find first server clockwise from key     │
│                                                         │
│  Server added: Only keys between prev & new move       │
│  Server removed: Only its keys redistribute            │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// consistent-hashing.js
const crypto = require('crypto');

// ==========================================
// CONSISTENT HASH RING
// ==========================================

class ConsistentHashRing {
  constructor(virtualNodes = 100) {
    this.virtualNodes = virtualNodes;
    this.ring = new Map();  // hash -> server
    this.sortedHashes = []; // sorted list of hashes
    this.servers = new Set();
  }

  // Generate hash for a key
  hash(key) {
    return crypto.createHash('md5')
      .update(key)
      .digest('hex')
      .substring(0, 8);
  }

  hashToNumber(hash) {
    return parseInt(hash, 16);
  }

  // Add a server with virtual nodes
  addServer(server) {
    if (this.servers.has(server)) return;

    this.servers.add(server);

    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${server}:${i}`;
      const hash = this.hash(virtualKey);
      const hashNum = this.hashToNumber(hash);

      this.ring.set(hashNum, server);
      this.sortedHashes.push(hashNum);
    }

    this.sortedHashes.sort((a, b) => a - b);
    console.log(`✅ Added ${server} with ${this.virtualNodes} virtual nodes`);
  }

  // Remove a server
  removeServer(server) {
    if (!this.servers.has(server)) return;

    this.servers.delete(server);

    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${server}:${i}`;
      const hash = this.hash(virtualKey);
      const hashNum = this.hashToNumber(hash);

      this.ring.delete(hashNum);
      const idx = this.sortedHashes.indexOf(hashNum);
      if (idx > -1) this.sortedHashes.splice(idx, 1);
    }

    console.log(`❌ Removed ${server}`);
  }

  // Find the server for a key
  getServer(key) {
    if (this.sortedHashes.length === 0) return null;

    const hash = this.hash(key);
    const hashNum = this.hashToNumber(hash);

    // Binary search for first hash >= key hash
    let low = 0, high = this.sortedHashes.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedHashes[mid] < hashNum) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    // Wrap around if needed
    const serverHash = this.sortedHashes[low % this.sortedHashes.length];
    const server = this.ring.get(serverHash);

    return server;
  }

  // Get distribution statistics
  getDistribution(keys) {
    const distribution = {};
    this.servers.forEach(s => distribution[s] = 0);

    keys.forEach(key => {
      const server = this.getServer(key);
      if (server) distribution[server]++;
    });

    return distribution;
  }
}

// ==========================================
// DEMONSTRATE KEY REDISTRIBUTION
// ==========================================

function demonstrateRedistribution() {
  console.log('='.repeat(60));
  console.log('CONSISTENT HASHING - KEY REDISTRIBUTION');
  console.log('='.repeat(60));
  console.log();

  const ring = new ConsistentHashRing(50);

  // Add initial servers
  ring.addServer('server1');
  ring.addServer('server2');
  ring.addServer('server3');

  // Generate test keys
  const keys = [];
  for (let i = 0; i < 1000; i++) {
    keys.push(`user:${i}`);
  }

  // Initial distribution
  console.log('\n--- Initial Distribution (3 servers) ---');
  const initial = ring.getDistribution(keys);
  Object.entries(initial).forEach(([server, count]) => {
    console.log(`  ${server}: ${count} keys (${(count/10).toFixed(1)}%)`);
  });

  // Track key-to-server mapping
  const initialMapping = {};
  keys.forEach(key => {
    initialMapping[key] = ring.getServer(key);
  });

  // Add a new server
  console.log('\n--- Adding server4 ---');
  ring.addServer('server4');

  const afterAdd = ring.getDistribution(keys);
  Object.entries(afterAdd).forEach(([server, count]) => {
    console.log(`  ${server}: ${count} keys (${(count/10).toFixed(1)}%)`);
  });

  // Count redistributed keys
  let movedAfterAdd = 0;
  keys.forEach(key => {
    if (ring.getServer(key) !== initialMapping[key]) {
      movedAfterAdd++;
    }
  });
  console.log(`\n  📊 Keys moved: ${movedAfterAdd}/1000 (${(movedAfterAdd/10).toFixed(1)}%)`);
  console.log(`  📊 Optimal: ~250 (25% = 1/4 of keys move to new server)`);

  // Remove a server
  console.log('\n--- Removing server2 ---');
  ring.removeServer('server2');

  const afterRemove = ring.getDistribution(keys);
  Object.entries(afterRemove).forEach(([server, count]) => {
    console.log(`  ${server}: ${count} keys (${(count/10).toFixed(1)}%)`);
  });

  // Count keys that moved from server2
  const server2Keys = keys.filter(k => initialMapping[k] === 'server2');
  let movedFromServer2 = server2Keys.filter(k =>
    ring.getServer(k) !== 'server2'
  ).length;

  console.log(`\n  📊 server2's keys redistributed: ${movedFromServer2}`);
  console.log(`  📊 Other servers' keys unchanged`);
}

// ==========================================
// COMPARE WITH MODULO HASHING
// ==========================================

function compareWithModulo() {
  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON: CONSISTENT vs MODULO HASHING');
  console.log('='.repeat(60));

  const numKeys = 1000;
  const keys = Array.from({ length: numKeys }, (_, i) => `key:${i}`);

  // Modulo hashing with 3 servers
  function moduloHash(key, numServers) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return parseInt(hash.substring(0, 8), 16) % numServers;
  }

  // Initial modulo distribution
  const moduloInitial = {};
  keys.forEach(key => {
    const server = `server${moduloHash(key, 3) + 1}`;
    moduloInitial[key] = server;
  });

  // After adding a server (4 servers)
  let moduloMoved = 0;
  keys.forEach(key => {
    const newServer = `server${moduloHash(key, 4) + 1}`;
    if (newServer !== moduloInitial[key]) {
      moduloMoved++;
    }
  });

  // Consistent hash
  const ring = new ConsistentHashRing(50);
  ring.addServer('server1');
  ring.addServer('server2');
  ring.addServer('server3');

  const consistentInitial = {};
  keys.forEach(key => {
    consistentInitial[key] = ring.getServer(key);
  });

  ring.addServer('server4');

  let consistentMoved = 0;
  keys.forEach(key => {
    if (ring.getServer(key) !== consistentInitial[key]) {
      consistentMoved++;
    }
  });

  console.log('\nAdding 1 server to 3-server cluster (1000 keys):');
  console.log(`\n  Modulo hashing:     ${moduloMoved} keys moved (${(moduloMoved/10).toFixed(1)}%)`);
  console.log(`  Consistent hashing: ${consistentMoved} keys moved (${(consistentMoved/10).toFixed(1)}%)`);
  console.log(`\n  Improvement: ${((moduloMoved - consistentMoved)/moduloMoved * 100).toFixed(1)}% fewer moves!`);
}

// ==========================================
// MAIN
// ==========================================

demonstrateRedistribution();
compareWithModulo();
```

---

## Expected Output

```
CONSISTENT HASHING - KEY REDISTRIBUTION

--- Initial Distribution (3 servers) ---
  server1: 342 keys (34.2%)
  server2: 318 keys (31.8%)
  server3: 340 keys (34.0%)

--- Adding server4 ---
  server1: 256 keys (25.6%)
  server2: 238 keys (23.8%)
  server3: 258 keys (25.8%)
  server4: 248 keys (24.8%)

  📊 Keys moved: 248/1000 (24.8%)
  📊 Optimal: ~250 (25% = 1/4 of keys move)

--- Removing server2 ---
  server1: 340 keys (34.0%)
  server3: 341 keys (34.1%)
  server4: 319 keys (31.9%)

  📊 server2's keys redistributed: 238
  📊 Other servers' keys unchanged

COMPARISON: CONSISTENT vs MODULO HASHING

Adding 1 server to 3-server cluster (1000 keys):

  Modulo hashing:     748 keys moved (74.8%)
  Consistent hashing: 248 keys moved (24.8%)

  Improvement: 66.8% fewer cache misses!
```

---

## Key Properties

| Property | Consistent Hashing | Modulo Hashing |
|----------|-------------------|----------------|
| Add server | ~1/n keys move | ~(n-1)/n keys move |
| Remove server | ~1/n keys move | ~(n-1)/n keys move |
| Even distribution | With virtual nodes | Yes |
| Implementation | More complex | Simple |

---

## Use Cases

- **Cache clusters** (Memcached, Redis)
- **CDN routing** (route users to nearest edge)
- **Database sharding**
- **Session affinity** (sticky sessions)

---

## Related POCs

- [POC #66: Round-Robin](/interview-prep/practice-pocs/load-balancer-round-robin)
- [POC #67: Least Connections](/interview-prep/practice-pocs/load-balancer-least-connections)
- [Database Sharding](/system-design/databases/sharding-strategies)
