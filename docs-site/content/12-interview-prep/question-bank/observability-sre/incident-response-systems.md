---
title: "Incident Response Systems"
layer: interview-q
section: interview-prep/question-bank/observability-sre
difficulty: advanced
tags: [sre, incident-response, on-call, postmortem, chaos-engineering, pagerduty]
---

# Incident Response Systems

6 questions covering incident response from P0-P4 severity definitions to PagerDuty's ML-based alert routing at 10M alerts/month.

---

## Q1: What are incident severity levels P0–P4 and what are the response time SLAs for each?

**Role:** Junior, Mid | **Difficulty:** 🟢 | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand the incident classification framework and can apply it to determine appropriate response urgency.

### Answer in 60 seconds
- **P0 — Critical:** Complete service outage or data breach. All users affected. Revenue loss actively occurring. Example: payment service down, authentication broken for all users, production database corruption.
  - Response time: Page on-call immediately, acknowledge in < 5 minutes, start mitigation within 15 minutes
  - Communication: Status page update within 10 minutes, stakeholder notification within 15 minutes
- **P1 — Major:** Significant degradation affecting a majority of users or a critical feature. Example: checkout 50% error rate, login works but is 30 seconds slow, a major region down.
  - Response time: Page on-call, acknowledge in < 15 minutes, start mitigation within 30 minutes
- **P2 — Minor:** Partial feature degradation affecting a subset of users or non-critical path. Example: search slow but functional, a non-core feature returning errors.
  - Response time: Notify team via Slack, next business hours response acceptable
- **P3 — Low:** Cosmetic or minor issues. Example: dashboard chart wrong, non-critical API returning deprecated field.
  - Response time: Ticket created, addressed in next sprint
- **P4 — Informational:** Monitoring anomaly worth tracking but no user impact. Example: unusually high GC pause, disk at 70% (threshold is 85%).
  - Response time: Logged, reviewed in weekly reliability meeting

### Diagram

```mermaid
graph TD
  subgraph Severity["Incident Severity Framework"]
    P0["P0 — CRITICAL\nComplete outage / data breach\nAll users affected\nResponse: page immediately\nAcknowledge < 5 min\nMitigate < 15 min"]
    P1["P1 — MAJOR\nMajority of users affected\nCritical feature broken\nResponse: page on-call\nAcknowledge < 15 min"]
    P2["P2 — MINOR\nSubset of users affected\nNon-critical path\nResponse: Slack notification\nAddress in business hours"]
    P3["P3 — LOW\nCosmetic issue\nNo functional impact\nResponse: ticket\nNext sprint"]
    P4["P4 — INFO\nAnomaly, no user impact\nResponse: log it\nWeekly review"]
  end

  P0 --> P1 --> P2 --> P3 --> P4

  style P0 fill:#f88,stroke:#900
  style P1 fill:#fa8,stroke:#a60
  style P2 fill:#ff8,stroke:#880
  style P3 fill:#8f8,stroke:#090
  style P4 fill:#aaf,stroke:#009
```

### Severity Decision Tree

```mermaid
graph TD
  Q1{"Is there user-visible impact?"}
  Q1 -->|No| P4["P4 — Monitor"]
  Q1 -->|Yes| Q2{"What fraction of users?"}
  Q2 -->|"< 5%"| Q3{"Is it a critical path?"}
  Q2 -->|"5-50%"| P2["P2 — Minor"]
  Q2 -->|"> 50%"| Q4{"Revenue impact?"}
  Q3 -->|No| P3["P3 — Low"]
  Q3 -->|Yes| P2
  Q4 -->|No| P1["P1 — Major"]
  Q4 -->|Yes| P0["P0 — Critical"]
```

### Pitfalls
- ❌ **Everything is P1:** If teams over-escalate every issue to P1, on-call responders treat all alerts equally — including genuine P0s. Calibrate severity classifications with real examples documented in the runbook.
- ❌ **Not having a P4/informational tier:** Without a low-urgency tier, engineers either ignore genuinely important signals (high GC pauses) or escalate them inappropriately. P4 provides a formal channel for "watch this" items.
- ❌ **Severity set by the reporter not the impact:** "The CEO's dashboard is broken" is not automatically P0. Apply the severity criteria consistently. If the CEO's dashboard is non-critical and cosmetic, it's P3.

### Concept Reference
→ [Observability Fundamentals](../../../09-observability/concepts/observability-fundamentals)

---

## Q2: What is the incident commander role and why does one person need to coordinate?

