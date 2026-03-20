---
title: "POC: OpenTelemetry Distributed Tracing — 3 Services, Full Trace in Jaeger"
date: "2026-03-20"
category: "system-design-playbook"
subcategories: ["observability", "distributed-tracing", "opentelemetry", "jaeger", "poc"]
personas: ["Senior Engineer", "Tech Lead", "Staff Engineer", "SRE"]
tags: ["opentelemetry", "otel", "jaeger", "distributed-tracing", "nodejs", "microservices", "trace-context", "sampling", "docker-compose", "poc", "hands-on"]
description: "Complete working OpenTelemetry distributed tracing implementation — 3 Node.js microservices, trace context propagation, manual spans, span attributes, sampling config, and Jaeger visualization."
reading_time: "30 min"
difficulty: "senior"
status: "published"
---

# POC: OpenTelemetry Distributed Tracing — 3 Services, Full Trace in Jaeger

This is the complete implementation. By the end, you will have:
- 3 Node.js microservices passing trace context across HTTP boundaries
- Auto-instrumented HTTP spans + manual business logic spans
- Span attributes that let you search for specific orders/users in Jaeger
- Trace context propagation via W3C `traceparent` header
- 10% head-based sampling + tail-based sampling in the Collector
- Jaeger running locally showing the full distributed trace
- Log correlation: every log line has `trace_id` for click-through from Jaeger

---

## Architecture

```
Client
  └─► Service A: API Gateway (port 3001)
        └─► Service B: Order Service (port 3002)
              └─► Service C: Fraud Service (port 3003)

Each service → OTel Collector (port 4317) → Jaeger (port 16686)
```

A request flows: API GW → Order Service → Fraud Service. Each hop creates a child span with the same `trace_id`. Jaeger shows the full timeline as a flame graph.

---

## Project Structure

```
otel-distributed-tracing-poc/
├── services/
│   ├── api-gateway/
│   │   ├── package.json
│   │   ├── tracing.js
│   │   ├── app.js
│   │   └── Dockerfile
│   ├── order-service/
│   │   ├── package.json
│   │   ├── tracing.js
│   │   ├── app.js
│   │   └── Dockerfile
│   └── fraud-service/
│       ├── package.json
│       ├── tracing.js
│       ├── app.js
│       └── Dockerfile
├── otel-collector/
│   └── otel-collector-config.yaml
└── docker-compose.yml
```

---

## Step 1: Shared Package Dependencies

All three services use the same OTel packages. Each service has its own `package.json`:

```json
{
  "name": "api-gateway",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node -r ./tracing.js app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "@opentelemetry/sdk-node": "^0.48.0",
    "@opentelemetry/auto-instrumentations-node": "^0.42.0",
    "@opentelemetry/exporter-otlp-grpc": "^0.48.0",
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/resources": "^1.21.0",
    "@opentelemetry/semantic-conventions": "^1.21.0",
    "@opentelemetry/sdk-trace-node": "^1.21.0",
    "winston": "^3.11.0"
  }
}
```

Change `"name"` for each service (`order-service`, `fraud-service`).

---

## Step 2: OTel SDK Initialization (shared pattern, different SERVICE_NAME)

This file is identical across services except for the `SERVICE_NAME` env variable.

