# AI-Native Development — Knowledge Checklist

> Coverage status against the 100-topic AI-Native Development checklist.
> Updated: 2026-03-27

## Coverage Legend
- ✅ Covered — dedicated article exists
- 🔶 Partial — topic mentioned but no deep article
- ❌ Gap — not covered, article needed

---

## 1. Foundation & Core Concepts

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 1 | Large Language Models (LLMs) | ✅ | [LLM Fundamentals for Agent Builders](./concepts/llm-fundamentals-for-agents) |
| 2 | Tokens & Tokenization | ✅ | [LLM Fundamentals for Agent Builders](./concepts/llm-fundamentals-for-agents) |
| 3 | Context Window | ✅ | [Context Window Management](./concepts/context-window-management) |
| 4 | Temperature & Sampling | ✅ | [LLM Fundamentals for Agent Builders](./concepts/llm-fundamentals-for-agents) |
| 5 | Embeddings | ✅ | [Embeddings — Turning Text into Vectors](../15-vector-databases/concepts/embeddings) |
| 6 | Inference vs. Training | 🔶 | Mentioned in LLM Fundamentals, no dedicated article |
| 7 | Foundation Models vs. Fine-tuned | ❌ | **Gap** — see [fine-tuning-fundamentals](./concepts/fine-tuning-fundamentals) |
| 8 | Multimodal Models | ❌ | **Gap** — see [multimodal-models](./concepts/multimodal-models) |

---

## 2. Prompt Engineering

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 9 | Zero-shot Prompting | ✅ | [Prompt Engineering for Agents](./concepts/prompt-engineering-for-agents) |
| 10 | Few-shot Prompting | ✅ | [Prompt Engineering for Agents](./concepts/prompt-engineering-for-agents) |
| 11 | Chain-of-Thought (CoT) | ✅ | [Planning Patterns](./concepts/planning-patterns) |
| 12 | System Prompt | ✅ | [Prompt Engineering for Agents](./concepts/prompt-engineering-for-agents) |
| 13 | Role Prompting | ✅ | [Prompt Engineering for Agents](./concepts/prompt-engineering-for-agents) |
| 14 | ReAct Prompting | ✅ | [ReAct Pattern](./concepts/react-pattern) |
| 15 | Prompt Injection | ✅ | [Safety & Guardrails](./concepts/safety-guardrails) |
| 16 | Structured Output Prompting | ✅ | [Structured Output & JSON Mode](./concepts/structured-output) |
| 17 | Meta-prompting | ❌ | **Gap** — see [meta-prompting](./concepts/meta-prompting) |

---

## 3. RAG & Knowledge Retrieval

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 18 | Retrieval-Augmented Generation (RAG) | ✅ | [RAG Deep Dive](./concepts/rag-deep-dive) |
| 19 | Vector Databases | ✅ | [Vector Database Concepts](../15-vector-databases/concepts/vector-db-concepts) |
| 20 | Semantic Search | ✅ | [Similarity Search](../15-vector-databases/concepts/similarity-search) |
| 21 | Chunking Strategies | ✅ | [RAG Deep Dive](./concepts/rag-deep-dive) |
| 22 | Hybrid Search | ✅ | [Hybrid Search](../15-vector-databases/concepts/hybrid-search) |
| 23 | Re-ranking | ✅ | [Re-ranking](../15-vector-databases/concepts/reranking) |
| 24 | Knowledge Graphs | ❌ | **Gap** — see [knowledge-graphs-graphrag](./concepts/knowledge-graphs-graphrag) |
| 25 | Document Loaders & Parsers | ❌ | **Gap** — see [document-loaders](./concepts/document-loaders) |

---

## 4. AI Agents & Agentic Systems

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 26 | AI Agent | ✅ | [What is an AI Agent?](./concepts/what-is-an-agent) |
| 27 | Tool Use / Function Calling | ✅ | [Tool Use & Function Calling](./concepts/tool-use-function-calling) |
| 28 | Tool Schema (JSON Schema) | ✅ | [Tool Use & Function Calling](./concepts/tool-use-function-calling) |
| 29 | Agentic Loop | ✅ | [ReAct Pattern](./concepts/react-pattern) |
| 30 | Planning & Task Decomposition | ✅ | [Planning Patterns](./concepts/planning-patterns) |
| 31 | Multi-Agent Systems | ✅ | [Multi-Agent Systems](./concepts/multi-agent-systems) |
| 32 | Orchestrator vs. Subagent | ✅ | [Orchestrator-Worker Pattern](./concepts/orchestrator-worker-pattern) |
| 33 | Human-in-the-Loop (HITL) | ✅ | [Human-in-the-Loop Workflows](./concepts/human-in-the-loop) |
| 34 | Agent Memory (short/long term) | ✅ | [Agent Memory Types](./concepts/agent-memory-types) |
| 35 | Reflection & Self-critique | ✅ | [Planning Patterns](./concepts/planning-patterns) |
| 36 | Agent Handoff | ✅ | [Agent Routing & Intent Classification](./concepts/agent-routing) |
| 37 | Interrupt & Resume | ✅ | [Long-Running Agents](./concepts/long-running-agents) |

