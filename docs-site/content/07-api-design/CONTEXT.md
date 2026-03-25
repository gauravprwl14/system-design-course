# 07-api-design/ — Layer 1 Module

API design patterns, protocols, and best practices — covering REST, GraphQL, gRPC, rate limiting, pagination, idempotency, webhooks, and API gateways.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Theory articles on API design: protocols, patterns, versioning, real-time, and gateways |
| hands-on/ | poc | Runnable implementations of REST, GraphQL, gRPC, versioning, rate limiting, and key management |
| failures/ | problem | Overview of API failure modes and anti-patterns |

## Article Count
- concepts/: 10 articles (+ overview)
- hands-on/: 7 articles (+ overview)
- failures/: 0 articles (+ overview placeholder)
- Total: 17 articles + 3 overviews

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Decide between REST, GraphQL, gRPC | concepts/ | rest-graphql-grpc.md |
| Understand idempotency and safe retries | concepts/ | idempotency.md |
| Learn rate limiting design | concepts/ | rate-limiting.md |
| Choose a pagination strategy | concepts/ | pagination-strategies.md |
| Design a versioning strategy | concepts/ | api-versioning-strategies.md |
| Understand webhooks | concepts/ | webhook-design.md |
| Build real-time APIs (SSE, WebSockets) | concepts/ | realtime-api-patterns.md |
| Deep-dive API gateway internals | concepts/ | api-gateway-deep-dive.md |
| gRPC patterns and streaming | concepts/ | grpc-design-patterns.md |
| GraphQL in production | concepts/ | graphql-production-patterns.md |
| Implement REST API with best practices | hands-on/ | rest-api-best-practices.md |
| Build a GraphQL server | hands-on/ | graphql-server-implementation.md |
| Use Protocol Buffers with gRPC | hands-on/ | grpc-protocol-buffers.md |
| Implement API gateway + rate limiting | hands-on/ | api-gateway-rate-limiting.md |
| Manage API keys | hands-on/ | api-key-management.md |
| Implement idempotency keys | hands-on/ | idempotency-keys.md |

## Prerequisites
- Basic HTTP knowledge (methods, status codes, headers)
- Familiarity with one backend language (Node.js, Python, etc.)

## Connects To
- 08-security/ — Authentication, OAuth, JWT for securing APIs
- 09-observability/ — Monitoring API latency and error rates
- 10-architecture/ — API gateway as an architectural component, service mesh
- 12-interview-prep/system-design/fundamentals/ — API Design interview questions
