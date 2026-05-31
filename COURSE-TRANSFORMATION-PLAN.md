# Course Transformation Plan
## From Library → Guided Learning Journey

**Created**: 2026-03-30
**Status**: Ready for execution
**Estimated total effort**: ~6-8 weeks of focused work (2 hrs/day)

---

## The Core Problem

You have a **library**. Learners need a **guided journey**.

| Current state | Target state |
|---|---|
| 529 articles, learner picks randomly | 12-article fast path, learner follows sequence |
| No signal of completion or progress | Reading time badges, quizzes, checkmarks |
| Re-reading is the only review mechanism | Spaced repetition schedule on cheat sheets |
| No feedback that learning happened | Application-level quizzes per article |
| Text + static diagrams only | Audio narration, Loom walkthroughs |
| No practice problems (2.5% done) | Top 15 FAANG system design problems complete |
| Distributed systems = 0 POCs | "Feel it break" mini-projects, runnable locally |

**The science behind the plan:**
- Retrieval practice (quizzes) → 40-60% better retention at 1 week vs re-reading
- Spaced repetition → 50-100% better retention at 1 month
- Re-reading → near-zero benefit above a single read
- Project-based learning → stronger transfer to novel problems
- Audio re-encoding (after reading) → 10-20% boost
- Video + synchronized diagram → 15-30% better for process concepts

---

## Quiz Design Philosophy (Critical — Read First)

Every quiz must include **both layers**:

### Layer 1 — Surface Recall (1 question)
Ensures the learner absorbed the basic definition. Fast. Not the real test.

### Layer 2 — Deep Application + Cross-Concept (2-3 questions)
This is where learning happens. These questions must:
- Put the learner in a failure scenario ("your system is doing X, what breaks and why?")
- Force connection to a related concept ("how does this interact with Y?")
- Challenge an assumption ("when would you NOT use this?")
- Ask for trade-off reasoning ("your CTO says use A, you want B — make the case")

### The Question Design Test
Before writing a question, ask: *"Can a learner answer this by pattern-matching a sentence from the article?"*
If yes → rewrite it. Surface questions train test-taking, not engineering thinking.

### Example: Bad vs Good Quiz Questions

**Topic: Write-Ahead Logging (WAL)**

❌ Bad (surface):
> What does WAL stand for and what is its purpose?

✅ Good (application):
> Your database crashes 3ms after committing a transaction — after writing to WAL but before flushing dirty pages to disk. What happens when the database restarts? Will the transaction be visible or lost? Walk through the recovery sequence.

❌ Bad (surface):
> Name two benefits of write-ahead logging.

✅ Good (cross-concept):
> A teammate argues: "WAL is basically just a cache for writes — we write to the log first because it's faster than random I/O." Is this framing accurate? What does it miss? How does WAL interact with durability guarantees (the D in ACID)?

❌ Bad (surface):
> What is the difference between physical and logical WAL?

✅ Good (trade-off challenge):
> You're choosing between physical WAL replication (page-level diffs) and logical WAL replication (row-level changes) for a read replica setup. Your read replicas run a different PostgreSQL major version. Which replication mode must you use and why? What do you give up by choosing it?

**Topic: Consistent Hashing**

❌ Bad:
> Explain how consistent hashing works.

✅ Good:
> Your 4-node cache cluster uses consistent hashing. You add a 5th node. With naive modulo hashing, what % of keys would need to be remapped? With consistent hashing (no virtual nodes), approximately what % remaps? Why does this difference matter during a traffic spike?

✅ Good (cross-concept):
> A database shard uses consistent hashing to route requests. One shard receives 3x more traffic than others — a "hot partition." Consistent hashing didn't prevent this. Why not? What additional mechanism would you add?

✅ Good (failure scenario):
> Node 3 in your consistent hash ring dies at 2am. Within 10 minutes, your on-call gets paged about cache miss rate jumping from 5% to 40%. Map the cause-and-effect chain from "node dies" to "40% miss rate." What would you do differently to reduce the blast radius of a single node failure?