---

## 5. Agent Communication & Protocols

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 38 | Model Context Protocol (MCP) | ✅ | [Model Context Protocol](./concepts/model-context-protocol) |
| 39 | Agent Communication Protocol (ACP) | ✅ | [Agent Client Protocol (ACP)](./concepts/agent-client-protocol) |
| 40 | Agent-to-Agent Protocol (A2A) | ✅ | [Agent-to-Agent Protocol (A2A)](./concepts/agent-to-agent-protocol) |
| 41 | OpenAI Agents SDK | 🔶 | [OpenAI Assistants API](./platforms/openai-assistants) |
| 42 | Anthropic Claude Agent SDK | 🔶 | Covered in MCP + harness design articles |
| 43 | Streaming (SSE / WebSocket) | ❌ | **Gap** — see [streaming-sse](./concepts/streaming-sse) |
| 44 | Structured Output / JSON Mode | ✅ | [Structured Output & JSON Mode](./concepts/structured-output) |
| 45 | Webhooks & Callbacks | ✅ | [Event-Triggered Agents](./concepts/event-triggered-agents) |

---

## 6. LLM APIs & SDKs

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 46 | REST API vs. SDK | ❌ | **Gap** — see [llm-api-guide](./concepts/llm-api-guide) |
| 47 | Messages API (Anthropic) | ❌ | **Gap** — see [llm-api-guide](./concepts/llm-api-guide) |
| 48 | Chat Completions API (OpenAI) | ❌ | **Gap** — see [llm-api-guide](./concepts/llm-api-guide) |
| 49 | Rate Limits & Throttling | ❌ | **Gap** — see [rate-limits-throttling](./concepts/rate-limits-throttling) |
| 50 | Batching & Async Requests | ❌ | **Gap** — see [batching-async](./concepts/batching-async) |
| 51 | Cost Estimation & Token Budgeting | ✅ | [Cost Control for Agents](./concepts/cost-control-agents) |
| 52 | Model Selection Trade-offs | ✅ | [Multi-Model Routing & Fallback](./concepts/multi-model-routing) |

---

## 7. Fine-tuning & Customization

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 53 | Fine-tuning | ❌ | **Gap** — see [fine-tuning-fundamentals](./concepts/fine-tuning-fundamentals) |
| 54 | LoRA / QLoRA | ❌ | **Gap** — see [lora-qlora](./concepts/lora-qlora) |
| 55 | RLHF | ❌ | **Gap** — see [rlhf-dpo](./concepts/rlhf-dpo) |
| 56 | DPO (Direct Preference Optimization) | ❌ | **Gap** — see [rlhf-dpo](./concepts/rlhf-dpo) |
| 57 | Instruction Tuning | ❌ | **Gap** — see [fine-tuning-fundamentals](./concepts/fine-tuning-fundamentals) |
| 58 | PEFT (Parameter-Efficient Fine-Tuning) | ❌ | **Gap** — see [lora-qlora](./concepts/lora-qlora) |
| 59 | Dataset Curation & Annotation | ❌ | **Gap** — see [dataset-curation](./concepts/dataset-curation) |

---

## 8. Evaluation & Observability

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 60 | Evals / LLM Evaluation | ✅ | [Agent Evaluation & Testing](./concepts/agent-evaluation-testing) |
| 61 | Hallucination Detection | ✅ | [Hallucination in Agent Decisions](./failures/hallucination-in-agents) |
| 62 | Groundedness / Faithfulness | ❌ | **Gap** — see [groundedness-faithfulness](./concepts/groundedness-faithfulness) |
| 63 | LLM-as-Judge | ✅ | [POC: LLM-as-Judge Alignment](./concepts/llm-judge-alignment-poc) |
| 64 | Tracing & Observability | ✅ | [Agent Observability](./concepts/agent-observability) |
| 65 | Prompt Versioning | ❌ | **Gap** — see [prompt-versioning-ab-testing](./concepts/prompt-versioning-ab-testing) |
| 66 | A/B Testing Prompts/Models | ❌ | **Gap** — see [prompt-versioning-ab-testing](./concepts/prompt-versioning-ab-testing) |
| 67 | Red-teaming | ❌ | **Gap** — see [red-teaming-llms](./concepts/red-teaming-llms) |

