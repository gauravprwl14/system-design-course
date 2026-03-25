# 13-agent-workflows/ — Layer 1 Module

Design, build, evaluate, and operate AI agents in production — covering the full lifecycle from single-agent loops to multi-agent orchestration, failure modes, and real case studies.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Core agent theory: architectures, patterns, protocols, memory, RAG, safety, and observability |
| hands-on/ | poc | Runnable POCs: basic agent loop, RAG pipeline, tool-calling agent, MCP server, multi-agent pipeline |
| platforms/ | reference | Platform comparisons: LangChain, CrewAI, AutoGen, AWS Bedrock Agents, OpenAI Assistants API |
| failures/ | problem | Failure modes: tool call errors, hallucination, context overflow, infinite loops, prompt injection, cost runaway |
| case-studies/ | case-study | Real-world walkthroughs: ReAct data agent, OpenClaw architecture and extracted patterns |

## Article Count
- concepts/: 38 articles (incl. 3 inline POCs)
- hands-on/: 6 articles
- platforms/: 6 articles
- failures/: 7 articles
- case-studies/: 5 articles
- Total: 62 articles

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| What is an agent? | concepts/ | what-is-an-agent.md, single-agent-architecture.md |
| Build a first agent | concepts/ + hands-on/ | from-zero-to-production-agent.md, basic-agent-loop.md |
| Understand ReAct loop | concepts/ | react-pattern.md |
| Add tools to an agent | concepts/ + hands-on/ | tool-use-function-calling.md, tool-calling-agent.md |
| Multi-agent design | concepts/ | multi-agent-systems.md, orchestrator-worker-pattern.md, hierarchical-multi-agent.md |
| RAG pipeline | concepts/ + hands-on/ | rag-deep-dive.md, rag-pipeline.md |
| Memory management | concepts/ | agent-memory-types.md, context-window-management.md |
| Agent safety | concepts/ | safety-guardrails.md, prompt-engineering-for-agents.md |
| Observability & tracing | concepts/ | agent-observability.md, trace-to-prompt-improvement-poc.md |
| Cost control | concepts/ | cost-control-agents.md, multi-model-routing.md |
| MCP / A2A protocols | concepts/ + hands-on/ | model-context-protocol.md, agent-to-agent-protocol.md, mcp-server.md |
| Choose a platform | platforms/ | overview.md, langchain.md, crewai.md, autogen.md |
| Debug agent issues | failures/ | tool-call-failures.md, hallucination-in-agents.md, infinite-loops.md |
| Production deployment | concepts/ | enterprise-agent-deployment.md, long-running-agents.md |
| Real case study | case-studies/ | openclaw-architecture.md, react-databot-case-study.md |

## Prerequisites
- LLM basics (prompt → response, tokens, temperature)
- REST API / function call familiarity
- Basic async programming

## Connects To
- 12-interview-prep/ — agent-related interview questions
- 15-vector-databases/ — RAG pipelines rely on vector search
- 09-observability/ — tracing and metrics for agent runs
- 08-security/ — prompt injection and guardrails context