**Role:** Mid | **Difficulty:** 🟡 | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand the organizational dynamics of P0 incident response and why a single coordinator is essential.

### Answer in 60 seconds
- **Incident Commander (IC):** A single person who takes command of a P0 incident response. Owns coordination, not technical fixing. The IC does NOT debug the system — they ensure the right people are working on the right things.
- **Responsibilities:**
  - Maintain the incident timeline and status updates
  - Assign roles: technical lead (debugging), comms lead (status page, stakeholders), scribe (notes)
  - Make decisions when the team is stuck or disagrees
  - Time-box actions: "We have 10 minutes to diagnose, then we roll back regardless"
  - Declare incident resolved and trigger postmortem
- **Why one person coordinates:** In a crisis, multiple engineers will independently pull in different directions — one debugging DB, another restarting services, a third deploying a fix. Without a coordinator, these actions conflict (restarting services while someone is taking a DB dump invalidates the dump). The IC serializes decision-making.
- **IC is not the most senior engineer:** The IC should be someone trained in incident coordination, not necessarily the domain expert. The domain expert should be debugging, not coordinating.
- **Rotation:** IC role rotates monthly among senior engineers. Requires specific training (incident command system, ICS).

### Diagram

```mermaid
graph TD
  subgraph IncidentRoom["P0 War Room — Roles"]
    IC["Incident Commander\nCoordinates, makes decisions\nDoes NOT debug\nOwns: timeline, status, next actions"]
    TL["Technical Lead\nDebugs the system\nReports findings to IC\nProposes mitigation options"]
    Comms["Comms Lead\nUpdates status page every 15min\nNotifies affected customers\nBriefs leadership"]
    Scribe["Scribe\nLogs all actions in incident doc\nTimestamps every decision\nBuilds postmortem timeline"]

    IC --> TL
    IC --> Comms
    IC --> Scribe
  end

  subgraph Without["Without IC — Chaos"]
    Eng1["Engineer 1: restarting pods"]
    Eng2["Engineer 2: taking DB dump for analysis"]
    Eng3["Engineer 3: deploying hotfix"]
    Conflict["All three conflict:\nhotfix hits restarting pods\nDB dump invalidated by restart\nNo one knows current state"]
    Eng1 --> Conflict
    Eng2 --> Conflict
    Eng3 --> Conflict
  end

  style IC fill:#8f8,stroke:#090
  style Conflict fill:#f88,stroke:#900
```

### Pitfalls
- ❌ **IC also debugging:** An IC debugging the system stops coordinating — no one tracks the timeline, no status page updates, handoffs are missed. IC must focus exclusively on coordination.
- ❌ **No IC role in small teams:** "We're a 5-person team, we don't need an IC" — you do. Even with 2 engineers on call, one coordinates (IC) and one debugs. Coordination overhead is worth it for P0s.
- ❌ **IC making technical decisions unilaterally:** IC is not a dictator. For significant decisions (rollback vs hotfix), IC seeks technical lead input, time-boxes the discussion (5 minutes), then makes the call. Unilateral decisions without technical input cause wrong choices.

### Concept Reference
→ [Observability Fundamentals](../../../09-observability/concepts/observability-fundamentals)

---

## Q3: What makes a blameless postmortem effective — 5-whys, timeline, and action items?

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand how to run postmortems that improve systems rather than assign blame, and the specific techniques (5-whys, timeline reconstruction) that make them effective.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Incident | Payment service P0 — 45 minutes downtime during Black Friday |
| Impact | $2M revenue loss, 180,000 failed transactions |
| Postmortem goal | Identify root cause, prevent recurrence — not find who to blame |
| Postmortem deadline | Must complete within 72 hours while memory is fresh |

### Blameless Postmortem Structure

```mermaid
graph TD
  subgraph PM["Postmortem Document Structure"]
    Summary["Summary\n3-5 bullet points: what happened, when, impact\nWrite last — summarizes everything below"]
    Impact["Impact Section\nDuration: start to mitigation\nUsers affected: N%\nRevenue impact: $X\nRequests failed: N"]
    Timeline["Timeline\nChronological: every action taken with exact timestamps\nData from: logs, metrics, Slack, PagerDuty\nWhat was happening, what was tried, what worked"]
    Root["Root Cause Analysis\n5-Whys drill-down\nDo not stop at the first technical cause\nFind the systemic reason it was possible"]
    Contributing["Contributing Factors\nSecondary factors that made it worse or harder to detect\nExample: monitoring gap, runbook out of date"]
    Actions["Action Items\nEach: description, owner (single person), due date\nMUST be specific and verifiable\nNO: improve monitoring\nYES: Add p99 latency alert for payment-svc by 2026-02-15 — @alice"]
  end

  Summary --> Impact --> Timeline --> Root --> Contributing --> Actions
```

