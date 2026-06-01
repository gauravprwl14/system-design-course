---
title: "Compute Sizing Reference — EC2, Lambda, Containers"
layer: reference
section: interview-prep/capacity-estimation/reference-tables
difficulty: intermediate
tags: [capacity-planning, aws, sizing, cost-estimation]
---

# Compute Sizing Reference — EC2, Lambda, Containers

Quick reference for capacity planning interviews. Numbers reflect 2024/2025 AWS pricing (us-east-1, on-demand Linux).

---

## 1. Quick Decision Table

| Scenario | Use This | Avoid |
|----------|----------|-------|
| Stateless API, steady traffic, cost-sensitive | `m6g` (ARM, ~20% cheaper) | `t3` (burstable — unpredictable under load) |
| CPU-bound workload (encoding, ML inference, compression) | `c6i` or `c6g` | `m5` (over-pays for memory you won't use) |
| In-memory DB, large JVM heap, caching layer | `r6g` or `r5` | `m5` (runs OOM at scale) |
| Spiky / event-driven (0 → peak in seconds) | Lambda | EC2 (warm-up time kills P99) |
| Batch / nightly jobs, cost-sensitive burst | Spot + `c6i` | On-demand (3x cost for same work) |
| Microservice with predictable CPU, container packing | ECS/EKS on `m6i` | Dedicated instance per service |
| < 15 min execution, fan-out parallelism | Lambda | ECS (container overhead not worth it) |
| > 15 min, stateful, large binary/package | ECS Fargate or EC2 | Lambda (hard timeout, 10 GB pkg limit) |

---

## 2. EC2 Instance Families

### General Purpose (balanced CPU:RAM ~1:4)

| Instance | vCPU | RAM | Network | On-Demand/mo | Est. API RPS* |
|----------|------|-----|---------|-------------|--------------|
| t3.medium | 2 | 4 GB | Up to 5 Gbps | ~$30 | 500–1,000 (burstable) |
| t3.xlarge | 4 | 16 GB | Up to 5 Gbps | ~$120 | 1,500–2,500 (burstable) |
| m5.large | 2 | 8 GB | Up to 10 Gbps | ~$70 | 1,500–2,000 |
| **m5.xlarge** | **4** | **16 GB** | Up to 10 Gbps | **~$140** | **3,000–5,000** |
| m5.2xlarge | 8 | 32 GB | Up to 10 Gbps | ~$280 | 6,000–10,000 |
| m5.4xlarge | 16 | 64 GB | Up to 10 Gbps | ~$560 | 12,000–18,000 |
| m6i.xlarge | 4 | 16 GB | Up to 12.5 Gbps | ~$152 | 3,500–5,500 |
| m6g.xlarge (ARM) | 4 | 16 GB | Up to 10 Gbps | ~$124 | 3,000–5,000 |
| m6g.2xlarge (ARM) | 8 | 32 GB | Up to 10 Gbps | ~$248 | 6,000–10,000 |

*RPS estimates for a typical Go/Java REST API with 5–20 ms handler time and no external I/O bottleneck.

### Compute Optimized (CPU:RAM ~1:2)

| Instance | vCPU | RAM | Network | On-Demand/mo | Est. API RPS* |
|----------|------|-----|---------|-------------|--------------|
| c5.large | 2 | 4 GB | Up to 10 Gbps | ~$62 | 2,000–3,500 |
| **c5.xlarge** | **4** | **8 GB** | Up to 10 Gbps | **~$124** | **5,000–8,000** |
| c5.2xlarge | 8 | 16 GB | Up to 10 Gbps | ~$248 | 10,000–16,000 |
| c5.4xlarge | 16 | 32 GB | Up to 10 Gbps | ~$496 | 20,000–30,000 |
| c6i.xlarge | 4 | 8 GB | Up to 12.5 Gbps | ~$136 | 5,500–9,000 |
| c6g.xlarge (ARM) | 4 | 8 GB | Up to 10 Gbps | ~$109 | 5,000–8,000 |
| c6g.2xlarge (ARM) | 8 | 16 GB | Up to 10 Gbps | ~$218 | 10,000–16,000 |

### Memory Optimized (CPU:RAM ~1:8 to 1:32)

| Instance | vCPU | RAM | Network | On-Demand/mo | Use Case |
|----------|------|-----|---------|-------------|---------|
| r5.large | 2 | 16 GB | Up to 10 Gbps | ~$90 | Redis-like, JVM heap |
| r5.xlarge | 4 | 32 GB | Up to 10 Gbps | ~$181 | In-memory analytics |
| r5.2xlarge | 8 | 64 GB | Up to 10 Gbps | ~$362 | Large dataset caching |
| r5.4xlarge | 16 | 128 GB | Up to 10 Gbps | ~$724 | ElasticSearch, Cassandra |
| r6g.xlarge (ARM) | 4 | 32 GB | Up to 10 Gbps | ~$145 | Cost-optimized memory |
| r6g.4xlarge (ARM) | 16 | 128 GB | Up to 10 Gbps | ~$580 | Large in-memory workloads |
| x1e.xlarge | 4 | 122 GB | Up to 10 Gbps | ~$1,000 | SAP HANA, in-memory DB |
| x1e.8xlarge | 32 | 976 GB | 10 Gbps | ~$8,000 | Extreme in-memory (rare) |

---

## 3. AWS Lambda

### Pricing (2025)

| Dimension | Value |
|-----------|-------|
| Requests | $0.20 per 1M requests |
| Duration | $0.0000166667 per GB-second |
| Free tier | 1M requests + 400,000 GB-seconds/month |
| Effective cost at 128 MB / 100 ms | ~$0.0000000021 per invocation |
| Effective cost at 1 GB / 1 s | ~$0.0000167 per invocation |

### Lambda Limits

| Limit | Value |
|-------|-------|
| Max memory | 10,240 MB (10 GB) |
| Max execution time | 15 minutes |
| Default concurrency per region | 1,000 (soft limit, raiseable) |
| Burst limit | 3,000 initial, then +500/min |
| Cold start (JVM/Node bundled) | 500 ms – 3 s |
| Cold start (Python/Node slim) | 50–300 ms |
| Cold start (SnapStart / GraalVM) | < 100 ms |
| Deployment package (zip) | 50 MB zipped / 250 MB unzipped |
| Container image | Up to 10 GB |
| Max concurrent executions (reserved) | Configurable per function |

### Lambda vs EC2 Break-Even

```
Monthly cost crossover (rough):
  Lambda @ 128 MB, 200 ms avg:
    1M req/day × 30 = 30M req/month = ~$6/month (+ duration ~$0.10)

  t3.small (2 vCPU, 2 GB) on-demand: ~$15/month @ 100% utilization

Break-even: ~40M–50M requests/month depending on duration.
Above 50M req/month and >200ms avg, EC2/Fargate typically wins on cost.
```

---

## 4. ECS / EKS Container Sizing

### Container Density per Instance

| Host Instance | Container Size | Containers per Host | Notes |
|---------------|---------------|---------------------|-------|
| m5.xlarge (4 vCPU, 16 GB) | 0.5 vCPU / 1 GB | ~12–14 | Leave 20% overhead for OS/kubelet |
| m5.2xlarge (8 vCPU, 32 GB) | 0.5 vCPU / 1 GB | ~24–28 | |
| m5.xlarge | 1 vCPU / 2 GB | ~6–7 | Typical microservice |
| m5.2xlarge | 1 vCPU / 2 GB | ~12–14 | |
| c5.2xlarge (8 vCPU, 16 GB) | 1 vCPU / 1 GB | ~12–14 | CPU-bound services |

### ECS Fargate Task Sizing

| Task Config | vCPU Options | Memory Options | On-Demand $/hr |
|-------------|-------------|----------------|----------------|
| Micro | 0.25 | 0.5–2 GB | ~$0.012 |
| Small | 0.5 | 1–4 GB | ~$0.024 |
| Medium | 1 | 2–8 GB | ~$0.048 |
| Large | 2 | 4–16 GB | ~$0.096 |
| XLarge | 4 | 8–30 GB | ~$0.192 |

```
Fargate pricing formula:
  vCPU-hour × $0.04048 + GB-hour × $0.004445
  Example: 1 vCPU / 2 GB task running 1 hour = $0.04048 + $0.00889 = ~$0.050/hr
```

### Kubernetes Node Sizing Guidelines

| Workload Type | Recommended Node | Pod Request (CPU/Mem) | Max Pods per Node |
|---------------|------------------|----------------------|-------------------|
| Stateless API | m6i.xlarge | 250m / 256Mi | 30–40 |
| Stateful service | r5.xlarge | 500m / 1Gi | 15–20 |
| Batch jobs | c6i.2xlarge | 1000m / 512Mi | 15 |
| ML inference | c5.4xlarge (or inf1) | 2000m / 4Gi | 6–8 |

Rule of thumb: EKS `kube-reserved` + `system-reserved` eats ~0.5 vCPU + 1 GB per node.

---

## 5. Sizing Formulas

### Formula 1: Required Instances for Target RPS

```
instances_needed = ceil(peak_rps / (rps_per_instance × (1 - headroom)))

Where:
  peak_rps       = your traffic peak (e.g., 50,000 RPS)
  rps_per_instance = from table above (e.g., 5,000 for c5.xlarge)
  headroom       = 0.30 (keep 30% spare for spikes)

Example:
  50,000 RPS / (5,000 × 0.70) = 50,000 / 3,500 = ~15 c5.xlarge instances
  Monthly cost: 15 × $124 = $1,860/month on-demand
  With 1-yr reserved: ~$1,300/month (30% savings)
```

### Formula 2: Memory Sizing for Java/JVM Services

```
container_memory = heap_size × 1.5 + 512 MB (non-heap, metaspace, JIT)

Example: app needs 2 GB heap
  container_memory = 2 GB × 1.5 + 0.5 GB = 3.5 GB → round to 4 GB
  Task size: 1 vCPU / 4 GB
```

### Formula 3: Lambda Concurrency Estimate

```
required_concurrency = (requests_per_second × avg_duration_seconds)

Example: 1,000 RPS × 0.2 s avg = 200 concurrent executions
  Default limit: 1,000 → comfortable
  At 5,000 RPS: 5,000 × 0.2 = 1,000 concurrent → at the default limit, request increase
```

### Formula 4: Auto Scaling Target

```
# For CPU-based scaling:
target_cpu = 60–70% (leave room for traffic bursts before new instance is ready)

# Scale-out trigger:
  - Stateless API: CPU > 65% sustained 2 min
  - Memory-bound: Memory > 75% sustained 3 min

# Scale-in cooldown: 300 s (avoid thrashing)
```

---

## 6. Auto Scaling Strategies

| Strategy | When to Use | Config |
|----------|------------|--------|
| **Target Tracking** | Most APIs (simplest) | `TargetValue: 60` (CPU%), scale-in cooldown 300 s |
| **Step Scaling** | Need fine-grained response at thresholds | Step 1: +2 at 60%, Step 2: +5 at 80% |
| **Scheduled Scaling** | Known traffic patterns (daily spike, end-of-month batch) | Set `DesiredCapacity` via cron expression |
| **Predictive Scaling** | ML-predicted load, 1-week history required | AWS Auto Scaling Predictive mode |
| **SQS-based scaling** (KEDA/custom) | Worker pools draining queues | Scale on `ApproximateNumberOfMessagesVisible` |

### Scaling Thresholds — When to Move Up

| Current Instance | Scale Trigger | Next Tier |
|-----------------|--------------|-----------|
| m5.xlarge at >70% CPU | Can't auto-scale further cost-effectively | m5.2xlarge or add instances |
| t3 series any size | Sustained CPU (not burst) > 40% | Move to m5/m6i — t3 credits exhaust |
| r5.xlarge RAM > 80% | OOM risk | r5.2xlarge |
| Lambda 128 MB OOM | Out-of-memory errors | Bump to 256 or 512 MB (also speeds up — more CPU) |
| Lambda p99 > 1 s cold start | User-facing latency SLA miss | Enable SnapStart (Java) or provisioned concurrency |

---

## 7. Cost Optimization

### Pricing Tiers

| Commitment | Savings vs On-Demand | Trade-off |
|------------|---------------------|-----------|
| On-Demand | Baseline | Full flexibility |
| 1-yr Reserved (no upfront) | ~30% | Commit to instance family |
| 1-yr Reserved (all upfront) | ~37% | Lock capital |
| 3-yr Reserved (all upfront) | ~57% | Very long commitment |
| Savings Plans (Compute) | ~66% max | Flexible across family/region |
| Spot Instances | 50–90% | Interruption possible (2 min notice) |

### Cost Rules of Thumb

- **Reserved/Savings Plans** for baseline (70–80% of capacity): saves 30–40% immediately
- **Spot** for stateless, fault-tolerant batch/ML training: saves 60–80%
- **Graviton (ARM) instances** (m6g, c6g, r6g): 10–20% cheaper AND faster for most workloads
- **Lambda Compute Savings Plan**: 17% off Lambda duration, no commitment needed for small workloads
- **Right-size first**: A single tier down (e.g., m5.2xlarge → m5.xlarge × 2) often saves 20% with better fault isolation
- **Fargate Spot**: 50–70% discount for interruptible tasks (batch, async workers)

---

## 8. Common Mistakes

### Mistake 1: Using t3 instances for production APIs

**Problem**: t3 instances use CPU credits. Under sustained load (>30 min), credits exhaust and CPU throttles to baseline (10–30% of vCPU). P99 latency spikes 5–10x.

**Fix**: Use t3 only for dev/staging. Switch to m5/m6g for any production traffic > 100 RPS sustained.

**Detection**: Watch `CPUCreditBalance` CloudWatch metric. If it hits 0, you're throttled.

---

### Mistake 2: Not accounting for Lambda cold starts in SLAs

**Problem**: Lambda cold start for a JVM service (Spring Boot) = 2–5 s. If P99 SLA is 500 ms, Lambda violates it on every cold start.

**Fix**:
- Use **Provisioned Concurrency** for latency-critical functions (~$0.015/GB-hr extra).
- Use **SnapStart** (Java Lambda) for sub-100 ms cold starts.
- Switch to lightweight runtimes (Python, Node, Rust) if possible: 50–200 ms cold start.
- Or use ECS/EKS if warm instances are cheaper than provisioned concurrency at your scale.

---

### Mistake 3: Ignoring memory/CPU ratio when picking instance family

**Problem**: A service with 512 MB heap but heavy computation on `r5.xlarge` (4 vCPU / 32 GB) — you're paying for 28 GB of unused RAM.

**Fix**: Match the ratio.
- CPU-bound (encoding, parsing) → c family (1:2 ratio)
- Memory-bound (cache, large dataset) → r family (1:8 ratio)
- Balanced API → m family (1:4 ratio)

Rough check: if RAM utilization < 40% and CPU > 60%, downgrade to compute-optimized family.

---

### Mistake 4: Over-provisioning containers without setting resource requests/limits

**Problem**: In Kubernetes, containers without requests/limits get scheduled on any node. One noisy-neighbor container starves others. P99 becomes unpredictable.

**Fix**:
- Always set `requests` (scheduling) and `limits` (enforcement).
- Use `requests.cpu = 50–80% of limits.cpu` for burstable services.
- Use `requests.memory = limits.memory` for memory (prevents OOM kill cascades).

---

### Mistake 5: Planning capacity at average load, not peak

**Problem**: "Our average is 1,000 RPS so m5.xlarge handles it." Peaks hit 8,000 RPS during product launches → site down.

**Fix**: Size for `P99 peak × 1.3 headroom`. Use CloudWatch percentile metrics (`p99`, not `Average`). Always ask: "What is the 10x traffic scenario?"

---

## 9. Interview Cheat Sheet

```
Key numbers to memorize:
  m5.xlarge    → ~3,000–5,000 RPS for typical REST API
  c5.xlarge    → ~5,000–8,000 RPS for CPU-bound work
  Lambda       → 1,000 default concurrency limit per region
  Lambda       → 15 min max timeout
  Lambda       → cold start: 50 ms (Python/Node) to 3 s (JVM)
  Reserved     → ~30–40% savings vs on-demand (1-yr)
  Spot         → 50–90% savings, 2 min interruption notice
  Graviton/ARM → 10–20% cheaper than x86 equivalents

Sizing formula:
  instances = ceil(peak_rps / (rps_per_instance × 0.70))

Lambda concurrency:
  concurrent_executions = RPS × avg_duration_seconds
```

---

## References

- 📚 [AWS EC2 Instance Types](https://aws.amazon.com/ec2/instance-types/) — Official instance family specs
- 📚 [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/) — Current pricing and free tier details
- 📖 [AWS Compute Optimizer](https://aws.amazon.com/compute-optimizer/) — Automated right-sizing recommendations
- 📖 [EC2 Auto Scaling Documentation](https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html) — Scaling strategies and configuration
- 📺 [AWS re:Invent: Cost Optimization at Scale](https://www.youtube.com/results?search_query=aws+reinvent+cost+optimization+ec2) — Patterns used by large AWS customers
