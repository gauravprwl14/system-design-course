---
title: "Knowledge Map"
description: "Master router for the system design knowledge graph. Always load this first."
---

# System Design Knowledge Map — Layer 1 Router

> **For AI agents**: Load this file first in every session. It tells you what lives where and which files to load for any task.

## What This Knowledge Base Is

A comprehensive, implementation-focused system design course built on the 80/20 principle — covering 80% of essential system design topics with production-grade examples, hands-on POCs, and real failure scenarios. Every file is a node in a knowledge graph connected by typed edges.

## Node Type Legend

| Type | What It Is | Where It Lives |
|------|-----------|---------------|
| `concept` | Foundational theory article | `system-design/` |
| `solution` | Pattern or technique | `system-design/patterns/` |
| `problem` | Real-world failure scenario | `problems-at-scale/` |
| `poc` | Hands-on runnable implementation | `interview-prep/practice-pocs/` |
| `case-study` | Real company system design | `system-design/case-studies/` |
| `interview-q` | Interview question with full answer (many are case-study style) | `interview-prep/system-design/` |

## Section Map

| Section | Contains | Node Types |
|---------|----------|-----------|
| `system-design/` | 47 theory articles | concept, solution, case-study |
| `interview-prep/system-design/` | 33 interview questions | interview-q |
| `interview-prep/practice-pocs/` | 101 hands-on POCs | poc |
| `interview-prep/security-encryption/` | 5 security articles | concept |
| `interview-prep/aws-cloud/` | 5 AWS articles | concept |
| `interview-prep/database-storage/` | 6 database articles | concept |
| `interview-prep/caching-cdn/` | 5 caching articles | concept |
| `problems-at-scale/` | 24 failure scenarios | problem |

## Routing Table

| Task | Load First | Then |
|------|-----------|------|
| Learn a concept from scratch | `system-design/CONTEXT.md` | Follow `prerequisites` chain forward |
| Debug / understand a real failure | `problems-at-scale/CONTEXT.md` | Follow `solves_with` to solutions and POCs |
| Prepare for a system design interview | `interview-prep/CONTEXT.md` | Follow `prerequisites` + `see_poc` |
| Get hands-on code for a concept | `interview-prep/practice-pocs/CONTEXT.md` | Follow `prerequisites` back to theory |
| Understand how a real company solved this | `system-design/case-studies/CONTEXT.md` | Follow `prerequisites` to concepts |
| Find a solution pattern to implement | `system-design/patterns/CONTEXT.md` | Follow `prerequisites` to concepts, `see_poc` to practice |
| Find everything that links to a file | Read that file's `linked_from` field | Navigate backwards through graph |

## Traversal Patterns

```
Learn → Practice → See failure:
  concept (see_poc →) poc (related_problems →) problem

Debug backwards:
  problem (solves_with →) poc/solution (prerequisites →) concept

Interview prep path:
  interview-q (prerequisites →) concept (see_poc →) poc (case_studies →) case-study
```

## Graph Entry Points by Goal

| Goal | Start Here |
|------|-----------|
| "I need to understand caching" | `system-design/caching/caching-fundamentals` |
| "My system has a thundering herd problem" | `problems-at-scale/availability/thundering-herd` |
| "I have a system design interview" | `interview-prep/system-design/` (any question by topic) |
| "I want to practice Redis hands-on" | `interview-prep/practice-pocs/redis-key-value-cache` |
| "How does Netflix handle video streaming?" | `interview-prep/system-design/video-streaming-platform` |
| "What is the circuit breaker pattern?" | `system-design/patterns/circuit-breaker` |
| "Database is hitting hotspots" | `problems-at-scale/scalability/database-hotspots` |
