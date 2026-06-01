---
title: "Prompt Engineering Patterns"
layer: concept
section: "13-agent-workflows/concepts"
difficulty: intermediate
tags: [prompt-engineering, few-shot, chain-of-thought, structured-output, ai-agents, llm, reliability]
category: architecture
prerequisites:
  - agent-workflows/concepts/what-is-an-agent
  - agent-workflows/concepts/llm-fundamentals-for-agents
see_poc: []
related_problems: []
case_studies: []
linked_from: []
references:
  - title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models"
    url: "https://arxiv.org/abs/2201.11903"
    type: article
  - title: "Anthropic Prompt Engineering Guide"
    url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview"
    type: docs
  - title: "OpenAI Prompt Engineering Best Practices"
    url: "https://platform.openai.com/docs/guides/prompt-engineering"
    type: docs
  - title: "LangChain Prompt Templates and Few-Shot Examples"
    url: "https://python.langchain.com/docs/concepts/prompt_templates/"
    type: docs
  - title: "Structured Outputs — OpenAI"
    url: "https://platform.openai.com/docs/guides/structured-outputs"
    type: docs
  - title: "DSPY: Programming, not Prompting, Foundation Models (Stanford)"
    url: "https://arxiv.org/abs/2310.03714"
    type: article
---

# Prompt Engineering Patterns

**Level**: 🟡 Intermediate
**Reading Time**: 16 minutes

> Chatbot prompts shape tone. Agent prompts shape behavior across 50 automated steps. The patterns you embed in the prompt determine whether the agent is reliable or a liability.

---

## Level 1 — Surface (2-minute read)

### What It Is

**Prompt engineering patterns** are reusable structural templates and techniques for writing LLM prompts that produce predictable, high-quality outputs. Rather than writing prompts from scratch each time, you apply proven patterns — few-shot, chain-of-thought, role prompting, structured output — each suited to a class of problems.

### When You Need This

- Agent is calling wrong tools or producing malformed outputs (> 5% error rate)
- Task requires multi-step reasoning or planning before acting
- Output must conform to a schema (JSON, XML, specific format)
- You want to reduce cost by shrinking prompt size without losing quality
- Team is iterating on prompts ad-hoc with no shared vocabulary

### Core Concepts (3-5 bullets)

- **Zero-shot** — Ask the model to do a task with no examples; works for simple well-known tasks, breaks on novel or complex ones
- **Few-shot** — Provide 2–8 worked examples; increases reliability on structured tasks by 20–40% without fine-tuning
- **Chain-of-Thought (CoT)** — Ask the model to reason step-by-step before answering; dramatically improves accuracy on math, logic, and multi-hop reasoning
- **Role Prompting** — Assign the model a persona/expertise level ("You are a senior SRE"); shifts vocabulary, caution level, and output detail
- **Structured Output** — Constrain the response format with schemas or explicit format instructions; required for any automated downstream parsing

### Level 1 Diagram

```mermaid
flowchart TD
    TASK[Incoming Task] --> SELECT{Pattern Selector}
    SELECT -->|Simple, well-known| ZERO[Zero-Shot\n"Translate this text"]
    SELECT -->|Structured output needed| FEW[Few-Shot\n"Here are 3 examples"]
    SELECT -->|Complex reasoning| COT[Chain-of-Thought\n"Think step by step"]
    SELECT -->|Creative or expert tone| ROLE[Role Prompting\n"You are a ..."]
    SELECT -->|Machine-parseable output| STRUCT[Structured Output\nJSON/XML schema]
    ZERO & FEW & COT & ROLE & STRUCT --> OUTPUT[Reliable LLM Output]
```

### Use This When / Don't Use This When

