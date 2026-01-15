# Thread Pool Exhaustion - When Your App Stops Processing Requests

> **Category:** Performance
> **Frequency:** Top 5 production incident cause
> **Detection Difficulty:** Medium (CPU low, but requests timing out)
> **Impact:** Complete service unavailability

## The Incident: 0% CPU, 100% Timeout

**2:15 PM Alert:** "Service returning 503 errors"

```
Dashboard readings:
├── CPU: 3% (normal ✅)
├── Memory: 45% (normal ✅)
├── Thread count: 200/200 (maxed out 🔴)
├── Active requests: 200 (all threads busy 🔴)
├── Request queue: 5000+ (growing fast 🔴)
└── Response time: 30s → timeout

Application logs:
├── "RejectedExecutionException: Thread pool exhausted"
├── "Task rejected from java.util.concurrent.ThreadPoolExecutor"
└── "Unable to acquire thread within timeout"

JVM Thread Dump:
├── 200 threads in WAITING state
├── 0 threads in RUNNABLE state
└── All threads blocked on I/O or locks
```

**The paradox:** CPU is idle because all threads are *waiting*, not *computing*.

---

## Real-World Incidents

### Incident 1: Netflix Recommendation Service (2022)

```
Scenario: Personalization service during peak hours
Timeline:
- 8:00 PM: Evening traffic surge (3x normal)
- 8:05 PM: Thread pool hits 500/500 limit
- 8:10 PM: Recommendations fail silently
- 8:15 PM: Homepage shows generic content for all users
- 8:30 PM: Manually scaled thread pool
- 8:45 PM: Recovery

Root cause: Downstream ML service latency spike (100ms → 5s)
Each request held a thread 50x longer than expected
Impact: 30 minutes of degraded personalization
Fix: Add async processing + timeout on ML calls
```

### Incident 2: Uber Driver Dispatch (2023)

```
Scenario: Driver matching service
Symptoms:
- Riders waiting 10+ minutes for matches
- Drivers not receiving ride requests
- No errors in traditional monitoring

Root cause:
- Geospatial query latency increased (db index rebuild)
- Thread pool size: 100
- Normal request: 50ms (2000 requests/sec capacity)
- During incident: 2000ms (50 requests/sec capacity)
- Traffic: 500 requests/sec = instant exhaustion

Impact: $5M estimated lost rides
Detection: 45 minutes (only caught by customer complaints)
Fix: Separate fast/slow operations into different pools
```

### Incident 3: Slack Message Delivery (2021)

```
Scenario: Message fanout service
Timeline:
- Large customer sent message to 50,000-member channel
- Each member notification = 1 thread
- Thread pool: 1000
- Queue filled in 50 batches
- While processing large fanout, all other messages delayed

Root cause:
- Single thread pool for all message types
- Large fanouts starved normal messages
- No priority queuing

Impact: 2 hours of message delays
Fix: Separate pools for different message sizes
```

---

## Why This Happens

### The Thread Pool Mental Model

```
HEALTHY THREAD POOL:
┌─────────────────────────────────────────────────────┐
│              Thread Pool (100 threads)              │
├─────────────────────────────────────────────────────┤
│ [WORK][WORK][WORK][IDLE][IDLE][IDLE]...            │
│                                                     │
│ Request arrives → Gets thread → Process (50ms)     │
│                → Returns thread → Ready for next   │
│                                                     │
│ Capacity: 100 threads / 50ms = 2000 req/sec ✅     │
└─────────────────────────────────────────────────────┘

EXHAUSTED THREAD POOL:
┌─────────────────────────────────────────────────────┐
│              Thread Pool (100 threads)              │
├─────────────────────────────────────────────────────┤
│ [WAIT][WAIT][WAIT][WAIT][WAIT][WAIT]...            │
│ ALL THREADS BLOCKED ON I/O                          │
│                                                     │
│ Request arrives → No thread available               │
│                → Queued... or rejected              │
│                → Eventually: TIMEOUT                │
│                                                     │
│ CPU: 3% (threads waiting, not computing)            │
│ Throughput: ~0 req/sec ❌                           │
└─────────────────────────────────────────────────────┘
```

### Common Causes