### 5-Whys Example

```mermaid
graph TD
  Symptom["Symptom:\nPayment service returning 500 errors\n45 minutes, 180K transactions failed"]

  W1["Why #1: Why were payment requests failing?\nPostgres connection pool exhausted\n— max_connections=100, needed 150 during peak"]

  W2["Why #2: Why was max_connections=100 insufficient?\nBlack Friday traffic 2x normal\n— connection pool sized for normal load, not peak"]

  W3["Why #3: Why wasn't connection pool sized for peak?\nCapacity planning used average traffic\n— no Black Friday load model existed"]

  W4["Why #4: Why was there no Black Friday load model?\nNo process to create pre-event capacity plans\n— capacity review was ad-hoc, not scheduled"]

  W5["Why #5: Why was capacity review ad-hoc?\nNo SRE ownership of pre-event readiness\n— responsibility was unclear between SRE and product"]

  RootCause["Root Cause:\nNo process for pre-event capacity planning\nand unclear ownership between SRE and product\n(NOT: engineer forgot to increase connection pool)"]

  Symptom --> W1 --> W2 --> W3 --> W4 --> W5 --> RootCause

  style RootCause fill:#8f8,stroke:#090
```

### Action Items That Are Effective vs Ineffective

| Ineffective | Effective |
|-------------|-----------|
| "Improve monitoring" | "Add PagerDuty alert for connection pool > 80% capacity by 2026-02-15 — @alice" |
| "Better capacity planning" | "Create pre-event load model template and schedule capacity review 2 weeks before any major event by 2026-03-01 — @bob" |
| "Fix the connection pool" | "Increase max_connections to 500 and enable PgBouncer connection pooling by 2026-01-30 — @charlie" |
| "Train the team" | "Add Black Friday runbook to on-call guide by 2026-02-01 — @dave" |

### What a great answer includes
- [ ] Blameless means: root cause is systemic, not personal — "the system allowed this to happen" not "alice misconfigured this"
- [ ] 5-whys: drill past first technical cause to find systemic process failure
- [ ] Timeline: exact timestamps, every action taken, built from logs and Slack — not from memory
- [ ] Action items: specific, assigned to one person, have due dates, are verifiable
- [ ] 72-hour deadline: postmortem while memory is fresh; key detail is forgotten after 1 week

### Pitfalls
- ❌ **Stopping 5-whys at the first technical cause:** "Root cause: connection pool too small." This leads to action "increase connection pool size" — which fixes this incident but not the underlying process failure. Keep asking why until you reach a systemic or organizational cause.
- ❌ **Assigning action items to teams not people:** "Platform team will add monitoring" — teams have no individual accountability. Every action item needs one owner who is responsible.
- ❌ **No follow-up on action items:** Postmortem with 10 action items, 0 completed — worse than no postmortem (false sense of learning). Assign a postmortem reviewer who checks completion at the due date.

### Concept Reference
→ [Observability Fundamentals](../../../09-observability/concepts/observability-fundamentals)

---

## Q4: Walk through a P0 payment outage — first 15 minutes step by step

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you know the operational playbook for a P0 incident — not just the tools, but the sequence of actions under pressure.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Incident | Payment service: 100% of checkout requests returning HTTP 500 |
| Detection | PagerDuty alert at T+0, on-call engineer paged |
| Impact | $50K revenue/minute lost, 10K failed transactions/minute |
| Goal | Restore service within 15 minutes |

### First 15 Minutes Playbook

