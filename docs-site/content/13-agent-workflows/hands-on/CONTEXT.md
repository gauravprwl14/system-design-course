# 13-agent-workflows/hands-on/ — Layer 2 Router

Runnable proof-of-concepts for building agents — from a minimal agent loop to a production-grade multi-agent research pipeline.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Section overview and recommended order |
| basic-agent-loop | Minimal agent loop in Python: LLM call, tool dispatch, iteration — the simplest working agent |
| rag-pipeline | End-to-end RAG pipeline: document ingestion, embedding, vector retrieval, answer generation |
| mcp-server | Build an MCP server that exposes tools and resources to Claude/agents via the Model Context Protocol |
| tool-calling-agent | Production-grade tool-calling agent with error handling, retries, and structured output |
| multi-agent-pipeline | Multi-agent research pipeline: orchestrator spawns specialist agents, aggregates results |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| First working agent in <50 lines | basic-agent-loop.md |
| Add document retrieval to an agent | rag-pipeline.md |
| Expose tools via MCP | mcp-server.md |
| Production tool-calling with error handling | tool-calling-agent.md |
| Parallel multi-agent research task | multi-agent-pipeline.md |
