# 15-vector-databases/failures/ — Layer 2 Router

Production failure modes specific to vector databases and embedding-based retrieval — silent degradation, staleness, and scaling limits.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Overview of vector DB failure categories and a triage decision tree |
| embedding-drift | Embedding model drift: what happens when the model changes and vectors become inconsistent |
| index-staleness | Index staleness and write amplification: out-of-date HNSW/IVF indexes after high write volume |
| retrieval-quality-degradation | Silent retrieval quality degradation: queries return results but relevance quietly decreases |
| vector-db-scaling-failures | Scaling failures: memory exhaustion, slow index build, latency spikes under high QPS |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Upgrading embedding model breaks search | embedding-drift.md |
| Recent documents not appearing in results | index-staleness.md |
| Search "works" but results feel wrong | retrieval-quality-degradation.md |
| Vector DB slows down / OOMs at scale | vector-db-scaling-failures.md |
