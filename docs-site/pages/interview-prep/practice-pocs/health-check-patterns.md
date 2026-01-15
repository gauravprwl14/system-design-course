# POC #99: Health Check Patterns

> **Difficulty:** 🟢 Beginner
> **Time:** 20 minutes
> **Prerequisites:** HTTP basics, Load balancing concepts

## What You'll Learn

Health checks verify service availability and readiness. Proper implementation enables load balancers and orchestrators to route traffic correctly and perform automated recovery.

```
HEALTH CHECK TYPES:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  LIVENESS PROBE              READINESS PROBE                    │
│  ──────────────              ───────────────                    │
│  "Is the process alive?"     "Can it handle requests?"          │
│                                                                 │
│  ┌───────────────┐           ┌───────────────┐                 │
│  │   /healthz    │           │   /ready      │                 │
│  │               │           │               │                 │
│  │  Check:       │           │  Check:       │                 │
│  │  - Process up │           │  - DB conn    │                 │
│  │  - Memory ok  │           │  - Cache conn │                 │
│  │               │           │  - Deps ready │                 │
│  └───────────────┘           └───────────────┘                 │
│                                                                 │
│  If fails: RESTART           If fails: STOP TRAFFIC            │
│                                                                 │
│  STARTUP PROBE               DEEP HEALTH CHECK                  │
│  ─────────────               ─────────────────                  │
│  "Has it finished starting?" "Full dependency status"           │
│                                                                 │
│  ┌───────────────┐           ┌───────────────┐                 │
│  │   /startup    │           │   /health     │                 │
│  │               │           │               │                 │
│  │  Check:       │           │  Check:       │                 │
│  │  - Init done  │           │  - All deps   │                 │
│  │  - Warmup ok  │           │  - Latencies  │                 │
│  │               │           │  - Detailed   │                 │
│  └───────────────┘           └───────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// health-check-patterns.js

// ==========================================
// DEPENDENCY CHECKER
// ==========================================

class DependencyChecker {
  constructor(name, checkFn, options = {}) {
    this.name = name;
    this.checkFn = checkFn;
    this.timeout = options.timeout || 5000;
    this.critical = options.critical ?? true;
    this.lastCheck = null;
    this.lastResult = null;
  }

  async check() {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        this.checkFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);

      this.lastResult = {
        name: this.name,
        healthy: true,
        latencyMs: Date.now() - startTime,
        details: result,
        timestamp: new Date()
      };
    } catch (error) {
      this.lastResult = {
        name: this.name,
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error.message,
        timestamp: new Date()
      };
    }

    this.lastCheck = Date.now();
    return this.lastResult;
  }
}

// ==========================================
// HEALTH CHECK SERVICE
// ==========================================

class HealthCheckService {
  constructor(options = {}) {
    this.dependencies = new Map();
    this.startTime = Date.now();
    this.isReady = false;
    this.isLive = true;

    // Configuration
    this.config = {
      cacheTTL: options.cacheTTL || 5000,  // Cache health results
      startupGracePeriod: options.startupGracePeriod || 30000,
      ...options
    };

    // Metrics
    this.metrics = {
      checksPerformed: 0,
      failures: 0,
      lastFailure: null
    };
  }

  // Register a dependency
  registerDependency(name, checkFn, options = {}) {
    const checker = new DependencyChecker(name, checkFn, options);
    this.dependencies.set(name, checker);
    console.log(`🔗 Registered dependency: ${name} (critical: ${checker.critical})`);
    return this;
  }

  // Liveness check - is the process healthy?
  async checkLiveness() {
    const checks = {
      process: true,
      memory: this.checkMemory(),
      eventLoop: await this.checkEventLoop()
    };

    const healthy = Object.values(checks).every(c => c === true || c.healthy);

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks,
      uptime: Date.now() - this.startTime
    };
  }

  checkMemory() {
    // In real app: use process.memoryUsage()
    const used = Math.random() * 100;  // Simulated
    const threshold = 90;

    return {
      healthy: used < threshold,
      usedPercent: used.toFixed(1),
      threshold
    };
  }

  async checkEventLoop() {
    // Check event loop lag
    const start = Date.now();
    await new Promise(r => setImmediate(r));
    const lag = Date.now() - start;

    return {
      healthy: lag < 100,
      lagMs: lag
    };
  }

  // Readiness check - can we handle traffic?
  async checkReadiness() {
    // Check startup grace period
    const uptime = Date.now() - this.startTime;
    if (uptime < this.config.startupGracePeriod && !this.isReady) {
      return {
        status: 'not_ready',
        reason: 'Startup in progress',
        uptime
      };
    }

    // Check critical dependencies
    const results = await this.checkAllDependencies();
    const criticalDeps = results.filter(r => {
      const dep = this.dependencies.get(r.name);
      return dep?.critical;
    });

    const allCriticalHealthy = criticalDeps.every(r => r.healthy);

    this.isReady = allCriticalHealthy;

    return {
      status: allCriticalHealthy ? 'ready' : 'not_ready',
      dependencies: results.reduce((acc, r) => {
        acc[r.name] = r.healthy ? 'up' : 'down';
        return acc;
      }, {})
    };
  }

  // Deep health check - full status with details
  async checkHealth() {
    this.metrics.checksPerformed++;

    const [liveness, readiness, dependencies] = await Promise.all([
      this.checkLiveness(),
      this.checkReadiness(),
      this.checkAllDependencies()
    ]);

    const overallHealthy = liveness.status === 'healthy' && readiness.status === 'ready';

    if (!overallHealthy) {
      this.metrics.failures++;
      this.metrics.lastFailure = new Date();
    }

    return {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      version: process.env.APP_VERSION || '1.0.0',
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      checks: {
        liveness: liveness.status,
        readiness: readiness.status
      },
      dependencies: dependencies.map(d => ({
        name: d.name,
        status: d.healthy ? 'up' : 'down',
        latencyMs: d.latencyMs,
        error: d.error
      })),
      metrics: this.metrics
    };
  }

  async checkAllDependencies() {
    const checks = Array.from(this.dependencies.values()).map(dep => {
      // Use cached result if fresh
      if (dep.lastCheck && Date.now() - dep.lastCheck < this.config.cacheTTL) {
        return Promise.resolve(dep.lastResult);
      }
      return dep.check();
    });

    return Promise.all(checks);
  }

  // Mark service as ready (after initialization)
  setReady() {
    this.isReady = true;
    console.log('✅ Service marked as ready');
  }

  // Mark service as not ready (graceful shutdown)
  setNotReady() {
    this.isReady = false;
    console.log('⏸️ Service marked as not ready');
  }
}

// ==========================================
// EXPRESS MIDDLEWARE
// ==========================================

function healthCheckMiddleware(healthService) {
  return {
    // Kubernetes liveness probe
    liveness: async (req, res) => {
      const result = await healthService.checkLiveness();
      res.status(result.status === 'healthy' ? 200 : 503).json(result);
    },

    // Kubernetes readiness probe
    readiness: async (req, res) => {
      const result = await healthService.checkReadiness();
      res.status(result.status === 'ready' ? 200 : 503).json(result);
    },

    // Deep health check
    health: async (req, res) => {
      const result = await healthService.checkHealth();
      res.status(result.status === 'healthy' ? 200 : 503).json(result);
    }
  };
}

// ==========================================
// MOCK DEPENDENCIES
// ==========================================

function createMockDatabase(healthy = true, latency = 50) {
  return async () => {
    await new Promise(r => setTimeout(r, latency));
    if (!healthy) throw new Error('Connection refused');
    return { connections: 5, maxConnections: 10 };
  };
}

function createMockRedis(healthy = true, latency = 10) {
  return async () => {
    await new Promise(r => setTimeout(r, latency));
    if (!healthy) throw new Error('Connection timeout');
    return { connected: true, memoryUsed: '50MB' };
  };
}

function createMockExternalAPI(healthy = true, latency = 100) {
  return async () => {
    await new Promise(r => setTimeout(r, latency));
    if (!healthy) throw new Error('Service unavailable');
    return { status: 'operational' };
  };
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('HEALTH CHECK PATTERNS');
  console.log('='.repeat(60));

  // Create health service
  const healthService = new HealthCheckService({
    cacheTTL: 5000,
    startupGracePeriod: 1000
  });

  // Register dependencies
  console.log('\n--- Registering Dependencies ---');

  healthService
    .registerDependency('postgres', createMockDatabase(true, 30), {
      critical: true,
      timeout: 5000
    })
    .registerDependency('redis', createMockRedis(true, 10), {
      critical: true,
      timeout: 2000
    })
    .registerDependency('payment-api', createMockExternalAPI(true, 80), {
      critical: false,  // Non-critical - app works without it
      timeout: 3000
    });

  // Test liveness check
  console.log('\n--- Liveness Check ---');
  const liveness = await healthService.checkLiveness();
  console.log(`  Status: ${liveness.status}`);
  console.log(`  Memory: ${liveness.checks.memory.usedPercent}% used`);
  console.log(`  Event Loop Lag: ${liveness.checks.eventLoop.lagMs}ms`);

  // Test readiness check (before ready)
  console.log('\n--- Readiness Check (During Startup) ---');
  const readiness1 = await healthService.checkReadiness();
  console.log(`  Status: ${readiness1.status}`);
  console.log(`  Reason: ${readiness1.reason || 'N/A'}`);

  // Simulate initialization complete
  await new Promise(r => setTimeout(r, 1100));
  healthService.setReady();

  // Test readiness check (after ready)
  console.log('\n--- Readiness Check (After Startup) ---');
  const readiness2 = await healthService.checkReadiness();
  console.log(`  Status: ${readiness2.status}`);
  console.log(`  Dependencies:`);
  for (const [name, status] of Object.entries(readiness2.dependencies)) {
    console.log(`    ${name}: ${status}`);
  }

  // Test deep health check
  console.log('\n--- Deep Health Check ---');
  const health = await healthService.checkHealth();
  console.log(`  Overall: ${health.status}`);
  console.log(`  Version: ${health.version}`);
  console.log(`  Uptime: ${health.uptime}ms`);
  console.log(`  Dependencies:`);
  for (const dep of health.dependencies) {
    const icon = dep.status === 'up' ? '✅' : '❌';
    console.log(`    ${icon} ${dep.name}: ${dep.latencyMs}ms`);
  }

  // Simulate dependency failure
  console.log('\n--- Simulating Database Failure ---');

  const unhealthyService = new HealthCheckService({
    cacheTTL: 100,
    startupGracePeriod: 0
  });

  unhealthyService
    .registerDependency('postgres', createMockDatabase(false), { critical: true })
    .registerDependency('redis', createMockRedis(true), { critical: true });

  unhealthyService.setReady();

  const unhealthyResult = await unhealthyService.checkReadiness();
  console.log(`  Status: ${unhealthyResult.status}`);
  console.log(`  Dependencies:`);
  for (const [name, status] of Object.entries(unhealthyResult.dependencies)) {
    const icon = status === 'up' ? '✅' : '❌';
    console.log(`    ${icon} ${name}: ${status}`);
  }

  // Graceful shutdown simulation
  console.log('\n--- Graceful Shutdown ---');
  healthService.setNotReady();

  const shutdownReadiness = await healthService.checkReadiness();
  console.log(`  Status: ${shutdownReadiness.status}`);
  console.log(`  (Load balancer will stop sending traffic)`);

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Kubernetes Configuration

```yaml
# k8s-health-checks.yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      livenessProbe:
        httpGet:
          path: /healthz
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3

      readinessProbe:
        httpGet:
          path: /ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 3

      startupProbe:
        httpGet:
          path: /startup
          port: 3000
        initialDelaySeconds: 0
        periodSeconds: 5
        failureThreshold: 30  # 30 * 5s = 150s max startup
```

---

## Health Check Endpoints

| Endpoint | Purpose | Response Time | When Fails |
|----------|---------|---------------|------------|
| `/healthz` | Liveness | < 100ms | Container restarts |
| `/ready` | Readiness | < 500ms | Traffic stops |
| `/startup` | Startup | < 1s | Wait for ready |
| `/health` | Deep check | < 5s | Alerts, debugging |

---

## Best Practices

```
✅ DO:
├── Separate liveness from readiness
├── Make liveness checks fast
├── Cache dependency check results
├── Include version in response
├── Use proper timeouts
└── Implement graceful shutdown

❌ DON'T:
├── Check non-critical deps in liveness
├── Use same endpoint for all checks
├── Forget timeout handling
├── Skip startup probes
├── Expose sensitive data
└── Make checks too expensive
```

---

## Related POCs

- [Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)
- [Graceful Degradation](/interview-prep/practice-pocs/graceful-degradation)
- [Service Discovery](/interview-prep/practice-pocs/service-discovery)
