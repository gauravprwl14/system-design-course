---
title: "Deployment Strategies: Blue-Green, Canary, and Feature-Flag Rollouts"
date: "2026-03-18"
category: "system-design-playbook"
subcategories: ["deployment", "reliability", "devops", "patterns"]
personas: ["Mid-level Engineer", "Senior Engineer", "Tech Lead", "Staff Engineer", "Principal Engineer"]
tags: ["blue-green", "canary", "rolling-deployment", "feature-flags", "deployment-strategies", "rollback", "blast-radius"]
description: "Deployment strategy selection based on blast radius, rollback speed, and infrastructure cost — with concrete sizing math for each approach at production scale."
reading_time: "19 min"
difficulty: "senior"
status: "published"
featured_image: "/assets/diagrams/deployment-strategies-deep-dive.png"
---

# Deployment Strategies: Blue-Green, Canary, and Feature-Flag Rollouts

## 🗺️ Quick Overview

```mermaid
graph TD
    A[New Version Ready] --> B{Strategy?}
    B --> C[Blue-Green<br/>duplicate environment]
    B --> D[Canary<br/>1% → gradual rollout]
    B --> E[Rolling<br/>replace pods one batch]
    C --> F[Instant cutover<br/>1s rollback]
    D --> G[Monitor error rate<br/>auto-promote or abort]
    E --> H[Slow rollback<br/>redeploy old image]
    F --> I[2x infrastructure cost<br/>during migration]
    G --> J[Minimal blast radius<br/>% of users affected]
```
*Normal path: deploy → validate → promote. Trigger: errors detected after rollout. Recovery speed and blast radius vary drastically by strategy — blue-green wins on rollback speed, canary wins on blast radius.*

**Every deployment is a bet that the new version is better. The strategy you choose determines how much you lose when the bet is wrong — and you will be wrong eventually. The difference between a 1-second rollback and a 30-minute rollback is pure architecture.**

---

## The Problem Class `[Mid]`

Deployment carries risk: runtime errors that testing missed, performance regressions, database migrations that corrupt data, dependency changes that break downstream. The naive deployment model — stop old version, start new version — has 100% blast radius. Every user is affected simultaneously.

The deployment strategy question is: how do you reduce blast radius, maintain rollback capability, and still move fast?

```mermaid
graph LR
    subgraph "Risk Dimensions"
        R1[Blast Radius<br/>% of users affected<br/>on bad deploy]
        R2[Rollback Time<br/>seconds to minutes]
        R3[Infrastructure Cost<br/>1x to 2x capacity]
        R4[Complexity<br/>config vs code changes]
    end

    subgraph "Strategy Matrix"
        S1[In-Place Rolling<br/>0% extra cost<br/>slow rollback<br/>all users affected gradually]
        S2[Blue-Green<br/>100% extra cost<br/>instant rollback<br/>all-or-nothing cutover]
        S3[Canary<br/>5-10% extra cost<br/>fast rollback<br/>limited blast radius]
        S4[Feature Flags<br/>~0% extra cost<br/>instant rollback<br/>code-level control]
    end
```

**The four strategies form a spectrum**: each trades infrastructure cost for blast radius control and rollback speed. No single strategy is universally correct.

---

## Why the Obvious Solution Fails `[Senior]`

**Why not just deploy everything in-place (rolling updates)?**

Rolling updates are the Kubernetes default (`strategy: RollingUpdate`). During the rollout, old and new pods coexist. Problems:

1. API compatibility: if v2 has breaking API changes (renamed field, different auth header), old pods and new pods respond differently to the same request — users randomly hit either version
2. Database migrations: if v2 requires a new column, v1 errors on queries that don't include it. v2 errors if it runs before migration. Rolling update + schema migration is a coordination problem.
3. Rollback speed: rolling back a 50-pod deployment takes as long as the original rollout. If your rollout takes 10 minutes, rollback takes 10 minutes.

**Why not always use blue-green?**

