---
title: "System Design Interview Anti-Patterns"
layer: interview-q
section: "12-interview-prep/question-bank"
difficulty: intermediate
tags: [interview, anti-patterns, mistakes, system-design, tips]
category: interview-prep
---

# System Design Interview Anti-Patterns

Most system design interviews are not lost on technical knowledge. They are lost on process. A candidate who knows every distributed systems paper but jumps straight to drawing boxes, never mentions failure modes, or throws around "Cassandra" without understanding tombstones will lose to a candidate who thinks out loud, asks good questions, and reasons about trade-offs under uncertainty.

This guide covers 12 anti-patterns observed across thousands of system design interviews. For each, you will see what the behavior looks like verbatim, what conclusion the interviewer draws, and what a stronger answer sounds like.

---

## Anti-Pattern 1: The Requirements Skipper

### What it looks like

The interviewer says: "Design a URL shortener."

The candidate immediately picks up the pen and starts drawing:

> "OK so we have a client, it hits a load balancer, then we have an app server, then a database — probably MySQL — and we'll cache with Redis..."

The candidate is three boxes deep before asking a single question about scale, use case, or constraints.

### Why it fails

The interviewer concludes: **this person builds before they understand the problem.** In real engineering, jumping to implementation before requirements are clear is how you spend three months building the wrong thing. A URL shortener for a startup with 1,000 links/day is architecturally different from bit.ly at 10 billion redirects/day. The candidate has no idea which one they are designing, and they don't seem to care.

Experienced engineers know that the first 5 minutes of any design session are the most valuable. This candidate just skipped them.

### What to say instead

Take 3-5 minutes to ask scoping questions before touching the whiteboard:

> "Before I start drawing, let me make sure I understand the problem. A few questions: What's the expected read-to-write ratio — are we doing more link creation or more redirects? What scale are we targeting — daily active users, links created per day, redirects per second? Do we need analytics like click counts and geographic data? Any durability requirements — is it OK if a shortened link occasionally disappears? Should custom slugs be supported?"

Then summarize back:
> "OK so to confirm: we're targeting roughly 100M redirects/day, write-heavy analytics, no custom slugs in v1, and links should be permanent. Does that sound right?"

Now start drawing. You have a system to design.

---

## Anti-Pattern 2: The Premature Optimizer

### What it looks like

The candidate is designing a job board. The interviewer has not mentioned scale yet.

> "We need to make sure job searches return in under 10ms P99. I'd probably shard Elasticsearch across 50 nodes, use a custom scoring pipeline, and pre-warm the cache on every write..."

The system has no confirmed traffic numbers. The candidate is already designing for Google-scale latency.

### Why it fails

The interviewer concludes: **this candidate cannot prioritize.** Optimizing P99 before establishing that P50 is acceptable — or that you even have enough users to measure P99 — signals poor engineering judgment. Premature optimization is a classic senior-engineer trap. Staff engineers and above know that the right performance target depends entirely on the SLO, which depends entirely on the product requirements.

More practically: if the candidate spends 15 minutes on latency optimization for a system that has 500 users, there is no time left to discuss the actual hard parts (data modeling, consistency, failure handling).

### What to say instead

Establish the baseline first, then optimize only what matters:

> "Let me first make sure the basic design can serve the load, then we can talk about where to invest in optimization. At 10k job searches/day, a single Postgres instance with proper indexing on `job_title` and `location` will handle this easily — median latency under 5ms. If we grow to 10M searches/day, then I'd introduce Elasticsearch for full-text search and add a read replica for analytics queries. But I wouldn't start there."

Name the decision point explicitly:
> "The optimization trigger for me is: if P99 search latency exceeds 200ms at peak load, that's when we invest in Elasticsearch. Before that, we're adding complexity that costs more to operate than it saves."

---

## Anti-Pattern 3: The Magic Database Picker

### What it looks like

The interviewer asks about storing user activity events.

> "I'd use Cassandra. It's great for time-series data and scales horizontally."

Interviewer: "Why Cassandra specifically? What are its trade-offs?"

> "It's really fast and fault-tolerant. Netflix uses it."

