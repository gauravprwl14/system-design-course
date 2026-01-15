# POC #80: SLO Dashboard & Error Budgets

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Node.js, Metrics concepts

## What You'll Learn

SLO dashboards track service reliability and error budgets, helping teams make data-driven decisions about reliability vs velocity.

```
SLO DASHBOARD:
┌─────────────────────────────────────────────────────────────────┐
│  Service: Payment API          SLO: 99.9% availability         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Current Month: 99.92%  ██████████████████████░░░ Budget: 72%  │
│                                                                 │
│  Error Budget: 43.2 min remaining of 43.8 min (30-day)         │
│  ────────────────────────────────────────────────────────────  │
│  Burn Rate: 0.8x normal (healthy)                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Availability over time                              │       │
│  │  100%├──────────────────────────────────────────────│       │
│  │      │     ╭──────╮    ╭─────────────────────────   │       │
│  │ 99.9%├─────┴──────┴────┴─────────────────────────── │       │
│  │      │                         ↓ incident           │       │
│  │ 99.5%├──────────────────────╯                       │       │
│  │      └──────────────────────────────────────────────│       │
│  │      Week 1    Week 2    Week 3    Week 4           │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// slo-dashboard.js

// ==========================================
// SLI (Service Level Indicator) COLLECTOR
// ==========================================

class SLICollector {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 30 * 24 * 60; // 30 days in minutes
    this.bucketSize = options.bucketSize || 1; // 1-minute buckets
    this.buckets = new Map(); // timestamp -> { good, total }
    this.metrics = {
      availability: [],
      latency: [],
      errorRate: []
    };
  }

  // Record a request outcome
  recordRequest(success, latencyMs) {
    const bucket = this.getCurrentBucket();

    if (!this.buckets.has(bucket)) {
      this.buckets.set(bucket, { good: 0, total: 0, latencies: [] });
    }

    const data = this.buckets.get(bucket);
    data.total++;
    if (success) data.good++;
    data.latencies.push(latencyMs);

    this.pruneOldBuckets();
  }

  getCurrentBucket() {
    return Math.floor(Date.now() / (this.bucketSize * 60 * 1000));
  }

  pruneOldBuckets() {
    const cutoff = this.getCurrentBucket() - this.windowSize;
    for (const [bucket] of this.buckets) {
      if (bucket < cutoff) {
        this.buckets.delete(bucket);
      }
    }
  }

  // Calculate availability SLI
  getAvailability(windowMinutes = this.windowSize) {
    const cutoff = this.getCurrentBucket() - windowMinutes;
    let good = 0, total = 0;

    for (const [bucket, data] of this.buckets) {
      if (bucket >= cutoff) {
        good += data.good;
        total += data.total;
      }
    }

    return total > 0 ? (good / total) * 100 : 100;
  }

  // Calculate latency percentile SLI
  getLatencyPercentile(percentile = 99, windowMinutes = this.windowSize) {
    const cutoff = this.getCurrentBucket() - windowMinutes;
    const latencies = [];

    for (const [bucket, data] of this.buckets) {
      if (bucket >= cutoff) {
        latencies.push(...data.latencies);
      }
    }

    if (latencies.length === 0) return 0;

    latencies.sort((a, b) => a - b);
    const index = Math.ceil(latencies.length * percentile / 100) - 1;
    return latencies[index];
  }

  // Get time-series data for charting
  getTimeSeries(windowMinutes = 60 * 24) { // Last 24 hours
    const cutoff = this.getCurrentBucket() - windowMinutes;
    const series = [];

    for (const [bucket, data] of this.buckets) {
      if (bucket >= cutoff) {
        series.push({
          timestamp: bucket * this.bucketSize * 60 * 1000,
          availability: data.total > 0 ? (data.good / data.total) * 100 : 100,
          requestCount: data.total,
          p99Latency: this.calculateP99(data.latencies)
        });
      }
    }

    return series.sort((a, b) => a.timestamp - b.timestamp);
  }

  calculateP99(latencies) {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * 0.99) - 1];
  }
}

// ==========================================
// SLO (Service Level Objective)
// ==========================================

class SLO {
  constructor(name, config) {
    this.name = name;
    this.target = config.target;  // e.g., 99.9
    this.type = config.type;      // 'availability' | 'latency'
    this.latencyThreshold = config.latencyThreshold;  // for latency SLOs
    this.windowDays = config.windowDays || 30;
  }

  // Calculate error budget (in minutes)
  getErrorBudgetMinutes() {
    const totalMinutes = this.windowDays * 24 * 60;
    const allowedDowntimePercent = 100 - this.target;
    return totalMinutes * (allowedDowntimePercent / 100);
  }

  // Calculate remaining error budget
  getRemainingBudget(currentSLI) {
    const totalBudget = this.getErrorBudgetMinutes();
    const usedPercent = Math.max(0, this.target - currentSLI);
    const usedMinutes = (usedPercent / (100 - this.target)) * totalBudget;

    return {
      totalMinutes: totalBudget,
      usedMinutes: Math.min(usedMinutes, totalBudget),
      remainingMinutes: Math.max(0, totalBudget - usedMinutes),
      remainingPercent: Math.max(0, ((totalBudget - usedMinutes) / totalBudget) * 100)
    };
  }

  // Calculate burn rate
  getBurnRate(currentSLI, windowHours = 1) {
    // Burn rate = actual error rate / allowed error rate
    const actualErrorRate = 100 - currentSLI;
    const allowedErrorRate = 100 - this.target;

    if (allowedErrorRate === 0) return Infinity;
    return actualErrorRate / allowedErrorRate;
  }

  // Check if SLO is met
  isMet(currentSLI) {
    return currentSLI >= this.target;
  }
}

// ==========================================
// SLO DASHBOARD
// ==========================================

class SLODashboard {
  constructor() {
    this.services = new Map(); // serviceName -> { collector, slos }
  }

  registerService(name, slos) {
    this.services.set(name, {
      collector: new SLICollector(),
      slos: slos.map(config => new SLO(config.name, config))
    });
  }

  recordRequest(serviceName, success, latencyMs) {
    const service = this.services.get(serviceName);
    if (service) {
      service.collector.recordRequest(success, latencyMs);
    }
  }

  getServiceStatus(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return null;

    const { collector, slos } = service;
    const availability = collector.getAvailability();
    const p99Latency = collector.getLatencyPercentile(99);

    return {
      service: serviceName,
      currentAvailability: availability.toFixed(3),
      p99LatencyMs: p99Latency,
      slos: slos.map(slo => {
        const currentSLI = slo.type === 'availability'
          ? availability
          : (p99Latency <= slo.latencyThreshold ? 100 : 0);

        const budget = slo.getRemainingBudget(currentSLI);
        const burnRate = slo.getBurnRate(currentSLI);

        return {
          name: slo.name,
          target: slo.target,
          current: currentSLI.toFixed(3),
          isMet: slo.isMet(currentSLI),
          errorBudget: {
            total: budget.totalMinutes.toFixed(1),
            remaining: budget.remainingMinutes.toFixed(1),
            remainingPercent: budget.remainingPercent.toFixed(1),
            status: this.getBudgetStatus(budget.remainingPercent)
          },
          burnRate: {
            value: burnRate.toFixed(2),
            status: this.getBurnRateStatus(burnRate)
          }
        };
      }),
      timeSeries: collector.getTimeSeries()
    };
  }

  getBudgetStatus(remainingPercent) {
    if (remainingPercent > 50) return '🟢 healthy';
    if (remainingPercent > 25) return '🟡 caution';
    if (remainingPercent > 0) return '🟠 critical';
    return '🔴 exhausted';
  }

  getBurnRateStatus(burnRate) {
    if (burnRate < 1) return '🟢 under budget';
    if (burnRate < 2) return '🟡 at budget';
    if (burnRate < 10) return '🟠 high burn';
    return '🔴 critical burn';
  }

  // Generate ASCII dashboard
  renderDashboard(serviceName) {
    const status = this.getServiceStatus(serviceName);
    if (!status) return 'Service not found';

    let output = '\n' + '='.repeat(70) + '\n';
    output += `SLO DASHBOARD: ${status.service}\n`;
    output += '='.repeat(70) + '\n\n';

    output += `Current Availability: ${status.currentAvailability}%\n`;
    output += `P99 Latency: ${status.p99LatencyMs}ms\n\n`;

    for (const slo of status.slos) {
      output += `─── ${slo.name} ───\n`;
      output += `Target: ${slo.target}% | Current: ${slo.current}% | `;
      output += slo.isMet ? '✅ MET' : '❌ MISSED';
      output += '\n';

      // Error budget bar
      const budgetBar = this.renderBar(parseFloat(slo.errorBudget.remainingPercent));
      output += `Error Budget: [${budgetBar}] ${slo.errorBudget.remainingPercent}%\n`;
      output += `  ${slo.errorBudget.remaining} of ${slo.errorBudget.total} minutes remaining\n`;
      output += `  Status: ${slo.errorBudget.status}\n`;
      output += `  Burn Rate: ${slo.burnRate.value}x (${slo.burnRate.status})\n\n`;
    }

    return output;
  }

  renderBar(percent, width = 30) {
    const filled = Math.round((percent / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }
}

// ==========================================
// ALERTING RULES
// ==========================================

class SLOAlertManager {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.alerts = [];
  }

  // Multi-window burn rate alerting (Google SRE approach)
  checkAlerts(serviceName) {
    const status = this.dashboard.getServiceStatus(serviceName);
    if (!status) return [];

    const alerts = [];

    for (const slo of status.slos) {
      const burnRate = parseFloat(slo.burnRate.value);
      const budgetRemaining = parseFloat(slo.errorBudget.remainingPercent);

      // Critical: 14.4x burn rate over 1 hour (2% budget consumed)
      if (burnRate >= 14.4) {
        alerts.push({
          severity: 'critical',
          slo: slo.name,
          message: `Critical burn rate: ${burnRate}x - will exhaust budget in ~${(100/burnRate).toFixed(1)} hours`,
          action: 'Page on-call immediately'
        });
      }
      // High: 6x burn rate over 6 hours (25% budget consumed)
      else if (burnRate >= 6) {
        alerts.push({
          severity: 'high',
          slo: slo.name,
          message: `High burn rate: ${burnRate}x - consuming budget faster than expected`,
          action: 'Investigate within 30 minutes'
        });
      }
      // Warning: 3x burn rate (budget depleting)
      else if (burnRate >= 3) {
        alerts.push({
          severity: 'warning',
          slo: slo.name,
          message: `Elevated burn rate: ${burnRate}x`,
          action: 'Monitor closely'
        });
      }

      // Budget exhaustion alerts
      if (budgetRemaining <= 0) {
        alerts.push({
          severity: 'critical',
          slo: slo.name,
          message: 'Error budget exhausted!',
          action: 'Freeze deployments, focus on reliability'
        });
      } else if (budgetRemaining <= 10) {
        alerts.push({
          severity: 'high',
          slo: slo.name,
          message: `Only ${budgetRemaining}% error budget remaining`,
          action: 'Reduce risky changes'
        });
      }
    }

    return alerts;
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('SLO DASHBOARD & ERROR BUDGETS');
  console.log('='.repeat(60));

  // Create dashboard
  const dashboard = new SLODashboard();

  // Register Payment API with SLOs
  dashboard.registerService('payment-api', [
    { name: 'Availability', type: 'availability', target: 99.9, windowDays: 30 },
    { name: 'Latency P99', type: 'latency', target: 99, latencyThreshold: 200, windowDays: 30 }
  ]);

  // Simulate traffic
  console.log('\n--- Simulating traffic... ---\n');

  // Normal operation (99.95% success rate)
  for (let i = 0; i < 10000; i++) {
    const success = Math.random() < 0.9995;
    const latency = success ? 50 + Math.random() * 100 : 500 + Math.random() * 500;
    dashboard.recordRequest('payment-api', success, latency);
  }

  console.log(dashboard.renderDashboard('payment-api'));

  // Simulate an incident (90% success rate for a period)
  console.log('--- Simulating incident... ---\n');

  for (let i = 0; i < 1000; i++) {
    const success = Math.random() < 0.90;
    const latency = success ? 100 + Math.random() * 200 : 1000 + Math.random() * 500;
    dashboard.recordRequest('payment-api', success, latency);
  }

  console.log(dashboard.renderDashboard('payment-api'));

  // Check alerts
  const alertManager = new SLOAlertManager(dashboard);
  const alerts = alertManager.checkAlerts('payment-api');

  if (alerts.length > 0) {
    console.log('--- ALERTS ---\n');
    alerts.forEach(alert => {
      const icon = alert.severity === 'critical' ? '🚨' :
                   alert.severity === 'high' ? '⚠️' : '⚡';
      console.log(`${icon} [${alert.severity.toUpperCase()}] ${alert.slo}`);
      console.log(`   ${alert.message}`);
      console.log(`   Action: ${alert.action}\n`);
    });
  }

  console.log('✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## SLO Concepts

| Term | Definition | Example |
|------|------------|---------|
| **SLI** | Service Level Indicator - metric | 99.95% successful requests |
| **SLO** | Service Level Objective - target | "99.9% availability" |
| **SLA** | Service Level Agreement - contract | "Refund if <99.9%" |
| **Error Budget** | Allowed downtime | 43.8 min/month for 99.9% |
| **Burn Rate** | Budget consumption speed | 2x = depleted in 15 days |

---

## Multi-Window Burn Rate Alerts

```
Google SRE Alerting Strategy:
┌────────────────┬────────────┬─────────────────────────────────┐
│ Burn Rate      │ Window     │ Alert                           │
├────────────────┼────────────┼─────────────────────────────────┤
│ 14.4x          │ 1 hour     │ 🚨 Page immediately             │
│ 6x             │ 6 hours    │ ⚠️ Page within 30 min           │
│ 3x             │ 3 days     │ 📧 Ticket, investigate          │
│ 1x             │ 30 days    │ ✅ Normal                       │
└────────────────┴────────────┴─────────────────────────────────┘

