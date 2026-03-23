---
title: "Fundamentals"
description: "Core system design concepts: API design, caching, rate limiting, load balancing, and resilience patterns"
---

# Fundamentals

These questions cover the building blocks that appear in virtually every system design interview. Master these before moving to specialized topics.

## What's Covered

| Topic | Difficulty | Why It Matters |
|-------|-----------|----------------|
| API Design: REST vs GraphQL vs gRPC | 🟡 Intermediate | Choosing the right API protocol for your use case |
| API Gateway Pattern | 🟡 Intermediate | Single entry point for microservices — very common at MNCs |
| Rate Limiting | 🟡 Intermediate | Protecting services from abuse and overload |
| Caching Strategies | 🟡 Intermediate | Redis, Memcached, CDN — dramatically reduces latency |
| Load Balancing Strategies | 🟡 Intermediate | Distributing traffic across servers |
| Circuit Breaker Pattern | 🟡 Intermediate | Preventing cascading failures in distributed systems |
| High Concurrency API | 🔴 Advanced | Handling millions of simultaneous requests |

## Study Order

Start with **API Design** to understand how services communicate, then move to **Caching** and **Rate Limiting** as they appear in almost every follow-up question. **Load Balancing** and **Circuit Breaker** build toward reliability thinking. Finish with **High Concurrency** once you're comfortable with the basics.

## Common Interview Patterns

- "How would you prevent abuse of your API?" → Rate limiting
- "How would you handle a spike of 10M requests?" → Load balancing + caching + rate limiting
- "What happens when a downstream service is slow?" → Circuit breaker
- "REST or GraphQL for a mobile app?" → API design trade-offs