```javascript
// services/api-gateway/tracing.js
// Load this BEFORE any other require() — SDK must patch modules at startup
// Usage: node -r ./tracing.js app.js

'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const {
  ParentBasedSampler,
  TraceIdRatioBased,
} = require('@opentelemetry/sdk-trace-node');

// Export to OTel Collector (which forwards to Jaeger)
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317',
});

const sdk = new NodeSDK({
  // Service identity — appears in Jaeger's service list and span metadata
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.SERVICE_NAME || 'api-gateway',
    [SemanticResourceAttributes.SERVICE_VERSION]:
      process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      process.env.NODE_ENV || 'development',
  }),

  traceExporter,

  instrumentations: [
    getNodeAutoInstrumentations({
      // Auto-instrument: HTTP client/server, Express routes, axios calls
      '@opentelemetry/instrumentation-http': {
        // Don't create spans for health checks and metrics endpoints
        ignoreIncomingRequestHook: (req) => {
          const ignoredPaths = ['/health', '/metrics', '/ready'];
          return ignoredPaths.includes(req.url);
        },
        // Add request/response body size to spans
        requestHook: (span, request) => {
          span.setAttributes({
            'http.request.header.content-type': request.headers['content-type'] || '',
          });
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
    }),
  ],

  // Sampling: ParentBased means:
  // - If parent is sampled → we are sampled (respect the decision made upstream)
  // - If no parent (root span) → use TraceIdRatioBased(0.1) → 10% sampled
  // In dev, set OTEL_TRACE_SAMPLE_RATE=1.0 to see every trace
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBased(
      parseFloat(process.env.OTEL_TRACE_SAMPLE_RATE || '0.1')
    ),
  }),
});

sdk.start();
console.log(`[OTel] Tracing initialized for ${process.env.SERVICE_NAME || 'api-gateway'}`);

// Flush buffered spans before process exits
// Without this, last N seconds of traces are lost on every deployment
process.on('SIGTERM', async () => {
  try {
    await sdk.shutdown();
    console.log('[OTel] SDK shutdown complete');
  } catch (err) {
    console.error('[OTel] SDK shutdown error:', err);
  } finally {
    process.exit(0);
  }
});

module.exports = sdk;
```

Copy `tracing.js` to each service directory, they are identical — `SERVICE_NAME` is set via environment variable in Docker Compose.

---

## Step 3: Logger with Trace Context Injection

```javascript
// services/shared/logger.js  (copy to each service)
const winston = require('winston');
const { trace, context } = require('@opentelemetry/api');

// Custom Winston format: inject trace_id + span_id into every log entry
// This is what enables Jaeger → Logs correlation
const traceContextFormat = winston.format((info) => {
  const span = trace.getActiveSpan();
  if (span) {
    const { traceId, spanId, traceFlags } = span.spanContext();
    // trace_id in every log line = click trace in Jaeger, search logs by trace_id
    info.trace_id = traceId;
    info.span_id = spanId;
    info.trace_sampled = !!(traceFlags & 0x1);
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    traceContextFormat(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'unknown-service',
  },
  transports: [new winston.transports.Console()],
});

module.exports = logger;
```

---

## Step 4: Service A — API Gateway

```javascript
// services/api-gateway/app.js
// Note: tracing.js is loaded via -r flag in package.json start script
// It must be the first thing that runs

const express = require('express');
const axios = require('axios');
const { trace, SpanStatusCode, context, propagation } = require('@opentelemetry/api');
const logger = require('./logger');

const app = express();
app.use(express.json());

const tracer = trace.getTracer('api-gateway', '1.0.0');

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// Main entry point: POST /checkout
// This is where the distributed trace starts
app.post('/checkout', async (req, res) => {
  const { userId, items, paymentMethod } = req.body;

  // Auto-instrumentation already created an HTTP server span for this request.
  // Add business context to it so you can find it in Jaeger by userId/orderId.
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    currentSpan.setAttributes({
      'user.id': userId,
      'user.tier': req.headers['x-user-tier'] || 'free',
      'checkout.item_count': items?.length || 0,
      'checkout.payment_method': paymentMethod || 'unknown',
    });
  }

  logger.info('Checkout request received', { userId, itemCount: items?.length });

  try {
    // Create a manual span for the "call order service" step
    // This gives us visibility into gateway-side logic separate from HTTP
    const orderResponse = await tracer.startActiveSpan(
      'gateway.create_order',
      async (span) => {
        span.setAttributes({
          'order.user_id': userId,
          'order.item_count': items?.length || 0,
        });

        try {
          // axios is auto-instrumented — it automatically injects traceparent header
          // into the outgoing HTTP request to order-service
          const response = await axios.post(`${ORDER_SERVICE_URL}/orders`, {
            userId,
            items,
            paymentMethod,
          }, {
            timeout: 10000,
            headers: {
              'x-user-tier': req.headers['x-user-tier'] || 'free',
            },
          });

          span.setAttributes({
            'order.id': response.data.orderId,
            'order.status': response.data.status,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return response.data;
        } catch (err) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.end();
          throw err;
        }
      }
    );

    logger.info('Checkout complete', { orderId: orderResponse.orderId, userId });
    res.json({
      status: 'success',
      orderId: orderResponse.orderId,
      // Return trace ID so the client can reference it in support tickets
      traceId: trace.getActiveSpan()?.spanContext().traceId,
    });

  } catch (err) {
    logger.error('Checkout failed', { error: err.message, userId });
    res.status(500).json({ error: 'Checkout failed', details: err.message });
  }
});

// Simulate load for interesting traces
app.get('/simulate', async (req, res) => {
  const count = parseInt(req.query.count || '10', 10);
  const results = [];

  for (let i = 0; i < count; i++) {
    try {
      const resp = await axios.post('http://localhost:3001/checkout', {
        userId: `user-${Math.floor(Math.random() * 1000)}`,
        items: [{ sku: 'widget-a', qty: Math.floor(Math.random() * 5) + 1 }],
        paymentMethod: ['card', 'paypal'][Math.floor(Math.random() * 2)],
      });
      results.push({ status: 'ok', orderId: resp.data.orderId });
    } catch (e) {
      results.push({ status: 'error', error: e.message });
    }
    await sleep(50);
  }

  res.json({ simulated: count, results });
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
```

