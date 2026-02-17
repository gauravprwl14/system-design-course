# Multi-Region Architecture - Global Scale Distribution

> **Reading Time:** 24 minutes
> **Difficulty:** Advanced
> **Impact:** Serve users worldwide with < 50ms latency and survive entire region outages

## Why Go Multi-Region?

**Two reasons: Latency and resilience.**

```
Reason 1: Physics (Speed of Light)

Server in US-East (Virginia):
  User in Virginia:  20ms RTT  ✅
  User in London:    80ms RTT  ⚠️
  User in Mumbai:    200ms RTT ❌
  User in Sydney:    250ms RTT ❌

With servers in each region:
  User in Virginia → US-East server:  20ms  ✅
  User in London   → EU-West server:  15ms  ✅
  User in Mumbai   → AP-South server: 20ms  ✅
  User in Sydney   → AP-SE server:    15ms  ✅

Reason 2: Resilience (Entire Region Failure)

2017: AWS US-East-1 S3 outage
  → Took down Slack, Trello, IFTTT, parts of the internet
  → Companies with single-region = offline for 4 hours

2019: Google Cloud US-Central outage
  → YouTube, Gmail, Snapchat partially offline
  → Multi-region services recovered in minutes

Multi-region ≠ luxury. It's survival.
```

**Companies that require multi-region:**

```
Netflix:    3 AWS regions (US, EU, APAC)
            Survives full region loss with zero downtime

Uber:       5+ regions globally
            Rides never stop, even during cloud outages

Google:     20+ regions
            Spanner database spans the globe

Stripe:     Multi-region payment processing
            Financial services can't go down
```

---

## Deployment Models

### Active-Passive (Warm Standby)

```
Primary region handles ALL traffic
Secondary region is on standby (warm)

Normal operation:
┌─────────┐     ┌──────────────────┐
│  Users  │────▶│  US-East (Active) │
│ (all)   │     │  ┌────┐ ┌────┐   │
└─────────┘     │  │App │ │ DB │   │
                │  └────┘ └────┘   │
                └────────┬─────────┘
                         │ Replication
                ┌────────▼─────────┐
                │ EU-West (Passive) │
                │  ┌────┐ ┌────┐   │
                │  │App │ │ DB │   │
                │  │(idle)│(replica)│
                └──────────────────┘

During failover (US-East down):
┌─────────┐     ┌──────────────────┐
│  Users  │     │  US-East (DOWN)  │
│ (all)   │     │       ☠️          │
└────┬────┘     └──────────────────┘
     │
     │          ┌──────────────────┐
     └────────▶ │ EU-West (Active) │
                │  ┌────┐ ┌────┐   │
                │  │App │ │ DB │   │
                │  │(now)│(promoted)│
                └──────────────────┘

Pros:
  ✅ Simpler - no data conflicts
  ✅ Cheaper - passive region is mostly idle
  ✅ Clear data ownership

Cons:
  ❌ Wasted capacity in passive region
  ❌ Higher latency for distant users
  ❌ Failover takes minutes (DNS change + DB promotion)
  ❌ Passive region may have stale data
```

### Active-Active (Multi-Primary)

```
ALL regions handle traffic simultaneously

┌──────────────────────────────────────────────────┐
│                  DNS / Load Balancer              │
│            (routes to nearest region)             │
└─────────┬──────────────┬──────────────┬──────────┘
          ▼              ▼              ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  US-East    │ │  EU-West    │ │  AP-South   │
   │  (Active)   │ │  (Active)   │ │  (Active)   │
   │             │ │             │ │             │
   │ ┌───┐ ┌──┐ │ │ ┌───┐ ┌──┐ │ │ ┌───┐ ┌──┐ │
   │ │App│ │DB│ │ │ │App│ │DB│ │ │ │App│ │DB│ │
   │ └───┘ └──┘ │ │ └───┘ └──┘ │ │ └───┘ └──┘ │
   └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
          │               │               │
          └───────────────┼───────────────┘
                    Bi-directional
                    replication

Pros:
  ✅ Lowest latency (serve from nearest region)
  ✅ Full capacity utilization
  ✅ Instant failover (traffic just routes elsewhere)
  ✅ No wasted capacity

Cons:
  ❌ Data conflicts (two regions modify same data)
  ❌ Complex - must handle eventual consistency
  ❌ More expensive (full infra in every region)
  ❌ Cross-region replication lag
```

### Active-Active with Regional Ownership

