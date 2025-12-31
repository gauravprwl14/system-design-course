# Load Balancing

> Distribute traffic efficiently across multiple servers

## 📋 Overview

Load balancers are critical for high availability and scalability, distributing incoming requests across multiple backend servers to prevent any single server from becoming overwhelmed.

## 📚 Articles

### Fundamentals (🟢 Beginner)
1. [Load Balancer Basics](./01-load-balancer-basics.md) - What, why, when
2. [Round Robin](./02-round-robin.md) - Simple distribution algorithm
3. [Least Connections](./03-least-connections.md) - Connection-based routing
4. [Health Checks](./04-health-checks.md) - Detecting failed servers
5. [Session Persistence](./05-session-persistence.md) - Sticky sessions

### Intermediate Topics (🟡 Intermediate)
6. [Layer 4 vs Layer 7](./06-l4-vs-l7.md) - Network vs application layer
7. [Weighted Load Balancing](./07-weighted-lb.md) - Different server capacities
8. [Geographic Load Balancing](./08-geo-lb.md) - Route by user location
9. [SSL Termination](./09-ssl-termination.md) - Offload encryption
10. [Rate Limiting](./10-rate-limiting.md) - Prevent abuse

### Advanced Topics (🔴 Advanced)
11. [Global Server Load Balancing](./11-gslb.md) - Multi-datacenter routing
12. [Dynamic Load Balancing](./12-dynamic-lb.md) - Real-time adaptation
13. [Service Mesh](./13-service-mesh.md) - Microservices load balancing
14. [DNS Load Balancing](./14-dns-lb.md) - DNS-based distribution
15. [Consistent Hashing](./15-consistent-hashing.md) - Cache-friendly routing

## 🎯 Quick Reference

| Use Case | Algorithm | Article |
|----------|-----------|---------|
| Simple setup | Round Robin | [#02](./02-round-robin.md) |
| Long connections | Least Connections | [#03](./03-least-connections.md) |
| Different hardware | Weighted | [#07](./07-weighted-lb.md) |
| User sessions | Sticky Sessions | [#05](./05-session-persistence.md) |
| Global users | Geographic LB | [#08](./08-geo-lb.md) |

## 🚀 Impact

- **High Availability**: 99.99% uptime (no single point of failure)
- **Scalability**: Add servers without downtime
- **Performance**: Route to closest/fastest server
- **Security**: Hide backend servers, prevent DDoS

Start with [Load Balancer Basics](./01-load-balancer-basics.md)!