```
1. BLOCKING I/O IN ASYNC CONTEXT
   ├── Sync HTTP calls in async handler
   ├── File I/O on request thread
   └── Database calls without timeout

2. DOWNSTREAM SERVICE LATENCY
   ├── Payment gateway slow response
   ├── Third-party API timeouts
   └── Internal microservice degradation

3. LOCK CONTENTION
   ├── Synchronized blocks holding threads
   ├── Database row/table locks
   └── Distributed lock timeouts

4. THREAD POOL MISCONFIGURATION
   ├── Pool too small for workload
   ├── No queue size limit (unbounded queue)
   └── No rejection policy (blocks forever)

5. RESOURCE EXHAUSTION CASCADE
   ├── DB pool exhausted → threads wait for connection
   ├── Network sockets exhausted → threads wait for socket
   └── Memory pressure → GC pauses block all threads
```

---

## The Blocking Call Trap

```javascript
// ❌ WRONG: Blocking HTTP call in async server
app.get('/api/user/:id', async (req, res) => {
  // This thread is now BLOCKED for 2+ seconds
  const userDetails = await fetch('https://slow-service.com/user/' + req.params.id);
  // Thread can't process other requests while waiting

  const orders = await fetch('https://another-slow-service.com/orders/' + req.params.id);
  // Now blocked for another 2+ seconds

  res.json({ user: userDetails, orders });
});

// With 100 threads and 4s average response time:
// Max throughput = 100 / 4 = 25 requests/second
// Even if your CPU can handle 10,000 req/sec
```

```javascript
// ✅ CORRECT: Non-blocking with proper timeouts
app.get('/api/user/:id', async (req, res) => {
  // Parallel calls with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const [userDetails, orders] = await Promise.all([
      fetch('https://slow-service.com/user/' + req.params.id, {
        signal: controller.signal
      }),
      fetch('https://another-slow-service.com/orders/' + req.params.id, {
        signal: controller.signal
      })
    ]);
    res.json({ user: userDetails, orders });
  } catch (e) {
    if (e.name === 'AbortError') {
      res.status(504).json({ error: 'Upstream timeout' });
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
});
```

---

## Detection Patterns

### Metrics That Reveal Exhaustion

```
HEALTHY POOL:
├── threads.active: 30/100 (headroom available)
├── threads.idle: 70 (ready to accept work)
├── queue.size: 0-10 (minimal backlog)
├── request.latency_p99: 100ms
└── rejection.count: 0

EXHAUSTED POOL:
├── threads.active: 100/100 ⚠️ (at capacity)
├── threads.idle: 0 🔴 (no headroom)
├── queue.size: 5000+ 🔴 (growing backlog)
├── request.latency_p99: 30000ms 🔴
└── rejection.count: 500/sec 🔴
```

### Java/JVM Specific Detection

```java
// Get ThreadPoolExecutor metrics
ThreadPoolExecutor executor = (ThreadPoolExecutor) Executors.newFixedThreadPool(100);

// Critical metrics
int activeCount = executor.getActiveCount();      // Threads currently working
int poolSize = executor.getPoolSize();            // Current pool size
int queueSize = executor.getQueue().size();       // Waiting tasks
long completedTasks = executor.getCompletedTaskCount();
long rejectedCount = getRejectedCount();          // Custom counter

// Health check
boolean isExhausted = activeCount == poolSize && queueSize > 0;
boolean isDegraded = (double) activeCount / poolSize > 0.8;
```

### Thread Dump Analysis

```bash
# Generate thread dump
jstack <pid> > thread_dump.txt

# Look for patterns
grep -c "WAITING" thread_dump.txt        # Threads blocked on I/O
grep -c "BLOCKED" thread_dump.txt        # Threads blocked on locks
grep -c "RUNNABLE" thread_dump.txt       # Actually working threads

# Common waiting states indicating problems:
# - "waiting on condition" - HTTP/socket I/O
# - "parking" - Lock waiting
# - "sleeping" - Thread.sleep() calls
# - "waiting for monitor entry" - Synchronized block contention
```

---

## Prevention Strategies

### 1. Proper Thread Pool Configuration