Blue-green requires 2x infrastructure capacity during the deployment window. For a 1000-pod service, you need 2000 pods worth of capacity for the duration of every deployment. If you deploy 10 services per day across a 100-pod fleet, you're paying for 100 extra pods constantly. At $0.05/pod-hour on spot instances, that's $120/day in waste just for deployment headroom.

Blue-green also has a database problem: the green environment uses the same database as blue. If v2 runs a destructive migration (dropping a column), you can't roll back — the database is already modified.

**Why not just use feature flags for everything?**

Feature flags solve the user-impact problem (toggle off for affected users) but don't solve the infrastructure problem (bad code is still deployed and consuming resources). A feature flag can't help if the bad code causes OOM crashes at startup before the flag is even evaluated.

---

## The Solution Landscape `[Senior]`

### Solution 1: Blue-Green Deployment

**What it is**

Run two identical environments (blue = current production, green = new version). Deploy to green, test it, switch traffic from blue to green via a DNS change or load balancer rule. Blue remains idle as an instant rollback target.

**How it actually works at depth**

```
Initial state:    LB → Blue (v1, 100% traffic)  |  Green (idle)
Deploy:           LB → Blue (v1, 100% traffic)  |  Green (v2, deployed, tested)
Cutover:          LB → Green (v2, 100% traffic) |  Blue (v1, idle, rollback target)
Cleanup:          LB → Green (v2, 100% traffic) |  Blue (decommission after 24h)
Rollback:         LB → Blue (v1, 100% traffic)  |  Green (v2, rolled back from)
```

Load balancer switching time:
- AWS ALB weighted target groups: < 1 second
- DNS-based switching: 60-300 seconds (DNS TTL dependent) — don't use DNS for blue-green
- Kubernetes Service selector update: < 5 seconds

**Sizing guidance** `[Staff+]`

Blue-green infrastructure cost multiplier:
```
steady_state_capacity = N pods
blue-green_capacity = 2N pods during deployment window

Deployment window duration: typically 30 minutes (deploy + smoke test + cutover)
If you deploy 5 times/day, 30 min each:
Cost overhead = 2.5 hours × N pods × hourly_cost / 24 hours = ~10% overhead

If you deploy 20 times/day (continuous delivery):
Cost overhead = 10 hours × N pods × hourly_cost / 24 hours = ~42% overhead
```

Blue-green is most cost-efficient for low-deployment-frequency services. For high-frequency deployments, canary or rolling updates are more economical.

**Database migration coordination** `[Staff+]`

Blue-green with database changes requires expand-contract pattern:
1. **Expand** (deploy v1.5): Add new column, keep old column. Both v1 and v2 work.
2. **Deploy v2** (blue-green): v2 reads new column, writes both old and new.
3. **Verify** v2 is stable for 24-48 hours.
4. **Contract** (deploy v2.1): Remove old column. Now v1 can't roll back — accept this.

Never run a destructive database migration during the same deployment as application code changes.

**Failure modes** `[Staff+]`

1. **Warm-up gap**: Green environment is cold when it receives 100% traffic. JVM JIT compilation, connection pool warming, cache population all happen after cutover. P99 latency spikes for 2-5 minutes post-cutover. Mitigation: synthetic load testing of green before cutover; health check with realistic traffic patterns.

2. **Session stickiness**: Users authenticated against blue lose sessions when cut to green (if sessions are in-memory). Mitigation: externalize sessions to Redis before deployment.

3. **Long-running blue connections**: WebSocket connections, long-polls, streaming responses — these stay connected to blue after cutover. They need to be drained, not killed. Set connection draining timeout (ALB: `deregistration_delay.timeout_seconds`) to 60-300 seconds.

---

### Solution 2: Canary Deployment

**What it is**

Deploy the new version to a small subset of instances. Route a percentage of traffic to canary. Monitor metrics. If metrics are healthy, progressively increase traffic. If metrics degrade, roll back by routing all traffic back to stable.

**How it actually works at depth**

