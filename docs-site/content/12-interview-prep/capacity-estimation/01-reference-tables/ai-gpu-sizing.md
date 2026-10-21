---
title: "AI/GPU Sizing Reference — EC2 GPU, SageMaker, Bedrock, Inferentia"
layer: reference
section: interview-prep/capacity-estimation/reference-tables
difficulty: intermediate
tags: [capacity-planning, aws, sizing, cost-estimation]
category: architecture
---

# AI/GPU Sizing Reference — EC2 GPU, SageMaker, Bedrock, Inferentia

## Quick Decision Table

| Use This | When |
|----------|------|
| **g5.xlarge** | Llama-7B/13B inference, dev/test, &lt;500 concurrent users, $1/hr budget |
| **p4d.24xlarge** | GPT-3-sized (175B) model inference or fine-tuning, batch jobs |
| **p3.2xlarge** | BERT/smaller fine-tuning runs, vision model training, lower budget |
| **SageMaker Real-Time** | Managed auto-scaling endpoints, no infra ops, spiky traffic |
| **SageMaker Batch Transform** | Offline scoring, millions of records, no latency requirement |
| **Bedrock (Claude/Titan)** | No GPU infra, unpredictable traffic, start-up phase, per-token billing |
| **Inferentia2 (inf2)** | High-volume production inference, cost reduction from GPU, stable throughput |
| **Spot Instances** | Fault-tolerant batch training, checkpointing enabled, 60-70% savings |

---

## EC2 GPU Instance Families

### GPU Instances — Full Reference

| Instance | GPU | GPU Count | GPU VRAM | vCPU | RAM | On-Demand ($/hr) | Best For |
|----------|-----|-----------|----------|------|-----|-----------------|----------|
| `g5.xlarge` | A10G | 1 | 24 GB | 4 | 16 GB | $1.01 | Llama-7B inference, fine-tuning small models |
| `g5.12xlarge` | A10G | 4 | 96 GB | 48 | 192 GB | $5.67 | Llama-30B inference, multi-GPU fine-tuning |
| `g5.48xlarge` | A10G | 8 | 192 GB | 192 | 768 GB | $16.29 | Llama-65B inference, large batch training |
| `p3.2xlarge` | V100 | 1 | 16 GB | 8 | 61 GB | $3.06 | BERT fine-tuning, vision training |
| `p3.8xlarge` | V100 | 4 | 64 GB | 32 | 244 GB | $12.24 | Mid-size model training |
| `p3.16xlarge` | V100 | 8 | 128 GB | 64 | 488 GB | $24.48 | Large model fine-tuning |
| `p4d.24xlarge` | A100 | 8 | 320 GB | 96 | 1152 GB | $32.77 | GPT-3-size inference, LLM training |
| `p5.48xlarge` | H100 | 8 | 640 GB | 192 | 2048 GB | $98.32 | Frontier model training, largest inference |
| `inf2.xlarge` | Inferentia2 | 1 chip | 32 GB | 4 | 16 GB | $0.76 | High-volume inference, cost-optimized |
| `inf2.48xlarge` | Inferentia2 | 12 chips | 384 GB | 192 | 768 GB | $12.98 | Large model production inference |

> Prices are us-east-1 on-demand as of 2024/2025. Reserved 1-year saves ~30-40%; spot 60-70%.

---

## LLM Inference Sizing

### Model-to-Instance Mapping

| Model Size | Parameters | Min GPU VRAM | Recommended Instance | Tokens/sec | Cost/hr | Cost/1M tokens |
|-----------|------------|-------------|---------------------|------------|---------|----------------|
| Llama-7B (FP16) | 7B | 14 GB | g5.xlarge | 100–200 | $1.01 | ~$1.40–2.80 |
| Llama-13B (FP16) | 13B | 26 GB | g5.12xlarge (1 GPU) | 60–100 | $1.42* | ~$3.90–6.60 |
| Llama-30B (FP16) | 30B | 60 GB | g5.12xlarge (4 GPU) | 40–70 | $5.67 | ~$22–40 |
| Llama-70B (FP16) | 70B | 140 GB | 4×A100 (p4d partial) | 30–50 | $12–16 | ~$65–145 |
| GPT-3 size (175B) | 175B | 350 GB | p4d.24xlarge | 20–40 | $32.77 | ~$225–455 |
| Llama-7B (INT8) | 7B | 7 GB | g5.xlarge | 150–250 | $1.01 | ~$1.12–1.90 |
| Llama-70B (INT4) | 70B | 35 GB | g5.12xlarge | 40–70 | $5.67 | ~$22–40 |

