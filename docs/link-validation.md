# Link Validation — Developer Guide

This guide explains the three-layer link validation system wired into this repo, why broken links happen, and how to catch them before they reach production.

---

## Why links break

### `_meta.js` key must match filename exactly

Every directory under `docs-site/content/` has a `_meta.js` file that controls sidebar order and labels. The key in that file must match the `.md` filename exactly (without the extension).

```js
// _meta.js
export default {
  "offline-first-sync": "Offline-First Sync",  // expects offline-first-sync.md
}
```

If the file is named `offline-first-sync-patterns.md` but the key is `"offline-first-sync"`, the sidebar entry will 404.

### Root-relative links must match the content path

Links written as `/01-databases/concepts/foo` in a markdown article must resolve to `docs-site/content/01-databases/concepts/foo.md`. If that file is moved or renamed, every link pointing to it breaks silently.

### Renaming a file without updating `_meta.js` breaks the sidebar

Moving `offline-first-sync.md` to `sync-patterns.md` without also updating the `_meta.js` key from `"offline-first-sync"` to `"sync-patterns"` will break the sidebar navigation entry for that page.

---

## Three validation layers

### Layer 1 — Pre-commit (fastest, optional)

**Tool**: `.claude/scripts/validate-links.mjs`
**When**: On every `git commit`, before the commit is created
**What it checks**: Internal markdown links + `_meta.js` key/filename alignment
**Speed**: Seconds — no server needed
**Setup**: Manual (see installation instructions below)

This is the earliest catch. It runs statically against the filesystem so it requires no running server. Because it is optional (not enforced by default), developers must install the hook themselves.

### Layer 2 — Pre-build (automatic)

**Tool**: `.claude/scripts/validate-links.mjs` (same script as layer 1)
**When**: Automatically before every `npm run build`
**What it checks**: Same static checks — internal links + `_meta.js` consistency
**Speed**: Seconds — fast fail, no wasted build time
**Enforcement**: Built into `package.json` as a `prebuild` script — runs automatically, no opt-in required

This is the primary enforcement mechanism. Without it, a bad link would only surface after a full Next.js build (~8 minutes), deep in pagefind output or a 404 after deploy. With it, the build fails immediately with a clear error message.

### Layer 3 — Runtime crawl (most thorough)

**Tool**: `.claude/scripts/crawl-links.mjs`
**When**: Manually — against a running local dev server or the production URL
**What it checks**: Every link on every rendered page, including dynamically generated ones, by crawling the live HTTP responses
**Speed**: Minutes — depends on number of pages
**Enforcement**: Manual — run before or after a deploy

This catches things static analysis cannot: links inside MDX components, links that are constructed dynamically, and cases where a page renders but its internal navigation is broken. It also validates external links if configured to do so.

---

## How to run each layer

### Layer 1 — Static check only (no server needed)

```bash
cd docs-site && npm run validate-links
```

### Layer 2 — Full build (validates then builds)

```bash
cd docs-site && npm run build
```

`validate-links` runs automatically as a `prebuild` step. If it finds errors the build stops immediately.

### Layer 3 — Runtime crawl against local dev server

Run these in two separate terminals:

```bash
# Terminal 1 — start the dev server
cd docs-site && npm run dev

# Terminal 2 — run the crawler
cd docs-site && npm run check-links
```

### Layer 3 — Runtime crawl against production

```bash
LINK_CHECK_AUTH="username:password" npm run check-links:prod
```

The production URL defaults to `https://rnd.blr0.geekydev.com/system-design`. Override it with `LINK_CHECK_URL` if needed:

```bash
LINK_CHECK_URL="https://staging.example.com/system-design" LINK_CHECK_AUTH="user:pass" npm run check-links:prod
```

---

## Installing the pre-commit hook

The hook ships as a script in `.claude/hooks/`. Copy it into the git hooks directory to activate it:

```bash
cp .claude/hooks/pre-commit-validate-links.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

After this, every `git commit` will run the static link validator. If it finds broken links the commit is aborted and the errors are printed to the terminal.

To bypass in an emergency (not recommended):

```bash
git commit --no-verify -m "your message"
```

---

## Local vs Production differences

| | Local | Production |
|--|-------|-----------|
| URL | `http://localhost:3000/system-design` | `https://rnd.blr0.geekydev.com/system-design` |
| Auth | None | HTTP Basic Auth — set `LINK_CHECK_AUTH=user:pass` |
| basePath | `/system-design` (same) | `/system-design` (same) |
| When to run | During development | Before and after deploy |

The `basePath` is identical in both environments because the Next.js config sets `basePath: '/system-design'` and the nginx proxy passes `/system-design/` to the Next.js server on port 3001.

---

## Common broken link patterns to watch for

### 1. Creating a file but forgetting to add it to `_meta.js`

The page is reachable by direct URL but does not appear in the sidebar. Users following the sidebar navigation will never find it.

Fix: always add a key to the sibling `_meta.js` immediately after creating a new `.md` file.

### 2. Adding a key to `_meta.js` but misspelling the filename

The sidebar shows the entry, but clicking it produces a 404. This is the most common cause of the `_meta.js` key / filename mismatch error.

Fix: double-check spelling. The key `"offline-first-sync"` requires the file to be `offline-first-sync.md`, not `offline_first_sync.md` or `offlineFirstSync.md`.

### 3. Copying a link from another article and not updating the path

Cross-article links are often written relative to the article they were copied from. Pasting without updating the path silently points at the wrong file — or a file that does not exist.

Fix: always verify cross-article links resolve to the correct file before committing. Run `npm run validate-links` to catch these.

### 4. Renaming a file without updating links pointing to it

Renaming `write-ahead-log.md` to `wal.md` does not automatically update the twenty other articles that link to it. Each of those links becomes a 404.

Fix: after any rename, search the entire `docs-site/content/` tree for the old filename:

```bash
grep -r "write-ahead-log" docs-site/content/
```

Update every occurrence, then run `npm run validate-links` to confirm.

---

## Script locations

| Script | Path |
|--------|------|
| Static validator | `.claude/scripts/validate-links.mjs` |
| Runtime crawler | `.claude/scripts/crawl-links.mjs` |
| Pre-commit hook | `.claude/hooks/pre-commit-validate-links.sh` |
