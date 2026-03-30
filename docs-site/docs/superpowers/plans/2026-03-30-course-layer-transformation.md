# Course Layer Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing 529-article library into a guided learning journey by adding the course layer that turns content discovery into a structured experience with a clear start, finish, and feedback loops.

**Architecture:** Two-wave parallel agent execution. Wave 1 dispatches 6 independent agents into isolated git worktrees — each agent touches non-overlapping files. Wave 2 runs a single quiz agent after Wave 1 merges, since quizzes reference the fast-path article selection finalized in Wave 1. Agent G (interview integration) runs in Wave 1 because it touches only question bank files which no other Wave 1 agent touches.

**Tech Stack:** Nextra 4 App Router, MDX/Markdown, frontmatter YAML, git worktrees, parallel Claude Code agents

---

## Coordinator Overview

You are the coordinator. You dispatch agents, review their PRs, and merge in order. You do not write content yourself.

### Wave 1 — Dispatch All 6 Agents in Parallel

```
Agent A → worktree: agent-editorial      → Fast Path + Your Story pages
Agent B → worktree: agent-badges         → Reading time + difficulty on 12 articles
Agent C → worktree: agent-spaced-rep     → Spaced repetition callouts on 10 cheat sheets
Agent D → worktree: agent-dist-pocs      → 4 distributed systems POC articles
Agent E → worktree: agent-sd-problems    → 5 system design problem articles
Agent G → worktree: agent-interview-sync → Cross-conceptual questions + Concept References in question bank
```

### Merge Order After Wave 1

Merge in this sequence to avoid conflicts (each touches different files):
1. Agent C (cheat-sheets only)
2. Agent B (frontmatter only)
3. Agent G (question bank files only)
4. Agent D (new files only)
5. Agent E (new files only)
6. Agent A (new files + one _meta.js)

### Wave 2 — After All Wave 1 Merges

```
Agent F → worktree: agent-quizzes        → 3-question quiz sections on 5 fast-path articles
```

---

## WAVE 1

---

## Agent A: Editorial Entry Points

**Worktree:** `agent-editorial`
**Creates:** 2 new pages + 1 _meta.js update
**Touches zero existing content files — safe to merge last**

### Files:
- Create: `docs-site/content/00-start-here/fast-path.md`
- Create: `docs-site/content/00-start-here/your-story.md`
- Modify: `docs-site/content/00-start-here/_meta.js`

---

### Task A-1: Create the Fast Path Page

- [ ] **Step 1: Create `docs-site/content/00-start-here/fast-path.md`**

  The page is an opinionated, editorially-curated numbered sequence with a declared outcome. It must not be a table of contents or a list of links — it is a study plan with framing copy that tells the learner exactly what they are committing to.

  **Frontmatter:**
  ```yaml
  ---
  title: "⚡ The 12-Article Fast Path"
  description: "The 80% of system design knowledge that covers 85% of interview questions. Do these 12 articles in order."
  layer: index
  section: "00-start-here"
  ---
  ```

  **Page structure (write in this exact order):**

  1. **Opening block** (3-4 sentences): Address the reader directly. "You have 529 articles in front of you. Don't read them all. These 12 cover 85% of what gets asked in system design interviews at Google, Meta, Amazon, and Stripe. Block 6 hours. Do them in sequence. Don't skip to Article 8."

  2. **Commitment callout box** (MDX callout):
     ```mdx
     > **Your commitment:** 6 hours total · 12 articles · 3 case studies · One defined finish line
     ```

  3. **The 12-article sequence** — numbered list, each item has:
     - Article number + title (as a link to the actual article)
     - One sentence saying *why this article, in this position*
     - Estimated read time badge: `⏱ ~N min`
     - Difficulty badge: `🟢 Beginner` / `🟡 Intermediate` / `🔴 Advanced`

  **The 12 articles in exact order (use these paths):**

  | # | Title | Link | Why here | Time | Level |
  |---|-------|------|----------|------|-------|
  | 1 | Back-of-Envelope Estimation | `/system-design/00-start-here/back-of-envelope` | Every interview starts with sizing. Learn the vocabulary first. | 15 min | 🟢 |
  | 2 | Scaling Basics | `/system-design/06-scalability/concepts/scaling-basics` | Horizontal vs vertical is the first fork in every design. | 12 min | 🟢 |
  | 3 | Caching Fundamentals | `/system-design/02-caching/concepts/caching-fundamentals` | Caching is mentioned in 90% of interviews. Know write-through vs write-back cold. | 18 min | 🟡 |
  | 4 | Database Read Scaling | `/system-design/06-scalability/concepts/database-read-scaling` | Read replicas and sharding are the most asked database topics. | 20 min | 🟡 |
  | 5 | Sharding Strategies | `/system-design/01-databases/concepts/sharding-strategies` | Goes deeper on how you actually split data without hotspots. | 22 min | 🟡 |
  | 6 | Consistent Hashing (Deep Dive) | `/system-design/06-scalability/concepts/consistent-hashing-deep-dive` | Load balancing and partitioning both require this. Essential mental model. | 20 min | 🟡 |
  | 7 | CAP Theorem (Practical) | `/system-design/05-distributed-systems/concepts/cap-theorem-practical` | Every "should we use SQL or NoSQL?" question is a CAP question in disguise. | 15 min | 🟡 |
  | 8 | Message Queue Basics | `/system-design/04-messaging/concepts/message-queue-basics` | Async decoupling appears in 70% of system design problems. | 18 min | 🟡 |
  | 9 | Rate Limiting | `/system-design/07-api-design/concepts/rate-limiting` | Asked directly (design a rate limiter) and as a component in larger designs. | 20 min | 🔴 |
  | 10 | High Availability | `/system-design/06-scalability/concepts/high-availability` | SLAs, failover, and redundancy — the language of production systems. | 15 min | 🟡 |
  | 11 | Design URL Shortener | `/system-design/16-system-design-problems/01-data-processing/url-shortener` | Case study 1: simple but reveals all the fundamentals under pressure. | 35 min | 🟡 |
  | 12 | Design Twitter Feed | `/system-design/16-system-design-problems/02-social-platforms/twitter` | Case study 2: the fan-out problem at scale — highest complexity in interviews. | 45 min | 🔴 |

  4. **After you finish** section:
     - Link to `learning-paths.md` for role-specific deeper tracks
     - Link to `12-interview-prep/question-bank/` for practice questions
     - One sentence: "You are now prepared to attempt any senior-level system design interview."

  5. **What this path does NOT cover** (3 bullets, honest scoping):
     - Deep distributed consensus (Raft, Paxos) — needed for Staff/Principal roles
     - ML/AI system design — see Agent Workflows section
     - Security architecture deep dives — see Security section

- [ ] **Step 2: Verify the file renders (visual check)**

  Open `docs-site/content/00-start-here/fast-path.md` and confirm:
  - All 12 links follow the `/system-design/<path>` pattern (basePath is already applied by Nextra)
  - No broken relative paths
  - Frontmatter is valid YAML

- [ ] **Step 3: Commit**
  ```bash
  git add docs-site/content/00-start-here/fast-path.md
  git commit -m "feat(editorial): add 12-article fast path page"
  ```

---

### Task A-2: Create the Your Story Entry Point

