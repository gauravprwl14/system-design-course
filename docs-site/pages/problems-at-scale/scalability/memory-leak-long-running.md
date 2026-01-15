# Memory Leak in Long-Running Services - The Slow Death of Your Application

> **Category:** Scalability
> **Frequency:** Every production app eventually encounters this
> **Detection Difficulty:** Hard (gradual, often missed until crash)
> **Impact:** OOM crashes, degraded performance, cascading failures

## The Incident: Death by a Thousand Allocations

**Week 1:** "Memory at 40%, looks fine"
**Week 2:** "Memory at 60%, probably more traffic"
**Week 3:** "Memory at 85%, we should watch this"
**Week 4:** "OOM Killed at 3 AM, pager alert"

```
Memory Usage Timeline:
├── Day 1:  1.2 GB (baseline after deploy)
├── Day 7:  2.1 GB (slow growth, unnoticed)
├── Day 14: 3.5 GB (GC pauses starting)
├── Day 21: 4.8 GB (response times degrading)
├── Day 24: 5.2 GB (full GC every 30 seconds)
├── Day 25: OOM KILLED ❌

Application logs (final hour):
├── "GC overhead limit exceeded"
├── "OutOfMemoryError: Java heap space"
└── Process killed by OOM killer

What nobody noticed:
├── Memory grew 50MB/day
├── GC time increased 5%/day
├── Response times crept up 2ms/day
└── No single event triggered alerts
```

**The insidious part:** No error, no alert, no single cause - just gradual decay until sudden death.

---

## Real-World Incidents

### Incident 1: LinkedIn Feed Service (2022)

```
Scenario: User feed personalization service
Timeline:
- Service running for 3 weeks without restart
- Memory growing from 4GB to 12GB
- Sudden OOM crash during peak hours
- 5-minute outage during restart cascade

Root cause:
- User session objects cached but never evicted
- Each session: 50KB
- 1M daily active users
- Leak rate: 50KB × 100,000 new users/day = 5GB/day

Impact: 5-minute feed outage
Detection: Only discovered after crash
Fix: Added TTL to session cache + memory alerts
```

### Incident 2: Stripe Webhook Processor (2023)

```
Scenario: Event webhook delivery service
Pattern:
- Deploy Monday, 8GB heap
- Thursday: 14GB, first GC pauses
- Friday: OOM at 16GB limit

Root cause:
- Retry queue held failed webhooks in memory
- Retries scheduled with exponential backoff
- Some webhooks never succeeded (dead endpoints)
- Queue grew unbounded

Code:
  Map<String, WebhookRetry> retryQueue = new HashMap<>();
  // Never removed failed webhooks that exceeded max retries
  // Never bounded the queue size

Impact: 2 hours of delayed webhooks
Fix: Max retry limit + disk-based queue for overflow
```

### Incident 3: Uber Driver Location Service (2021)

```
Scenario: Real-time driver position tracking
Symptoms:
- 4-hour old pods: 2GB memory, healthy
- 2-day old pods: 8GB memory, GC thrashing
- Performance degraded gradually

Root cause:
- Location history kept in memory for "recent trip" feature
- Old trips never cleaned up
- Each driver: 1000 GPS points × 200 bytes = 200KB
- 5M active drivers × 200KB = 1TB potential leak

The fix:
- Time-windowed data structure (circular buffer)
- Keep only last 2 hours of locations
- Memory bounded regardless of runtime

Impact: Gradual performance degradation
Detection: 2 weeks after introduction
```

---

## Why This Happens

### Memory Leak Categories

```
1. CACHE WITHOUT EVICTION
   ├── "We'll cache it for performance"
   ├── No max size limit
   ├── No TTL (time-to-live)
   └── No LRU eviction

2. EVENT LISTENER LEAKS
   ├── addEventListener() without removeEventListener()
   ├── Pub/sub subscriptions not cleaned up
   └── Observable subscriptions not disposed

3. UNBOUNDED COLLECTIONS
   ├── List that only grows
   ├── Map without removal
   └── Queue without consumer

4. CLOSEABLE RESOURCES
   ├── Streams not closed
   ├── Database connections not released
   └── File handles not closed

5. STATIC REFERENCES
   ├── Static collections that grow
   ├── Singleton holding request-scoped data
   └── Thread-local variables not cleaned

6. CIRCULAR REFERENCES (in some languages)
   ├── Object A references B
   ├── Object B references A
   └── Neither can be GC'd
```