```
Best of both worlds: Active-active but each user "belongs" to a region

User assignment:
  Users in Americas → US-East (primary for their data)
  Users in Europe   → EU-West (primary for their data)
  Users in Asia     → AP-South (primary for their data)

Read: From nearest region (may be stale by ms)
Write: To primary region for that user's data

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  US-East    │ ◀──▶│  EU-West    │ ◀──▶│  AP-South   │
│             │     │             │     │             │
│ Primary for │     │ Primary for │     │ Primary for │
│ US users    │     │ EU users    │     │ APAC users  │
│ Replica for │     │ Replica for │     │ Replica for │
│ EU/APAC     │     │ US/APAC     │     │ US/EU       │
└─────────────┘     └─────────────┘     └─────────────┘

Benefits:
  - No write conflicts (single primary per user)
  - Fast reads everywhere (local replicas)
  - Clear failover: if US-East down, EU-West takes US users
  - Netflix uses this approach
```

---

## Traffic Routing

### DNS-Based Routing

```
Most common approach: Route users to nearest region via DNS

User in London → DNS query: api.example.com

Route 53 (AWS) or Cloudflare DNS:
  Geo-routing rules:
    Europe     → eu-west.api.example.com   (52.1.2.3)
    Americas   → us-east.api.example.com   (54.5.6.7)
    Asia       → ap-south.api.example.com  (13.8.9.0)

  Latency-based routing (even better):
    Measure latency from resolver to each region
    Route to lowest latency endpoint
    Updates automatically as conditions change

  Health checks:
    Check /health every 10 seconds
    If US-East fails health check → route US traffic to EU-West
    Failover time: 30-60 seconds (DNS TTL)
```

### Anycast Routing

```
Same IP address announced from multiple locations
BGP routing sends traffic to nearest location

Cloudflare approach:
  All 310+ locations announce the same IP
  User traffic naturally routes to nearest PoP
  No DNS-level configuration needed

  User (Mumbai) ──BGP──▶ Mumbai PoP (1.1.1.1)
  User (London) ──BGP──▶ London PoP (1.1.1.1)
  User (NYC)    ──BGP──▶ NYC PoP (1.1.1.1)

  Same IP, different physical servers!

Pros: Instant failover, no DNS propagation delay
Cons: Only works for stateless/edge traffic
```

### Application-Level Routing

```
For stateful operations, route at application layer:

┌────────┐     ┌──────────────┐
│ Client │────▶│  API Gateway │
│        │     │              │
│ Header:│     │ Read user's  │
│ Region:│     │ home region  │
│ EU     │     │              │
└────────┘     └──────┬───────┘
                      │
            ┌─────────┼─────────┐
            ▼         ▼         ▼
        ┌───────┐ ┌───────┐ ┌───────┐
        │US-East│ │EU-West│ │AP-South│
        │       │ │  ✅   │ │       │
        └───────┘ └───────┘ └───────┘

For writes: Route to user's home region
For reads: Serve from local region (stale OK)
```

---

## Data Replication

### Asynchronous Replication (Most Common)

```
Write to primary → Replicate to other regions async

Write flow:
  1. User writes to US-East (primary)
  2. US-East acknowledges write immediately
  3. Background replication to EU-West and AP-South
  4. Replication lag: 50-500ms typically

┌───────────┐  write   ┌───────────┐
│   Client  │────────▶│  US-East  │
│           │◀── ACK ──│ (primary) │
└───────────┘          └─────┬─────┘
                             │ async replication
                    ┌────────┼────────┐
                    ▼        ▼        ▼
              ┌──────────┐ ┌──────────┐
              │ EU-West  │ │ AP-South │
              │ (50ms    │ │ (200ms   │
              │  behind) │ │  behind) │
              └──────────┘ └──────────┘

Pros: Fast writes, no cross-region latency on write path
Cons: Stale reads possible, data loss if primary fails
      before replication completes
```

### Synchronous Replication (Strong Consistency)

```
Write to primary → Wait for ALL regions to confirm

Write flow:
  1. User writes to US-East
  2. US-East replicates to EU-West and AP-South
  3. Wait for confirmation from all regions
  4. Then acknowledge to user

  Latency: max(US→EU, US→APAC) = ~200ms per write
  (vs ~5ms for local write)

Google Spanner approach:
  - Uses TrueTime (GPS + atomic clocks) for global ordering
  - Synchronous replication across continents
  - Consistent reads from any region
  - Write latency: 10-20ms (within continent)
  - Trade-off: Higher write latency for global consistency
```

