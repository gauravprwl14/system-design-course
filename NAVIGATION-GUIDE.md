# 🗺️ Navigation Guide - Start Here!

Welcome to the System Design & Interview Prep Knowledge Base! This guide will help you navigate the content based on your goals.

---

## 🎯 Choose Your Path

### 1️⃣ I'm Learning System Design (New to the Topic)

**Start Here**: [README.md](./README.md) → [GETTING-STARTED.md](./GETTING-STARTED.md)

**First Articles to Read**:
1. [Database Replication Basics](./01-databases/01-replication-basics.md:1) - Understand master-slave replication
2. [Caching Fundamentals](./02-caching/01-caching-fundamentals.md:1) - Why caching matters
3. [Message Queue Basics](./03-queues/01-message-queue-basics.md:1) - Async processing patterns
4. [URL Shortener Case Study](./08-case-studies/01-url-shortener.md:1) - Complete system design

**Follow This Path**: Database → Caching → Queues → Load Balancing → Patterns → Case Studies

**Time Needed**: 30 days for comprehensive understanding

---

### 2️⃣ I Have an Interview Tomorrow

**Start Here**: [interview-prep/README.md](./interview-prep/README.md:1)

**Quick Prep (2-3 hours)**:
1. Read **Quick Answer** sections for your interview topics
2. Review relevant diagrams
3. Practice explaining in 2-3 minutes

**Topics by Company**:

**HDFC Interview**:
- [RSA vs AES](./interview-prep/01-security-encryption/01-rsa-vs-aes.md:1)
- [Hashing vs Encryption](./interview-prep/01-security-encryption/02-hashing-vs-encryption.md:1)
- [PDF Converter System](./interview-prep/03-system-design/01-pdf-converter.md:1)
- AWS services, disaster recovery
- Rate limiting, flash sales

**General Tech Interview**:
- All security encryption questions
- System design: URL Shortener, PDF Converter
- Database: Replication, Sharding, Indexing
- Caching strategies
- Message queues

**Time Needed**: 2-3 hours for quick review, 1-2 weeks for comprehensive prep

---

### 3️⃣ I'm Building a Production System

**Jump Directly to Relevant Topics**:

**Need Database Scaling?**
- [Read Replicas](./01-databases/02-read-replicas.md:1)
- [Sharding Strategies](./01-databases/03-sharding-strategies.md:1)
- [Indexing](./01-databases/04-indexing-strategies.md:1)

**Need Caching?**
- [Caching Fundamentals](./02-caching/01-caching-fundamentals.md:1)
- Cache invalidation patterns
- Redis best practices

**Need Async Processing?**
- [Message Queue Basics](./03-queues/01-message-queue-basics.md:1)
- Dead letter queues
- Retry strategies

**Need Reliability?**
- [Circuit Breaker Pattern](./07-patterns/01-circuit-breaker.md:1)
- Health checks
- Failover mechanisms

**Time Needed**: Reference as needed

---

### 4️⃣ I Want to Understand How Big Companies Do It

**Read Case Studies**:
1. [URL Shortener](./08-case-studies/01-url-shortener.md:1) - Like bit.ly, TinyURL
2. [PDF Converter](./interview-prep/03-system-design/01-pdf-converter.md:1) - Like iLovePDF
3. More coming: Instagram Feed, Twitter Timeline, Uber Backend

**Study Company Patterns**:
- **Instagram**: Sharding in [Database Sharding](./01-databases/03-sharding-strategies.md:1)
- **Netflix**: Circuit Breaker in [Circuit Breaker Pattern](./07-patterns/01-circuit-breaker.md:1)
- **Pinterest**: Caching in [Caching Fundamentals](./02-caching/01-caching-fundamentals.md:1)
- **Uber**: Geo-sharding in [Sharding Strategies](./01-databases/03-sharding-strategies.md:1)

---

## 📚 Content Organization

### System Design Knowledge Base (Main)

```
├── 01-databases/        → Replication, Sharding, Indexing
├── 02-caching/          → Redis, CDN, Strategies  
├── 03-queues/           → RabbitMQ, Kafka, Async
├── 04-load-balancing/   → Algorithms, Health Checks
├── 05-scalability/      → Horizontal/Vertical, Microservices
├── 06-performance/      → Optimization, Profiling
├── 07-patterns/         → Circuit Breaker, Retry, Saga
├── 08-case-studies/     → URL Shortener, etc.
├── 09-api-design/       → REST, GraphQL, Versioning
├── 10-monitoring/       → Metrics, Logging, Alerts
├── 11-security/         → OAuth, JWT, Encryption
└── 12-consistency/      → ACID, CAP, Eventual Consistency
```

