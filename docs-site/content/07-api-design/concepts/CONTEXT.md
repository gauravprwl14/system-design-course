# 07-api-design/concepts/ — Layer 2 Router

Theory and design principles for APIs — protocols, idempotency, rate limiting, pagination, versioning, webhooks, real-time patterns, and gateways.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to API design concepts and what to study |
| rest-graphql-grpc | Comparison of REST, GraphQL, and gRPC — when to choose each |
| idempotency | Designing idempotent operations to make retries safe |
| rate-limiting | Token bucket, sliding window, and fixed window rate limiting algorithms |
| pagination-strategies | Offset, cursor, keyset, and seek-based pagination trade-offs |
| api-versioning-strategies | URL versioning, header versioning, and backwards-compatibility strategies |
| webhook-design | Designing reliable webhook delivery with retries and signatures |
| realtime-api-patterns | SSE, WebSockets, long-polling — when to use each for real-time updates |
| api-gateway-deep-dive | Internals of API gateways: routing, auth, rate limiting, observability |
| grpc-design-patterns | gRPC streaming patterns, error handling, and production best practices |
| graphql-production-patterns | Schema design, N+1 problem, DataLoader, and persisted queries |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Pick the right API protocol for a new service | rest-graphql-grpc.md |
| Make POST/PUT operations safe to retry | idempotency.md |
| Protect APIs from abuse | rate-limiting.md |
| Handle large list responses efficiently | pagination-strategies.md |
| Evolve an API without breaking clients | api-versioning-strategies.md |
| Notify external systems of events | webhook-design.md |
| Push updates to browser or mobile clients | realtime-api-patterns.md |
| Understand what an API gateway does internally | api-gateway-deep-dive.md |
| Use gRPC for inter-service communication | grpc-design-patterns.md |
| Run GraphQL at scale in production | graphql-production-patterns.md |