---

## Phase 1 — The Course Layer
### (No New Content | Week 1-2 | ~6-8 hours total)

This phase adds the navigational and retention scaffolding on top of what already exists.

---

### 1.1 — Create the "12-Article Fast Path" Page

**File to create**: `docs-site/content/00-start-here/fast-path.md`
**Update**: `docs-site/content/00-start-here/_meta.js` — add entry after `index`

**Purpose**: Convert the site from a catalog into a course. One page that tells every new visitor exactly what to do, in what order, with a declared outcome.

**Editorial framing** (must feel opinionated, not just a list):

```
We have 529 articles. You need 12 to pass a FAANG system design interview.

Here they are, in order. Do not skip. Do not start at article 8 because
it looks interesting. The sequence is deliberate — each article builds
vocabulary the next one requires.

Blocked time: ~6 hours total. One article per day for two weeks.
Outcome: You can walk into any system design interview and handle
the most common 80% of what gets asked.
```

**The 12-article sequence** (derived from top course convergence analysis):

| # | Article | Location | Core concept introduced | Time |
|---|---|---|---|---|
| 1 | Back-of-Envelope Estimation | `00-start-here/back-of-envelope` | How to reason about scale | 15 min |
| 2 | Scaling Basics | `06-scalability/concepts/scaling-basics` | Vertical vs horizontal, when each breaks | 20 min |
| 3 | Load Balancing | `06-scalability/concepts/load-balancing` | L4/L7, round-robin, session affinity | 25 min |
| 4 | Caching Fundamentals | `02-caching/concepts/caching-fundamentals` | Why caches exist, eviction policies | 20 min |
| 5 | Caching Strategies | `02-caching/concepts/caching-strategies` | Write-through/write-back/write-around | 25 min |
| 6 | Database Replication | `01-databases/concepts/replication-basics` | Leader-follower, lag, read replicas | 25 min |
| 7 | Sharding Strategies | `01-databases/concepts/sharding-strategies` | Horizontal partitioning, hot shards | 25 min |
| 8 | Consistent Hashing | `06-scalability/concepts/consistent-hashing-deep-dive` | Why modulo breaks, virtual nodes | 30 min |
| 9 | CAP Theorem | `05-distributed-systems/concepts/cap-theorem` | The consistency/availability trade-off | 25 min |
| 10 | Message Queue Basics | `04-messaging/concepts/message-queue-basics` | Async decoupling, at-least-once | 20 min |
| 11 | Design: URL Shortener | `16-system-design-problems/01-data-processing/url-shortener` | First full design walkthrough | 45 min |
| 12 | Design: Twitter Feed | `16-system-design-problems/02-social-platforms/twitter` | Fan-out patterns, timeline trade-offs | 45 min |

**After the table**, add three role variants:
- **Interview in 1 week**: Do articles 1, 4, 6, 8, 9, 11, 12 only (skip 2,3,5,7,10)
- **Junior engineer, first job**: Do all 12 in order, then continue with Path 1 in `learning-paths.md`
- **Staff/Principal prep**: Do all 12, then go directly to `12-interview-prep/senior-questions/`

---

### 1.2 — Reading Time + Difficulty Badges

**Files to update**: All 12 fast-path articles, then all remaining articles over time

**What to add** to each article's frontmatter:
```yaml
read_minutes: 20
```

**What to add** near the top of each article (below the H1 title):
```
⏱ 20 min read · 🟡 Intermediate · Prerequisites: Caching Fundamentals
```

**Priority order**:
1. The 12 fast-path articles first (this week)
2. All articles in `16-system-design-problems/`
3. All `concepts/` articles in every section
4. POCs last (they already have setup steps that signal time)

---

### 1.3 — Quizzes for Fast-Path Articles (Top Priority)

**Format**: Static MDX component — no backend, no accounts, no auth.
**Placement**: At the bottom of each article, before the References section.
**Component**: Collapsible `<details>` + `<summary>` tags (works in plain MDX, no custom component needed initially).