- [ ] **Step 1: Create `docs-site/content/00-start-here/your-story.md`**

  This page answers "what story am I in?" before the learner can engage. It is narrative prose, not a list. 3-4 paragraphs max.

  **Frontmatter:**
  ```yaml
  ---
  title: "Your Story"
  description: "Why you're here, what problem this solves, and what you'll be able to do when you leave."
  layer: index
  section: "00-start-here"
  ---
  ```

  **Page structure:**

  Para 1 — The failure scenario (visceral, specific):
  > "It's 2 AM. Your startup just got featured on TechCrunch. Traffic is 50x normal. Your database is falling over. You have no idea why your read replicas aren't helping. You've never designed a system at this scale before — and everything you need to know is scattered across 47 blog posts you haven't bookmarked."

  Para 2 — The gap this course fills:
  > "This knowledge base exists for that moment. Not to make you feel smart in a classroom — to give you the mental models that let you make the right call at 2 AM. Every article answers a real failure. Every diagram shows a system that actually broke in production. Every number is a real threshold from a real post-mortem."

  Para 3 — The interview connection (honest framing):
  > "There's a second story here too. System design interviews are hard not because the questions are tricky, but because they're open-ended. There's no right answer — just better and worse trade-off decisions. The engineers who do well are the ones who have *seen* enough systems to know which trade-offs actually matter. That's what this teaches."

  Para 4 — The call to action with two paths:
  > "Two ways to start:"
  > - "**Interview in 6 weeks or less?** → [Take the Fast Path](/system-design/00-start-here/fast-path) — 12 articles, 6 hours, one defined finish line."
  > - "**Building something at scale right now?** → [Choose your role track](/system-design/00-start-here/learning-paths) — curated path based on what you're actually solving."

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/00-start-here/your-story.md
  git commit -m "feat(editorial): add narrative entry point (your-story page)"
  ```

---

### Task A-3: Update Navigation Meta

- [ ] **Step 1: Read the current `docs-site/content/00-start-here/_meta.js`**

  Current content:
  ```js
  export default {
    index: "🚀 Start Here",
    "learning-paths": "Learning Paths",
    "back-of-envelope": "Back-of-Envelope Estimation"
  }
  ```

- [ ] **Step 2: Update to add the two new pages in correct position**

  New content — `your-story` first (narrative hook), `fast-path` second (the path):
  ```js
  export default {
    index: "🚀 Start Here",
    "your-story": "📖 Your Story",
    "fast-path": "⚡ Fast Path (12 Articles)",
    "learning-paths": "Learning Paths",
    "back-of-envelope": "Back-of-Envelope Estimation"
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add docs-site/content/00-start-here/_meta.js
  git commit -m "feat(nav): add your-story and fast-path to start-here nav"
  ```

---

## Agent B: Reading Time & Difficulty Badges

**Worktree:** `agent-badges`
**Modifies:** Frontmatter of exactly 12 articles — the fast-path articles
**Does NOT change article body content**
**Does NOT touch any _meta.js files**

### Files Modified (frontmatter only):
1. `docs-site/content/00-start-here/back-of-envelope.md`
2. `docs-site/content/06-scalability/concepts/scaling-basics.md`
3. `docs-site/content/02-caching/concepts/caching-fundamentals.md`
4. `docs-site/content/06-scalability/concepts/database-read-scaling.md`
5. `docs-site/content/01-databases/concepts/sharding-strategies.md`
6. `docs-site/content/06-scalability/concepts/consistent-hashing-deep-dive.md`
7. `docs-site/content/05-distributed-systems/concepts/cap-theorem-practical.md`
8. `docs-site/content/04-messaging/concepts/message-queue-basics.md`
9. `docs-site/content/07-api-design/concepts/rate-limiting.md`
10. `docs-site/content/06-scalability/concepts/high-availability.md`
11. `docs-site/content/16-system-design-problems/01-data-processing/url-shortener.md`
12. `docs-site/content/16-system-design-problems/02-social-platforms/twitter.md`

---

### Task B-1: Add readTime and fastPath to All 12 Articles

**For each article, the process is identical:**

- [ ] **Step 1: Read the file and count words**

  Run: `wc -w <file_path>` to get word count.
  Calculate read time: `ceil(word_count / 200)` minutes (average technical reading speed is 200 wpm).

- [ ] **Step 2: Add two fields to frontmatter**

  Locate the existing frontmatter block (between `---` markers). Add these two lines **after the existing `difficulty` field**:
  ```yaml
  readTime: "<N> min"
  fastPath: true
  ```

  The `difficulty` field already exists in most articles. If missing, add it with the correct value from this table:

  | Article | readTime | difficulty (if missing) |
  |---------|----------|------------------------|
  | back-of-envelope.md | 15 min | beginner |
  | scaling-basics.md | 12 min | beginner |
  | caching-fundamentals.md | 18 min | intermediate |
  | database-read-scaling.md | 20 min | intermediate |
  | sharding-strategies.md | 22 min | intermediate |
  | consistent-hashing-deep-dive.md | 20 min | intermediate |
  | cap-theorem-practical.md | 15 min | intermediate |
  | message-queue-basics.md | 18 min | intermediate |
  | rate-limiting.md | 20 min | advanced |
  | high-availability.md | 15 min | intermediate |
  | url-shortener.md | 35 min | intermediate |
  | twitter.md | 45 min | advanced |

  > **Note:** If the actual word count produces a time more than 5 min different from the table above, use the actual calculation. The table is a best-estimate baseline.

- [ ] **Step 3: Commit after every 4 articles (3 commits total)**

  Commit 1 (articles 1-4):
  ```bash
  git add docs-site/content/00-start-here/back-of-envelope.md \
    docs-site/content/06-scalability/concepts/scaling-basics.md \
    docs-site/content/02-caching/concepts/caching-fundamentals.md \
    docs-site/content/06-scalability/concepts/database-read-scaling.md
  git commit -m "feat(badges): add readTime + fastPath frontmatter to articles 1-4"
  ```

  Commit 2 (articles 5-8):
  ```bash
  git add docs-site/content/01-databases/concepts/sharding-strategies.md \
    docs-site/content/06-scalability/concepts/consistent-hashing-deep-dive.md \
    docs-site/content/05-distributed-systems/concepts/cap-theorem-practical.md \
    docs-site/content/04-messaging/concepts/message-queue-basics.md
  git commit -m "feat(badges): add readTime + fastPath frontmatter to articles 5-8"
  ```

  Commit 3 (articles 9-12):
  ```bash
  git add docs-site/content/07-api-design/concepts/rate-limiting.md \
    docs-site/content/06-scalability/concepts/high-availability.md \
    docs-site/content/16-system-design-problems/01-data-processing/url-shortener.md \
    docs-site/content/16-system-design-problems/02-social-platforms/twitter.md
  git commit -m "feat(badges): add readTime + fastPath frontmatter to articles 9-12"
  ```

---

## Agent C: Spaced Repetition Callouts

**Worktree:** `agent-spaced-rep`
**Modifies:** 10 cheat sheet files — body content only, no frontmatter
**Does NOT touch any _meta.js or new files**

### Files Modified:
1. `docs-site/content/cheat-sheets/aws.md`
2. `docs-site/content/cheat-sheets/system-design.md`
3. `docs-site/content/cheat-sheets/databases.md`
4. `docs-site/content/cheat-sheets/caching.md`
5. `docs-site/content/cheat-sheets/networking.md`
6. `docs-site/content/cheat-sheets/messaging.md`
7. `docs-site/content/cheat-sheets/security.md`
8. `docs-site/content/cheat-sheets/ai-agents.md`
9. `docs-site/content/cheat-sheets/mobile.md`
10. `docs-site/content/cheat-sheets/index.md`

---

### Task C-1: Add Spaced Repetition Block to Each Cheat Sheet

**For each cheat sheet, the process is identical:**

- [ ] **Step 1: Read the file**

  Find the very top of the file body (after frontmatter closing `---`). Insert the spaced repetition callout block **before the first `##` heading**.

- [ ] **Step 2: Insert this callout block at the top of the body**

  ```markdown
  > **📅 Spaced Repetition Schedule**
  > Use this cheat sheet on a 4-interval cycle for maximum retention:
  > - **Day 0** — Read it fully (20-30 min)
  > - **Day 3** — Skim headers, cover answers, test yourself
  > - **Day 10** — Quiz yourself on the "Trap" entries without looking
  > - **Day 30** — Quick scan for gaps; revisit any you missed

  ---
  ```

  > **Important:** Do not modify any other part of the file. Only insert this block after the frontmatter.

- [ ] **Step 3: Also update `docs-site/content/cheat-sheets/index.md`**

  The index page should include an intro paragraph (after frontmatter, before any existing content) explaining how to use cheat sheets:

  ```markdown
  ## How to Use These Cheat Sheets

  Cheat sheets are for **review, not first learning**. Read the full article first, then return here to:
  - Test yourself before interviews
  - Run your spaced repetition cycle (schedule is at the top of each sheet)
  - Do a rapid pre-interview scan (5 min per sheet)

  Each entry has: a key number to memorize · a decision rule · a trap to avoid.

  ---
  ```

- [ ] **Step 4: Commit after every 3 cheat sheets (4 commits total)**

  Commit 1:
  ```bash
  git add docs-site/content/cheat-sheets/aws.md \
    docs-site/content/cheat-sheets/system-design.md \
    docs-site/content/cheat-sheets/databases.md
  git commit -m "feat(spaced-rep): add review schedule callout to aws, system-design, databases cheat sheets"
  ```

  Commit 2:
  ```bash
  git add docs-site/content/cheat-sheets/caching.md \
    docs-site/content/cheat-sheets/networking.md \
    docs-site/content/cheat-sheets/messaging.md
  git commit -m "feat(spaced-rep): add review schedule callout to caching, networking, messaging cheat sheets"
  ```

  Commit 3:
  ```bash
  git add docs-site/content/cheat-sheets/security.md \
    docs-site/content/cheat-sheets/ai-agents.md \
    docs-site/content/cheat-sheets/mobile.md
  git commit -m "feat(spaced-rep): add review schedule callout to security, ai-agents, mobile cheat sheets"
  ```

  Commit 4:
  ```bash
  git add docs-site/content/cheat-sheets/index.md
  git commit -m "feat(spaced-rep): add how-to-use intro to cheat sheets index"
  ```

---

## Agent D: Distributed Systems POC Articles

**Worktree:** `agent-dist-pocs`
**Creates:** 4 new POC articles + 1 `_meta.js` update
**Does NOT modify any existing concept articles**

### Files Created:
- `docs-site/content/05-distributed-systems/poc/consistent-hashing-poc.md`
- `docs-site/content/05-distributed-systems/poc/leader-election-poc.md`
- `docs-site/content/05-distributed-systems/poc/vector-clocks-poc.md`
- `docs-site/content/05-distributed-systems/poc/rate-limiting-algorithms-poc.md`
- `docs-site/content/05-distributed-systems/poc/_meta.js` (new)
- `docs-site/content/05-distributed-systems/_meta.js` (add `poc` entry)

---

### Task D-1: Create POC Directory Meta

- [ ] **Step 1: Read `docs-site/content/05-distributed-systems/_meta.js`**

  Current content:
  ```js
  export default {
    index: "⚖️ Distributed Systems",
    concepts: "📖 Concepts",
    failures: "⚠️ Failure Modes"
  }
  ```

- [ ] **Step 2: Add poc entry**

  ```js
  export default {
    index: "⚖️ Distributed Systems",
    concepts: "📖 Concepts",
    failures: "⚠️ Failure Modes",
    poc: "🛠️ Hands-On POCs"
  }
  ```

- [ ] **Step 3: Create `docs-site/content/05-distributed-systems/poc/_meta.js`**

  ```js
  export default {
    "consistent-hashing-poc": "Consistent Hashing (Build It)",
    "leader-election-poc": "Leader Election (Bully Algorithm)",
    "vector-clocks-poc": "Vector Clocks (Conflict Detection)",
    "rate-limiting-algorithms-poc": "Rate Limiting (Token Bucket vs Sliding Window)"
  }
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add docs-site/content/05-distributed-systems/_meta.js \
    docs-site/content/05-distributed-systems/poc/_meta.js
  git commit -m "feat(dist-pocs): create poc directory and meta navigation"
  ```

---

### Task D-2: Consistent Hashing POC

- [ ] **Step 1: Create `docs-site/content/05-distributed-systems/poc/consistent-hashing-poc.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "POC: Consistent Hashing — See Why Naive Modulo Breaks"
  layer: poc
  section: "05-distributed-systems/poc"
  difficulty: intermediate
  tags: [consistent-hashing, load-balancing, partitioning, distributed-systems]
  category: distributed-systems
  prerequisites: ["05-distributed-systems/concepts/distributed-consensus"]
  see_also: ["06-scalability/concepts/consistent-hashing-deep-dive"]
  readTime: "25 min"
  ---
  ```

  **Article structure (write all sections):**

  **## The Problem You're About to Feel**

  Explain: You have 3 cache servers. Using naive modulo (`key % 3`), keys are distributed. Then you add a 4th server (`key % 4`). Describe *exactly what happens*: 75% of all keys now route to a different server — instant cache miss storm. The entire cache is effectively invalidated. This is the thundering herd trigger.

  **## Naive Modulo: Full Implementation (Node.js)**

  Write the complete Node.js implementation — no frameworks, no npm packages, just stdlib:
  - `NaiveHashRing` class with `addServer(name)`, `getServer(key)` methods
  - Uses `key % servers.length` as the hash function
  - A demo function that: adds 3 servers, assigns 1000 keys, adds a 4th server, re-assigns the same 1000 keys, counts how many moved
  - Expected output: `~750 of 1000 keys moved to a different server`

  **## Consistent Hash Ring: Full Implementation**

  Write the complete Node.js implementation:
  - `ConsistentHashRing` class
  - Uses a sorted virtual node array (150 virtual nodes per server)
  - `addServer(name)` — adds 150 virtual nodes, re-sorts the ring
  - `getServer(key)` — binary search to find the first virtual node clockwise from the key hash
  - Same demo function: add 3 servers, assign 1000 keys, add a 4th server, re-assign
  - Expected output: `~25% of keys moved (only those between the new server and its predecessor)`

  **## Side-by-Side Comparison Table**

  | | Naive Modulo | Consistent Hash |
  |---|---|---|
  | Keys moved when adding 1 server to N-server cluster | ~(N/(N+1)) × total keys | ~(1/(N+1)) × total keys |
  | Example: add 1 server to 3-server cluster | 75% of keys | 25% of keys |
  | Implementation complexity | 2 lines | ~40 lines |
  | When it breaks | Any cluster resize | Never (by design) |
  | Real-world usage | Never in production | Amazon DynamoDB, Cassandra, Riak |

  **## What to Observe**

  Three observations the learner should record after running the code:
  1. What percentage of keys moved with naive modulo?
  2. What percentage moved with consistent hashing?
  3. What happens if you increase virtual nodes from 150 to 300 — does the distribution become more even?

  **## When Consistent Hashing Fails**

  2-3 sentences: Consistent hashing breaks when virtual node count is too low (uneven distribution) and when the hash function has poor distribution (collisions). Hot spot detection is still needed even with consistent hashing.

  **## References**
  - 📖 [Amazon DynamoDB Architecture](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html) — Werner Vogels, 2007
  - 📖 [Consistent Hashing and Random Trees](https://www.cs.princeton.edu/courses/archive/fall09/cos518/papers/chash.pdf) — Karger et al., 1997
  - 📚 [See full concept deep-dive](../concepts/consistent-hashing-deep-dive)

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/05-distributed-systems/poc/consistent-hashing-poc.md
  git commit -m "feat(poc): add consistent hashing POC with naive vs ring comparison"
  ```

---

### Task D-3: Leader Election POC

- [ ] **Step 1: Create `docs-site/content/05-distributed-systems/poc/leader-election-poc.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "POC: Leader Election — Bully Algorithm with Split-Brain"
  layer: poc
  section: "05-distributed-systems/poc"
  difficulty: advanced
  tags: [leader-election, consensus, distributed-systems, split-brain]
  category: distributed-systems
  prerequisites: ["05-distributed-systems/concepts/distributed-consensus"]
  readTime: "30 min"
  ---
  ```

  **Article structure:**

  **## The Problem: Who Is In Charge?**

  Scenario: 5 nodes form a cluster. The leader handles all writes. The leader crashes. Within 200ms, every node must agree on who the new leader is — without a central coordinator (because there isn't one). This is leader election. The Bully Algorithm is the simplest to understand and implement.

  **## The Bully Algorithm — Rules**

  4 rules written as numbered list:
  1. Any node can start an election when it stops hearing from the leader (heartbeat timeout).
  2. A node starting an election sends `ELECTION` to all nodes with a higher ID.
  3. If no higher node responds within a timeout, the sender declares itself leader and broadcasts `COORDINATOR`.
  4. If a higher node receives `ELECTION`, it sends `OK` (bullies the lower node out) and starts its own election.

  **## Full Implementation (Node.js, no network — simulated message passing)**

  Write a complete simulation where:
  - `Node` class has: `id`, `isLeader`, `isAlive`, `sendMessage(to, type)`, `receiveMessage(from, type)`
  - `Cluster` class manages 5 nodes, message routing, and can call `killNode(id)`
  - A demo that:
    1. Creates a 5-node cluster. Node 5 (highest ID) becomes leader.
    2. Calls `cluster.killNode(5)` — the leader dies.
    3. Triggers election from Node 1 — the lowest node.
    4. Logs every message exchanged.
    5. Prints final leader (should be Node 4, the new highest alive node).

  **## The Split-Brain Demo**

  Add a second demo that:
  1. Creates the cluster
  2. Simulates a network partition: nodes 1-2 cannot communicate with nodes 3-5
  3. Both partitions elect their own leader
  4. Logs: "SPLIT BRAIN: Node 2 thinks it's leader, Node 5 thinks it's leader"
  5. Explain in 2 sentences what happens when the partition heals: one leader must step down. How Raft (not Bully) solves this via quorum.

  **## What to Observe**

  1. How many messages does an election generate? (count them in the logs)
  2. In a 10-node cluster, how many messages would worst-case election generate? (n² messages)
  3. Does split-brain resolve itself in the Bully algorithm? What would need to change?

  **## References**
  - 📖 [Raft Consensus Algorithm](https://raft.github.io/) — Diego Ongaro's visualizer
  - 📚 [See concept article](../concepts/distributed-consensus)

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/05-distributed-systems/poc/leader-election-poc.md
  git commit -m "feat(poc): add leader election POC with bully algorithm and split-brain demo"
  ```

---

### Task D-4: Vector Clocks POC

- [ ] **Step 1: Create `docs-site/content/05-distributed-systems/poc/vector-clocks-poc.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "POC: Vector Clocks — Detecting Concurrent Writes"
  layer: poc
  section: "05-distributed-systems/poc"
  difficulty: advanced
  tags: [vector-clocks, causality, conflict-detection, distributed-systems]
  category: distributed-systems
  prerequisites: ["05-distributed-systems/concepts/vector-clocks-logical-time"]
  readTime: "25 min"
  ---
  ```

  **Article structure:**

  **## The Problem: Who Wrote Last?**

  Scenario: Two users edit the same document simultaneously on different nodes. Node A increments a counter to 5. Node B increments the same counter to 7. Both changes are valid at their own node. When they sync — which value wins? Wall-clock timestamps are unreliable in distributed systems (clock skew). Vector clocks tell you *which event happened before which*, and when they happened *concurrently* (no causal ordering possible → conflict, must be resolved by application logic).

  **## Vector Clock Rules**

  3 rules:
  1. Each node maintains its own counter in a vector: `{A: 0, B: 0, C: 0}`
  2. On every local event, the node increments its own counter: `{A: 1, B: 0, C: 0}`
  3. On message receive, the receiver takes the max of each counter from the incoming vector, then increments its own.

  **## Happens-Before Comparison**

  Two events X and Y: X happened-before Y if every counter in X is ≤ the corresponding counter in Y, and at least one counter is strictly less.

  If neither X < Y nor Y < X — they are **concurrent** (a conflict).

  **## Full Implementation (Node.js)**

  Write:
  - `VectorClock` class with `tick(nodeId)`, `merge(otherClock)`, `happensBefore(other)`, `isConcurrent(other)`, `clone()`
  - 3-node demo (Node A, B, C):
    1. A writes: `{A:1, B:0, C:0}`
    2. A sends to B, B merges and writes: `{A:1, B:1, C:0}`
    3. A and C write simultaneously (no sync): A at `{A:2, B:0, C:0}`, C at `{A:0, B:0, C:1}`
    4. Compare A's second write and C's write → print "CONCURRENT: conflict detected"
    5. B receives C's update: `{A:1, B:2, C:1}`

  **## What to Observe**

  1. Can you tell which write was "last" when two events are concurrent? (No. That's the point.)
  2. What does Amazon Dynamo do with concurrent writes? (Return all conflicting versions to the client — "shopping cart merge")
  3. What's the downside of vector clocks in a 1000-node cluster? (1000-element vector per event)

  **## References**
  - 📖 [Amazon Dynamo Paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf)
  - 📚 [See concept article](../concepts/vector-clocks-logical-time)

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/05-distributed-systems/poc/vector-clocks-poc.md
  git commit -m "feat(poc): add vector clocks POC with concurrent write conflict detection"
  ```

---

### Task D-5: Rate Limiting Algorithms POC

- [ ] **Step 1: Create `docs-site/content/05-distributed-systems/poc/rate-limiting-algorithms-poc.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "POC: Rate Limiting — Token Bucket vs Sliding Window"
  layer: poc
  section: "05-distributed-systems/poc"
  difficulty: intermediate
  tags: [rate-limiting, token-bucket, sliding-window, api-design]
  category: distributed-systems
  prerequisites: ["07-api-design/concepts/rate-limiting"]
  readTime: "20 min"
  ---
  ```

  **Article structure:**

  **## The Problem: Not All Limits Are Equal**

  Scenario: Your API allows 100 requests/minute. Two different clients send exactly 100 requests in 60 seconds, but with different patterns:
  - Client A: evenly spaced (1.67 req/sec)
  - Client B: all 100 in the first second, then silence

  A fixed window counter (`requests_this_minute`) allows both. But Client B just hammered your database with 100 simultaneous queries. The question is: do you limit *rate* or *burst*?

  **## Three Algorithms Compared**

  **Algorithm 1: Fixed Window Counter**
  Implementation: `count[minute] += 1; if count[minute] > limit: reject`
  The edge case bug: 100 requests at 11:59:55 + 100 at 12:00:05 = 200 requests in a 10-second window. Window resets hide the burst.

  **Algorithm 2: Token Bucket**
  - Bucket holds max N tokens. Refills at R tokens/second.
  - Each request consumes 1 token. No token → reject.
  - Allows controlled bursting: bucket can fill up and be spent in a burst.
  - Full implementation in Node.js: `TokenBucket` class with `consume()`, `refill()`.

  **Algorithm 3: Sliding Window Counter**
  - Keeps a log of timestamps for the last N requests.
  - On each request: remove timestamps older than the window, count remaining, if count < limit → allow.
  - More accurate than fixed window. Higher memory cost (stores every timestamp).
  - Full implementation in Node.js: `SlidingWindow` class with `allow(timestamp)`.

  **## The Burst Behavior Demo**

  A simulation that:
  1. Creates both a TokenBucket (100 tokens, refill 10/sec) and SlidingWindow (100 req/min)
  2. Sends 100 requests in the first 0.1 seconds (a burst)
  3. Then sends 1 request every second for the next 60 seconds
  4. Logs which requests each algorithm allows vs rejects
  5. Shows the difference: Token Bucket allows the burst (empties bucket), then allows slow trickle as it refills. Sliding Window rejects requests 101-200 until old requests age out.

  **## Decision Table**

  | | Fixed Window | Token Bucket | Sliding Window |
  |---|---|---|---|
  | Burst handling | Poor (edge case) | Controlled | Strict |
  | Memory | O(1) | O(1) | O(requests in window) |
  | Redis implementation | INCR + EXPIRE | INCRBY + TTL | ZADD + ZREMRANGEBYSCORE |
  | Used by | Legacy systems | Stripe, AWS | Cloudflare, Nginx |
  | Interview default | Never pick this | ✅ Pick this | When strict accuracy needed |

  **## References**
  - 📖 [Stripe Rate Limiting](https://stripe.com/blog/rate-limiters) — Stripe Engineering Blog
  - 📚 [See concept article](../../07-api-design/concepts/rate-limiting)

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/05-distributed-systems/poc/rate-limiting-algorithms-poc.md
  git commit -m "feat(poc): add rate limiting POC with token bucket vs sliding window burst demo"
  ```

---

## Agent E: System Design Problem Articles

**Worktree:** `agent-sd-problems`
**Creates:** 5 new system design problem articles
**Reference:** The `url-shortener.md` article in `16-system-design-problems/01-data-processing/` is the gold standard for format. Read it before writing any article.
**Reference:** `docs-site/content/16-system-design-problems/02-social-platforms/twitter.md` is also complete — use it for the fan-out pattern references.

### Files Created:
- `docs-site/content/16-system-design-problems/01-data-processing/youtube-netflix.md`
- `docs-site/content/16-system-design-problems/03-communication/whatsapp-messenger.md`
- `docs-site/content/16-system-design-problems/04-reservation-scheduling/uber-ride-matching.md`
- `docs-site/content/16-system-design-problems/04-reservation-scheduling/airbnb-listing-search.md`
- `docs-site/content/16-system-design-problems/05-infrastructure/rate-limiter.md`
- `docs-site/content/16-system-design-problems/PROGRESS.md` (update 4→9 completed)

Also update `_meta.js` files in each affected subdirectory.

---

### Task E-1: Read the Gold Standard Before Writing Anything

- [ ] **Step 1: Read the reference article**

  Read `docs-site/content/16-system-design-problems/01-data-processing/url-shortener.md` fully.

  Note the structure: functional requirements → non-functional requirements → back-of-envelope estimates → high-level design → deep dives (3-4 components) → trade-offs table → follow-up questions.

  This exact structure must be used for every article in this task.

- [ ] **Step 2: Read a second reference**

  Read `docs-site/content/16-system-design-problems/02-social-platforms/twitter.md` for the fan-out pattern and how write-heavy vs read-heavy systems are framed.

---

### Task E-2: Design YouTube/Netflix

- [ ] **Step 1: Create `docs-site/content/16-system-design-problems/01-data-processing/youtube-netflix.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "Design YouTube or Netflix — Video Streaming at Scale"
  layer: case-study
  section: "16-system-design-problems/01-data-processing"
  difficulty: advanced
  tags: [video-streaming, cdn, transcoding, distributed-storage]
  category: scalability
  readTime: "45 min"
  fastPath: false
  ---
  ```

  **Required sections (follow gold standard structure exactly):**

  1. **Problem Statement** — Design a video platform serving 2B monthly active users, 500 hours of video uploaded every minute, 1B hours watched daily.

  2. **Functional Requirements** (5 bullets): Upload video, stream video at adaptive bitrate, search videos, comment/like, recommended feed.

  3. **Non-Functional Requirements** (5 bullets): 99.99% availability for streaming, < 2 sec video start latency globally, < 500ms for feed load, videos never lost after upload confirmation, support 4K/1080p/720p/480p adaptive bitrate.

  4. **Back-of-Envelope Estimates**:
     - Storage: 500 hrs/min × 60 min/hr × 2 GB/hr (compressed) × 4 resolutions = ~240 TB/day new storage
     - Bandwidth: 1B hrs/day ÷ 86,400 sec = ~11.5M concurrent viewers × 4 Mbps avg = ~46 Tbps egress
     - Upload bandwidth: 500 hrs/min × 2 GB/hr ÷ 60 sec = ~280 Mbps ingress (much smaller)

  5. **High-Level Architecture** (Mermaid diagram) with these components: Upload Service → Video Processing Queue → Transcoding Workers → Distributed Storage (S3-like) → CDN → Video Player (adaptive bitrate). Show metadata DB and search service separately.

  6. **Deep Dive: Video Upload & Transcoding**
     - Chunked upload protocol (5 MB chunks, resumable)
     - Transcoding pipeline: one input → 4+ output formats (4K, 1080p, 720p, 480p, audio-only)
     - Why transcoding is CPU-bound: explain 1 hour of 4K video takes ~30 min to transcode on 8 vCPUs
     - Job queue pattern: SQS → worker fleet → S3 output
     - Mermaid: upload → chunked assembly → transcode queue → worker pool → S3

  7. **Deep Dive: Adaptive Bitrate Streaming (ABR)**
     - How HLS/DASH works: video split into 6-second segments, manifest file lists all variants
     - How the player decides quality: measures last-3-segments download speed, picks bitrate that will download in < 3 seconds
     - Why CDN is mandatory: without CDN, video bytes travel from origin for every view. With CDN, popular segments cached at edge. Netflix caches 95% of content at edge.

  8. **Deep Dive: CDN Strategy**
     - Push vs pull CDN for video (pull wins for long-tail content, push wins for anticipated blockbusters)
     - Geographic distribution: 200+ PoPs globally
     - Cache warming before big releases (Super Bowl ads, new movie premieres)
     - Cache eviction: LRU with a twist — popularity score prevents evicting trending content

  9. **Trade-Off Table**:
     | Decision | Option A | Option B | Winner |
     |---|---|---|---|
     | Storage | Self-hosted HDFS | Cloud S3 | S3 (operational cost) |
     | Transcoding | Synchronous | Async queue | Async (user doesn't wait) |
     | CDN | Pull-through | Pre-push | Hybrid |
     | Search | Elasticsearch | Algolia | ES (cost at scale) |

  10. **Follow-Up Questions** (3 interviewers love to ask):
      - How would you handle live streaming (different from on-demand)?
      - How would you prevent piracy / handle DRM?
      - How does YouTube's recommendation algorithm affect your storage strategy?

- [ ] **Step 2: Update `docs-site/content/16-system-design-problems/01-data-processing/_meta.js`**

  Add `"youtube-netflix": "Design YouTube/Netflix"` to the existing meta object.

- [ ] **Step 3: Commit**
  ```bash
  git add docs-site/content/16-system-design-problems/01-data-processing/youtube-netflix.md \
    docs-site/content/16-system-design-problems/01-data-processing/_meta.js
  git commit -m "feat(problems): add Design YouTube/Netflix system design problem"
  ```

---

### Task E-3: Design WhatsApp Messenger

- [ ] **Step 1: Create `docs-site/content/16-system-design-problems/03-communication/whatsapp-messenger.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "Design WhatsApp or Facebook Messenger — Real-Time Messaging at Scale"
  layer: case-study
  section: "16-system-design-problems/03-communication"
  difficulty: advanced
  tags: [messaging, websockets, push-notifications, end-to-end-encryption]
  category: distributed-systems
  readTime: "40 min"
  ---
  ```

  **Required sections:**

  1. **Problem Statement** — 2B users, 100B messages/day, delivered in < 1 second, with offline delivery guarantee.

  2. **Functional Requirements**: Send/receive messages (1:1 and group), media sharing (images/video/docs), online/offline status, read receipts, message history up to 1 year.

  3. **Non-Functional Requirements**: < 100ms message delivery latency when both online, 99.99% message delivery guarantee (no message loss), E2E encryption by default, max 256 members in a group.

  4. **Back-of-Envelope**:
     - 100B messages/day ÷ 86,400 sec = ~1.16M messages/sec
     - Storage: 100B msg/day × 100 bytes/msg = ~10 TB/day text. Media: assume 10% of messages have media, avg 500 KB → 5 PB/day. Store media separately.
     - Connections: 2B users, assume 10% online at peak = 200M concurrent WebSocket connections

  5. **High-Level Architecture** (Mermaid): Client → WebSocket Server (stateful) → Message Router → Message Queue → Delivery Worker → Push Notification (if offline). Also: Presence Service, Media Service, User Service.

  6. **Deep Dive: Message Delivery Flow**
     - Online-to-online: Client A → WebSocket → Message Router → looks up which server Client B is connected to → routes → Client B WebSocket
     - Online-to-offline: same path but Message Router finds no active connection → enqueues in Message Queue → Push Notification Service → APNs/FCM → client reconnects → pulls queue
     - Exactly-once delivery: message ID + client-side dedup. Client sends ACK, server retains until ACK received.

  7. **Deep Dive: WebSocket Connection Management**
     - Why WebSocket over HTTP polling: 100ms latency vs 3-30 second poll interval. At 200M connections, polling would require 200M HTTP requests/30 seconds = 6.7M req/sec just for presence.
     - Sticky sessions: client must reconnect to same server (or server must know mapping). Use consistent hashing on user_id to route to server.
     - Connection registry: Redis hash `user_id → server_id`. Updated on connect/disconnect.

  8. **Deep Dive: Group Messaging Fan-Out**
     - Group with 256 members: 1 message must fan out to 255 delivery targets
     - At 100M group messages/day, fan-out creates: 100M × 255 = 25.5B delivery events/day
     - Fan-out on write (Twitter model): pre-compute and enqueue per-member. Works if members online.
     - Fan-out on read: store 1 copy, each member fetches their unread on reconnect. Simpler, higher read cost.
     - WhatsApp's actual approach: fan-out on read for large groups (> 100 members), fan-out on write for small groups.

  9. **Trade-Off Table**: Polling vs WebSocket, fan-out write vs read, client-side vs server-side encryption storage.

  10. **Follow-Up Questions**: How would you scale to 1 trillion messages/day? How does E2E encryption work with group key management? How do you handle message ordering in a multi-device world?

- [ ] **Step 2: Update `docs-site/content/16-system-design-problems/03-communication/_meta.js`**

  Read the current meta, add `"whatsapp-messenger": "Design WhatsApp/Messenger"`.

- [ ] **Step 3: Commit**
  ```bash
  git add docs-site/content/16-system-design-problems/03-communication/whatsapp-messenger.md \
    docs-site/content/16-system-design-problems/03-communication/_meta.js
  git commit -m "feat(problems): add Design WhatsApp/Messenger system design problem"
  ```

---

### Task E-4: Design Uber Ride Matching

- [ ] **Step 1: Create `docs-site/content/16-system-design-problems/04-reservation-scheduling/uber-ride-matching.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "Design Uber — Real-Time Ride Matching & Driver Location"
  layer: case-study
  section: "16-system-design-problems/04-reservation-scheduling"
  difficulty: advanced
  tags: [geospatial, real-time-location, matching, websockets]
  category: scalability
  readTime: "40 min"
  ---
  ```

  **Required sections:**

  1. **Problem Statement** — 5M rides/day, 4M drivers globally, match rider to closest available driver in < 5 seconds, track driver location updating every 4 seconds.

  2. **Functional Requirements**: Rider requests ride → matched to nearby driver. Driver location tracked in real-time. Surge pricing based on supply/demand. ETA calculation. Ride history.

  3. **Non-Functional Requirements**: Driver location update: < 5 second staleness. Match latency: < 5 seconds P95. 99.99% availability. Handle 10x surge (New Year's Eve, concerts).

  4. **Back-of-Envelope**:
     - Location updates: 4M active drivers × 1 update/4 sec = 1M location writes/sec
     - Ride requests: 5M/day ÷ 86,400 sec = ~58 req/sec average, 580 req/sec peak (10x surge)
     - Storage for location: 4M drivers × 48 bytes (lat/lon/timestamp/id) = 192 MB in memory (fits in Redis)

  5. **High-Level Architecture** (Mermaid): Rider App → API Gateway → Ride Service → Matching Service → Location Service (Redis geospatial). Also: Driver App → Location Service. Notification Service for driver/rider updates.

  6. **Deep Dive: Location Service (The Core)**
     - Redis GEO commands: `GEOADD drivers_locations <lon> <lat> <driver_id>` and `GEORADIUS drivers_locations <lon> <lat> 2 km WITHCOORD WITHDIST COUNT 10 ASC`
     - Update frequency: driver app sends GPS every 4 seconds. At 4M drivers → 1M writes/sec to Redis. Use Redis Cluster with geospatial data sharded by geohash region.
     - Geohash for sharding: divide world into 32 cells (geohash level 1), shard by cell. Queries near cell boundaries require checking adjacent cells.
     - Alternative: H3 hexagonal indexing (Uber's actual approach). Hexagons have equal-distance neighbors (squares don't — corner vs edge).

  7. **Deep Dive: Matching Algorithm**
     - Naive: find closest driver with straight-line distance. Problem: doesn't account for roads (a driver across a highway might be 0.5km away but 10 min drive).
     - Better: find top 10 closest by geo radius, run ETA estimation via routing service (OSRM, Google Maps API), pick minimum ETA.
     - Offer-and-accept: send offer to top driver, 15 sec timeout, if declined → next driver. This serializes matching → adds latency.
     - Parallel offers (Uber's model): send to top 3 simultaneously, first accept wins, cancel others. Reduces latency from 45s to 15s.

  8. **Deep Dive: Surge Pricing**
     - Supply: available drivers in a geohash region (from Location Service)
     - Demand: pending ride requests in the same region (from Ride Service)
     - Surge multiplier: `ceil(demand / supply)` capped at configurable max (5x)
     - Update frequency: recalculate per-region every 60 seconds
     - Regional granularity: geohash level 6 (1.2 km × 0.6 km cells). Too coarse → wrong pricing. Too fine → too many empty cells.

  9. **Trade-Off Table**: Redis geo vs PostGIS vs H3, parallel offers vs serial, geohash vs H3 for sharding.

  10. **Follow-Up Questions**: How do you handle driver going offline mid-ride? How does ETA change when traffic data is included? How would you design the surge pricing to prevent driver gaming (all driving to same area)?

- [ ] **Step 2: Update meta and commit**
  ```bash
  git add docs-site/content/16-system-design-problems/04-reservation-scheduling/uber-ride-matching.md \
    docs-site/content/16-system-design-problems/04-reservation-scheduling/_meta.js
  git commit -m "feat(problems): add Design Uber ride matching system design problem"
  ```

---

### Task E-5: Design Airbnb Listing Search

- [ ] **Step 1: Create `docs-site/content/16-system-design-problems/04-reservation-scheduling/airbnb-listing-search.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "Design Airbnb — Listing Search with Availability & Booking"
  layer: case-study
  section: "16-system-design-problems/04-reservation-scheduling"
  difficulty: advanced
  tags: [search, geospatial, availability, double-booking, distributed-locking]
  category: databases
  readTime: "40 min"
  ---
  ```

  **Required sections:**

  1. **Problem Statement** — 7M listings, 2M guests searching simultaneously, search by location + dates + filters, no double-bookings, instant confirmation.

  2. **Functional Requirements**: Search listings by location/dates/guests/price/amenities. View listing detail + availability calendar. Book listing (instant or request-to-book). Host manages availability. Reviews.

  3. **Non-Functional Requirements**: Search results < 300ms P95. Booking confirmation < 1 second. Zero double-bookings. 99.99% availability. Handle 100x traffic on holidays.

  4. **Back-of-Envelope**:
     - Search QPS: 2M concurrent searchers × 5 searches/min ÷ 60 sec = ~166K search QPS
     - Listings DB: 7M listings × 2 KB metadata = 14 GB (fits in memory)
     - Availability data: 7M listings × 365 days × 8 bytes = ~20 GB (also fits in Redis)

  5. **High-Level Architecture** (Mermaid): Search Service (Elasticsearch) → API → Booking Service → Availability DB → Payment Service. Separate: Listing Service (Postgres), Review Service, Notification Service.

  6. **Deep Dive: Search Architecture**
     - Why Elasticsearch: Geo queries + full-text + filters in one query. Postgres GIN index works for small scale but struggles past 1M listings with complex filter combinations.
     - Sync strategy: Listing changes (price, description, photos) → Kafka → ES indexer. Near-real-time (~5 sec lag). Availability changes are NOT in ES (too volatile) — filtered post-search.
     - The two-phase search: Phase 1 (ES): geo + filter → top 200 candidates. Phase 2 (Availability DB): filter 200 by actual availability for requested dates → return top 20. This is how Airbnb actually works.

  7. **Deep Dive: Availability Management**
     - Schema: `listing_id, date, status (AVAILABLE/BLOCKED/BOOKED)` — one row per listing per day.
     - Atomic availability check + book: SQL transaction with `SELECT FOR UPDATE` on the date range rows. Pessimistic locking prevents double-booking at DB level.
     - Performance: `SELECT FOR UPDATE` serializes concurrent bookings for the same listing. At peak, 100 concurrent users trying to book a popular listing → 99 wait. Acceptable because popular listings are popular, not hot-key at DB level.
     - Alternative: Optimistic locking with version number + retry. Works when contention is low.

  8. **Deep Dive: The Double-Booking Problem**
     - Scenario: User A and User B both see listing available for Dec 25. Both click "Book Now" simultaneously.
     - Naive approach (broken): check availability → book → confirm. Race condition between check and book.
     - Correct approach: atomic check-and-reserve inside a transaction. `BEGIN; SELECT status FROM availability WHERE listing_id=X AND date=Dec25 FOR UPDATE; UPDATE availability SET status=BOOKED; COMMIT;` — only one transaction can hold the row lock.
     - Why distributed locking (Redis `SETNX`) is NOT needed here: the database transaction already provides the required isolation.

  9. **Trade-Off Table**: ES vs Postgres for search, optimistic vs pessimistic locking, sync vs async availability index.

  10. **Follow-Up Questions**: How would you handle instant booking vs request-to-book flows differently? How do you prevent hosts from blocking calendar to avoid refunds? How does Airbnb handle the "long-tail" of rarely searched locations?

- [ ] **Step 2: Update meta and commit**
  ```bash
  git add docs-site/content/16-system-design-problems/04-reservation-scheduling/airbnb-listing-search.md \
    docs-site/content/16-system-design-problems/04-reservation-scheduling/_meta.js
  git commit -m "feat(problems): add Design Airbnb listing search system design problem"
  ```

---

### Task E-6: Design a Rate Limiter (as a Standalone System)

- [ ] **Step 1: Create `docs-site/content/16-system-design-problems/05-infrastructure/rate-limiter.md`**

  **Frontmatter:**
  ```yaml
  ---
  title: "Design a Rate Limiter — API Protection at Scale"
  layer: case-study
  section: "16-system-design-problems/05-infrastructure"
  difficulty: intermediate
  tags: [rate-limiting, token-bucket, redis, distributed-systems, api-design]
  category: architecture
  readTime: "35 min"
  fastPath: false
  ---
  ```

  **Required sections:**

  1. **Problem Statement** — Design a rate limiter that handles 10M API calls/sec across a distributed fleet, enforces per-user and per-endpoint limits, adds < 5ms overhead per request.

  2. **Functional Requirements**: Limit requests per user (e.g. 1000 req/min). Different limits per API endpoint. Return `429 Too Many Requests` with `Retry-After` header. Distributed (works across 100 API servers).

  3. **Non-Functional Requirements**: < 5ms overhead P99. Eventually consistent (slight over-limit during network partition is acceptable). 99.99% availability — rate limiter failure should NOT block traffic (fail open).

  4. **Back-of-Envelope**:
     - 10M req/sec across 100 servers = 100K req/sec per server
     - Redis key per user: 10M users × 32 bytes/key = 320 MB. Fits in Redis.
     - Redis capacity: a single Redis node handles ~1M ops/sec. At 10M req/sec → need 10 Redis nodes. Use Redis Cluster.

  5. **High-Level Architecture** (Mermaid): Client → API Gateway → Rate Limiter Middleware → Redis Cluster (counter storage) → Backend. Show the 3-layer structure: edge (Nginx), app (middleware), storage (Redis).

  6. **Deep Dive: Where to Put the Rate Limiter**
     - Option 1: Client-side — trivially bypassed. Never use.
     - Option 2: API Gateway — best for infrastructure-level limits (DDoS protection). Stripe, Kong, AWS API Gateway.
     - Option 3: Application middleware — best for business logic limits (per-user, per-endpoint). More flexible.
     - Production answer: both. Gateway handles IP-level limits (DDoS). App handles user-level limits.

  7. **Deep Dive: Token Bucket in Redis**
     - Schema: `key = rate_limit:{user_id}:{endpoint}`, value = `{tokens, last_refill_time}`
     - Lua script for atomic check-and-consume (prevents race condition between read and write):
       ```lua
       -- pseudocode (write as comment-annotated code block)
       local tokens = tonumber(redis.call('GET', key)) or MAX_TOKENS
       local now = tonumber(ARGV[1])  -- current timestamp
       local last = tonumber(redis.call('GET', key..':ts')) or now
       local refill = math.min(MAX_TOKENS, tokens + (now - last) * REFILL_RATE)
       if refill >= 1 then
         redis.call('SET', key, refill - 1)
         redis.call('SET', key..':ts', now)
         return 1  -- allowed
       end
       return 0  -- rejected
       ```
     - Why Lua: Redis executes Lua atomically. No other command can run between the read and write. No distributed lock needed.

  8. **Deep Dive: Handling Distributed Consistency**
     - Problem: 100 API servers all writing to Redis. Network latency to Redis = 1-3ms. At 100K req/sec/server, each server makes 100K Redis round trips/sec.
     - Optimization 1: Local in-memory counter with periodic sync to Redis (every 100ms). Trade-off: can over-limit by up to SYNC_INTERVAL × rate (acceptable for most APIs).
     - Optimization 2: Sliding window via Redis sorted sets: `ZADD` with timestamp, `ZREMRANGEBYSCORE` to expire, `ZCARD` to count. More accurate, higher CPU.
     - Stripe's approach: local counter + async Redis sync. This is the correct production answer.

  9. **Trade-Off Table**: Token bucket vs sliding window, local counter vs Redis-only, fail-open vs fail-closed.

  10. **Follow-Up Questions**: How do you implement per-IP limits (no user auth)? How does the rate limiter itself not become a single point of failure? How would you handle a Redis cluster node failure?

- [ ] **Step 2: Update `_meta.js` for infrastructure section**

  Read `docs-site/content/16-system-design-problems/05-infrastructure/_meta.js`. Add `"rate-limiter": "Design a Rate Limiter"`.

- [ ] **Step 3: Update PROGRESS.md**

  Read `docs-site/content/16-system-design-problems/PROGRESS.md`. Update:
  - `**Completed**: 4 / 163` → `**Completed**: 9 / 163`
  - Change status of YouTube/Netflix (row 2), WhatsApp row, Uber row, Airbnb row, Rate Limiter row from `⬜ Pending` to `✅ Done` and add the article link.

- [ ] **Step 4: Commit**
  ```bash
  git add docs-site/content/16-system-design-problems/05-infrastructure/rate-limiter.md \
    docs-site/content/16-system-design-problems/05-infrastructure/_meta.js \
    docs-site/content/16-system-design-problems/PROGRESS.md
  git commit -m "feat(problems): add Design Rate Limiter problem + update PROGRESS.md (4→9 done)"
  ```

---

## WAVE 2 (after all Wave 1 merges)

---

## Agent F: Quiz Sections on Fast-Path Articles

**Worktree:** `agent-quizzes`
**Prerequisite:** Wave 1 fully merged. The fast-path is defined.
**Modifies:** Body of 5 existing articles — appends a quiz section at the end
**Does NOT change frontmatter, headings, or any existing content**

### Files Modified:
1. `docs-site/content/02-caching/concepts/caching-fundamentals.md`
2. `docs-site/content/05-distributed-systems/concepts/cap-theorem-practical.md`
3. `docs-site/content/06-scalability/concepts/consistent-hashing-deep-dive.md`
4. `docs-site/content/04-messaging/concepts/message-queue-basics.md`
5. `docs-site/content/06-scalability/concepts/database-read-scaling.md`

---

### Task F-1: Understand the Quiz Format Before Writing

**Quiz question format rules:**
- 3 questions per article
- Each question is application-level, not recognition (see below)
- Questions are presented as toggle/details blocks (MDX `<details>` or callout — check existing article MDX patterns first)
- Answer must explain WHY, not just state what

**Recognition question (WRONG):** "What are the benefits of write-through caching?"
**Application question (CORRECT):** "Your cache has write-through enabled. A user updates their profile. The update takes 200ms instead of the usual 50ms. What is most likely happening, and how would you fix it?"

- [ ] **Step 1: Read one existing article to check what MDX components are used**

  Read `docs-site/content/02-caching/concepts/caching-fundamentals.md` — specifically look for any existing `<Callout>`, `<details>`, or custom MDX component usage to match the format.

---

### Task F-2: Write Quiz Section for Caching Fundamentals

- [ ] **Step 1: Append quiz section to `docs-site/content/02-caching/concepts/caching-fundamentals.md`**

  Add this section at the very end of the file (after References):

  ```markdown
  ---

  ## 🧠 Test Yourself

  > These are application questions — the kind asked in interviews. Think before revealing the answer.

  <details>
  <summary>Q1: You have a write-through cache. A user updates their profile. The write takes 300ms instead of the usual 50ms. What is happening?</summary>

  **Answer:** Write-through writes to both cache and database synchronously before confirming to the user. The 300ms latency is the database write latency — not the cache. The cache does not reduce write latency, only read latency. Fix: if writes don't need to be immediately consistent in cache, switch to write-around (write DB only, invalidate cache entry). Or accept the latency if read consistency is critical.
  </details>

  <details>
  <summary>Q2: Your cache hit rate is 95% for 10M users. You scale to 100M users and the hit rate drops to 60%. What most likely changed?</summary>

  **Answer:** The working set grew. Caching works when the "hot" data fits in cache. At 10M users, perhaps 5% (500K) of data accounts for 95% of reads — that 500K fits in your cache. At 100M users, even if access patterns are similar, the hot 5% is now 5M items, which may exceed your cache size. The fix is either to increase cache size or to use more aggressive eviction (LFU instead of LRU to keep truly hot items).
  </details>

  <details>
  <summary>Q3: What is a cache stampede and give one production-safe fix?</summary>

  **Answer:** Cache stampede (also: thundering herd) happens when a popular cache entry expires. All requests that were being served by that entry simultaneously find a cache miss and simultaneously hit the database. With 10K req/sec and a 1-second DB response, you get 10K simultaneous DB queries for the same data. **Fix 1:** Probabilistic early expiration — before the entry expires, 1-5% of requests proactively refresh it while others still get the cached value. **Fix 2:** External locking — first request to see a miss acquires a lock, fetches from DB, updates cache; all other requests wait for the lock to release. Fix 2 adds latency but prevents DB overload.
  </details>
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/02-caching/concepts/caching-fundamentals.md
  git commit -m "feat(quiz): add 3 application questions to caching-fundamentals"
  ```

---

### Task F-3: Write Quiz Section for CAP Theorem

- [ ] **Step 1: Append quiz section to `docs-site/content/05-distributed-systems/concepts/cap-theorem-practical.md`**

  ```markdown
  ---

  ## 🧠 Test Yourself

  <details>
  <summary>Q1: You're designing a banking system. A network partition occurs — some nodes can't communicate. Which do you sacrifice: Consistency or Availability? Justify your answer.</summary>

  **Answer:** Consistency. A banking system must never show an incorrect balance or allow a double-spend. If a partition means some nodes can't confirm a transaction, you choose to return an error (unavailability) rather than proceeding with possibly stale data (inconsistency). This is a CP system. Example: Zookeeper, traditional RDBMSes. Note: "Availability" in CAP means every request receives a response (even if stale). Not "the system is up."
  </details>

  <details>
  <summary>Q2: MongoDB claims to be CP. But you've seen production MongoDB return stale data after a primary failover. How is this possible if it's CP?</summary>

  **Answer:** CAP theorem applies to network partitions specifically — it's a binary choice only during a partition event. During normal operation (no partition), MongoDB can provide both consistency and availability. The stale read you observed happened during the partition window — while a new primary was being elected. During that window, MongoDB chose consistency (rejecting writes) but reads from secondaries could be stale. This is called "stale reads during failover" and it's a known behavior in most CP systems during the partition-resolution period. The fix is to set read concern to `majority`.
  </details>

  <details>
  <summary>Q3: DynamoDB is AP. A client writes a user's address. Immediately after, the same client reads the address. It gets the old address. What is this called and how does DynamoDB let you fix it?</summary>

  **Answer:** This is a read-your-writes consistency violation. It happens because DynamoDB replicates writes asynchronously across replicas, and a subsequent read may hit a replica that hasn't received the write yet. DynamoDB's fix: use **Strongly Consistent Reads** (instead of Eventually Consistent). Strongly consistent reads always route to the primary replica. Cost: 2x read capacity units and ~2x latency. Use eventually consistent reads for read-heavy workloads where slight staleness is acceptable; use strongly consistent reads when you must read your own writes.
  </details>
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/05-distributed-systems/concepts/cap-theorem-practical.md
  git commit -m "feat(quiz): add 3 application questions to cap-theorem-practical"
  ```

---

### Task F-4: Write Quiz Section for Consistent Hashing

- [ ] **Step 1: Append quiz section to `docs-site/content/06-scalability/concepts/consistent-hashing-deep-dive.md`**

  ```markdown
  ---

  ## 🧠 Test Yourself

  <details>
  <summary>Q1: You have a consistent hash ring with 3 cache servers. You add a 4th server. Which keys migrate and which stay?</summary>

  **Answer:** Only the keys that were assigned to the 4th server's predecessor (the server whose clockwise range the new server "cuts into") need to migrate. Specifically, the keys in the range between the new server's position and its clockwise predecessor's position. With a perfectly distributed ring, this is ~25% of keys (1/(N+1) of total). All other keys stay on their current server. Compare to modulo hashing where ~75% of all keys would need to remap (N/(N+1)).
  </details>

  <details>
  <summary>Q2: Your consistent hash ring has 3 physical servers and 150 virtual nodes per server (450 total). One server has 60% of the keys even though it should have ~33%. What is the most likely cause?</summary>

  **Answer:** Poor hash function distribution. With 150 virtual nodes per server, you expect even distribution, but if the hash function clusters virtual node positions, one server's 150 virtual nodes may cover more of the ring than another's. The fix: use a better hash function (SHA-256 > MD5 > custom), or increase virtual node count (300-500 per server) to smooth out distribution via the law of large numbers. Also check: are the server names used as hash inputs? "server1", "server2", "server3" may hash to close positions with some hash functions — use UUIDs or add a random suffix.
  </details>

  <details>
  <summary>Q3: Cassandra uses consistent hashing with virtual nodes (vnodes). If a new node joins the cluster, Cassandra says "the node will receive data from multiple source nodes." Why does data come from multiple sources, not just one?</summary>

  **Answer:** Because of virtual nodes. Each physical node owns multiple non-contiguous positions on the ring (in Cassandra, typically 256 vnodes per physical node). When a new physical node joins, it receives some vnodes from each existing node — not a single contiguous range from one node. This is actually a benefit: data transfer is parallelized across all existing nodes (each transfers only a fraction of its data), which speeds up bootstrap. The downside is more complex replication tracking.
  </details>
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/06-scalability/concepts/consistent-hashing-deep-dive.md
  git commit -m "feat(quiz): add 3 application questions to consistent-hashing-deep-dive"
  ```

---

### Task F-5: Write Quiz Sections for Message Queue Basics and Database Read Scaling

- [ ] **Step 1: Append quiz to `docs-site/content/04-messaging/concepts/message-queue-basics.md`**

  ```markdown
  ---

  ## 🧠 Test Yourself

  <details>
  <summary>Q1: You use a message queue to decouple an order service from an email service. The email service goes down for 2 hours. What happens to orders placed during that time?</summary>

  **Answer:** Orders are processed normally — the order service writes to the queue and returns success to the customer immediately. The email service, when it comes back online, processes the 2 hours of queued messages. Customers get their confirmation emails late, but orders are not lost. This is the primary benefit of async decoupling: the producer (order service) is completely unaffected by consumer (email service) downtime. If you had used a synchronous HTTP call instead, every order during those 2 hours would have either failed or timed out.
  </details>

  <details>
  <summary>Q2: A message has been redelivered to your consumer 50 times. Each time, the consumer processes it and crashes. What is happening and what is the fix?</summary>

  **Answer:** This is a poison pill message (also called a poison message). The message contains data that consistently causes the consumer to crash before it can acknowledge it. Without acknowledgment, the queue redelivers it. Fixes: (1) Dead Letter Queue (DLQ) — after N failed deliveries (typically 3-5), the queue automatically moves the message to a DLQ where it can be inspected. (2) Defensive consumer code that catches all exceptions and explicitly acknowledges (nacks) malformed messages instead of crashing. (3) Schema validation before processing. The DLQ approach is the production standard.
  </details>

  <details>
  <summary>Q3: Your queue has 1M unprocessed messages and consumers are processing at 1,000 messages/sec. New messages are arriving at 1,200 messages/sec. What do you do?</summary>

  **Answer:** You have queue growth: 200 messages/sec net accumulation. Options in order of preference: (1) **Scale consumers horizontally** — add more consumer instances. If one consumer does 1K msg/sec, add 20-25% more consumers to exceed the 1,200 msg/sec arrival rate. (2) **Increase consumer throughput** — batch processing (consume 100 at a time instead of 1). (3) **Reduce producer rate** — apply backpressure upstream (HTTP 503 to callers, slow down incoming requests). (4) **Priority queues** — shed low-priority messages. Do NOT increase message TTL to hide the problem; the backlog will grow until the queue OOM-crashes.
  </details>
  ```

- [ ] **Step 2: Append quiz to `docs-site/content/06-scalability/concepts/database-read-scaling.md`**

  ```markdown
  ---

  ## 🧠 Test Yourself

  <details>
  <summary>Q1: You add 3 read replicas to your Postgres primary. Read latency is unchanged. What are the most likely causes?</summary>

  **Answer:** Two most common causes: (1) **Connection pooling is not routing reads to replicas** — your application is still sending all queries to the primary endpoint. Check connection string and ORM configuration. PgBouncer or RDS Proxy can load balance across replicas. (2) **The reads are not actually I/O bound** — if the bottleneck is CPU (complex queries, sorts, aggregations) or memory (hot data not in buffer pool), more replicas don't help until the hot data fits in the replica's buffer pool. Diagnosis: `EXPLAIN ANALYZE` your slow queries; check replica CPU and buffer hit rate.
  </details>

  <details>
  <summary>Q2: You have a primary + 3 replicas. A user updates their email address and immediately clicks "View Profile." They see their old email. What is happening?</summary>

  **Answer:** Replication lag. The write went to the primary, but the read hit a replica that hasn't yet received the replication event. This is called a read-your-writes consistency violation. Fixes: (1) **Sticky sessions** — route all reads immediately after a write to the primary for N seconds. (2) **Read from primary** — after any user-initiated write, force the next read to go to primary. (3) **Wait for replication** — Postgres supports `synchronous_commit = remote_apply` which waits for replica to apply the write before confirming to client. (4) **Client-side caching** — cache the new value in browser/session so the UI shows it without re-fetching.
  </details>

  <details>
  <summary>Q3: At what point does adding more read replicas stop helping?</summary>

  **Answer:** When the bottleneck shifts to the primary. Every replica must replicate from the primary — this consumes primary I/O bandwidth. At high replica counts (typically 10+), the replication stream itself saturates primary disk I/O. Also: if write volume is high, replicas spend most of their time applying WAL (write-ahead log) and are perpetually lagging — reads from these replicas are always stale. At this point, you need to shard (split data across multiple primaries) not just replicate. Real-world threshold: Instagram sharded Postgres when they hit ~12 replicas per primary and replication lag exceeded 60 seconds under peak write load.
  </details>
  ```

- [ ] **Step 3: Commit both**
  ```bash
  git add docs-site/content/04-messaging/concepts/message-queue-basics.md \
    docs-site/content/06-scalability/concepts/database-read-scaling.md
  git commit -m "feat(quiz): add 3 application questions to message-queue-basics and database-read-scaling"
  ```

---

## Coordinator: Merge Protocol

After all Wave 1 agents complete:

- [ ] Review each worktree branch for file conflicts (there should be none — all agents touch different files)
- [ ] Merge in order: C → B → D → E → A
- [ ] Run `cd docs-site && npm run build` to verify no broken MDX syntax
- [ ] Fix any build errors before dispatching Wave 2
- [ ] Dispatch Agent F (Wave 2)
- [ ] After Agent F merges: run final build + `pm2 restart system-design`

---

---

## Agent G: Interview Integration — Cross-Conceptual Questions & Concept References

**Worktree:** `agent-interview-sync`
**Modifies:** 5 question bank files — appends new questions + fills empty Concept Reference sections
**Creates:** Nothing new — all target files already exist
**Does NOT touch:** Any fast-path articles, cheat sheets, POC files, or _meta.js files

### The Two Problems to Fix

**Problem 1 — Empty Concept References:** Every question in the bank ends with `### Concept Reference` but the link is missing. Learners finishing a question have no path back to the conceptual article that explains the underlying theory.

**Problem 2 — No Synthesis Questions:** Every existing question tests one concept in isolation. No question requires connecting two or more concepts simultaneously. Synthesis is exactly what interviewers test at senior level ("How does your caching strategy interact with your CAP choice?") and what learners need to develop long-term retention through concept linking.

### Files Modified:
1. `docs-site/content/12-interview-prep/question-bank/caching-performance/cache-stampede-thundering-herd.md`
2. `docs-site/content/12-interview-prep/question-bank/caching-performance/write-behind-write-through.md`
3. `docs-site/content/12-interview-prep/question-bank/databases/database-sharding-deep-dive.md`
4. `docs-site/content/12-interview-prep/question-bank/distributed-systems/cap-theorem-real-world.md`
5. `docs-site/content/12-interview-prep/question-bank/distributed-systems/vector-clocks.md`

---

### Task G-1: Read Before Writing

- [ ] **Step 1: Read the question format from one existing complete question**

  Read `docs-site/content/12-interview-prep/question-bank/caching-performance/cache-stampede-thundering-herd.md` fully.

  Internalize the format:
  - `## QN: [Title]`
  - `**Role:** ... | **Difficulty:** ... | **Priority:** ... | **Format:** ...`
  - `> **What the interviewer is testing:** ...`
  - `### Answer in 60 seconds` (bullet list)
  - `### Diagram` (Mermaid)
  - `### Pitfalls` (❌ bullets)
  - `### Concept Reference` (currently empty — you will fill this)

  All new synthesis questions must follow this format exactly.

- [ ] **Step 2: Understand what "synthesis question" means**

  A synthesis question requires the learner to hold two or more concepts in mind simultaneously and reason about their interaction. Examples of concept pairs to bridge:

  | Concept A | Concept B | Synthesis question angle |
  |-----------|-----------|--------------------------|
  | Cache stampede | CAP theorem | Network partition → cache node loss → stampede cascade |
  | Write-through caching | Consistency models | Write-through is a CP choice — what does that mean for availability? |
  | Consistent hashing | Sharding hotspots | Virtual nodes don't solve data skew — what does? |
  | CAP theorem | Message queues | Which CAP choice does Kafka make and why? |
  | Vector clocks | Conflict resolution | When clocks diverge, who decides the winner? |

---

### Task G-2: Fix Concept References in All 5 Files

For each file, find every occurrence of `### Concept Reference` followed by an empty line or just a link stub, and replace with the correct link.

**Do this before adding any new questions — it's a prerequisite for consistency.**

- [ ] **Step 1: Fix `cache-stampede-thundering-herd.md`**

  Find: every `### Concept Reference` block in the file.

  Replace the empty body under each one with:
  ```markdown
  ### Concept Reference
  → [Caching Fundamentals](../../../02-caching/concepts/caching-fundamentals) — write-through, write-back, eviction policies
  → [Cache Stampede Prevention](../../../02-caching/concepts/cache-stampede-prevention) — XFetch, mutex, background refresh implementations
  ```

- [ ] **Step 2: Fix `write-behind-write-through.md`**

  Replace empty `### Concept Reference` blocks with:
  ```markdown
  ### Concept Reference
  → [Caching Strategies](../../../02-caching/concepts/caching-strategies) — full comparison of write-through, write-around, write-behind
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — write-through is a CP choice; understand why
  ```

- [ ] **Step 3: Fix `database-sharding-deep-dive.md`**

  Replace empty `### Concept Reference` blocks with:
  ```markdown
  ### Concept Reference
  → [Sharding Strategies](../../../01-databases/concepts/sharding-strategies) — range, hash, directory-based with trade-off analysis
  → [Consistent Hashing Deep Dive](../../../06-scalability/concepts/consistent-hashing-deep-dive) — how Cassandra and DynamoDB shard without re-hashing
  → [Database Read Scaling](../../../06-scalability/concepts/database-read-scaling) — try read replicas before sharding
  ```

- [ ] **Step 4: Fix `cap-theorem-real-world.md`**

  Replace empty `### Concept Reference` blocks with:
  ```markdown
  ### Concept Reference
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — CP vs AP decision framework with real system examples
  → [Eventual Consistency Patterns](../../../05-distributed-systems/concepts/eventual-consistency-patterns) — how AP systems reconcile after partition heals
  → [Caching Fundamentals](../../../02-caching/concepts/caching-fundamentals) — AP systems use caching as the consistency buffer
  ```

- [ ] **Step 5: Fix `vector-clocks.md`**

  Replace empty `### Concept Reference` blocks with:
  ```markdown
  ### Concept Reference
  → [Vector Clocks & Logical Time](../../../05-distributed-systems/concepts/vector-clocks-logical-time) — happens-before, concurrent events, Lamport clocks comparison
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — vector clocks exist because AP systems need conflict detection
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add \
    docs-site/content/12-interview-prep/question-bank/caching-performance/cache-stampede-thundering-herd.md \
    docs-site/content/12-interview-prep/question-bank/caching-performance/write-behind-write-through.md \
    docs-site/content/12-interview-prep/question-bank/databases/database-sharding-deep-dive.md \
    docs-site/content/12-interview-prep/question-bank/distributed-systems/cap-theorem-real-world.md \
    docs-site/content/12-interview-prep/question-bank/distributed-systems/vector-clocks.md
  git commit -m "fix(interview-bank): fill empty Concept Reference sections in 5 question files"
  ```

---

### Task G-3: Add Synthesis Questions to Cache Stampede File

Target file: `docs-site/content/12-interview-prep/question-bank/caching-performance/cache-stampede-thundering-herd.md`

Read the file. Count existing questions. Append the following **after the last existing question**, keeping the same format:

- [ ] **Step 1: Append Synthesis Question G-C1**

  ```markdown
  ---

  ## Q[N+1]: Your Redis cluster loses 2 of 5 nodes due to a network partition. Immediately after, your site experiences a thundering herd. Walk through exactly why and what fails in what order.

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Synthesis (CAP + Caching)

  > **What the interviewer is testing:** Whether you can trace a failure cascade across system layers — from infrastructure event (partition) through data layer (cache) to application behavior (stampede). This requires holding CAP theorem and cache stampede mechanics simultaneously.

  ### Answer in 60 seconds
  - **Step 1 — Partition occurs:** 2 of 5 Redis nodes become unreachable. Your Redis cluster is now in a degraded state. Depending on your cluster config, some key slots are now either unavailable (CP mode) or being served by remaining nodes with potentially stale data (AP mode).
  - **Step 2 — Key eviction cascade:** The 2 lost nodes held ~40% of your keyspace. Those keys are gone. Every request for those keys is now a cache miss — not a TTL expiry miss, a structural miss.
  - **Step 3 — Thundering herd begins:** All concurrent requests for the ~40% missing keys simultaneously hit the database. Unlike a single-key stampede (one popular key expires), this is a multi-key stampede across 40% of your working set. At 50K req/sec, this is ~20K simultaneous DB queries.
  - **Step 4 — Database overwhelmed:** Connection pool exhausted. DB query latency climbs from 5ms to 2 seconds as the queue backs up. Application threads blocking on DB. P99 response time exceeds 30 seconds.
  - **Step 5 — Cascading failure:** HTTP timeouts trigger retries. Retries increase DB load. Circuit breakers (if implemented) trip. Services depending on your service receive 503s.
  - **Prevention:** (1) Redis Cluster with replica promotion — when node fails, replica is promoted within seconds, keys are not lost. (2) Request coalescing at app layer — deduplicate simultaneous misses for the same key before hitting DB. (3) Circuit breaker on DB — shed load intentionally instead of overloading.

  ### Diagram

  ```mermaid
  sequenceDiagram
    participant N as Network
    participant R as Redis Cluster (5 nodes)
    participant A as App Servers
    participant DB as Database

    N->>R: Partition — 2 nodes unreachable
    Note over R: 40% of keyspace lost

    A->>R: GET key_X (MISS — node gone)
    A->>R: GET key_Y (MISS — node gone)
    Note over A: ×20,000 simultaneous misses

    A->>DB: SELECT for key_X
    A->>DB: SELECT for key_Y
    Note over DB: 20K simultaneous queries<br/>Connection pool: EXHAUSTED

    DB-->>A: Timeout after 30s
    A-->>A: Circuit breaker trips
    Note over A: 503 to all callers
  ```

  ### Pitfalls
  - ❌ **"Just add more replicas":** Replicas help with read scale but don't prevent the stampede — the replica must still be promoted before requests route to it. Promotion takes 5-30 seconds. The stampede starts in millisecond 1.
  - ❌ **"Use write-through to repopulate":** Write-through only repopulates keys on write. Read-heavy keys won't be repopulated until they're written again — which may be never.
  - ❌ **Forgetting the retry amplification:** Clients retrying on timeout multiply the DB load. A circuit breaker is mandatory, not optional, at this scale.

  ### Concept Reference
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — the partition is a CAP event; your Redis config's CP vs AP choice determines step 2
  → [Cache Stampede Prevention](../../../02-caching/concepts/cache-stampede-prevention) — the prevention techniques from the single-key case all apply, at 40x scale
  → [High Availability](../../../06-scalability/concepts/high-availability) — Redis Cluster replica promotion is an HA pattern, not a caching pattern
  ```

- [ ] **Step 2: Append Synthesis Question G-C2**

  ```markdown
  ---

  ## Q[N+2]: You're using probabilistic early expiry (XFetch) to prevent stampede. An interviewer asks: "What happens to XFetch when your traffic drops to near-zero overnight?" Explain the failure and the fix.

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P2 | **Format:** Synthesis (Caching + Traffic Patterns)

  > **What the interviewer is testing:** Whether you understand that stampede-prevention techniques have their own failure modes under non-uniform traffic patterns. This is a Staff-level question — it requires identifying second-order effects.

  ### Answer in 60 seconds
  - **How XFetch works (recap):** Before TTL expires, each cache read has a probability of triggering a background refresh proportional to how close the key is to expiry. Formula: refresh if `current_time - ttl_remaining > -beta * delta * ln(rand())`. At high traffic (1000 req/sec), many requests hit the probabilistic check near expiry → early refresh almost certain to happen.
  - **The failure under low traffic:** At near-zero traffic (1 req/min overnight), there may be only 1-2 requests hitting the check window near expiry. With low request count, the probability of any single request triggering the early refresh is low. The TTL expires without anyone triggering the refresh.
  - **Result:** At 9 AM when traffic ramps up rapidly, the key is already expired. The morning traffic spike hits a cold cache exactly when load is spiking. This is a scheduled thundering herd — worst case because it's predictable but often missed.
  - **Fix 1 — Minimum background refresh:** Use a background job that refreshes popular keys regardless of traffic, on a schedule slightly shorter than TTL.
  - **Fix 2 — Traffic-aware beta:** Increase the XFetch `beta` parameter during known low-traffic windows so even rare requests trigger early refresh more aggressively.
  - **Fix 3 — Cache warming:** Before peak hours, pre-warm the cache with an explicit warming pass (not dependent on traffic).

  ### Pitfalls
  - ❌ **"XFetch is always correct":** XFetch is probabilistic — it degrades gracefully under high traffic but fails silently under low traffic. Know the failure mode before using it in production.
  - ❌ **Missing the time-of-day pattern:** The failure is predictable — it happens every morning if your TTLs are < 8 hours. Monitor hit rate at traffic ramp-up, not just at steady state.

  ### Concept Reference
  → [Cache Warming Strategies](../cache-warming-strategies) — pre-warming is the fix for low-traffic cold-start scenarios
  → [Caching Fundamentals](../../../02-caching/concepts/caching-fundamentals) — foundational TTL and eviction model that XFetch extends
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add docs-site/content/12-interview-prep/question-bank/caching-performance/cache-stampede-thundering-herd.md
  git commit -m "feat(interview-bank): add 2 synthesis questions to cache-stampede (CAP + traffic pattern cross-links)"
  ```

---

### Task G-4: Add Synthesis Questions to Database Sharding File

Target file: `docs-site/content/12-interview-prep/question-bank/databases/database-sharding-deep-dive.md`

- [ ] **Step 1: Read the file, count existing questions, append after the last one**

  ```markdown
  ---

  ## Q[N+1]: Your shard key is `user_id` and you're using consistent hashing with 150 virtual nodes per shard. Your top 0.1% of users generate 30% of all writes. Does consistent hashing solve your hotspot problem? What does?

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P0 | **Format:** Synthesis (Sharding + Consistent Hashing + Hotspot)

  > **What the interviewer is testing:** Whether you understand that consistent hashing solves *distribution of keys* across shards, but does NOT solve *skewed write volume* within a shard. These are different problems. Many candidates conflate them.

  ### Answer in 60 seconds
  - **What consistent hashing actually solves:** When you add or remove a shard, only ~1/N of keys need to migrate. It does NOT guarantee that each shard receives equal write volume — it only guarantees that each shard receives approximately equal numbers of keys.
  - **The hotspot is invisible to hashing:** Consistent hashing assigns keys uniformly. But if user_id=42 (a celebrity with 100M followers) generates 30% of all writes, they get assigned to one shard — and that shard receives 30% of total write load regardless of how many virtual nodes you have.
  - **Consistent hashing solves distribution inequality. It cannot solve volume inequality.**
  - **Solutions for write hotspots on a shard:**
    1. **Shard splitting:** Split the hot shard into 2 shards. The celebrity user now lives on one of the two; their writes are still on one shard (not fixed).
    2. **Application-level fan-out:** Write the celebrity's data to multiple shards simultaneously, read from all and merge. Expensive but eliminates the write hotspot.
    3. **Write buffering:** Queue celebrity writes in a message queue, batch-apply to the DB at a controlled rate.
    4. **Separate celebrity tier:** Instagram's approach — detect accounts over a follower threshold and treat them as a special case with dedicated infrastructure.
  - **Detection:** A shard's P99 write latency climbing while others are healthy is the signal. Monitor per-shard write TPS, not just aggregate.

  ### Diagram

  ```mermaid
  graph TD
    A[Write: user_id=42] -->|hash mod N| B[Shard 3]
    C[Write: user_id=9] -->|hash mod N| D[Shard 1]
    E[Write: user_id=17] -->|hash mod N| F[Shard 2]
    G[Write: user_id=42 - 2nd write] -->|hash mod N| B
    H[Write: user_id=42 - 3rd write] -->|hash mod N| B
    B --> I[30% of all writes → CPU 95%]
    D --> J[35% of all writes → CPU 35%]
    F --> K[35% of all writes → CPU 35%]
    style B fill:#f88,stroke:#900
    style I fill:#f88,stroke:#900
  ```

  ### Pitfalls
  - ❌ **"Add more virtual nodes":** Virtual nodes improve key distribution uniformity. They do not change which shard owns user_id=42. The celebrity is still on one shard.
  - ❌ **"Re-shard to spread the load":** Re-sharding moves keys between shards. The celebrity's user_id will land on a different shard after re-sharding — but still only ONE shard. The hotspot follows them.
  - ❌ **Treating this as a rare edge case:** Instagram, Twitter, and Reddit all hit this exact problem with celebrity accounts. Any user-generated-content platform with power-law user distribution will experience this.

  ### Concept Reference
  → [Consistent Hashing Deep Dive](../../../06-scalability/concepts/consistent-hashing-deep-dive) — how the ring works, why it solves re-sharding but not write skew
  → [Sharding Strategies](../../../01-databases/concepts/sharding-strategies) — range vs hash vs directory: which handles celebrity accounts better?
  → [Hot Spot Detection](../../../06-scalability/concepts/hot-spot-detection) — monitoring patterns for detecting per-shard skew before it causes an outage
  ```

- [ ] **Step 2: Append second synthesis question**

  ```markdown
  ---

  ## Q[N+2]: You need to run a query that joins two tables sharded on different keys: `orders` (sharded by `order_id`) and `users` (sharded by `user_id`). The query is "get all orders for user X." What are your options?

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Synthesis (Sharding + Query Design)

  > **What the interviewer is testing:** Whether you understand that sharding breaks SQL's implicit assumption of co-located data. Cross-shard joins are one of the primary hidden costs of sharding, and good candidates enumerate options with trade-offs rather than pretending the problem doesn't exist.

  ### Answer in 60 seconds
  - **The problem:** `orders` are on Shard A (based on order_id). The user's record is on Shard B (based on user_id). A standard SQL JOIN runs at the DB layer — but the DB only sees its own shard, not the other.
  - **Option 1 — Re-shard orders by user_id:** Change the shard key for orders to user_id. Now all orders for user X are on the same shard as user X. This enables the join. Cost: one-time re-sharding migration (expensive, requires dual-write period). Best long-term if this query is your primary access pattern.
  - **Option 2 — Scatter-gather at the application layer:** Query all shards in parallel asking "orders for user_id=X", collect results in the application, join in memory. Works but scales poorly: O(shards) queries per user lookup. At 100 shards, every profile page load makes 100 DB queries.
  - **Option 3 — Denormalization with user_id on the orders table:** Store user_id on every order row. Index it. Scatter-gather on shard key hash of user_id to find the right shard. Reduces to O(1) shard lookup at the cost of data duplication.
  - **Option 4 — Separate read model (CQRS):** Maintain a read-optimized store (e.g. Elasticsearch or a reporting DB) that aggregates orders by user_id. Primary DB stays write-optimized, sharded by order_id. Sync via CDC or event stream.
  - **Interview answer:** Option 1 if you can re-shard. Option 4 if the query is analytics-oriented and eventual consistency is acceptable. Option 3 as a pragmatic middle ground.

  ### Pitfalls
  - ❌ **"Just use a distributed JOIN":** Distributed JOINs exist (CockroachDB, Spanner) but are expensive — they require network round trips to co-locate data before joining. At high QPS this is latency-prohibitive.
  - ❌ **Defaulting to scatter-gather without mentioning the scaling problem:** Scatter-gather is easy to implement but quadratic in cost as you add shards. Mention this trade-off.

  ### Concept Reference
  → [Sharding Strategies](../../../01-databases/concepts/sharding-strategies) — shard key selection is the root cause of cross-shard join problems
  → [Event Sourcing & CQRS](../../distributed-systems/event-sourcing-cqrs) — CQRS is the production-grade answer for cross-shard read queries
  → [Database Read Scaling](../../../06-scalability/concepts/database-read-scaling) — read replicas + separate read model vs sharding trade-offs
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add docs-site/content/12-interview-prep/question-bank/databases/database-sharding-deep-dive.md
  git commit -m "feat(interview-bank): add 2 synthesis questions to database-sharding (hotspot + cross-shard joins)"
  ```

---

### Task G-5: Add Synthesis Questions to CAP Theorem File

Target file: `docs-site/content/12-interview-prep/question-bank/distributed-systems/cap-theorem-real-world.md`

- [ ] **Step 1: Read the file, append after last existing question**

  ```markdown
  ---

  ## Q[N+1]: Kafka claims to be a distributed log. Is Kafka CP or AP? Justify your answer using a real partition scenario.

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Synthesis (CAP + Message Queues)

  > **What the interviewer is testing:** Whether you can apply CAP analysis to systems beyond databases. Most candidates only apply CAP to databases. Real senior engineers apply it to every distributed system they evaluate.

  ### Answer in 60 seconds
  - **Kafka's design choice:** Kafka prioritizes availability (AP) in most default configurations, but can be tuned toward consistency (CP).
  - **Default behavior (AP):** Producers write to the partition leader. If the leader fails, one of the in-sync replicas is elected as the new leader. During the election window (typically 1-30 seconds), the partition is unavailable. However, Kafka accepts writes with `acks=1` (leader only) by default — the leader can acknowledge a write that hasn't reached any replica yet. If that leader crashes before replication, the write is lost. This is an AP trade-off: availability over consistency.
  - **CP mode:** Set `acks=all` (also written `acks=-1`) and `min.insync.replicas=2`. Now a write is only acknowledged after reaching the leader + at least 1 replica. If a network partition means fewer than 2 ISR (in-sync replicas) are reachable, the partition refuses writes — returning an error (unavailability) to maintain consistency. This is CP.
  - **The partition scenario:** 3-broker Kafka cluster, replication factor 3, `min.insync.replicas=2`. Broker 3 falls off the network. Now only 2 of 3 ISR are reachable — the partition continues (2 ≥ min.insync.replicas). Broker 2 also falls off. Now only 1 ISR. With `acks=all` and `min.insync.replicas=2`, the partition rejects all writes. CP — consistency preserved at the cost of availability.
  - **What most candidates miss:** CAP in Kafka is not a global setting — it's per-topic and per-producer. You can have AP topics (audit logs — availability matters, duplicates OK) and CP topics (payment events — no loss acceptable) in the same cluster.

  ### Diagram

  ```mermaid
  graph TD
    P[Producer] -->|acks=all| L[Leader Broker]
    L --> R1[Replica 1]
    L --> R2[Replica 2]
    L -->|write ACK only after| W[min.insync.replicas=2 replicas confirm]

    P2[Producer] -->|acks=1| L2[Leader Broker]
    L2 -->|ACK immediately| P2
    L2 -.->|async| R3[Replica — may lag]

    style W fill:#8f8,stroke:#090
    style R3 fill:#f88,stroke:#900
  ```

  ### Pitfalls
  - ❌ **"Kafka is CP because it has replication":** Replication doesn't determine CP vs AP — the acknowledgment semantics do. With `acks=1`, Kafka is AP (writes acknowledged before durable). With `acks=all`, it's CP (writes blocked until replicated).
  - ❌ **Not mentioning the ISR (in-sync replica) concept:** The ISR list is the mechanism Kafka uses to implement its consistency guarantee. Candidates who say "replicas" without explaining ISR are showing surface knowledge.
  - ❌ **Treating the default as the only mode:** Default Kafka (`acks=1`) is AP. Production Kafka for critical data is CP (`acks=all`, `min.insync.replicas=2`). Always ask about configuration before classifying.

  ### Concept Reference
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — the CP vs AP framework applied to real systems
  → [Message Queue Basics](../../../04-messaging/concepts/message-queue-basics) — how message queues use replication to provide durability guarantees
  → [Kafka Exactly-Once Semantics](../../../04-messaging/concepts/kafka-exactly-once-semantics) — the `acks` and `min.insync.replicas` trade-offs in full detail
  ```

- [ ] **Step 2: Append second synthesis question**

  ```markdown
  ---

  ## Q[N+2]: Your caching layer is Redis Cluster configured as AP (reads allowed from replicas even if lagging). Your application requires that after a user updates their settings, they immediately see the new settings. How do you reconcile these two requirements?

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Synthesis (CAP + Caching + Consistency)

  > **What the interviewer is testing:** Whether you can identify that AP cache + read-your-writes requirement creates a contradiction — and enumerate the engineering options to resolve it without abandoning either the AP cache or the consistency requirement.

  ### Answer in 60 seconds
  - **The contradiction:** AP Redis means reads may return stale data for up to [replication lag] milliseconds after a write. Read-your-writes requires that a read immediately following a write always returns the new value. These are incompatible in pure AP mode.
  - **Option 1 — Route post-write reads to primary:** After any write, route the next N reads for that user to the Redis primary (not a replica). This guarantees read-your-writes for that user. Implement via: store a flag in the session (`wrote_at = timestamp`) and add middleware that routes to primary for 2 seconds after any write. This is what Stripe does.
  - **Option 2 — Write-through with synchronous replication:** Configure Redis with `WAIT 1 100` after each write — blocks until at least 1 replica has applied the write (100ms timeout). This converts AP → CP for writes, at the cost of write latency. Now reads from any replica are guaranteed to have the data.
  - **Option 3 — Client-side cache for recent writes:** Don't re-read from Redis after a write — cache the new value in the application session or browser. For the next 30 seconds, serve the locally-cached value. Zero Redis reads needed for the user's own data.
  - **Option 4 — Invalidate, don't update:** Instead of writing the new value to the replica, invalidate (delete) the key. All replicas will have a miss on next read, which forces a DB read — which returns the latest value. Slightly slower for first post-write read, but guaranteed consistent.
  - **Interview answer:** Option 1 (primary routing) for user-facing settings where the window is short. Option 3 (client cache) for highest performance. Option 4 (invalidation) as the simplest correct implementation.

  ### Pitfalls
  - ❌ **"Just use strong consistency mode":** Redis doesn't have a native strong consistency mode — the `WAIT` command is a pragmatic approximation. It fails if replicas are lagging > timeout.
  - ❌ **Ignoring the problem entirely:** Many candidates say "use Redis cache" without acknowledging that AP + read-your-writes is a contradiction. Naming the tension is the first sign of senior-level thinking.

  ### Concept Reference
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — AP systems can implement read-your-writes at the application layer
  → [Read-Your-Writes Consistency](../../../05-distributed-systems/concepts/read-your-writes-consistency) — the full pattern library for this consistency model
  → [Caching Strategies](../../../02-caching/concepts/caching-strategies) — write-through, write-around, and invalidation are the mechanism options
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add docs-site/content/12-interview-prep/question-bank/distributed-systems/cap-theorem-real-world.md
  git commit -m "feat(interview-bank): add 2 synthesis questions to CAP theorem (Kafka + cache consistency cross-links)"
  ```

---

### Task G-6: Add Synthesis Questions to Write-Behind / Write-Through File

Target file: `docs-site/content/12-interview-prep/question-bank/caching-performance/write-behind-write-through.md`

- [ ] **Step 1: Read the file, append after last existing question**

  ```markdown
  ---

  ## Q[N+1]: You're using write-behind caching (cache accepts write, DB updated asynchronously). Your cache node crashes before flushing the write queue to the DB. What data is lost and how do you prevent it?

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P0 | **Format:** Synthesis (Caching + Durability + Failure Modes)

  > **What the interviewer is testing:** Whether you understand that write-behind's availability benefit comes with an explicit durability trade-off — and whether you can name the prevention strategies that make write-behind production-safe.

  ### Answer in 60 seconds
  - **What is lost:** Every write that was acknowledged to the application but not yet flushed to the DB. If the write queue had 500 writes buffered when the node crashed, all 500 are lost. The application received `200 OK` for each of those writes — the data does not exist in the DB.
  - **This is a CP vs AP trade-off:** Write-behind is an AP choice — you prioritize write availability (fast acknowledgment) at the cost of consistency (the DB may lag behind). Write-through is a CP choice — write is only acknowledged after DB confirms.
  - **Prevention Strategy 1 — Persist the write queue to disk (WAL):** Before acknowledging the write, append it to a Write-Ahead Log on disk. If the cache node crashes, replay the WAL on restart. This is how Redis AOF (Append-Only File) mode works. Adds ~1-3ms overhead per write.
  - **Prevention Strategy 2 — Replicate the write queue:** Use a replicated Redis Cluster. The write queue is replicated to N replicas before acknowledgment. If one node crashes, another takes over and continues flushing. Requires `min.insync.replicas ≥ 2` equivalent configuration.
  - **Prevention Strategy 3 — Accept the loss (acceptable for some use cases):** Analytics counters, view counts, activity feeds — if approximate accuracy is acceptable, losing 500 buffered writes is tolerable. Define an RPO (Recovery Point Objective): "we accept up to 30 seconds of write loss."
  - **Production pattern:** Write-behind with WAL for high-write workloads where eventual consistency is acceptable but data loss is not. Write-through for user-visible data where immediate consistency is required.

  ### Diagram

  ```mermaid
  sequenceDiagram
    participant A as Application
    participant C as Cache (Write-Behind)
    participant Q as Write Queue
    participant DB as Database

    A->>C: WRITE user.settings
    C->>A: ACK (immediate)
    C->>Q: Enqueue write
    Note over Q: 500 writes buffered

    Note over C,Q: ⚠️ Cache node crashes

    Note over Q: 500 writes LOST — DB never updated
    A->>DB: READ user.settings
    DB-->>A: Returns OLD value (stale)
  ```

  ### Pitfalls
  - ❌ **Using write-behind for financial transactions:** Any data where loss is unacceptable (payments, orders, user credentials) must use write-through or synchronous DB writes. Write-behind is for eventually-consistent data.
  - ❌ **Not knowing your RPO:** "We use write-behind" without knowing the maximum acceptable data loss window is a production risk. Define RPO before choosing write-behind.

  ### Concept Reference
  → [Caching Strategies](../../../02-caching/concepts/caching-strategies) — full write strategy comparison with durability trade-offs
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — write-behind is an AP choice; understand the consistency model you're committing to
  → [High Availability](../../../06-scalability/concepts/high-availability) — WAL and replication are HA patterns applied to the write queue
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/12-interview-prep/question-bank/caching-performance/write-behind-write-through.md
  git commit -m "feat(interview-bank): add synthesis question to write-behind (durability + CAP + failure modes)"
  ```

---

### Task G-7: Add Synthesis Questions to Vector Clocks File

Target file: `docs-site/content/12-interview-prep/question-bank/distributed-systems/vector-clocks.md`

- [ ] **Step 1: Read the file, append after last existing question**

  ```markdown
  ---

  ## Q[N+1]: DynamoDB uses vector clocks to detect conflicts but returns ALL conflicting versions to the client for resolution. Why doesn't DynamoDB resolve conflicts automatically using "last write wins"?

  **Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Synthesis (Vector Clocks + CAP + Conflict Resolution)

  > **What the interviewer is testing:** Whether you understand why automatic conflict resolution is a correctness problem, not just a complexity problem. This requires simultaneously understanding vector clocks (detection) and CAP theorem (why conflicts exist in the first place).

  ### Answer in 60 seconds
  - **Why conflicts exist in DynamoDB:** DynamoDB is an AP system. During a network partition, both sides accept writes. When the partition heals, two nodes have different values for the same key — each locally valid, each causally unrelated (concurrent writes). Vector clocks detect that these writes are concurrent (neither happened-before the other).
  - **Why "last write wins" (LWW) is incorrect for many data types:** LWW uses wall-clock timestamps to pick a winner. Problem 1: clock skew. Clocks on different nodes can differ by 1-500ms — the "later" timestamp may actually represent an earlier real-world event. Problem 2: LWW is semantically wrong for some data types. Example: a shopping cart. User A removes item X. User B adds item Y. Both happen concurrently. LWW picks one cart — and silently loses the other change. The user sees either: their removal undone, or their addition lost. Both are wrong.
  - **Why application-level resolution is correct:** Only the application knows what "correct" means for its data type. For a shopping cart, the correct merge is: take the union of both carts (keeps both changes). For a counter, the correct merge is: sum both increments. For a user profile, the correct merge might be: show both versions and ask the user. The DB cannot know this — the application must decide.
  - **Amazon's shopping cart insight:** When DynamoDB returns both conflicting cart versions, the application merges them by union. Result: you occasionally see items in your cart you thought you removed — but you never lose items you added. This is the correct trade-off for a shopping cart (false positive > false negative).
  - **When LWW is acceptable:** Metrics, analytics, and non-collaborative data where the latest value is always more correct than any previous value. Use LWW deliberately, not as a default.

  ### Pitfalls
  - ❌ **"Just use timestamps":** Timestamps are unreliable in distributed systems. Vector clocks exist precisely because timestamps cannot determine causality.
  - ❌ **"The database should resolve this":** If you say this without qualification, it signals you haven't thought about what "correct resolution" means for your data type.
  - ❌ **Not knowing the shopping cart example:** This is the canonical DynamoDB conflict resolution example from Werner Vogels' Dynamo paper. Every Staff-level distributed systems candidate should know it.

  ### Concept Reference
  → [Vector Clocks & Logical Time](../../../05-distributed-systems/concepts/vector-clocks-logical-time) — how happens-before is computed and why concurrent events cannot be ordered
  → [CAP Theorem Practical](../../../05-distributed-systems/concepts/cap-theorem-practical) — conflicts exist because DynamoDB is AP; the conflict resolution is the AP tax
  → [Eventual Consistency Patterns](../../../05-distributed-systems/concepts/eventual-consistency-patterns) — CRDT data types that resolve conflicts automatically without application logic
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add docs-site/content/12-interview-prep/question-bank/distributed-systems/vector-clocks.md
  git commit -m "feat(interview-bank): add synthesis question to vector-clocks (DynamoDB conflict resolution + CAP)"
  ```

---

## WAVE 2 (UPDATED)

---

## Agent F: Quiz Sections + Interview Bank Links (UPDATED SCOPE)

**Worktree:** `agent-quizzes`
**Prerequisite:** Wave 1 fully merged (especially Agent G — question bank now has synthesis questions and filled Concept References)
**Two responsibilities per article:**
  1. Append 3-question quiz section (as originally planned)
  2. Append "Go Deeper in the Interview Bank" block with direct links to specific question files

**Updated Files:**
Same 5 articles as before, but each now gets both a quiz section AND an interview bank link block.

---

### Task F-0: Understand the "Go Deeper" Block Format

After the 3-question quiz on each article, append this block:

```markdown
---

## 📚 Ready for Interview Level?

You just tested your understanding with 3 application questions. The interview versions are harder — they require connecting this concept with 2-3 others simultaneously.

**Curated questions from the interview bank (do these in order):**

| Question | Tests | Level |
|----------|-------|-------|
| [Title of Q](link/to/question/file#Q1) | What the question tests in 10 words | 🟡 Mid |
| [Title of Q](link/to/question/file#Q2) | What the question tests | 🔴 Senior |
| [Title of Q (synthesis)](link/to/question/file#QN) | Cross-concept: names the two concepts being bridged | ⚫ Staff |

> The synthesis question (marked ⚫) requires knowing this article AND [linked concept]. Do that article first if you haven't.
```

The exact links for each article:

| Fast-Path Article | Go-Deeper Links |
|-------------------|-----------------|
| `caching-fundamentals` | `caching-performance/cache-stampede-thundering-herd`, `caching-performance/write-behind-write-through`, `caching-performance/cache-invalidation-strategies` |
| `cap-theorem-practical` | `distributed-systems/cap-theorem-real-world`, `distributed-systems/partition-tolerance`, `distributed-systems/vector-clocks` |
| `consistent-hashing-deep-dive` | `databases/database-sharding-deep-dive` (specifically the Q[N+1] synthesis question about hotspots added by Agent G) |
| `message-queue-basics` | `distributed-systems/idempotency-at-scale`, `distributed-systems/saga-pattern`, `distributed-systems/event-sourcing-cqrs` |
| `database-read-scaling` | `databases/database-replication-patterns`, `databases/database-sharding-deep-dive` (Q[N+2] cross-shard joins) |

---

### Task F-1 through F-5: Same content as original plan, PLUS

At the end of each article's new quiz section, append the corresponding "Go Deeper" block using the table above. The quiz content itself is unchanged from the original plan.

The "Go Deeper" block for `caching-fundamentals` specifically:

```markdown
---

## 📚 Ready for Interview Level?

You just tested your understanding with 3 application questions. The interview versions are harder — they require connecting caching with CAP theorem, failure cascades, and traffic patterns simultaneously.

**Curated questions from the interview bank (do these in order):**

| Question | Tests | Level |
|----------|-------|-------|
| [What are the 3 main techniques to prevent cache stampede?](../../12-interview-prep/question-bank/caching-performance/cache-stampede-thundering-herd) | Prevention options with context-appropriate selection | 🟡 Mid |
| [Write-behind node crash: what data is lost?](../../12-interview-prep/question-bank/caching-performance/write-behind-write-through) | Durability trade-offs of async writes | 🔴 Senior |
| [Redis partition → thundering herd cascade](../../12-interview-prep/question-bank/caching-performance/cache-stampede-thundering-herd) | Cross-concept: CAP + caching failure cascade | ⚫ Staff |

> The Staff question requires knowing CAP theorem. Read [CAP Theorem Practical](../../05-distributed-systems/concepts/cap-theorem-practical) first if you haven't.
```

Adapt this pattern for each of the other 4 articles.

---

## Self-Review Against Brainstorm

**Spec coverage check:**

| Brainstorm recommendation | Plan task | Covered? |
|---|---|---|
| 12-article fast path page | Agent A Task A-1 | ✅ |
| Narrative "your story" entry | Agent A Task A-2 | ✅ |
| Reading time on fast-path articles | Agent B | ✅ |
| Spaced repetition on cheat sheets | Agent C | ✅ |
| 3-question quizzes + interview bank links | Agent F (updated scope) | ✅ (5 articles × 2 blocks each) |
| Cross-conceptual synthesis interview questions | Agent G | ✅ (9 new questions across 5 files) |
| Empty Concept Reference sections fixed | Agent G Task G-2 | ✅ (5 files, all questions fixed) |
| Distributed systems POCs (feel it break) | Agent D (4 POCs) | ✅ |
| 5 top system design problems | Agent E (5 problems) | ✅ |
| Audio via NotebookLM | Not included | ⚠️ Manual task — no content agent can generate audio |
| Loom walkthroughs | Not included | ⚠️ Manual task — requires screen recording |
| Weekly email setup | Not included | ⚠️ Requires external service (Substack) — outside repo |

**Placeholder scan:** None found. All sections have specific content, exact file paths, and explicit commit commands.

**Scope check:** Each agent has non-overlapping files. Wave 2 depends on Wave 1. No agent edits another agent's files.
