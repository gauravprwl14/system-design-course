# 09-observability/concepts/ — Layer 2 Router

Observability theory and design — the three pillars (metrics, logs, traces), SLOs, alerting, performance tuning, APM comparison, and FinOps.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to observability and the three pillars framework |
| prometheus-grafana-stack | Architecture of Prometheus scraping, PromQL, and Grafana dashboard design |
| opentelemetry-instrumentation | OTel SDK, collector pipelines, and auto vs manual instrumentation |
| slo-burn-rate-alerts | Burn rate calculation, multi-window alerting, and alert fatigue avoidance |
| metric-cardinality-management | Why high-cardinality labels explode storage and how to design metrics responsibly |
| observability-slos | SLI/SLO/SLA definitions, error budgets, and reliability targets |
| distributed-tracing-design | Trace context propagation, sampling strategies, and tail-based sampling |
| log-aggregation-design | Structured logging, log levels, retention tiers, and aggregation pipeline design |
| metrics-design-patterns | RED method, USE method, and domain-specific metric naming patterns |
| alerting-strategy | On-call rotation design, alert severity levels, runbooks, and reducing noise |
| slo-error-budget-design | Defining error budgets, freeze policies, and balancing reliability vs velocity |
| cost-monitoring-finops | Cloud cost visibility, tagging strategies, per-feature cost attribution |
| connection-pool-management | Monitoring and sizing database/HTTP connection pools |
| latency-percentiles | P50 vs P95 vs P99 — why averages lie and how to measure tail latency |
| gc-pressure-tuning | JVM/Node.js garbage collection pressure detection and tuning |
| thread-pool-sizing | Little's Law applied to thread pool sizing and queue depth monitoring |
| database-query-performance | Slow query logging, EXPLAIN analysis, and query performance dashboards |
| network-optimization | Network latency monitoring, TCP tuning, and bandwidth saturation detection |
| apm-platforms-comparison | Datadog vs New Relic vs Dynatrace — feature, cost, and integration comparison |
| log-aggregation-elk-loki | ELK stack vs Grafana Loki — indexing, cost, and operational trade-offs |
| real-user-monitoring | RUM implementation, Core Web Vitals tracking, and field vs lab data |
| synthetic-monitoring | Proactive uptime checks, scripted browser tests, and canary probing |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start with observability fundamentals | overview.md |
| Deploy metrics collection with Prometheus | prometheus-grafana-stack.md |
| Instrument a service from scratch | opentelemetry-instrumentation.md |
| Set up SLO-based alerts | slo-burn-rate-alerts.md |
| Prevent metrics storage from exploding | metric-cardinality-management.md |
| Define reliability targets and error budgets | observability-slos.md, slo-error-budget-design.md |
| Trace a request across 10 microservices | distributed-tracing-design.md |
| Ship logs to a central system | log-aggregation-design.md |
| Design meaningful service metrics | metrics-design-patterns.md |
| Reduce alert noise and on-call burnout | alerting-strategy.md |
| Track cloud spend per team | cost-monitoring-finops.md |
| Diagnose P99 latency spikes | latency-percentiles.md |
| Tune GC pauses | gc-pressure-tuning.md |
| Right-size worker thread pools | thread-pool-sizing.md |
| Speed up slow database queries | database-query-performance.md |
| Choose an APM platform | apm-platforms-comparison.md |
| Choose a log backend | log-aggregation-elk-loki.md |
| Monitor real user experience | real-user-monitoring.md |
| Detect outages before users do | synthetic-monitoring.md |
