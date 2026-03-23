# API Design

Good API design is what separates systems that scale gracefully from systems that become liabilities. This section covers REST, GraphQL, gRPC, idempotency, pagination, versioning, and more.

## What You'll Learn

- **Concepts**: REST vs GraphQL vs gRPC, idempotency, pagination, API gateways
- **Hands-On**: Build real API implementations with working code
- **Failures**: Common API design mistakes at scale

## Where to Start

1. [REST vs GraphQL vs gRPC](./concepts/rest-graphql-grpc) — When to use each protocol
2. [Idempotency](./concepts/idempotency) — Safe retries in distributed systems
3. [Pagination Strategies](./concepts/pagination-strategies) — Cursor vs offset vs keyset
4. [REST API Best Practices](./hands-on/rest-api-best-practices) — Production-grade REST

## Topic Map

| Topic | Concepts | Hands-On | Problems at Scale | Interview Prep |
|-------|----------|----------|-------------------|----------------|
| Protocol selection | [rest-graphql-grpc](./concepts/rest-graphql-grpc) | [rest-api-best-practices](./hands-on/rest-api-best-practices), [graphql-server-implementation](./hands-on/graphql-server-implementation), [grpc-protocol-buffers](./hands-on/grpc-protocol-buffers) | — | [api-design-rest-graphql-grpc](/12-interview-prep/system-design/fundamentals/api-design-rest-graphql-grpc) |
| Rate limiting | [rate-limiting](./concepts/rate-limiting) | [rate-limiting-algorithms](./hands-on/rate-limiting-algorithms), [api-gateway-rate-limiting](./hands-on/api-gateway-rate-limiting) | — | [rate-limiting](/12-interview-prep/system-design/fundamentals/rate-limiting) |
| Idempotency | [idempotency](./concepts/idempotency) | [idempotency-keys](./hands-on/idempotency-keys) | — | — |
| API gateway | [api-gateway-deep-dive](./concepts/api-gateway-deep-dive) | [api-gateway-rate-limiting](./hands-on/api-gateway-rate-limiting), [api-key-management](./hands-on/api-key-management) | — | [api-gateway-pattern](/12-interview-prep/system-design/fundamentals/api-gateway-pattern) |
| Versioning | [api-versioning-strategies](./concepts/api-versioning-strategies) | [api-versioning-strategies](./hands-on/api-versioning-strategies) | — | — |
