---
title: AutoGen / AG2 — Conversational Multi-Agent
layer: concept
section: agent-workflows/platforms
level: advanced
difficulty: advanced
prerequisites:
  - agent-workflows/concepts/what-is-an-agent
  - agent-workflows/concepts/multi-agent-systems
solves_with: []
related_problems: []
see_poc: []
linked_from: []
tags: [autogen, microsoft, ag2, conversational-agents, groupchat, human-in-loop]
---

# AutoGen / AG2 — Conversational Multi-Agent

**Level**: 🔴 Advanced
**Reading Time**: 12 minutes

> AutoGen's core insight: agents that talk to each other in natural language can solve problems that no single agent can — and that conversation is the control plane.

## The Problem

Some tasks genuinely require multiple independent reviewers. Code generation is the clearest example: an agent writes code, another reviews it, a third runs it and reports errors, the first fixes them. If you wire this as a fixed pipeline, you miss the case where the reviewer disagrees with the fixer's approach and needs to push back. AutoGen treats this as a **conversation between agents** — natural language messages flow between agents until the group converges on a solution.

## The Framework Lineage

Microsoft Research released AutoGen in late 2023. In 2024, the community fork **AG2** (AutoGen 2) emerged with a more stable API and production-focused changes. The concepts are identical; AG2 is the maintained successor for most production use cases.

```
AutoGen (0.1-0.3) — original Microsoft Research release
AG2 (AutoGen 0.4+) — community fork, stable API, production-focused
```

Both use the same mental model. Code examples below use the AG2/AutoGen 0.4 API.

## Core Concepts

### ConversableAgent

The base class. Every agent — human proxy, assistant, executor — is a `ConversableAgent` with:
- A **system message** defining role and behavior
- A **reply function** that generates its next message given the conversation history
- Optional **human input mode**: `NEVER`, `TERMINATE`, or `ALWAYS`

```python
from autogen import ConversableAgent, config_list_from_json

llm_config = {
    "config_list": [{"model": "gpt-4o", "api_key": "..."}],
    "temperature": 0,
}

assistant = ConversableAgent(
    name="Assistant",
    system_message="You are a helpful AI assistant. Solve problems step by step.",
    llm_config=llm_config,
    human_input_mode="NEVER",  # no human prompts
    max_consecutive_auto_reply=10,
)
```

### UserProxyAgent

A `ConversableAgent` subclass that represents a human. Key capability: it can **execute code** locally and return the output back into the conversation. This is AutoGen's "killer feature" for code generation workflows.

```python
from autogen import UserProxyAgent

user_proxy = UserProxyAgent(
    name="User",
    human_input_mode="TERMINATE",  # prompt human only at termination
    code_execution_config={
        "work_dir": "coding",       # directory to write/run code in
        "use_docker": True,         # run code in Docker for safety
    },
    is_termination_msg=lambda msg: "TERMINATE" in msg.get("content", ""),
)
```

### Two-Agent Conversation

The simplest pattern: one assistant + one user proxy. The proxy initiates, assistant responds, proxy can execute code, assistant refines:

```python
# Start the conversation
user_proxy.initiate_chat(
    assistant,
    message="Write a Python function that finds all prime numbers up to N using the Sieve of Eratosthenes. Then test it with N=50.",
)

# AutoGen handles the loop:
# 1. User sends task
# 2. Assistant writes code
# 3. UserProxy executes the code
# 4. Output returns to assistant ("Code ran, output: [2, 3, 5, 7, ...]")
# 5. Assistant verifies and says TERMINATE
# 6. Conversation ends
```

### GroupChat: Three or More Agents

`GroupChat` manages a conversation between N agents. A `GroupChatManager` (an LLM) decides which agent speaks next:

