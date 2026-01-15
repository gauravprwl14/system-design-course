# POC #97: Blue-Green Deployment

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Docker basics, Load balancing concepts

## What You'll Learn

Blue-Green deployment maintains two identical production environments. Traffic switches instantly between them, enabling zero-downtime deployments and instant rollbacks.

```
BLUE-GREEN DEPLOYMENT:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  BEFORE DEPLOYMENT:                                             │
│  ──────────────────                                             │
│                                                                 │
│  Users ───▶ Load Balancer ───▶ BLUE (v1.0) ✅ LIVE             │
│                            ╲                                    │
│                             ╲──▶ GREEN (v1.0) ⚪ IDLE           │
│                                                                 │
│  DURING DEPLOYMENT:                                             │
│  ──────────────────                                             │
│                                                                 │
│  Users ───▶ Load Balancer ───▶ BLUE (v1.0) ✅ LIVE             │
│                            ╲                                    │
│                             ╲──▶ GREEN (v2.0) 🔄 DEPLOYING      │
│                                                                 │
│  AFTER SWITCH:                                                  │
│  ─────────────                                                  │
│                                                                 │
│  Users ───▶ Load Balancer ───▶ GREEN (v2.0) ✅ LIVE            │
│                            ╲                                    │
│                             ╲──▶ BLUE (v1.0) ⚪ STANDBY         │
│                                                                 │
│  ROLLBACK (if needed):                                          │
│  ─────────────────────                                          │
│                                                                 │
│  Users ───▶ Load Balancer ───▶ BLUE (v1.0) ✅ LIVE             │
│                                  (instant!)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// blue-green-deployment.js

// ==========================================
// DEPLOYMENT ENVIRONMENT
// ==========================================

class Environment {
  constructor(name, config = {}) {
    this.name = name;
    this.version = config.version || 'unknown';
    this.instances = [];
    this.status = 'idle';  // idle, deploying, live, draining
    this.healthCheckUrl = config.healthCheckUrl || '/health';
    this.metadata = {
      deployedAt: null,
      deployedBy: null
    };
  }

  async deploy(version, instances) {
    this.status = 'deploying';
    this.version = version;

    console.log(`  📦 Deploying ${version} to ${this.name}...`);

    // Simulate deployment to instances
    for (const instance of instances) {
      await this.deployToInstance(instance, version);
    }

    this.instances = instances;
    this.metadata.deployedAt = new Date();
    this.status = 'idle';

    console.log(`  ✅ Deployment complete: ${this.name} running ${version}`);
  }

  async deployToInstance(instance, version) {
    // Simulate container/instance deployment
    await new Promise(r => setTimeout(r, 100));
    instance.version = version;
    instance.status = 'running';
  }

  async healthCheck() {
    const results = await Promise.all(
      this.instances.map(async (instance) => {
        try {
          // Simulate health check
          await new Promise(r => setTimeout(r, 50));
          return { instance: instance.id, healthy: Math.random() > 0.1 };
        } catch {
          return { instance: instance.id, healthy: false };
        }
      })
    );

    const healthy = results.filter(r => r.healthy).length;
    return {
      environment: this.name,
      healthy,
      total: this.instances.length,
      percentage: (healthy / this.instances.length) * 100
    };
  }

  setLive() {
    this.status = 'live';
  }

  setIdle() {
    this.status = 'idle';
  }
}

// ==========================================
// LOAD BALANCER
// ==========================================

class LoadBalancer {
  constructor() {
    this.activeEnvironment = null;
    this.environments = new Map();
    this.requestCount = 0;
  }

  registerEnvironment(env) {
    this.environments.set(env.name, env);
  }

  setActive(envName) {
    const oldEnv = this.activeEnvironment;
    const newEnv = this.environments.get(envName);

    if (!newEnv) {
      throw new Error(`Environment not found: ${envName}`);
    }

    if (oldEnv) {
      oldEnv.setIdle();
    }

    newEnv.setLive();
    this.activeEnvironment = newEnv;

    console.log(`\n🔀 Traffic switched: ${oldEnv?.name || 'none'} → ${envName}`);
  }

  route(request) {
    if (!this.activeEnvironment) {
      return { status: 503, body: 'No active environment' };
    }

    this.requestCount++;
    const instance = this.selectInstance();

    return {
      status: 200,
      environment: this.activeEnvironment.name,
      version: this.activeEnvironment.version,
      instance: instance.id
    };
  }

  selectInstance() {
    const instances = this.activeEnvironment.instances;
    const index = this.requestCount % instances.length;
    return instances[index];
  }

  getStatus() {
    return {
      active: this.activeEnvironment?.name,
      version: this.activeEnvironment?.version,
      environments: Array.from(this.environments.values()).map(e => ({
        name: e.name,
        version: e.version,
        status: e.status,
        instances: e.instances.length
      }))
    };
  }
}

// ==========================================
// DEPLOYMENT ORCHESTRATOR
// ==========================================

class BlueGreenOrchestrator {
  constructor(loadBalancer) {
    this.loadBalancer = loadBalancer;
    this.deploymentHistory = [];
  }

  async deploy(version, options = {}) {
    const currentEnv = this.loadBalancer.activeEnvironment;
    const targetEnvName = currentEnv?.name === 'blue' ? 'green' : 'blue';
    const targetEnv = this.loadBalancer.environments.get(targetEnvName);

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`DEPLOYING: ${version}`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`  Current: ${currentEnv?.name || 'none'} (${currentEnv?.version || 'none'})`);
    console.log(`  Target:  ${targetEnvName}`);

    // Step 1: Deploy to inactive environment
    const instances = this.createInstances(options.instanceCount || 3);
    await targetEnv.deploy(version, instances);

    // Step 2: Health check
    console.log(`\n  🏥 Running health checks...`);
    const health = await targetEnv.healthCheck();
    console.log(`  Health: ${health.percentage.toFixed(0)}% (${health.healthy}/${health.total})`);

    if (health.percentage < (options.minHealthy || 80)) {
      console.log(`  ❌ Health check failed, aborting deployment`);
      return { success: false, reason: 'Health check failed' };
    }

    // Step 3: Switch traffic
    if (!options.skipSwitch) {
      this.loadBalancer.setActive(targetEnvName);
    }

    // Record deployment
    this.deploymentHistory.push({
      version,
      environment: targetEnvName,
      timestamp: new Date(),
      previousVersion: currentEnv?.version
    });

    console.log(`\n  ✅ Deployment successful!`);
    return { success: true, environment: targetEnvName, version };
  }

  async rollback() {
    const lastDeployment = this.deploymentHistory[this.deploymentHistory.length - 1];
    if (!lastDeployment) {
      console.log('  ❌ No deployment to rollback');
      return { success: false, reason: 'No deployment history' };
    }

    const currentEnv = this.loadBalancer.activeEnvironment;
    const rollbackEnvName = currentEnv?.name === 'blue' ? 'green' : 'blue';

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`ROLLBACK`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`  Rolling back from ${currentEnv?.version} to ${lastDeployment.previousVersion}`);

    // Simply switch traffic back (instant rollback)
    this.loadBalancer.setActive(rollbackEnvName);

    console.log(`  ✅ Rollback complete!`);
    return { success: true, version: lastDeployment.previousVersion };
  }

  createInstances(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: `instance-${Date.now()}-${i}`,
      status: 'pending',
      version: null
    }));
  }

  getDeploymentHistory() {
    return this.deploymentHistory;
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('BLUE-GREEN DEPLOYMENT');
  console.log('='.repeat(60));

  // Setup
  const loadBalancer = new LoadBalancer();
  const blueEnv = new Environment('blue', { version: 'v1.0.0' });
  const greenEnv = new Environment('green', { version: 'v1.0.0' });

  loadBalancer.registerEnvironment(blueEnv);
  loadBalancer.registerEnvironment(greenEnv);

  const orchestrator = new BlueGreenOrchestrator(loadBalancer);

  // Initial deployment
  console.log('\n--- Initial Deployment ---');
  await orchestrator.deploy('v1.0.0');

  // Simulate traffic
  console.log('\n--- Simulating Traffic ---');
  for (let i = 0; i < 5; i++) {
    const response = loadBalancer.route({ path: '/api/users' });
    console.log(`  Request ${i + 1}: ${response.environment} (${response.version})`);
  }

  // Deploy new version
  console.log('\n--- Deploy v2.0.0 ---');
  await orchestrator.deploy('v2.0.0');

  // Traffic now goes to new version
  console.log('\n--- Traffic After Deployment ---');
  for (let i = 0; i < 5; i++) {
    const response = loadBalancer.route({ path: '/api/users' });
    console.log(`  Request ${i + 1}: ${response.environment} (${response.version})`);
  }

  // Show current status
  console.log('\n--- Current Status ---');
  const status = loadBalancer.getStatus();
  console.log(`  Active: ${status.active} (${status.version})`);
  status.environments.forEach(e => {
    console.log(`  ${e.name}: ${e.version} [${e.status}] (${e.instances} instances)`);
  });

  // Simulate issue and rollback
  console.log('\n--- Simulating Rollback ---');
  await orchestrator.rollback();

  // Traffic back to old version
  console.log('\n--- Traffic After Rollback ---');
  for (let i = 0; i < 3; i++) {
    const response = loadBalancer.route({ path: '/api/users' });
    console.log(`  Request ${i + 1}: ${response.environment} (${response.version})`);
  }

  // Deployment history
  console.log('\n--- Deployment History ---');
  orchestrator.getDeploymentHistory().forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.version} → ${d.environment} (${d.timestamp.toISOString()})`);
  });

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Blue-Green vs Other Strategies