---

## 9. Safety, Alignment & Guardrails

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 68 | Constitutional AI (CAI) | 🔶 | Mentioned in [Safety & Guardrails](./concepts/safety-guardrails) |
| 69 | Guardrails | ✅ | [Safety & Guardrails](./concepts/safety-guardrails) |
| 70 | Content Moderation | ❌ | **Gap** — see [content-moderation](./concepts/content-moderation) |
| 71 | Jailbreaking | ❌ | **Gap** — see [red-teaming-llms](./concepts/red-teaming-llms) |
| 72 | Prompt Injection (security) | ✅ | [Safety & Guardrails](./concepts/safety-guardrails) |
| 73 | PII Handling | ✅ | [Safety & Guardrails](./concepts/safety-guardrails) |
| 74 | Responsible AI / AI Ethics | ❌ | **Gap** — see [responsible-ai](./concepts/responsible-ai) |
| 75 | AI Governance & Compliance | ❌ | **Gap** — see [responsible-ai](./concepts/responsible-ai) |

---

## 10. Infrastructure & Deployment

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 76 | LLM Hosting (Cloud vs. Self-hosted) | ❌ | **Gap** — see [llm-hosting](./concepts/llm-hosting) |
| 77 | Model Quantization | ❌ | **Gap** — see [model-quantization](./concepts/model-quantization) |
| 78 | GPU Inference (CUDA, ROCm) | ❌ | **Gap** — see [model-quantization](./concepts/model-quantization) |
| 79 | Serverless AI Inference | ❌ | **Gap** — see [llm-hosting](./concepts/llm-hosting) |
| 80 | LLM Caching (semantic cache) | ❌ | **Gap** — see [llm-caching](./concepts/llm-caching) |
| 81 | Prompt Compression | ❌ | **Gap** — see [llm-caching](./concepts/llm-caching) |
| 82 | Latency Optimization | 🔶 | Partial in [Multi-Model Routing](./concepts/multi-model-routing) |
| 83 | Edge AI | ❌ | **Gap** — see [edge-ai](./concepts/edge-ai) |

---

## 11. Frameworks & Tooling

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 84 | LangChain / LangGraph | ✅ | [LangGraph Stateful Agents](./concepts/langgraph-stateful-agents) + [LangChain](./platforms/langchain) |
| 85 | LlamaIndex | ❌ | **Gap** — see [llamaindex](./platforms/llamaindex) |
| 86 | Vercel AI SDK | ❌ | **Gap** — see [vercel-ai-sdk](./platforms/vercel-ai-sdk) |
| 87 | CrewAI | ✅ | [CrewAI](./platforms/crewai) |
| 88 | AutoGen (Microsoft) | ✅ | [AutoGen / AG2](./platforms/autogen) |
| 89 | DSPy | ❌ | **Gap** — see [dspy](./platforms/dspy) |
| 90 | Semantic Kernel | ❌ | **Gap** — see [semantic-kernel](./platforms/semantic-kernel) |
| 91 | Haystack | ❌ | **Gap** — not prioritized |
| 92 | Ollama | ❌ | **Gap** — see [llm-hosting](./concepts/llm-hosting) (covered in self-hosted section) |

---

## 12. Emerging Patterns

| # | Concept | Status | Article |
|---|---------|--------|---------|
| 93 | Mixture of Experts (MoE) | ❌ | **Gap** — see [mixture-of-experts](./concepts/mixture-of-experts) |
| 94 | Long Context Models | ❌ | **Gap** — see [long-context-models](./concepts/long-context-models) |
| 95 | Computer Use / UI Agents | ❌ | **Gap** — see [computer-use-agents](./concepts/computer-use-agents) |
| 96 | Code Agents / Coding Assistants | ✅ | [Code Sandbox Agents](./concepts/code-sandbox-agents) |
| 97 | Voice AI / Speech Agents | ❌ | **Gap** — see [voice-ai-pipeline](./concepts/voice-ai-pipeline) |
| 98 | Agentic Workflows (flows) | ✅ | [LangGraph Stateful Agents](./concepts/langgraph-stateful-agents) |
| 99 | AI Gateway / Proxy | ❌ | **Gap** — see [ai-gateway-proxy](./concepts/ai-gateway-proxy) |
| 100 | Vibe Coding | ❌ | **Gap** — see [vibe-coding](./concepts/vibe-coding) |

