# 15-vector-databases/concepts/ — Layer 2 Router

Core theory for vector databases — from what an embedding is to how HNSW indexes work, how to search, and which database to choose.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Overview: what vector databases are, why they matter, and how content is organized |
| embeddings | What embeddings are, how they encode semantic meaning, model types (dense vs sparse), dimensionality |
| vector-index | ANN index algorithms: Flat, IVF, HNSW, PQ — trade-offs between speed, memory, and recall |
| similarity-search | Similarity metrics (cosine, dot product, L2/Euclidean), k-NN vs ANN, recall vs latency |
| hybrid-search | Combining vector search with keyword (BM25) search: fusion strategies, when to use |
| reranking | Reranking retrieved candidates with a cross-encoder: quality improvement, latency cost |
| vector-db-comparison | Comparison of Pinecone, Weaviate, Qdrant, Milvus, pgvector — hosted vs self-hosted, features, scale |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| What is an embedding? | embeddings.md |
| How HNSW / IVF indexing works | vector-index.md |
| Cosine vs L2 similarity | similarity-search.md |
| Combine BM25 + vector search | hybrid-search.md |
| Improve top-K retrieval quality | reranking.md |
| Which vector DB should I use? | vector-db-comparison.md |
