# 13-agent-workflows/failures/ — Layer 2 Router

Common failure modes in production AI agents — causes, detection, and mitigation strategies.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Overview of agent failure categories and a triage decision tree |
| tool-call-failures | Tool call errors: malformed schema, timeouts, partial results — handling and retry strategies |
| hallucination-in-agents | Hallucination patterns specific to agents: fabricated tool results, false confidence, citation drift |
| context-overflow | Context window overflow: silent truncation, lost instructions, workarounds and compression |
| infinite-loops | Agents that loop forever: detection, circuit breakers, max-step limits |
| prompt-injection-agents | Prompt injection via tool outputs or user data — attack vectors and defenses |
| cost-runaway | Runaway token spend: root causes, hard limits, per-task budgets, alerting |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Agent calling wrong or broken tools | tool-call-failures.md |
| Agent confidently returns wrong answers | hallucination-in-agents.md |
| Instructions disappear mid-run | context-overflow.md |
| Agent won't terminate | infinite-loops.md |
| User data manipulates agent behavior | prompt-injection-agents.md |
| Bill exploded from an agent run | cost-runaway.md |
