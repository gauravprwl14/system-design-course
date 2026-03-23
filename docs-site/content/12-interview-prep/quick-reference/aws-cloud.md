---
title: "AWS & Cloud — Interview & Certification Guide"
layer: concept
section: interview-prep/aws-cloud
difficulty: intermediate
tags: [aws, interview, saa, solutions-architect, cloud]
---

# AWS & Cloud: Interview + Certification Quick Reference

> Covers the **80% of AWS knowledge** that shows up in system design interviews and the AWS Solutions Architect Associate (SAA-C03) exam. Each article is built around real interview questions — not textbook definitions.

## How to Use This Section

**For System Design Interviews**: You'll be asked to pick services and justify your choices. Focus on decision frameworks — "when ALB vs NLB", "SQS vs Kinesis vs Kafka", "RDS Multi-AZ vs Read Replicas".

**For AWS SAA Certification**: Exam tips are embedded in every article. Key numbers, gotchas, and the classic traps are called out explicitly.

**The SA Mental Model**: Every article teaches you to ask: *Why this service? What happens when it fails? How does it scale? What does it cost?*

---

## Networking & Identity (Start Here)

| Article | Core Interview Question | SAA Exam Weight |
|---------|------------------------|-----------------|
| [VPC & Networking](vpc-networking) | "Design the VPC for a 3-tier app" | ⭐⭐⭐⭐⭐ High |
| [IAM Roles & Policies](iam-roles-policies) | "How does EC2 get S3 access without credentials?" | ⭐⭐⭐⭐⭐ High |
| [Route 53 & DNS](route53-dns) | "Multi-region failover with auto-DNS cutover?" | ⭐⭐⭐⭐ High |

**Why start here**: VPC and IAM underpin everything. You can't design an AWS architecture without understanding subnets, security groups, and roles. Route 53 is the global traffic manager for multi-region systems.

---

## Compute & Containers

| Article | Core Interview Question | SAA Exam Weight |
|---------|------------------------|-----------------|
| [EC2 Instances](ec2-instances) | "Which instance type and purchase option for this workload?" | ⭐⭐⭐⭐ High |
| [Auto Scaling (ASG)](auto-scaling) | "How do you handle flash sale traffic spikes?" | ⭐⭐⭐⭐ High |
| [ECS / EKS / Fargate](ecs-eks-fargate) | "ECS vs EKS vs Fargate — when is each right?" | ⭐⭐⭐ Medium |
| [Lambda & Serverless](lambda-serverless) | "Lambda vs EC2? Cold starts? Max concurrency?" | ⭐⭐⭐⭐ High |
| [API Gateway](api-gateway) | "REST vs HTTP API? Rate limiting? Auth options?" | ⭐⭐⭐ Medium |

**Key decision**: EC2 (control) → Fargate (no infra) → Lambda (event-driven). Each step trades control for simplicity.

---

## Storage & CDN

| Article | Core Interview Question | SAA Exam Weight |
|---------|------------------------|-----------------|
| [S3 TPS & Performance](s3-tps-limits) | "S3 is throttling at 3,500/s — how do you scale?" | ⭐⭐⭐ Medium |
| [CloudFront & CDN](cloudfront-cdn) | "How do you serve a global app with low latency?" | ⭐⭐⭐⭐ High |

**Key insight**: S3 + CloudFront is the standard pattern for global static content. CloudFront sits in front of API Gateway for dynamic content too.

---

## Databases & Caching

| Article | Core Interview Question | SAA Exam Weight |
|---------|------------------------|-----------------|
| [RDS & Aurora](rds-databases) | "Multi-AZ vs Read Replicas — what's the difference?" | ⭐⭐⭐⭐⭐ High |
| [DynamoDB](dynamodb-nosql) | "How do you pick a partition key? Single-table design?" | ⭐⭐⭐⭐ High |
| [ElastiCache & Redis](elasticache-redis) | "How do you prevent thundering herd after cache expiry?" | ⭐⭐⭐ Medium |

**The #1 interview trap**: Multi-AZ is for **high availability** (automatic failover). Read Replicas are for **read performance**. They are not the same thing.

---

## Messaging & Streaming

| Article | Core Interview Question | SAA Exam Weight |
|---------|------------------------|-----------------|
| [SQS / SNS / EventBridge](sqs-sns-eventbridge) | "Order placed — how do you notify email, inventory, analytics?" | ⭐⭐⭐⭐ High |
| [Kinesis Streaming](kinesis-streaming) | "1M IoT events/sec with real-time processing — architecture?" | ⭐⭐⭐ Medium |

**Decision rule**: SQS (reliable delivery, one consumer), SNS (fan-out to multiple subscribers), EventBridge (complex routing, cross-account), Kinesis (ordered streaming, replay, analytics).

---

## Observability & Load Balancing