### Why it fails

The interviewer concludes: **this candidate has heard of Cassandra but does not understand it.** Saying "use Cassandra" without knowing its consistency model, partition key design constraints, tombstone problem, or failure modes is a red flag. It signals that the candidate is name-dropping tools from blog posts rather than reasoning from first principles.

Cassandra makes specific trade-offs: eventual consistency by default (though tunable), no cross-partition transactions, poor range scans without a carefully designed partition key, and significant operational overhead for tombstone compaction. If you don't know these, you can't know when Cassandra is the right choice.

The same applies to every "magic database": Kafka, Redis, DynamoDB, Neo4j. Naming the tool without being able to defend why it fits — and what it gives up — is a pattern that fails at staff level and above.

### What to say instead

Pick the database by naming your data access pattern, then pick the tool that fits:

> "For user activity events, my primary access pattern is append-only writes at high throughput, and reads are time-range queries like 'give me all events for user 123 in the last 7 days.' That's a write-heavy, time-series workload.

> Cassandra works well here because the natural partition key is `(user_id, time_bucket)`, which distributes load evenly and makes time-range reads efficient within a partition. The trade-off is that cross-user analytics — like 'how many users clicked button X today' — require a full table scan or a separate aggregation pipeline. If I needed that query pattern, I'd replicate to a columnar store like ClickHouse.

> The tombstone problem is a real concern: if users can delete events, we need a compaction strategy and a TTL policy to prevent tombstone accumulation from degrading read performance. I'd set a 90-day TTL and schedule major compactions during off-peak hours."

You've shown you understand the tool, its trade-offs, and when it breaks.

---

## Anti-Pattern 4: The Over-Engineer

### What it looks like

The interviewer says: "Design a simple blog platform for an internal company blog — about 200 employees, maybe 20 posts per month."

> "OK so I'd put this on Kubernetes with horizontal pod autoscaling, use Kafka for event streaming between services, deploy a separate user service, a post service, a notification service, a search service backed by Elasticsearch, and use a service mesh for observability..."

### Why it fails

The interviewer concludes: **this candidate cannot match solution complexity to problem complexity.** This is a 200-user internal tool. It will never need Kubernetes. Kafka adds operational overhead that requires a dedicated platform team to run reliably. A service mesh for three users and 20 monthly posts is architectural malpractice.

Over-engineering signals one of two things: the candidate is trying to impress by listing technologies, or they genuinely cannot gauge the appropriate level of complexity for a given scale. Neither is good. Senior engineers are valued for knowing what not to build as much as what to build.

### What to say instead

Match the solution to the stated scale, then name the growth trigger:

> "For 200 users and 20 posts/month, this is a solved problem with off-the-shelf tools. I'd start with a single Rails or Django app with a managed Postgres database — something like a $50/month RDS instance. The whole thing fits on one server. No Kubernetes, no Kafka, no microservices.

> Where I'd invest complexity is in correctness, not scale: strong authentication, proper role-based access (author vs. editor vs. reader), and a simple full-text search using Postgres `tsvector` rather than Elasticsearch.

> If we grow to 10k employees across multiple offices, the first bottleneck would be search quality, not scale. That's when I'd introduce Elasticsearch. If we hit 1M page views/day, I'd add a CDN for static assets. I'd scale reactively, not speculatively."

---

## Anti-Pattern 5: The Resume-Driven Designer

### What it looks like

The candidate recently worked on a GraphQL project and a Kubernetes migration.

> Interviewer: "Design a hotel booking API."
>
> Candidate: "I'd use GraphQL for the API layer because it's really flexible for the frontend team. And we'd deploy it on Kubernetes so we can scale individual services independently..."

### Why it fails

The interviewer concludes: **this candidate is designing for their resume, not for the problem.** GraphQL is optimized for aggregating data from multiple sources into flexible frontend queries. A hotel booking API has a small, well-defined set of operations (search, book, cancel, retrieve booking). It doesn't need GraphQL. Kubernetes adds significant operational overhead — secrets management, networking, RBAC, node provisioning — that is only worth it above a certain scale and team size.

