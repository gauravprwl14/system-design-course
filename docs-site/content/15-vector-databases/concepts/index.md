---
title: Vector Database Concepts
---

# Vector Database Concepts

This section covers the foundational concepts behind vector databases and semantic search — from how text becomes a float vector all the way to choosing the right database for production.

## Articles in This Section

### Foundations (Beginner)
1. [Embeddings](./embeddings) — What dense vectors are, how embedding models convert text to numbers, why "king - man + woman = queen" works

### Indexing (Advanced)
2. [Vector Index Algorithms](./vector-index) — HNSW, IVF, FLAT compared; when to use each; memory vs recall trade-offs

### Search Mechanics (Intermediate)
3. [Similarity Search](./similarity-search) — Cosine similarity vs dot product vs Euclidean; ANN vs exact KNN; recall@K tuning
4. [Hybrid Search](./hybrid-search) — Combining dense vector search with sparse BM25 using Reciprocal Rank Fusion
5. [Reranking](./reranking) — Two-stage retrieval: fast bi-encoder retrieval followed by precise cross-encoder reranking

### Database Selection (Intermediate)
6. [Vector DB Comparison](./vector-db-comparison) — Pinecone, Weaviate, Qdrant, pgvector, Chroma, Milvus compared

## Reading Order

For a first-time reader: **Embeddings → Similarity Search → Hybrid Search → Reranking → Vector Index → Vector DB Comparison**

For an engineer evaluating databases: start with **Vector DB Comparison**, then go deeper on **Vector Index** and **Hybrid Search**.

For an ML engineer optimizing recall: focus on **Similarity Search**, **Reranking**, and **Hybrid Search**.