### Conflict Resolution (Active-Active)

```
Problem: Two regions modify the same data simultaneously

User changes email in US-East: "alice@new.com"
User changes email in EU-West: "alice@other.com"
(Maybe same user on two devices, or a race condition)

Strategy 1: Last Writer Wins (LWW)
  Each write has a timestamp
  Highest timestamp wins
  Simple but can lose data

Strategy 2: Conflict-free Replicated Data Types (CRDTs)
  Data structures that merge automatically
  Counters: Sum all increments
  Sets: Union of all additions
  No conflicts possible by design

Strategy 3: Application-Level Resolution
  Detect conflict → Ask user to resolve
  Git-style: "These changes conflict, which one?"
  Best for: Documents, collaborative editing

Strategy 4: Regional Ownership (avoid conflicts)
  Each user's data has a home region
  Only home region processes writes
  Conflicts impossible (single writer)
  Netflix and Uber use this approach
```

---

## Database Strategies

### CockroachDB / Spanner (Global SQL)

```
Distributed SQL across regions:

┌──────────────────────────────────────────┐
│           CockroachDB Cluster            │
│                                          │
│  US-East        EU-West       AP-South   │
│  ┌───────┐     ┌───────┐    ┌───────┐   │
│  │Node 1 │     │Node 3 │    │Node 5 │   │
│  │Node 2 │     │Node 4 │    │Node 6 │   │
│  └───────┘     └───────┘    └───────┘   │
│                                          │
│  Raft consensus across regions           │
│  Reads: From nearest (follower reads)    │
│  Writes: Routed to leaseholder node      │
└──────────────────────────────────────────┘

Configuration: Pin data locality
  US users' data → leaseholder in US-East
  EU users' data → leaseholder in EU-West

  CREATE TABLE users (
    id UUID PRIMARY KEY,
    region STRING NOT NULL,
    ...
  ) LOCALITY REGIONAL BY ROW;
```

### DynamoDB Global Tables

```
Fully managed multi-region replication:

┌──────────────┐     ┌──────────────┐
│ DynamoDB     │◀───▶│ DynamoDB     │
│ US-East-1    │     │ EU-West-1    │
│              │     │              │
│ Read/Write ✅ │     │ Read/Write ✅ │
└──────────────┘     └──────────────┘
        ▲                    ▲
        │                    │
        └─────────┬──────────┘
                  │
          ┌───────▼───────┐
          │ DynamoDB      │
          │ AP-South-1    │
          │ Read/Write ✅  │
          └───────────────┘

Features:
  - Active-active in all regions
  - Automatic conflict resolution (last writer wins)
  - Replication lag: < 1 second typically
  - No application code changes needed
```

### Redis with Cross-Region Replication

```
Cache layer across regions:

┌─────────────┐              ┌─────────────┐
│ Redis       │  replication │ Redis       │
│ US-East     │─────────────▶│ EU-West     │
│ (primary)   │              │ (replica)   │
│ Read+Write  │              │ Read only   │
└─────────────┘              └─────────────┘

Redis Enterprise Active-Active:
  Both regions read AND write
  CRDTs for conflict-free merging
  Counters, sets, sorted sets merge automatically
```

---

## Disaster Recovery

### RPO and RTO

```
RPO (Recovery Point Objective):
  "How much data can we afford to lose?"
  RPO = 0: No data loss (synchronous replication)
  RPO = 5 min: Up to 5 minutes of data loss (async replication)

RTO (Recovery Time Objective):
  "How fast must we recover?"
  RTO = 0: Instant failover (active-active)
  RTO = 5 min: Manual failover with scripted process
  RTO = 1 hr: Restore from backup

Cost vs RPO/RTO:
┌─────────────────────────────────────────────┐
│                                             │
│  $$$$$  │ Sync replication + active-active  │ RPO=0, RTO=0
│         │                                   │
│  $$$    │ Async replication + warm standby  │ RPO=mins, RTO=mins
│         │                                   │
│  $$     │ Periodic backup + cold standby    │ RPO=hours, RTO=hours
│         │                                   │
│  $      │ Backup to another region only     │ RPO=hours, RTO=days
│         │                                   │
└─────────────────────────────────────────────┘
```

### Failover Automation