When a candidate reaches for the same tools regardless of the problem, it signals they are not reasoning from constraints. They are pattern-matching from past experience without transferring the judgment about when that experience applies.

### What to say instead

Start from the problem constraints, then justify the technology choice:

> "For a hotel booking API, the key characteristics are: transactional operations (booking requires ACID guarantees to prevent double-booking), a well-defined and stable set of operations, and real-time availability checks that need to be fast.

> Given that, I'd use a REST API with clearly named resources — `GET /hotels/:id/availability`, `POST /bookings`, `DELETE /bookings/:id`. REST fits because the operations are predictable and the API contract doesn't need to change with every frontend feature. GraphQL would add flexibility I don't need, plus I'd have to solve the N+1 query problem for availability lookups.

> For deployment, I'd start with a single containerized app on ECS Fargate or a managed service. If we have 50 hotels and 500 bookings/day, Kubernetes adds more operational cost than value. If we scale to 10k hotels across multiple regions with teams owning different services, then Kubernetes starts to make sense."

---

## Anti-Pattern 6: The Numberless Architect

### What it looks like

The candidate is designing a notification system.

> "The system needs to be fast, scalable, and reliable. We want low latency and high throughput. It should handle millions of users."

Not a single number anywhere in the design.

### Why it fails

The interviewer concludes: **this candidate cannot think quantitatively about systems.** "Fast," "scalable," and "reliable" are marketing words, not engineering requirements. Every meaningful system design decision is driven by numbers: how many requests per second, what latency target at what percentile, how much data to store, what durability guarantee (durability is often expressed as 9s — 99.999%).

Without numbers, you cannot make defensible trade-offs. "We need low latency" does not tell you whether to use a CDN, in-memory cache, or just better indexing. "Millions of users" does not tell you whether you need horizontal sharding or whether a read replica solves the problem.

Numbers are also how interviewers know you have real production experience. Engineers who have run systems at scale think in numbers instinctively.

### What to say instead

Anchor every claim to a specific number:

> "Let me put some numbers on this. Assuming 50M users with 10% daily active, that's 5M DAU. If each user receives on average 3 notifications/day, that's 15M deliveries/day — roughly 175 deliveries/second at average load, with peaks probably 5x that around noon UTC, so call it 875/second peak.

> For latency, push notifications have a user expectation of delivery within 5 seconds 95% of the time. Email can be up to 60 seconds. SMS needs to be under 10 seconds.

> For storage: if we keep 90 days of notification history per user, and each record is ~500 bytes, that's 50M users * 90 days * 3 notifications * 500 bytes = ~6.75TB. That fits in a single large Postgres instance but I'd want to think about archival to cold storage after 30 days.

> These numbers drive my architectural choices. At 875 RPS peak, I need a queue to absorb bursts — that's where Kafka earns its place."

---

## Anti-Pattern 7: The Failure-Blind Designer

### What it looks like

The candidate presents a complete design: load balancer, app servers, database, cache.

> Interviewer: "What happens when your database goes down?"
>
> Candidate: "Oh... we'd restart it. Or have a hot standby."
>
> Interviewer: "What happens during the failover window? What does the application do?"
>
> Candidate: "It would... throw an error? I guess we'd show a 500 page."

### Why it fails

The interviewer concludes: **this candidate has not operated a production system.** In production, things fail. Hard drives corrupt. Network partitions happen. Memory leaks slowly degrade services. Databases have replication lag. The mark of an experienced engineer is not that they can design a happy-path system — anyone can do that. It's that they have thought deeply about every failure mode and have an answer for each one.

"The database goes down" is not an edge case. It's a certainty. Over a long enough time horizon, every component will fail. A design that has no answer for database failure is an incomplete design.

### What to say instead

Name failure modes proactively before the interviewer asks:

> "Let me talk through the failure modes I'm concerned about.

> Database failure: I'd run a primary with one synchronous read replica. Failover takes 20-30 seconds with automated tooling like RDS Multi-AZ. During that window, write requests fail with 503. I'd add a write buffer on the app server that retries with exponential backoff — operations that are idempotent (like updating a status) can retry safely. Non-idempotent operations need a client-visible error.