```mermaid
sequenceDiagram
  participant Alert as PagerDuty Alert
  participant OC as On-Call Engineer (IC)
  participant Slack as #incidents Channel
  participant Metrics as Grafana / Datadog
  participant Logs as Kibana
  participant Deploy as Deploy System
  participant Status as Status Page

  Note over Alert: T=0 — Alert fires: payment_error_rate = 100%
  Alert->>OC: Page via SMS + app
  OC->>OC: T=2m — Acknowledge alert
  OC->>Slack: T=2m — Declare P0: payment checkout down\nI am IC — joining war room
  OC->>Status: T=3m — Post: Investigating payment issues (no detail yet)

  OC->>Metrics: T=3m — Check 4 Golden Signals
  Metrics-->>OC: Errors: 100% | Latency: timeout | Traffic: normal | Saturation: normal CPU
  Note over OC: Traffic normal — not a traffic spike. Error only. Suspect code or infra.

  OC->>Logs: T=5m — Check payment-svc error logs last 5 minutes
  Logs-->>OC: ERROR: connection timeout to postgres:5432
  Note over OC: DB connectivity issue — not a code bug

  OC->>Metrics: T=6m — Check DB metrics: connections, replication lag
  Metrics-->>OC: DB connection pool: 100/100 used — POOL EXHAUSTED

  OC->>Slack: T=7m — Root cause hypothesis: DB connection pool exhausted\nChecking recent deploys
  OC->>Deploy: T=7m — Check deploys in last 2 hours
  Deploy-->>OC: Deployment at T-35min: increased worker thread count from 50 to 200

  Note over OC: T=8m — Root cause confirmed: 200 workers x 1 connection each = 200 connections needed, pool max=100
  OC->>Slack: T=8m — Root cause: deploy at T-35min increased workers beyond connection pool capacity\nMitigation: rollback deploy

  OC->>Deploy: T=9m — Initiate rollback to previous version
  Deploy-->>OC: T=12m — Rollback complete — rolling restart done

  OC->>Metrics: T=13m — Monitor error rate
  Metrics-->>OC: T=14m — Error rate dropping: 80% → 20% → 2% → 0%

  OC->>Status: T=15m — Update: payment service recovered, monitoring
  OC->>Slack: T=15m — Incident resolved in 15 minutes. Scheduling postmortem within 48h.
```

### Decision Tree During Diagnosis

```mermaid
graph TD
  Start["T=3m: Check 4 Golden Signals"]

  TrafficSpike{"Traffic 10x normal?"}
  Start --> TrafficSpike
  TrafficSpike -->|Yes| ScaleOut["Scale out immediately\n(known issue — DDOS or viral)"]
  TrafficSpike -->|No| ErrorType{"What kind of errors?"}

  ErrorType -->|"Timeout to DB"| DBIssue["Check DB: connections, disk, replication lag"]
  ErrorType -->|"OOM / crash"| MemIssue["Check pod memory, heap dumps"]
  ErrorType -->|"503 from LB"| PodIssue["Check pod count — are pods healthy?"]

  DBIssue --> RecentDeploy{"Deploy in last 2h?"}
  RecentDeploy -->|Yes| Rollback["Rollback is fastest mitigation\nDo NOT wait for full root cause"]
  RecentDeploy -->|No| DBFix["Scale DB connections\nor restart stuck connections"]
```

### What a great answer includes
- [ ] Acknowledge in under 5 minutes and declare in Slack immediately
- [ ] Status page update within 3 minutes (vague is fine — "investigating" reduces inbound support tickets)
- [ ] Check 4 Golden Signals first to narrow the problem space quickly
- [ ] Look at recent deploys early — most P0s are deploy-related, rollback is fastest fix
- [ ] Prioritize mitigation over root cause: restore service first, understand why later

### Pitfalls
- ❌ **Debugging root cause before mitigating:** A 20-minute deep investigation while service is down = $1M lost. Mitigate first (rollback, scale out, circuit break), then do the postmortem.
- ❌ **Not updating the status page for 30 minutes:** Support team gets 1,000 tickets in the first 10 minutes. A 3-minute status page update ("investigating payment issues") cuts inbound tickets by 60%.
- ❌ **Multiple engineers debugging independently:** Without an IC declaring "we are rolling back" at T=8m, one engineer rolls back while another is deploying a hotfix — conflict causes longer outage.

### Concept Reference
→ [Observability Fundamentals](../../../09-observability/concepts/observability-fundamentals)

---

## Q5: Chaos engineering — Netflix Chaos Monkey, Gameday, blast radius control

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand how to proactively find reliability weaknesses and the safety controls required to do it without causing customer incidents.

### Answer in 60 seconds
- **Chaos engineering:** Intentionally injecting failures into production (or staging) to discover weaknesses before they cause real incidents. The hypothesis: if we inject failure X, the system should handle it gracefully with behavior Y.
- **Netflix Chaos Monkey:** Randomly terminates EC2 instances in production during business hours (not nights/weekends). Forces teams to build services that tolerate instance failure automatically. If Chaos Monkey causes an incident, the team's reliability posture is exposed — they must fix it.
- **Gameday:** A planned, controlled chaos experiment. Team chooses a failure scenario (e.g., "what happens if our primary DB fails?"), runs it in a controlled environment, observes behavior, and identifies gaps. Run quarterly or before major events.
- **Blast radius control:** Limiting the impact of chaos experiments. Techniques: (1) traffic splitting — inject failures into 1% of traffic, monitor, expand if safe; (2) feature flags — inject failure only for internal users first; (3) time-boxing — run experiment for 5 minutes max, auto-stop on p99 spike.
- **What to inject:** Network latency (+200ms), packet loss (5%), CPU spike (90%), disk full (95%), process kill, dependency timeout, memory leak.