```mermaid
flowchart TD
    U[User: "Write and review a REST API in Python"]
    U --> GCM[GroupChatManager]

    GCM -- selects next speaker --> ARCH[Architect Agent]
    ARCH -- design doc --> GCM

    GCM -- selects next speaker --> CODER[Coder Agent]
    CODER -- Python code --> GCM

    GCM -- selects next speaker --> CRITIC[Critic Agent]
    CRITIC -- "found 2 issues" --> GCM

    GCM -- selects next speaker --> CODER
    CODER -- revised code --> GCM

    GCM -- selects next speaker --> EXEC[Executor Agent]
    EXEC -- "tests pass" --> GCM

    GCM -- conversation complete --> OUT[Final Output]
```

```python
from autogen import GroupChat, GroupChatManager

# Define agents
architect = ConversableAgent(
    name="Architect",
    system_message="""You are a software architect. When given a feature request,
    produce a clear design spec: endpoints, data models, error handling.
    Keep it concise — one paragraph max.""",
    llm_config=llm_config,
    human_input_mode="NEVER",
)

coder = ConversableAgent(
    name="Coder",
    system_message="""You are an expert Python developer. Implement exactly what
    the architect specifies. Write complete, runnable code. No placeholders.""",
    llm_config=llm_config,
    human_input_mode="NEVER",
)

critic = ConversableAgent(
    name="Critic",
    system_message="""You are a senior code reviewer. Review code for:
    correctness, security issues, missing error handling.
    If the code is acceptable, say 'APPROVED'. Otherwise list specific fixes.""",
    llm_config=llm_config,
    human_input_mode="NEVER",
)

executor = UserProxyAgent(
    name="Executor",
    human_input_mode="NEVER",
    code_execution_config={"work_dir": "output", "use_docker": True},
    is_termination_msg=lambda msg: "APPROVED" in msg.get("content", ""),
)

# Create group chat
groupchat = GroupChat(
    agents=[architect, coder, critic, executor],
    messages=[],
    max_round=20,
    speaker_selection_method="auto",  # GroupChatManager LLM picks next speaker
)

manager = GroupChatManager(
    groupchat=groupchat,
    llm_config=llm_config,
)

# Initiate
executor.initiate_chat(
    manager,
    message="Build a simple REST API for a todo list: CRUD endpoints using FastAPI.",
)
```

## Two-Agent Debate Pattern

AutoGen excels at "critique loops" — two agents debating until they converge:

```python
# Agent 1: proposes solutions
proposer = ConversableAgent(
    name="Proposer",
    system_message="""Propose solutions to problems. After hearing a critique,
    revise your proposal. If the critique is satisfied, add TERMINATE to your message.""",
    llm_config=llm_config,
    human_input_mode="NEVER",
    is_termination_msg=lambda msg: "TERMINATE" in msg.get("content", ""),
)

# Agent 2: critiques proposals
critic = ConversableAgent(
    name="Critic",
    system_message="""Critically evaluate proposals. Point out flaws, edge cases,
    and risks. Be specific. If the proposal is solid after revision, agree with it.""",
    llm_config=llm_config,
    human_input_mode="NEVER",
)

# Start debate
proposer.initiate_chat(
    critic,
    message="Here is my proposal for handling distributed transactions: use 2-phase commit.",
    max_turns=8,
)
```

## AutoGen 0.4 / AG2 Changes

The 0.4 refactor introduced a cleaner actor model:

```python
# AG2 pattern — agents as async actors with typed messages
from ag2 import AssistantAgent, UserProxyAgent, TextMessage

assistant = AssistantAgent(
    name="assistant",
    model_client=OpenAIChatCompletionClient(model="gpt-4o"),
)

user = UserProxyAgent(name="user")

# Async conversation
async def run():
    result = await user.run(
        task="Write a function to merge two sorted lists",
        agents=[assistant],
        termination_condition=MaxMessageTermination(max_messages=10),
    )
    return result
```

## Strengths

- **Flexible conversation patterns**: Any agent topology — linear, star, ring, debate — can be expressed as a conversation graph
- **Native code execution**: `UserProxyAgent` with Docker execution is the best out-of-the-box solution for code gen + run loops
- **Human-in-loop is first-class**: `human_input_mode="TERMINATE"` or `"ALWAYS"` lets a human step in at any point
- **Microsoft backing + research pedigree**: Strong ongoing research investment, used in production at Microsoft
- **Model agnostic**: Works with OpenAI, Azure OpenAI, Anthropic, local models via Ollama