### Interview Preparation (interview-prep/)

```
├── 01-security-encryption/   → RSA/AES, Hashing, MITM
├── 02-aws-cloud/             → S3, DR, Services
├── 03-system-design/         → PDF Converter, Rate Limiting
├── 04-database-storage/      → SQL/NoSQL, Scaling
├── 05-caching-cdn/           → Redis, CDN strategies
├── 06-auth/                  → JWT, Session, OAuth
├── 07-messaging/             → Kafka, RabbitMQ
├── 08-microservices/         → Migration, Patterns
├── 09-kubernetes/            → K8s errors, Pods
├── 10-performance/           → Flash Sales, Optimization
├── 11-monitoring-incidents/  → ELK, Root Cause
├── 12-spring-java/           → AOP, IOC, Annotations
├── 13-api-design/            → REST, CORS
└── 14-networking/            → Load Balancers, Proxies
```

---

## 🔍 Find Content By Topic

### Security & Encryption
- [RSA vs AES](./interview-prep/01-security-encryption/01-rsa-vs-aes.md:1)
- [Hashing vs Encryption](./interview-prep/01-security-encryption/02-hashing-vs-encryption.md:1)

### Database
- [Replication Basics](./01-databases/01-replication-basics.md:1)
- [Read Replicas](./01-databases/02-read-replicas.md:1)
- [Sharding Strategies](./01-databases/03-sharding-strategies.md:1)
- [Indexing for Performance](./01-databases/04-indexing-strategies.md:1)

### Caching
- [Caching Fundamentals](./02-caching/01-caching-fundamentals.md:1)

### Message Queues
- [Message Queue Basics](./03-queues/01-message-queue-basics.md:1)

### Design Patterns
- [Circuit Breaker](./07-patterns/01-circuit-breaker.md:1)

### System Design
- [URL Shortener](./08-case-studies/01-url-shortener.md:1)
- [PDF Converter](./interview-prep/03-system-design/01-pdf-converter.md:1)

---

## 📖 Reading Strategies

### Strategy 1: Sequential (Comprehensive Understanding)
1. Start with databases
2. Move to caching
3. Study queues
4. Learn patterns
5. Practice with case studies
**Time**: 30 days

### Strategy 2: Topic-Focused (Interview Prep)
1. Choose your interview topics
2. Read Quick Answers first
3. Study Detailed Explanations
4. Practice explaining
**Time**: 1-2 weeks

### Strategy 3: Just-In-Time (Building Systems)
1. Identify your problem
2. Jump to relevant section
3. Read implementation
4. Adapt to your needs
**Time**: As needed

---

## 🎯 Quick Reference

**Best First Article**: [Database Replication Basics](./01-databases/01-replication-basics.md:1)

**Most Comprehensive**: [Sharding Strategies](./01-databases/03-sharding-strategies.md:1)

**Most Practical**: [Caching Fundamentals](./02-caching/01-caching-fundamentals.md:1)

**Best Case Study**: [URL Shortener](./08-case-studies/01-url-shortener.md:1)

**Interview Essential**: [PDF Converter](./interview-prep/03-system-design/01-pdf-converter.md:1)

---

## 📊 Summary Documents

Want an overview before diving in?

1. [README.md](./README.md:1) - Main overview
2. [GETTING-STARTED.md](./GETTING-STARTED.md:1) - How to use this resource
3. [PROJECT-SUMMARY.md](./PROJECT-SUMMARY.md:1) - System design KB details
4. [interview-prep/README.md](./interview-prep/README.md:1) - Interview prep guide
5. [COMPLETE-PROJECT-SUMMARY.md](./COMPLETE-PROJECT-SUMMARY.md:1) - Everything created

---

## 🚀 Start Now!

**Choose your path above and start learning!**

- New to system design? → [README.md](./README.md:1)
- Interview tomorrow? → [interview-prep/README.md](./interview-prep/README.md:1)
- Building a system? → Jump to relevant topic
- Want everything? → [COMPLETE-PROJECT-SUMMARY.md](./COMPLETE-PROJECT-SUMMARY.md:1)

Good luck on your journey! 🎉