---

## Gap Summary (Updated 2026-03-27)

| Section | Total | ✅ Covered | 🔶 Partial | ❌ Gap |
|---------|-------|-----------|-----------|-------|
| 1. Foundation | 8 | 7 | 1 | 0 |
| 2. Prompt Engineering | 9 | 9 | 0 | 0 |
| 3. RAG & Retrieval | 8 | 8 | 0 | 0 |
| 4. AI Agents | 12 | 12 | 0 | 0 |
| 5. Protocols | 8 | 6 | 2 | 0 |
| 6. LLM APIs | 7 | 7 | 0 | 0 |
| 7. Fine-tuning | 7 | 7 | 0 | 0 |
| 8. Evaluation | 8 | 7 | 0 | 1 |
| 9. Safety | 8 | 7 | 1 | 0 |
| 10. Infrastructure | 8 | 8 | 0 | 0 |
| 11. Frameworks | 9 | 8 | 0 | 1 |
| 12. Emerging | 8 | 6 | 0 | 2 |
| **Total** | **100** | **92** | **4** | **4** |

> 92/100 topics now covered. Remaining gaps: Semantic Kernel (item 90), Haystack (item 91) in frameworks; Inference vs Training deep-dive (item 6); A/B Testing Evals standalone article.

---

## Articles to Create (Priority Order)

### Priority 1 — Core AI Developer Knowledge
1. `fine-tuning-fundamentals.md` — When/why to fine-tune vs. prompting (items 53, 57)
2. `lora-qlora.md` — LoRA, QLoRA, PEFT techniques (items 54, 58)
3. `rlhf-dpo.md` — RLHF and DPO alignment (items 55, 56)
4. `dataset-curation.md` — Training/eval dataset pipelines (item 59)
5. `llm-api-guide.md` — Messages API, Chat Completions, REST vs SDK (items 46, 47, 48)
6. `rate-limits-throttling.md` — Quotas, retry, exponential backoff (item 49)
7. `batching-async.md` — Batch API, async patterns (item 50)
8. `streaming-sse.md` — SSE streaming for real-time agent output (item 43)

### Priority 2 — Infrastructure & Deployment
9. `llm-hosting.md` — AWS Bedrock, vLLM, Ollama, serverless (items 76, 79, 92)
10. `model-quantization.md` — INT4/INT8, GPTQ, AWQ, GPU inference (items 77, 78)
11. `llm-caching.md` — Semantic cache, KV cache, prompt compression (items 80, 81)
12. `latency-optimization.md` — Speculative decoding, parallel calls (item 82)
13. `edge-ai.md` — On-device inference, privacy tradeoffs (item 83)

### Priority 3 — Safety & Evaluation Gaps
14. `groundedness-faithfulness.md` — RAG faithfulness scoring (item 62)
15. `prompt-versioning-ab-testing.md` — Prompt lifecycle, A/B experiments (items 65, 66)
16. `red-teaming-llms.md` — Adversarial testing, jailbreaking patterns (items 67, 71)
17. `content-moderation.md` — Input/output moderation pipelines (item 70)
18. `responsible-ai.md` — AI ethics, bias, governance, GDPR/EU AI Act (items 74, 75)

### Priority 4 — Emerging Patterns
19. `ai-gateway-proxy.md` — LLM proxy, centralized auth, routing (item 99)
20. `computer-use-agents.md` — Browser/desktop UI automation agents (item 95)
21. `voice-ai-pipeline.md` — STT → LLM → TTS pipelines (item 97)
22. `mixture-of-experts.md` — MoE architecture explained (item 93)
23. `long-context-models.md` — 128k–1M context, needle-in-haystack (item 94)
24. `knowledge-graphs-graphrag.md` — GraphRAG, entity graphs (item 24)
25. `multimodal-models.md` — GPT-4o, Gemini, image/audio/video (item 8)

### Priority 5 — Framework Additions (platforms/)
26. `llamaindex.md` — LlamaIndex for RAG (item 85)
27. `vercel-ai-sdk.md` — Vercel AI SDK streaming UI (item 86)
28. `dspy.md` — DSPy programmatic prompt optimization (item 89)
29. `meta-prompting.md` — Prompt that generates prompts (item 17)
30. `vibe-coding.md` — LLM-driven code generation workflows (item 100)