> `*` Single A10G used via model parallelism. Quantization (INT8/INT4) halves VRAM requirements with ~5-10% quality loss.

### VRAM Rule of Thumb

```
VRAM needed (FP16) = parameters × 2 bytes
VRAM needed (INT8) = parameters × 1 byte
VRAM needed (INT4) = parameters × 0.5 bytes

Add 20% overhead for KV cache at batch_size=8, sequence_length=2048

Example — Llama-70B FP16:
  70B × 2 = 140 GB + 20% = ~168 GB → 2×A100 (2×80GB) minimum
```

---

## Training vs Inference — Key Distinction

| Dimension | Training | Inference |
|-----------|----------|-----------|
| GPU memory | 10-100x more (activations, gradients, optimizer states) | Model weights only (+KV cache) |
| Batch size | Large (512-4096) for throughput | Small (1-32) for latency |
| Duration | Hours to weeks | Milliseconds per request |
| Cost pattern | One-time per run | Ongoing per request |
| Instance type | p3/p4d/p5 | g5/inf2 (cheaper) |
| Adam optimizer overhead | 3× model size (weights + gradient + momentum) | None |

**Memory formula for training (AdamW):**
```
GPU memory = model_weights × 4     (FP16 weights × 2 + FP32 master copy × 2)
           + gradients × 2          (FP16)
           + optimizer_states × 8   (FP32 momentum + variance)
           + activations            (batch-dependent, often 2-4× model size)

Llama-7B training: 7B×16 bytes ≈ 112 GB minimum → 2×A100 or 8×V100
```

---

## SageMaker Real-Time Endpoints

### Instance Recommendations

| Use Case | SageMaker Instance | vCPU | GPU | On-Demand ($/hr) | Notes |
|----------|-------------------|------|-----|-----------------|-------|
| Small NLP (BERT) | ml.g5.xlarge | 4 | 1×A10G 24GB | $1.41 | Includes SageMaker overhead |
| Llama-7B inference | ml.g5.2xlarge | 8 | 1×A10G 24GB | $2.03 | Headroom for batching |
| Llama-70B inference | ml.p4d.24xlarge | 96 | 8×A100 | $37.69 | Highest throughput |
| Vision models (ResNet/ViT) | ml.g5.xlarge | 4 | 1×A10G | $1.41 | Image classification |
| CPU-only (distilBERT) | ml.m5.xlarge | 4 | — | $0.23 | Quantized/small models |

**SageMaker pricing = EC2 price + ~10-15% SageMaker overhead**

**SageMaker Invocation Pricing (additional):**
- $0.016 per hour for each ml instance running
- No per-invocation charge for real-time endpoints beyond instance cost

---

## Amazon Bedrock Per-Token Pricing

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Notes |
|-------|--------------------|--------------------|-------|
| Claude 3 Haiku | $0.25 | $1.25 | Fastest, cheapest Claude |
| Claude 3 Sonnet | $3.00 | $15.00 | Balanced quality/cost |
| Claude 3 Opus | $15.00 | $75.00 | Highest capability |
| Claude 3.5 Sonnet | $3.00 | $15.00 | Improved Sonnet |
| Amazon Titan Text Lite | $0.30 | $0.40 | AWS-native, lower cost |
| Amazon Titan Text Express | $0.80 | $1.60 | More capable Titan |
| Llama 3 8B (via Bedrock) | $0.30 | $0.60 | Open-source via managed API |
| Llama 3 70B (via Bedrock) | $2.65 | $3.50 | Larger open-source model |

**When Bedrock beats self-hosting:**
- Traffic &lt; 500K tokens/day → Bedrock cheaper than dedicated instance
- Spiky/unpredictable traffic → No idle GPU cost
- No MLOps team → Zero infra management

**Break-even example (Claude Haiku vs g5.xlarge):**
```
g5.xlarge: $1.01/hr × 24 = $24.24/day (fixed)
Claude Haiku output: $1.25/1M tokens
Break-even: $24.24 / $0.00000125 = 19.4M tokens/day output
→ Use Bedrock below ~19M output tokens/day
```

