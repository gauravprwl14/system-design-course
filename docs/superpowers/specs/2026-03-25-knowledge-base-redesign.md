# Knowledge Base Navigation & Structure Redesign
**Date**: 2026-03-25
**Status**: Approved by user
**Branch**: upgrade/nextra-4

---

## 1. Problem Statement

The docs-site has ~698 navigable content files (plus ~90 CONTEXT.md metadata files) across 15 topic sections and strong content quality (85%+ Mermaid coverage, two-depth article format, cross-linked knowledge graph). However:

- **All 15 topic sections are hidden** (`display: 'hidden'`) in `_meta.js` — users cannot discover what exists
- **No consistent index page pattern** — only `01-databases` has the full Topic Map table; other sections are inconsistent
- **No persona-based entry point** — the home page doesn't guide Junior vs Senior vs Interview-prepping users
- **AI Agents is buried** as "Agent Workflows" despite being the most trending topic
- **Legacy sections** (`interview-prep`, `system-design`) clutter the nav
- **One broken link** in `theme.config.jsx` banner (`/get-started` missing `/system-design` basePath prefix)
- **`ai-and-agents` duplicate files** — both `index.md` and `overview.md` exist, causing sidebar duplication

---

## 2. Goals

1. Make all 15 topic sections discoverable via a clean 4-pillar sidebar
2. Give every topic a consistent index page with "Navigate by Role" + "Topic Map" tables
3. Surface AI Agents as the hero/flagship section with a 3-stage learning progression
4. Create a visual home page that routes users by persona
5. Clean up legacy nav and fix known broken links
6. Preserve all existing content, URL structure, sub-section patterns, and frontmatter conventions

---

## 3. Non-Goals

- Moving or renaming any content files
- Changing the `concepts / hands-on / failures` sub-section structure
- Modifying article content, frontmatter, or the knowledge graph
- Redesigning the Nextra theme or adding custom React components
- Rewriting existing articles

---

## 4. Information Architecture

### 4.1 Top-Level Navigation: 4-Pillar Structure

The root `_meta.js` changes from hiding all topics to grouping them under 4 pillar separators:

```
🚀 Start Here                          (standalone page)
── 🏗️ FOUNDATIONS ──────────────────────────────────────
  🗄️  Databases
  ⚡  Caching
  🔴  Redis
  📬  Messaging & Events
  ⚖️  Distributed Systems
── 🚀 PRODUCTION SYSTEMS ───────────────────────────────
  📈  Scalability
  🌐  API Design
  🔒  Security
  📡  Observability
  🏗️  Architecture & Patterns
── 🤖 AI & MODERN SYSTEMS ──────────────────────────────
  🤖  AI Agents                        (was "Agent Workflows")
  🧠  Vector Databases
  🧮  Algorithms
── 🎯 PREP & REFERENCE ─────────────────────────────────
  🔥  Problems at Scale
  🎯  Interview Questions
  🏢  Real-World Case Studies          (was hidden)
  ⚡  Cheat Sheets
```

**Implementation**: Nextra 4 supports `type: 'separator'` entries in `_meta.js`. No folder renames — only display title updates for `13-agent-workflows` → "AI Agents" and `11-real-world` promoted to visible.

**Exact `_meta.js` separator syntax for Nextra 4:**

```js
export default {
  index: { title: 'Home', type: 'page' },
  'get-started': { title: '🚀 Get Started', type: 'page' },

  '_sep_foundations': { type: 'separator', title: '🏗️ Foundations' },
  '01-databases': { title: '🗄️ Databases' },
  // ...

  '_sep_production': { type: 'separator', title: '🚀 Production Systems' },
  '06-scalability': { title: '📈 Scalability' },
  // ...

  '_sep_ai': { type: 'separator', title: '🤖 AI & Modern Systems' },
  '13-agent-workflows': { title: '🤖 AI Agents' },
  // ...

  '_sep_prep': { type: 'separator', title: '🎯 Prep & Reference' },
  'problems-at-scale': { title: '🔥 Problems at Scale' },
  // ...
}
```

Separator keys (e.g., `_sep_foundations`) do not map to any folder — they are display-only dividers. Verify this renders correctly in the dev server before proceeding.

### 4.2 Within-Topic Structure (topic-first, mode-second)

Each topic already has `concepts / hands-on / failures` sub-sections. No changes to sub-section structure. The improvement is in the **index page** for each topic.