| Use This When | Don't Use This When |
|--------------|-------------------|
| Building agent tool dispatch logic | Prototype / exploratory chat where tone is enough |
| Parsing structured data from unstructured text | Task is so simple that any prompt works |
| Reducing hallucination on factual tasks | You have labeled data — fine-tune instead |
| Coordinating multi-agent handoffs | Output doesn't need to be machine-parseable |
| Onboarding LLM to domain-specific vocabulary | Latency budget is critical and examples inflate tokens |

---

## Level 2 — Deep Dive

### Problem Statement

A mid-stage AI team at a fintech startup has an agent that processes support tickets: categorizes them, extracts structured fields, routes to the correct queue, and drafts a first response. Initially it worked fine on demos. In production with 3,000 tickets/day:

- 12% of tickets are miscategorized, causing SLA breaches
- 8% of JSON extractions fail to parse, crashing the downstream pipeline
- The draft response tone varies wildly — sometimes curt, sometimes overly apologetic
- No one on the team can explain *why* specific prompts work; there's no shared vocabulary

**The fix is not more model capability. The fix is prompt engineering patterns applied systematically.**

---

### Pattern A: Zero-Shot Prompting

**What it is**: Give the model a task description and nothing else. No examples, no reasoning instructions.

**When it works**: Well-defined tasks that exist in the model's training data — translation, summarization, simple classification, grammar correction.

**When it breaks**: Novel schemas, domain-specific jargon, tasks requiring consistent output format, low-resource languages.

```python
# Zero-shot — works for common tasks
def classify_sentiment_zero_shot(text: str) -> str:
    prompt = f"""Classify the sentiment of the following customer message.
    Respond with exactly one word: positive, negative, or neutral.

    Message: {text}
    Sentiment:"""

    return llm.complete(prompt).strip().lower()

# Zero-shot breaks here — novel domain, specific schema
def extract_support_fields_zero_shot(ticket: str) -> dict:
    prompt = f"""Extract the following fields from this support ticket:
    issue_type, severity, affected_product, customer_tier.

    Ticket: {ticket}"""

    # Problem: model may output YAML, prose, or a different field order.
    # Downstream JSON parser will crash 8-15% of the time.
    return json.loads(llm.complete(prompt))  # fragile
```

**Production numbers**: Zero-shot extraction error rates: 8–15% on novel schemas. Fine-tuned models drop this to < 1%, but fine-tuning is expensive. Few-shot is the middle path.

---

### Pattern B: Few-Shot Prompting

**What it is**: Prepend 2–8 worked input/output pairs (shots) to your prompt. The model learns the output format and reasoning style from examples rather than instructions alone.

**Selection rule**: 3–5 shots hits the sweet spot for most tasks. More than 8 shots rarely improves quality and increases token cost proportionally.

```python
FEW_SHOT_EXTRACTION_PROMPT = """
You extract structured fields from customer support tickets.
Always respond with valid JSON only — no prose, no explanation.

--- Example 1 ---
Ticket: "My API key stopped working after the billing cycle reset. We're on the Enterprise plan."
Output: {
  "issue_type": "authentication",
  "severity": "high",
  "affected_product": "API",
  "customer_tier": "enterprise"
}

--- Example 2 ---
Ticket: "The dashboard is loading slowly, takes about 10 seconds per page. Not urgent."
Output: {
  "issue_type": "performance",
  "severity": "low",
  "affected_product": "dashboard",
  "customer_tier": "unknown"
}

--- Example 3 ---
Ticket: "We can't export reports to CSV on the Pro plan — error 500."
Output: {
  "issue_type": "feature_bug",
  "severity": "medium",
  "affected_product": "reporting",
  "customer_tier": "pro"
}

--- Now extract ---
Ticket: {ticket}
Output:"""

def extract_support_fields(ticket: str) -> dict:
    prompt = FEW_SHOT_EXTRACTION_PROMPT.format(ticket=ticket)
    raw = llm.complete(prompt).strip()
    return json.loads(raw)  # now reliable: < 2% parse error rate
```

