# 09-observability/hands-on/ — Layer 2 Router

Runnable observability POCs — Prometheus, OpenTelemetry, ELK, SLO dashboards, load testing, health checks, and synthetic monitoring.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Setup guide and introduction to hands-on observability exercises |
| prometheus-nodejs-poc | POC exposing custom Prometheus metrics from a Node.js service and scraping with Prometheus |
| otel-distributed-tracing-poc | POC instrumenting a multi-service app with OpenTelemetry and exporting traces to Jaeger |
| distributed-tracing | Walkthrough of distributed tracing concepts with a working trace propagation example |
| slo-dashboard | POC building a Grafana SLO dashboard with error budget burn rate panels |
| load-testing-k6 | POC running load tests with k6, including ramp-up, thresholds, and result analysis |
| health-check-patterns | POC implementing liveness, readiness, and deep health check endpoints |
| elk-stack-poc | POC setting up Elasticsearch, Logstash, and Kibana for log aggregation |
| synthetic-monitoring-poc | POC writing synthetic uptime checks and alerting on probe failures |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Emit and scrape metrics from a Node.js app | prometheus-nodejs-poc.md |
| Add distributed tracing to microservices | otel-distributed-tracing-poc.md, distributed-tracing.md |
| Visualize SLOs in Grafana | slo-dashboard.md |
| Stress test a service and measure percentiles | load-testing-k6.md |
| Implement Kubernetes-compatible health checks | health-check-patterns.md |
| Aggregate and search logs locally | elk-stack-poc.md |
| Monitor endpoint availability proactively | synthetic-monitoring-poc.md |