**Structure per quiz** (4 questions total):
- Q1: Surface recall (1 question — confirms basic absorption)
- Q2: Failure scenario (what breaks and why)
- Q3: Cross-concept connection (how does this interact with concept X)
- Q4: Trade-off challenge (when would you NOT use this, or argue the other side)

**Quiz writing order** (do in this sequence, one per session):

| Priority | Article | Key cross-concept to probe |
|---|---|---|
| 1 | Consistent Hashing | CAP theorem, hot partitions, cache invalidation |
| 2 | CAP Theorem | Eventual consistency, real database choices |
| 3 | Caching Strategies | Write-ahead log, database replication, thundering herd |
| 4 | Database Replication | CAP, consistency models, read lag |
| 5 | Sharding Strategies | Consistent hashing, hot shards, cross-shard queries |
| 6 | Message Queue Basics | At-least-once delivery, idempotency, backpressure |
| 7 | Load Balancing | Sticky sessions, stateless design, health checks |
| 8 | Scaling Basics | Why vertical scaling hits a wall, stateful vs stateless |
| 9 | CAP Theorem → Design: URL Shortener | First application quiz — "apply what you learned" |
| 10 | Design: Twitter Feed | Fan-out write vs read, trade-off reasoning |

**Example quiz block (paste-ready MDX)**:

```mdx
---

## 🧠 Test Your Understanding

*Don't re-read before attempting. The goal is retrieval, not recognition.*

<details>
<summary>Q1 — Surface Check: What is the core problem that consistent hashing solves over naive modulo hashing?</summary>

**Answer**: When you add or remove a node in naive modulo hashing, nearly all keys remap to different nodes (typically (N-1)/N ≈ 75% for 4→5 nodes). Consistent hashing limits remapping to ~1/N of keys per node change — only the keys between the removed node and its predecessor on the ring need to move.

</details>

<details>
<summary>Q2 — Failure Scenario: Node 3 in your 4-node consistent hash ring fails at 2am. Cache miss rate jumps from 5% to 40% within 10 minutes. Trace the full cause-and-effect chain.</summary>

**Answer**: Node 3 fails → All keys that were mapped to Node 3 now route to Node 4 (its successor on the ring) → Node 4 has no cached values for those keys (cold cache) → Every request for those keys misses cache and hits the database → Database load spikes → If the database slows under load, more requests pile up, potentially cascading.

The 40% miss rate comes from Node 3 holding ~25% of keys (uniform distribution on 4 nodes), and those keys being cold on Node 4. **What reduces blast radius**: virtual nodes (so each physical node holds many small arcs, not one large one), and pre-warming the successor node on failure.

</details>

<details>
<summary>Q3 — Cross-Concept: Consistent hashing solves the rebalancing problem. But your cache cluster still has one node getting 3x more traffic than others. Why doesn't consistent hashing prevent hot partitions?</summary>

**Answer**: Consistent hashing distributes *keys* uniformly — but not *request frequency*. If 10% of keys are accessed 90% of the time (Zipf distribution — true of most real workloads), the node holding those hot keys gets disproportionate traffic regardless of how keys are distributed on the ring.

**Connection to CAP**: A hot node that becomes overloaded starts returning errors or slow responses. You now face an availability problem caused by a load problem — consistent hashing alone can't save you. **Fix**: virtual nodes + consistent hashing ensures even key distribution; a separate **local cache** (e.g., in-process LRU) at the application layer absorbs hot key traffic before it reaches the distributed cache.

</details>

<details>
<summary>Q4 — Trade-off Challenge: Your CTO says "just use consistent hashing everywhere — routing tables, databases, caches." Name one scenario where consistent hashing is the wrong tool.</summary>

**Answer** (multiple valid answers):

- **Range queries on databases**: Consistent hashing distributes by hash value, which destroys sort order. A query like `WHERE created_at BETWEEN X AND Y` would require scanning all nodes. Range-based sharding (where shard 1 = Jan–Mar, shard 2 = Apr–Jun) is better for time-series or ordered data.
- **Small cluster sizes**: With 2-3 nodes, consistent hashing's overhead (virtual node management, ring maintenance) isn't worth it — simple round-robin or modulo is operationally simpler with acceptable rebalancing cost.
- **Write-heavy workloads needing strong consistency**: Consistent hashing is designed for stateless or eventually-consistent workloads. If you need linearizable writes across shards, you need a consensus protocol (Raft, Paxos) — consistent hashing doesn't address this.

</details>
```

