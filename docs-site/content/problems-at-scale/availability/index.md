---
title: "Availability & Cascading Failures"
description: "When one failure becomes many — and how to stop the chain reaction"
---

# Availability & Cascading Failures

A single slow service can take down your entire system if there are no circuit breakers, bulkheads, or graceful degradation patterns in place.

```mermaid
graph TD
    CASCADE[Cascading Failures] -->|fix| CB[Circuit Breaker\n+ Bulkhead isolation]
    THUNDER[Thundering Herd\nCache Stampede] -->|fix| JITTER[TTL jitter +\nProbabilistic early refresh]
    RETRY[Retry Storm] -->|fix| BACKOFF[Exponential backoff\n+ Jitter + Max retries]
    TIMEOUT[Timeout Domino Effect] -->|fix| BUDGET[Request budget\n+ Per-hop timeouts]
    SPLITBRAIN[Split-Brain\nDual Primary] -->|fix| FENCE[Fencing tokens\n+ Consensus quorum]
```

## Problems in This Section

| Problem | The Pain |
|---------|----------|
| [Cascading Failures](cascading-failures) | One slow DB query takes down 23 services |
| [Thundering Herd / Cache Stampede](thundering-herd) | Cache expiry DDoSes your own database |
| [Retry Storm](retry-storm) | Retries amplify a 30s hiccup into a 45min outage |
| [Timeout Domino Effect](timeout-domino-effect) | Nested timeouts that multiply latency |
| [Split-Brain / Dual Primary](split-brain) | Two primaries, 8 minutes of conflicting writes |
