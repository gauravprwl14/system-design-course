# Production Observability - SLOs, SLIs, and Error Budgets

> **TL;DR:** Without SLOs, you're flying blind. With bad SLOs, you're flying into a mountain. Get them right or pay with downtime.

## The Wake-Up Call: When 99.9% Isn't Good Enough

**Slack's 2021 Incident:**

```
SLA promised: 99.99% uptime (52 minutes downtime/year)
Actual uptime: 99.98% (105 minutes downtime/year)

Translation:
├── "We're at 99.98%, that's great!" - Engineering
├── "We missed SLA by 53 minutes" - Legal
├── "That's $2M in credits" - Finance
└── "Our users were down for 2 hours during earnings" - Customer

The problem: They tracked uptime, not user impact
```

**After implementing proper SLOs:**

```
New approach:
├── SLI: % of messages delivered < 500ms
├── SLO: 99.9% of messages under 500ms
├── Error budget: 0.1% = 43 minutes/month of slow messages
├── Alert: When burning error budget 2x faster than expected
└── Result: Catch issues BEFORE they become outages
```

---

## The Observability Hierarchy

```
                    ┌─────────────────┐
                    │      SLA        │  ← Contract with customers
                    │  (External)     │     "We promise 99.9%"
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │      SLO        │  ← Internal target
                    │  (Internal)     │     "We aim for 99.95%"
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │      SLI        │  ← Actual measurement
                    │  (Measurement)  │     "Currently at 99.93%"
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ Metrics │        │  Logs   │        │ Traces  │
    └─────────┘        └─────────┘        └─────────┘

The Three Pillars of Observability
```

---

## SLI: Service Level Indicators

### What to Measure

```
THE FOUR GOLDEN SIGNALS (Google SRE):

1. LATENCY
   └── Time to serve a request
   └── SLI: p99 response time < 200ms

2. TRAFFIC
   └── Demand on the system
   └── SLI: Requests per second

3. ERRORS
   └── Rate of failed requests
   └── SLI: Error rate < 0.1%

4. SATURATION
   └── How "full" the system is
   └── SLI: CPU < 70%, Memory < 80%
```

### Good SLIs vs Bad SLIs

```
❌ BAD SLIs:
├── "Server is up" (binary, not useful)
├── "Average response time" (hides tail latency)
├── "Total requests served" (vanity metric)
└── "CPU utilization" (doesn't reflect user experience)

✅ GOOD SLIs:
├── "% of requests < 200ms" (user-centric)
├── "% of requests returning 2xx" (success rate)
├── "% of logins completing < 2s" (journey-based)
└── "% of payments processed successfully" (business-critical)
```

### Implementation

```javascript
// Prometheus metrics for SLIs
const prometheus = require('prom-client');

// Latency histogram (for percentile calculations)
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5]  // 50ms to 5s
});

// Request counter (for error rate)
const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Middleware to record SLIs
function sliMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route?.path || 'unknown',
      status_code: res.statusCode
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });

  next();
}
```

---

## SLO: Service Level Objectives

### Setting the Right Target

```
SLO CALCULATION FRAMEWORK:

1. Start with user expectations
   └── "Users expect checkout < 3 seconds"

2. Measure current performance
   └── "Currently p99 is 2.1 seconds"

3. Set achievable target with buffer
   └── "SLO: 99.9% of checkouts < 3 seconds"

4. Calculate error budget
   └── "0.1% = 43 minutes/month can exceed 3s"

THE MATH:
┌─────────────────────────────────────────────────────────────┐
│  SLO: 99.9%                                                 │
│  Error budget: 100% - 99.9% = 0.1%                         │
│                                                             │
│  Per month (30 days = 43,200 minutes):                     │
│  Error budget = 43,200 × 0.001 = 43.2 minutes              │
│                                                             │
│  Per week: ~10 minutes                                      │
│  Per day: ~1.4 minutes                                      │
└─────────────────────────────────────────────────────────────┘
```

### SLO Examples by Service Type

```yaml
# API Service
api_service:
  availability:
    sli: "% of requests returning non-5xx"
    slo: 99.9%
    window: 30 days
  latency:
    sli: "% of requests < 200ms"
    slo: 99%
    window: 30 days

# Database Service
database:
  availability:
    sli: "% of queries completing successfully"
    slo: 99.99%
  latency:
    sli: "p99 query time"
    slo: "< 50ms"

# Message Queue
queue:
  throughput:
    sli: "% of messages delivered"
    slo: 99.99%
  latency:
    sli: "% of messages delivered < 1 minute"
    slo: 99.9%

# User Journey (composite)
checkout_journey:
  success_rate:
    sli: "% of checkout attempts completing successfully"
    slo: 99.5%
  latency:
    sli: "% of checkouts completing < 30 seconds"
    slo: 99%
```

