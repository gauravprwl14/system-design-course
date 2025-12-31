# Getting Started

Welcome to the System Design Knowledge Base! This guide will help you navigate and make the most of this learning resource.

## 📚 What You'll Find Here

This knowledge base contains **100+ articles** covering every aspect of system design, from databases to distributed systems. Each article includes:

- ✅ **Real-world context** - When you actually need this
- ✅ **Architecture diagrams** - Visual understanding with Mermaid
- ✅ **Implementation code** - Practical pseudocode examples
- ✅ **Trade-offs** - Pros, cons, and alternatives
- ✅ **Production examples** - How big companies use it

## 🎯 Who Is This For?

### Junior Developers
**Goal**: Learn system design fundamentals
**Path**: Start with 🟢 Beginner articles in order
1. [Database Replication Basics](./01-databases/01-replication-basics.md)
2. [Caching Fundamentals](./02-caching/01-caching-fundamentals.md)
3. [Message Queue Basics](./03-queues/01-message-queue-basics.md)
4. [Load Balancer Basics](./04-load-balancing/01-load-balancer-basics.md)

### Mid-Level Engineers
**Goal**: Deepen knowledge, prepare for senior roles
**Path**: Focus on 🟡 Intermediate articles
1. [Database Sharding Strategies](./01-databases/03-sharding-strategies.md)
2. [Cache Invalidation](./02-caching/05-cache-invalidation.md)
3. [Circuit Breaker Pattern](./07-patterns/01-circuit-breaker.md)
4. [Design Instagram Feed](./08-case-studies/06-instagram-feed.md)

### Senior Engineers
**Goal**: Master distributed systems, architecture decisions
**Path**: Study 🔴 Advanced articles and case studies
1. [Distributed Transactions](./01-databases/11-distributed-transactions.md)
2. [Event Sourcing](./03-queues/11-event-sourcing.md)
3. [Multi-Region Architecture](./05-scalability/11-multi-region.md)
4. [Design YouTube](./08-case-studies/15-youtube.md)

### Interview Candidates
**Goal**: Ace system design interviews
**Path**: Study case studies + fundamentals
1. [Design a URL Shortener](./08-case-studies/01-url-shortener.md) ⭐ Most common
2. [Design Instagram Feed](./08-case-studies/06-instagram-feed.md)
3. [Design Uber Backend](./08-case-studies/11-uber-backend.md)
4. Review all 🟢 Beginner articles for fundamentals

## 📖 How to Use This Resource

### 1. **Browse by Topic** (Recommended for Learning)

Navigate to any section that interests you:

```
01-databases/       → Database scaling, replication, sharding
02-caching/         → Caching strategies, Redis, CDN
03-queues/          → Message queues, async processing
04-load-balancing/  → Traffic distribution
05-scalability/     → Horizontal scaling, microservices
06-performance/     → Optimization techniques
07-patterns/        → Design patterns (Circuit Breaker, Saga, etc.)
08-case-studies/    → Real system designs (Instagram, Uber, etc.)
09-api-design/      → REST, GraphQL, versioning
10-monitoring/      → Observability, metrics, logging
11-security/        → Authentication, authorization
12-consistency/     → ACID, CAP, eventual consistency
```

### 2. **Follow Learning Paths** (Recommended for Beginners)

#### Path 1: Database Engineering (2-3 weeks)
1. Replication Basics
2. Read Replicas
3. Sharding Strategies
4. Indexing Strategies
5. Connection Pooling
6. Multi-Region Databases

#### Path 2: Application Performance (2-3 weeks)
1. Caching Fundamentals
2. Cache-Aside Pattern
3. Cache Invalidation
4. Message Queue Basics
5. Load Balancer Basics
6. Query Optimization

#### Path 3: Distributed Systems (4-6 weeks)
1. CAP Theorem
2. Eventual Consistency
3. Circuit Breaker
4. Saga Pattern
5. Event Sourcing
6. Multi-Region Architecture

### 3. **Solve Problems** (Recommended for Interview Prep)

Pick a case study and try to design it yourself BEFORE reading:
1. Spend 30-45 minutes designing
2. Read the article
3. Compare your solution
4. Note what you missed

### 4. **Build Projects** (Recommended for Hands-On Learning)

Implement the concepts:
- Build a URL shortener with caching and analytics
- Create a message queue system with Redis
- Implement circuit breaker pattern in your app
- Add database replication to your project

## 🎓 Study Schedule

### 30-Day Crash Course (Interview Prep)

**Week 1: Fundamentals**
- Day 1-2: Database (replication, indexes)
- Day 3-4: Caching (fundamentals, strategies)
- Day 5-6: Load balancing, scaling basics
- Day 7: Review + practice

**Week 2: Patterns**
- Day 8-9: Message queues, async processing
- Day 10-11: Circuit breaker, retry patterns
- Day 12-13: API design, versioning
- Day 14: Review + practice

