---
title: "AI Agents & LLM Systems — Interview Questions"
description: "System design interview questions for AI agents, RAG, tool calling, multi-agent systems, and prompt injection defense."
---

# AI Agents & LLM Systems — Interview Q&A

7 real interview questions covering the full LLM system design stack. These questions appear at FAANG and AI-first companies for senior engineer and above roles.

> These questions live in the [Interview Prep section](../../12-interview-prep/system-design/ai-and-agents) and are linked here for context within your learning path. Complete at least Stage 2 of the [AI Agents learning path](/13-agent-workflows) before tackling these.

## Questions at a Glance

| # | Question | Link | Difficulty |
|---|----------|------|-----------|
| 1 | Design a system where an AI agent autonomously completes multi-step tasks | [Agent Loop Design](../../12-interview-prep/system-design/ai-and-agents/agent-loop-design) | 🔴 Advanced |
| 2 | Design the tool-calling layer for an AI agent | [Tool Calling Patterns](../../12-interview-prep/system-design/ai-and-agents/tool-calling-patterns) | 🟡 Intermediate |
| 3 | Design multiple AI agents coordinating on a research task | [Multi-Agent Coordination](../../12-interview-prep/system-design/ai-and-agents/multi-agent-coordination) | 🔴 Advanced |
| 4 | Design a Q&A system over a 10M-document knowledge base | [RAG Architecture](../../12-interview-prep/system-design/ai-and-agents/rag-architecture) | 🟡 Intermediate |
| 5 | Design an API layer for 1M daily LLM-powered users | [Designing APIs on LLMs](../../12-interview-prep/system-design/ai-and-agents/llm-api-design) | 🟡 Intermediate |
| 6 | How do you monitor and evaluate an AI agent in production? | [Agent Observability & Evals](../../12-interview-prep/system-design/ai-and-agents/agent-observability) | 🟡 Intermediate |
| 7 | Your agent reads user emails and takes actions — prevent prompt injection | [Prompt Injection Defense](../../12-interview-prep/system-design/ai-and-agents/prompt-injection-defense) | 🔴 Advanced |

## Key Numbers to Memorize

| Item | Value |
|------|-------|
| GPT-4o context window | 128K tokens |
| Claude 3.5/3.7 context window | 200K tokens |
| LLM API p99 latency | 5–30s |
| Typical tool call latency | 200ms–2s |
| ANN vector search (HNSW) | ~5ms |
| Cosine similarity threshold for semantic cache hit | 0.95 |
| GPT-4o cost (2025) | ~$5/M input tokens |

## Recommended Study Order

1. [Agent Loop Design](../../12-interview-prep/system-design/ai-and-agents/agent-loop-design) — foundational
2. [RAG Architecture](../../12-interview-prep/system-design/ai-and-agents/rag-architecture) — most common today
3. [LLM API Design](../../12-interview-prep/system-design/ai-and-agents/llm-api-design) — for platform/infra roles
4. [Tool Calling Patterns](../../12-interview-prep/system-design/ai-and-agents/tool-calling-patterns) — agent safety depth
5. [Multi-Agent Coordination](../../12-interview-prep/system-design/ai-and-agents/multi-agent-coordination) — senior/staff
6. [Agent Observability](../../12-interview-prep/system-design/ai-and-agents/agent-observability) — SRE focus
7. [Prompt Injection Defense](../../12-interview-prep/system-design/ai-and-agents/prompt-injection-defense) — security focus

→ [Browse full AI/LLM interview section](../../12-interview-prep/system-design/ai-and-agents)