> Cache failure: the app should degrade gracefully to the database if Redis is unavailable. Cache misses should not cause outages — just slower reads. I'd set a circuit breaker with a 5-second timeout.

> App server failure: the load balancer health checks every 10 seconds. An unhealthy node is removed within one health check interval. Because app servers are stateless, this is transparent to clients.

> The failure I'm most worried about is cascading: a slow database causes app servers to hold connections, which exhausts the connection pool, which causes all requests to queue, which causes timeouts. I'd use connection pool limits and a bulkhead pattern to prevent database slowness from taking down the whole service."

---

## Anti-Pattern 8: The CAP Ignorer

### What it looks like

> Interviewer: "Does your distributed system need strong consistency or is eventual consistency acceptable?"
>
> Candidate: "We'll have strong consistency AND high availability. We'll just use a distributed database that handles both."

### Why it fails

The interviewer concludes: **this candidate does not understand the CAP theorem.** The CAP theorem states that during a network partition — which happens in any distributed system — you must choose between consistency (all nodes return the same data) and availability (all nodes respond to requests). You cannot have both simultaneously during a partition.

Systems like Cassandra choose availability over consistency (AP): during a partition, all nodes accept reads and writes, but data may be temporarily inconsistent. Systems like HBase choose consistency over availability (CP): during a partition, some nodes refuse requests to avoid returning stale data.

Saying "we'll have strong consistency AND high availability" without acknowledging partitions demonstrates a fundamental misunderstanding of distributed systems. It tells the interviewer the candidate has not thought carefully about what happens when network links between nodes are unreliable.

### What to say instead

Name the trade-off explicitly and make a justified choice:

> "This is a CAP trade-off. During a network partition, I have to choose between consistency and availability, and the right choice depends on the business operation.

> For financial transactions — debiting a bank account — I'd choose CP (consistency over availability). It's better to show the user an error page than to let two nodes independently approve a transaction and double-spend the balance. I'd use a strongly consistent store like Postgres with synchronous replication.

> For user activity feeds — 'show me recent posts' — I'd choose AP (availability over consistency). It's acceptable for a user to see a post appear in their feed 2-3 seconds after it's written. Eventual consistency is fine here, and I can use Cassandra or DynamoDB with eventual consistency settings to get better availability.

> The key is being deliberate: I'm not ignoring the trade-off, I'm choosing which side of it is acceptable for each operation based on business impact."

---

## Anti-Pattern 9: The Monolith Hater

### What it looks like

> Interviewer: "Design a food delivery platform."
>
> Candidate: "We'd start with microservices. A separate service for users, orders, restaurants, delivery drivers, payments, notifications, and reviews. Each with its own database."

The system has 0 users and has not launched yet.

### Why it fails

The interviewer concludes: **this candidate is following trends, not engineering principles.** Microservices are an organizational and operational pattern for large teams working on large systems. They come with real costs: distributed tracing, network latency between services, distributed transactions, independent deployment pipelines, on-call rotations per service, and the need to manage service discovery and inter-service authentication.

For a startup or a small team, these costs are significant and the benefits are minimal. A monolith can be deployed, debugged, and operated by a team of 3. A microservices architecture with 8 services requires the engineering equivalent of a platform team just to keep the lights on.

The reflex to reach for microservices regardless of team size and scale is a well-known failure mode. It optimizes for the wrong constraints.

### What to say instead

Start with a monolith and name the specific forcing function for decomposition:

> "For an early-stage food delivery platform, I'd start with a well-structured monolith. A single Django or Rails application with clearly separated modules: orders, restaurants, payments, delivery. Each module has its own set of models and API endpoints, but they share a single database and deploy as a unit.

> This gets us to market faster, is operationally simple, and is easy to debug. Two engineers can understand the whole system.

> The forcing functions that would drive me to split out a service are: (1) team size — if payments and orders are owned by separate teams of 5+ engineers who are blocking each other's deployments, that's when I'd separate them; (2) scale mismatch — if the restaurant onboarding service needs to scale independently of the real-time order tracking service, that's a good reason to separate them; (3) data isolation — payments data may have compliance requirements (PCI DSS) that make it worth isolating in its own service with stricter access controls.