```
Stage 1: 5% canary
  - Deploy 5 canary pods alongside 95 stable pods
  - Monitor: error rate, p99 latency, business metrics (order completion rate)
  - Duration: 30 minutes to 2 hours depending on traffic volume

Stage 2: 25% canary  (if Stage 1 passed)
  - Scale canary to 25 pods, scale stable to 75 pods
  - Metrics must maintain SLO for full duration

Stage 3: 100% (cutover)
  - All traffic to canary; stable pods stand by for 15 minutes
  - Decommission stable after confirmation
```

**Metric-gated promotion** is the key mechanism — humans don't decide when to progress; metrics do:

```yaml
# Argo Rollouts metric analysis
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
  - name: success-rate
    successCondition: result[0] >= 0.95    # 95% success rate required
    failureCondition: result[0] < 0.90     # <90% = automatic rollback
    provider:
      prometheus:
        address: http://prometheus:9090
        query: |
          sum(rate(http_requests_total{job="order-service",status!~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="order-service"}[5m]))
```

**Sizing guidance** `[Staff+]`

Canary pod count for statistical significance:
```
To detect a 1% increase in error rate (from 0.5% to 1.5%) with 95% confidence:
Required sample size ≈ 10,000 requests

At 100 RPS to canary: need 100 seconds of data — 2 minutes
At 10 RPS to canary (5% of 200 RPS total): need 1000 seconds — 17 minutes

Practical rule: canary stage should receive at least 10,000 requests before promotion.
Time to pass = 10,000 / (total_RPS × canary_percentage)
```

Infrastructure overhead: 5% canary requires 5% extra capacity = ~5% infrastructure cost. Far more economical than blue-green's 100% overhead.

**Failure modes** `[Staff+]`

1. **Low-traffic services with insufficient canary data**: A service handling 10 RPS total, with 5% canary = 0.5 RPS. Getting 10,000 requests for statistical significance takes 5.5 hours. Either accept lower confidence or use traffic shadowing (dark launch) to amplify canary data.

2. **Slow error regression**: Some errors only appear after extended run time (memory leaks manifest over hours, not minutes). Stage 1's 30-minute window won't catch a 4-hour memory leak. Add canary stages with longer durations for high-risk changes.

3. **User experience inconsistency**: With 5% canary, a user's repeated requests may hit different versions (unless you shard by user ID). Shopping cart state, UI changes, and session-dependent features are broken by random version mixing. Use consistent hashing by user ID for routing.

---

### Solution 3: Rolling Deployment

**What it is**

Replace pods incrementally: take down 10% of old pods, start new pods, wait for health checks, repeat. All traffic is served throughout; some users hit old pods, some hit new.

**Sizing guidance** `[Staff+]`

```yaml
# Kubernetes rolling update configuration
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 10%    # At most 10% of pods unavailable at once
    maxSurge: 10%          # At most 10% extra pods above desired count
```

At 100 desired pods, 10% surge: 110 pods maximum capacity during rollout = 10% infrastructure overhead during deployment only (not a steady-state cost).

Rollout duration at 10% per step:
```
100 pods, maxUnavailable=10, maxSurge=10
Steps: 10 (each replacing 10 pods)
If health check = 30s and pod startup = 60s:
Total rollout = 10 steps × 90s = 15 minutes
Rollback: same 15 minutes
```

**When rolling works**: Services with backwards-compatible API changes and no schema migrations. The safest class of change for rolling deployment is a pure logic change with no API surface changes.

---

### Solution 4: Feature Flag Deployment (Code-Level Toggle)

**What it is**

Deploy code with new behavior disabled by a runtime flag. Enable the flag for a percentage of users, user segments, or geographic regions. The deployment and the rollout are decoupled — you deploy once, control blast radius via flags.

**How it actually works at depth**

```typescript
// Flag evaluation at request time
const newCheckoutEnabled = await featureFlags.isEnabled(
  'new-checkout-flow',
  {
    userId: req.user.id,
    userSegment: req.user.plan,    // 'free' | 'pro' | 'enterprise'
    region: req.geoip.region,
  }
);

if (newCheckoutEnabled) {
  return await newCheckoutService.process(order);
} else {
  return await legacyCheckoutService.process(order);
}
```