Sub-sections applied per topic size:

| Sub-section | Required? | Notes |
|-------------|-----------|-------|
| `📖 Concepts` | Yes (all topics) | Theory, two-depth articles |
| `🔬 Hands-On` | Yes (most topics) | POCs with pseudocode |
| `⚠️ Failures` | If content exists | Production failure modes |
| `🎯 Interview Q&A` | If content exists | Questions, FAQ, traps |
| `🏢 Case Studies` | If content exists | Real company implementations |
| `📋 Quick Reference` | Cross-link only | Links to cheat-sheets section |

**Flat sections exempt from sub-section structure:**
- `cheat-sheets` — flat per-domain files, no sub-sections. Its existing index is already well-designed (has Mermaid diagram + "Available Cheat Sheets" table + 5-Minute Checklist). Do not force the standard template onto it.
- `11-real-world` — flat article files, the entire section IS the case study layer. No sub-sections apply.

---

## 5. Standard Topic Index Page Template

Every topic's `index.md` adopts this structure. `01-databases/index.md` is the gold standard — already partially done. Extend to all 15 topic sections.

```markdown
# [Topic Name]

[One-line description]. [Quick stats: X concepts, Y hands-on, Z interview questions.]

[Mermaid section-map diagram — 5-8 nodes, showing subsections and key articles]

## Navigate by Role

| I am...                | Start here              | Goal                           |
|------------------------|-------------------------|--------------------------------|
| 🟢 Junior              | [First concept link]    | Understand the fundamentals    |
| 🟡 Mid-level           | [Intermediate link]     | Use confidently in designs     |
| 🔴 Senior / TL         | [Advanced link]         | Know failure modes & trade-offs|
| 🏆 Interview prepping  | [Interview Q link]      | Ace the system design round    |

## Topic Map

| Topic      | 📖 Concept | 🔬 Hands-On | ⚠️ Failures | 🎯 Interview | 🏢 Case Study |
|------------|-----------|------------|------------|-------------|--------------|
| [subtopic] | [link]    | [link]     | [link]     | [link]      | —            |

## Where to Go Next

→ [Related topic 1]  →  [Related topic 2]  →  [Problems at Scale]
```

**Rules**:
- Topic Map columns only appear when content exists for that column
- Links use relative paths (Nextra handles basePath)
- Mermaid diagrams already exist in most index files — keep them, add tables below
- `01-databases/index.md` already follows this pattern — use as reference

**Flat-section exemptions**: `cheat-sheets` and `11-real-world` do NOT use this template. Their existing index pages are already well-structured for their flat format. Only update them if the existing content is genuinely missing navigation value.

---

## 6. AI Agents: Flagship Section Treatment

### 6.1 Rename Display Title

`13-agent-workflows/_meta.js` first entry: `index: "🤖 AI Agents"` (was "🤖 Agent Workflows").

Root `_meta.js` title: `'🤖 AI Agents'` (was `'🤖 Agent Workflows'`).

### 6.2 Add Interview Q&A Sub-Section

**Do NOT physically move files** from `12-interview-prep/system-design/ai-and-agents/`. Moving files would break all existing internal links (from `12-interview-prep/index.md` and `12-interview-prep/system-design/_meta.js`) without comprehensive redirect handling.

Instead:
- Create `13-agent-workflows/interview/index.md` as a **curated cross-reference page** that lists and links to the existing questions at their current `12-interview-prep/system-design/ai-and-agents/` paths.
- Update `13-agent-workflows/_meta.js` to add `interview: "🎯 Interview Q&A"`.
- The AI Agents section gains a navigation entry to interview content without URL changes.

**Fix the `ai-and-agents` duplicate (separate fix):**
The current state is:
- `index.md` = 2-line stub that redirects to `overview.md`
- `overview.md` = 140+ lines of real content (Topic Map, questions, strategy)

Fix: **Replace the entire contents of `index.md`** (the current file has an MDX `import { redirect }` at line 6 and a hardcoded link to `/overview` at line 10 — both must be removed) **with the full body of `overview.md`**. This is a complete file replacement, not an append or partial edit. Then delete `overview.md`. Also remove the `overview` key from `_meta.js` in that directory. Update `CONTEXT.md` in that directory to remove the stale row for `overview`. The URL `/12-interview-prep/system-design/ai-and-agents` now serves the real content directly instead of redirecting.