> I'd probably still have 2-3 services after 2 years, not 8. Each boundary should be justified by a specific organizational or technical pressure, not by a general preference for microservices."

---

## Anti-Pattern 10: The Single Point of Failure

### What it looks like

The candidate presents a complete architecture:

- Nginx load balancer (single instance) → App servers → Single Postgres primary → Redis (single node)

> "This should handle our load well."

The interviewer asks: "What's the availability of this system?"

> "It's highly available — we have multiple app servers."

### Why it fails

The interviewer concludes: **this candidate has designed a system that will have regular outages and doesn't realize it.** There are three single points of failure in this design: the load balancer, the database, and the Redis node. If any one of them goes down, 100% of requests fail.

Having multiple app servers gives the illusion of redundancy, but redundancy at the app layer is irrelevant if the load balancer is a single instance. This is a classic mistake: the candidate thought about horizontal scaling (app servers) but didn't think about each component's own failure mode.

In a production system at any meaningful scale, a SPOF that causes 100% downtime is unacceptable. The goal is for component failures to be survivable.

### What to say instead

Identify SPOFs proactively and address each one:

> "Let me check for single points of failure in this design.

> Load balancer: running a single Nginx instance means if it goes down, the whole system is down. I'd run two Nginx instances in active-passive with keepalived and a floating IP, or use a cloud load balancer like AWS ALB which is managed and highly available by default.

> Database: the single Postgres primary is a SPOF. I'd add a synchronous read replica. Most cloud providers offer this as a managed feature — RDS Multi-AZ handles automatic failover in 20-30 seconds. During failover, writes are unavailable but reads can continue from the replica.

> Redis: for session state and hot cache, a single Redis node is a SPOF. I'd use Redis Sentinel (3 nodes: 1 primary, 2 replicas) for automatic failover, or Redis Cluster for both redundancy and horizontal scale.

> After these changes, any single component can fail and the system stays up. The remaining risk is correlated failures — if the AWS availability zone fails, all of these go down together. For that I'd need a multi-AZ or multi-region design, but that depends on the availability SLA we've agreed to."

---

## Anti-Pattern 11: The Security Afterthought

### What it looks like

The candidate designs a complete system: API endpoints, database, caching, user data storage.

At the very end, after 40 minutes:

> "Oh, and we'd add authentication. And maybe encrypt the passwords."

### Why it fails

The interviewer concludes: **this candidate adds security as an afterthought, which is how security vulnerabilities happen in production.** Retrofitting security onto a system that wasn't designed with it is significantly harder than designing security in from the start. The infamous LinkedIn password breach (2012), the Equifax breach (2017), and countless others were the result of security being treated as an add-on rather than a design constraint.

Security considerations affect architecture: data at rest encryption changes your storage choices; authentication affects your API design and session management; PII data handling changes your database schema and query patterns; rate limiting affects your load balancer and API gateway configuration.

A candidate who mentions authentication after 40 minutes of design has been thinking about security the whole time but not as a first-class concern.

### What to say instead

Integrate security into the design from the beginning:

> "Before I start drawing, a few security questions: What's the sensitivity of the data we're handling? Are we storing PII like emails, addresses, or payment data? Are there compliance requirements — GDPR, HIPAA, PCI DSS?

> Assuming we have user accounts with PII, here's how I'd design the security layer:

> Authentication: OAuth 2.0 with JWTs for stateless auth. Tokens expire in 15 minutes with refresh tokens stored in httpOnly cookies (not localStorage — prevents XSS theft). Passwords hashed with bcrypt, cost factor 12.

> Authorization: role-based access control enforced at the API layer, not just the frontend. Every endpoint checks permissions before touching the database.

> Data in transit: TLS 1.3 everywhere, including internal service-to-service communication.

> Data at rest: database encryption at rest using cloud KMS (AWS RDS encryption). PII fields like SSN and credit card numbers encrypted at the application layer as well — defense in depth.

> Rate limiting: 100 requests/minute per authenticated user, 20 requests/minute per IP for unauthenticated endpoints, to prevent credential stuffing and scraping.

