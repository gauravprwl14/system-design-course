# 14-algorithms/ — Layer 1 Module

Algorithm knowledge for system design interviews and production distributed systems — covering data structures, distributed consensus algorithms, interview patterns, and hands-on POCs.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Core data structures used in production: B+Tree, Bloom Filter, LSM Tree, Trie, Consistent Hashing, HyperLogLog, etc. |
| distributed/ | concept | Distributed algorithms: Raft, Paxos, Gossip, Vector Clocks, CRDTs, Two-Phase Commit, Topological Sort |
| interview-patterns/ | concept | LeetCode-style patterns mapped to system design: Sliding Window, DP, Graph BFS/DFS, Union-Find, etc. |
| hands-on/ | poc | Runnable implementations: Bloom Filter, LRU Cache, Consistent Hashing, Trie, External Sort, Segment Tree, Dijkstra |

## Article Count
- concepts/: 13 articles (+ index)
- distributed/: 11 articles
- interview-patterns/: 23 articles
- hands-on/: 10 articles
- Total: 57 articles

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| What data structures power databases? | concepts/ | b-tree-database-index.md, lsm-tree.md, skip-list.md |
| How does consistent hashing work? | concepts/ + distributed/ | consistent-hashing-deep-dive.md, consistent-hashing-with-virtual-nodes.md |
| Implement a cache (LRU/LFU) | concepts/ + hands-on/ | lru-lfu-cache.md, lru-cache-poc.md |
| Bloom filter: theory and code | concepts/ + hands-on/ | bloom-filter.md, bloom-filter-poc.md |
| Distributed consensus (Raft/Paxos) | distributed/ | raft-consensus.md, paxos-made-simple.md |
| How nodes detect failures? | distributed/ | gossip-protocol.md, phi-accrual-failure-detector.md |
| Conflict-free replicated data types | distributed/ | crdt-conflict-free-data-types.md, vector-clocks.md |
| Sliding window / two pointers | interview-patterns/ | sliding-window-pattern.md, two-pointers-pattern.md |
| Dynamic programming | interview-patterns/ | dynamic-programming-patterns.md |
| Graph traversal patterns | interview-patterns/ | graph-bfs-dfs-pattern.md, graph-shortest-path.md |
| How to approach any coding problem | interview-patterns/ | problem-solving-framework.md |
| Algorithms used in production | interview-patterns/ | algorithms-in-production.md |
| Build Trie autocomplete | hands-on/ | trie-autocomplete-poc.md |
| External sort large datasets | distributed/ + hands-on/ | external-sorting.md, external-sort-poc.md |

## Prerequisites
- Basic data structures (arrays, linked lists, trees, hash maps)
- Big-O notation
- For distributed/: understanding of CAP theorem and distributed system basics (see 05-distributed-systems/)

## Connects To
- 05-distributed-systems/ — Raft/Paxos connect to replication and consensus
- 01-databases/ — B+Tree, LSM Tree, and skip lists are core database internals
- 02-caching/ + 03-redis/ — LRU/LFU cache and Bloom filter are used in Redis
- 15-vector-databases/ — ANN algorithms are a specialization of the data structures here
- 12-interview-prep/ — interview-patterns/ directly feeds interview preparation
