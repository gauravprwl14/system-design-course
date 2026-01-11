# System Design Questions - Interview Prep

## 📋 Questions Covered

### Fundamentals
1. [Design PDF Converter System (like iLovePDF)](/interview-prep/system-design/pdf-converter) ⭐ Most Asked
2. [Design Rate Limiting System](/interview-prep/system-design/rate-limiting)
3. [Design Flash Sale System](/interview-prep/system-design/flash-sales)
4. [Design Content Management System](/interview-prep/system-design/cms-design)
5. [Design High-Concurrency API](/interview-prep/system-design/high-concurrency-api)

### Real-World Scalability (NEW 🔥)
6. [Video Streaming Platform (Netflix/YouTube Scale)](/interview-prep/system-design/video-streaming-platform) - 200M+ concurrent users
7. [WebSocket Real-Time Systems (Slack/Discord)](/interview-prep/system-design/websocket-architecture) - 10M+ connections
8. [Video Conferencing (Zoom/Google Meet)](/interview-prep/system-design/video-conferencing) - 300M+ daily participants

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

## 🎯 Quick Reference

| System | Scale | Key Challenge | Tech Stack |
|--------|-------|---------------|------------|
| [PDF Converter](/interview-prep/system-design/pdf-converter) | 1M jobs/day | Async processing | SQS, Lambda, S3 |
| [Rate Limiting](/interview-prep/system-design/rate-limiting) | 100K req/s | Request throttling | Redis, Token Bucket |
| [Flash Sales](/interview-prep/system-design/flash-sales) | 1M concurrent users | Inventory consistency | Redis, Queue, DB |
| [CMS](/interview-prep/system-design/cms-design) | 25K pages | Static generation | S3, CloudFront, API |
| [High-Concurrency API](/interview-prep/system-design/high-concurrency-api) | 10K req/s | Connection pooling | Load Balancer, Cache |
| [**Video Streaming**](/interview-prep/system-design/video-streaming-platform) | **200M+ users** | **CDN, transcoding** | **S3, CloudFront, SQS** |
| [**WebSocket Chat**](/interview-prep/system-design/websocket-architecture) | **10M+ connections** | **Cross-server routing** | **WebSocket, Redis Pub/Sub** |
| [**Video Conferencing**](/interview-prep/system-design/video-conferencing) | **300M+ participants** | **Real-time A/V** | **WebRTC, SFU, TURN** |

---

Start with: [PDF Converter System Design](/interview-prep/system-design/pdf-converter) or jump to [Real-World Scalability: Video Streaming](/interview-prep/system-design/video-streaming-platform)
