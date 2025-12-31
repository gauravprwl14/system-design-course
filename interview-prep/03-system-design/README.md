# System Design Questions - Interview Prep

## 📋 Questions Covered

1. [Design PDF Converter System (like iLovePDF)](./01-pdf-converter.md) ⭐ Most Asked
2. [Design Rate Limiting System](./02-rate-limiting.md)
3. [Design Flash Sale System](./03-flash-sales.md)
4. [Design Content Management System](./04-cms-design.md)
5. [Design High-Concurrency API](./05-high-concurrency-api.md)
6. [Design Document Upload & Processing](./06-document-processing.md)

## 🎯 Interview Approach

### 45-Minute System Design Template

**1. Requirements Clarification (5 min)**
- Functional requirements
- Non-functional requirements
- Scale estimates
- Out of scope

**2. High-Level Design (10 min)**
- Draw architecture diagram
- Identify main components
- Data flow

**3. Deep Dive (20 min)**
- Database schema
- API design
- Scaling strategy
- Edge cases

**4. Trade-offs (5 min)**
- Discuss alternatives
- Cost vs performance
- Consistency vs availability

**5. Q&A (5 min)**
- Monitoring
- Security
- Future improvements

## 💡 Common System Design Patterns

### Load Handling
- Load balancers (Nginx, HAProxy)
- Auto-scaling
- CDN for static content
- Caching (Redis)

### Async Processing
- Message queues (RabbitMQ, Kafka, SQS)
- Worker pools
- Job scheduling
- Dead letter queues

### Data Storage
- SQL for structured data
- NoSQL for flexibility
- S3 for files
- Redis for cache

### Reliability
- Circuit breakers
- Retries with exponential backoff
- Rate limiting
- Health checks

Start with: [PDF Converter System Design](./01-pdf-converter.md)
