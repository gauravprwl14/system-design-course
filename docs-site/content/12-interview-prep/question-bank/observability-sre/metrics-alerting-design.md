---
title: "Metrics & Alerting Design"
layer: interview-q
section: interview-prep/question-bank/observability-sre
difficulty: advanced
tags: [observability, metrics, prometheus, alerting, sre, grafana]
---

# Metrics & Alerting Design

6 questions covering metrics and alerting from the 4 Golden Signals to Google Monarch at 1B time series.

---

## Q1: What are the 4 Golden Signals?

**Role:** Junior, Mid | **Difficulty:** 🟢 | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you know Google's canonical SRE framework for what to monitor in any service — demonstrating awareness of the SRE Book.

### Answer in 60 seconds
- **Latency:** Time to serve a request. Key nuance: track p50, p95, p99 — not average. A 500ms average can hide 10% of users experiencing 5-second responses. Track both success and error latency separately (slow errors vs fast errors signal different problems).
- **Traffic:** Volume of demand on the system. Requests/second, messages/second, transactions/second. Measures "how busy is the system." Use to calculate load factor and capacity headroom.
- **Errors:** Rate of failed requests. Both explicit errors (HTTP 5xx, exception thrown) and implicit errors (HTTP 200 but wrong content, latency exceeds SLA). Error rate = errors/total_requests × 100%. Alert when error rate > 0.1% sustained for >5 minutes.
- **Saturation:** How "full" the system is — the resource closest to its limit. CPU utilisation, memory usage, disk IOPS, thread pool queue depth, DB connection pool saturation. Leading indicator: saturation increases *before* latency and errors degrade. At 80% CPU saturation, start planning capacity increase.
- **The 4th signal is the early warning:** Latency and errors are lagging indicators (the system is already failing). Saturation is a leading indicator (system approaching failure). Monitor all four.

### Diagram

```mermaid
graph TD
  G1["LATENCY\np50: 50ms | p95: 200ms | p99: 500ms\nAlert: p99 > SLA_threshold\nSplit: success_latency vs error_latency"]
  G2["TRAFFIC\nHTTP requests/sec | DB queries/sec\n'How busy is the system?'\nAlert: traffic > capacity × 0.8"]
  G3["ERRORS\nHTTP 5xx rate | Exception rate\n'What fraction is failing?'\nAlert: error_rate > 0.1% for 5 min"]
  G4["SATURATION\nCPU% | Memory% | Queue depth | DB conn pool%\n'How full is the system?'\nAlert: CPU > 80% for 10 min"]

  subgraph Dashboard["Golden Signal Dashboard"]
    G1
    G2
    G3
    G4
  end

  G4 -->|"Leading indicator"| Warning["⚠️ Will degrade soon"]
  G1 & G3 -->|"Lagging indicators"| Failure["🔴 Already degraded"]
```

### Pitfalls
- ❌ **Alerting on average latency:** Average is misleading. 99% of requests at 10ms and 1% at 5,000ms = average of ~60ms. Looks fine; 1% of users are having a terrible experience. Always alert on p99.
- ❌ **Missing implicit errors:** HTTP 200 with incorrect content (malformed JSON, empty search results for a query that should return results) is not captured by HTTP status code monitoring. Add semantic checks (empty result rate, schema validation errors).
- ❌ **Monitoring only the 4 Golden Signals:** The 4 signals tell you *something is wrong*. They don't tell you *why*. You need lower-level metrics (JVM GC pause time, DB slow queries, external API latency) for diagnosis. Use 4GS for alerting, detailed metrics for debugging.

### Concept Reference
→ [Observability Patterns](../../../09-observability/concepts/observability-fundamentals)

---

## Q2: Histogram vs counter vs gauge — when do you use each?

**Role:** Mid | **Difficulty:** 🟡 | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you know the three Prometheus metric types and can select the correct one for a given measurement.

### Answer in 60 seconds
- **Counter:** A monotonically increasing integer. Never decreases (only resets to zero on restart). Use for: total request count, total errors, total bytes transferred. Query with `rate()` or `increase()` to get per-second rates. Example: `http_requests_total{method="GET", status="200"}`.
- **Gauge:** A value that can go up or down at any time. Use for: current memory usage, active connections, queue depth, temperature, number of goroutines. Snapshot of current state. Example: `redis_connected_clients`.
- **Histogram:** Buckets a distribution of observations. Records count in each pre-defined bucket (e.g., <10ms, <50ms, <100ms, <500ms, <1s, +Inf). Also tracks total count and sum. Use for: request latency, response size, anything where you need percentiles. Query with `histogram_quantile(0.99, ...)` for p99.
- **Summary:** Like Histogram but computes quantiles in the client (not the server). Percentiles cannot be aggregated across instances. Generally prefer Histogram over Summary for server-side metrics.
- **Decision rule:**
  - Does it go up and down? → Gauge
  - Does it only increase (and you want rate)? → Counter
  - Do you need percentiles or distribution? → Histogram