**Week 3: Case Studies**
- Day 15-16: URL Shortener
- Day 17-18: Instagram Feed
- Day 19-20: Uber Backend
- Day 21: Review + practice

**Week 4: Advanced + Mock Interviews**
- Day 22-23: Sharding, distributed systems
- Day 24-25: More case studies
- Day 26-28: Mock interviews
- Day 29-30: Review weak areas

### 90-Day Deep Dive (Career Development)

**Month 1: Foundations**
- Databases: All articles
- Caching: All articles
- Practice: Build a blog with caching

**Month 2: Distributed Systems**
- Queues & messaging
- Load balancing
- Design patterns
- Practice: Build microservices app

**Month 3: Production Systems**
- All case studies
- Monitoring & observability
- Security
- Practice: Design 10 systems from scratch

## 🔍 Quick Reference

### Common Interview Questions

1. **"Design a URL shortener"**
   → [Case Study](./08-case-studies/01-url-shortener.md)
   → Need: Sharding, Caching, Load Balancing

2. **"How do you handle 1M concurrent users?"**
   → [Scalability](./05-scalability/01-scaling-basics.md)
   → Need: Load balancers, Caching, Read replicas, Sharding

3. **"How do you prevent cascading failures?"**
   → [Circuit Breaker](./07-patterns/01-circuit-breaker.md)
   → Need: Circuit breaker, Bulkhead, Timeout patterns

4. **"How do you handle eventual consistency?"**
   → [Eventual Consistency](./12-consistency/04-eventual-consistency.md)
   → Need: CAP theorem, CQRS, Event sourcing

5. **"Design Instagram feed"**
   → [Case Study](./08-case-studies/06-instagram-feed.md)
   → Need: Sharding, Caching, CDN, Message queues

### Technology Mapping

**Need caching?**
- In-memory: Redis, Memcached
- CDN: CloudFront, Cloudflare
- Application: Node-cache, LRU cache

**Need message queue?**
- Simple: BullMQ (Redis), AWS SQS
- Advanced: RabbitMQ, Apache Kafka
- Serverless: AWS SQS, Google Pub/Sub

**Need database?**
- SQL: PostgreSQL (most versatile), MySQL
- NoSQL: MongoDB (documents), Cassandra (wide-column)
- Cache: Redis, DynamoDB
- Time-series: ClickHouse, TimescaleDB

## 📊 Checklist: Production-Ready System

Before launching at scale, ensure you have:

### Tier 1 (Must Have)
- [ ] Database read replicas
- [ ] Caching layer (Redis/Memcached)
- [ ] Load balancer
- [ ] Basic monitoring (uptime, errors)
- [ ] HTTPS everywhere
- [ ] Input validation
- [ ] Error handling

### Tier 2 (Should Have)
- [ ] Message queue for async tasks
- [ ] CDN for static assets
- [ ] Database indexes
- [ ] Connection pooling
- [ ] Rate limiting
- [ ] Structured logging
- [ ] Health checks

### Tier 3 (Nice to Have)
- [ ] Database sharding
- [ ] Multi-region deployment
- [ ] Circuit breaker pattern
- [ ] Distributed tracing
- [ ] Auto-scaling
- [ ] Chaos engineering tests
- [ ] SLOs and SLIs

## 🎯 Next Steps

1. **Start Reading**: Pick your first article based on your goal
2. **Take Notes**: Keep a journal of key learnings
3. **Build Projects**: Apply concepts immediately
4. **Mock Interviews**: Practice explaining designs
5. **Iterate**: Come back and study advanced topics

## 💡 Pro Tips

1. **Don't memorize** - Understand WHY, not just WHAT
2. **Draw diagrams** - Practice on whiteboard/paper
3. **Think trade-offs** - Every decision has pros and cons
4. **Start simple** - Then add complexity as needed
5. **Learn from failures** - Study outage post-mortems
6. **Stay current** - Technology evolves, principles stay

## 📞 How to Get Help

- Review fundamentals if stuck on advanced topics
- Re-read articles multiple times (spaced repetition)
- Build small projects to internalize concepts
- Discuss designs with peers
- Search for real-world examples online

## 🌟 Recommended Reading Order

**If you're NEW to system design**:
1. Main [README](./README.md) - Overview
2. [Database Replication](./01-databases/01-replication-basics.md)
3. [Caching Fundamentals](./02-caching/01-caching-fundamentals.md)
4. [Message Queues](./03-queues/01-message-queue-basics.md)
5. [URL Shortener Case Study](./08-case-studies/01-url-shortener.md)

**If you're PREPARING for interviews**:
1. All 🟢 Beginner articles (1-2 weeks)
2. All case studies (1-2 weeks)
3. Key patterns: Circuit Breaker, Saga, CQRS
4. Practice designing 20+ systems

**If you're BUILDING a production system**:
1. Relevant topic READMEs
2. Specific articles for your needs
3. Related case studies
4. Performance and monitoring sections

---

**Ready to start?** Head to the [main README](./README.md) and pick your first article!

Good luck on your system design journey! 🚀