### The Cache Trap (Most Common)

```javascript
// ❌ WRONG: Unbounded cache
const userCache = new Map();

async function getUser(id) {
  if (!userCache.has(id)) {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    userCache.set(id, user);  // Never removed!
  }
  return userCache.get(id);
}

// After 1 year:
// - 10M unique users accessed
// - 10M entries × 1KB = 10GB memory leak
```

```javascript
// ✅ CORRECT: Bounded LRU cache
const LRU = require('lru-cache');

const userCache = new LRU({
  max: 10000,         // Maximum 10,000 entries
  ttl: 1000 * 60 * 5, // 5-minute TTL
  updateAgeOnGet: true,
  dispose: (value, key) => {
    console.log(`Evicting user ${key} from cache`);
  }
});

async function getUser(id) {
  let user = userCache.get(id);
  if (!user) {
    user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    userCache.set(id, user);
  }
  return user;
}
```

---

## Detection Patterns

### Metrics That Reveal Leaks

```
HEALTHY SERVICE (Memory Stable):
├── heap.used: 2GB ± 500MB (stable with GC cycles)
├── heap.max: 4GB
├── gc.time: 50ms avg
├── gc.frequency: 1/minute
└── Memory growth: ~0 after warmup

LEAKING SERVICE:
├── heap.used: 2GB → 3GB → 4GB (monotonic increase)
├── heap.max: 4GB
├── gc.time: 50ms → 200ms → 500ms (increasing)
├── gc.frequency: 1/min → 5/min → 10/min (increasing)
└── Memory growth: +50MB/hour (consistent)

Key patterns:
- Memory doesn't return to baseline after GC
- GC frequency increasing over time
- GC pause duration increasing
- Eventually: OOM or full GC thrashing
```

### Monitoring Queries

```promql
# Memory growth rate (should be ~0 after warmup)
rate(jvm_memory_used_bytes{area="heap"}[1h])

# GC time percentage (should be < 5%)
rate(jvm_gc_collection_seconds_sum[5m]) / 300 * 100

# Object count growth (if instrumented)
rate(app_cache_size_total[1h])

# Detect monotonic growth
increase(jvm_memory_used_bytes{area="heap"}[24h]) > 1e9  # 1GB/day growth
```

### Heap Dump Analysis

```bash
# Generate heap dump (Java)
jmap -dump:format=b,file=heap.hprof $(pgrep -f myapp)

# Or trigger via OOM
java -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heap.hprof -jar app.jar

# Analyze with Eclipse MAT or jhat
# Look for:
# - Dominator tree (what's holding the most memory)
# - Histogram (object counts by class)
# - Leak suspects report
```

### Common Leak Signatures

```
LEAK SIGNATURE: HashMap or ConcurrentHashMap growing unbounded
├── Location: UserSessionCache.sessions
├── Size: 5,000,000 entries
├── Each entry: 2KB
├── Total: 10GB
└── Problem: No eviction, no max size

LEAK SIGNATURE: ArrayList growing unbounded
├── Location: EventProcessor.pendingEvents
├── Size: 2,000,000 entries
├── Problem: Events added faster than processed
└── Fix: Bounded queue with rejection policy

LEAK SIGNATURE: Closeable not closed
├── Location: 50,000 FileInputStream instances
├── Problem: File streams opened but never closed
└── Fix: try-with-resources or explicit close()
```

---

## Prevention Strategies

### 1. Always Bound Your Collections

