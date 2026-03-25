---
name: generate-cheat-sheet
description: Generate or update a cheat sheet entry for an article or topic. Usage: /generate-cheat-sheet [article-path-or-topic]. Reads the source article, extracts key numbers/decisions/traps, and appends a dense entry to the correct cheat sheet file.
---

# /generate-cheat-sheet

Generate a dense, scannable cheat sheet entry from a source article and add it to the correct domain cheat sheet in `docs-site/pages/cheat-sheets/`.

## Usage

```
/generate-cheat-sheet <article-path-or-topic>
```

Examples:
- `/generate-cheat-sheet docs-site/pages/12-interview-prep/quick-reference/aws-cloud/vpc-networking.md`
- `/generate-cheat-sheet kinesis`
- `/generate-cheat-sheet system-design/rate-limiting`
- `/generate-cheat-sheet` (no args — prompts to select from recently modified articles)

---

## Steps

### Step 1 — Resolve the source article

**If a full path is given**: read that file directly.

**If a slug or topic name is given**: search for the article:
```bash
find /home/ubuntu/home/project/system-design-course/docs-site/pages -name "*<slug>*" -name "*.md" | head -10
```
Pick the most relevant match and confirm with the user if ambiguous.

**If no args given**: show the 10 most recently modified articles and ask which one:
```bash
git -C /home/ubuntu/home/project/system-design-course log --name-only --pretty=format: -10 -- '*.md' | grep '\.md$' | head -10
```

---

### Step 2 — Determine the target cheat sheet

Use this mapping based on the article's directory path:

| Article is in... | Update cheat sheet |
|---|---|
| `quick-reference/aws-cloud/` | `cheat-sheets/aws.md` |
| `quick-reference/databases/` | `cheat-sheets/databases.md` |
| `quick-reference/caching/` | `cheat-sheets/caching.md` |
| `quick-reference/security/` | `cheat-sheets/security.md` |
| `system-design/` (interview questions) | `cheat-sheets/system-design.md` |
| `01-databases/` or `02-caching/` or `03-redis/` | corresponding domain cheat sheet |
| `04-messaging/` or `05-distributed-systems/` | `cheat-sheets/messaging.md` |
| `06-scalability/` or `10-architecture/` or `problems-at-scale/` | `cheat-sheets/system-design.md` |
| `07-api-design/` or `09-observability/` | `cheat-sheets/networking.md` |
| `08-security/` | `cheat-sheets/security.md` |
| New domain (no matching cheat sheet) | Create `cheat-sheets/<domain>.md` and add to `cheat-sheets/_meta.js` |

All cheat sheet files are in: `docs-site/pages/cheat-sheets/`

---

### Step 3 — Read and extract from the article

Read the source article and extract **only interview-critical content**:

1. **Key numbers** — specific values to memorize (limits, timeouts, costs, throughput)
2. **Decision rules** — "use X when Y, use Z when W" comparisons
3. **Architecture pattern** — the core pattern in ≤ 5 lines
4. **Top traps** — the 1-2 mistakes that trip up candidates
5. **Article link** — relative path from cheat-sheets/ to the article

Skip: general background, history, detailed code walkthroughs — those belong in the full article.

---

### Step 4 — Check for existing entry

Read the target cheat sheet and search for existing content about this topic:
- If an entry already exists → **update it** (don't duplicate)
- If no entry exists → **append** to the most relevant section

To find the right section, scan the cheat sheet's `##` headings and pick the one that best matches the article's domain.

---

### Step 5 — Format the entry

Use this template (adapt as needed — not all fields are required):

```markdown
**[Topic Name]** — [one-line description of what it solves]

| | [Option A] | [Option B] |
|-|-----------|-----------|
| [dimension 1] | [value] | [value] |
| [dimension 2] | [value] | [value] |

- **Key number**: [value] — [what it means]
- **Decision**: Use [A] when [condition] / [B] when [condition]
- **Trap**: [the #1 mistake interviewers catch]
- → [Full article](../path/from/cheat-sheets/to/article)
```

**Scannability rules** (enforce strictly):
- Max 8-10 lines total per entry
- Tables over paragraphs always
- Bold only numbers and decision keywords — not full sentences
- One trap maximum — the most impactful one
- The link must work relative to `docs-site/pages/cheat-sheets/`

---

### Step 6 — Insert into the cheat sheet

Append the entry at the **end of the most relevant `##` section**, before the next `##` heading.

If the cheat sheet has a "## Key Numbers" or "## Common Mistakes" summary section at the end, insert before those.

If this is a new domain and no cheat sheet exists yet:
1. Create `docs-site/pages/cheat-sheets/<domain>.md` with standard frontmatter:
   ```markdown
   ---
   title: "[Domain] Cheat Sheet"
   description: "Quick reference for [domain] — key numbers, decision rules, and interview traps"
   ---

   # [Domain] Cheat Sheet

   > Scan this before an interview. Click links for deep dives.
   ```
2. Add the first section and entry
3. Add to `docs-site/pages/cheat-sheets/_meta.js`

---

### Step 7 — Verify and report

After editing:
1. Show the user the exact entry that was added/updated
2. Show which cheat sheet file was modified and at which section
3. Remind the user to commit:
   ```bash
   git add docs-site/pages/cheat-sheets/
   git commit -m "chore(cheat-sheets): Add [topic] entry to [domain] cheat sheet"
   ```

---

## Quality Checklist

Before finishing, verify the entry:
- [ ] Fits in 8-10 lines max
- [ ] Has at least one bold key number
- [ ] Has at least one decision rule
- [ ] Has at least one trap
- [ ] Has a working relative link to the source article
- [ ] Does not duplicate existing content
- [ ] Uses tables, not paragraphs
- [ ] Is in the right section of the right cheat sheet file