```java
// ❌ WRONG: Default executor with unbounded queue
ExecutorService executor = Executors.newFixedThreadPool(100);
// Queue is unbounded = memory exhaustion risk

// ✅ CORRECT: Bounded queue with rejection policy
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    10,                      // Core pool size
    100,                     // Maximum pool size
    60L, TimeUnit.SECONDS,   // Keep-alive time
    new ArrayBlockingQueue<>(1000),  // Bounded queue
    new ThreadPoolExecutor.CallerRunsPolicy()  // Rejection policy
);
```

### 2. Timeout Everything

```java
// ❌ WRONG: No timeout on HTTP call
HttpResponse response = httpClient.send(request, BodyHandlers.ofString());
// Could block forever if service hangs

// ✅ CORRECT: Always set timeouts
HttpClient client = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(2))
    .build();

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com"))
    .timeout(Duration.ofSeconds(5))  // Request timeout
    .build();

CompletableFuture<HttpResponse<String>> future = client.sendAsync(request, BodyHandlers.ofString());
HttpResponse<String> response = future.get(5, TimeUnit.SECONDS);  // Additional safeguard
```

### 3. Separate Pools for Different Workloads

```java
// ✅ CORRECT: Different pools for different latency profiles
public class ServicePools {
    // Fast operations: DB reads, cache hits
    private final ExecutorService fastPool = new ThreadPoolExecutor(
        20, 50, 60L, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(100)
    );

    // Slow operations: External APIs, file processing
    private final ExecutorService slowPool = new ThreadPoolExecutor(
        10, 100, 60L, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(500)
    );

    // Background tasks: Reports, batch jobs
    private final ExecutorService backgroundPool = new ThreadPoolExecutor(
        5, 20, 300L, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(10000)
    );
}
```

### 4. Implement Bulkheads

```java
// Bulkhead pattern: Isolate failures
public class BulkheadService {
    private final Semaphore paymentSemaphore = new Semaphore(20);
    private final Semaphore notificationSemaphore = new Semaphore(50);

    public PaymentResult processPayment(Payment payment) throws InterruptedException {
        if (!paymentSemaphore.tryAcquire(100, TimeUnit.MILLISECONDS)) {
            throw new ServiceUnavailableException("Payment service at capacity");
        }
        try {
            return paymentGateway.process(payment);
        } finally {
            paymentSemaphore.release();
        }
    }

    public void sendNotification(Notification notification) throws InterruptedException {
        if (!notificationSemaphore.tryAcquire(50, TimeUnit.MILLISECONDS)) {
            // Notifications can be queued for later
            notificationQueue.add(notification);
            return;
        }
        try {
            notificationService.send(notification);
        } finally {
            notificationSemaphore.release();
        }
    }
}
```

### 5. Use Async/Non-Blocking I/O

```java
// ❌ WRONG: Blocking approach
public List<UserProfile> getUserProfiles(List<String> userIds) {
    return userIds.stream()
        .map(id -> httpClient.send(buildRequest(id)))  // Sequential + blocking
        .collect(Collectors.toList());
}

// ✅ CORRECT: Non-blocking with CompletableFuture
public CompletableFuture<List<UserProfile>> getUserProfilesAsync(List<String> userIds) {
    List<CompletableFuture<UserProfile>> futures = userIds.stream()
        .map(id -> httpClient.sendAsync(buildRequest(id), BodyHandlers.ofString())
            .thenApply(this::parseResponse)
            .orTimeout(2, TimeUnit.SECONDS)
            .exceptionally(e -> UserProfile.empty()))  // Graceful degradation
        .collect(Collectors.toList());

    return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
        .thenApply(v -> futures.stream()
            .map(CompletableFuture::join)
            .collect(Collectors.toList()));
}
```

---

## Recovery Procedures

### Immediate Actions

```bash
# 1. Identify the problem
# Check thread states
jstack $(pgrep -f myapp) | grep -c "WAITING"
jstack $(pgrep -f myapp) | grep -c "RUNNABLE"

# 2. Check what threads are waiting on
jstack $(pgrep -f myapp) | grep -A 20 "WAITING" | head -100

# 3. If stuck on downstream service, check that service
curl -w "@curl-format.txt" -o /dev/null -s https://downstream-service/health

# 4. Emergency: Increase thread pool size (if possible)
# Via JMX or config reload

# 5. Emergency: Restart with larger pool (last resort)
java -Dserver.tomcat.threads.max=400 -jar myapp.jar
```

