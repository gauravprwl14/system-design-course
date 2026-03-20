---
title: Vector Database Failure Modes
layer: concept
section: vector-databases/failures
---

# Vector Database Failure Modes

Vector databases fail in ways that are uniquely hard to detect: the system keeps returning results, the latency looks normal, but the answers are silently wrong. This section covers the four most common production failure patterns.

## Why Vector DB Failures Are Different

```mermaid
graph TD
    A[Traditional DB Failure] --> B[Explicit Error / Exception]
    A --> C[Query returns 0 rows]
    A --> D[Latency spike]
    E[Vector DB Failure] --> F[Returns results — they're just wrong]
    E --> G[Recall@K degrades silently]
    E --> H[Memory grows until OOM]
    E --> I[Index rebuild blocks all queries]
```

With a relational database, failures are usually loud — an error code, a timeout, zero rows returned. With vector databases, the most dangerous failures are quiet: retrieval quality degrades over weeks while the system looks healthy from the outside.

## Failure Modes in This Section

| Failure | Severity | Detection | Recovery Cost |
|---------|----------|-----------|---------------|
| [Embedding Model Drift](./embedding-drift) | Critical | Hard — requires golden query set | High — full re-embed |
| [Index Staleness](./index-staleness) | Medium | Medium — index size metrics | Medium — rebuild job |
| [Silent Retrieval Degradation](./retrieval-quality-degradation) | Critical | Hard — requires eval pipeline | Medium — depends on root cause |
| [Scaling Failures](./vector-db-scaling-failures) | High | Easy — OOM, latency spikes | High — resharding |

## The #1 Production Mistake

Switching embedding models without re-indexing. When you upgrade from `text-embedding-ada-002` to `text-embedding-3-small`, every existing vector in your store was produced by the old model's geometry. Querying with new-model embeddings against old-model vectors returns garbage — and there is no error, no exception, just wrong results.

See [Embedding Model Drift](./embedding-drift) for the full migration strategy.

## Building a Minimal Safety Net

Before going to production with any vector DB, set up these three checks:

1. **Golden query set** — 20–50 hand-labeled (query, expected_doc_ids) pairs. Run recall@5 on every deployment.
2. **Index size monitoring** — alert when index grows >20% above expected for the current vector count.
3. **Memory headroom** — keep at least 2× current HNSW index size free in RAM to allow index rebuilds.

See [Silent Retrieval Quality Degradation](./retrieval-quality-degradation) for the full monitoring pipeline.