> Input validation: all user input validated and sanitized before hitting the database — parameterized queries to prevent SQL injection, no dynamic query construction."

Security is woven into every layer, not bolted on at the end.

---

## Anti-Pattern 12: The Perfect Estimator

### What it looks like

> Interviewer: "Design a Twitter timeline service. What's the scale?"
>
> Candidate: "Let me do the math. Twitter has 330 million monthly active users. About 30% are daily active, so 99 million DAU. The average user tweets 0.3 times per day, which is 29.7 million tweets per day. Divided by 86,400 seconds in a day, that's 343.75 tweets per second. At peak that's maybe 3x, so 1,031.25 tweets per second. If each tweet is 280 characters plus metadata, let's say 500 bytes, that's 171,875 bytes per second, or about 167 KB/s of incoming write traffic. Over a year that's 5.26 TB of raw tweet storage. If we add media at an average attachment size of..."

[8 minutes later]

> "...so in conclusion, we need approximately 847.3 TB of storage over 5 years accounting for 15% year-over-year growth."

### Why it fails

The interviewer concludes: **this candidate is using precision as a substitute for insight.** Back-of-envelope estimation is meant to take 2-3 minutes, produce order-of-magnitude numbers, and guide architectural decisions. The purpose is to determine: are we talking about thousands of requests per second or millions? Do we need gigabytes or petabytes? Do we need one database or a hundred?

Spending 8-10 minutes arriving at "847.3 TB" is not useful. The estimate is fake precision anyway — Twitter's actual usage patterns are not public, and the real number might be 400TB or 2PB. What matters is: "we're storing petabytes, so we need distributed object storage, not a single Postgres instance." That conclusion takes 90 seconds to reach.

The time spent on false precision is time not spent on the design itself, which is what the interviewer is there to evaluate.

### What to say instead

Round aggressively, reach the architectural conclusion, and move on:

> "Quick back-of-envelope: 100M DAU, each user sees a timeline once per day, so 100M timeline reads/day — roughly 1,000-2,000 reads/second at peak. Each user follows ~200 people on average, so fanning out a tweet touches 200 timelines — that's fanout writes at scale.

> The key number that drives the architecture is the fanout ratio: 200x write amplification. At 300 tweets/second, that's 60,000 timeline writes/second. That's the hard part of this design — not the tweet storage, which is straightforward.

> I'll spend the rest of the time on the fanout problem since that's where the interesting decisions are."

Order-of-magnitude correct, architecturally actionable, and done in under 2 minutes.

---

## Green Flags: What Strong Candidates Do

After thousands of interviews, certain behaviors reliably correlate with strong candidates. These are the signals that tell an interviewer they are talking to someone with real production experience.

### Green Flag 1: They drive the conversation with questions

A strong candidate immediately starts asking scoping questions that reveal they have designed real systems:

> "Is the read-to-write ratio more like 10:1 or 100:1? That changes the caching strategy significantly."

> "What's the consistency requirement here — is it OK if a user sees a stale version of their profile for 5 seconds, or does it need to be immediately consistent?"

> "Are we designing for global distribution, or is this a single-region system?"

These questions demonstrate experience because they come from having been burned by ambiguity. Engineers who have built the wrong thing because they assumed a requirement know to ask.

### Green Flag 2: They name trade-offs without being asked

Rather than waiting for the interviewer to probe, strong candidates proactively name what they are giving up:

> "I'm choosing to denormalize this data to make reads faster. The trade-off is that writes become more complex — I need to update multiple tables transactionally. That's fine for a read-heavy system, but if the write rate increases significantly, I'd reconsider."

> "I'm using eventual consistency here, which means users might see stale data for up to 2 seconds. For a social feed that's acceptable; for a financial balance it would not be."

Naming trade-offs unprompted demonstrates that the candidate has a mental model of the system's behavior under real conditions, not just the happy path.

### Green Flag 3: They think in terms of operational complexity

Strong candidates consider what it costs to run the system in production, not just whether it will work:

