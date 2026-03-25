# Navigation & 404 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 404 pages and broken sidebar navigation across the docs site by adding missing `index` entries to `_meta.js` files and fixing broken link paths in content files.

**Architecture:** All 14 section `_meta.js` files are missing `index` entries — Nextra 4 needs the `index` key listed explicitly to render section landing pages and populate the sidebar. Additionally, `navigation.md` and some concept articles contain hardcoded paths using old conventions (e.g., `/messaging/...` instead of `/04-messaging/...`). All fixes are in `docs-site/content/`.

**Tech Stack:** Nextra 4 (App Router), Next.js 14, MDX, JavaScript `_meta.js` config files

---

## File Map

| File | Change |
|------|--------|
| `content/01-databases/_meta.js` | Add `index` entry |
| `content/02-caching/_meta.js` | Add `index` entry |
| `content/03-redis/_meta.js` | Add `index` entry |
| `content/04-messaging/_meta.js` | Add `index` entry |
| `content/05-distributed-systems/_meta.js` | Add `index` entry |
| `content/06-scalability/_meta.js` | Add `index` entry |
| `content/07-api-design/_meta.js` | Add `index` entry |
| `content/08-security/_meta.js` | Add `index` entry |
| `content/09-observability/_meta.js` | Add `index` entry |
| `content/10-architecture/_meta.js` | Add `index` entry |
| `content/11-real-world/_meta.js` | Add `index` entry |
| `content/13-agent-workflows/_meta.js` | Add `index` entry |
| `content/14-algorithms/_meta.js` | Add `index` entry |
| `content/15-vector-databases/_meta.js` | Add `index` entry |
| `content/cheat-sheets/_meta.js` | Verify `index` entry |
| `content/problems-at-scale/_meta.js` | Verify `index` entry |
| `content/12-interview-prep/_meta.js` | Verify `index` entry |
| `content/navigation.md` | Fix old-style paths |
| Any concept/article files with broken paths | Fix relative/absolute paths |

---

### Task 1: Add `index` entries to all section `_meta.js` files (01–06)

**Files:**
- Modify: `content/01-databases/_meta.js`
- Modify: `content/02-caching/_meta.js`
- Modify: `content/03-redis/_meta.js`
- Modify: `content/04-messaging/_meta.js`
- Modify: `content/05-distributed-systems/_meta.js`
- Modify: `content/06-scalability/_meta.js`

- [ ] **Step 1: Read the current content of each _meta.js**

Read each file to understand its current structure before modifying.

- [ ] **Step 2: Add `index` as the first entry in each `_meta.js`**

For each file, prepend the `index` key before existing entries. Example for `01-databases/_meta.js`:

```js
export default {
  index: "🗄️ Databases",
  concepts: "📖 Concepts",
  "hands-on": "🔬 Hands-On",
  failures: "⚠️ Failure Modes"
}
```

Apply same pattern for 02-caching ("⚡ Caching"), 03-redis ("🔴 Redis"), 04-messaging ("📬 Messaging & Events"), 05-distributed-systems ("⚖️ Distributed Systems"), 06-scalability ("📈 Scalability").

- [ ] **Step 3: Commit**

```bash
git add docs-site/content/01-databases/_meta.js \
        docs-site/content/02-caching/_meta.js \
        docs-site/content/03-redis/_meta.js \
        docs-site/content/04-messaging/_meta.js \
        docs-site/content/05-distributed-systems/_meta.js \
        docs-site/content/06-scalability/_meta.js
git commit -m "fix(nav): Add index entries to section _meta.js files (01-06)"
```

---

### Task 2: Add `index` entries to all section `_meta.js` files (07–15)

**Files:**
- Modify: `content/07-api-design/_meta.js`
- Modify: `content/08-security/_meta.js`
- Modify: `content/09-observability/_meta.js`
- Modify: `content/10-architecture/_meta.js`
- Modify: `content/11-real-world/_meta.js`
- Modify: `content/13-agent-workflows/_meta.js`
- Modify: `content/14-algorithms/_meta.js`
- Modify: `content/15-vector-databases/_meta.js`