Flag rollout stages:
1. Deploy code with flag off (0% rollout) — verify no startup issues
2. Enable for internal users (1 user segment)
3. Enable for beta users (1% of total)
4. Enable for 5% → 25% → 50% → 100%
5. Remove flag and dead code (critical — see flag debt section)

---

## Trade-off Matrix `[Senior]` → `[Staff+]`

| Dimension | Rolling | Blue-Green | Canary | Feature Flags |
|---|---|---|---|---|
| **Infrastructure cost overhead** | ~10% (during rollout) | 100% (during window) | 5-10% | ~0% |
| **Rollback time** | Same as rollout (minutes) | < 5 seconds | < 30 seconds | < 1 second |
| **Blast radius at peak** | 100% (all pods eventually) | 100% (hard cutover) | 5-25% (controlled) | 0-100% (controlled) |
| **API compatibility required** | Yes (old+new coexist) | No (full cutover) | Yes (during stages) | Yes (both paths live) |
| **DB migration support** | Very hard | Expand-contract | Expand-contract | Code handles both |
| **Observability complexity** | Low | Low | High (dual metrics) | High (flag-dimension metrics) |
| **Cold start problem** | No (gradual) | Yes (cutover spike) | No (gradual) | No |
| **Session consistency** | Varies | Broken on cutover | Varies by routing | Flag-evaluated per request |

---

## Decision Framework `[Senior]` → `[Staff+]`

```mermaid
flowchart TD
    A[Planning a deployment] --> B{Does this change include a database migration?}

    B -->|Yes - additive only, backwards compatible| C{Deployment frequency?}
    B -->|Yes - destructive schema change| D[Expand-contract pattern required<br/>Multi-phase deployment mandatory]
    B -->|No DB changes| E{How many users affected if bad deploy?}

    C -->|<5 deploys/day| F{Infrastructure budget?}
    C -->|5+ deploys/day| G[Canary - cost-effective for high frequency]

    F -->|Can afford 2x capacity| H[Blue-Green - instant rollback]
    F -->|Budget constrained| G

    E -->|Revenue-critical feature| I{Can you instrument business metrics?}
    E -->|Non-critical internal feature| J[Rolling - simple and sufficient]

    I -->|Yes - have conversion rate, etc| K[Canary with metric-gated promotion]
    I -->|No - only technical metrics| L{Feature decoupled from infrastructure?}

    L -->|Yes - pure business logic| M[Feature flag - fastest rollback, no infra cost]
    L -->|No - infrastructure change| H

    D --> N[Phase 1: DB expand - add new column, deploy v1.5 that uses both]
    N --> O[Phase 2: Deploy v2 - use new column only]
    O --> P[Phase 3: Verify 48h, then DB contract - remove old column]
```

---

## Production Failure Story `[Staff+]`

**The Canary That Wasn't Measuring the Right Thing**

An e-commerce platform deployed a canary for a new checkout redesign. They configured metric-gated promotion based on HTTP 5xx error rate. Canary stage 1 (5% traffic, 30 minutes): error rate 0.3% — healthy. Stage 2 (25% traffic, 1 hour): error rate 0.4% — healthy. Full cutover: error rate 0.5% — within SLO.

24 hours later: revenue ops flagged a 12% drop in checkout completion rate (conversion). The new checkout design had a confusing UX change on step 3 of 5 — users were abandoning, not erroring. HTTP 200 responses with users navigating away.

The canary metrics were technically correct — no errors. But the business metric (checkout completion rate) was missing from the promotion criteria.

**Fix**: Add business metric gates to canary analysis:
```yaml
metrics:
- name: checkout-completion-rate
  successCondition: result[0] >= 0.68    # 68% completion rate baseline
  failureCondition: result[0] < 0.62     # 8% relative drop = rollback
  provider:
    prometheus:
      query: |
        sum(rate(checkout_completed_total[15m]))
        /
        sum(rate(checkout_started_total[15m]))
```