| Article | Core Interview Question | SAA Exam Weight |
|---------|------------------------|-----------------|
| [CloudWatch Monitoring](cloudwatch-monitoring) | "How do you set up alerts for P99 latency spikes?" | ⭐⭐⭐⭐ High |
| [Load Balancers (ALB/NLB)](load-balancer) | "ALB vs NLB — when does layer matter?" | ⭐⭐⭐⭐ High |

---

## Architecture & Strategy

| Article | Core Interview Question | SAA Exam Weight |
|---------|------------------------|-----------------|
| [Disaster Recovery](disaster-recovery) | "RPO=1min, RTO=5min for a financial system — design it" | ⭐⭐⭐⭐ High |
| [Well-Architected Framework](aws-well-architected) | "How do you cut $20K/month from an AWS bill?" | ⭐⭐⭐ Medium |

---

## Critical Numbers to Memorize

These appear in both interviews and the SAA exam:

### S3
- 3,500 PUT/s per prefix, 5,500 GET/s per prefix
- Max object size: 5TB (multipart required >5GB)

### Lambda
- Max execution: 15 minutes
- Default concurrency: 1,000 per region
- Max memory: 10,240 MB

### SQS
- Standard: unlimited throughput, at-least-once
- FIFO: 300 TPS (3,000 with batching), exactly-once
- Max message: 256KB, retention: 14 days
- Visibility timeout: max 12 hours

### Kinesis
- 1 MB/s write per shard, 2 MB/s read per shard
- Enhanced fan-out: dedicated 2 MB/s per consumer per shard
- Max record: 1 MB, default retention: 24 hours (max 365 days)

### RDS
- Multi-AZ failover: ~1–2 minutes
- Read replicas: up to 5 (MySQL/PostgreSQL), 15 (Aurora)
- Max connections RDS proxy handles: pooled (critical for Lambda)

### DynamoDB
- Max item size: 400 KB
- GSI: different partition key (eventually consistent reads)
- LSI: same partition key, must be created at table creation

### EC2 Placement Groups
- Cluster: single AZ, 100Gbps, HPC workloads
- Spread: max 7 instances per AZ, critical fault isolation
- Partition: up to 7 partitions per AZ, Kafka/Cassandra

### VPC
- Max VPC peering: non-transitive (A↔B, B↔C does NOT mean A↔C)
- NAT Gateway: $0.045/hour + $0.045/GB — use VPC endpoints for S3/DynamoDB (free)
- Security Groups: stateful. NACLs: stateless (need both inbound AND outbound rules)

---

## Top 10 Interview Traps

1. **Multi-AZ ≠ Read Replica** — HA failover vs read scaling
2. **Security Groups are stateful, NACLs are stateless** — return traffic rules differ
3. **VPC Peering is non-transitive** — 10 VPCs = 45 peering connections; use Transit Gateway
4. **ALB needs OAC for S3, not OAI** (OAI is legacy)
5. **ACM certificate must be in us-east-1 for CloudFront** (even if your app is in us-west-2)
6. **Lambda authorizer results ARE cached** — stale permissions up to TTL seconds
7. **SQS FIFO has 300 TPS limit** — don't use for high-throughput scenarios
8. **LSI must be created at table creation** — GSI can be added later
9. **RDS Proxy is critical for Lambda** — without it, Lambda creates a new DB connection per invocation
10. **Spot instances get 2-minute warning** — must checkpoint or use with SQS for retries

---

## Quick Architecture Patterns

### Pattern 1: Serverless API (Low Traffic, Variable Load)
```
Route 53 → CloudFront → API Gateway (HTTP API) → Lambda → DynamoDB + ElastiCache
```

### Pattern 2: High-Traffic Web App (Consistent Load)
```
Route 53 → CloudFront → ALB → ECS Fargate (ASG) → RDS Aurora + ElastiCache
```
*EC2 instead of Fargate if you need GPU, instance store, or SSH access*

### Pattern 3: Event-Driven Microservices
```
API Gateway → Lambda → SNS → [SQS → Lambda/ECS per service]
                            → EventBridge → cross-account routing
```

### Pattern 4: Real-Time Data Pipeline
```
Kinesis Data Streams → Lambda (real-time alerts)
                     → Kinesis Firehose → S3 → Athena (batch analytics)
                     → Kinesis Analytics → OpenSearch (dashboards)
```

### Pattern 5: Multi-Region Active-Active
```
Route 53 (latency routing) → [us-east-1: ALB → ECS → Aurora primary]
                           → [eu-west-1: ALB → ECS → Aurora global cluster replica]
DynamoDB Global Tables for session/user data
```

---

## SAA-C03 Exam Coverage Map

| Domain | Weight | Key Articles |
|--------|--------|-------------|
| Design Resilient Architectures | 26% | VPC, Route 53, Disaster Recovery, RDS Multi-AZ |
| Design High-Performing Architectures | 24% | EC2, Auto Scaling, ElastiCache, CloudFront, DynamoDB |
| Design Secure Architectures | 30% | IAM, VPC, API Gateway auth, S3 encryption |
| Design Cost-Optimized Architectures | 20% | Well-Architected, EC2 purchase options, S3 storage classes |
