# 15-vector-databases/hands-on/ — Layer 2 Router

Runnable vector database POCs — from a minimal pgvector setup to a full hybrid search pipeline.

## Files in This Section

| File | Description |
|------|-------------|
| overview | POC index, prerequisites, and recommended order |
| pgvector-setup | Set up pgvector in PostgreSQL: extension install, create vector column, index, and first similarity query |
| similarity-search-poc | Similarity search from scratch without a vector DB: embed, store, cosine search — understand the fundamentals |
| embedding-pipeline | Embedding ingestion pipeline: batch documents, call embedding API, upsert into vector store with metadata |
| hybrid-search-poc | Hybrid search POC: run BM25 keyword search and vector search in parallel, fuse results with RRF |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Easiest way to add vector search to Postgres | pgvector-setup.md |
| Understand how similarity search works internally | similarity-search-poc.md |
| Ingest thousands of documents into a vector DB | embedding-pipeline.md |
| Combine keyword and semantic search | hybrid-search-poc.md |