---

## Step 5: Service B — Order Service

```javascript
// services/order-service/app.js
const express = require('express');
const axios = require('axios');
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const logger = require('./logger');

const app = express();
app.use(express.json());

const tracer = trace.getTracer('order-service', '1.0.0');
const FRAUD_SERVICE_URL = process.env.FRAUD_SERVICE_URL || 'http://fraud-service:3003';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));

app.post('/orders', async (req, res) => {
  const { userId, items, paymentMethod } = req.body;

  // The traceparent header from the API Gateway is automatically extracted
  // by OTel auto-instrumentation. This span is a CHILD of the gateway span.
  const currentSpan = trace.getActiveSpan();
  const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  if (currentSpan) {
    currentSpan.setAttributes({
      'order.id': orderId,
      'order.user_id': userId,
      'order.item_count': items?.length || 0,
      'order.total_items': items?.reduce((sum, i) => sum + i.qty, 0) || 0,
    });
  }

  logger.info('Processing order', { orderId, userId, itemCount: items?.length });

  try {
    // --- Step 1: Validate inventory (manual span) ---
    await tracer.startActiveSpan('order.validate_inventory', async (span) => {
      span.setAttributes({ 'inventory.item_count': items?.length || 0 });

      // Simulate DB query for inventory check
      const delay = 20 + Math.random() * 80;
      await sleep(delay);

      // Simulate occasional out-of-stock
      if (Math.random() < 0.05) {
        const err = new Error('Item out of stock: widget-a');
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.end();
        throw err;
      }

      span.setAttributes({ 'inventory.all_available': true });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });

    // --- Step 2: Fraud check (call fraud service — creates another child span) ---
    const fraudResult = await tracer.startActiveSpan(
      'order.fraud_check',
      async (span) => {
        span.setAttributes({
          'fraud.user_id': userId,
          'fraud.payment_method': paymentMethod,
        });

        try {
          // axios auto-instrumentation injects traceparent into this HTTP call
          // fraud-service will create a child span with the same trace_id
          const response = await axios.post(`${FRAUD_SERVICE_URL}/check`, {
            userId,
            orderId,
            amount: items?.reduce((sum, i) => sum + i.qty * 9.99, 0) || 9.99,
            paymentMethod,
          }, { timeout: 5000 });

          span.setAttributes({
            'fraud.score': response.data.score,
            'fraud.decision': response.data.decision,
            'fraud.rules_evaluated': response.data.rulesEvaluated,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return response.data;
        } catch (err) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.end();
          throw err;
        }
      }
    );

    if (fraudResult.decision === 'block') {
      logger.warn('Order blocked by fraud check', { orderId, fraudScore: fraudResult.score });
      currentSpan?.addEvent('order.blocked', { reason: 'fraud_score' });
      return res.status(402).json({ error: 'Order blocked by fraud check' });
    }

    // --- Step 3: Save order to DB (manual span) ---
    await tracer.startActiveSpan('order.persist', async (span) => {
      span.setAttributes({
        'db.operation': 'INSERT',
        'db.table': 'orders',
        'order.id': orderId,
      });

      const dbDelay = 10 + Math.random() * 40;
      await sleep(dbDelay);

      span.addEvent('order.saved', { timestamp: Date.now() });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });

    logger.info('Order created successfully', { orderId, userId });
    res.status(201).json({
      orderId,
      status: 'created',
      fraudScore: fraudResult.score,
    });

  } catch (err) {
    logger.error('Order creation failed', { error: err.message, orderId });
    res.status(500).json({ error: err.message });
  }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`Order Service running on port ${PORT}`);
});
```

