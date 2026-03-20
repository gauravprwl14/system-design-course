---
title: AI Agent Workflows
---

# AI Agent Workflows

AI agents are the next evolution beyond plain LLM calls. Instead of a single prompt → response, an agent runs a loop: it reasons, picks a tool, executes it, sees the result, and keeps going until the task is done. This section teaches you how to design, build, evaluate, and operate agents in production.

## Who This Is For

- **Backend engineers** adding AI capabilities to existing systems
- **ML engineers** building agentic pipelines
- **System designers** who need to reason about agent architecture at scale
- **Anyone** who wants to understand how tools like Claude Code, GitHub Copilot, and ChatGPT Plugins actually work under the hood

## Learning Path

Start with concepts, then apply them in hands-on exercises, explore real platform implementations, and finally learn what can go wrong (and how to prevent it).

```
Concepts → Hands-On → Platforms → Failure Modes
   ↓            ↓          ↓            ↓
 Theory      Working     Real tools   What breaks
            examples    deep-dives    in prod
```

## Section Map

| Subsection | What You'll Learn | Level |
|------------|------------------|-------|
| [📖 Concepts](./concepts) | Core agent patterns: ReAct, tool use, memory, orchestration, safety, MCP | 🟢 → ⚫ |
| [🔬 Hands-On](./hands-on) | Runnable pseudocode exercises for each pattern | 🟢 → 🔴 |
| [🛠️ Platforms](./platforms) | LangChain, LangGraph, AutoGen, CrewAI, Claude API deep-dives | 🟡 → ⚫ |
| [⚠️ Failure Modes](./failures) | What breaks in production agents and how to fix it | 🔴 → ⚫ |

## Concepts at a Glance

### Foundations (Beginner)
1. [What is an AI Agent?](./concepts/what-is-an-agent) — LLM + memory + tools + action loop
2. [ReAct Pattern](./concepts/react-pattern) — Reason + Act interleaved
3. [Tool Use & Function Calling](./concepts/tool-use-function-calling) — How agents call external code

### Architecture (Intermediate)
4. [Agent Memory Types](./concepts/agent-memory-types) — In-context, vector, episodic, semantic
5. [Single-Agent Architecture](./concepts/single-agent-architecture) — When one agent is enough
6. [Multi-Agent Systems](./concepts/multi-agent-systems) — Parallelism, specialization, topologies
7. [Orchestrator-Worker Pattern](./concepts/orchestrator-worker-pattern) — Delegating sub-tasks
8. [RAG Deep Dive](./concepts/rag-deep-dive) — Grounding agents in real documents

### Advanced Patterns (Advanced)
9. [Hierarchical Multi-Agent](./concepts/hierarchical-multi-agent) — Multi-level coordination
10. [Agent Communication Protocols](./concepts/agent-communication-protocols) — How agents talk
11. [Long-Running Agents](./concepts/long-running-agents) — Checkpointing, async, human-in-loop
12. [Agent Evaluation & Testing](./concepts/agent-evaluation-testing) — Non-deterministic testing
13. [Cost Control for Agents](./concepts/cost-control-agents) — Token budgets, model routing
14. [Agent Observability](./concepts/agent-observability) — Tracing, metrics, alerts
15. [Safety & Guardrails](./concepts/safety-guardrails) — Input/output filtering, action limits

### Expert Patterns (Expert)
16. [Model Context Protocol](./concepts/model-context-protocol) — Anthropic's standard for tool interop
17. [LangGraph Stateful Agents](./concepts/langgraph-stateful-agents) — Graph-based agent workflows
18. [Agent Tool Registry](./concepts/agent-tool-registry) — Dynamic tool discovery at scale

## Key Mental Models

**Agent ≠ Chatbot**: A chatbot responds. An agent acts. Agents can read files, run code, call APIs, search the web, and coordinate with other agents — all autonomously.

**The action loop is the core primitive**: Every agent, from simple to expert-level, runs a loop: perceive → decide → act → observe → repeat.

**Context is the bottleneck**: Every token in an agent's context costs money and adds latency. Most agent design decisions are about managing what goes in the context and what gets offloaded to memory or tools.

**Failure modes compound**: In a 10-step agent, a 5% per-step error rate gives you a ~40% chance of failure. Reliability engineering matters more for agents than for single LLM calls.