> "Kafka is the right tool for this, but it requires dedicated operational expertise — Zookeeper management, consumer group coordination, partition rebalancing. If the team doesn't have Kafka experience, I'd start with SQS and migrate when we hit its limits."

> "This sharding scheme will work, but resharding when we outgrow it is operationally painful. I'd rather start with consistent hashing so we can add nodes with minimal data movement."

Operational thinking is a marker of engineers who have been on-call.

### Green Flag 4: They self-correct explicitly

Strong candidates notice their own assumptions and call them out:

> "Wait, I said we'd use a relational database, but I haven't checked if our data model fits the relational model. Let me think about this... the relationship here is many-to-many between users and posts with metadata, which means a join table. That's fine for Postgres. OK, relational is correct here."

Self-correction under observation is a signal of intellectual honesty. It tells the interviewer that in a real design review, this person would catch their own mistakes rather than shipping them.

### Green Flag 5: They connect every technical decision to a user-visible outcome

Strong candidates anchor design choices in user experience, not just technical elegance:

> "The reason I want the cache hit rate above 95% is that a cache miss translates to a 200ms latency spike for the user. At our scale, 5% of requests is 50,000 users per day experiencing a slow page load. That's a measurable impact on conversion."

> "I'm adding the write-ahead log for durability because if we lose a database node and haven't persisted the last 5 seconds of writes, we're talking about losing actual user transactions — that's a customer trust problem, not just a technical one."

This demonstrates that the candidate thinks of systems as serving users, not as puzzles to solve.

---

## The Question That Separates Senior from Staff

At the end of a strong design session, a single question separates senior engineers from staff-level thinking:

> "What would you do differently if you had to rebuild this system from scratch in 3 years?"

A senior engineer answers with better tools and technologies:
> "I'd probably use a managed database service instead of self-managing Postgres. I'd use a better observability stack. I'd choose a framework with better async support."

A staff engineer answers with what they learned from operating it:
> "After 3 years of running this, I'd expect to discover that the assumptions I made about the read/write ratio were wrong — real user behavior rarely matches early estimates. I'd design the data model with that uncertainty in mind and make the sharding scheme easier to change.

> I'd also build the observability in from day one, not retrofit it. The first 6 months of debugging production issues always reveals that you're missing the exact metric you need. If I knew what I know now, I'd instrument every async job and every database query from the start.

> The biggest thing I'd change: I'd spend more time on the data deletion and retention story. GDPR right-to-be-forgotten requests become a significant engineering burden if you haven't thought about them in the schema design. That's the kind of constraint that's cheap to address at design time and expensive to bolt on later."

The difference is not technical sophistication — both answers mention valid technical improvements. The difference is perspective. The senior engineer imagines a better-designed system. The staff engineer imagines a system that has already run for 3 years, generated real operational pain, and is now being rebuilt with that hard-won knowledge.

Staff engineers think about systems as things that live in production, not things that exist on whiteboards. They have been surprised enough times by real production behavior that they approach design with epistemic humility: "my assumptions will be wrong, so I'll design for changeability."

When you answer this question in an interview, the goal is to demonstrate that you have a model of the system's future, not just its present. Name the assumptions that are most likely to be wrong. Name the operational pain that will emerge at scale. Name the compliance and data governance concerns that become pressing as the business grows.

That's the answer that gets you to staff.

---

## Summary

The 12 anti-patterns above all have a common root cause: **treating system design as an exercise in demonstrating knowledge rather than solving a problem.** The candidate who skips requirements, names technologies without understanding them, and ignores failures is trying to impress. The candidate who asks questions, names trade-offs, and reasons about failure is trying to solve.

Interviewers at senior and staff levels are specifically evaluating judgment: can this person make good decisions under uncertainty, with incomplete information, in a system that will fail in ways they haven't anticipated? The green flags above are evidence of that judgment. The anti-patterns above are evidence of its absence.

The fastest way to improve in system design interviews is not to study more papers. It is to practice narrating your thinking out loud — the questions you ask, the trade-offs you name, the failures you anticipate — until that process becomes instinctive.

Build systems that fail gracefully. Design for the humans who will operate them at 3am. And always ask what happens when the database goes down.
