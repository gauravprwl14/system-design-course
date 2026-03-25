# 15-vector-databases/ — Layer 1 Module

Vector databases and semantic search — covering embeddings, ANN index algorithms, similarity search, hybrid search, reranking, and production failure modes.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Core theory: embeddings, vector index algorithms (HNSW/IVF), similarity search, hybrid search, reranking, and DB comparison |
| failures/ | problem | Production failure modes: embedding drift, index staleness, silent retrieval degradation, scaling failures |
| hands-on/ | poc | Runnable POCs: pgvector setup, similarity search from scratch, embedding ingestion pipeline, hybrid BM25+vector search |

## Article Count
- concepts/: 7 articles
- failures/: 5 articles
- hands-on/: 5 articles
- Total: 17 articles

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| What are embeddings? | concepts/ | embeddings.md |
| How does ANN / HNSW work? | concepts/ | vector-index.md |
| Cosine vs dot product vs L2 similarity | concepts/ | similarity-search.md |
| Combine keyword + vector search | concepts/ + hands-on/ | hybrid-search.md, hybrid-search-poc.md |
| Improve retrieval quality with reranking | concepts/ | reranking.md |
| Compare Pinecone vs Weaviate vs Qdrant | concepts/ | vector-db-comparison.md |
| Get started with pgvector | hands-on/ | pgvector-setup.md |
| Build a similarity search pipeline | hands-on/ | similarity-search-poc.md |
| Ingest embeddings at scale | hands-on/ | embedding-pipeline.md |
| Embedding model changes behavior silently | failures/ | embedding-drift.md |
| Stale index after updates | failures/ | index-staleness.md |
| Retrieval quality drops without errors | failures/ | retrieval-quality-degradation.md |
| Vector DB doesn't scale | failures/ | vector-db-scaling-failures.md |

## Prerequisites
- Basic understanding of machine learning / neural networks
- Familiarity with SQL and database concepts (see 01-databases/)
- Helpful: 14-algorithms/ data structures (especially graphs and ANN context)

## Connects To
- 13-agent-workflows/ — RAG pipelines use vector search as the retrieval backbone
- 14-algorithms/ — ANN index algorithms (HNSW, IVF) are a specialized data structure topic
- 01-databases/ — pgvector extends PostgreSQL; comparison with traditional DBs
- 09-observability/ — monitoring retrieval quality and embedding freshness