## Weaknesses

- **Conversation-centric**: Workflows that aren't conversational (batch data pipelines, state machines) feel forced in AutoGen's model
- **Verbosity**: Conversations accumulate fast. 10 agents, 20 rounds = 200 messages of context. Token cost and latency compound.
- **Non-deterministic speaker selection**: GroupChatManager uses an LLM to pick the next speaker — this can produce unexpected orderings
- **Code execution security**: Running LLM-generated code is inherently risky. Docker isolation is strongly recommended.
- **Debugging**: When the conversation goes wrong, finding which message caused the issue requires reading a long conversation transcript
- **API instability**: 0.1 → 0.2 → 0.4 had significant breaking changes; production teams need to pin versions carefully

## Comparison: AutoGen vs CrewAI vs LangGraph

| Dimension | AutoGen / AG2 | CrewAI | LangGraph |
|-----------|---------------|--------|-----------|
| Paradigm | Conversation between agents | Role-based team | Explicit state graph |
| Control flow | Emergent (LLM drives) | Process-driven | Explicit edges |
| Human-in-loop | Native | Via tools | Via interrupt |
| Code execution | Built-in (UserProxy) | Via tools | Via tools |
| State management | Message history | Task context | Typed state dict |
| Best for | Code gen, research, debate | Content pipelines | Complex workflows |
| Debugging | Hard (long conversations) | Medium | Easy (visible graph) |
| Determinism | Low | Medium | High |

## When to Use AutoGen

Use AutoGen when:
- The core workflow is **code generation + execution** — write, run, fix loop
- You need **genuine multi-agent debate** (critic/proposer, multi-reviewer)
- Human oversight at conversation midpoints is important
- You want an **established framework** with strong research backing (Microsoft)

Avoid AutoGen when:
- You need deterministic, inspectable control flow — use LangGraph
- The workflow has no conversational structure — use LangChain or raw API
- Token cost is a primary concern — long conversations are expensive

## Pricing and Self-Hosting

| Component | Cost |
|-----------|------|
| AutoGen / AG2 library | Free (MIT / Apache 2.0) |
| AutoGen Studio (visual UI) | Free (open source) |
| LLM API calls | Per-token (any provider) |
| Code execution infrastructure | Your cost (Docker, VMs) |

Self-hosting: `pip install pyautogen` (or `ag2`). No server to run. Deploy as a Python service. Use Docker for safe code execution.

```bash
pip install pyautogen          # original AutoGen
# or
pip install ag2                # AG2 fork
```

## Common Pitfalls

1. **No Docker for code execution**: Running LLM-generated code without sandboxing is a security hole. Always set `use_docker=True` in production.
2. **GroupChat with too many agents**: More than 5-6 agents in a GroupChat becomes expensive and hard to control. The manager struggles to pick coherent next speakers.
3. **Missing termination condition**: Without `is_termination_msg` or `max_turns`, conversations run until the token limit or an error. Always set both.
4. **Identical system messages**: Agents with similar system messages produce redundant contributions. Each agent needs a meaningfully distinct role.
5. **Using GroupChat for linear tasks**: If your workflow is always A → B → C, sequential task assignment (CrewAI) or a simple pipeline is cleaner and cheaper.

## Key Takeaways

- AutoGen = agents as ConversableAgents that exchange natural language messages; the conversation is the control plane
- Key patterns: two-agent (assistant + user proxy), GroupChat (N agents + manager LLM), debate (proposer + critic loop)
- `UserProxyAgent` with Docker code execution is the standout feature for code generation workflows
- Human-in-loop is native: set `human_input_mode` to pause and prompt a human at any point
- Best fit: code generation, multi-reviewer research, tasks that genuinely benefit from conversational back-and-forth
- When control flow predictability matters more than conversational flexibility, use LangGraph instead