---

## Error Budgets: The Game Changer

### How Error Budgets Work

```
TRADITIONAL APPROACH:
├── "Don't break anything"
├── "All changes are risky"
├── "Slow, safe deployments"
└── Result: Slow innovation, frustrated developers

ERROR BUDGET APPROACH:
├── "We have 43 minutes/month to spend"
├── "Risky deploy? Costs ~5 minutes if it fails"
├── "Budget remaining: 38 minutes, ship it!"
└── Result: Fast innovation with measured risk

THE PHILOSOPHY:
┌─────────────────────────────────────────────────────────────┐
│  "If we're not occasionally using our error budget,        │
│   we're being too conservative with changes."              │
│                                                             │
│  "If we're always out of error budget,                     │
│   we're being too aggressive with changes."                │
│                                                             │
│  The goal: Spend ~80% of error budget on planned changes   │
└─────────────────────────────────────────────────────────────┘
```

### Error Budget Policies

```javascript
// Error Budget Calculator
class ErrorBudget {
  constructor(sloTarget, windowDays = 30) {
    this.sloTarget = sloTarget;
    this.windowMinutes = windowDays * 24 * 60;
    this.budgetMinutes = this.windowMinutes * (1 - sloTarget);
  }

  calculateRemaining(badMinutes) {
    return {
      total: this.budgetMinutes,
      spent: badMinutes,
      remaining: this.budgetMinutes - badMinutes,
      percentRemaining: ((this.budgetMinutes - badMinutes) / this.budgetMinutes) * 100
    };
  }

  getBurnRate(badMinutesLast24h) {
    const expectedDailyBurn = this.budgetMinutes / 30;
    return badMinutesLast24h / expectedDailyBurn;
  }

  shouldFreezeDeploys(remainingPercent, burnRate) {
    // Freeze if:
    // - Less than 25% budget remaining AND
    // - Burning faster than expected
    return remainingPercent < 25 && burnRate > 1;
  }
}

// Usage
const budget = new ErrorBudget(0.999); // 99.9% SLO
console.log(budget.calculateRemaining(20)); // 20 bad minutes used

// Output:
// {
//   total: 43.2,
//   spent: 20,
//   remaining: 23.2,
//   percentRemaining: 53.7
// }
```

### Burn Rate Alerts

```yaml
# Prometheus alerting rules for error budget
groups:
  - name: slo-alerts
    rules:
      # Fast burn - will exhaust budget in 2 hours
      - alert: HighErrorBudgetBurn
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > (1 - 0.999) * 14.4
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error budget burning 14x faster than sustainable"
          description: "At this rate, monthly error budget exhausted in 2 hours"

      # Slow burn - will exhaust budget in 3 days
      - alert: ElevatedErrorBudgetBurn
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[1h]))
            /
            sum(rate(http_requests_total[1h]))
          ) > (1 - 0.999) * 3
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Error budget burning 3x faster than sustainable"

      # Budget exhausted
      - alert: ErrorBudgetExhausted
        expr: |
          slo:error_budget_remaining:ratio < 0
        labels:
          severity: critical
        annotations:
          summary: "Error budget exhausted - freeze deployments"
```

---

## The Three Pillars: Metrics, Logs, Traces

### Metrics (What's happening)

```javascript
// Prometheus metrics setup
const prometheus = require('prom-client');

// Enable default metrics (CPU, memory, etc.)
prometheus.collectDefaultMetrics();

// Custom business metrics
const ordersProcessed = new prometheus.Counter({
  name: 'orders_processed_total',
  help: 'Total orders processed',
  labelNames: ['status', 'payment_method']
});

const orderValue = new prometheus.Histogram({
  name: 'order_value_dollars',
  help: 'Order value in dollars',
  buckets: [10, 50, 100, 500, 1000, 5000]
});

// Record metrics
function processOrder(order) {
  ordersProcessed.inc({
    status: order.status,
    payment_method: order.paymentMethod
  });
  orderValue.observe(order.total);
}
```

### Logs (What happened)

