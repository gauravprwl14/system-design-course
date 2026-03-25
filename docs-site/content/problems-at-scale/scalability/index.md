---
title: "Scalability & Hot Spots"
description: "When distribution creates concentration instead of spreading load"
---

# Scalability & Hot Spots

Adding more nodes doesn't always help when your data or traffic is unevenly distributed. These problems describe what happens when scaling creates new bottlenecks.

```mermaid
graph TD
    HOTPART[Hot Partition\nCelebrity post → 100M req to 1 node] -->|root cause| SKEW[Trending key maps to single shard]
    SKEW -->|fix| SUFFIX[Random suffix sharding\n+ fan-out on read]
    WRITEAMP[Write Amplification\n1 INSERT → 10x disk writes] -->|root cause| MULTIIDX[Many secondary indexes\n+ WAL + replication overhead]
    MULTIIDX -->|fix| PRUNE[Remove unused indexes\n+ batch writes + LSM tuning]
```

## Problems in This Section

| Problem | The Pain |
|---------|----------|
| [Hot Partition](hot-partition) | Celebrity post routes 100M requests to 1 node |
| [Write Amplification](write-amplification) | One INSERT triggers 10x physical disk writes |
