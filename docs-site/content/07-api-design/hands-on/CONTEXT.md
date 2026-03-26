# 07-api-design/hands-on/ — Layer 2 Router

Runnable proof-of-concept implementations for API design patterns — REST, GraphQL, gRPC, versioning, rate limiting, and key management.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to hands-on API design exercises and setup guide |
| rest-api-best-practices | POC implementing REST endpoints with proper status codes, error handling, and conventions |
| graphql-server-implementation | POC building a GraphQL server with resolvers, schema, and DataLoader |
| grpc-protocol-buffers | POC defining proto schemas and implementing gRPC client/server |
| api-versioning-strategies | POC demonstrating URL, header, and content-negotiation versioning side by side |
| api-gateway-rate-limiting | POC implementing an API gateway with token-bucket rate limiting |
| api-key-management | POC for generating, hashing, and validating API keys with scopes |
| idempotency-keys | POC implementing idempotency key middleware to deduplicate requests |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Build a well-structured REST API | rest-api-best-practices.md |
| Stand up a GraphQL server from scratch | graphql-server-implementation.md |
| Write .proto files and run gRPC calls | grpc-protocol-buffers.md |
| Compare versioning approaches in code | api-versioning-strategies.md |
| Add rate limiting to an API gateway | api-gateway-rate-limiting.md |
| Issue and validate API keys | api-key-management.md |
| Prevent duplicate payments or requests | idempotency-keys.md |