**Example selection heuristics** (used by LangChain's `SemanticSimilarityExampleSelector`):
- Pick examples that are semantically closest to the input (embedding similarity)
- Include edge cases: the empty case, the error case, the ambiguous case
- Ensure balanced coverage of output categories to avoid distribution bias

```python
# LangChain: semantic example selection
from langchain_core.example_selectors import SemanticSimilarityExampleSelector
from langchain_openai import OpenAIEmbeddings

example_selector = SemanticSimilarityExampleSelector.from_examples(
    examples=ALL_EXAMPLES,          # pool of 50 curated examples
    embeddings=OpenAIEmbeddings(),
    vectorstore_cls=Chroma,
    k=4,                            # pick 4 most similar at runtime
)

# Dynamic few-shot prompt — examples change per input
prompt = FewShotPromptTemplate(
    example_selector=example_selector,
    example_prompt=example_template,
    prefix="Extract fields from the ticket. Output JSON only.",
    suffix="Ticket: {ticket}\nOutput:",
    input_variables=["ticket"],
)
```

**Production numbers at scale**: LlamaIndex reported that semantic few-shot selection (vs. fixed examples) improved extraction F1 by 11% on domain-specific tasks with varied vocabulary.

---

### Pattern C: Chain-of-Thought (CoT)

**What it is**: Instruct the model to reason step-by-step before producing the final answer. The reasoning chain ("scratchpad") improves accuracy on tasks requiring multi-hop logic, math, or planning.

**Two variants**:
1. **Manual CoT** — Write the reasoning steps into your few-shot examples
2. **Zero-shot CoT** — Add "Let's think step by step." to the prompt; requires no examples

```python
# Zero-shot CoT — add one magic phrase
def route_support_ticket_cot(ticket: str, queues: list[str]) -> str:
    prompt = f"""You are a support routing specialist.
    Available queues: {', '.join(queues)}

    Route this ticket to the correct queue.
    Let's think step by step.

    Ticket: {ticket}
    Routing reasoning:"""

    full_response = llm.complete(prompt)

    # Extract just the final queue name
    # CoT response: "Step 1: The ticket mentions API key... Step 2: This is an auth issue...
    #               Final queue: authentication-team"
    return extract_final_answer(full_response)
```

```python
# Manual CoT — embed reasoning in few-shot examples
COT_ROUTING_PROMPT = """
You are a support routing specialist. Think through each ticket step by step,
then state the final queue.

--- Example ---
Ticket: "Payments are failing for all our EU customers since 2am UTC."
Reasoning:
- The issue affects payments (billing/payments domain)
- All EU customers affected = geographic scope, likely infrastructure
- Time-bounded onset = incident rather than configuration error
- Severity: critical (revenue impact)
Final queue: payments-incidents

--- Example ---
Ticket: "How do I enable SSO for our organization?"
Reasoning:
- This is a how-to question, not a bug report
- SSO is an authentication/identity feature
- No urgency expressed
Final queue: auth-support

Now route this ticket:
Ticket: {ticket}
Reasoning:"""
```

**When CoT helps most** (Google Brain research, 2022):
- Tasks requiring 3+ reasoning steps: +30–50% accuracy
- Math and logic problems: +40–60% accuracy
- Classification with subtle distinctions: +10–20% accuracy
- Simple factual recall: negligible benefit, adds token cost

**CoT with tool use (ReAct pattern)**:

```python
# CoT + tool calls — Thought → Action → Observation loop
def react_agent(task: str, tools: dict) -> str:
    messages = [
        {"role": "system", "content": """Solve tasks using this format:

        Thought: <reason about what to do next>
        Action: <tool_name>
        Action Input: <tool_arguments as JSON>
        Observation: <tool result — filled in by system>
        ... (repeat Thought/Action/Observation as needed)
        Thought: I now have enough information to answer.
        Final Answer: <answer>
        """},
        {"role": "user", "content": task}
    ]

    while True:
        response = llm.complete(messages)
        if "Final Answer:" in response:
            return response.split("Final Answer:")[-1].strip()

        action, action_input = parse_action(response)
        observation = tools[action](**json.loads(action_input))

        messages.append({"role": "assistant", "content": response})
        messages.append({"role": "user", "content": f"Observation: {observation}"})
```

---

### Pattern D: Role Prompting

**What it is**: Assign the model a persona, expertise level, or organizational role. This shifts the model's default behavior — vocabulary, caution level, verbosity, assumed audience.

**Not just "pretend to be X"**: The role primes a latent capability cluster in the model. Telling the model "you are a senior security engineer reviewing code for OWASP vulnerabilities" activates different default behaviors than "review this code for bugs."

```python
# Role prompting for different audiences
ROLES = {
    "security_reviewer": """You are a senior security engineer with 10 years of experience
    in application security. You are reviewing code for OWASP Top 10 vulnerabilities,
    secrets exposure, injection risks, and insecure defaults. You are direct and specific —
    you cite line numbers, explain the attack vector, and provide a concrete fix.
    You do not mention non-security concerns.""",

    "tech_lead": """You are a principal engineer reviewing a junior developer's code.
    Your goal is teaching. You explain the 'why' behind every suggestion. You prioritize
    readability and maintainability over micro-optimizations. You are encouraging but honest.""",

    "api_designer": """You are a REST API design expert following the principles in
    'RESTful API Design' by Mark Masse. You enforce: versioning strategy, consistent
    resource naming, HTTP verb semantics, pagination patterns, and error response schemas.
    You give concrete before/after examples.""",
}

def review_code(code: str, role: str) -> str:
    system = ROLES[role]
    return llm.chat(system=system, user=f"Review this code:\n\n{code}")
```

**AutoGen multi-agent role prompting**: In AutoGen's GroupChat pattern, each agent has a specialized role. Role prompts prevent capability bleed — the researcher doesn't start writing code, the coder doesn't start making business decisions.

```python
# AutoGen-style role assignment for multi-agent coordination
agents = {
    "researcher": ConversableAgent(
        name="researcher",
        system_message="""You are a research analyst. Your job is ONLY to gather and
        summarize factual information. You do not write code, make recommendations,
        or draw conclusions. When you have found the information needed, you say:
        RESEARCH COMPLETE: <summary>""",
    ),
    "analyst": ConversableAgent(
        name="analyst",
        system_message="""You are a business analyst. You ONLY interpret research
        findings and provide structured analysis. You do not gather information yourself.
        You wait for RESEARCH COMPLETE signals before starting your analysis.""",
    ),
    "writer": ConversableAgent(
        name="writer",
        system_message="""You are a technical writer. You ONLY produce final documents
        from completed analysis. You do not conduct research or analysis yourself.""",
    ),
}
```

---

### Pattern E: Structured Output

**What it is**: Constrain the model to produce output that conforms to a schema — JSON, XML, a specific line format. Required for any automated pipeline where the output is parsed by code.

**Three approaches** (in order of reliability):

1. **Schema in prompt** — Describe the structure in natural language; least reliable
2. **JSON mode** — Provider API enforces valid JSON at the token level (OpenAI, Anthropic)
3. **Structured outputs / function calling** — Provider enforces a specific JSON schema; most reliable

```python
# Approach 1: Schema in prompt (least reliable, ~92% success rate)
prompt = """Extract the following fields. Respond ONLY with valid JSON, no prose.
Schema: {"name": string, "email": string, "issue": string, "priority": "low"|"medium"|"high"}

Input: {input}"""

# Approach 2: JSON mode (reliable for structure, ~99%; schema not enforced)
response = openai_client.chat.completions.create(
    model="gpt-4o",
    response_format={"type": "json_object"},
    messages=[{"role": "user", "content": prompt}]
)

# Approach 3: Structured outputs with schema (most reliable, ~99.9%)
from pydantic import BaseModel
from openai import OpenAI

class SupportTicketExtraction(BaseModel):
    name: str
    email: str
    issue: str
    priority: Literal["low", "medium", "high"]

client = OpenAI()
response = client.beta.chat.completions.parse(
    model="gpt-4o-2024-08-06",
    messages=[{"role": "user", "content": f"Extract fields: {ticket_text}"}],
    response_format=SupportTicketExtraction,
)
result: SupportTicketExtraction = response.choices[0].message.parsed
```

**Anthropic's approach** — use XML tags as structural anchors (the model was trained to respect them):

```python
# Anthropic: XML tags for structured extraction
prompt = f"""Extract the support ticket fields and place them inside XML tags.

Ticket: {ticket_text}

Extract into this exact format:
<extraction>
  <name>customer name here</name>
  <email>email here</email>
  <issue>brief issue description</issue>
  <priority>low|medium|high</priority>
</extraction>"""

response = anthropic_client.messages.create(
    model="claude-opus-4-5",
    max_tokens=512,
    messages=[{"role": "user", "content": prompt}]
)

# Parse XML — highly reliable with Anthropic models
import xml.etree.ElementTree as ET
root = ET.fromstring(response.content[0].text)
result = {child.tag: child.text for child in root}
```

---

### Pattern F: Self-Consistency

**What it is**: Run the same prompt N times with temperature > 0, collect multiple answers, and take the majority vote. Trades token cost for reliability. Used when correctness matters more than speed or cost.

```python
def self_consistent_answer(question: str, n: int = 5) -> str:
    answers = []
    for _ in range(n):
        response = llm.complete(question, temperature=0.7)
        answer = extract_final_answer(response)  # extract just the answer
        answers.append(answer)

    # Majority vote
    from collections import Counter
    most_common = Counter(answers).most_common(1)[0][0]
    return most_common

# Example: medical triage severity scoring
# Single call: 78% accuracy
# Self-consistency (n=5): 91% accuracy  (Google Brain paper, 2022)
# Self-consistency (n=10): 93% accuracy
# Diminishing returns after n=10 in most benchmarks
```

**When to use it**: High-stakes single-answer tasks (diagnosis, financial calculation, legal classification). Do not use in agent loops — the latency and cost multiply with every step.

---

### Pattern G: Prompt Chaining (Sequential Decomposition)

**What it is**: Break a complex task into a sequence of simpler prompts where each output feeds the next input. Each step can be validated independently.

**Why not one big prompt**: Large prompts with many instructions tend to drop constraints. Chaining makes each step auditable and allows per-step error handling.

```python
# Prompt chain for generating a structured business report
def generate_report(raw_data: str) -> Report:

    # Step 1: Extract key facts
    facts = llm.complete(f"""
        From the data below, extract only the key metrics.
        Output as bullet points, nothing else.
        Data: {raw_data}
    """)

    # Step 2: Classify sentiment/trend
    trend = llm.complete(f"""
        Based on these metrics, classify the business trend as:
        growing, stable, declining, or unclear.
        Give a one-sentence rationale.
        Metrics: {facts}
    """)

    # Step 3: Draft executive summary
    summary = llm.complete(f"""
        Write a 3-sentence executive summary for a board audience.
        Do not use jargon. Be direct about the trend.
        Metrics: {facts}
        Trend classification: {trend}
    """)

    # Step 4: Generate recommendations
    recs = llm.complete(f"""
        Based on the trend and summary, generate exactly 3 recommendations.
        Format as numbered list. Each under 20 words.
        Summary: {summary}
        Trend: {trend}
    """)

    return Report(facts=facts, trend=trend, summary=summary, recommendations=recs)
```

**LangChain expression language (LCEL)** for chaining:

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o")

extract_chain = (
    ChatPromptTemplate.from_template("Extract key metrics from: {data}")
    | llm
    | StrOutputParser()
)

summarize_chain = (
    ChatPromptTemplate.from_template("Summarize for executives: {metrics}")
    | llm
    | StrOutputParser()
)

# Compose into pipeline
full_pipeline = (
    {"metrics": extract_chain}
    | summarize_chain
)

result = full_pipeline.invoke({"data": raw_data})
```

---

### Comparison Table: Pattern Selection

| Pattern | Best For | Token Cost | Reliability | Latency |
|---------|----------|-----------|-------------|---------|
| Zero-Shot | Simple, common tasks | Low | Medium (70–85%) | Lowest |
| Few-Shot | Structured extraction, format adherence | Medium | High (85–95%) | Low |
| Chain-of-Thought | Multi-step reasoning, logic | Medium-High | High on complex tasks | Medium |
| Role Prompting | Tone control, domain expertise | Low (system prompt) | High | Low |
| Structured Output | Machine-parseable output | Low | Very High (99%+) | Low |
| Self-Consistency | High-stakes single answer | High (N× calls) | Very High (91–93%) | High |
| Prompt Chaining | Complex multi-stage tasks | Medium | High per-step | Medium |

---

### Real Company Examples

**1. Anthropic — Constitutional AI prompt patterns**

Anthropic's production prompts for Claude use a layered approach:
- System prompt: establishes role, capability constraints, output format
- Constitutional instructions: embedded rules that the model checks against its own outputs
- XML delimiters: `<answer>`, `<reasoning>`, `<citation>` tags for structured parsing

In their multi-agent products, each sub-agent receives a minimally-scoped system prompt — only the tools and permissions relevant to its role — to reduce hallucination and unwanted capability bleed.

**2. LangChain — FewShotPromptTemplate and example selectors**

LangChain's production recommendation for extraction tasks:
- Use `SemanticSimilarityExampleSelector` to dynamically pick the 3–5 most relevant examples from a curated pool of 20–100
- Store example pools in a vector store (Chroma or Pinecone) so they can be updated without code changes
- Version the example pool alongside the prompt template; treat them as a coupled artifact

**3. OpenAI — Structured Outputs for enterprise integrations**

OpenAI's internal teams building on GPT-4o use structured outputs (Pydantic schema enforcement) for all data extraction pipelines. Their reported parse failure rate:
- JSON mode (no schema): ~0.8% failure in production
- Structured outputs with schema: ~0.01% failure
- Cost is identical; schema enforcement adds negligible latency

**4. CrewAI — Role + CoT for multi-agent task decomposition**

CrewAI embeds CoT reasoning requirements directly in each crew agent's role definition:

```python
from crewai import Agent, Task, Crew

researcher = Agent(
    role="Market Research Analyst",
    goal="Find accurate data on competitor pricing",
    backstory="""You are a meticulous analyst who never states a fact without a source.
    Before any output, you think through: What do I know? What do I need to verify?
    What sources are authoritative here?""",
    verbose=True,   # enables CoT trace logging
)

analyst = Agent(
    role="Strategic Analyst",
    goal="Produce actionable insights from research",
    backstory="""You convert raw research into structured insights using the MECE framework.
    You always provide a confidence score (0–100) and flag low-confidence claims.""",
)
```

**5. LlamaIndex — Prompt templates for RAG pipelines**

LlamaIndex's `PromptTemplate` system parameterizes prompts for RAG:

```python
from llama_index.core import PromptTemplate

QA_PROMPT = PromptTemplate(
    """You are an expert Q&A assistant.
    Use the context below to answer the question.
    If the answer is not in the context, say "I don't have that information."
    Do not speculate beyond the provided context.

    Context:
    {context_str}

    Question: {query_str}
    Answer (cite the relevant passage inline using [Source: ...]):"""
)

# Swap prompt templates without code changes
query_engine.update_prompts({"response_synthesizer:text_qa_template": QA_PROMPT})
```

---

### Common Mistakes

**Mistake 1: Under-specifying output format in zero-shot prompts**

Root cause: The model knows many valid formats (JSON, YAML, prose, numbered list) and picks one arbitrarily.

Fix: Always specify format explicitly, even for simple tasks. Use structured outputs when downstream code parses the result.

```python
# Bad — format is ambiguous
prompt = "List the top 5 risks in this contract."

# Good — format is explicit
prompt = """List the top 5 risks in this contract.
Respond ONLY with a JSON array of strings. No explanation.
Example: ["risk one", "risk two"]
Contract: {contract}"""
```

**Mistake 2: Using CoT everywhere, even for simple tasks**

Root cause: Teams see CoT improve complex task quality and apply it universally.

Fix: CoT adds 2–5× token cost for simple tasks with negligible quality gain. Reserve CoT for tasks requiring 3+ reasoning steps. Use a routing layer to select the pattern.

```python
# Route prompt pattern based on estimated complexity
def select_pattern(task: str) -> str:
    complexity = estimate_complexity(task)  # 1-10 score
    if complexity >= 7:
        return "cot"          # multi-step reasoning needed
    elif requires_structure(task):
        return "structured"   # output will be parsed
    else:
        return "zero_shot"    # simple well-known task
```

**Mistake 3: Static few-shot examples that don't cover the live data distribution**

Root cause: Examples are written at development time against early test data. Production data evolves; examples become stale.

Fix: Maintain a living example pool (stored in a vector DB). Flag low-confidence outputs and use them as candidates for new examples. Review and update the example pool monthly.

**Mistake 4: Trusting the model to follow competing constraints**

Root cause: Prompts add constraint after constraint ("be concise but thorough; be formal but friendly; always cite sources but be brief").

Fix: Prioritize constraints explicitly. Use numbered priority order or separate prompts for different concern types.

```python
# Bad — competing constraints
system = "Be concise. Be thorough. Be formal. Be friendly. Always cite sources."

# Good — explicit priority
system = """Priority 1 (non-negotiable): Always cite your source inline.
Priority 2: Keep responses under 150 words unless more detail is explicitly requested.
Priority 3: Use formal business English (no slang, no exclamation marks).
Tone guidance (lower priority): Be helpful and direct, not cold."""
```

**Mistake 5: No prompt versioning**

Root cause: Teams iterate prompts in production without tracking what changed and what the performance impact was.

Fix: Treat prompts as code. Store in version control. A/B test changes. Use tools like LangSmith, Langfuse, or PromptLayer to track per-version quality metrics.

---

### Key Takeaways / TL;DR

- **Zero-shot works for common tasks; few-shot with 3–5 examples reduces extraction errors from ~12% to ~2%** — use structured outputs (Pydantic schema enforcement) to reach < 0.1%.
- **Chain-of-Thought adds 30–50% accuracy on complex reasoning tasks** but adds token cost; gate CoT behind a complexity classifier in high-volume pipelines.
- **Role prompting is free** (system prompt token cost) and reliably controls tone, vocabulary, and default caution level — essential for multi-agent systems where capability bleed is a failure mode.
- **Self-consistency (majority vote over N runs) boosts accuracy from ~78% to ~91%** on high-stakes classification tasks — but costs N× tokens; use only for single-answer critical decisions.
- **Prompt chaining beats monolithic mega-prompts** for complex tasks: each step is auditable, individually testable, and retryable without re-running the full pipeline.

---

## References

- 📖 [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models — Google Brain (2022)](https://arxiv.org/abs/2201.11903)
- 📚 [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- 📚 [OpenAI Prompt Engineering Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)
- 📚 [LangChain Prompt Templates and Few-Shot Examples](https://python.langchain.com/docs/concepts/prompt_templates/)
- 📚 [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- 📖 [DSPy: Programming, not Prompting, Foundation Models — Stanford (2023)](https://arxiv.org/abs/2310.03714)
