# Article Writing Pattern

Every article in this knowledge base follows a two-depth structure targeting engineers from Junior to Solution Architect level. The same article must serve both audiences: a junior reading for the first time, and a senior preparing for a principal-level design review.

---

## Frontmatter (required)

```yaml
---
title: "Article Title"
layer: concept|poc|problem|case-study|interview-q
section: "path/from/content/root"
difficulty: beginner|intermediate|advanced|senior
tags: [tag1, tag2, tag3]
category: databases|caching|messaging|scalability|security|observability|architecture|algorithms
prerequisites: []   # paths to prerequisite articles (relative from content/)
see_poc: []         # paths to related POC files
related_problems: [] # paths to related problems-at-scale files
case_studies: []    # paths to related case studies
linked_from: []     # populated automatically by /sync-graph — do not fill manually
references:         # external links that informed this article
  - title: "Resource name"
    url: "https://..."
    type: article|video|docs
---
```

### Layer definitions

| Layer | Use when |
|-------|----------|
| `concept` | Teaching a foundational idea (WAL, consistent hashing, MVCC) |
| `poc` | Hands-on runnable implementation |
| `problem` | Real-world failure scenario from problems-at-scale |
| `case-study` | Full system design of a real product (Uber, Netflix, etc.) |
| `interview-q` | Interview question with answer walkthrough |

### Difficulty levels

| Level | Audience |
|-------|----------|
| `beginner` | Junior engineers, interns, students |
| `intermediate` | Mid-level engineers (2-5 years) |
| `advanced` | Senior engineers (5-8 years) |
| `senior` | Staff/Principal/Solution Architects (8+ years) |

---

## Article Structure

Every concept article must have **two explicitly labeled depth levels**. Use the exact headings below so readers can orient themselves and skip to the level they need.

---

### Level 1 — Surface (2-minute read)

> Target audience: Juniors and anyone needing a quick refresher. No assumed knowledge beyond basic programming.

**Required elements:**

1. **One-line definition** — What is this in plain English? Avoid jargon. If you must use a term, define it in the same sentence.

2. **When you need it** — A concrete real-world trigger. Bad: "when your system grows". Good: "when your single PostgreSQL instance handles more than 10,000 writes/sec and P99 write latency exceeds 50ms".

3. **Core concept** — 3-5 bullet points. Each bullet is one complete idea in plain English. No nested bullets at this level.

4. **Simple diagram** — One Mermaid diagram showing the happy path. Keep it to 5-8 nodes. Label edges with data flow direction.

   ```mermaid
   graph TD
     Client[Client] --> LB[Load Balancer]
     LB --> Server1[Server 1]
     LB --> Server2[Server 2]
   ```

5. **Quick decision table** — Two-column table: "Use this when" vs "Don't use this when". Three rows minimum.

   | Use this when | Don't use this when |
   |--------------|---------------------|
   | [condition]  | [counter-condition] |

---

### Level 2 — Deep Dive

> Target audience: Senior engineers, architects, anyone in a principal-level design review or prepping for staff+ interviews.

#### Problem Statement

State the exact problem with numbers. What breaks, when, at what scale? Include a failure scenario.

Example: "At 15,000 writes/sec, a single PostgreSQL primary's WAL generation rate (~750 MB/min) exceeds what most SSD controllers can fsync synchronously. Every COMMIT blocks for 2-8ms waiting for fsync. At P99, this reaches 50-200ms, making the database the system bottleneck."

#### Approach A — [Name] (Simplest / Most Common)

Structure for each approach:

- **How it works** — Narrative explanation (2-4 paragraphs). Explain the mechanism, not just the result.
- **Architecture diagram** (Mermaid) — Show the full flow including failure paths if applicable.
- **Trade-offs table**:

  | Dimension | Value |
  |-----------|-------|
  | Pros | ... |
  | Cons | ... |
  | Best for | ... |
  | Avoid when | ... |

- **Code/pseudocode example** — Use SQL, shell, or language-agnostic pseudocode. Include comments explaining the "why", not just the "what".

#### Approach B — [Name] (More Sophisticated)

Same structure as Approach A.

#### Approach C — [Name] (Production Grade / Most Complex)

Same structure as Approach A.

#### Comparison Table

A single table comparing all approaches across the same dimensions:

