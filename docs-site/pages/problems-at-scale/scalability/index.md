# 📈 Scalability Bottlenecks

## Overview

Problems that prevent systems from **handling increased load or growing to serve more users**. These failures occur when architectural decisions that work at small scale become bottlenecks at large scale.

**Why this matters**: What works for 1,000 users often fails at 100,000. Instagram had to reshard their entire database when user growth hit bottlenecks. Scalability problems often appear suddenly during viral growth or traffic spikes.

---

## Common Scenarios

### Database Scalability
- **Hot partitions**: Single shard handles 80% of traffic
- **Connection exhaustion**: Connection pool runs out under load
- **Lock contention**: Row locks cause throughput collapse
- **Query timeout**: Complex queries fail under concurrent load

### Network & CDN
- **CDN rate limiting**: Viral content exceeds bandwidth limits
- **WebSocket scaling**: Connection state across multiple servers
- **API gateway bottleneck**: Single gateway becomes limit

### Application Layer
- **Memory exhaustion**: Growing dataset exceeds RAM
- **Thread pool exhaustion**: All worker threads blocked
- **Session storage overflow**: In-memory sessions hit limits

---

## Key Patterns

### 1. Database Hot Partition
```
Users sharded by user_id
Celebrity with ID 12345 has 100M followers
Every follower action hits shard containing user 12345
That shard: 80% of total traffic
Other shards: 20% of traffic combined
Result: One shard saturated, others idle
```

**Solution**: Consistent hashing, partition key redesign

### 2. Connection Pool Exhaustion
```
Database allows 100 connections
App has 50 servers × 20 connections = 1,000 needed
Under load: All connections in use
New requests: Wait for connection → Timeout → Error
Result: Service appears down despite working database
```

**Solution**: Connection pooling, read replicas, caching

### 3. WebSocket Scaling
```
User A connects to Server 1
User B connects to Server 2
User A sends message to User B
Server 1 doesn't know User B's location
Result: Message lost or delayed
```

**Solution**: Redis Pub/Sub, message bus, session affinity

---

## Problems in This Category

| Problem | Domain | Impact | Difficulty | Status |
|---------|--------|--------|------------|--------|
| [Database Hot Partition](/problems-at-scale/scalability/database-hotspots) | Social Media | Performance degradation | 🔴 Advanced | 🚧 Problem documented |
| [Connection Pool Exhaustion](/problems-at-scale/scalability/connection-exhaustion) | Web Apps | Service errors | 🟡 Intermediate | 🚧 Problem documented |
| [CDN Rate Limiting](/problems-at-scale/scalability/cdn-limits) | Media Streaming | Slow delivery | 🟡 Intermediate | 🚧 Problem documented |
| [WebSocket Scaling](/problems-at-scale/scalability/websocket-scaling) | Real-time Apps | Message loss | 🔴 Advanced | 🚧 Problem documented |
| [Search Query Timeout](/problems-at-scale/scalability/search-timeout) | E-commerce | Poor UX | 🟡 Intermediate | 🚧 Problem documented |

---

## Common Solutions

### 1. Horizontal Sharding
**Partition data across multiple databases**
- Pros: Linear scalability, handle massive datasets
- Cons: Complex queries, rebalancing difficulty
- When: Dataset exceeds single DB capacity

### 2. Read Replicas
**Distribute read traffic across multiple copies**
- Pros: Scale reads independently, failover capability
- Cons: Replication lag, eventual consistency
- When: Read-heavy workload (80%+ reads)

### 3. Caching Layer
**Cache hot data in memory (Redis/Memcached)**
- Pros: 100x faster than DB, reduces load
- Cons: Cache invalidation complexity, stale data
- When: Hot data exists, read-heavy patterns

### 4. Connection Pooling
**Reuse database connections efficiently**
- Pros: Reduces connection overhead, controls concurrency
- Cons: Need to tune pool size, potential bottleneck
- When: Many short-lived database operations

---

## Real-World Impact

| Company | Problem | Scale | Impact |
|---------|---------|-------|--------|
| **Instagram** | Hot partition | 1B users | Emergency reshard |
| **Twitter** | Connection exhaustion | 500M tweets/day | Frequent timeouts |
| **TikTok** | CDN limits | Viral video | Geographic slowdowns |
| **Slack** | WebSocket scaling | 10M connections | Message delays |

---

## Detection & Prevention

### Monitoring
```sql
-- Detect hot partition
SELECT shard_id, COUNT(*) as request_count
FROM request_logs
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY shard_id
ORDER BY request_count DESC;

-- Detect connection pool exhaustion
SELECT pool_name,
       active_connections,
       max_connections,
       (active_connections::float / max_connections) * 100 as utilization
FROM connection_pools
WHERE utilization > 90;
```

### Prevention
- Load test at 10x expected peak traffic
- Monitor connection pool utilization (alert >80%)
- Use consistent hashing for partition keys
- Implement auto-scaling based on metrics
- Regular capacity planning reviews

---

## Related Categories

- [Performance](/problems-at-scale/performance) - Scalability issues manifest as performance problems
- [Availability](/problems-at-scale/availability) - Scalability limits cause availability issues
- [Cost Optimization](/problems-at-scale/cost-optimization) - Over-provisioning wastes money

---

## Learn More

- [System Design: Database Sharding](/system-design/databases/sharding)
- [System Design: Caching Strategies](/system-design/caching)
- [POC: Horizontal Scaling](/interview-prep/practice-pocs/horizontal-scaling)

---

**Start exploring**: [Database Hot Partition](/problems-at-scale/scalability/database-hotspots) | [All Problems](/problems-at-scale)
