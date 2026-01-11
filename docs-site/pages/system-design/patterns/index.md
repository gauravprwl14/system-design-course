# Design Patterns

> Battle-tested patterns for distributed systems

## 📋 Overview

Design patterns are proven solutions to common problems in system design. These patterns are used by companies like Netflix, Amazon, and Google to build resilient, scalable systems.

## 📚 Articles

### Resilience Patterns (🟢 Beginner)
1. [Circuit Breaker](./01-circuit-breaker.md) - Prevent cascading failures
2. [Retry Pattern](./02-retry-pattern.md) - Exponential backoff
3. [Timeout Pattern](./03-timeout-pattern.md) - Fail fast
4. [Bulkhead Pattern](./04-bulkhead.md) - Isolate failures
5. [Health Check Pattern](./05-health-check.md) - Service monitoring

### Data Patterns (🟡 Intermediate)
6. [Saga Pattern](./06-saga.md) - Distributed transactions
7. [CQRS](./07-cqrs.md) - Command Query Responsibility Segregation
8. [Event Sourcing](./08-event-sourcing.md) - Event-based state
9. [Materialized View](./09-materialized-view.md) - Precomputed data
10. [Cache-Aside](./10-cache-aside.md) - Lazy caching

### Communication Patterns (🟡 Intermediate)
11. [API Gateway](./11-api-gateway.md) - Single entry point
12. [Backend for Frontend (BFF)](./12-bff.md) - Client-specific APIs
13. [Service Mesh](./13-service-mesh.md) - Inter-service communication
14. [Sidecar Pattern](./14-sidecar.md) - Auxiliary containers
15. [Ambassador Pattern](./15-ambassador.md) - Proxy connections

### Advanced Patterns (🔴 Advanced)
16. [Strangler Fig](./16-strangler-fig.md) - Gradual migration
17. [Anti-Corruption Layer](./17-anti-corruption.md) - Legacy integration
18. [Throttling](./18-throttling.md) - Control consumption
19. [Leader Election](./19-leader-election.md) - Distributed coordination
20. [Two-Phase Commit](./20-two-phase-commit.md) - Distributed transactions

## 🎯 Pattern Selection Guide

| Problem | Pattern | Use When |
|---------|---------|----------|
| Service failing | Circuit Breaker | Prevent cascading failures |
| Temporary errors | Retry | Network hiccups |
| Multiple services | API Gateway | Simplify client access |
| Distributed transaction | Saga | Need eventual consistency |
| High read load | CQRS | Read/write asymmetry |

Start with [Circuit Breaker](./01-circuit-breaker.md) - the most important pattern!