**Lesson**: Canary promotion criteria must include business metrics, not just infrastructure metrics. A successful 5xx rate with degraded conversion is a failed deployment.

---

## Observability Playbook `[Staff+]`

**Deployment-window metrics to track**:

- `deployment_progress{version, stage}` — percentage of traffic on new version
- `error_rate{version}` — compare old vs new version error rates during canary
- `p99_latency{version}` — compare latency profiles side-by-side
- `business_metric{version}` — conversion rate, order completion, etc.

**Golden signals split by version** (Kubernetes labels):
```yaml
# Add version label to all pods for metric segmentation
labels:
  app: order-service
  version: "v2.3.1"    # makes version available as Prometheus label
```

**Rollback triggers** (automated):
- Error rate on new version > 2× baseline: trigger automatic rollback
- P99 latency on new version > 150% of baseline: page on-call + consider rollback
- Business metric drops > 5% relative: immediate escalation

---

## Architectural Evolution `[Staff+]`

**2026 perspective**:

**Progressive delivery platforms** (Argo Rollouts, Flagger) have standardized canary automation in Kubernetes. Flagger integrates natively with Istio, Linkerd, and NGINX Ingress, providing automated analysis and rollback based on Prometheus metrics with minimal YAML configuration.

**Deployment observability**: Grafana's Deployment Insights plugin (2025) automatically marks deployment events on all dashboards. When a metric spike correlates with a deployment timestamp, the correlation is surfaced automatically — reducing time-to-diagnosis for deployment regressions.

**Feature flag consolidation**: The OpenFeature standard (CNCF project, GA in 2024) provides a vendor-neutral SDK for feature flags. Teams can switch between LaunchDarkly, Flagsmith, and Unleash without changing application code. This reduces feature flag vendor lock-in, a growing concern as flag platforms have become deeply embedded in deployment workflows.

**Blue-green via GitOps**: Argo CD supports blue-green deployments at the GitOps layer. The green environment is a separate Kustomize overlay or Helm values file; promotion is a git commit. This provides audit trail, peer review, and automated rollback as first-class git operations.

---

## 🎯 Interview Questions

### Common Interview Questions on Deployment Strategies

#### Q1: Explain the difference between blue-green and canary deployments.
**What interviewers look for**: Precision on the trade-offs, not just definitions. They want to see you reason about blast radius, rollback speed, infrastructure cost, and when to choose each.