### Diagram

```mermaid
graph TD
  Q{What are you measuring?}

  Q -->|"Cumulative total\n(requests, errors, bytes)"| Counter["COUNTER\nhttp_requests_total\nErrors: rate(http_errors_total[5m])"]

  Q -->|"Current value\n(can go up or down)"| Gauge["GAUGE\nredis_connected_clients\nprocess_memory_bytes\nqueue_depth"]

  Q -->|"Distribution\n(need p50, p95, p99)"| Histogram["HISTOGRAM\nhttp_request_duration_seconds{le='0.1'}\nhistogram_quantile(0.99, rate(metric[5m]))"]

  Counter --> C_Rule["Rate of change: rate() / increase()\nAlways use with rate() for dashboards"]
  Gauge --> G_Rule["Point-in-time value\nOK to alert directly: if gauge > threshold"]
  Histogram --> H_Rule["Percentile query:\nhistogram_quantile(0.99,\n  sum(rate(metric_bucket[5m])) by (le))"]
```

### Pitfalls
- ❌ **Using Gauge for request count:** Gauge goes down on restart; a restarted pod appears to have fewer requests than it does. Use Counter — `rate(http_requests_total[5m])` gives accurate per-second rates even across restarts.
- ❌ **Histogram buckets not covering the expected range:** Default Prometheus histogram buckets are [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] seconds. If your API typically responds in 200–2000ms, most observations land in the same bucket — p99 query returns a coarse estimate. Define custom buckets matching your expected latency distribution.
- ❌ **Using Summary when you need to aggregate across pods:** Summary percentiles are computed per-pod and cannot be aggregated (you can't average two p99 values). `histogram_quantile()` on a Histogram works correctly across N pods. Always prefer Histogram for services with multiple instances.

### Concept Reference
→ [Observability Patterns](../../../09-observability/concepts/observability-fundamentals)

---

## Q3: How do you write alerting rules that minimise false positives?

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand alerting fatigue and can design alert rules with appropriate stability windows, thresholds, and inhibition to reduce noise.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Service | Payment API (100K req/sec) |
| SLO | 99.9% success rate, p99 < 500ms |
| Current alert | Fires 15 times/day including false positives |
| Goal | Reduce to < 3 actionable alerts/day |

### Common False Positive Sources

```mermaid
graph TD
  FP1["1. Threshold too tight:\nAlert: error_rate > 0.01%\nNormal traffic: occasional error spikes to 0.02%\nFires 10x/day on transient noise"]

  FP2["2. No for: window:\nAlert fires immediately on first metric breach\nA 1-second spike triggers an alert page\nEngineer investigates — issue self-resolved"]

  FP3["3. Averaging masks real issues:\nAlert on avg latency > 200ms\nMajority of requests fast (p50=50ms)\nAverage 210ms — alerts. p99=2000ms — missed."]

  FP4["4. Missing inhibition:\nDB down → App alerts, payment alerts, cart alerts\n1 root cause → 20 simultaneous alerts"]
```

### Better Alert Rules

```mermaid
graph TD
  Good1["Rule 1: Stability window (for: 5m)\nalert: high_error_rate\nexpr: rate(errors[5m]) / rate(requests[5m]) > 0.001\nfor: 5m\n→ Only fires if sustained for 5 minutes, not a 1s spike"]

  Good2["Rule 2: Multi-window (burn rate)\nfast: error_rate > 14.4x budget consumption in 1h\nslow: error_rate > 6x budget consumption in 6h\n→ Catches both fast burns and slow leaks"]

  Good3["Rule 3: Alert on p99, not average\nexpr: histogram_quantile(0.99,\n  rate(request_duration_bucket[5m])) > 0.5\n→ Detects tail latency, not obscured by fast requests"]

  Good4["Rule 4: Inhibit downstream alerts\n- DB unavailable → inhibit payment, cart, checkout alerts\n- Node down → inhibit all service alerts on that node\n→ 1 root cause = 1 alert, not 20"]
```

| Alert Anti-pattern | Problem | Fix |
|-------------------|---------|-----|
| `error_rate > 0` | Fires on every single error | `error_rate > 0.1%` with `for: 5m` |
| No `for:` window | Fires on transient 1-second spikes | Add `for: 5m` (sustained condition) |
| Average latency alert | Misses tail problems | Alert on p99 histogram |
| Independent alerts per service | 20 alerts for 1 DB failure | Inhibition rules + dependency mapping |
| Static thresholds | Different traffic volumes need different thresholds | Dynamic threshold: `> baseline × 5` |

### Recommended Answer
Five practices to reduce false-positive alert rate from 15/day to <3/day:

**1. Sustained conditions with `for:`:** Add `for: 5m` to all alert rules. A 1-second spike that auto-resolves does not warrant a page. 5 minutes of sustained breach does.

**2. Meaningful thresholds:** `error_rate > 0.001` (0.1%) is a reasonable threshold for a payment service with 100K req/sec. That's 100 errors/sec — definitely worth paging. `error_rate > 0` fires on every transient error. Calibrate against historical data.

**3. Alert on p99, not average:** `histogram_quantile(0.99, ...) > 0.5` (500ms) aligns the metric with the SLO.

**4. Inhibition rules:** Define parent→child dependency in Alertmanager. When `DB: down` fires, inhibit `PaymentService: high_error_rate` and `CartService: high_error_rate`. This prevents alert floods from single root causes.

**5. Alert on symptom, not cause:** "Payment service error rate > 0.1%" is a symptom alert — directly tied to user impact. "CPU > 80%" is a cause alert — may or may not impact users. Prefer symptom alerts for pages; use cause alerts for tickets.

### What a great answer includes
- [ ] `for: 5m` to require sustained breach (eliminates transient spikes)
- [ ] p99 histogram_quantile instead of average latency
- [ ] Inhibition rules to prevent alert floods on single root cause
- [ ] Calibrated thresholds from historical data (not guessed)
- [ ] Symptom-based alerting (user impact) vs cause-based (infrastructure) — page on symptoms

### Pitfalls
- ❌ **Setting `for: 0m` (immediate fire):** Every brief spike wakes someone up. Start with `for: 5m` and reduce only if you're missing real incidents.
- ❌ **No alert routing:** All alerts go to all engineers → everyone ignores them (alarm fatigue). Route critical payment alerts to the on-call; infrastructure alerts to SRE; low-severity to a Slack channel.
- ❌ **Not testing alert rules:** Write unit tests for Prometheus rules using `promtool test rules`. A rule with a bug in the `expr` field fires on every evaluation (or never fires) — discover this in testing, not during an incident.

### Concept Reference
→ [Observability Patterns](../../../09-observability/concepts/observability-fundamentals)

---

## Q4: What is multi-window burn rate alerting and why is it better than simple thresholds?

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you know the Google SRE Book's advanced alerting strategy that replaces simple threshold alerts with error budget burn rate.

### Answer in 60 seconds
- **Error budget:** If SLO = 99.9% uptime/month, the error budget = 0.1% of requests can fail = 43.8 minutes of downtime/month (for latency SLOs) or 0.1% of requests failing. The budget quantifies how much imperfection is acceptable.
- **Burn rate:** How fast the error budget is being consumed. Burn rate 1 = consuming at exactly the rate that would exhaust the budget by month-end. Burn rate 10 = consuming 10× faster — would exhaust in 3 days.
- **Simple threshold problem:** `error_rate > 5%` fires regardless of duration. 5% errors for 1 minute = 0.003% of monthly budget consumed. Probably fine. 5% errors for 12 hours = 3.6% of monthly budget. Catastrophic.
- **Multi-window burn rate alert:**
  - **Fast burn (1h window):** Alert if error_rate × 1h = 2% of monthly budget consumed (burn rate = 14.4). Catches large fast incidents.
  - **Slow burn (6h window):** Alert if error_rate × 6h = 5% of monthly budget consumed (burn rate = 6). Catches slow-drip incidents missed by fast burn.
  - **Ticket (slow trend, 3d window):** If 10% budget consumed in 3 days at current rate — schedule remediation, don't page.
- **Google's recommendation (SRE Workbook 2019):** Combine fast + slow burn windows. The combination catches 99% of budget-significant incidents while reducing false positives from transient spikes.

### Diagram

```mermaid
graph TD
  Budget["Monthly error budget: 0.1% = 43.8 min downtime"]

  Fast["Fast Burn Alert\nWindow: 1 hour\nCondition: burn_rate > 14.4\n(consumes 2% of budget in 1h)\nPage: immediately\nScenario: 15% error rate for 30 min"]

  Slow["Slow Burn Alert\nWindow: 6 hours\nCondition: burn_rate > 6\n(consumes 5% of budget in 6h)\nPage: immediately\nScenario: 1% error rate sustained 6h"]

  Ticket["Slow Trend Alert\nWindow: 3 days\nCondition: budget_consumed > 10%\nTicket: not a page\nScenario: 0.2% error rate (2× SLO baseline)"]

  Budget --> Fast & Slow & Ticket

  Combined["Combined: catches fast incidents AND\nslow sustained degradations\nWon't fire on 30s transient spikes\n(too short to consume 2% in 1h)"]

  Fast & Slow & Ticket --> Combined
```

### Pitfalls
- ❌ **Single short-window alert (e.g., `error_rate > 0.1% for 5m`):** Catches fast incidents but misses the slow 0.05% error rate that consumes budget over a week. Slow burn alert catches this.
- ❌ **Alerting without an error budget:** Burn rate alerting requires a defined SLO and error budget. Without these, you cannot compute burn rate. Define SLOs first, then implement burn rate alerts.
- ❌ **Same alert severity for fast and slow burn:** Fast burn (14.4×) deserves an immediate page. Slow burn (6×) deserves a page with a 30-minute response window. Ticket-level (low burn rate) does not need to wake anyone up.

### Concept Reference
→ [SRE Practices](../../../09-observability/concepts/slo-sla-fundamentals)

---

## Q5: How do Prometheus and Thanos aggregate metrics across 1,000 services?

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand the limitations of single-instance Prometheus at scale and how Thanos provides global query views across multiple Prometheus instances.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Services | 1,000 microservices |
| Metrics per service | 1,000 time series each |
| Total time series | 1M time series |
| Prometheus limitation | Single instance handles ~10M series max (RAM bound) |
| Query requirement | "What is the global p99 for all payment instances?" |
| Retention | 2 years (single Prometheus retains 15 days by default) |

### Single Prometheus (Doesn't Scale)

```mermaid
graph TD
  All["1,000 services scraping to 1 Prometheus"]
  All -->|1M time series × 2 bytes × 15s resolution| Memory["RAM usage: ~2GB — OK\nStorage: 1M × 2B × 4 samples/min × 525,600 min/yr = 4TB/yr\nSingle Prometheus: storage problem at 1 year retention"]
  All -->|"Global query: sum(rate(...)) over all 1000 services"| Slow["Query time: seconds (1M series scan)"]
```

### Thanos Architecture

```mermaid
graph TD
  subgraph Cluster1["Service Cluster A (200 services)"]
    Prom1["Prometheus A\n200K time series\n2-week local retention"]
    Sidecar1["Thanos Sidecar\nUploads TSDB blocks to S3 every 2h"]
  end

  subgraph Cluster2["Service Cluster B (200 services)"]
    Prom2["Prometheus B\n200K time series"]
    Sidecar2["Thanos Sidecar"]
  end

  S3["Object Storage (S3/GCS)\nAll historical blocks\n2-year retention\nCost: ~$0.023/GB/month\n1M series × 2yr ≈ 8TB = $184/month"]

  Store["Thanos Store Gateway\nServes historical data from S3\n(appears as Prometheus to querier)"]

  Querier["Thanos Querier\nRoutes queries to correct Prometheus/Store\nDeduplicates results (HA replicas)\nFederated: global queries across all clusters"]

  Ruler["Thanos Ruler\nEvaluates global recording rules\n'p99 across all payment pods' — computed here"]

  Prom1 & Prom2 --> Sidecar1 & Sidecar2
  Sidecar1 & Sidecar2 -->|"Upload TSDB blocks"| S3
  S3 --> Store
  Prom1 & Prom2 & Store --> Querier
  Querier --> Grafana["Grafana Dashboards\nGlobal + per-cluster views"]
```

### Recommended Answer
Thanos extends Prometheus to solve three problems at 1,000-service scale:

**1. Global queries:** Each cluster has its own Prometheus. A single Prometheus cannot answer "global p99 across all 1,000 payment pods" — it only knows about the pods it scrapes. Thanos Querier routes the query to all Prometheus instances, collects partial results, and merges them. The PromQL fan-out is transparent.

**2. Long-term retention:** Prometheus's local TSDB degrades with long retention (high memory, slow queries). Thanos Sidecar uploads TSDB blocks to S3 every 2 hours. Thanos Store Gateway serves historical queries directly from S3. Query spans: "last 2 hours" → Prometheus; "last 2 years" → Thanos Store.

**3. HA deduplication:** Running Prometheus in HA pairs (2 instances scraping the same targets) causes duplicate time series. Thanos Querier deduplicates using replica labels: `--query.replica-label=replica`. Two instances become one logical source.

**Scale:** 1M time series split across 5 Prometheus instances (200K each) → each at ~40% capacity. Queries fan out to 5 instances and merge in <500ms. S3 costs ~$184/month for 2-year retention at 8TB.

### What a great answer includes
- [ ] Why single Prometheus fails: no global queries, storage limits, no HA dedup
- [ ] Thanos Sidecar: uploads TSDB blocks to S3 every 2 hours
- [ ] Thanos Querier: routes and merges federated queries across all Prometheus instances
- [ ] Thanos Store: serves historical data from S3 (unlimited retention)
- [ ] Cost estimate: S3 retention at 8TB = ~$184/month vs in-house TSDB hardware

### Pitfalls
- ❌ **Using Prometheus federation instead of Thanos:** Prometheus federation (scraping /federate endpoint) only exposes aggregated metrics from sub-instances — you lose cardinality. Thanos maintains full cardinality across the federation.
- ❌ **Not sizing Prometheus correctly:** At 1M time series per instance, Prometheus needs 8–16GB RAM. Under-provisioning causes OOM restarts during query spikes. Size at 2× expected series count.
- ❌ **Forgetting Thanos Compactor:** Without compaction, S3 accumulates thousands of small 2-hour TSDB blocks. Compactor merges them into larger blocks and applies retention policies. Essential for query performance on historical data.

### Concept Reference
→ [Observability Patterns](../../../09-observability/concepts/observability-fundamentals)

---

## Q6: How does Google Monarch handle 1B time series globally?

**Role:** Staff | **Difficulty:** ⚫ | **Priority:** P2 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you know Google's internal successor to Borgmon — a planet-scale monitoring system that no open-source tool matches — demonstrating senior breadth.

### Answer in 60 seconds
- **What is Monarch:** Google's global distributed time-series database, used since ~2015. Replaced Borgmon (which inspired Prometheus). Handles 1B+ active time series globally with sub-second query latency.
- **Key design principles:**
  - **Zone-local leaves:** Monarch Leaf servers are co-located in each datacenter zone. Services push metrics to the local Leaf. No cross-zone metric push latency.
  - **Root aggregation:** Monarch Root servers aggregate and index across all zones. Global queries route to Root which fans out to Leaves.
  - **Pushes over scrapes:** Unlike Prometheus (scrape-based), Monarch uses a push model. Services push metrics to the local Monarch agent. Push allows dynamic service discovery without scrape configuration.
  - **Targets and tables:** Monarch organises metrics into "tables" per job/service. Schema is enforced at the table level — no arbitrary label pollution.
  - **Query language — MIDAS:** A SQL-like language for time series. Supports joins, subqueries, and streaming aggregations.
- **Scale context:** 1B time series × 1 sample/10s = 100M data points/sec ingested globally. Prometheus community estimated that replicating Monarch at open-source would require thousands of Thanos nodes.
- **Published in:** "Monarch: Google's Planet-Scale In-Memory Time Series Database" (VLDB 2020).

### Diagram

```mermaid
graph TD
  Services["Google Services\n(Borg tasks in every datacenter)"]

  Services -->|"Push metrics (UDP/gRPC)"| Leaf["Monarch Leaf\n(per datacenter zone)\nIn-memory + local SSD\nHandles all writes from local services"]

  Leaf -->|"Aggregated data\n(periodic flush)"| Root["Monarch Root\n(global)\nIndex of all metric schemas\nRoutes global queries"]

  Query["Query: 'p99 latency for search globally'\n→ Root fans out to all Leaves\n→ Merges partial results\n→ Returns in <1 second"]

  Root --> Query
```

### Pitfalls
- ❌ **Applying Prometheus architecture patterns to Monarch:** Prometheus is scrape-based, single-region, RAM-bound. Monarch is push-based, multi-region, scales to 1B series. The architectural decisions are fundamentally different.
- ❌ **"Open-source doesn't scale to Google level":** This is approximately true for raw Prometheus. Thanos + Cortex + VictoriaMetrics can handle 100M series. But 1B+ time series requires a custom system like Monarch or a very large VictoriaMetrics cluster (the only OSS system claiming this scale).
- ❌ **Not knowing Monarch is push-based:** Saying "Google probably uses Prometheus" in a Staff interview signals unfamiliarity with Google's actual infrastructure. Know that Borgmon was the original, Prometheus was inspired by Borgmon, and Monarch replaced Borgmon.

### Concept Reference
→ [Observability Patterns](../../../09-observability/concepts/observability-fundamentals)
