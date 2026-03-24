---
title: "Consistency & Stale Data"
description: "When reads don't reflect recent writes — the subtle bugs that erode user trust"
---

# Consistency & Stale Data

Distributed systems trade consistency for availability and partition tolerance. These are the failure modes that result when that trade-off is not handled carefully.

```mermaid
graph TD
    STALE[Stale Read After Write] -->|root cause| REPLICA[Read from replica\nbefore replication catches up]
    REPLICA -->|fix| STICKY[Sticky sessions to primary\nor read-after-write tokens]
    RACE[Cache Invalidation Race] -->|root cause| WRITE_RACE[Stale write races with fresh delete\nin cache update path]
    WRITE_RACE -->|fix| LOCK[Distributed lock\nor cache-aside with version check]
```

## Problems in This Section

| Problem | The Pain |
|---------|----------|
| [Stale Read After Write](stale-read-after-write) | User updates profile, still sees old data |
| [Cache Invalidation Race](cache-invalidation-race) | Stale value overwrites fresh value |