---

### 1.4 — Spaced Repetition Callouts on Cheat Sheets

**Files to update**: All 10 cheat sheets in `docs-site/content/cheat-sheets/`

**What to add** at the top of each cheat sheet, below the H1:

```markdown
> **How to use this sheet**: Read it today after completing the related articles.
> Return on **Day 3** (quick scan, 2 min). Return on **Day 10** (cover the sheet,
> recall each entry, then check). Return on **Day 30** (final consolidation —
> if you can recall 80% without looking, you own this topic).
>
> Re-reading the full article is low-yield. Quiz yourself from this sheet instead.
```

**Update all 10 sheets**:
- `cheat-sheets/databases.md`
- `cheat-sheets/caching.md`
- `cheat-sheets/messaging.md`
- `cheat-sheets/system-design.md`
- `cheat-sheets/networking.md`
- `cheat-sheets/security.md`
- `cheat-sheets/aws.md`
- `cheat-sheets/ai-agents.md`
- `cheat-sheets/mobile.md`
- `cheat-sheets/index.md` — add "How spaced repetition works" section

---

## Phase 2 — Multi-Modal Layer
### (Low Cost, High Impact | Week 3-4 | ~8-10 hours total)

---

### 2.1 — Audio Narration via NotebookLM

**Tool**: Google NotebookLM (free) → Audio Overview feature
**Format**: Two-host podcast-style dialogue auto-generated from article text
**Output**: MP3 file embedded at the top of each article

**Workflow per article** (30 min each):
1. Open NotebookLM → New notebook
2. Upload the article `.md` file
3. Click "Generate Audio Overview"
4. Download MP3
5. Upload to a static host (GitHub Releases, Cloudflare R2 free tier, or even a public GitHub repo `/audio/` folder)
6. Embed at top of article:
```html
<audio controls>
  <source src="/system-design/audio/consistent-hashing.mp3" type="audio/mpeg" />
</audio>
*🎧 5-min audio summary — listen on commute, then read for depth.*
```

**Article priority for audio** (concept-heavy, diagram is illustrative not load-bearing):

| Priority | Article | Why audio works here |
|---|---|---|
| 1 | CAP Theorem | Pure conceptual, no code dependency |
| 2 | Consistent Hashing (concept) | Analogy-heavy, good for verbal explanation |
| 3 | Eventual Consistency | Abstract, benefits from conversational framing |
| 4 | Event Sourcing | Conceptual shift, narrative explanation helps |
| 5 | CQRS | Architecture pattern, not code-dependent |
| 6 | Write-Ahead Logging | Core concept, "why it matters" story |
| 7 | Leader-Follower Replication | Good for narrative: "what happens when leader dies" |

**Do NOT use audio for**: POC walkthroughs, step-by-step setup guides, articles where the Mermaid diagram is the primary explanation.

---

### 2.2 — Loom Diagram Walkthroughs

**Tool**: Loom (free tier, up to 5 min per video)
**Format**: Screen recording of Mermaid diagram in browser, mouse pointing while narrating
**Time cost**: 20-30 min per video (no editing)

**Workflow**:
1. Open the article in browser, zoom in on the Mermaid diagram
2. Start Loom recording (screen only, no camera needed)
3. Narrate while moving mouse: "Data comes in here → goes to the load balancer → the load balancer uses consistent hashing to decide which cache node → here's what happens if that node is down..."
4. Stop recording, copy embed URL
5. Add to article above the diagram:
```markdown
> 📹 [3-min walkthrough: watch this diagram explained](https://loom.com/share/xxx)
> *Watch first if diagrams feel abstract. Read the article for full depth.*
```