### Diagram

```mermaid
graph TD
  subgraph Netflix["Netflix Chaos Architecture"]
    CM["Chaos Monkey\nRuns during business hours only\nRandomly terminates EC2 instances\nFails if service cannot recover automatically"]

    CM2["Chaos Kong\nTerminates entire AWS region\nTests cross-region failover\nRun quarterly — high blast radius"]

    Latency["Latency Injection\n+200ms to dependency calls\nTests timeout and retry behavior\nRun on 1% of requests — minimal blast radius"]
  end

  subgraph Controls["Blast Radius Controls"]
    BR1["Time-based:\nRun only 9am-5pm business hours\nTeam present to respond immediately"]
    BR2["Traffic-based:\nInject into 1% of requests first\nExpand to 10% if metrics stay healthy"]
    BR3["Auto-stop:\nIf p99 > 2x baseline: auto-halt experiment\nPrometheus alert triggers Chaos framework kill switch"]
  end

  Netflix --> Controls
```

```mermaid
sequenceDiagram
  participant Team as Engineering Team
  participant CF as Chaos Framework
  participant Prod as Production
  participant Prom as Prometheus

  Team->>CF: Gameday: inject DB latency +500ms to 1% of checkout traffic
  CF->>Prod: Apply latency injection (1% traffic split)
  Prom->>Prom: Monitoring: checkout p99 latency, error rate, DB connection pool
  Prom-->>Team: T=2m: p99 checkout latency: 800ms (normally 200ms) — elevated but functional
  Prom-->>Team: T=5m: error rate: 0.5% (above 0.1% threshold)
  Team->>CF: Stop experiment — found weakness: no circuit breaker on DB calls
  CF->>Prod: Remove latency injection
  Team->>Team: Action: add circuit breaker with 200ms timeout to DB calls by 2026-02-01
```

### Pitfalls
- ❌ **Running chaos without safety controls:** "Let's randomly kill services and see what happens" without auto-stop, blast radius limits, or rollback plans will cause real customer incidents. Chaos engineering requires as much engineering discipline as the system itself.
- ❌ **Only testing in staging:** Netflix runs Chaos Monkey in production for a reason — staging rarely replicates production traffic patterns, data distributions, and load. Staging chaos provides false confidence. Start with 1% production traffic.
- ❌ **No hypothesis before the experiment:** Random chaos without a hypothesis is just breaking things. Define: "We expect X to happen when we inject Y. If we observe Z instead, here is what we will fix." The hypothesis makes it an experiment, not sabotage.

### Concept Reference
→ [Observability Fundamentals](../../../09-observability/concepts/observability-fundamentals)

---

## Q6: PagerDuty routes 10M alerts/month with ML-based noise reduction — alert grouping and inhibition

**Role:** Staff | **Difficulty:** ⚫ | **Priority:** P2 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand alert routing at scale, intelligent deduplication, and the ML techniques PagerDuty uses to reduce on-call fatigue.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| PagerDuty scale | 10M alert events/month across all customers |
| Average on-call engineer | 500 alerts/month (16/day), 30% are actionable |
| Problem | 70% of alerts are noise — duplicates, auto-resolved, correlated |
| Goal | Route only actionable, deduplicated alerts to on-call |

### Alert Pipeline Architecture

```mermaid
graph LR
  subgraph Sources["Alert Sources"]
    Prom["Prometheus AlertManager\n(most common source)"]
    DD["Datadog Monitors"]
    CloudWatch["AWS CloudWatch Alarms"]
    Custom["Custom webhooks"]
  end

  subgraph PD["PagerDuty Routing Pipeline"]
    Ingest["Ingest API\n10M events/month\n~4 events/sec average\nSpikes to 100K/sec during large incidents"]

    Dedup["Deduplication Engine\nMatch incoming event to open incident\nby: service + alert fingerprint\nIf match: update incident, no new page\nDedup rate: ~40% of events"]

    Group["Event Intelligence — ML Grouping\nCluster correlated alerts\n'DB disk full' + 'DB connection refused' + '5xx from all DB-dependent services'\n→ grouped into 1 incident: DB outage\nGroup rate: ~30% further reduction"]

    Route["Routing Engine\nPolicy: escalation schedule, team, urgency\nP0: page immediately\nP1: page after 5 min no ack\nP2: Slack only, no page"]

    Page["Page on-call\nSMS + App + Phone call for P0\nOnly ~30% of original events reach this stage"]
  end

  Sources --> Ingest
  Ingest --> Dedup
  Dedup --> Group
  Group --> Route
  Route --> Page
```