```
Automated failover flow:

1. Health Check Failure
   Region US-East health check fails
   (3 consecutive failures in 30 seconds)

2. Verify Outage
   Cross-check from multiple monitoring locations
   Avoid false positives (one monitoring location down ≠ region down)

3. Trigger Failover
   Automated script runs:
   a. Update DNS to remove US-East
   b. Promote EU-West database replica to primary
   c. Scale up EU-West instances (handle extra traffic)
   d. Notify on-call team

4. Validate
   Health checks pass on EU-West
   Traffic confirmed flowing to EU-West
   Error rates normal

5. Recovery (when US-East returns)
   Re-sync data from EU-West → US-East
   Validate data consistency
   Gradually shift traffic back
   Restore normal routing

Netflix approach (Chaos Engineering):
  - Regularly test failover by intentionally killing regions
  - Chaos Kong: Simulate entire AWS region failure
  - Teams practice recovery procedures monthly
  - Failover is a routine operation, not an emergency
```

---

## Real-World Architecture: Netflix

```
Netflix Multi-Region Architecture:

3 AWS regions: US-East-1, US-West-2, EU-West-1

┌──────────────────────────────────────────────────┐
│                   Route 53 (DNS)                 │
│        Latency-based + health check routing      │
└──────────┬──────────────┬──────────────┬─────────┘
           ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  US-East-1  │ │  US-West-2  │ │  EU-West-1  │
    │             │ │             │ │             │
    │ Zuul (GW)   │ │ Zuul (GW)   │ │ Zuul (GW)   │
    │ 100+ svc    │ │ 100+ svc    │ │ 100+ svc    │
    │             │ │             │ │             │
    │ Cassandra   │ │ Cassandra   │ │ Cassandra   │
    │ (async rep) │ │ (async rep) │ │ (async rep) │
    │             │ │             │ │             │
    │ EVCache     │ │ EVCache     │ │ EVCache     │
    │ (local)     │ │ (local)     │ │ (local)     │
    └─────────────┘ └─────────────┘ └─────────────┘

Key decisions:
  - Cassandra: Multi-region async replication
    (accepts brief inconsistency for availability)
  - EVCache: Local per region (no cross-region cache)
  - Zuul: Regional deployment, stateless
  - Chaos Kong: Monthly region failure tests
  - Failover: < 5 minutes, fully automated
```

---

## Common Mistakes

### 1. Treating Multi-Region as "Just Run It Twice"

```
❌ "Let's just deploy our app to two regions"
   Forgot: Database replication, session management,
   cache warming, background job coordination,
   deployment orchestration, monitoring per region

✅ Multi-region is an architecture decision
   Affects every layer: data, compute, network, ops
   Plan for it from the start, don't bolt it on
```

### 2. Not Testing Failover

```
❌ "We have a standby region, we're safe"
   But: Never tested failover
   Result: Standby region fails when you need it most
   (Stale configs, missing data, capacity insufficient)

✅ Test failover regularly
   Monthly automated failover drills
   Netflix Chaos Kong: Kill a region on purpose
   Fix issues when they're not emergencies
```

### 3. Synchronous Cross-Region Calls

```
❌ API request in US-East calls service in EU-West
   200ms cross-region latency PER CALL
   3 cross-region calls = 600ms added latency

✅ All synchronous calls within same region
   Cross-region only for async replication
   Each region should be self-sufficient for reads
```

### 4. Single-Region Dependencies

```
❌ All regions depend on one auth service in US-East
   US-East goes down → ALL regions lose auth
   Your multi-region setup is actually single-region

✅ Every critical service deployed in every region
   No cross-region dependencies on the critical path
   Regional autonomy: Each region can operate alone
```

---

## Key Takeaways

```
1. Start with active-passive if unsure
   Simpler, cheaper, still provides DR
   Graduate to active-active when latency demands it

2. Regional data ownership avoids conflicts
   Each user's data has a home region
   Only home region accepts writes
   Other regions have read replicas

3. Async replication is the default choice
   Accept 50-500ms replication lag
   Design for eventual consistency
   Only use sync replication when legally required

4. Test failover regularly
   Automate the failover process
   Run chaos experiments monthly
   Failover should be boring and routine

5. No cross-region synchronous calls
   Each region must be self-sufficient
   Cross-region = async replication only

6. DNS-based routing for simplicity
   Latency-based routing with health checks
   30-60 second failover via DNS TTL

7. Start with 2 regions, not 5
   US-East + EU-West covers most global traffic
   Add more regions only when latency requires it
```
