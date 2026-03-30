---
title: "Design a Code Generation Agent — GitHub Copilot at 10M Developers"
layer: case-study
section: "16-system-design-problems/09-ai-agents"
difficulty: advanced
tags: [code-generation, copilot, llm, inference, speculative-decoding, kv-cache, streaming, lsp, context-window, latency]
category: ai-agents
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "GitHub Copilot: How it Works Under the Hood"
    url: "https://github.blog/2023-05-17-how-github-copilot-is-getting-better-at-understanding-your-code/"
    type: article
  - title: "Cursor: How We Built the AI-First Code Editor"
    url: "https://cursor.sh/blog"
    type: article
  - title: "Efficient LLM Inference with Speculative Decoding"
    url: "https://arxiv.org/abs/2211.17192"
    type: article
  - title: "Tree-sitter: Robust Parsing for Code Analysis"
    url: "https://tree-sitter.github.io/tree-sitter/"
    type: docs
  - title: "FIM (Fill-in-the-Middle) Training for Code Models"
    url: "https://arxiv.org/abs/2207.14255"
    type: article
  - title: "Copilot Internals: Context Selection and Prompt Construction"
    url: "https://thakkarparth007.github.io/copilot-explorer/posts/copilot-internals.html"
    type: article
---

# Design a Code Generation Agent — GitHub Copilot at 10M Developers

**Difficulty**: 🔴 Advanced → ⚫ Senior
**Reading Time**: 38 minutes
**Interview Frequency**: High — core AI system design interview topic at all FAANG companies

> **GitHub Copilot processes 1 billion suggestions per day. The engineering challenge isn't the model — it's delivering relevant code completions in < 200ms while 10 million developers type simultaneously, without ever leaking one developer's private code to another.**

---

## Table of Contents