### Long-term Fixes

```markdown
## Thread Pool Exhaustion Post-Mortem Template

### Immediate Cause
- [ ] Downstream service latency spike
- [ ] Blocking I/O in async context
- [ ] Thread pool too small
- [ ] Lock contention
- [ ] Memory/GC issues causing pauses

### Contributing Factors
- [ ] No timeouts on external calls
- [ ] Single shared thread pool
- [ ] No circuit breaker on slow services
- [ ] No monitoring on thread pool metrics

### Action Items
- [ ] Add thread pool metrics to monitoring
- [ ] Set up alerts for pool utilization > 80%
- [ ] Add timeouts to ALL external calls
- [ ] Implement bulkhead pattern
- [ ] Consider async/reactive framework
```

---

## Monitoring Setup

### Key Metrics

```yaml
# Prometheus metrics for thread pool monitoring
metrics:
  # Pool state
  - thread_pool_active_threads{pool="main"}
  - thread_pool_idle_threads{pool="main"}
  - thread_pool_queue_size{pool="main"}
  - thread_pool_max_size{pool="main"}
  - thread_pool_utilization{pool="main"}  # active / max

  # Task metrics
  - thread_pool_completed_tasks_total{pool="main"}
  - thread_pool_rejected_tasks_total{pool="main"}
  - thread_pool_task_duration_seconds{pool="main",quantile="0.99"}

  # Wait time metrics
  - thread_pool_queue_wait_seconds{pool="main",quantile="0.99"}
```

### Alert Rules

```yaml
alerts:
  - alert: ThreadPoolHighUtilization
    expr: thread_pool_utilization > 0.8
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Thread pool utilization above 80%"

  - alert: ThreadPoolExhausted
    expr: thread_pool_idle_threads == 0 and thread_pool_queue_size > 0
    for: 30s
    labels:
      severity: critical
    annotations:
      summary: "Thread pool exhausted - requests being queued"

  - alert: ThreadPoolRejections
    expr: rate(thread_pool_rejected_tasks_total[1m]) > 0
    labels:
      severity: critical
    annotations:
      summary: "Thread pool rejecting tasks"

  - alert: ThreadPoolQueueBacklog
    expr: thread_pool_queue_size > 100
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Thread pool queue growing"
```

---

## Key Takeaways

### The Pattern

```
Normal: Request → Get thread (0ms) → Process (50ms) → Release → Response
Exhausted: Request → Wait for thread (30s) → Timeout → Error

Root cause: Threads WAITING (blocked I/O), not COMPUTING
Result: Low CPU, high latency, timeouts
```

### Prevention Checklist

- [ ] Thread pool sizes calculated based on workload
- [ ] Bounded queues with appropriate rejection policy
- [ ] Timeouts on ALL external calls (HTTP, DB, message queue)
- [ ] Separate pools for fast vs slow operations
- [ ] Circuit breakers on external dependencies
- [ ] Thread pool metrics monitored and alerted
- [ ] Async/non-blocking I/O where appropriate

### Quick Sizing Formula

```
Pool Size = Number of Cores * (1 + Wait Time / Service Time)

Example:
- 8 cores
- 200ms average wait time (I/O)
- 50ms average service time (CPU)
- Pool size = 8 * (1 + 200/50) = 8 * 5 = 40 threads

For I/O-heavy workloads, pools can be much larger:
- 8 cores, 2000ms wait, 10ms service
- Pool size = 8 * (1 + 2000/10) = 8 * 201 = 1608 threads
```

---

## Related Content

- [Connection Pool Starvation](/problems-at-scale/performance/connection-pool-starvation) - Similar but for DB connections
- [Timeout Domino Effect](/problems-at-scale/availability/timeout-domino-effect) - How timeouts cascade
- [Circuit Breaker Pattern](/system-design/patterns/circuit-breaker) - Protect against slow dependencies
- [Timeouts & Backpressure](/system-design/patterns/timeouts-backpressure) - Prevention guide

---

**Remember:** Thread pool exhaustion happens when threads are *waiting*, not *working*. Low CPU doesn't mean healthy - always monitor thread pool utilization and queue depth. When in doubt, add timeouts to everything.