```java
// ❌ WRONG: Unbounded collections
private final Map<String, Session> sessions = new HashMap<>();
private final List<Event> eventLog = new ArrayList<>();
private final Queue<Task> taskQueue = new LinkedList<>();

// ✅ CORRECT: Bounded with eviction
private final Map<String, Session> sessions = new LinkedHashMap<>(10000, 0.75f, true) {
    @Override
    protected boolean removeEldestEntry(Map.Entry<String, Session> eldest) {
        return size() > 10000;  // LRU eviction at 10k entries
    }
};

private final EvictingQueue<Event> eventLog = EvictingQueue.create(1000);  // Guava

private final BlockingQueue<Task> taskQueue = new ArrayBlockingQueue<>(1000);  // Bounded
```

### 2. Use Weak References for Caches

```java
// ❌ WRONG: Strong references prevent GC
private final Map<Key, LargeObject> cache = new HashMap<>();

// ✅ CORRECT: Weak references allow GC under memory pressure
private final Map<Key, LargeObject> cache = new WeakHashMap<>();

// ✅ BETTER: Use a proper caching library
private final Cache<Key, LargeObject> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(Duration.ofMinutes(5))
    .softValues()  // Allow GC under memory pressure
    .recordStats()  // Enable monitoring
    .build();
```

### 3. Always Close Resources

```java
// ❌ WRONG: Resource leak
public String readFile(String path) throws IOException {
    FileInputStream fis = new FileInputStream(path);
    BufferedReader reader = new BufferedReader(new InputStreamReader(fis));
    return reader.readLine();  // fis never closed!
}

// ✅ CORRECT: try-with-resources
public String readFile(String path) throws IOException {
    try (FileInputStream fis = new FileInputStream(path);
         BufferedReader reader = new BufferedReader(new InputStreamReader(fis))) {
        return reader.readLine();
    }  // Automatically closed
}
```

### 4. Clean Up Event Listeners

```javascript
// ❌ WRONG: Listener leak
class Component {
  constructor() {
    window.addEventListener('resize', this.handleResize);
    // Never removed!
  }
}

// ✅ CORRECT: Clean up on destroy
class Component {
  constructor() {
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }
}
```

### 5. Use Time-Windowed Data Structures

```java
// ❌ WRONG: Keeps all history forever
private final List<LocationUpdate> locationHistory = new ArrayList<>();

public void recordLocation(LocationUpdate location) {
    locationHistory.add(location);  // Unbounded growth
}

// ✅ CORRECT: Time-windowed circular buffer
private final int MAX_HISTORY = 1000;
private final LocationUpdate[] locationHistory = new LocationUpdate[MAX_HISTORY];
private int index = 0;

public void recordLocation(LocationUpdate location) {
    locationHistory[index % MAX_HISTORY] = location;
    index++;
}

// ✅ BETTER: Time-based eviction
private final Cache<Long, LocationUpdate> locationHistory = Caffeine.newBuilder()
    .expireAfterWrite(Duration.ofHours(2))
    .maximumSize(10_000)
    .build();
```

---

## Recovery Procedures

### Immediate Actions

```bash
# 1. Check current memory state
kubectl top pods -l app=myservice

# 2. Generate heap dump before restart (if possible)
kubectl exec $POD -- jmap -dump:format=b,file=/tmp/heap.hprof 1
kubectl cp $POD:/tmp/heap.hprof ./heap-$(date +%Y%m%d-%H%M%S).hprof

# 3. Restart affected pods
kubectl rollout restart deployment/myservice

# 4. Set up more aggressive monitoring
# Add memory alerts at 70% and 85%

# 5. Schedule recurring restarts (temporary workaround)
# Not ideal, but buys time to find the leak
```

### Finding the Leak

```bash
# Method 1: Compare heap dumps over time
# Take dump at T+0, T+1h, T+24h
# Compare dominator trees

# Method 2: Enable GC logging
java -Xlog:gc*:file=/var/log/gc.log -jar app.jar
# Look for full GC frequency increasing

# Method 3: Use async-profiler (live analysis)
./profiler.sh -e alloc -d 60 -f alloc.html $(pgrep -f myapp)

# Method 4: Use JFR (Java Flight Recorder)
jcmd $(pgrep -f myapp) JFR.start duration=60s filename=recording.jfr
```