---

## Step 6: Service C — Fraud Service

```javascript
// services/fraud-service/app.js
const express = require('express');
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const logger = require('./logger');

const app = express();
app.use(express.json());

const tracer = trace.getTracer('fraud-service', '1.0.0');

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'fraud-service' }));

app.post('/check', async (req, res) => {
  const { userId, orderId, amount, paymentMethod } = req.body;

  // This span is a child of the order-service's 'order.fraud_check' span
  // All three services share the same trace_id
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    currentSpan.setAttributes({
      'fraud.user_id': userId,
      'fraud.order_id': orderId,
      'fraud.amount': amount,
    });
  }

  logger.info('Running fraud check', { userId, orderId, amount });

  try {
    // --- Rule 1: Velocity check (how many orders in last hour) ---
    const velocityScore = await tracer.startActiveSpan(
      'fraud.rule.velocity_check',
      async (span) => {
        // Simulate fetching order history from Redis
        const delay = 5 + Math.random() * 25;
        await sleep(delay);

        const recentOrders = Math.floor(Math.random() * 10);
        const score = recentOrders > 5 ? 0.7 : 0.1;

        span.setAttributes({
          'fraud.rule': 'velocity',
          'fraud.recent_orders_1h': recentOrders,
          'fraud.rule_score': score,
        });
        span.end();
        return score;
      }
    );

    // --- Rule 2: Amount anomaly check ---
    const amountScore = await tracer.startActiveSpan(
      'fraud.rule.amount_anomaly',
      async (span) => {
        const delay = 10 + Math.random() * 40;
        await sleep(delay);

        // High amounts from new payment methods are suspicious
        const isHighAmount = amount > 500;
        const isNewPaymentMethod = Math.random() < 0.3;
        const score = isHighAmount && isNewPaymentMethod ? 0.8 : 0.05;

        span.setAttributes({
          'fraud.rule': 'amount_anomaly',
          'fraud.is_high_amount': isHighAmount,
          'fraud.is_new_payment_method': isNewPaymentMethod,
          'fraud.rule_score': score,
        });
        span.end();
        return score;
      }
    );

    // --- Rule 3: External risk API (simulate slow external call) ---
    const externalScore = await tracer.startActiveSpan(
      'fraud.rule.external_risk_api',
      async (span) => {
        span.setAttributes({
          'fraud.external_api': 'risk-provider-v2',
          'fraud.user_id': userId,
        });

        // This is the slow call — simulate external API latency variance
        // Sometimes this takes 50ms, sometimes 3000ms (that's the bug you're debugging)
        const isSlowDay = Math.random() < 0.15;
        const delay = isSlowDay
          ? 1500 + Math.random() * 2000  // slow: 1.5-3.5 seconds
          : 30 + Math.random() * 70;      // normal: 30-100ms

        await sleep(delay);

        if (isSlowDay) {
          // Add an event to the span to explain the slowness
          span.addEvent('external_api.slow_response', {
            'api.response_time_ms': delay,
            'api.degraded': true,
          });
        }

        const score = Math.random() * 0.3;
        span.setAttributes({
          'fraud.external_score': score,
          'fraud.api_response_ms': delay,
        });
        span.end();
        return score;
      }
    );

    // --- Aggregate scores ---
    const totalScore = (velocityScore * 0.3) + (amountScore * 0.4) + (externalScore * 0.3);
    const decision = totalScore > 0.7 ? 'block' : 'approve';
    const rulesEvaluated = ['velocity', 'amount_anomaly', 'external_risk_api'];

    // Add final decision to the current (root fraud check) span
    if (currentSpan) {
      currentSpan.setAttributes({
        'fraud.final_score': totalScore,
        'fraud.decision': decision,
        'fraud.velocity_score': velocityScore,
        'fraud.amount_score': amountScore,
        'fraud.external_score': externalScore,
      });
    }

    logger.info('Fraud check complete', { userId, orderId, score: totalScore, decision });

    res.json({
      score: totalScore,
      decision,
      rulesEvaluated: rulesEvaluated.length,
    });

  } catch (err) {
    logger.error('Fraud check error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  logger.info(`Fraud Service running on port ${PORT}`);
});
```

