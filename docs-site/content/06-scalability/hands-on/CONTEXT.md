# 06-scalability/hands-on/ — Layer 2 Router

Runnable load balancer implementations and consistent hashing POCs demonstrating core scalability primitives in code.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Guide to the scalability hands-on POCs |
| load-balancer-round-robin | Round-robin load balancer implementation: distributing requests evenly across backends |
| load-balancer-least-connections | Least-connections load balancer: routing to the backend with fewest active connections |
| load-balancer-consistent-hashing | Consistent hashing load balancer: sticky routing without full rehashing on node changes |
| nginx-load-balancer | Configuring Nginx as a load balancer with upstream groups and health checks |
| consistent-hashing-poc | Standalone consistent hashing ring: add/remove nodes and see key redistribution |
| rate-limiting-algorithms | Side-by-side implementation of fixed window, sliding window, and token bucket algorithms |
| service-discovery | Service discovery patterns: client-side vs server-side discovery, registry-based approaches |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Implement basic round-robin load balancing | load-balancer-round-robin |
| Implement smart connection-aware routing | load-balancer-least-connections |
| Implement sticky routing with consistent hashing | load-balancer-consistent-hashing |
| Configure Nginx as a load balancer | nginx-load-balancer |
| Understand consistent hashing hands-on | consistent-hashing-poc |
| Compare rate limiting algorithms in code | rate-limiting-algorithms |
| Implement service discovery | service-discovery |