Why multi-window?
- Short window (1h): Catches fast-burning incidents
- Long window (3d): Catches slow degradation
- Reduces alert fatigue while catching real issues
```

---

## Error Budget Policy

```javascript
// Example error budget policy
const errorBudgetPolicy = {
  healthy: {    // >50% remaining
    deployments: 'normal',
    riskTolerance: 'high',
    focusArea: 'features'
  },
  caution: {    // 25-50% remaining
    deployments: 'reduced frequency',
    riskTolerance: 'medium',
    focusArea: 'balanced'
  },
  critical: {   // 10-25% remaining
    deployments: 'essential only',
    riskTolerance: 'low',
    focusArea: 'reliability'
  },
  exhausted: {  // <10% remaining
    deployments: 'frozen except fixes',
    riskTolerance: 'none',
    focusArea: 'reliability only'
  }
};
```

---

## Prometheus Queries

```promql
# Availability SLI (success rate)
sum(rate(http_requests_total{status=~"2.."}[30d]))
/
sum(rate(http_requests_total[30d]))

# Error budget remaining
(1 - (
  sum(rate(http_requests_total{status=~"5.."}[30d]))
  /
  sum(rate(http_requests_total[30d]))
)) - 0.999

# Burn rate (1-hour window)
(
  sum(rate(http_requests_total{status=~"5.."}[1h]))
  /
  sum(rate(http_requests_total[1h]))
) / 0.001  # 0.001 = 100% - 99.9% SLO
```

---

## Related POCs

- [Observability & SLOs](/system-design/monitoring/observability-slos)
- [Graceful Degradation](/interview-prep/practice-pocs/graceful-degradation)
- [Distributed Tracing](/interview-prep/practice-pocs/distributed-tracing)