**Important**: `index.md` (not `.mdx`) — verify `overview.md` content is plain markdown with no MDX-specific syntax. If it contains JSX or MDX imports, the file extension must match.

### 6.3 3-Stage Learning Progression on Index Page

The existing `13-agent-workflows/index.md` already has a learning path section. Add a prominent stage table at the top:

```markdown
## Your Learning Path

| Stage | Focus | Key Articles | Est. Time |
|-------|-------|--------------|-----------|
| 🟢 Stage 1 — Build First Agent | Core loop, tool use, memory | Concepts 1–4 + Hands-On basics | 2–3 hrs |
| 🟡 Stage 2 — Scale It | Multi-agent, RAG, observability, cost | Concepts 5–25, Platforms | 8–10 hrs |
| 🔴 Stage 3 — Interview Ready | LLM system design questions | Interview Q&A, Case Studies | 3–4 hrs |
```

The existing `from-zero-to-production-agent` article maps to Stage 1. Surface it as the primary entry point.

### 6.4 Topic Map for AI Agents

Extend the standard Topic Map table to cover agent sub-topics:
agent-loop, tool-use, memory, rag, multi-agent, orchestration, observability, safety, cost-control, mcp.

---

## 7. Home Page Redesign

Replace current `index.mdx` with a persona-driven entry point:

```markdown
# System Design Knowledge Base

[Short description — production-grade system design for engineers at every level]

## Who are you?

| I am...                    | My goal                           | Start here                      |
|----------------------------|-----------------------------------|---------------------------------|
| 🟢 Junior engineer          | Learn system design from scratch  | [Learning Paths →]              |
| 🟡 Mid-level engineer       | Fill gaps, go deeper              | [Pick a topic below]            |
| 🔴 Senior / Tech Lead       | Master distributed systems        | [Foundations pillar →]          |
| 🎯 Interview in < 2 weeks   | Fast-track prep for FAANG round   | [Interview Questions →]         |
| 🤖 Building AI systems      | Agents, RAG, LLM architecture     | [AI Agents — Start here →]      |

## 🔥 Start with AI Agents

[→ Build your first agent] [→ Design multi-agent systems] [→ AI interview questions]

## Knowledge Map

[Mermaid diagram: 4 pillars with key topics and arrows showing learning dependencies]

## What's Inside

| Pillar | Topics | Articles | POCs |
|--------|--------|----------|------|
| 🏗️ Foundations | Databases, Caching, Redis, Messaging, Distributed | ~170 | ~90 |
| 🚀 Production Systems | Scalability, API, Security, Observability, Architecture | ~150 | ~45 |
| 🤖 AI & Modern | AI Agents, Vector DBs, Algorithms | ~160 | ~25 |
| 🎯 Prep & Reference | Problems at Scale, Interview Qs, Case Studies, Cheat Sheets | ~220 | — |
```

---

## 8. Specific Fixes

| Issue | Fix | File(s) |
|-------|-----|---------|
| All topics hidden in nav | Remove `display: 'hidden'`, add pillar separators | `content/_meta.js` |
| `ai-and-agents` duplicate files | Merge `overview.md` into `index.md`, remove `overview.md` | `12-interview-prep/system-design/ai-and-agents/` |
| Banner broken link | Change `/get-started` → `/system-design/get-started` | `theme.config.jsx` |
| Legacy sections in nav | Set `display: 'hidden'` on `interview-prep` and `system-design` legacy folders (already done) | `content/_meta.js` |
| Inconsistent topic index pages | Apply standard template to all 15 topic `index.md` files | 15 files |

---

## 9. Files Changed

### Modified
- `docs-site/content/_meta.js` — 4-pillar structure with separators, remove all `display: 'hidden'`
- `docs-site/content/index.mdx` (or `.md`) — persona-driven home page
- `docs-site/content/13-agent-workflows/_meta.js` — rename title to "🤖 AI Agents", add `interview` sub-section entry
- `docs-site/theme.config.jsx` — fix banner href: `/get-started` → `/system-design/get-started`
- `docs-site/content/12-interview-prep/system-design/ai-and-agents/index.md` — replace redirect stub with full content from `overview.md`
- `docs-site/content/12-interview-prep/system-design/ai-and-agents/_meta.js` — remove `overview` entry