- [ ] **Step 1: Read current content of each _meta.js**

Read each file before modifying.

- [ ] **Step 2: Add `index` as first entry in each file**

Emojis to use:
- 07-api-design: "🌐 API Design"
- 08-security: "🔒 Security"
- 09-observability: "📡 Observability"
- 10-architecture: "🏗️ Architecture & Patterns"
- 11-real-world: "🏢 Real-World Systems"
- 13-agent-workflows: "🤖 Agent Workflows"
- 14-algorithms: "🧮 Algorithms"
- 15-vector-databases: "🧠 Vector Databases"

For `13-agent-workflows/_meta.js`, also check if `case-studies` is in the meta (it exists as a directory but may not be listed). Add it if missing:
```js
export default {
  index: "🤖 Agent Workflows",
  concepts: "📖 Concepts",
  "hands-on": "🔬 Hands-On",
  platforms: "🛠️ Platforms",
  failures: "⚠️ Failure Modes",
  "case-studies": "📋 Case Studies"
}
```

- [ ] **Step 3: Commit**

```bash
git add docs-site/content/07-api-design/_meta.js \
        docs-site/content/08-security/_meta.js \
        docs-site/content/09-observability/_meta.js \
        docs-site/content/10-architecture/_meta.js \
        docs-site/content/11-real-world/_meta.js \
        docs-site/content/13-agent-workflows/_meta.js \
        docs-site/content/14-algorithms/_meta.js \
        docs-site/content/15-vector-databases/_meta.js
git commit -m "fix(nav): Add index entries to section _meta.js files (07-15)"
```

---

### Task 3: Verify and fix problems-at-scale, cheat-sheets, 12-interview-prep meta files

**Files:**
- Read/Modify: `content/problems-at-scale/_meta.js`
- Read/Modify: `content/cheat-sheets/_meta.js`
- Read/Modify: `content/12-interview-prep/_meta.js`

- [ ] **Step 1: Read all three files**

Check each for an `index` key. If missing, add it first.

- [ ] **Step 2: Fix any missing index entries**

`problems-at-scale/_meta.js` — add `index: "🔥 Problems at Scale"` if missing
`cheat-sheets/_meta.js` — add `index: "⚡ Cheat Sheets"` if missing
`12-interview-prep/_meta.js` — add `index: "🎯 Interview Prep"` if missing

- [ ] **Step 3: Verify subsection _meta.js files for 12-interview-prep**

Check and fix:
- `content/12-interview-prep/system-design/_meta.js` — verify `overview` entry
- `content/12-interview-prep/quick-reference/_meta.js` — verify `overview` entry
- For each sub-subdirectory (fundamentals, messaging-and-streaming, etc.), verify `overview` entry in `_meta.js`

- [ ] **Step 4: Commit**

```bash
git add docs-site/content/problems-at-scale/_meta.js \
        docs-site/content/cheat-sheets/_meta.js \
        docs-site/content/12-interview-prep/_meta.js
git add docs-site/content/12-interview-prep/
git commit -m "fix(nav): Add index entries to problems-at-scale, cheat-sheets, interview-prep meta files"
```

---

### Task 4: Fix broken links in navigation.md

**Files:**
- Modify: `content/navigation.md`

- [ ] **Step 1: Read navigation.md fully**

The file contains navigation links. Look for any links using paths without the numbered prefix (e.g., `/databases/`, `/caching/`, `/messaging/`, `/security/`, `/api-design/`, `/observability/`, `/architecture/`).

- [ ] **Step 2: Fix all broken path references**