---

## Inferentia2 — Cost Optimization

| Instance | Inferentia2 Chips | Neuron Cores | VRAM | vCPU | RAM | $/hr | vs GPU Equivalent |
|----------|------------------|-------------|------|------|-----|------|------------------|
| inf2.xlarge | 1 | 2 | 32 GB | 4 | 16 GB | $0.76 | 25% cheaper than g5.xlarge |
| inf2.8xlarge | 1 | 2 | 32 GB | 32 | 128 GB | $1.97 | More CPU/RAM, same chip |
| inf2.24xlarge | 6 | 12 | 192 GB | 96 | 384 GB | $6.49 | Llama-30B/70B INT8 |
| inf2.48xlarge | 12 | 24 | 384 GB | 192 | 768 GB | $12.98 | Llama-70B FP16, large batches |

**Inferentia2 savings:**
- Up to 45% lower cost vs equivalent GPU for inference workloads
- Optimized for transformer attention patterns
- Requires model compilation with AWS Neuron SDK (one-time, ~1 hour)
- Not suitable for training or dynamic model architectures

**Inferentia2 vs g5 comparison:**
```
Llama-7B inference:
  g5.xlarge:     $1.01/hr, ~150 tokens/s  → $1.87/1M tokens
  inf2.xlarge:   $0.76/hr, ~200 tokens/s  → $1.06/1M tokens
  Saving: ~43%
```

---

## Sizing Formulas — Worked Examples

### Formula 1: Tokens/Day Capacity

```
tokens_per_day = tokens_per_second × 3600 × 24 × utilization_factor
utilization_factor = 0.7 (safe production estimate)

g5.xlarge Llama-7B:
  150 tokens/s × 86,400 × 0.7 = ~9.1M tokens/day
```

### Formula 2: Concurrent Users

```
concurrent_users = tokens_per_second / (avg_tokens_per_response / avg_response_time_seconds)

Assuming 200-token response, 2-second generation:
  throughput_needed = concurrent_users × (200/2) = concurrent_users × 100 tokens/s
  
For 50 concurrent users: need 5,000 tokens/s
  g5.xlarge at 150 tokens/s → need 34 instances
  inf2.xlarge at 200 tokens/s → need 25 instances
```

### Formula 3: Monthly Cost Estimate

```
monthly_cost = instance_cost × hours/month × instance_count
             + data_transfer_cost

hours/month = 730

50 concurrent users, Llama-7B, g5.xlarge:
  instances = ceil(50 × 100 / 150) = 34 instances
  monthly = $1.01 × 730 × 34 = $25,082/month
  
With Reserved 1-year (~35% discount): ~$16,303/month
With Inferentia2 inf2.xlarge (25 instances): $0.76 × 730 × 25 = $13,870/month
```

---

## Scaling Thresholds

| Current Setup | Move Up When | Next Tier |
|--------------|-------------|-----------|
| g5.xlarge (1 GPU) | GPU utilization &gt;80% sustained or VRAM OOM | g5.12xlarge (4 GPU) or add instances |
| Single g5 instance | p99 latency &gt;2s or queue depth &gt;10 | Horizontal scale or g5.12xlarge |
| p3.2xlarge (V100) | Model &gt;14B params or training &gt;48 hrs | p4d.24xlarge |
| SageMaker single instance | &gt;100 invocations/sec or auto-scaling lag | Multi-instance endpoint + scale policy |
| Bedrock on-demand | &gt;50M tokens/day consistent volume | Provisioned Throughput or self-hosted |
| inf2.xlarge | Model &gt;24B params or throughput cap | inf2.24xlarge or inf2.48xlarge |

---

## Cost Optimization Tips

| Strategy | Savings | Trade-off | Best For |
|----------|---------|-----------|---------|
| Reserved Instances (1-year) | 30-40% vs on-demand | Commitment required | Stable production traffic |
| Reserved Instances (3-year) | 50-60% vs on-demand | Long commitment | Core inference fleet |
| Spot Instances | 60-70% vs on-demand | Interruptions (2-min warning) | Batch training, eval jobs |
| INT8 quantization | ~50% VRAM, +50% throughput | ~2-5% quality loss | Production inference |
| INT4 quantization | ~75% VRAM, +100% throughput | ~5-10% quality loss | Cost-sensitive inference |
| Inferentia2 migration | 30-45% vs GPU | Neuron SDK compile time | High-volume stable inference |
| Bedrock Provisioned Throughput | 50%+ vs on-demand tokens | Min commitment (1 month) | Predictable high volume |
| Batch requests (batching=8) | ~4x throughput same cost | Latency increases | Offline/async workloads |