**13 numbered topic `index.md` files** (all except `01-databases` which is already done, `11-real-world` handled separately):
  - `02-caching/index.md`, `03-redis/index.md`, `04-messaging/index.md`, `05-distributed-systems/index.md`
  - `06-scalability/index.md`, `07-api-design/index.md`, `08-security/index.md`, `09-observability/index.md`, `10-architecture/index.md`
  - `12-interview-prep/index.md`, `13-agent-workflows/index.md`, `14-algorithms/index.md`, `15-vector-databases/index.md`

**4 additional top-level section `index.md` files** (non-numbered or flat, different treatment):
  - `problems-at-scale/index.md` — add "Navigate by Role" + topic map
  - `00-start-here/index.md` — remove or repoint the existing persona-routing Mermaid (it overlaps with new home page); `learning-paths.md` stays unchanged
  - `11-real-world/index.md` — flat section, exempt from standard template; update only if navigation value is missing
  - `cheat-sheets/index.md` — flat section, exempt from standard template; existing index is well-designed, leave unless gaps found

Total: 1 `_meta.js` root + 4 `_meta.js` section files + 1 home page + 17 topic index files + 1 theme config = **25 files maximum** (some flat-section files may require no changes).

### Created
- `docs-site/content/13-agent-workflows/interview/_meta.js` — interview sub-section navigation
- `docs-site/content/13-agent-workflows/interview/index.md` — curated cross-reference page linking to existing questions at `12-interview-prep/system-design/ai-and-agents/`

### Deleted
- `docs-site/content/12-interview-prep/system-design/ai-and-agents/overview.md` — content promoted into `index.md`; this file becomes redundant

---

## 10. What Does NOT Change

- All article content, frontmatter, difficulty levels, references
- URL paths for all existing articles
- The `concepts / hands-on / failures` sub-section structure
- Two-depth article format (Level 1 surface + Level 2 deep dive)
- Cheat sheets standalone section
- Knowledge graph (`linked_from` arrays, CONTEXT.md files)
- POC content and structure
- Nextra theme, components, next.config.mjs

---

## 11. Success Criteria

1. A first-time visitor can identify their persona and reach relevant content within 2 clicks
2. Every topic section is visible and accessible from the sidebar without any hidden dropdowns
3. Every topic index page has a "Navigate by Role" table and a "Topic Map" table
4. AI Agents section shows a 3-stage learning progression prominently
5. No 404s on any `index.md` directory routes
6. No duplicate sidebar entries in `ai-and-agents`
7. Banner link works correctly with basePath

---

## 12. `00-start-here` and Home Page Relationship

The new home page (`index.mdx`) handles **persona routing**. All links in the new home page must use relative paths or Nextra `<Link>` components — raw markdown href links with absolute paths (e.g., `/01-databases/...`) do NOT automatically receive the `/system-design` basePath prefix. Use relative paths like `./01-databases/concepts/replication-basics` or verify via dev server after writing.

The new home page (`index.mdx`) also handles **persona routing** — it gets users to the right entry point in 1-2 clicks. `00-start-here/learning-paths.md` handles **structured study plans** — week-by-week paths for those who commit to a learning schedule. These are complementary, not overlapping:

- Home page links to `learning-paths.md` for users who want a curriculum
- `00-start-here/index.md` updated only to reference the new home page structure
- `learning-paths.md` itself is **not changed** — it is already well-organized

---

## 13. Implementation Order

1. Fix `_meta.js` root — 4-pillar structure with separators, verify separator syntax in dev server first
2. Fix `theme.config.jsx` banner link (`/get-started` → `/system-design/get-started`)
3. Fix `ai-and-agents` duplicate — promote `overview.md` body into `index.md`, delete `overview.md`, update `_meta.js`
4. Rewrite home page `index.mdx` — persona table + roadmap diagram
5. Update `13-agent-workflows/_meta.js` — add interview sub-section
6. Update `13-agent-workflows/index.md` — stage progression table + topic map
7. Create `13-agent-workflows/interview/` — cross-reference index page
8. Update remaining 13 numbered topic `index.md` files with standard template (skip `01-databases` — done)
9. Update `problems-at-scale/index.md`
10. Spot-check `cheat-sheets` and `11-real-world` index pages — update only if gaps found
11. Build + verify no 404s (`npm run build`), check sidebar renders correctly
