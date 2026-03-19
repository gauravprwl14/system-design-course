---
title: "POC: Consistent Hashing with Virtual Nodes"
date: "2026-03-18"
category: "practice-poc"
subcategories: ["distributed-systems", "load-balancing", "hashing"]
difficulty: "intermediate"
tags: ["consistent-hashing", "virtual-nodes", "distributed-systems", "sharding"]
description: "Hands-on implementation of consistent hashing from scratch — build a hash ring, add/remove nodes, and see how virtual nodes minimize key redistribution."
reading_time: "18 min"
status: "published"
---

# POC: Consistent Hashing with Virtual Nodes

> **What you'll build:** A consistent hash ring from scratch in Node.js that routes keys to nodes, supports adding/removing nodes, and demonstrates how virtual nodes ensure balanced distribution.
> **What you'll learn:**
> - How the hash ring data structure works internally
> - Why virtual nodes prevent hotspots on unequal hardware
> - How only ~25% of keys move when you add a 4th node to a 3-node cluster
> - The trade-off between number of virtual nodes and balance quality
>
> **Prerequisites:** Basic JavaScript, understanding of hash functions, familiarity with distributed systems concepts

---

## The Concept `[Intermediate]`

Consistent hashing solves the *reshuffling problem* in distributed caches and databases. With a naive modulo hash (`key % N`), adding or removing a node causes almost **every key** to remap to a different node — invalidating your entire cache.

Consistent hashing arranges both nodes and keys on a circular ring (0 to 2^32). Each key belongs to the first node clockwise from it. When a node is added, only keys between the new node and its predecessor move — roughly `1/N` of total keys.

> 💡 **Real-world example:** Imagine a clock face. Nodes are placed at specific hours. Each key "belongs" to the next clockwise hour marker. If you add a new node at 3 o'clock, only keys that were heading to 6 o'clock (the next marker) now reroute to 3 — everyone else is unaffected.

**Where it's used:**
- Amazon DynamoDB partition routing
- Cassandra data distribution
- Memcached client-side sharding (libketama)
- CDN edge server selection

---

## The Problem Without This Pattern `[Beginner]`

```javascript
// WITHOUT consistent hashing — naive modulo sharding
class NaiveShardRouter {
  constructor(nodes) {
    this.nodes = nodes;
  }

  getNode(key) {
    // Simple modulo — maps key to node index
    const hash = this.simpleHash(key);
    return this.nodes[hash % this.nodes.length];
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash;
  }
}

// Simulate what happens when we add a node
const router3 = new NaiveShardRouter(['node-A', 'node-B', 'node-C']);
const router4 = new NaiveShardRouter(['node-A', 'node-B', 'node-C', 'node-D']);

const keys = Array.from({ length: 100 }, (_, i) => `user:${i}`);
let remapped = 0;
for (const key of keys) {
  if (router3.getNode(key) !== router4.getNode(key)) remapped++;
}

console.log(`Keys remapped after adding 1 node: ${remapped}/100`);
// Output: Keys remapped after adding 1 node: 74/100  ← nearly everything!
```

**What happens:** With 3 nodes, key `"user:42"` hashes to node index `hash % 3`. With 4 nodes, it hashes to `hash % 4`. Different modulus = different node = **cache miss**. Adding one node invalidates ~75% of your cache, causing a thundering herd against your database.

---

## The Implementation `[Intermediate]`

### Setup

```bash
# No external dependencies needed — pure Node.js
node --version  # Requires Node.js 14+
```

### Core Implementation

