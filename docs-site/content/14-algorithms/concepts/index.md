---
title: Foundational Algorithms
layer: concept
section: algorithms/concepts
tags: [algorithms, data-structures, foundations]
---

# Foundational Algorithms

> These 15 algorithms are the building blocks of every database, cache, and distributed system in production today.

This section covers algorithms organized by complexity — from binary search that every junior engineer should know, to LSM trees and Merkle trees that power Cassandra and Git at their core.

Each article is structured identically:

1. **The Core Idea** — Plain English with an analogy
2. **How It Works** — Step-by-step pseudocode
3. **Visual Walkthrough** — Mermaid diagram
4. **Where This Appears in Real Systems** — Named systems, named use cases
5. **Complexity Analysis** — Big-O with plain English meaning
6. **Trade-offs** — Comparison table vs alternatives
7. **Interview Connection** — What interviewers actually ask

---

## Articles in This Section

### Beginner

- [Binary Search](/14-algorithms/concepts/binary-search) — How databases find rows in O(log N) without scanning
- [LRU / LFU Cache](/14-algorithms/concepts/lru-lfu-cache) — How Redis decides what to evict under memory pressure
- [Heap & Priority Queue](/14-algorithms/concepts/heap-priority-queue) — How Kubernetes schedules pods and Kafka merges sorted streams

### Intermediate

- [B+Tree (Database Index)](/14-algorithms/concepts/b-tree-database-index) — The data structure behind every PostgreSQL index
- [Skip List](/14-algorithms/concepts/skip-list) — Why Redis chose this over a balanced BST for sorted sets
- [Bloom Filter](/14-algorithms/concepts/bloom-filter) — How Cassandra avoids disk reads for keys that don't exist
- [Trie / Prefix Tree](/14-algorithms/concepts/trie-prefix-tree) — How search autocomplete and IP routing work
- [Consistent Hashing](/14-algorithms/concepts/consistent-hashing-deep-dive) — How DynamoDB and Cassandra add/remove nodes without rehashing everything
- [Union-Find](/14-algorithms/interview-patterns/union-find-pattern) — How systems detect connected components in graphs
- [Geospatial Algorithms](/14-algorithms/concepts/geospatial-algorithms) — How Uber matches drivers and Redis handles GEORADIUS
- [Rate Limiting Algorithms](/14-algorithms/interview-patterns/sliding-window-pattern) — Five algorithms: fixed window, sliding log, sliding counter, token bucket, leaky bucket

### Advanced

- [LSM Tree](/14-algorithms/concepts/lsm-tree) — Why RocksDB, Cassandra, and HBase can write faster than PostgreSQL
- [Count-Min Sketch](/14-algorithms/concepts/count-min-sketch) — How Twitter counts hashtag frequency in fixed memory
- [HyperLogLog](/14-algorithms/concepts/hyperloglog) — How Redis counts billions of unique visitors in 12KB
- [Merkle Tree](/14-algorithms/concepts/merkle-tree) — How Git tracks file changes and Cassandra detects replica drift
