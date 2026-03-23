# Architecture & Patterns

Architecture patterns are reusable solutions to recurring problems. This section covers circuit breakers, sagas, microservices communication, service meshes, deployment strategies, and more.

## What You'll Learn

- **Concepts**: Circuit breaker, saga pattern, bulkhead, strangler fig, CQRS, event-driven architecture
- **Hands-On**: Implement resilience patterns with working code
- **Failure Modes**: Cascading failures, retry storms, split brain, thundering herd

## Where to Start

1. [Circuit Breaker](./concepts/circuit-breaker) — Stop cascading failures
2. [Saga Pattern Deep Dive](./concepts/saga-pattern-deep-dive) — Distributed transaction coordination
3. [Microservices Architecture](./concepts/microservices-architecture) — When microservices make sense
4. [Cascading Failures](./failures/cascading-failures) — The most common production disaster

## Topic Map

| Topic | Concepts | Hands-On | Problems at Scale | Interview Prep |
|-------|----------|----------|-------------------|----------------|
| Circuit breaker | [circuit-breaker](./concepts/circuit-breaker) | [circuit-breaker](./hands-on/circuit-breaker) | [cascading-failures](/problems-at-scale/availability/cascading-failures), [circuit-breaker-failure](/problems-at-scale/availability/circuit-breaker-failure) | [circuit-breaker-pattern](/12-interview-prep/system-design/fundamentals/circuit-breaker-pattern) |
| Microservices comms | [microservices-communication](./concepts/microservices-communication) | — | — | [monolith-to-microservices](/12-interview-prep/system-design/scale-and-reliability/monolith-to-microservices) |
| Timeouts & backpressure | [timeouts-backpressure](./concepts/timeouts-backpressure), [backpressure](./concepts/backpressure) | [retry-backoff](./hands-on/retry-backoff), [timeout-configuration](./hands-on/timeout-configuration) | — | — |
| Event-driven | [event-driven-architecture](./concepts/event-driven-architecture) | [event-sourcing-basics](./hands-on/event-sourcing-basics) | — | [event-driven-architecture](/12-interview-prep/system-design/messaging-and-streaming/event-driven-architecture) |
| CQRS | [cqrs](./concepts/cqrs) | — | — | [cqrs-pattern](/12-interview-prep/system-design/business-and-advanced/cqrs-pattern) |
| Saga pattern | [saga-pattern-deep-dive](./concepts/saga-pattern-deep-dive) | [saga-pattern](./hands-on/saga-pattern) | — | [saga-pattern](/12-interview-prep/system-design/business-and-advanced/saga-pattern) |