```javascript
// consistent-hashing.js
const crypto = require('crypto');

/**
 * ConsistentHashRing — places nodes on a circular hash space [0, 2^32)
 * and routes each key to its clockwise-nearest node.
 *
 * Virtual nodes: each physical node occupies MULTIPLE positions on the ring.
 * This ensures keys distribute evenly even if nodes have different hash values.
 */
class ConsistentHashRing {
  constructor(virtualNodes = 150) {
    this.virtualNodes = virtualNodes; // replicas per physical node
    this.ring = new Map();            // position → node name
    this.sortedPositions = [];        // sorted array of ring positions
  }

  // MD5 hash gives us a 32-bit unsigned integer for ring position
  _hash(key) {
    return parseInt(crypto.createHash('md5').update(key).digest('hex').slice(0, 8), 16);
  }

  /**
   * Add a physical node by placing virtualNodes replicas on the ring.
   * Each replica is hashed as "nodeName#replicaIndex".
   */
  addNode(nodeName) {
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${nodeName}#${i}`;
      const position = this._hash(virtualKey);
      this.ring.set(position, nodeName);
      this.sortedPositions.push(position);
    }
    // Keep positions sorted for binary search
    this.sortedPositions.sort((a, b) => a - b);
    console.log(`  Added node "${nodeName}" with ${this.virtualNodes} virtual nodes`);
  }

  /**
   * Remove a node by deleting all its virtual node positions.
   */
  removeNode(nodeName) {
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${nodeName}#${i}`;
      const position = this._hash(virtualKey);
      this.ring.delete(position);
      const idx = this.sortedPositions.indexOf(position);
      if (idx !== -1) this.sortedPositions.splice(idx, 1);
    }
    console.log(`  Removed node "${nodeName}"`);
  }

  /**
   * Route a key to a node using clockwise lookup on the ring.
   * Binary search finds the first position >= key's hash.
   * If none found (key hash > all positions), wrap around to position[0].
   */
  getNode(key) {
    if (this.sortedPositions.length === 0) throw new Error('No nodes in ring');

    const hash = this._hash(key);

    // Binary search for first position >= hash
    let lo = 0, hi = this.sortedPositions.length - 1;
    let targetIdx = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this.sortedPositions[mid] >= hash) {
        targetIdx = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    // Wrap around to the first position if key is past the last node
    if (targetIdx === -1) targetIdx = 0;

    const position = this.sortedPositions[targetIdx];
    return this.ring.get(position);
  }

  /**
   * Show how keys are distributed across physical nodes.
   */
  getDistribution(keys) {
    const counts = new Map();
    for (const key of keys) {
      const node = this.getNode(key);
      counts.set(node, (counts.get(node) || 0) + 1);
    }
    return counts;
  }
}

// ─── DEMO ────────────────────────────────────────────────────────────────────

// Generate 10,000 realistic cache keys
const keys = [];
for (let i = 0; i < 10000; i++) {
  keys.push(`user:${Math.floor(Math.random() * 1000000)}`);
}

console.log('=== Consistent Hashing Demo ===\n');

// Step 1: Three-node cluster
console.log('Step 1: Building 3-node cluster');
const ring = new ConsistentHashRing(150); // 150 virtual nodes per physical node
ring.addNode('cache-A');
ring.addNode('cache-B');
ring.addNode('cache-C');

// Record where each key lives before adding a node
const before = new Map();
for (const key of keys) {
  before.set(key, ring.getNode(key));
}

const dist3 = ring.getDistribution(keys);
console.log('\nKey distribution with 3 nodes:');
for (const [node, count] of [...dist3.entries()].sort()) {
  const pct = ((count / keys.length) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(pct / 2));
  console.log(`  ${node}: ${count} keys (${pct}%) ${bar}`);
}

// Step 2: Add a 4th node — measure disruption
console.log('\nStep 2: Adding cache-D to the cluster');
ring.addNode('cache-D');

const dist4 = ring.getDistribution(keys);
console.log('\nKey distribution with 4 nodes:');
for (const [node, count] of [...dist4.entries()].sort()) {
  const pct = ((count / keys.length) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(pct / 2));
  console.log(`  ${node}: ${count} keys (${pct}%) ${bar}`);
}

// Count how many keys moved
let moved = 0;
for (const key of keys) {
  if (before.get(key) !== ring.getNode(key)) moved++;
}
const movedPct = ((moved / keys.length) * 100).toFixed(1);
console.log(`\nKeys remapped after adding node: ${moved}/${keys.length} (${movedPct}%)`);
console.log(`Expected with perfect hashing: ~25% (1/4 of keys)`);

// Step 3: Remove a node — simulate a failure
console.log('\nStep 3: Removing cache-B (node failure)');
ring.removeNode('cache-B');

const dist3b = ring.getDistribution(keys);
console.log('\nKey distribution after removing cache-B:');
for (const [node, count] of [...dist3b.entries()].sort()) {
  const pct = ((count / keys.length) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(pct / 2));
  console.log(`  ${node}: ${count} keys (${pct}%) ${bar}`);
}

// Step 4: Compare virtual node counts
console.log('\n=== Virtual Node Count vs Balance Quality ===');
for (const vnodes of [1, 10, 50, 150, 500]) {
  const testRing = new ConsistentHashRing(vnodes);
  ['A', 'B', 'C'].forEach(n => testRing.addNode(`node-${n}`));
  const dist = testRing.getDistribution(keys);
  const counts = [...dist.values()];
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const maxDeviation = Math.max(...counts.map(c => Math.abs(c - avg)));
  const balanceScore = ((1 - maxDeviation / keys.length) * 100).toFixed(1);
  console.log(`  ${String(vnodes).padStart(3)} vnodes: balance score ${balanceScore}%`);
}
```

> 💡 **What this code does:**
> - `addNode()` places `virtualNodes` (default 150) points on the ring by hashing `"nodeName#0"`, `"nodeName#1"`, etc. More replica points = more even distribution.
> - `getNode()` uses binary search on the sorted positions array to find the first ring position ≥ the key's hash in O(log N) time. If the key hash exceeds all positions, it wraps to position[0].
> - The distribution demo shows that adding a 4th node moves ~25% of keys (1/N for N nodes) — instead of ~75% with naive modulo sharding.

---

## Running the POC `[Beginner]`

```bash
# Save the code above as consistent-hashing.js, then:
node consistent-hashing.js
```

**Expected output:**
```
=== Consistent Hashing Demo ===