**Rule of thumb:** `g5.xlarge at $1.01/hr handles ~9M tokens/day` at 150 tokens/s and 70% utilization.

---

## Common Mistakes

### Mistake 1: Forgetting KV Cache in VRAM Budget

**Root cause:** Calculating only model weight size, ignoring attention KV cache at runtime.

**Impact:** OOM errors at production load; GPU crashes under batch traffic.

**Fix:**
```
KV cache per token = 2 × num_layers × num_heads × head_dim × 2 bytes (FP16)
Llama-7B: 2 × 32 × 32 × 128 × 2 = 524KB per token
At batch=16, seq_len=2048: 16 × 2048 × 524KB = 17.2 GB KV cache alone
→ Llama-7B actually needs g5.12xlarge (96GB), not g5.xlarge (24GB) at large batches
```

---

### Mistake 2: Using Training Instances for Inference

**Root cause:** Defaulting to p3/p4d because "more GPU = better."

**Impact:** 3-5x cost overrun vs appropriate inference instances.

**Fix:** g5 and inf2 instances deliver better tokens/$ for inference. p4d only justified for models &gt;100B params or when you need 8×A100 NVLink bandwidth.

| Instance | Use Case | Cost/1M tokens (Llama-7B) |
|----------|----------|--------------------------|
| p3.2xlarge (V100) | Wrong — training GPU | ~$8.50 |
| g5.xlarge (A10G) | Correct inference GPU | ~$1.87 |
| inf2.xlarge (Inferentia2) | Best inference value | ~$1.06 |

---

### Mistake 3: Not Accounting for Prompt Tokens in Cost

**Root cause:** Estimating only output tokens; ignoring that prompts (system messages, RAG context) are often 5-10x longer than output.

**Impact:** 5-10x cost underestimate on Bedrock/API; capacity plan misses by similar factor.

**Fix:**
```
total_tokens = input_tokens + output_tokens
typical RAG query: 2000 input (context) + 300 output = 2300 total
cost at Claude Haiku: (2000 × $0.25 + 300 × $1.25) / 1M = $0.000875/query
NOT $0.000375 (output-only estimate)
```

---

### Mistake 4: Ignoring Warm-Up / Cold Start on SageMaker

**Root cause:** Load testing single requests; not measuring first-request latency after scale-out.

**Impact:** Cold start for Llama-70B endpoint = 3-8 minutes. Real-time SLA violated.

**Fix:** Use SageMaker Serverless with provisioned concurrency for baseline; set min_capacity=1 on auto-scaling; pre-warm endpoints before traffic spikes.

---

### Mistake 5: Comparing Bedrock vs Self-Hosted on Peak Cost Only

**Root cause:** Using peak hourly cost × 730 for self-hosted; forgetting idle hours.

**Impact:** Self-hosted looks cheaper but runs at 20% utilization nights/weekends → 5x actual cost.

**Fix:**
```
effective_self_hosted_cost = on_demand_cost × 730 / avg_utilization
At 20% utilization: $1.01 × 730 / 0.20 = $3,687/month effective
Bedrock at same volume: actual_tokens × per_token_rate (no idle cost)
→ Always model utilization, not peak capacity
```

---

## Key Numbers to Memorize

| Fact | Value |
|------|-------|
| g5.xlarge cost | $1.01/hr |
| g5.xlarge Llama-7B throughput | 100–200 tokens/s |
| p4d.24xlarge cost (8×A100) | $32.77/hr |
| inf2.xlarge cost | $0.76/hr |
| Inferentia2 savings vs GPU | Up to 45% |
| Reserved 1-year savings | 30-40% |
| Spot savings | 60-70% |
| Claude 3 Haiku pricing | $0.25/$1.25 per 1M in/out |
| VRAM rule (FP16) | params × 2 bytes |
| g5.xlarge daily capacity | ~9M tokens/day (70% util) |
| Training memory vs inference | 6-10x more VRAM needed |
| Break-even: Bedrock vs g5 | ~19M output tokens/day (Haiku) |
