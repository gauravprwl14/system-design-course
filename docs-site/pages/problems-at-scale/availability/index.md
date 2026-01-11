# 🚨 Availability & Reliability

## Overview

Problems that cause **system downtime, degraded performance, or service unavailability**. These failures occur when architectural decisions or component failures lead to cascading effects that take down entire systems.

**Why this matters**: A single point of failure can bring down a $1B business. Netflix's "Chaos Engineering" was born from availability problems. At scale, you're not designing for "if" components fail, but "when" they fail.

---

## Common Scenarios

### Cache-Related Failures
- **Thundering herd**: Popular cache expires, 10K requests hit database simultaneously
- **Cache stampede**: Cold cache causes cascading database overload
- **Cache poisoning**: Bad data cached globally via CDN

### Service Reliability
- **Cascading failures**: One microservice down triggers domino effect
- **Circuit breaker stuck**: Circuit breaker malfunction blocks all traffic
- **Retry storms**: Failed service overwhelmed by retry attempts
- **Split-brain syndrome**: Network partition creates two masters

### Infrastructure
- **Single point of failure**: Critical component with no redundancy
- **Health check failures**: Incorrect health checks remove healthy nodes
- **Load balancer saturation**: LB becomes bottleneck

---

## Key Patterns

### 1. Thundering Herd
```
Cache expires at 12:00:00
12:00:00.001: 10,000 requests → Cache miss → All hit database
Database: 10,000 concurrent queries → CPU 100% → Timeout
Result: Complete outage
```

**Solution**: Probabilistic early expiration, request coalescing

### 2. Cascading Failure
```
Service A calls B → B is slow (10s timeout)
Service A threads blocked waiting for B
New requests to A → All threads blocked
Service A becomes unresponsive
Services calling A also become blocked → Cascading failure
```

**Solution**: Circuit breakers, timeouts, bulkheads

### 3. Retry Storm
```
Service fails → 1000 clients retry immediately
Service gets 3x normal load (original + 2 retries each)
Service fails harder → Clients retry again
Exponential growth in traffic → Complete meltdown
```

**Solution**: Exponential backoff, jitter, backpressure

---

## Problems in This Category

| Problem | Domain | Impact | Difficulty | Status |
|---------|--------|--------|------------|--------|
| [Thundering Herd](/problems-at-scale/availability/thundering-herd) | Content Platforms | Complete outage | 🟡 Intermediate | 🚧 Problem documented |
| [Cascading Failures](/problems-at-scale/availability/cascading-failures) | Microservices | System-wide outage | 🔴 Advanced | 🚧 Problem documented |
| [Split-Brain Syndrome](/problems-at-scale/availability/split-brain) | Distributed DBs | Data conflicts | 🔴 Advanced | 🚧 Problem documented |
| [Circuit Breaker Failure](/problems-at-scale/availability/circuit-breaker-failure) | Microservices | Service unavailable | 🟡 Intermediate | 🚧 Problem documented |
| [Retry Storm](/problems-at-scale/availability/retry-storm) | API Systems | Prolonged outage | 🟡 Intermediate | 🚧 Problem documented |

---

## Common Solutions

### 1. Circuit Breakers
**Fail fast when downstream service is unavailable**
- Pros: Prevents cascading failures, fast recovery
- Cons: Need to tune thresholds, can cause false positives
- When: Calling external services, microservice architecture

### 2. Bulkheads
**Isolate resources to prevent total failure**
- Pros: Limits blast radius, partial availability
- Cons: Resource overhead, complexity
- When: Multi-tenant systems, critical vs non-critical paths

### 3. Request Coalescing
**Deduplicate simultaneous identical requests**
- Pros: Reduces thundering herd, efficient
- Cons: Adds latency for coalesced requests
- When: Cache warming, expensive operations

### 4. Exponential Backoff + Jitter
**Spread retry attempts over time**
- Pros: Prevents retry storms, gives service time to recover
- Cons: Increased latency for failed requests
- When: Any retry logic, API calls

---

## Real-World Impact

| Company | Problem | Scale | Impact |
|---------|---------|-------|--------|
| **Facebook** | Thundering herd | 1B users | 24-hour outage (2021) |
| **Netflix** | Cascading failure | 200M users | Created Chaos Engineering |
| **GitHub** | Split-brain | 100M developers | Data inconsistency |
| **AWS** | Retry storm | Global | Multi-hour region outage |

---

## Detection & Prevention

### Monitoring
```sql
-- Detect thundering herd
SELECT COUNT(*) as concurrent_misses
FROM cache_logs
WHERE event = 'miss'
AND timestamp > NOW() - INTERVAL '1 second'
HAVING COUNT(*) > 1000;

-- Detect circuit breaker issues
SELECT service, state, error_rate
FROM circuit_breakers
WHERE state = 'OPEN' AND duration > '5 minutes';
```

### Prevention
- Implement circuit breakers on all service calls
- Add request timeouts (< 10s for most operations)
- Use probabilistic cache expiration
- Load test with service failures (chaos engineering)
- Monitor error rates and set aggressive alerts

---

## Related Categories

- [Scalability](/problems-at-scale/scalability) - Availability issues often stem from scalability limits
- [Performance](/problems-at-scale/performance) - Slow performance can trigger availability problems
- [Consistency](/problems-at-scale/consistency) - Split-brain causes consistency issues

---

## Learn More

- [System Design: Circuit Breakers](/system-design/reliability/circuit-breakers)
- [Netflix Chaos Engineering](https://netflixtechblog.com/chaos-engineering)
- [POC: Implementing Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)

---

**Start exploring**: [Thundering Herd](/problems-at-scale/availability/thundering-herd) | [All Problems](/problems-at-scale)