**Priority diagrams** (7 walkthroughs, do in this order):

| # | Diagram | Article | Key story to narrate |
|---|---|---|---|
| 1 | Consistent hash ring | `06-scalability/concepts/consistent-hashing-deep-dive` | Walk the ring, add a node, show key migration |
| 2 | Leader-follower replication | `01-databases/concepts/replication-basics` | What happens when leader dies at T+0, T+5, T+30 |
| 3 | Cache write strategies | `02-caching/concepts/caching-strategies` | Trace a write through each of 3 strategies |
| 4 | Message queue fan-out | `04-messaging/concepts/message-queue-basics` | One producer → many consumers, what happens if one consumer is slow |
| 5 | CAP theorem decision tree | `05-distributed-systems/concepts/cap-theorem` | "Your network partitions. You have 3 seconds to decide: serve stale data or return an error. Which do you choose?" |
| 6 | Sharding decision | `01-databases/concepts/sharding-strategies` | Walk through range vs hash sharding, show the hot-shard problem |
| 7 | Twitter fan-out | `16-system-design-problems/02-social-platforms/twitter` | Trace a tweet from post to timeline, fan-out-on-write vs fan-out-on-read |

---

### 2.3 — Weekly Email Newsletter

**Tool**: Substack (free, no subscriber limit on free tier)
**Frequency**: Every Monday
**Target**: 50+ subscribers = enough social pressure to create return visits

**Email structure** (keep to ~400 words, 3 min read):

```
Subject: [System Design Weekly #N] — [Topic]

🏗️ This week's concept: [Article title]
[2-sentence summary of what it is and why it matters]
→ [Link to full article]

🔥 The failure: [Short story about what breaks in production]
[3-4 sentences describing a real incident or failure mode]

🧠 The challenge: [One deep question]
Reply with your answer. I'll share the best responses next week.

📅 Spaced repetition nudge:
If you read [last week's topic] — now's the time to test yourself
without looking. What are the trade-offs of [concept]?
[Link to cheat sheet]
```

**First 12 weeks** = follow the 12-article fast path sequence (one article per week).
**Starting challenge question examples** (deep, cross-concept):

- Week 1 (Scaling Basics): *"Your startup is at 50k users. Your CTO says 'add more servers.' Your database engineer says 'add an index.' Who's right? Under what conditions does each answer make sense?"*
- Week 2 (Load Balancing): *"Sticky sessions keep a user's requests going to the same server. This sounds convenient. Name two specific scenarios where sticky sessions become a liability."*
- Week 3 (Caching): *"Your cache hit rate is 95% and your app is fast. A teammate celebrates. You're worried. Why?"*
- Week 4 (Replication): *"Your primary database dies. You fail over to the replica. 3 minutes later, a user calls support: 'I just paid but my order doesn't exist.' Explain exactly what happened."*

---

## Phase 3 — The Practical Layer
### (New Content | Month 2 | ~20-30 hours total)

---

### 3.1 — "Feel It Break" Mini-Projects for Distributed Systems

**Target section**: `05-distributed-systems/hands-on/` (currently has 0 POCs)
**Format**: Each project must be:
- Completable in 1-4 hours
- Runnable with `node index.js` or `python main.py` (no Docker required for the core)
- Built so the naive first version **visibly fails** before the fix is applied
- Clearly connected to a concept article (linked in frontmatter)

**4 projects to build** (in this order):

#### Project 1: Consistent Hashing Ring
**File**: `05-distributed-systems/hands-on/consistent-hashing-impl.md`
**What breaks**: Run naive modulo hashing. Add a node. Print how many keys remapped. Then implement consistent hashing. Add the same node. Print keys remapped. See the difference.
**The moment of understanding**: Watching 75% of keys remap vs ~25% is more memorable than any diagram.
**Language**: Python (50-80 lines, no dependencies)