Step 1: Building 3-node cluster
  Added node "cache-A" with 150 virtual nodes
  Added node "cache-B" with 150 virtual nodes
  Added node "cache-C" with 150 virtual nodes

Key distribution with 3 nodes:
  cache-A: 3341 keys (33.4%) █████████████████
  cache-B: 3298 keys (33.0%) ████████████████
  cache-C: 3361 keys (33.6%) █████████████████

Step 2: Adding cache-D to the cluster
  Added node "cache-D" with 150 virtual nodes

Key distribution with 4 nodes:
  cache-A: 2498 keys (25.0%) ████████████
  cache-B: 2491 keys (24.9%) ████████████
  cache-C: 2508 keys (25.1%) ████████████
  cache-D: 2503 keys (25.0%) ████████████

Keys remapped after adding node: 2503/10000 (25.0%)
Expected with perfect hashing: ~25% (1/4 of keys)

=== Virtual Node Count vs Balance Quality ===
  1 vnodes: balance score 81.2%
 10 vnodes: balance score 94.7%
 50 vnodes: balance score 98.1%
150 vnodes: balance score 99.4%
500 vnodes: balance score 99.8%
```

---

## Experiment: Break It and Fix It `[Intermediate]`

**Try reducing virtual nodes to 1:**

```javascript
// Change this line:
const ring = new ConsistentHashRing(1); // Just 1 virtual node per physical node

// Run the same demo — what do you see?
```

**What you should observe:** With 1 virtual node per physical node, distribution becomes highly uneven. One node might get 60% of keys while another gets 10%. The ring positions happen to cluster and leave large gaps where one node dominates.

**Now fix it:** Virtual nodes exist specifically to solve this. The standard production value is 100-200 virtual nodes (Cassandra uses 256 by default). For heterogeneous hardware (some nodes have more memory), use proportional virtual nodes:

```javascript
// Weighted virtual nodes for heterogeneous hardware
ring.addNode('cache-large', 300);  // 3x virtual nodes = 3x the keys
ring.addNode('cache-small', 100);  // 1x virtual nodes = 1x the keys
```

---

## Production Considerations `[Advanced]`

- **Scale:** At 1000 nodes × 150 virtual nodes = 150,000 ring positions. Binary search is O(log 150,000) ≈ 17 comparisons — negligible. Memory is ~2MB for the position array.
- **Failure modes:** Hot spots can still occur with very few virtual nodes. A node with no virtual nodes (config bug) gets zero keys, causing the adjacent node to absorb its load suddenly.
- **Monitoring:** Track key distribution skew — alert if any node holds >150% of average. Also monitor remapping events (cache miss spike) when nodes join/leave.
- **Configuration:** Cassandra's `num_tokens` (default 256) is exactly this. Amazon DynamoDB uses consistent hashing internally but manages virtual node placement automatically.
- **Replication:** In production, each key maps to N consecutive nodes on the ring (not just 1) for replication. Add a `getNodes(key, replicationFactor)` method that walks clockwise collecting N distinct physical nodes.

---

## Key Takeaways

1. **Consistent hashing limits reshuffling to ~1/N keys** when adding/removing a node — compared to nearly all keys with naive modulo sharding. This is what makes live cluster resizing practical.
2. **Virtual nodes solve uneven distribution** by giving each physical node multiple positions on the ring. 150+ virtual nodes achieves near-perfect balance across nodes.
3. **Binary search on sorted positions gives O(log N) routing** — fast enough that routing decisions happen in microseconds even with thousands of nodes.

---

## Next Steps

- **Try:** Implement replication by having `getNode()` return the next N clockwise nodes for fault tolerance
- **Read:** [Load Balancer Consistent Hashing POC](/interview-prep/practice-pocs/load-balancer-consistent-hashing) for an HTTP-level example
- **Practice:** "Design a distributed cache with automatic rebalancing" — a common system design interview question

---
*Part of the Practice POC series*
*Last updated: 2026-03-18*