Replace old-style paths:
- `/databases/` → `/01-databases/`
- `/caching/` → `/02-caching/`
- `/redis/` → `/03-redis/`
- `/messaging/` → `/04-messaging/`
- `/distributed-systems/` → `/05-distributed-systems/`
- `/scalability/` → `/06-scalability/`
- `/api-design/` → `/07-api-design/`
- `/security/` → `/08-security/`
- `/observability/` → `/09-observability/`
- `/architecture/` → `/10-architecture/`
- `/real-world/` → `/11-real-world/`
- Also verify links to `12-interview-prep/security-encryption/` — this directory may not exist under that path (check vs `12-interview-prep/quick-reference/security/`)

- [ ] **Step 3: Commit**

```bash
git add docs-site/content/navigation.md
git commit -m "fix(links): Fix broken section paths in navigation.md"
```

---

### Task 5: Scan concept/article files for broken cross-links and fix them

**Files:**
- Various `.md` files in `content/06-scalability/concepts/`, `content/10-architecture/failures/`, `content/08-security/concepts/`

- [ ] **Step 1: Find all files with broken path references**

Run this to find files that reference old-style paths in frontmatter or markdown links:
```bash
grep -rn "system-design/databases\|system-design/caching\|system-design/messaging\|system-design/security\|system-design/api-design" \
  docs-site/content --include="*.md" | grep -v "^Binary"
```

- [ ] **Step 2: Fix each found file**

For files with `related:` frontmatter arrays using paths like `system-design/databases/sharding-strategies`, update to use the correct path format: `01-databases/concepts/sharding-strategies` (relative within the content directory).

For inline markdown links like `[Sharding](../databases/scaling.md)`, update to correct relative paths: `[Sharding](../../01-databases/concepts/sharding-strategies)` or use absolute paths like `/01-databases/concepts/sharding-strategies`.

- [ ] **Step 3: Commit**

```bash
git add docs-site/content/
git commit -m "fix(links): Fix broken cross-reference paths in concept articles"
```

---

### Task 6: Verify the 00-start-here and problems-at-scale sections load correctly

**Files:**
- Read: `content/00-start-here/_meta.js` and `content/00-start-here/index.md` (if exists)
- Read: `content/problems-at-scale/_meta.js` and subdirectory `_meta.js` files

- [ ] **Step 1: Check 00-start-here for missing index**

`00-start-here/_meta.js` currently has:
```js
export default {
  "learning-paths": "Learning Paths",
  "back-of-envelope": "Back-of-Envelope Estimation"
}
```

If there is no `index.md` in `00-start-here/`, add one with a brief landing page. If one exists but isn't listed in `_meta.js`, add `index: "🚀 Start Here"` as first entry.

- [ ] **Step 2: Check problems-at-scale subsections**

For each subdirectory (availability, concurrency, consistency, cost-optimization, data-integrity, performance, scalability), verify the `_meta.js` has an `overview` entry and the `overview.md` file exists. Create any missing `overview.md` stubs.

Missing `overview.md` stub template:
```markdown
# [Section] Overview

Brief description of this category of problems.

## Problems in This Section

[Links to individual problem articles]
```

- [ ] **Step 3: Commit**

```bash
git add docs-site/content/00-start-here/ docs-site/content/problems-at-scale/
git commit -m "fix(nav): Fix 00-start-here and problems-at-scale section navigation"
```

---

### Task 7: Final verification

- [ ] **Step 1: Verify no more broken path patterns**

```bash
grep -rn "\"system-design/" docs-site/content --include="*.md" | grep -v "CONTEXT\|KNOWLEDGE" | head -20
```

- [ ] **Step 2: Check all _meta.js files have index entries**

```bash
for f in $(find docs-site/content -maxdepth 2 -name "_meta.js"); do
  echo "=== $f ===" && cat "$f"
done
```

- [ ] **Step 3: Final commit if any last fixes**

```bash
git add docs-site/content/
git commit -m "fix(nav): Final navigation and link fixes"
```