#### Project 2: Leader Election — Bully Algorithm
**File**: `05-distributed-systems/hands-on/leader-election-bully.md`
**What breaks**: Start 3 simulated processes. Kill the leader (process 3). Watch election happen. Now simulate a network partition where process 1 and process 2 both think they're leader. Print what "split-brain" looks like in output logs.
**The moment of understanding**: Two leaders simultaneously accepting writes = data divergence. Seeing the conflict in terminal output is visceral.
**Language**: Python with threading or Node.js with process simulation (100-150 lines)

#### Project 3: Vector Clocks + Conflict Detection
**File**: `05-distributed-systems/hands-on/vector-clocks-conflict.md`
**What breaks**: Two nodes exchange events concurrently without coordination. Compare their vector clocks. Print "CONFLICT DETECTED" when neither clock dominates. Show that last-write-wins resolves the conflict but loses data.
**The moment of understanding**: "Conflict detected" printed in your terminal makes CAP theorem feel real, not theoretical.
**Language**: Python (80-100 lines)

#### Project 4: Rate Limiter — Token Bucket vs Sliding Window
**File**: `05-distributed-systems/hands-on/rate-limiter-comparison.md`
**What breaks**: Implement token bucket. Send 100 requests in a burst at the edge of a time window. Then implement sliding window. Send the same burst. Print which requests are allowed vs rejected in each. The behavior at window edges differs visibly.
**The moment of understanding**: Token bucket allows a burst of 2x rate at window boundary. Sliding window prevents it. Seeing exact timestamps of allowed/rejected requests makes the trade-off concrete.
**Language**: Python (100-120 lines)

---

### 3.2 — Complete Top 15 System Design Problems

**Target section**: `16-system-design-problems/` (currently 4/163 complete)
**Priority**: These 15 cover ~85% of FAANG system design interview frequency
**Template**: Follow `url-shortener.md` as the gold standard (1000-1240 lines, multi-level diagrams, scale analysis, pseudo-code, interview mapping)

**Execution order** (by interview frequency, highest first):

| # | Problem | Category | Concepts introduced | Est. effort |
|---|---|---|---|---|
| 1 | Design Twitter (partial) | Social | Fan-out, timeline, NoSQL | Already done — polish |
| 2 | Design Netflix / Video Streaming | Data Processing | CDN, chunked upload, transcoding | 5-6 hrs |
| 3 | Design WhatsApp / Chat System | Communication | WebSocket, message ordering, presence | 5-6 hrs |
| 4 | Design Google Drive / File Storage | Storage | Chunking, dedup, sync conflict | 4-5 hrs |
| 5 | Design Uber / Ride-Sharing | Infrastructure | Geo-indexing, real-time matching | 5-6 hrs |
| 6 | Design Instagram / Photo Feed | Social | CDN, feed ranking, object storage | 4-5 hrs |
| 7 | Design Notification System | Infrastructure | Push/SMS/email, fan-out, priority | 3-4 hrs |
| 8 | Design Google Search Autocomplete | Search | Trie, prefix matching, ranking | 4-5 hrs |
| 9 | Design Airbnb / Booking System | Reservation | Double booking prevention, distributed lock | 4-5 hrs |
| 10 | Design Slack / Team Messaging | Communication | Channels, search, message threading | 4-5 hrs |
| 11 | Design Payment System | Infrastructure | Idempotency, distributed transactions, reconciliation | 5-6 hrs |
| 12 | Design TikTok / Short Video | Data Processing | Recommendation, viral distribution, storage | 5-6 hrs |
| 13 | Design Web Crawler | Search | BFS/DFS, dedup, politeness policy | 3-4 hrs |
| 14 | Design Google Maps | Search/Geo | Tile system, routing, real-time traffic | 5-6 hrs |
| 15 | Design Distributed Job Scheduler | Infrastructure | At-least-once execution, dedup, priority queue | 4-5 hrs |