| Section | What You'll Learn |
|---------|-------------------|
| [Mental Model](#mental-model) | The completion pipeline from keystroke to suggestion |
| [Why It's Hard](#why-its-hard) | Latency, context, privacy — the three-headed problem |
| [Requirements](#requirements) | Functional + non-functional with real numbers |
| [Capacity Estimation](#capacity-estimation) | Scale math for 10M DAU, 1B requests/day |
| [Deep Dive 1: Context Retrieval](#deep-dive-1-context-retrieval) | File-level vs project-level, tree-sitter AST |
| [Deep Dive 2: Inference Pipeline](#deep-dive-2-inference-pipeline) | KV cache reuse, speculative decoding, batching |
| [Deep Dive 3: Latency vs Quality Trade-off](#deep-dive-3-latency-vs-quality-trade-off) | FIM small model vs large context model |
| [Full System Architecture](#full-system-architecture) | IDE → inference cluster → streaming response |
| [Model Strategy Comparison](#model-strategy-comparison) | Single model vs Router vs Ensemble |
| [Problems at Scale](#problems-at-scale) | 3 production failure modes |
| [Interview Q&A Map](#interview-qa-map) | Exact phrases for AI system design interviews |
| [Key Takeaways](#key-takeaways) | 6 numbers to walk in with |

---

## Mental Model

### The Happy Path: Keystroke to Suggestion

```mermaid
sequenceDiagram
    actor Dev as Developer (VSCode)
    participant LSP as LSP Client (IDE Extension)
    participant Debounce as Debounce / Dedup Layer
    participant CtxCollector as Context Collector
    participant PrivacyFilter as Privacy Filter
    participant API as Copilot API Gateway
    participant Router as Model Router
    participant InferenceCluster as Inference Cluster
    participant Stream as Streaming Handler

    Dev->>LSP: Types "def calculate_tax("
    LSP->>Debounce: Trigger completion (300ms debounce)
    Note over Debounce: Wait 300ms for typing to pause
    Debounce->>CtxCollector: Build context payload
    CtxCollector->>CtxCollector: Collect current file (prefix+suffix)\nOpen files in editor\nRecently viewed files\nLanguage server symbols
    CtxCollector->>PrivacyFilter: Strip secrets (API keys, passwords, PII)
    PrivacyFilter->>API: POST /completions {context, language, cursor_pos}
    API->>Router: Select model based on context_length + language
    Router->>InferenceCluster: Batch with other requests (100ms window)
    InferenceCluster->>InferenceCluster: Check KV cache for prefix\nRun FIM inference
    InferenceCluster->>Stream: Stream first token (< 200ms TTFT)
    Stream-->>LSP: SSE stream: tokens appear as typed
    LSP-->>Dev: Ghost text suggestion appears
    Dev->>LSP: Press Tab (accept) or Esc (reject)
    LSP->>API: POST /feedback {accepted: true, suggestion_id}
```

**Key insight**: The developer never waits for the full completion — they see the first token in < 200ms via streaming. The perceived latency is TTFT (time to first token), not total generation time.

---

## Why It's Hard

### The Three-Headed Problem

```mermaid
graph TD
    P1["Problem 1: LATENCY\n< 200ms TTFT\nDeveloper types continuously\nSuggestion must appear before next keystroke"] --> S1["Solution: Small fast model\n+ KV cache + speculative decoding"]

    P2["Problem 2: CONTEXT QUALITY\n8k token window\nEntire repo won't fit\nWhich files are most relevant?"] --> S2["Solution: BM25 retrieval\n+ tree-sitter AST\n+ recency scoring"]

    P3["Problem 3: PRIVACY\nDeveloper A's private code\nmust never appear in\nDeveloper B's suggestions"] --> S3["Solution: Tenant isolation\nno cross-tenant caching\nPII detection before API call"]
```

**Why 200ms is the hard constraint**: Human typing speed is ~200ms between keystrokes for a fast developer. If the suggestion appears after the developer has already typed further, it becomes useless or actively disruptive. Studies show suggestion acceptance rate drops from 28% at 100ms to 8% at 500ms TTFT.

---

## Requirements

### Functional Requirements

| Feature | Description |
|---------|-------------|
| Inline code completion | Ghost text suggestion at cursor position |
| Multi-line completion | Complete entire functions, loops, or classes |
| Chat interface | Explain code, suggest refactors, write tests |
| Multiple languages | Python, JavaScript, TypeScript, Go, Rust, Java, C++ (50+ total) |
| IDE integration | VSCode, JetBrains, Neovim, Vim, Emacs |
| Context awareness | Understands repo structure, imports, function signatures |
| Acceptance tracking | Record accept/reject to improve future suggestions |

### Non-Functional Requirements (with numbers)

| Metric | Target | Why This Number |
|--------|--------|-----------------|
| TTFT (time to first token) | < 200ms P50 | Suggestions must appear before next keystroke |
| TTFT P99 | < 500ms | Acceptable for 99th percentile under load |
| Total completion time | < 2s for 50-token suggestion | Background generation after first token |
| Throughput | 11,600 RPS peak | 10M DAU × 100 completions/day / 86,400s = 11,574 RPS |
| Availability | 99.9% | Degraded mode: show no suggestion, not crash IDE |
| Privacy | No cross-tenant code leakage | Enterprise requirement — audited |
| Suggestion acceptance rate | > 25% | GitHub reports 30% acceptance; below 20% means bad context |
| Token efficiency | < 8K tokens per request | Context window budget for fast models |

### Explicit Non-Requirements

- Not a full IDE (no execution, debugging)
- Not a long-horizon autonomous agent (this is real-time inline completion)
- Not responsible for code correctness — developer must review

---

## Capacity Estimation

### Traffic Analysis

```
Daily Active Users: 10M developers
Average completions triggered/developer/day: 100
  (one every ~5 minutes during an 8-hour coding session)
Average completion accepted/developer/day: 30 (30% acceptance rate)

Total completion requests/day: 10M × 100 = 1B requests/day
Requests/second (average): 1B / 86,400 = 11,574 RPS
Peak RPS (2× average): ~23,000 RPS
  (9-11 AM across US/EU time zones)

Chat requests/day: 10M × 5 = 50M (less frequent than inline)
Chat RPS: 50M / 86,400 = 578 RPS
```

### Token Budget and Model Cost

```
Inline completion (fast model — GPT-4o mini or Code Llama 7B):
  Input context: 2,000 tokens (prefix + suffix + open files)
  Output: 50 tokens (short completion)
  Latency: 150ms TTFT (KV cached prefix)

Chat (large model — GPT-4o or Code Llama 70B):
  Input context: 8,000 tokens
  Output: 500 tokens
  Latency: 2,000ms TTFT acceptable

Cost at 11,574 RPS (inline completions):
  At $0.00015/1K input tokens, $0.0006/1K output:
  Per request: (2000 × $0.00015 + 50 × $0.0006) / 1000 = $0.00033
  Per day: 1B × $0.00033 = $330,000/day

GitHub Copilot Individual: $10/month = $120M ARR at 10M users
Infrastructure cost ~35% margin = $42M/year = $115K/day
→ At $330K/day for cloud inference, the economics only work with self-hosted models
```

### Inference Cluster Sizing

```
Target: 23,000 RPS peak (2× average) with < 200ms TTFT

A100 80GB GPU throughput (vLLM, continuous batching):
  Code Llama 7B (FP16): ~3,000 tokens/sec/GPU
  At 50 tokens output: 60 completions/sec/GPU
  At 23,000 RPS: 23,000 / 60 = 384 A100 GPUs

With speculative decoding (3× throughput improvement):
  Effective: 180 completions/sec/GPU
  GPUs needed: 23,000 / 180 = 128 A100 GPUs

At $3/hr/A100 on GCP: 128 × $3 × 24 = $9,216/day
Much more feasible than $330K/day for OpenAI API calls
```

---

## Deep Dive 1: Context Retrieval

**The core problem**: The developer's repo might have 100,000 lines of code across 500 files. The model's context window is 8,192 tokens (~6,000 words). We must select the **most relevant 2,000 tokens** to fit alongside the current file.

### Context Sources (Ranked by Relevance)

```
Priority 1 (always included):
  - Current file: prefix (code before cursor) + suffix (code after cursor)
  - Current function's docstring and signature
  - Immediate imports at top of current file

Priority 2 (BM25 retrieval from repo):
  - Recently edited files (recency bias)
  - Files imported by current file
  - Files with similar function names (BM25 on symbols)

Priority 3 (AST-based):
  - Function signatures called in current file but defined elsewhere
  - Class definitions that current file's class inherits from
```

### Tree-Sitter AST for Precise Context

Instead of sending entire files, use tree-sitter to extract only the relevant symbols.

```mermaid
flowchart TD
    CF["Current File\ncalculate_tax.py\n(200 lines)"] --> TSP["Tree-Sitter Parser"]
    TSP --> AST["AST Extraction"]
    AST --> IMP["Imports:\n  from models import TaxRate\n  from utils import round_currency"]
    AST --> SIG["Function Signatures\nCalled but not defined here:\n  TaxRate.get(year)\n  round_currency(amount, decimals)"]
    AST --> CUR["Current Function Context:\n  def calculate_tax(income, year):\n    rate = TaxRate.get(year)  ← cursor here"]

    IMP --> Lookup["Symbol Lookup\nin repo index"]
    SIG --> Lookup
    Lookup --> TaxRateFile["models.py (relevant snippet):\n  class TaxRate:\n    def get(year: int) -> float: ..."]
    Lookup --> UtilFile["utils.py (relevant snippet):\n  def round_currency(amount: float,\n    decimals: int = 2) -> float: ..."]

    CUR --> CtxBudget["Context Budget:\n  2,000 tokens total\n  Current file: 800 tokens\n  TaxRate sig: 120 tokens\n  round_currency sig: 80 tokens\n  Remaining: 1,000 tokens\n  → BM25 related files"]
```

**Pseudocode for context assembly**:

```python
def build_context(current_file: str, cursor_line: int, repo_index: RepoIndex) -> str:
    TOKEN_BUDGET = 2000
    used_tokens = 0
    context_parts = []

    # 1. Always include: current file prefix and suffix (FIM format)
    prefix, suffix = split_at_cursor(current_file, cursor_line)
    prefix_tokens = count_tokens(prefix[-1000:])  # last 1000 tokens before cursor
    suffix_tokens = count_tokens(suffix[:500])    # first 500 tokens after cursor
    context_parts.append(f"<fim_prefix>{prefix[-1000:]}<fim_suffix>{suffix[:500]}<fim_middle>")
    used_tokens += prefix_tokens + suffix_tokens

    # 2. AST: extract imported symbols referenced near cursor
    ast = tree_sitter_parse(current_file)
    symbols_near_cursor = ast.get_called_symbols(cursor_line, window=10)

    for symbol in symbols_near_cursor:
        definition = repo_index.lookup_symbol(symbol)
        if definition and used_tokens + count_tokens(definition) < TOKEN_BUDGET:
            context_parts.insert(0, definition)  # prepend as context
            used_tokens += count_tokens(definition)

    # 3. BM25: find related files based on current function content
    query = extract_function_tokens(current_file, cursor_line)
    related_files = repo_index.bm25_search(query, top_k=5)
    for snippet in related_files:
        if used_tokens + count_tokens(snippet) < TOKEN_BUDGET:
            context_parts.insert(0, snippet)
            used_tokens += count_tokens(snippet)

    return "\n".join(context_parts)
```

### Debouncing: Don't Trigger on Every Keystroke

Without debouncing, every keystroke fires a completion request. At 200ms per keystroke for a fast developer, that's 5 requests/sec per developer — 50M QPS for 10M developers.

```
Debounce strategy:
  - Trigger completion after 300ms of no typing activity
  - Cancel in-flight request if user types before suggestion returns
  - Minimum inter-request gap: 500ms per developer (IDE-side rate limit)

Reduction factor: ~100 keystrokes per developer → ~3 actual API calls/min
```

---

## Deep Dive 2: Inference Pipeline

**The bottleneck**: At 23,000 RPS with 200ms TTFT, the inference cluster must be extremely efficient. Three techniques compound to achieve this.

### Technique 1: Prefix Caching (KV Cache Reuse)

Every completion request includes a common prefix: the system prompt + language-specific few-shot examples. On every GPU, this prefix is pre-computed and cached in GPU SRAM.

```mermaid
flowchart LR
    subgraph "Without Prefix Cache"
        R1["Request:\nSystem prompt (500 tok)\n+ context (1500 tok)\n+ completion (50 tok)"] --> I1["Full forward pass\nthrough 2050 tokens\nLatency: 450ms"]
    end

    subgraph "With Prefix Cache (KV Cache)"
        Cache["GPU SRAM Cache\nSystem prompt KV state\n(500 tokens, always the same)"]
        R2["Request:\nContext (1500 tok)\n+ completion (50 tok)"] --> CacheCheck["Cache hit:\nskip system prompt\nforward pass"]
        Cache --> CacheCheck
        CacheCheck --> I2["Forward pass\nthrough 1550 tokens only\nLatency: 280ms (-38%)"]
    end
```

**How KV cache works in attention**:

```
Transformer attention: Attention(Q, K, V)
For a token at position t, keys K and values V from all previous positions
are recomputed from scratch in naive inference.

KV cache: store K and V for every previous token.
For a new token, only compute K, V for that token — reuse the rest.

Memory cost: 2 × num_layers × num_heads × head_dim × seq_len × batch_size × 2 bytes
For Code Llama 7B: 2 × 32 × 32 × 128 × 2000 × 64 × 2 = 32GB per batch of 64
```

### Technique 2: Speculative Decoding

Use a small "draft" model (Code Llama 1B) to rapidly generate 4-8 tokens, then verify all of them with the large model in a single forward pass.

```
Standard decoding: generate 1 token per forward pass
  50-token completion = 50 forward passes = 50 × 10ms = 500ms

Speculative decoding:
  Draft model: generate 5 tokens at once (fast, small model) = 2ms
  Verify model: 1 forward pass validates all 5 draft tokens = 10ms
  If 3/5 accepted, we got 3 tokens in 12ms vs 30ms for 3 standard
  Net speedup: 2.5-3×

When does draft model "match"? ~75% of the time in code (syntactic patterns are predictable)
When doesn't it match? Novel API calls, creative variable naming → falls back to standard
```

```mermaid
sequenceDiagram
    participant Draft as Draft Model\n(Code Llama 1B)
    participant Verify as Verify Model\n(Code Llama 7B)

    Note over Draft,Verify: Input: "def calculate_tax(income:"
    Draft->>Draft: Generate 5 tokens fast: " year, rate=0.2)"
    Draft->>Verify: Send draft tokens for verification
    Verify->>Verify: 1 forward pass, check all 5 tokens
    Verify-->>Draft: Tokens 1-4 accepted ✅, token 5 rejected ❌
    Note over Draft,Verify: Accept " year, rate=0." (4 tokens in 12ms)
    Draft->>Draft: Regenerate from token 5
```

### Technique 3: Continuous Batching

Instead of waiting for a fixed batch to fill, process requests as they arrive and add new requests to the inference pipeline mid-generation.

```
Static batching (naive):
  Wait for 64 requests → run inference → return all 64 results
  Problem: Some requests finish early, GPU sits idle waiting for slow ones
  GPU utilization: 40-60%

Continuous batching (vLLM):
  As soon as a slot opens (one sequence finishes), add a waiting request
  GPU utilization: 80-95%

At 23,000 RPS with A100 (3,000 tok/sec):
  Without continuous batching: 128 GPUs (40% util) → ~200 GPUs needed
  With continuous batching: 128 GPUs (85% util) → 128 GPUs sufficient
```

### Streaming with SSE

Tokens are streamed as generated — TTFT measures when the first token arrives, not when the full completion is ready.

```python
# Server-Sent Events stream
async def stream_completion(prompt: str, max_tokens=50):
    async for token in inference_engine.generate(prompt, stream=True):
        yield f"data: {json.dumps({'token': token, 'finish_reason': None})}\n\n"
    yield f"data: {json.dumps({'token': '', 'finish_reason': 'stop'})}\n\n"
    yield "data: [DONE]\n\n"

# IDE extension: display ghost text as tokens arrive
# User sees partial suggestion building in real-time
```

---

## Deep Dive 3: Latency vs Quality Trade-off

**The core trade-off**: Larger models produce better code but are slower. Smaller models are fast but produce more errors.

### Fill-in-the-Middle (FIM) Training

Standard LLMs predict the next token (left-to-right). Code completions need **fill-in-the-middle**: given code before and after the cursor, predict what goes in the gap.

```
Standard next-token prediction:
  Input:  "def calculate_tax(income"
  Output: ", year):"   ← left-to-right only

FIM (Fill-in-the-Middle):
  Input format: <fim_prefix>code_before<fim_suffix>code_after<fim_middle>
  Input:  <fim_prefix>def calculate_tax(<fim_suffix>\n    return income * rate<fim_middle>
  Output: income, year, rate=0.2):   ← fills the gap knowing what comes after
```

FIM-trained models have 15-20% higher acceptance rate than standard models for inline completions (as measured in the Code Llama paper).

### Model Selection Routing

```mermaid
flowchart TD
    Request["Completion Request\n{language, context_length, task_type}"] --> Router["Model Router"]

    Router -->|"context < 2000 tok\n+ simple pattern\n(single line)"|  FastModel["Code Llama 7B FIM\nTTFT: 100-150ms\nCost: $0.0001/req"]
    Router -->|"context 2000-8000 tok\n+ multi-line completion"| MedModel["Code Llama 34B\nor GPT-4o mini\nTTFT: 200-400ms\nCost: $0.0003/req"]
    Router -->|"Chat mode\nor explain/refactor"| LargeModel["GPT-4o\nor Claude Sonnet\nTTFT: 800ms-2s\nCost: $0.002/req"]

    FastModel -->|"90% of traffic"| Response
    MedModel -->|"9% of traffic"| Response
    LargeModel -->|"1% of traffic\n(chat only)"| Response
```

**Latency budget breakdown for the 90th percentile inline completion**:

| Stage | P50 | P99 | Notes |
|-------|-----|-----|-------|
| IDE debounce | 300ms | 300ms | Fixed, developer-side |
| Network (IDE → API) | 20ms | 80ms | CDN edge PoP |
| Queue wait | 5ms | 50ms | Continuous batching queue |
| KV cache check | 1ms | 5ms | GPU SRAM lookup |
| Prefix processing | 0ms | 20ms | Cache hit = 0ms |
| TTFT (first token generated) | 80ms | 200ms | Speculative decoding active |
| Token streaming (50 tokens) | 300ms | 800ms | 6ms/token at 7B model |
| **Total perceived latency** | **100ms** | **280ms** | **From debounce end to first visible token** |

---

## Full System Architecture

```mermaid
graph TB
    subgraph IDE["IDE Layer (Client)"]
        VSCode["VSCode Extension\n(Copilot Extension)"]
        JB["JetBrains Plugin"]
        NVim["Neovim Plugin"]
    end

    subgraph EdgeLayer["Edge (CDN + API GW)"]
        CF["Cloudflare / Fastly\n(PoP in 200+ cities)"]
        APIGW["API Gateway\n(Auth + Rate Limit)"]
        AuthSvc["Auth Service\n(JWT + Enterprise SSO)"]
    end

    subgraph PrivacyLayer["Privacy & Safety"]
        PII["PII Detector\n(Presidio / custom regex)\nStrip secrets, tokens, PII"]
        TenantIsolation["Tenant Isolation\n(Enterprise = dedicated namespace)"]
    end

    subgraph ContextLayer["Context Pipeline"]
        DebounceQ["Debounce + Request Queue\n(Redis, 300ms window)"]
        CtxBuilder["Context Builder\n(prefix/suffix/FIM format)"]
        RepoIndex["Repo Index Service\nBM25 + symbol index\nper-developer, per-repo"]
        ASTService["Tree-Sitter AST Service\nSymbol extraction"]
    end

    subgraph InferenceLayer["Inference Cluster"]
        Router["Model Router\n(route by context size + task)"]
        InfFast["Fast Inference Pool\nCode Llama 7B FIM\n64× A100 GPUs\nvLLM continuous batching"]
        InfMed["Medium Inference Pool\nCode Llama 34B\n32× A100 GPUs"]
        InfChat["Chat Pool\nGPT-4o / Claude\n(API passthrough)"]
        PrefixCache["Prefix KV Cache\n(GPU SRAM, shared system prompts)"]
        SpecDecoder["Speculative Decoder\nDraft: Code Llama 1B\nVerify: Code Llama 7B"]
    end

    subgraph FeedbackLayer["Learning Loop"]
        AcceptanceTracker["Acceptance Tracker\n(accept/reject events)"]
        MetricsDB["Metrics Store\n(ClickHouse)\nsuggestion_id → accepted?"]
        RerankerTrainer["Reranker Fine-Tuner\n(weekly, on accepted completions)"]
    end

    VSCode & JB & NVim -->|"SSE / HTTPS"| CF
    CF --> APIGW
    APIGW --> AuthSvc
    AuthSvc --> PII
    PII --> TenantIsolation
    TenantIsolation --> DebounceQ
    DebounceQ --> CtxBuilder
    CtxBuilder --> RepoIndex & ASTService
    RepoIndex & ASTService --> CtxBuilder
    CtxBuilder --> Router
    Router --> InfFast & InfMed & InfChat
    InfFast --> PrefixCache & SpecDecoder
    InfFast & InfMed & InfChat -->|"SSE token stream"| CF

    APIGW --> AcceptanceTracker
    AcceptanceTracker --> MetricsDB
    MetricsDB --> RerankerTrainer
```

---

## Model Strategy Comparison

| | Single Large Model | Router (Small + Fallback) | Ensemble |
|---|---|---|---|
| **TTFT P50** | 400ms | **100ms** (fast path) | 600ms |
| **TTFT P99** | 1,200ms | **280ms** | 1,800ms |
| **Acceptance rate** | 35% | 30% (fast model slightly worse) | **38%** |
| **Cost per 1B requests/day** | $500K | **$115K** | $800K |
| **Complexity** | Low | Medium | High |
| **GPU utilization** | 60% | **85%** (continuous batching on small) | 50% |
| **Best for** | High-quality chat | **Production inline completion** | Research / A/B testing |

**Recommendation**: Router architecture. Route 90% of traffic to the fast small model (Code Llama 7B FIM), escalate to medium/large only for chat and complex multi-file completions.

---

## Problems at Scale

### Failure Mode 1: P99 Latency Spikes to 2s During Peak Hours

**Scenario**: At 9 AM Pacific time, US developers start their day. RPS jumps from 5,000 to 23,000 in 15 minutes. The inference cluster is saturated. Continuous batching queue builds up. P99 TTFT jumps from 280ms to 2,100ms. Developers stop seeing inline suggestions in real time and start ignoring the tool.

**Root cause**: No autoscaling headroom. GPU provisioning takes 5-8 minutes (AWS warm-up time). Traffic spike is faster than autoscaling.

**Fix**:
1. **Pre-warm instances**: Maintain 20% idle capacity during predicted peak hours (US 9 AM, EU 9 AM, etc.) — cost vs latency SLA trade-off
2. **Graceful degradation**: If queue depth exceeds 500ms estimated wait, return a "no suggestion" response immediately rather than making the developer wait
3. **Adaptive debounce**: Under load, increase debounce from 300ms to 600ms — slightly worse UX but 50% fewer requests
4. **Priority queue**: Developers with active typing sessions (high interactivity) get priority over background indexing operations

---

### Failure Mode 2: Model Suggests Code with Security Vulnerabilities

**Scenario**: A developer is writing a SQL query. The model suggests: `query = f"SELECT * FROM users WHERE username='{username}'"`. This is a SQL injection vulnerability. The developer accepts the suggestion and ships to production.

**What happens**: The suggestion came from training data that included vulnerable code (common in GitHub public repos). The model learned the pattern without learning that it's insecure.

**Root cause**: Language models optimize for statistical likelihood, not security. The training corpus contains millions of vulnerable code examples.

**Fix**:
1. **Static analysis filter**: Run Semgrep or Bandit on every suggestion before returning to IDE. Block suggestions that match known vulnerability patterns (injection, hardcoded credentials, weak crypto)
2. **Security-aware prompt**: Add to system prompt: "Never suggest SQL queries with string interpolation. Always use parameterized queries."
3. **Secret detection**: Before returning a suggestion, scan for patterns: API keys (`sk-...`, `AKIA...`), passwords (`password="hardcoded"`), private keys (`-----BEGIN RSA PRIVATE KEY-----`)
4. **Feedback loop**: When a suggestion is rejected with category "security", weight that negatively in the fine-tuning loop

```python
BLOCKED_PATTERNS = [
    r'password\s*=\s*["\'][^"\']+["\']',        # hardcoded passwords
    r'sk-[a-zA-Z0-9]{48}',                       # OpenAI API keys
    r'AKIA[0-9A-Z]{16}',                          # AWS access keys
    r'f["\']SELECT.*WHERE.*{',                    # SQL injection via f-strings
    r'eval\s*\(.*input',                          # code injection
    r'subprocess.*shell=True.*input',             # command injection
]

def is_safe_suggestion(suggestion: str) -> tuple[bool, str | None]:
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, suggestion, re.IGNORECASE):
            return False, f"Security: matched pattern {pattern}"
    return True, None
```

---

### Failure Mode 3: Context Window Overflow Causes Irrelevant Suggestions

**Scenario**: A developer opens a 1,500-line file and a repo with 500 files. The context builder greedily includes "related" files, filling 7,900 of the 8,192-token context window with code from unrelated parts of the repo. The 300 tokens remaining for the current file cursor context are insufficient. The model suggests code that doesn't match the current function's local variables.

**What happens**: Acceptance rate drops from 30% to 8%. Developers disable the extension ("it suggests garbage").

**Root cause**: Context ranking is wrong — proximity to cursor position is more important than BM25 text similarity across the repo.

**Fix**:
1. **Strict token budget hierarchy**:
   - Current file prefix (last 1,000 tokens before cursor): 50% of budget = 1,000 tokens (non-negotiable)
   - Current file suffix (500 tokens after cursor): 25% = 500 tokens
   - Symbol definitions (AST-extracted): 15% = 300 tokens
   - BM25 related files: 10% = 200 tokens (trim to fit)
2. **Cursor proximity scoring**: Weight context by distance to cursor line. A function defined 10 lines away gets 10× more weight than one 500 lines away
3. **Context quality check**: Before sending to inference, verify the final context includes the function name at the cursor line — if not, the context assembly went wrong

---

## Interview Q&A Map

### "How do you reduce latency from 500ms to < 200ms?"

> "Three compounding techniques. First, speculative decoding: a small draft model (Code Llama 1B) generates 5 draft tokens in 2ms, and the large model verifies all 5 in one forward pass (10ms). When 3-4 are correct, we've processed them in 12ms vs 30ms for sequential generation — roughly 2.5× speedup. Second, prefix KV cache: every request shares the same system prompt (500 tokens). By pre-computing and caching the KV state for this prefix in GPU SRAM, we skip ~25% of the forward pass computation on every request. Third, continuous batching (vLLM): keep GPU utilization at 85%+ so there's no waiting for batch fills. Combined, these take a 500ms TTFT down to ~150ms P50."

### "How do you prevent the model from suggesting API keys or passwords?"

> "Two layers. Pre-send: before the IDE extension sends context to the API, we run a regex scan over the context for common secret patterns — API key formats (AWS AKIA..., OpenAI sk-..., etc.), JWT tokens, private key headers. Any match is redacted with a placeholder. Post-generation: before returning a suggestion to the developer, we run the same scan on the generated code. Suggestions matching secret patterns are blocked and replaced with a placeholder with a comment like '# TODO: load from environment variable'. We also add to the system prompt: 'never include hardcoded credentials, API keys, or passwords in suggestions.' For enterprise customers, we run additional custom regex patterns for their specific secret formats."

### "How do you measure whether suggestions are actually helpful?"

> "The primary metric is acceptance rate: what percentage of shown suggestions does the developer press Tab on. GitHub Copilot reports ~30% acceptance. But acceptance rate alone is misleading — a developer might accept a mediocre suggestion because they're lazy, or reject a great one because they wanted something slightly different. Better metrics: persistence rate (does the accepted suggestion still exist in the code 2 minutes later, or was it immediately deleted?), edit distance (how much does the developer change the accepted suggestion?), and time-to-next-keystroke (does the developer immediately start modifying, suggesting the suggestion was wrong?). Ultimately, the gold standard is DORA metrics: do developers who use Copilot merge more PRs/week? GitHub's internal data shows a 55% speed increase in PR merge rate for heavy Copilot users."

### "How do you handle enterprise customers who can't send code to a cloud API?"

> "On-premises deployment. We ship the model weights and inference server (vLLM) as a Docker image or Kubernetes Helm chart. The customer runs it on their own GPU infrastructure (typically a few H100 nodes). The IDE extension is configured with a self-hosted endpoint URL. No code ever leaves their network. Trade-offs: they get a slightly older/smaller model (we can't continuously update on-prem), and their infra team owns availability. For very large enterprises (10,000+ developers), we offer a VPC-peered private deployment where we manage the infrastructure in their cloud account — they keep the keys, we handle operations."

---

## Key Takeaways

| Number | What It Means |
|--------|--------------|
| **11,600 RPS** | 10M DAU × 100 completions/day / 86,400s — size your inference cluster for 2× this |
| **< 200ms TTFT** | The hard latency constraint — acceptance rate drops from 28% to 8% at 500ms |
| **2.5× speedup** | Speculative decoding with a 1B draft model + 7B verifier model |
| **30% acceptance rate** | The industry benchmark (GitHub Copilot); below 20% means bad context selection |
| **8K token window** | Budget: 50% current file, 25% suffix, 15% symbols, 10% BM25 related files |
| **3 security checks** | Pre-send context scan + post-generation scan + system prompt instruction |

**The architecture insight**: Code generation is NOT a standard LLM problem. It's a **real-time streaming inference problem** where the constraint is TTFT < 200ms, context is structured (AST, not prose), and privacy is a hard requirement (no cross-tenant code leakage). Every design decision traces back to these three constraints.

---

## References

- 📖 [GitHub Copilot: How it Works Under the Hood](https://github.blog/2023-05-17-how-github-copilot-is-getting-better-at-understanding-your-code/)
- 📖 [Copilot Internals: Context Selection and Prompt Construction](https://thakkarparth007.github.io/copilot-explorer/posts/copilot-internals.html)
- 📖 [FIM (Fill-in-the-Middle) Training for Code Models](https://arxiv.org/abs/2207.14255)
- 📖 [Efficient LLM Inference with Speculative Decoding](https://arxiv.org/abs/2211.17192)
- 📚 [Tree-sitter: Robust Parsing for Code Analysis](https://tree-sitter.github.io/tree-sitter/)
- 📖 [vLLM: Efficient Memory Management for LLM Serving](https://arxiv.org/abs/2309.06180)