```javascript
// Structured logging with correlation
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Middleware to add request context
function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuid();
  req.requestId = requestId;

  // Log request
  logger.info('Request received', {
    requestId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent']
  });

  // Log response
  res.on('finish', () => {
    logger.info('Request completed', {
      requestId,
      statusCode: res.statusCode,
      duration: Date.now() - req.startTime
    });
  });

  next();
}
```

### Traces (How it happened)

```javascript
// OpenTelemetry distributed tracing
const { trace, context } = require('@opentelemetry/api');

const tracer = trace.getTracer('order-service');

async function processOrder(order) {
  // Start span
  const span = tracer.startSpan('process-order', {
    attributes: {
      'order.id': order.id,
      'order.items': order.items.length
    }
  });

  try {
    // Child span for inventory check
    const inventorySpan = tracer.startSpan('check-inventory', {
      parent: span
    });
    await checkInventory(order.items);
    inventorySpan.end();

    // Child span for payment
    const paymentSpan = tracer.startSpan('process-payment', {
      parent: span
    });
    await processPayment(order);
    paymentSpan.end();

    span.setStatus({ code: 1 }); // OK
  } catch (error) {
    span.setStatus({ code: 2, message: error.message }); // ERROR
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

---

## Dashboard Design

### SLO Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE: Checkout API                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Error Budget     │  │ Current SLI      │  │ Burn Rate     │ │
│  │ ████████░░ 78%   │  │ 99.94%           │  │ 0.8x          │ │
│  │ 33.7 min remain  │  │ Target: 99.9%    │  │ (sustainable) │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SLI Over Time (30 days)                                   │ │
│  │  100%─┬─────────────────────────────────────────────────── │ │
│  │       │     ╭───╮         ╭──────────────────────────────  │ │
│  │  99.9%├─────┤SLO├─────────┤                                │ │
│  │       │ ╭───╯   ╰─────────╯                                │ │
│  │  99.8%┴─╯                                                  │ │
│  │      Day 1                                        Day 30   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Error Budget Consumption                                  │ │
│  │  ███████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 53%  │ │
│  │  Day 1         Day 15 (now)                       Day 30   │ │
│  │  Projected: Will have 25% remaining at month end           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Grafana Query Examples

```promql
# SLI: Success rate
sum(rate(http_requests_total{status_code!~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))

# SLI: Latency (% under 200ms)
sum(rate(http_request_duration_seconds_bucket{le="0.2"}[5m]))
/
sum(rate(http_request_duration_seconds_count[5m]))

# Error budget remaining (%)
1 - (
  sum(increase(http_requests_total{status_code=~"5.."}[30d]))
  /
  sum(increase(http_requests_total[30d]))
) / (1 - 0.999)

# Burn rate
(
  sum(rate(http_requests_total{status_code=~"5.."}[1h]))
  /
  sum(rate(http_requests_total[1h]))
) / (1 - 0.999) * 720  # 720 hours in 30 days
```

---

## Real-World Examples

### Google

```
Every service has SLOs defined in SLO document:
- Availability: 99.95%
- Latency: p50 < 100ms, p99 < 1s
- Error budget reviewed weekly
- Automatic deploy freezes when budget low
```

### Netflix

```
SLI: Stream start success rate
SLO: 99.99% of play requests succeed
Budget: ~4 minutes of failures per month
Action: Chaos engineering to test resilience
```

### Uber

```
SLI: % of ride requests matched < 60s
SLO: 99.5%
Budget: ~3.5 hours/month of slow matching
Action: Alerts when matching algorithm degrades
```

---

## Key Takeaways

### The SLO Checklist

```
✅ Define SLIs based on USER experience, not server metrics
✅ Set SLOs with buffer below SLA
✅ Calculate and track error budgets
✅ Alert on burn rate, not just thresholds
✅ Use error budget to make deployment decisions
✅ Review SLOs quarterly
✅ Involve stakeholders in SLO definition
```

### Common Mistakes

```
❌ Setting SLO = SLA (no room for error)
❌ Too many SLOs (focus is lost)
❌ SLOs without consequences (toothless)
❌ Alerting on SLI instead of budget burn
❌ Not adjusting SLOs based on reality
```

---

## Related Content

- [Circuit Breaker Pattern](/system-design/patterns/circuit-breaker)
- [Connection Pool Starvation](/problems-at-scale/performance/connection-pool-starvation)
- [Timeout Domino Effect](/problems-at-scale/availability/timeout-domino-effect)
