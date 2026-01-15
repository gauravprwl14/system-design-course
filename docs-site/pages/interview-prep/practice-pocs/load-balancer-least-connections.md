# POC #67: Least Connections Load Balancing

> **Difficulty:** 🟡 Intermediate
> **Time:** 20 minutes
> **Prerequisites:** Round-robin basics

## What You'll Learn

Route requests to the server with the fewest active connections - better than round-robin for varying request durations.

```
LEAST CONNECTIONS:
┌─────────────────────────────────────────────────────────┐
│  Current state:                                         │
│  Server 1: 5 active connections                         │
│  Server 2: 2 active connections  ◀── Next request here  │
│  Server 3: 8 active connections                         │
│                                                         │
│  Why it's better:                                       │
│  - Accounts for slow requests                           │
│  - Self-balancing under load                            │
│  - Handles heterogeneous servers                        │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// least-connections.js
const http = require('http');
const httpProxy = require('http-proxy');

// ==========================================
// LEAST CONNECTIONS BALANCER
// ==========================================

class LeastConnectionsBalancer {
  constructor(servers) {
    this.servers = servers.map((s, i) => ({
      ...s,
      id: i,
      activeConnections: 0,
      totalRequests: 0,
      name: `server${i + 1}`
    }));
  }

  getNextServer() {
    // Find server with minimum active connections
    const server = this.servers.reduce((min, curr) =>
      curr.activeConnections < min.activeConnections ? curr : min
    );

    server.activeConnections++;
    server.totalRequests++;

    console.log(`📊 Routing to ${server.name} (${server.activeConnections} connections)`);
    this.logState();

    return server;
  }

  releaseConnection(server) {
    server.activeConnections = Math.max(0, server.activeConnections - 1);
    console.log(`✅ Released connection from ${server.name}`);
  }

  logState() {
    const state = this.servers.map(s =>
      `${s.name}: ${s.activeConnections} active`
    ).join(' | ');
    console.log(`   State: ${state}`);
  }

  getStats() {
    return this.servers.map(s => ({
      name: s.name,
      activeConnections: s.activeConnections,
      totalRequests: s.totalRequests,
      port: s.port
    }));
  }
}

// ==========================================
// WEIGHTED LEAST CONNECTIONS
// ==========================================

class WeightedLeastConnectionsBalancer {
  constructor(servers) {
    // Weight represents server capacity
    this.servers = servers.map((s, i) => ({
      ...s,
      id: i,
      activeConnections: 0,
      totalRequests: 0,
      name: `server${i + 1}`
    }));
  }

  getNextServer() {
    // Score = activeConnections / weight (lower is better)
    const server = this.servers.reduce((best, curr) => {
      const currScore = curr.activeConnections / curr.weight;
      const bestScore = best.activeConnections / best.weight;
      return currScore < bestScore ? curr : best;
    });

    server.activeConnections++;
    server.totalRequests++;

    const score = (server.activeConnections / server.weight).toFixed(2);
    console.log(`⚖️ Weighted routing to ${server.name} (score: ${score})`);

    return server;
  }

  releaseConnection(server) {
    server.activeConnections = Math.max(0, server.activeConnections - 1);
  }
}

// ==========================================
// BACKEND SERVERS (Variable Response Times)
// ==========================================

function createBackendServer(port, name, avgDelay) {
  const server = http.createServer((req, res) => {
    // Simulate variable processing time
    const delay = avgDelay + (Math.random() * avgDelay);

    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        server: name,
        port: port,
        processingTime: Math.round(delay) + 'ms'
      }));
    }, delay);
  });

  server.listen(port, () => {
    console.log(`✅ ${name} (avg ${avgDelay}ms) on port ${port}`);
  });

  return server;
}

// ==========================================
// LOAD BALANCER WITH CONNECTION TRACKING
// ==========================================

function createLoadBalancer(balancer, port) {
  const proxy = httpProxy.createProxyServer({});

  const server = http.createServer((req, res) => {
    if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(balancer.getStats(), null, 2));
      return;
    }

    const target = balancer.getNextServer();

    // Track connection lifecycle
    res.on('finish', () => {
      balancer.releaseConnection(target);
    });

    proxy.web(req, res, {
      target: `http://${target.host}:${target.port}`
    });
  });

  proxy.on('error', (err, req, res, target) => {
    console.error(`❌ Proxy error: ${err.message}`);
    // Find and release the connection
    const server = balancer.servers.find(s => s.port === target?.port);
    if (server) balancer.releaseConnection(server);
  });

  server.listen(port, () => {
    console.log(`\n🔀 Least Connections LB on port ${port}\n`);
  });

  return server;
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('LEAST CONNECTIONS LOAD BALANCING');
  console.log('='.repeat(60));
  console.log();

  // Create backends with different speeds
  createBackendServer(3001, 'Fast-Server', 50);    // Fast
  createBackendServer(3002, 'Medium-Server', 200); // Medium
  createBackendServer(3003, 'Slow-Server', 500);   // Slow

  const servers = [
    { host: 'localhost', port: 3001 },
    { host: 'localhost', port: 3002 },
    { host: 'localhost', port: 3003 }
  ];

  const balancer = new LeastConnectionsBalancer(servers);
  createLoadBalancer(balancer, 3000);

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Send concurrent requests
  console.log('='.repeat(60));
  console.log('SENDING 15 CONCURRENT REQUESTS');
  console.log('='.repeat(60));
  console.log();

  const requests = [];
  for (let i = 0; i < 15; i++) {
    requests.push(
      fetch('http://localhost:3000/')
        .then(r => r.json())
        .then(data => console.log(`Completed: ${data.server} (${data.processingTime})`))
    );
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await Promise.all(requests);

  console.log('\n' + '='.repeat(60));
  console.log('FINAL STATISTICS');
  console.log('='.repeat(60));

  const stats = balancer.getStats();
  console.log('\nServer distribution:');
  stats.forEach(s => {
    console.log(`  ${s.name}: ${s.totalRequests} total requests`);
  });

  console.log('\n💡 Notice: Fast server handled MORE requests');
  console.log('   This is the key advantage over round-robin!\n');
}

demonstrate().catch(console.error);
```

---

## Expected Result

```
Fast server: ~10 requests (handles quickly, frees up)
Medium server: ~4 requests
Slow server: ~1 request (stays busy longest)
```

---

## Comparison: Round-Robin vs Least Connections

| Scenario | Round-Robin | Least Connections |
|----------|-------------|-------------------|
| Same server speeds | Even (33/33/33) | Even (33/33/33) |
| Different speeds | Even (33/33/33) | Favors fast (~60/30/10) |
| Long-running requests | Can overload | Self-balancing |
| Implementation | Simple | Track connections |

---

## When to Use

- Requests have varying durations
- Servers have different capacities
- Want automatic load adaptation
- Long-lived connections (WebSocket, streaming)

---

## Related POCs

- [POC #66: Round-Robin](/interview-prep/practice-pocs/load-balancer-round-robin)
- [POC #68: Consistent Hashing](/interview-prep/practice-pocs/load-balancer-consistent-hashing)