**Writing checklist for each problem** (before marking done):
- [ ] Level 1 (2-min read): One-line description, trigger (at what scale), 5-bullet core design
- [ ] One high-level Mermaid diagram (happy path, 6-8 nodes)
- [ ] Level 2: Scale analysis — what breaks at 10K / 100K / 1M req/s
- [ ] 2-3 named architecture approaches with trade-off table
- [ ] At least 3 common mistakes with root cause
- [ ] Interview framing section ("here's how to present this in 45 minutes")
- [ ] Frontmatter: `related_problems`, `see_poc`, `prerequisites`

---

### 3.3 — Narrative Entry Point Page

**File to create**: `docs-site/content/00-start-here/your-story.md`
**Update**: `_meta.js` — add as the very first entry (before `index`)

**Purpose**: Every learner needs to answer "what story am I in?" before they can engage. This page creates the narrative frame.

**Content**:

```markdown
# Your Story

You're a backend engineer. Your startup just crossed 100k users.
Congratulations — and here's the problem: your single Postgres instance
is now at 90% CPU. Your CTO is in a Slack thread. Your users are seeing
timeouts. You have 48 hours.

Do you know what to do?

This course is the answer to that question — and every question at 10x
that scale. It's also the same knowledge that gets engineers hired at
the companies that already solved these problems.

**What you'll be able to do:**
- Walk into any system design interview and handle 80% of what gets asked
- Make architectural trade-off decisions you can defend with numbers, not instinct
- Debug production failures and know which layer broke and why
- Design systems for 10x your current scale before you need to

**How this is different from other resources:**
- Every concept comes with a failure scenario — what breaks, at what scale, and why
- Every major concept has a quiz that challenges your reasoning, not your memory
- The 100+ articles exist for depth — but you don't need them all. Start with 12.

**→ [Start the 12-article fast path](./fast-path)**
```

---

## Phase 4 — Retention Infrastructure
### (Month 3 | Optional but high-leverage)

---

### 4.1 — Progress Tracker (localStorage, No Backend)

**What**: A JavaScript snippet on the fast-path page that marks articles as "read" using `localStorage`.
**Visual**: Checkmarks next to each article in the 12-article list.
**No accounts, no server, no auth.** Works offline.

Only build this after Phase 1-3 are complete and there's evidence that users are actually following the path (check analytics first).

---

### 4.2 — Discord (Only After Email Hits 100 Subscribers)

Do NOT launch Discord before the email list has 100+ active subscribers.
A Discord with 5 members is worse than no Discord — it signals abandonment.

**When you launch**: Use a bot to post weekly challenges. Award visible roles:
- "Databases Unlocked" (complete DB section quizzes)
- "Caching Master" (complete caching section)
- "System Design Ready" (complete all 12 fast-path articles + quizzes)

---

### 4.3 — Animated Video for Top 3 Concepts

Only after Loom walkthroughs are live and you've identified which 3 get the most views.
**Tool recommendation**: Remotion (React-based) for animated diagram walkthroughs.
**Target**: Consistent hashing, CAP theorem, write-ahead logging.
**Format**: 4-6 min each. Problem-first narrative. Diagram builds progressively.

---

## Execution Checklist (Single Source of Truth)

