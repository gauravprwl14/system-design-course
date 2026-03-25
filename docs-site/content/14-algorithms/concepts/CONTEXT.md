# 14-algorithms/concepts/ — Layer 2 Router

Data structures and algorithms that power production systems — storage engines, caches, probabilistic filters, and search indexes.

## Files in This Section

| File | Description |
|------|-------------|
| index | Overview and reading guide for core algorithm concepts |
| binary-search | Binary search theory, variants (lower bound, upper bound), and applications in sorted data |
| lru-lfu-cache | LRU and LFU eviction policies: linked-list + hash-map implementation, trade-offs |
| heap-priority-queue | Binary heap, min/max heap, priority queue operations, use cases (top-K, Dijkstra) |
| b-tree-database-index | B+ Tree structure used in relational databases: node splits, range scans, vs hash index |
| skip-list | Skip list: probabilistic linked list with O(log n) operations, used in Redis and LevelDB |
| bloom-filter | Bloom filter: space-efficient probabilistic set membership, false positive rate tuning |
| trie-prefix-tree | Trie (prefix tree): autocomplete, spell checking, IP routing tables |
| consistent-hashing-deep-dive | Consistent hashing theory: virtual nodes, hotspot avoidance, rebalancing |
| geospatial-algorithms | Geospatial indexing: geohash, QuadTree, R-Tree, proximity queries |
| lsm-tree | LSM Tree: log-structured merge tree used in Cassandra, RocksDB — write amplification, compaction |
| count-min-sketch | Count-Min Sketch: probabilistic frequency estimation in streaming data |
| hyperloglog | HyperLogLog: approximate distinct count with sub-1% error at kilobytes of memory |
| merkle-tree | Merkle tree: cryptographic hash tree for data integrity, anti-entropy in distributed systems |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| How does a database index work internally? | b-tree-database-index.md |
| Build a cache with eviction | lru-lfu-cache.md |
| Probabilistic membership testing | bloom-filter.md |
| How Redis sorts sets internally | skip-list.md |
| Distribute keys across nodes | consistent-hashing-deep-dive.md |
| Store and query location data | geospatial-algorithms.md |
| Why Cassandra writes are fast | lsm-tree.md |
| Count distinct users at scale | hyperloglog.md |
| Detect data corruption across replicas | merkle-tree.md |
| Count most frequent items in a stream | count-min-sketch.md |
| Autocomplete feature | trie-prefix-tree.md |