### Memory Leak Post-Mortem Template

```markdown
## Memory Leak Post-Mortem

### Discovery
- How discovered: [OOM alert / Customer complaint / Monitoring]
- Time to discovery from introduction: [X days]
- Memory growth rate: [X MB/hour]

### Root Cause
- [ ] Unbounded cache
- [ ] Event listener not cleaned up
- [ ] Resource not closed
- [ ] Unbounded collection
- [ ] Thread-local not cleaned
- [ ] Static reference accumulation

### Location
- Class: [com.example.MyCache]
- Field: [sessions]
- Introduced in: [PR #1234 / Commit abc123]

### Impact
- Service restarts required: [X]
- Downtime: [X minutes]
- User impact: [Description]

### Action Items
- [ ] Fix the leak
- [ ] Add bounds to collection/cache
- [ ] Add memory growth alerts
- [ ] Add leak detection in CI/CD
- [ ] Review similar patterns in codebase
```

---

## Monitoring Setup

### Key Metrics

```yaml
# Prometheus metrics for memory leak detection
metrics:
  # Heap memory
  - jvm_memory_used_bytes{area="heap"}
  - jvm_memory_max_bytes{area="heap"}
  - jvm_memory_committed_bytes{area="heap"}

  # GC metrics
  - jvm_gc_collection_seconds_sum
  - jvm_gc_collection_seconds_count
  - jvm_gc_memory_promoted_bytes_total
  - jvm_gc_live_data_size_bytes

  # Application-specific (you should add these)
  - app_cache_size{cache="userSessions"}
  - app_cache_size{cache="apiResponses"}
  - app_collection_size{collection="pendingTasks"}
```

### Alert Rules

```yaml
alerts:
  - alert: MemoryLeakSuspected
    expr: |
      (
        increase(jvm_memory_used_bytes{area="heap"}[24h])
        / jvm_memory_max_bytes{area="heap"}
      ) > 0.1
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "Memory increasing >10% over 24h - possible leak"

  - alert: HighMemoryUsage
    expr: jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"} > 0.85
    for: 5m
    labels:
      severity: warning

  - alert: GCThrashing
    expr: rate(jvm_gc_collection_seconds_sum[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "GC taking >10% of time - memory pressure"

  - alert: MemoryNearOOM
    expr: jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"} > 0.95
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Memory at 95% - OOM imminent"
```

---

## Key Takeaways

### The Pattern

```
Day 1: Deploy, 2GB heap, everything fast
Day 7: 3GB heap, slight GC increase (unnoticed)
Day 14: 4GB heap, occasional GC pauses
Day 21: 5GB heap, users notice slowness
Day 25: OOM crash at 3 AM

The insidious part: No single event, no sudden change, no obvious error
```

### Prevention Checklist

- [ ] All caches have max size AND TTL
- [ ] All collections bounded (no unbounded lists/maps)
- [ ] All resources use try-with-resources or explicit close
- [ ] All event listeners removed on cleanup
- [ ] All thread-locals cleaned after use
- [ ] Memory metrics monitored with growth alerts
- [ ] Regular heap dump analysis (weekly)

### Quick Rules

```
1. EVERY cache needs: maxSize + TTL + eviction policy
2. EVERY collection needs: bounded size or explicit cleanup
3. EVERY resource needs: try-with-resources
4. EVERY listener needs: corresponding removal
5. EVERY leak needs: monitoring to catch it early
```

---

## Related Content

- [Connection Pool Starvation](/problems-at-scale/performance/connection-pool-starvation) - Another resource exhaustion pattern
- [Thread Pool Exhaustion](/problems-at-scale/performance/thread-pool-exhaustion) - Similar but for threads
- [POC #72: Connection Leak Detection](/interview-prep/practice-pocs/connection-leak-detection) - Detection techniques

---

**Remember:** Memory leaks are silent killers. They don't throw exceptions until it's too late. The only defense is proactive monitoring: watch memory growth rate, GC frequency, and collection sizes. If memory doesn't return to baseline after GC, you have a leak.