---

## Step 7: OTel Collector Configuration

```yaml
# otel-collector/otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 512
    send_batch_max_size: 1024

  # Add environment labels to all spans
  resource:
    attributes:
      - action: insert
        key: deployment.environment
        value: development

  # Tail-based sampling: keep errors and slow traces
  # Decision made after all spans arrive (up to decision_wait seconds)
  tail_sampling:
    decision_wait: 10s
    num_traces: 10000
    expected_new_traces_per_sec: 100
    policies:
      # ALWAYS keep traces with errors
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }

      # ALWAYS keep slow traces (> 1 second total)
      - name: slow-traces
        type: latency
        latency: { threshold_ms: 1000 }

      # Keep 10% of everything else
      - name: default-10pct
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true

  # Also log to console for debugging during development
  logging:
    loglevel: warn

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, resource, tail_sampling]
      exporters: [otlp/jaeger, logging]
```

---

## Step 8: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  api-gateway:
    build:
      context: ./services/api-gateway
    ports:
      - "3001:3001"
    environment:
      - SERVICE_NAME=api-gateway
      - SERVICE_VERSION=1.0.0
      - PORT=3001
      - NODE_ENV=development
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - OTEL_TRACE_SAMPLE_RATE=1.0        # 100% in dev — see every trace
      - ORDER_SERVICE_URL=http://order-service:3002
    depends_on:
      - otel-collector
    networks:
      - tracing

  order-service:
    build:
      context: ./services/order-service
    ports:
      - "3002:3002"
    environment:
      - SERVICE_NAME=order-service
      - SERVICE_VERSION=1.0.0
      - PORT=3002
      - NODE_ENV=development
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - OTEL_TRACE_SAMPLE_RATE=1.0
      - FRAUD_SERVICE_URL=http://fraud-service:3003
    depends_on:
      - otel-collector
    networks:
      - tracing

  fraud-service:
    build:
      context: ./services/fraud-service
    ports:
      - "3003:3003"
    environment:
      - SERVICE_NAME=fraud-service
      - SERVICE_VERSION=1.0.0
      - PORT=3003
      - NODE_ENV=development
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - OTEL_TRACE_SAMPLE_RATE=1.0
    depends_on:
      - otel-collector
    networks:
      - tracing

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.91.0
    # Use -contrib for tail_sampling processor (not in core collector)
    volumes:
      - ./otel-collector/otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "8888:8888"   # Collector metrics
    depends_on:
      - jaeger
    networks:
      - tracing

  jaeger:
    image: jaegertracing/all-in-one:1.52
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"   # Jaeger UI
      - "4317"          # OTLP gRPC (internal, not exposed to host)
    networks:
      - tracing

networks:
  tracing:
    driver: bridge
```

### Shared Dockerfile (same for all 3 services)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "-r", "./tracing.js", "app.js"]
```

---

## Step 9: Run the Stack

```bash
# Build and start all services
docker compose up -d --build

# Check all services are running
docker compose ps

# Tail logs to watch trace output
docker compose logs -f

# Verify health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

---

## Step 10: Send a Request and Find the Trace

### Trigger a single checkout

```bash
curl -X POST http://localhost:3001/checkout \
  -H "Content-Type: application/json" \
  -H "x-user-tier: pro" \
  -d '{
    "userId": "user-42",
    "items": [{"sku": "widget-a", "qty": 2}, {"sku": "widget-b", "qty": 1}],
    "paymentMethod": "card"
  }'

# Response includes trace_id:
# {
#   "status": "success",
#   "orderId": "order-1705678901234-abc123",
#   "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
# }
```

### Find the trace in Jaeger

```bash
# Open Jaeger UI
open http://localhost:16686