### ML-Based Alert Grouping

```mermaid
graph TD
  subgraph Incident["Real Incident: Database Cluster Failure"]
    A1["Alert 1: MySQL replication lag > 60s\n(T=0)"]
    A2["Alert 2: 5xx rate > 5% on payment-svc\n(T=15s)"]
    A3["Alert 3: 5xx rate > 5% on cart-svc\n(T=20s)"]
    A4["Alert 4: 5xx rate > 5% on user-svc\n(T=25s)"]
    A5["Alert 5: MySQL connection refused\n(T=30s)"]
    A6["Alert 6: DB connection pool exhausted on payment-svc\n(T=35s)"]
  end

  ML["ML Grouping Engine\nInput: alert text, service dependency graph, timing\nModel: trained on historical incident patterns\nDecision: A1 is root cause event\nA2-A6 are correlated downstream effects\nGroup into 1 incident: MySQL cluster failure"]

  Result["Single PagerDuty incident created\n1 page to on-call with context:\n'MySQL cluster failure — 5 downstream services affected'\nInstead of: 6 separate pages for each alert"]

  A1 --> ML
  A2 --> ML
  A3 --> ML
  A4 --> ML
  A5 --> ML
  A6 --> ML
  ML --> Result

  style Result fill:#8f8,stroke:#090
```

### Alert Inhibition

```mermaid
graph TD
  Inhibit["Alert Inhibition:\nWhen a high-severity alert fires, suppress correlated lower-severity alerts\nPrevent symptom alerts from creating noise alongside the cause alert"]

  Example["Example:\nIF alert: DB primary node down (P0) is FIRING\nTHEN suppress: all 'DB connection failed' alerts (P2)\nRationale: connection failures are expected symptom of primary down\nSuppressing them reduces noise by 10-20 alerts during a DB outage"]

  Config["AlertManager inhibition config:\ninhibit_rules:\n  - source_match:\n      alertname: DBPrimaryDown\n    target_match_re:\n      alertname: DB.*ConnectionFailed\n    equal: [cluster]"]

  Inhibit --> Example --> Config
```

| Noise Reduction Technique | Reduction | Mechanism |
|--------------------------|-----------|-----------|
| Deduplication | 40% fewer pages | Match events to existing open incidents |
| ML grouping | 30% further reduction | Cluster correlated alerts from same root cause |
| Inhibition | 10-20% further reduction | Suppress symptoms when cause is known |
| `for` clause in alert rules | 20-30% at source | Only fire after sustained condition |
| Combined | 70-80% noise reduction | 10M events → ~30% actionable pages |

### What a great answer includes
- [ ] State the scale: 10M events/month, pipeline must handle 100K/sec burst during major incidents
- [ ] Deduplication: fingerprint-based match prevents duplicate pages for same issue
- [ ] ML grouping: service dependency graph + timing clustering identifies root cause vs symptoms
- [ ] Inhibition: source alert suppresses correlated target alerts (cause suppresses symptoms)
- [ ] Outcome: 70% noise reduction — on-call receives actionable alerts, not raw event volume

### Pitfalls
- ❌ **Only deduplicating exact duplicate alerts:** Two different alert names for the same root cause ("DB disk 90%" and "DB connection refused") are not exact duplicates but are highly correlated. ML grouping handles this; exact deduplication does not.
- ❌ **Inhibition without time bounds:** If the "DB primary down" inhibition rule is configured without a maximum TTL, and the DB recovers but the alert fails to resolve, all DB connection alerts are suppressed indefinitely. Always set inhibition TTL (maximum 2 hours).
- ❌ **Routing all alerts with equal urgency:** Not all alerts need immediate phone calls. Configure urgency policies: P0 = phone + SMS, P1 = SMS only, P2 = Slack + mobile push. Waking someone at 3am for a P2 issue destroys on-call morale.

### Concept Reference
→ [Observability Fundamentals](../../../09-observability/concepts/observability-fundamentals)
