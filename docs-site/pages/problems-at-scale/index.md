# ⚠️ Problems at Scale

> **1000+ Real-World Scaling Problems** - Document the architectural bottlenecks that cause 80% of production failures.

## What This Section Covers

This is a **problem-first** approach to learning system design. Instead of reading theory first, explore real production failures:

- **E-commerce overselling** during Black Friday - two users buy the last item
- **Payment double-charges** from race conditions - user charged twice
- **Database deadlocks** bringing down checkout - connection pool exhausted
- **Cache invalidation** causing thundering herd - 10K queries hit DB
- **Hot partitions** killing database performance - 80% traffic to one shard

**Why this matters**: 20% of architectural patterns cause 80% of production failures. Master these critical failure modes to build reliable systems.

Each problem includes:
- ✅ **Real scenario** with traffic numbers and timeline
- ✅ **Failure analysis** with diagrams showing what breaks
- ✅ **Why obvious solutions fail** at scale
- ✅ **Real company examples** (Amazon, Netflix, Stripe, etc.)
- ✅ **Detection & monitoring** queries and metrics
- ✅ **Interview guidance** for system design rounds
- 🚧 **Solutions** (being added incrementally)

---

## 📊 Problems by Category

| Category | Problems | Top Issues |
|----------|----------|------------|
| [🔄 Concurrency & Race Conditions](/problems-at-scale/concurrency) | 5/200+ | Inventory overselling, double-booking, duplicate payments |
| [🚨 Availability & Reliability](/problems-at-scale/availability) | 5/180+ | Cascading failures, thundering herd, split-brain |
| [📈 Scalability Bottlenecks](/problems-at-scale/scalability) | 5/150+ | Hot partitions, connection exhaustion, CDN limits |
| [⚖️ Consistency & Integrity](/problems-at-scale/consistency) | 5/120+ | Distributed transactions, eventual consistency lag |
| [⚡ Performance Degradation](/problems-at-scale/performance) | 5/150+ | Slow queries, N+1 problems, memory leaks |
| [🗄️ Data Integrity](/problems-at-scale/data-integrity) | 5/100+ | Orphaned records, duplicate entries, data corruption |
| [💰 Cost & Resource Waste](/problems-at-scale/cost-optimization) | 5/100+ | Storage bloat, unused indexes, over-provisioning |

**Progress**: 35/1000+ problems documented (3.5%)

---

## 🎯 Start Exploring

### Most Critical Problems (Start Here)

1. **[Race Condition in Inventory](/problems-at-scale/concurrency/race-condition-inventory)** - E-commerce
   - Two users buy last item simultaneously
   - Impact: $2.5M in refunds (Amazon Prime Day)

2. **[Thundering Herd on Cache Miss](/problems-at-scale/availability/thundering-herd)** - Content Platforms
   - Popular cache expires, 10K queries hit database
   - Impact: Complete outage (Facebook, Reddit)

3. **[Database Hot Partition](/problems-at-scale/scalability/database-hotspots)** - Social Media
   - Single shard handles 80% of traffic
   - Impact: Performance degradation (Instagram)

4. **[Payment Double-Charge](/problems-at-scale/concurrency/double-charge-payment)** - Fintech
   - User charged twice for single transaction
   - Impact: Compliance issues (Stripe, PayPal)

5. **[N+1 Query Problem](/problems-at-scale/performance/n-plus-one)** - Web Applications
   - Loading 100 posts generates 101 queries
   - Impact: Slow page loads (Facebook GraphQL)

### Browse by Domain

**E-commerce**:
- [Inventory Overselling](/problems-at-scale/concurrency/race-condition-inventory) | [Duplicate Orders](/problems-at-scale/concurrency/duplicate-orders) | [Checkout Timeout](/problems-at-scale/performance/slow-queries)

**Fintech**:
- [Payment Double-Charge](/problems-at-scale/concurrency/double-charge-payment) | [Transaction Consistency](/problems-at-scale/consistency/distributed-transaction) | [Write Skew](/problems-at-scale/consistency/write-skew)

**Social Media**:
- [Counter Race Conditions](/problems-at-scale/concurrency/counter-race) | [Hot Partitions](/problems-at-scale/scalability/database-hotspots) | [Feed Performance](/problems-at-scale/performance/slow-queries)

**Microservices**:
- [Cascading Failures](/problems-at-scale/availability/cascading-failures) | [Circuit Breaker Issues](/problems-at-scale/availability/circuit-breaker-failure) | [Retry Storms](/problems-at-scale/availability/retry-storm)

---

## 📈 Progress Tracker

**Total Problems Documented**: 35/1000+ (3.5%)

| Category | Documented | Target | Progress |
|----------|------------|--------|----------|
| **Concurrency** | 5 | 200 | ▓░░░░░░░░░ 2.5% |
| **Availability** | 5 | 180 | ▓░░░░░░░░░ 2.8% |
| **Scalability** | 5 | 150 | ▓░░░░░░░░░ 3.3% |
| **Consistency** | 5 | 120 | ▓░░░░░░░░░ 4.2% |
| **Performance** | 5 | 150 | ▓░░░░░░░░░ 3.3% |
| **Data Integrity** | 5 | 100 | ▓░░░░░░░░░ 5.0% |
| **Cost Optimization** | 5 | 100 | ▓░░░░░░░░░ 5.0% |

---

## 💡 How to Use This Section

### For Learning
1. Pick a problem that sounds familiar or interesting
2. Read the scenario (2 min) - understand the failure
3. Study "Why obvious solutions fail" (5 min)
4. Review real company examples (3 min)
5. Explore 3 related problems for deeper understanding

### For Interview Prep
- Problems are organized by **failure pattern**, not technology
- Each problem includes interview approach guidance
- Practice explaining "why obvious solutions fail at scale"
- Use cross-references to build comprehensive knowledge

### For Production Systems
- Use as troubleshooting reference when issues occur
- Search by symptoms (e.g., "slow checkout under load")
- Review detection queries to add monitoring
- Learn from real company incidents

---

## 🔗 Related Sections

- [📚 System Design Patterns](/system-design) - Learn fundamental architectural patterns
- [💼 Interview Prep](/interview-prep) - Practice full system design interviews
- [💻 Practice POCs](/interview-prep/practice-pocs) - Build hands-on implementations

---

## 🚧 What's Coming Next

**Week 2-3**: Solutions for Concurrency problems (distributed locks, atomic operations)
**Week 4-5**: Solutions for Availability problems (circuit breakers, retry policies)
**Month 2**: Expand to 100 problems across all categories
**Month 3-6**: Reach 500 problems with interactive filtering
**Year 1**: Target 1000+ problems covering all major failure modes

---

## 📝 Contributing

Found a problem at scale in production? Help the community learn from it:
- Document the scenario with real numbers
- Explain why it failed at scale
- Share detection and monitoring approaches
- Reference similar patterns

---

**Start exploring**: [Concurrency Problems](/problems-at-scale/concurrency) | [Availability Problems](/problems-at-scale/availability) | [All Categories](#-problems-by-category)