| Strategy | Downtime | Rollback | Resource Cost |
|----------|----------|----------|---------------|
| **Blue-Green** | Zero | Instant | 2x (double env) |
| **Rolling** | Zero | Slow | 1x + buffer |
| **Canary** | Zero | Fast | 1x + small |
| **Recreate** | Yes | Slow | 1x |

---

## Database Considerations

```
DATABASE MIGRATION CHALLENGES:

OPTION 1: Backward Compatible Migrations
├── Add columns (nullable or with defaults)
├── Don't remove columns until both versions done
└── Both v1 and v2 can read/write

OPTION 2: Database Per Version
├── Separate databases for blue/green
├── Sync data before switch
└── Complex but isolated

OPTION 3: Feature Flags
├── New code reads both schemas
├── Toggle between old/new at runtime
└── Gradual migration
```

---

## Best Practices

```
✅ DO:
├── Automate everything
├── Health check before switch
├── Keep rollback ready
├── Test in staging first
├── Monitor after switch
└── Document the process

❌ DON'T:
├── Manual traffic switching
├── Skip health checks
├── Delete old environment quickly
├── Forget database migrations
├── Deploy without monitoring
└── Rush the process
```

---

## Related POCs

- [Canary Releases](/interview-prep/practice-pocs/canary-releases)
- [Feature Flags](/interview-prep/practice-pocs/feature-flags)
- [Health Check Patterns](/interview-prep/practice-pocs/health-check-patterns)