# Search for the trace:
# 1. Service: api-gateway
# 2. Operation: POST /checkout
# 3. Click "Find Traces"
# 4. Click the trace that matches your request time
# 5. See the full flame graph: api-gateway → order-service → fraud-service
```

### What you'll see in Jaeger

```
api-gateway: POST /checkout                   [4.2s]
├── gateway.create_order                      [3.9s]
│   └── HTTP POST order-service/orders        [3.85s]    ← auto-instrumented
│       └── order-service: POST /orders       [3.8s]
│           ├── order.validate_inventory      [45ms]
│           ├── order.fraud_check             [3.7s]
│           │   └── HTTP POST fraud-service   [3.65s]    ← auto-instrumented
│           │       └── fraud-service: POST /check [3.6s]
│           │           ├── fraud.rule.velocity_check     [18ms]
│           │           ├── fraud.rule.amount_anomaly     [25ms]
│           │           └── fraud.rule.external_risk_api [3.52s]  ← THE SLOW ONE
│           └── order.persist                 [23ms]
```

The 3.8 second delay is immediately visible as `fraud.rule.external_risk_api`. Click it. See the span event `external_api.slow_response` with `api.degraded: true`. Done in 10 seconds.

---

## Step 11: Search by Span Attributes

Jaeger lets you search for traces by any span attribute you added.

```bash
# Find all traces for a specific user
# In Jaeger UI → Search → Tags → user.id=user-42

# Find all traces where fraud was blocked
# Tags → fraud.decision=block

# Find all traces with high fraud score
# Tags → fraud.final_score>0.7

# Find traces for a specific order
# Tags → order.id=order-1705678901234-abc123
```

This is why you add span attributes. Without them, you can find traces by time and service. With them, you can find "all checkouts by enterprise users that were blocked by fraud in the last 2 hours."

---

## Step 12: Generate Load and Explore the Service Graph

```bash
# Trigger 100 checkout requests
curl "http://localhost:3001/simulate?count=100"

# This generates a mix of:
# - Fast traces (~85%): <200ms
# - Slow traces (~15%): 1.5-3.5 seconds (fraud API slowness)
# - Error traces (~5%): inventory out-of-stock or fraud blocks
```

In Jaeger UI:
1. Click **System Architecture** tab — auto-generated service dependency graph
2. Click **Compare** tab — select two traces to compare their span timelines
3. Click a trace, then **Trace Statistics** — see time distribution by operation name

---

## What to Explore Next

### Add a 4th Service (Database Layer)

Extend the chain: Fraud Service → User Profile Service (hits PostgreSQL).
Auto-instrumentation handles `pg` queries automatically — you'll see `SELECT * FROM users` as a span with `db.statement`.

### Try Without the traceparent Header

Remove the axios auto-instrumentation from one service:
```javascript
'@opentelemetry/instrumentation-http': { enabled: false }
```
Restart and send a request. In Jaeger, you'll see two disconnected traces instead of one — the chain is broken. This demonstrates why every service must propagate context.

### Baggage Propagation

Add user tier to baggage in the API Gateway and read it in the Fraud Service without passing it through the Order Service:

```javascript
// api-gateway/app.js — set baggage
const baggage = propagation.createBaggage({
  'user.tier': { value: req.headers['x-user-tier'] || 'free' },
});
const ctx = propagation.setBaggage(context.active(), baggage);
context.with(ctx, () => makeOrderRequest());

// fraud-service/app.js — read baggage (no code change in order-service needed)
const baggage = propagation.getBaggage(context.active());
const tier = baggage?.getEntry('user.tier')?.value;
```

### Switch to 10% Sampling in Production Mode

```bash
# In docker-compose.yml, change:
OTEL_TRACE_SAMPLE_RATE=0.1

# Restart services
docker compose up -d api-gateway order-service fraud-service

# Send 100 requests
curl "http://localhost:3001/simulate?count=100"

# In Jaeger: you'll see ~10 traces from 100 requests
# But ALL error traces are still present (tail-sampling policy: errors always kept)
```

---

## Cleanup

```bash
docker compose down -v
```
