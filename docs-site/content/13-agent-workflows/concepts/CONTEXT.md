# 13-agent-workflows/concepts/ — Layer 2 Router

Core theory and architecture for building AI agents — from the basic agent loop to multi-agent orchestration, protocols, safety, and production concerns.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Section overview and reading guide |
| from-zero-to-production-agent | End-to-end guide: build and ship a production agent from scratch |
| enterprise-agent-deployment | Patterns for deploying agents in enterprise environments (auth, governance, audit) |
| what-is-an-agent | Definition of an AI agent, anatomy of the agent loop, comparison with plain LLM calls |
| llm-fundamentals-for-agents | LLM concepts every agent builder needs: tokens, context, sampling, tool schemas |
| react-pattern | ReAct (Reason + Act) loop: interleaving reasoning traces with tool calls |
| tool-use-function-calling | How to define tools, schema design, error handling for function calling |
| prompt-engineering-for-agents | System prompt patterns, chain-of-thought, few-shot examples for agents |
| agent-memory-types | Semantic, episodic, procedural, and working memory — when to use each |
| agent-skills | Dynamic skill/tool injection, skill registries, and context budgeting |
| single-agent-architecture | Design of a single self-contained agent: loop, state, tools, stopping conditions |
| multi-agent-systems | Patterns for multiple cooperating agents: fan-out, peer-to-peer, critique loops |
| orchestrator-worker-pattern | Central orchestrator dispatching to specialized worker agents |
| rag-deep-dive | Retrieval-Augmented Generation: chunking, embedding, retrieval, reranking in agents |
| structured-output | Getting JSON/typed output from LLMs: JSON mode, function schemas, validation |
| agent-routing | Intent classification and dynamic routing between specialized agents |
| hierarchical-multi-agent | Multi-level agent hierarchies: managers, subagents, delegation protocols |
| agent-communication-protocols | Message formats and protocols for agents communicating with each other |
| long-running-agents | Checkpointing, resumption, and state management for multi-hour/day agent jobs |
| event-triggered-agents | Agents activated by webhooks, scheduled events, or queue messages |
| code-sandbox-agents | Safe code execution in sandboxed environments for coding agents |
| human-in-the-loop | Approval gates, clarification requests, and human escalation patterns |
| planning-patterns | Chain-of-thought planning, tree-of-thought, plan-and-execute, self-refinement |
| context-window-management | Strategies for fitting long tasks into limited context: summarization, compression, sliding window |
| agent-evaluation-testing | How to measure and improve agent performance: test suites, LLM-as-judge, benchmarks |
| cost-control-agents | Token budgeting, model tier selection, caching, and stopping heuristics |
| multi-model-routing | Routing requests across different LLM providers and model sizes with fallback |
| agent-observability | Structured tracing, span logging, and metrics for agent runs in production |
| safety-guardrails | Input/output guardrails, content filtering, scope limiting, and red-teaming |
| agent-to-agent-protocol | Google's A2A protocol: agent cards, task envelopes, streaming responses |
| agent-client-protocol | ACP (Agent Client Protocol): REST-based standard for agent invocation |
| model-context-protocol | Anthropic's MCP: structured tool/resource exposure to agents via servers |
| langgraph-stateful-agents | Building stateful, graph-based agents with LangGraph: nodes, edges, checkpoints |
| agent-tool-registry | Central registry for discovering, versioning, and managing tools across agents |
| context-engineering | Deliberate construction of agent context: relevance, recency, compression |
| agent-harness-design | Test harness design: fixtures, replay, deterministic evaluation |
| procedural-memory-poc | POC: storing and reusing learned procedures across agent sessions |
| llm-judge-alignment-poc | POC: using an LLM judge to score and align agent outputs |
| trace-to-prompt-improvement-poc | POC: automated prompt improvement loop driven by production traces |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| New to agents — where to start? | what-is-an-agent.md → react-pattern.md → tool-use-function-calling.md |
| Build end-to-end agent fast | from-zero-to-production-agent.md |
| Memory persistence across sessions | agent-memory-types.md → procedural-memory-poc.md |
| Multi-agent system design | multi-agent-systems.md → orchestrator-worker-pattern.md → hierarchical-multi-agent.md |
| RAG within an agent | rag-deep-dive.md |
| Agent won't stop or loops | planning-patterns.md → context-window-management.md |
| Measure agent quality | agent-evaluation-testing.md → llm-judge-alignment-poc.md |
| Reduce agent cost | cost-control-agents.md → multi-model-routing.md |
| Implement MCP server | model-context-protocol.md |
| Agent safety and content policy | safety-guardrails.md |
| Trace agent runs in production | agent-observability.md → trace-to-prompt-improvement-poc.md |