**Answer framework**:
1. Blue-green: two complete, identical environments. Deploy v2 to green while blue serves 100% of production traffic. Test green, then switch the load balancer from blue to green in a single operation (< 1 second with AWS ALB). Blast radius: 100% — all users switch at once. Rollback: < 5 seconds (switch back). Cost: 2x infrastructure during deployment window
2. Canary: deploy v2 to a small subset of instances (5%), route 5% of traffic there. Monitor metrics. Progressively increase to 25% → 50% → 100%. Blast radius: controlled (5% of users affected on bad deploy). Rollback: < 30 seconds. Cost: 5-10% extra capacity
3. Key distinction: blue-green is an all-or-nothing cutover; canary is a progressive rollout. Blue-green wins on rollback speed and simplicity. Canary wins on blast radius control and cost. If you deploy 5+ times per day, canary's lower infrastructure overhead makes it the economical choice
4. When to choose blue-green: low deployment frequency (< 5/day), instant rollback is a hard requirement, or the change is binary by nature (infrastructure change, new dependency that can't partially exist)

**Key numbers to mention**: Blue-green rollback: < 5 seconds (ALB target group switch). Canary rollback: < 30 seconds (revert weight to 0%). Blue-green cost: 100% overhead during window. Canary cost: 5-10% overhead. At 20 deploys/day, blue-green = ~42% average overhead vs canary = 5-10%.

---

#### Q2: How do you roll back a bad deployment with zero downtime?
**What interviewers look for**: Concrete operational knowledge — not just "change the load balancer" but the exact mechanism, the timing, and the gotchas.

**Answer framework**:
1. Blue-green rollback: the load balancer still knows about the blue environment. Execute one command: `aws elbv2 modify-listener --default-actions Type=forward,TargetGroupArn=<blue-arn>`. ALB propagates the change in < 1 second. Blue environment was idle but still running — it's warm and receives traffic immediately
2. Canary rollback: set canary weight to 0% and stable weight to 100% in the AnalysisTemplate or Argo Rollouts. Takes effect in < 30 seconds. No pod restarts needed — routing rule change only
3. Rolling rollback: requires a new rolling deployment with the old image tag. Takes as long as the original rollout — 15-30 minutes for a 100-pod service. This is why rolling is not a good strategy for high-risk changes
4. The prerequisite for any rollback: tested the rollback procedure in staging before the production deployment. If you've never practiced the rollback, it will fail during a real incident under time pressure

**Key numbers to mention**: ALB weight update: < 1 second. Rolling rollback for 100 pods: ~15 minutes (same as forward rollout). Blue-green rollback time: < 5 seconds. Session draining on blue-green: set `deregistration_delay.timeout_seconds = 300` to drain existing connections gracefully before hard cutover.

---

#### Q3: How do you handle database migrations safely during deployments?
**What interviewers look for**: Understanding of the expand-contract pattern — the standard answer for zero-downtime schema changes. Many candidates don't know this and propose risky "deploy both at once" approaches.

**Answer framework**:
1. The core problem: during any deployment, old code and new code run simultaneously (rolling update) or sequentially with instant cutover (blue-green). If your schema migration drops a column that v1 code reads, v1 errors. If v2 requires a column that hasn't been added, v2 errors
2. Expand-contract (3-phase deployment): Phase 1 (expand) — add the new column, keep the old. Deploy v1.5 that reads new column if exists, falls back to old. Both v1 and v1.5 work. Phase 2 — deploy v2 using new column exclusively. Verify stable for 24-48 hours. Phase 3 (contract) — remove old column. Now v1 can't roll back — accept this deliberately
3. Never run a destructive migration in the same deployment as application code changes. The migration and the code change must be separate commits, separate deployments, separated by 24-48 hours of validation
4. Blue-green specific: green environment runs against the same database as blue. If green's migration is destructive, you cannot roll back to blue — the DB is already modified. This is why expand-contract is mandatory even for blue-green

**Key numbers to mention**: Validation window between expand and contract: 24-48 hours minimum. Time to add/remove a column on 100M-row table with zero-downtime (online DDL): 5-30 minutes depending on DB. MySQL pt-online-schema-change or pg_repack for large tables. Never mix schema migration + code change in a single deployment.

---

#### Q4: What metrics should gate a canary promotion?
**What interviewers look for**: Whether you include business metrics, not just infrastructure metrics — a common real-world failure mode.

**Answer framework**:
1. Infrastructure metrics (necessary but not sufficient): HTTP error rate (5xx rate < 1%), p99 latency (< 150% of baseline), pod restart rate (0 OOM kills)
2. Business metrics (the ones candidates miss): checkout completion rate, order success rate, payment processing rate, user engagement metrics. A canary can have 0% HTTP errors and still represent a bad deployment if the UX change causes a 12% drop in conversion
3. Statistical significance gate: canary must receive at least 10,000 requests before promotion decision. At 5% canary with 200 RPS total = 10 RPS to canary = 1000 seconds (17 minutes) minimum per stage
4. Time-based gate: add minimum soak time even if metrics look good. Some failures manifest after extended runtime (memory leaks: 4+ hours, connection pool exhaustion under sustained load: 30+ minutes)

**Key numbers to mention**: Real incident: 0% error rate, 12% conversion drop — bad deploy not caught by infrastructure metrics only. Canary statistical significance: 10,000 requests minimum. Minimum soak time per stage: 30 minutes for fast failures, 4 hours for memory leak detection. Business metric gate: < 5% relative drop from baseline.

---

#### Q5: How do feature flags differ from canary deployments, and when do you choose each?
**What interviewers look for**: Understanding of the deployment/release decoupling concept — often called progressive delivery.

**Answer framework**:
1. Canary deployment: infrastructure-level traffic splitting. New code is deployed to a percentage of pods; those pods handle a percentage of requests. Controlled at the routing layer. The deployment and release are the same event
2. Feature flags: code-level toggle. Entire new code is deployed to 100% of pods with the flag off. The flag is then enabled for specific users, segments, or percentages. Deployment and release are decoupled
3. Feature flags win on rollback speed: toggle flag off in < 1 second for any user segment, no pod restarts, no routing changes. They also enable user-dimension targeting (enable for enterprise users only, not random 5%)
4. Feature flags lose on: they can't help if bad code causes OOM crashes at startup (the process dies before flag evaluation), they accumulate as technical debt if not cleaned up (flag debt). Set a 90-day expiry on every flag and create a cleanup ticket at creation time
5. Combined pattern: use canary for infrastructure changes (new infrastructure behavior, library upgrades), feature flags for business logic changes (new checkout flow, new recommendation algorithm)

**Key numbers to mention**: Feature flag rollback: < 1 second (cache update or kill switch). LaunchDarkly/Flagsmith flag evaluation: < 1ms SDK latency. Flag debt: OpenFeature standard (CNCF, GA 2024) enables vendor-neutral SDKs. Each flag should have a 90-day expiry ticket created at flag creation time.

---

#### Q6: How do you handle session consistency during blue-green deployments?
**What interviewers look for**: The stateful session gotcha that many candidates overlook when recommending blue-green.

**Answer framework**:
1. The problem: if sessions are stored in the pod's memory (in-process session), a user authenticated against blue environment loses their session immediately when traffic switches to green. This is a user-facing outage even though the deployment succeeded
2. Solution prerequisite: externalize session state to a shared store (Redis, database-backed sessions) before attempting blue-green. With external sessions, any pod in any environment can serve any user's session
3. Long-lived connections: WebSocket connections, server-sent events, long-polling — these maintain a persistent connection to a specific pod. When the LB switches to green, these connections remain on blue until they disconnect. Configure connection draining: ALB `deregistration_delay.timeout_seconds = 300`. Blue receives no new connections but drains existing ones gracefully over 5 minutes
4. Sticky sessions (session affinity): if you use sticky sessions in the LB, sticky sessions bound to blue pods break at cutover. Remove LB session affinity before attempting blue-green — use application-level session externalization instead

**Key numbers to mention**: Redis session store latency: < 1ms read. WebSocket drain timeout: 300 seconds (5 minutes) is typical. ALB `deregistration_delay` default: 300s, configurable 0-3600s. External session prerequisite must be deployed and stable in production before attempting first blue-green deployment.

---

#### Q7: How would you design a zero-downtime deployment pipeline for a service that has strict SLOs?
**What interviewers look for**: End-to-end thinking — combining strategy selection with automation, observability, and incident response.

**Answer framework**:
1. Strategy selection based on SLO: if the SLO is < 0.1% error rate and rollback must happen in < 30 seconds, canary with automated rollback (Argo Rollouts) is the right choice. Blue-green for sub-5-second rollback requirement
2. Metric-gated automation: AnalysisTemplate in Argo Rollouts queries Prometheus every 60 seconds. If error rate on canary > 2x baseline, automatic rollback. If business metric drops > 5%, automatic rollback + PagerDuty alert. No human in the promotion loop for standard deployments
3. Pre-deployment gates: staging environment that mirrors production at 10% scale. Load test canary in staging before production deployment. Synthetic monitoring run against staging canary
4. Post-deployment monitoring window: after 100% cutover, dedicated 30-minute monitoring window in the deployment runbook. On-call engineer watches dashboards. Automatic rollback triggers remain active for 4 hours post-cutover
5. Deployment runbook: one page, version-controlled, reviewed in quarterly drills. Contains: health check command, rollback command (one CLI call), escalation path. Practiced in staging quarterly

**Key numbers to mention**: Argo Rollouts metric check interval: configurable, minimum 30 seconds. Automated rollback trigger: error rate > 2x baseline. Business metric gate: > 5% relative drop. Post-cutover monitoring window: 30 minutes active + 4 hours automated triggers. Rollback command must be testable in staging.

---

## 💡 Pseudocode Walkthrough

```pseudocode
// Canary Deployment with Metric-Gated Promotion
// Argo Rollouts-style automated progressive delivery

DEFINE canary_rollout(new_image):
  stages = [
    { weight: 5,   min_requests: 10000, soak_minutes: 30 },
    { weight: 25,  min_requests: 10000, soak_minutes: 60 },
    { weight: 50,  min_requests: 10000, soak_minutes: 30 },
    { weight: 100, min_requests: 10000, soak_minutes: 15 },
  ]

  deploy canary pods with new_image (5% of fleet initially)

  for stage in stages:
    set_traffic_weight(canary=stage.weight, stable=100-stage.weight)

    // Wait for statistical significance
    wait until canary_request_count >= stage.min_requests
    wait_minutes(stage.soak_minutes)

    // Evaluate promotion criteria every 60 seconds
    metrics = query_prometheus(last_5_minutes)

    if metrics.error_rate_canary > 2 * metrics.error_rate_stable:
      rollback()  // set canary weight to 0%, page on-call
      return DEPLOYMENT_FAILED("error_rate_regression")

    if metrics.p99_canary > 1.5 * metrics.p99_stable:
      rollback()
      return DEPLOYMENT_FAILED("latency_regression")

    if metrics.checkout_completion_canary < 0.95 * metrics.checkout_completion_stable:
      rollback()
      return DEPLOYMENT_FAILED("business_metric_regression")

    // Metrics healthy: promote to next stage
    log("Stage {stage.weight}% passed — promoting")

  // All stages passed → decommission stable pods
  scale_down(stable_pods)
  return DEPLOYMENT_SUCCESS

function rollback():
  set_traffic_weight(canary=0, stable=100)
  // Takes effect in < 30 seconds
  // Canary pods remain for post-mortem analysis
  alert_oncall("Canary rollback triggered — check dashboard")
```

---

## Decision Framework Checklist `[All Levels]`

- [ ] Identified whether deployment includes database migrations (changes strategy selection)
- [ ] Calculated blast radius for each strategy option given expected traffic
- [ ] Determined rollback time requirement based on revenue impact per minute of downtime
- [ ] Sized infrastructure overhead for blue-green against deployment frequency
- [ ] Defined promotion criteria for canary (include business metrics, not just error rate)
- [ ] Configured health checks that reflect real service readiness (not just process startup)
- [ ] Tested rollback procedure in staging — rollback that has never been tested will fail in crisis
- [ ] For blue-green: externalized session state to shared store before attempting
- [ ] For canary: configured consistent user routing (same user hits same version)
- [ ] For feature flags: created ticket for flag cleanup with 90-day expiry
- [ ] Deployment runbook accessible to on-call team with rollback commands
- [ ] Metrics split by version label for side-by-side comparison during deployment

## Next Steps

- **Traffic splitting infrastructure**: Istio VirtualService enables canary routing without Argo Rollouts → [Service Mesh Architecture](./service-mesh-architecture)
- **Resilience during deployments**: Protect in-flight transactions with bulkheads during rolling updates → [Bulkhead Pattern](./bulkhead-pattern)
- **Database schema safety**: Expand-contract pattern details → [Database Migration Patterns](/10-architecture/concepts/database-migration-patterns)
- **Saga deployment safety**: Rolling out saga orchestration changes safely → [Saga Pattern Deep Dive](./saga-pattern-deep-dive)
- **Progressive migration**: Strangler fig uses the same facade routing concepts → [Strangler Fig Migration](./strangler-fig-migration)

*Written by Gaurav Porwal — 10+ Year Engineer | Tech Lead | Product Owner | Business-Minded Builder*
*Last updated: 2026-03-18*