```
PHASE 1 — COURSE LAYER (Week 1-2)
  [ ] 1.1 Create fast-path.md with 12-article sequence + editorial framing
  [ ] 1.1 Update 00-start-here/_meta.js (add fast-path)
  [ ] 1.2 Add ⏱ reading time badges to 12 fast-path articles
  [ ] 1.3 Write quiz for consistent-hashing article (4 questions, all layers)
  [ ] 1.3 Write quiz for CAP theorem article
  [ ] 1.3 Write quiz for caching-strategies article
  [ ] 1.3 Write quiz for replication-basics article
  [ ] 1.3 Write quiz for sharding-strategies article
  [ ] 1.3 Write quiz for message-queue-basics article
  [ ] 1.3 Write quiz for load-balancing article
  [ ] 1.3 Write quiz for scaling-basics article
  [ ] 1.3 Write quiz for url-shortener design
  [ ] 1.3 Write quiz for twitter design
  [ ] 1.4 Add spaced repetition callout to all 10 cheat sheets

PHASE 2 — MULTI-MODAL (Week 3-4)
  [ ] 2.1 Generate + embed audio for CAP theorem
  [ ] 2.1 Generate + embed audio for consistent hashing
  [ ] 2.1 Generate + embed audio for eventual consistency
  [ ] 2.1 Generate + embed audio for event sourcing
  [ ] 2.1 Generate + embed audio for write-ahead logging
  [ ] 2.2 Record Loom walkthrough: consistent hash ring diagram
  [ ] 2.2 Record Loom walkthrough: leader-follower replication diagram
  [ ] 2.2 Record Loom walkthrough: cache write strategies
  [ ] 2.2 Record Loom walkthrough: message queue fan-out
  [ ] 2.2 Record Loom walkthrough: CAP theorem decision tree
  [ ] 2.2 Record Loom walkthrough: sharding decision
  [ ] 2.2 Record Loom walkthrough: twitter fan-out
  [ ] 2.3 Set up Substack newsletter
  [ ] 2.3 Write and send Week 1 email (Scaling Basics)

PHASE 3 — PRACTICAL LAYER (Month 2)
  [ ] 3.1 Write consistent-hashing-impl.md (Python, "feel it break")
  [ ] 3.1 Write leader-election-bully.md (Python)
  [ ] 3.1 Write vector-clocks-conflict.md (Python)
  [ ] 3.1 Write rate-limiter-comparison.md (Python)
  [ ] 3.2 Write Netflix/video streaming design
  [ ] 3.2 Write WhatsApp/chat system design
  [ ] 3.2 Write Google Drive design
  [ ] 3.2 Write Uber design
  [ ] 3.2 Write Instagram design
  [ ] 3.2 Write Notification system design
  [ ] 3.2 Write Search autocomplete design
  [ ] 3.2 Write Airbnb design
  [ ] 3.2 Write Slack design
  [ ] 3.2 Write Payment system design
  [ ] 3.2 Write TikTok design
  [ ] 3.2 Write Web crawler design
  [ ] 3.2 Write Google Maps design
  [ ] 3.2 Write Distributed job scheduler design
  [ ] 3.3 Create your-story.md (narrative entry point)
  [ ] 3.3 Update 00-start-here/_meta.js (add your-story as first entry)

PHASE 4 — RETENTION INFRA (Month 3, if traffic warrants)
  [ ] 4.1 Add localStorage progress tracker to fast-path page
  [ ] 4.2 Launch Discord (only after 100 email subscribers)
  [ ] 4.3 Record animated video: consistent hashing (Remotion)
  [ ] 4.3 Record animated video: CAP theorem
  [ ] 4.3 Record animated video: write-ahead logging
```

---

## What NOT to Do

| Temptation | Why to skip it |
|---|---|
| Write more concept articles | 529 exists. Course layer gap is more urgent. |
| Full video production (After Effects) | 8-15 hrs/video. Loom first, polish winners later. |
| Discord before email list | Ghost town = negative social proof |
| User accounts + auth | Overkill until fast path has proven engagement |
| Remotion/Manim animations now | High skill ceiling. Loom walkthroughs cover 80% of the value. |
| Complete all 163 system design problems | Top 15 cover 85% of interview frequency. Ship those first. |

---

## Definition of Done

The course transformation is complete when a new visitor can:

1. Land on the site and immediately know what to do (`your-story.md` → `fast-path.md`)
2. Follow a numbered sequence of 12 articles with clear time estimates
3. Test their understanding after each article with application-level questions
4. Listen to a 5-min audio summary of key concept articles on their commute
5. Watch a 3-min diagram walkthrough when a static diagram doesn't click
6. Know when to review (spaced repetition callout on cheat sheets)
7. Build something small that makes distributed systems concepts visceral
8. Practice full system designs on 15 FAANG-frequency problems

When all of this is true, you have a course — not a library.
