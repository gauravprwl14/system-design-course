# POC #92: Chaos Engineering

> **Difficulty:** 🔴 Advanced
> **Time:** 30 minutes
> **Prerequisites:** Node.js, Distributed systems concepts

## What You'll Learn

Chaos Engineering proactively tests system resilience by injecting controlled failures. This reveals weaknesses before they cause production incidents.

```
CHAOS ENGINEERING PROCESS:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. STEADY STATE     2. HYPOTHESIS      3. EXPERIMENT           │
│  ─────────────       ──────────         ──────────              │
│                                                                 │
│  Define normal       "System will       Inject failure:         │
│  behavior:           handle X           - Kill instance         │
│  - 99.9% uptime      failure with       - Add latency           │
│  - p95 < 200ms       <5% degradation"   - Drop packets          │
│  - Error rate <1%                       - Fill disk             │
│                                                                 │
│  4. ANALYZE          5. FIX             6. REPEAT               │
│  ───────             ───                ──────                  │
│                                                                 │
│  Did system          Improve            Increase blast          │
│  maintain steady     resilience:        radius, run in          │
│  state?              - Add retries      production              │
│                      - Circuit breaker                          │
│                      - Timeouts                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// chaos-engineering.js

// ==========================================
// CHAOS MONKEY - FAILURE INJECTION
// ==========================================

class ChaosMonkey {
  constructor(options = {}) {
    this.enabled = options.enabled || false;
    this.experiments = new Map();
    this.activeExperiments = new Set();
    this.results = [];
  }

  // Register an experiment
  registerExperiment(name, experiment) {
    this.experiments.set(name, {
      name,
      inject: experiment.inject,
      restore: experiment.restore,
      probability: experiment.probability || 1.0,
      duration: experiment.duration || 60000,
      targetSelector: experiment.targetSelector || (() => true)
    });
    console.log(`🐒 Registered experiment: ${name}`);
  }

  // Start an experiment
  async startExperiment(name, options = {}) {
    if (!this.enabled) {
      console.log('⚠️ Chaos Monkey is disabled');
      return;
    }

    const experiment = this.experiments.get(name);
    if (!experiment) {
      throw new Error(`Experiment not found: ${name}`);
    }

    const experimentId = `${name}-${Date.now()}`;
    const startTime = Date.now();

    console.log(`\n🔥 Starting chaos experiment: ${name}`);
    console.log(`   ID: ${experimentId}`);
    console.log(`   Duration: ${experiment.duration}ms`);

    const context = {
      id: experimentId,
      name,
      startTime,
      options
    };

    // Inject failure
    try {
      await experiment.inject(context);
      this.activeExperiments.add(experimentId);

      // Auto-restore after duration
      setTimeout(async () => {
        await this.stopExperiment(experimentId, experiment, context);
      }, experiment.duration);

      return experimentId;
    } catch (error) {
      console.error(`❌ Failed to start experiment: ${error.message}`);
      throw error;
    }
  }

  async stopExperiment(experimentId, experiment, context) {
    if (!this.activeExperiments.has(experimentId)) return;

    console.log(`\n✅ Stopping experiment: ${experimentId}`);

    try {
      await experiment.restore(context);
    } catch (error) {
      console.error(`⚠️ Failed to restore: ${error.message}`);
    }

    this.activeExperiments.delete(experimentId);

    this.results.push({
      experimentId,
      name: experiment.name,
      startTime: context.startTime,
      endTime: Date.now(),
      duration: Date.now() - context.startTime
    });
  }

  // Stop all active experiments
  async stopAll() {
    console.log('\n🛑 Stopping all experiments...');
    for (const experimentId of this.activeExperiments) {
      const name = experimentId.split('-')[0];
      const experiment = this.experiments.get(name);
      if (experiment) {
        await experiment.restore({ id: experimentId });
      }
      this.activeExperiments.delete(experimentId);
    }
  }
}

// ==========================================
// FAILURE INJECTORS
// ==========================================

// Latency Injection
class LatencyInjector {
  constructor() {
    this.delays = new Map();  // route -> delay
  }

  middleware() {
    return (req, res, next) => {
      const delay = this.delays.get(req.path) || this.delays.get('*') || 0;
      if (delay > 0) {
        setTimeout(next, delay);
      } else {
        next();
      }
    };
  }

  addDelay(route, delayMs) {
    this.delays.set(route, delayMs);
    console.log(`   💉 Injecting ${delayMs}ms latency on ${route}`);
  }

  removeDelay(route) {
    this.delays.delete(route);
    console.log(`   🔧 Removed latency from ${route}`);
  }

  clear() {
    this.delays.clear();
  }
}

// Error Injection
class ErrorInjector {
  constructor() {
    this.errors = new Map();  // route -> { statusCode, probability }
  }

  middleware() {
    return (req, res, next) => {
      const config = this.errors.get(req.path) || this.errors.get('*');
      if (config && Math.random() < config.probability) {
        return res.status(config.statusCode).json({
          error: 'Chaos injection',
          code: 'CHAOS_ERROR'
        });
      }
      next();
    };
  }

  addError(route, statusCode, probability = 1.0) {
    this.errors.set(route, { statusCode, probability });
    console.log(`   💉 Injecting ${statusCode} errors on ${route} (${probability * 100}%)`);
  }

  removeError(route) {
    this.errors.delete(route);
  }

  clear() {
    this.errors.clear();
  }
}

// Resource Exhaustion
class ResourceExhaustion {
  constructor() {
    this.leaks = [];
  }

  // Simulate memory pressure
  consumeMemory(megabytes) {
    const data = Buffer.alloc(megabytes * 1024 * 1024, 'x');
    this.leaks.push(data);
    console.log(`   💉 Consumed ${megabytes}MB memory`);
  }

  // Simulate CPU pressure
  consumeCPU(durationMs) {
    const start = Date.now();
    console.log(`   💉 Consuming CPU for ${durationMs}ms`);

    return new Promise(resolve => {
      const burn = () => {
        const elapsed = Date.now() - start;
        if (elapsed < durationMs) {
          // Busy loop
          let x = 0;
          for (let i = 0; i < 1000000; i++) x += Math.random();
          setImmediate(burn);
        } else {
          resolve();
        }
      };
      burn();
    });
  }

  release() {
    this.leaks = [];
    global.gc && global.gc();
    console.log(`   🔧 Released resources`);
  }
}

// Network Partition Simulator
class NetworkPartition {
  constructor() {
    this.blockedHosts = new Set();
  }

  // Middleware to simulate partition
  middleware() {
    return (req, res, next) => {
      // Check if target host is blocked
      const targetHost = req.headers['x-target-host'];
      if (targetHost && this.blockedHosts.has(targetHost)) {
        return res.status(503).json({
          error: 'Service unavailable',
          code: 'NETWORK_PARTITION'
        });
      }
      next();
    };
  }

  blockHost(host) {
    this.blockedHosts.add(host);
    console.log(`   💉 Blocked network to ${host}`);
  }

  unblockHost(host) {
    this.blockedHosts.delete(host);
    console.log(`   🔧 Unblocked network to ${host}`);
  }

  clear() {
    this.blockedHosts.clear();
  }
}

// ==========================================
// EXPERIMENT DEFINITIONS
// ==========================================

function defineExperiments(chaos, injectors) {
  const { latency, errors, resources, network } = injectors;

  // Latency Spike
  chaos.registerExperiment('latency-spike', {
    inject: async (ctx) => {
      latency.addDelay('*', ctx.options.delayMs || 2000);
    },
    restore: async () => {
      latency.clear();
    },
    duration: 30000
  });

  // Random Errors
  chaos.registerExperiment('random-errors', {
    inject: async (ctx) => {
      errors.addError('*', 500, ctx.options.probability || 0.3);
    },
    restore: async () => {
      errors.clear();
    },
    duration: 60000
  });

  // Service Dependency Failure
  chaos.registerExperiment('dependency-failure', {
    inject: async (ctx) => {
      const target = ctx.options.target || 'payment-service';
      network.blockHost(target);
    },
    restore: async (ctx) => {
      const target = ctx.options.target || 'payment-service';
      network.unblockHost(target);
    },
    duration: 45000
  });

  // Memory Pressure
  chaos.registerExperiment('memory-pressure', {
    inject: async (ctx) => {
      resources.consumeMemory(ctx.options.megabytes || 256);
    },
    restore: async () => {
      resources.release();
    },
    duration: 30000
  });

  // Cascading Failure
  chaos.registerExperiment('cascading-failure', {
    inject: async (ctx) => {
      // Simulate multiple failures
      latency.addDelay('/api/orders', 5000);
      errors.addError('/api/payments', 503, 0.5);
    },
    restore: async () => {
      latency.clear();
      errors.clear();
    },
    duration: 60000
  });
}

// ==========================================
// STEADY STATE MONITOR
// ==========================================

class SteadyStateMonitor {
  constructor(thresholds) {
    this.thresholds = thresholds || {
      errorRate: 0.01,        // 1%
      p95Latency: 500,        // 500ms
      availability: 0.999     // 99.9%
    };
    this.metrics = {
      requests: 0,
      errors: 0,
      latencies: []
    };
  }

  recordRequest(latencyMs, isError) {
    this.metrics.requests++;
    this.metrics.latencies.push(latencyMs);
    if (isError) this.metrics.errors++;
  }

  checkSteadyState() {
    const errorRate = this.metrics.requests > 0
      ? this.metrics.errors / this.metrics.requests
      : 0;

    const sortedLatencies = [...this.metrics.latencies].sort((a, b) => a - b);
    const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
    const p95Latency = sortedLatencies[p95Index] || 0;

    const availability = 1 - errorRate;

    const steadyState = {
      errorRate,
      p95Latency,
      availability,
      inSteadyState:
        errorRate <= this.thresholds.errorRate &&
        p95Latency <= this.thresholds.p95Latency &&
        availability >= this.thresholds.availability
    };

    return steadyState;
  }

  reset() {
    this.metrics = { requests: 0, errors: 0, latencies: [] };
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('CHAOS ENGINEERING');
  console.log('='.repeat(60));

  // Initialize components
  const chaos = new ChaosMonkey({ enabled: true });
  const latency = new LatencyInjector();
  const errors = new ErrorInjector();
  const resources = new ResourceExhaustion();
  const network = new NetworkPartition();
  const monitor = new SteadyStateMonitor();

  // Define experiments
  defineExperiments(chaos, { latency, errors, resources, network });

  // Simulate baseline traffic
  console.log('\n--- Establishing Baseline ---');
  for (let i = 0; i < 100; i++) {
    const latencyMs = 50 + Math.random() * 100;
    const isError = Math.random() < 0.005;  // 0.5% baseline errors
    monitor.recordRequest(latencyMs, isError);
  }

  const baseline = monitor.checkSteadyState();
  console.log('Baseline steady state:', baseline);

  // Run latency experiment
  console.log('\n--- Running Latency Spike Experiment ---');
  monitor.reset();

  await chaos.startExperiment('latency-spike', { delayMs: 1500 });

  // Simulate traffic during experiment
  for (let i = 0; i < 50; i++) {
    const baseLatency = 50 + Math.random() * 100;
    const injectedLatency = latency.delays.get('*') || 0;
    const totalLatency = baseLatency + injectedLatency;
    const isError = totalLatency > 2000 ? true : Math.random() < 0.02;
    monitor.recordRequest(totalLatency, isError);
  }

  const duringChaos = monitor.checkSteadyState();
  console.log('During chaos:', duringChaos);
  console.log('Steady state maintained:', duringChaos.inSteadyState ? '❌ NO' : '⚠️ DEGRADED');

  // Cleanup
  await chaos.stopAll();

  // Run error injection experiment
  console.log('\n--- Running Error Injection Experiment ---');
  monitor.reset();

  await chaos.startExperiment('random-errors', { probability: 0.2 });

  // Simulate traffic
  for (let i = 0; i < 50; i++) {
    const latencyMs = 50 + Math.random() * 100;
    const isError = Math.random() < 0.2;  // 20% injected errors
    monitor.recordRequest(latencyMs, isError);
  }

  const errorExperiment = monitor.checkSteadyState();
  console.log('During error injection:', errorExperiment);

  await chaos.stopAll();

  console.log('\n--- Experiment Results ---');
  console.log('Experiments run:', chaos.results.length);
  chaos.results.forEach(r => {
    console.log(`  ${r.name}: ${r.duration}ms`);
  });

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Common Chaos Experiments

| Experiment | What It Tests | Tools |
|------------|---------------|-------|
| **Instance Kill** | Auto-scaling, failover | Chaos Monkey |
| **Latency Injection** | Timeout handling | Toxiproxy, tc |
| **Network Partition** | Split-brain handling | iptables, tc |
| **Disk Full** | Graceful degradation | dd, fallocate |
| **CPU Exhaustion** | Throttling, priorities | stress-ng |
| **DNS Failure** | Caching, retries | dnsmasq |

---

## Netflix Chaos Tools

```
SIMIAN ARMY:

Chaos Monkey      - Randomly kills instances
Latency Monkey    - Injects network delays
Conformity Monkey - Finds non-conforming instances
Doctor Monkey     - Checks instance health
Janitor Monkey    - Cleans up unused resources
Security Monkey   - Finds security vulnerabilities
Chaos Gorilla     - Simulates entire zone failure
Chaos Kong        - Simulates entire region failure
```

---

## Best Practices

```
✅ DO:
├── Start small (dev/staging first)
├── Have a hypothesis
├── Define steady state metrics
├── Automate rollback
├── Run during business hours initially
└── Document findings

❌ DON'T:
├── Run in production without prep
├── Skip the hypothesis
├── Ignore monitoring during tests
├── Run without rollback plan
├── Test everything at once
└── Blame individuals for failures
```

---

## Related POCs

- [Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)
- [Load Testing](/interview-prep/practice-pocs/load-testing-k6)
- [Graceful Degradation](/interview-prep/practice-pocs/graceful-degradation)