| Dimension | Approach A | Approach B | Approach C |
|-----------|-----------|-----------|-----------|
| Throughput | ... | ... | ... |
| Latency | ... | ... | ... |
| Complexity | ... | ... | ... |
| When to use | ... | ... | ... |

#### Production Numbers

Real numbers that a senior engineer should have memorized. Sourced from official docs, engineering blogs, or well-known benchmarks.

- Throughput ceiling for each approach at given hardware
- Latency targets (P50, P95, P99)
- Scale thresholds — when to graduate from Approach A to B to C

Format: "PostgreSQL WAL fsync latency on NVMe SSD: P50 = 0.5ms, P99 = 5ms, P99.9 = 50ms (under write pressure)."

#### How Real Companies Solve This

| Company | Approach | Scale | Key Insight |
|---------|----------|-------|-------------|
| [Company] | [What they use] | [Orders of magnitude] | [The non-obvious thing they did] |

Minimum 3 companies. Use publicly available engineering blog posts. Do not fabricate.

#### Common Mistakes

Numbered list. Each item has three parts:
1. **Mistake name** — what someone does wrong
2. **Why it happens** — the mental model failure
3. **How to avoid** — the correct approach, with a number or benchmark if applicable

Minimum 3 mistakes.

#### Key Takeaways (TL;DR)

3-5 bullet points. These are the things to memorize. Each bullet is one concrete fact or decision rule. A candidate should be able to recite these in an interview.

- Bullet must be specific: "WAL converts N random I/Os to 1 sequential append — 100-1000x faster on HDD, 3-5x on SSD" not "WAL is fast"
- Include at least one number per bullet where applicable

---

## References Section

Required at the end of every article. Use icons to mark media type.

```markdown
## References

> 📺 [Video title](url) — One sentence on what this video covers and why it's worth watching
> 📖 [Blog post title](url) — Engineering blog post or article title, with one sentence summary
> 📚 [Official docs title](url) — Official documentation page
```

Minimum 3 references. Prefer:
- Official PostgreSQL/MySQL/Redis/Kafka docs for database topics
- Company engineering blogs (Stripe, Cloudflare, Meta Engineering, Netflix Tech Blog)
- YouTube talks from systems conferences (VLDB, OSDI, Hydra, PGConf)

---

## Mermaid Diagram Guidelines

- **graph TD** — top-down flow diagrams, happy path
- **sequenceDiagram** — timing-sensitive interactions (replication, two-phase commit, request lifecycle)
- **flowchart TD** — decision trees and branching logic
- **graph LR** — data structure layouts (WAL record anatomy, packet headers)

Label every edge. Use `-->|label|` not just `-->`. Label nodes with quotes for multi-word labels: `A["Node label"]`. Keep node labels short (3-5 words max).

Don't put all complexity in one diagram. One diagram per concept. Complex flows get a diagram per phase.

---

## Writing Style Rules

1. **Every claim needs a number.** "Handles high traffic" → "handles 100k RPS on a single m5.2xlarge". "Slow" → "adds 20-50ms latency".
2. **Plain English in Level 1.** If a junior would need to Google a term to understand the sentence, define it inline or restructure.
3. **Dense in Level 2.** Seniors skip Level 1. Level 2 should be information-dense: minimal fluff, maximum signal.
4. **Real companies.** Prefer citing public engineering blogs over hypothetical examples.
5. **Failure modes are mandatory.** Every production pattern has failure modes. Name them, describe the operational impact, and give the fix.
6. **Observability.** For infrastructure topics, include monitoring queries and alert thresholds.
7. **Configuration matters.** For database/infrastructure topics, include relevant config parameters with recommended values and the rationale.

---

## Post-Writing Checklist

After finishing an article body:

- [ ] Level 1 readable without any Level 2 context (self-contained)
- [ ] At least one Mermaid diagram per depth level
- [ ] At least one comparison table
- [ ] Real company examples with source (engineering blog, talk, or official case study)
- [ ] Production numbers (not "it scales" — actual throughput/latency figures)
- [ ] Common mistakes section (minimum 3)
- [ ] Key Takeaways with at least one number per bullet
- [ ] References section with minimum 3 links
- [ ] Frontmatter fully filled in
- [ ] Run `/generate-cheat-sheet <path>` to update domain cheat sheet
- [ ] Run `/sync-graph` to populate `linked_from` arrays across the graph
