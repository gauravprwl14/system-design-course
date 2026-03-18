# Knowledge Graph + 3-Layer Context System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform 226 isolated markdown articles into a traversable knowledge graph with typed frontmatter edges, 28 Layer 2 CONTEXT.md routers, a Layer 1 KNOWLEDGE-MAP.md, and .claude/ automation skills that keep the graph in sync.

**Architecture:** Every article gets YAML frontmatter declaring its node type (concept/problem/solution/poc/case-study/interview-q) and typed relationship edges (prerequisites, solves_with, related_problems, case_studies, see_poc). A Node.js sync script reads all forward edges and writes back bidirectional `linked_from` arrays. Three CONTEXT.md files per section act as Layer 2 domain routers under a single KNOWLEDGE-MAP.md Layer 1 master router.

**Tech Stack:** Node.js 24 (ESM), `gray-matter` + `glob` (installed into `.claude/scripts/`), Nextra/MDX for docs site, YAML frontmatter, Mermaid diagrams.

**Spec:** `docs/superpowers/specs/2026-03-16-knowledge-graph-3layer-context-design.md`

---

## Chunk 1: .claude/ Automation Infrastructure

### Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `.claude/scripts/package.json` | Script dependencies (gray-matter, glob) |
| Create | `.claude/scripts/sync-links.mjs` | Core sync engine — rebuilds linked_from + KNOWLEDGE-GRAPH.md |
| Create | `.claude/scripts/lint-graph.mjs` | Validate all frontmatter paths resolve |
| Create | `.claude/scripts/scaffold-article.mjs` | Scaffold new article with correct frontmatter |
| Create | `.claude/scripts/__tests__/sync-links.test.mjs` | Tests for sync engine |
| Create | `.claude/scripts/__tests__/lint-graph.test.mjs` | Tests for linter |
| Create | `.claude/scripts/__tests__/fixtures/concept-article.md` | Test fixture |
| Create | `.claude/scripts/__tests__/fixtures/problem-article.md` | Test fixture |
| Create | `.claude/scripts/__tests__/fixtures/poc-article.md` | Test fixture |
| Create | `.claude/skills/sync-graph/SKILL.md` | /sync-graph slash command |
| Create | `.claude/skills/new-article/SKILL.md` | /new-article slash command |
| Create | `.claude/skills/lint-graph/SKILL.md` | /lint-graph slash command |
| Create | `.claude/skills/gap-analysis/SKILL.md` | /gap-analysis slash command |

---

### Task 1: Script dependencies

- [ ] **Create `.claude/scripts/package.json`**

```json
{
  "name": "knowledge-graph-scripts",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test __tests__/sync-links.test.mjs __tests__/lint-graph.test.mjs",
    "sync": "node sync-links.mjs",
    "lint": "node lint-graph.mjs",
    "scaffold": "node scaffold-article.mjs"
  },
  "dependencies": {
    "glob": "^11.0.0",
    "gray-matter": "^4.0.3"
  }
}
```

- [ ] **Install dependencies**

```bash
cd .claude/scripts && npm install
```

Expected: `node_modules/` created, `package-lock.json` written.

---

### Task 2: Write failing tests for sync-links

- [ ] **Create test fixtures**

`.claude/scripts/__tests__/fixtures/concept-article.md`:
```markdown
---
title: "Caching Fundamentals"
layer: concept
section: system-design/caching
difficulty: beginner
prerequisites: []
solves_with: []
related_problems: []
case_studies: []
see_poc:
  - interview-prep/practice-pocs/cache-aside-pattern
linked_from: []
tags: [caching]
---
# Caching Fundamentals
```

`.claude/scripts/__tests__/fixtures/problem-article.md`:
```markdown
---
title: "Thundering Herd"
layer: problem
section: problems-at-scale/availability
difficulty: advanced
prerequisites:
  - system-design/caching/caching-fundamentals
solves_with:
  - interview-prep/practice-pocs/cache-aside-pattern
related_problems: []
case_studies: []
see_poc: []
linked_from: []
tags: [availability]
---
# Thundering Herd
```

`.claude/scripts/__tests__/fixtures/poc-article.md`:
```markdown
---
title: "Cache-Aside Pattern"
layer: poc
section: interview-prep/practice-pocs
difficulty: intermediate
prerequisites:
  - system-design/caching/caching-fundamentals
solves_with: []
related_problems: []
case_studies: []
see_poc: []
linked_from: []
tags: [caching, redis]
---
# Cache-Aside Pattern POC
```

- [ ] **Create `.claude/scripts/__tests__/sync-links.test.mjs`**

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

// Import functions under test
const { buildAdjacencyMap, computeLinkedFrom, updateLinkedFrom } =
  await import('../sync-links.mjs');

describe('buildAdjacencyMap', () => {
  test('extracts all forward edges from frontmatter', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: {
          prerequisites: [],
          see_poc: ['interview-prep/practice-pocs/cache-aside-pattern'],
          solves_with: [],
          related_problems: [],
          case_studies: [],
        }
      }],
      ['problems-at-scale/availability/thundering-herd', {
        data: {
          prerequisites: ['system-design/caching/caching-fundamentals'],
          solves_with: ['interview-prep/practice-pocs/cache-aside-pattern'],
          related_problems: [],
          case_studies: [],
          see_poc: [],
        }
      }],
    ]);

    const adj = buildAdjacencyMap(nodes);

    assert.deepEqual(
      adj.get('interview-prep/practice-pocs/cache-aside-pattern'),
      new Set([
        'system-design/caching/caching-fundamentals',
        'problems-at-scale/availability/thundering-herd',
      ])
    );
    assert.deepEqual(
      adj.get('system-design/caching/caching-fundamentals'),
      new Set(['problems-at-scale/availability/thundering-herd'])
    );
  });

  test('returns empty map for nodes with no edges', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: { prerequisites: [], see_poc: [], solves_with: [], related_problems: [], case_studies: [] }
      }]
    ]);
    const adj = buildAdjacencyMap(nodes);
    assert.equal(adj.size, 0);
  });
});

describe('computeLinkedFrom', () => {
  test('returns sorted array of files that reference a given key', () => {
    const adj = new Map([
      ['system-design/caching/caching-fundamentals', new Set([
        'problems-at-scale/availability/thundering-herd',
        'interview-prep/system-design/caching-strategies',
      ])]
    ]);
    const result = computeLinkedFrom('system-design/caching/caching-fundamentals', adj);
    assert.deepEqual(result, [
      'interview-prep/system-design/caching-strategies',
      'problems-at-scale/availability/thundering-herd',
    ]);
  });

  test('returns empty array when no files reference this key', () => {
    const adj = new Map();
    const result = computeLinkedFrom('system-design/caching/caching-fundamentals', adj);
    assert.deepEqual(result, []);
  });
});

describe('updateLinkedFrom', () => {
  test('returns true and new content when linked_from changes', () => {
    const content = readFileSync(join(FIXTURES, 'concept-article.md'), 'utf8');
    const incoming = ['problems-at-scale/availability/thundering-herd'];
    const { changed, newContent } = updateLinkedFrom(content, incoming);
    assert.equal(changed, true);
    const parsed = matter(newContent);
    assert.deepEqual(parsed.data.linked_from, incoming);
  });

  test('returns false when linked_from is already correct', () => {
    const raw = readFileSync(join(FIXTURES, 'problem-article.md'), 'utf8');
    // problem-article has linked_from: [] and no one points to it in this fixture set
    const { changed } = updateLinkedFrom(raw, []);
    assert.equal(changed, false);
  });

  test('preserves all other frontmatter fields', () => {
    const content = readFileSync(join(FIXTURES, 'concept-article.md'), 'utf8');
    const { newContent } = updateLinkedFrom(content, ['some/other/file']);
    const parsed = matter(newContent);
    assert.equal(parsed.data.title, 'Caching Fundamentals');
    assert.equal(parsed.data.layer, 'concept');
    assert.deepEqual(parsed.data.see_poc, ['interview-prep/practice-pocs/cache-aside-pattern']);
  });
});
```

- [ ] **Run tests — expect FAIL (functions not yet implemented)**

```bash
cd .claude/scripts && npm test
```

Expected: `ERR_MODULE_NOT_FOUND` or similar — sync-links.mjs not yet exporting these functions.

---

### Task 3: Implement sync-links.mjs

- [ ] **Create `.claude/scripts/sync-links.mjs`**

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../');
const PAGES_DIR = join(REPO_ROOT, 'docs-site/pages');

const EDGE_FIELDS = ['prerequisites', 'solves_with', 'related_problems', 'case_studies', 'see_poc'];

const SKIP_NAMES = new Set([
  'CONTEXT.md', 'KNOWLEDGE-MAP.md', 'KNOWLEDGE-GRAPH.md',
  'README.md', 'index.md', 'index.mdx',
]);

// ─── Pure functions (exported for testing) ────────────────────────────────

/**
 * Build reverse adjacency map: target → Set of sources that point to it.
 * @param {Map<string, {data: object}>} nodes
 * @returns {Map<string, Set<string>>}
 */
export function buildAdjacencyMap(nodes) {
  const adj = new Map();
  for (const [key, node] of nodes) {
    for (const field of EDGE_FIELDS) {
      const targets = node.data[field] || [];
      for (const target of targets) {
        if (!adj.has(target)) adj.set(target, new Set());
        adj.get(target).add(key);
      }
    }
  }
  return adj;
}

/**
 * Get sorted array of files that reference the given key.
 * @param {string} key
 * @param {Map<string, Set<string>>} adj
 * @returns {string[]}
 */
export function computeLinkedFrom(key, adj) {
  return Array.from(adj.get(key) || []).sort();
}

/**
 * Update linked_from in frontmatter if it differs from incoming.
 * Returns { changed, newContent }.
 * @param {string} rawContent - Full file content
 * @param {string[]} incoming - New linked_from values
 * @returns {{ changed: boolean, newContent: string }}
 */
export function updateLinkedFrom(rawContent, incoming) {
  const parsed = matter(rawContent);
  const existing = (parsed.data.linked_from || []).slice().sort();
  const sorted = incoming.slice().sort();
  if (JSON.stringify(existing) === JSON.stringify(sorted)) {
    return { changed: false, newContent: rawContent };
  }
  parsed.data.linked_from = sorted;
  const newContent = matter.stringify(parsed.content, parsed.data);
  return { changed: true, newContent };
}

// ─── Graph generation ──────────────────────────────────────────────────────

function generateKnowledgeGraph(nodes, adj) {
  const byLayer = { concept: [], solution: [], problem: [], poc: [], 'interview-q': [], 'case-study': [] };
  for (const [key, node] of nodes) {
    const layer = node.data.layer || 'concept';
    if (byLayer[layer]) byLayer[layer].push(key);
  }

  const now = new Date().toISOString();
  const totalNodes = nodes.size;
  const totalEdges = Array.from(adj.values()).reduce((s, v) => s + v.size, 0);

  const lines = [
    '# Knowledge Graph',
    '',
    `> Auto-generated by \`/sync-graph\` on ${now}`,
    `> **${totalNodes} nodes** | **${totalEdges} edges**`,
    '',
    '---',
    '',
    '## Stats',
    '',
    '| Layer | Count |',
    '|-------|-------|',
  ];
  for (const [layer, keys] of Object.entries(byLayer)) {
    lines.push(`| ${layer} | ${keys.length} |`);
  }

  // Diagram 1: concept + solution
  lines.push('', '## Diagram 1: Concepts & Solutions', '', '```mermaid', 'graph TD');
  const d1 = [...byLayer.concept, ...byLayer.solution].slice(0, 40);
  for (const key of d1) {
    const id = key.split('/').pop().replace(/-/g, '_');
    lines.push(`  ${id}["${key.split('/').pop()}"]`);
  }
  for (const key of d1) {
    const node = nodes.get(key);
    if (!node) continue;
    const srcId = key.split('/').pop().replace(/-/g, '_');
    for (const target of (node.data.see_poc || [])) {
      if (d1.includes(target)) {
        const tgtId = target.split('/').pop().replace(/-/g, '_');
        lines.push(`  ${srcId} -->|see_poc| ${tgtId}`);
      }
    }
  }
  lines.push('```');

  // Diagram 2: problems
  lines.push('', '## Diagram 2: Problems', '', '```mermaid', 'graph TD');
  const d2 = byLayer.problem.slice(0, 40);
  for (const key of d2) {
    const id = key.split('/').pop().replace(/-/g, '_');
    lines.push(`  ${id}["${key.split('/').pop()}"]`);
  }
  for (const key of d2) {
    const node = nodes.get(key);
    if (!node) continue;
    const srcId = key.split('/').pop().replace(/-/g, '_');
    for (const target of (node.data.related_problems || [])) {
      if (d2.includes(target)) {
        const tgtId = target.split('/').pop().replace(/-/g, '_');
        lines.push(`  ${srcId} -->|related| ${tgtId}`);
      }
    }
  }
  lines.push('```');

  // Diagram 3: poc + interview-q
  lines.push('', '## Diagram 3: POCs & Interview Questions', '', '```mermaid', 'graph TD');
  const d3 = [...byLayer.poc, ...byLayer['interview-q']].slice(0, 40);
  for (const key of d3) {
    const id = key.split('/').pop().replace(/-/g, '_');
    lines.push(`  ${id}["${key.split('/').pop()}"]`);
  }
  lines.push('```');

  // Diagram 4: case-studies
  lines.push('', '## Diagram 4: Case Studies', '', '```mermaid', 'graph TD');
  const d4 = byLayer['case-study'].slice(0, 40);
  for (const key of d4) {
    const id = key.split('/').pop().replace(/-/g, '_');
    lines.push(`  ${id}["${key.split('/').pop()}"]`);
  }
  lines.push('```');

  // Navigation index tables
  lines.push('', '## Navigation Index', '', '### All Nodes by Layer', '');
  for (const [layer, keys] of Object.entries(byLayer)) {
    if (keys.length === 0) continue;
    lines.push(`#### ${layer}`);
    lines.push('| File | Tags |');
    lines.push('|------|------|');
    for (const key of keys.sort()) {
      const tags = (nodes.get(key)?.data?.tags || []).join(', ');
      lines.push(`| ${key} | ${tags} |`);
    }
    lines.push('');
  }

  // Orphan report
  const orphans = [];
  for (const [key, node] of nodes) {
    const hasOut = EDGE_FIELDS.some(f => (node.data[f] || []).length > 0);
    const hasIn = (node.data.linked_from || []).length > 0;
    if (!hasOut && !hasIn) orphans.push(key);
  }
  lines.push('## Orphan Report', '');
  if (orphans.length === 0) {
    lines.push('No orphaned nodes.');
  } else {
    lines.push(`${orphans.length} orphaned nodes (no links in or out):`);
    for (const o of orphans) lines.push(`- ${o}`);
  }

  writeFileSync(join(PAGES_DIR, 'KNOWLEDGE-GRAPH.md'), lines.join('\n') + '\n');
  console.log(`Generated KNOWLEDGE-GRAPH.md (${totalNodes} nodes, ${totalEdges} edges)`);
}

// ─── Gap report ────────────────────────────────────────────────────────────

function printGapReport(nodes) {
  const gaps = {
    conceptNoPoC: [],
    problemNoSolution: [],
    pocNoPrereq: [],
    caseStudyUnreferenced: [],
  };

  const allLinkedFrom = new Set();
  for (const [, node] of nodes) {
    for (const f of (node.data.linked_from || [])) allLinkedFrom.add(f);
  }

  for (const [key, node] of nodes) {
    const layer = node.data.layer;
    if (layer === 'concept' && (node.data.see_poc || []).length === 0) {
      gaps.conceptNoPoC.push(key);
    }
    if (layer === 'problem' && (node.data.solves_with || []).length === 0) {
      gaps.problemNoSolution.push(key);
    }
    if (layer === 'poc' && (node.data.prerequisites || []).length === 0) {
      gaps.pocNoPrereq.push(key);
    }
    if (layer === 'case-study' && !allLinkedFrom.has(key)) {
      gaps.caseStudyUnreferenced.push(key);
    }
  }

  console.log('\n=== GAP REPORT ===');
  console.log(`Concepts with no POC: ${gaps.conceptNoPoC.length}`);
  for (const g of gaps.conceptNoPoC) console.log(`  - ${g}`);
  console.log(`Problems with no solution: ${gaps.problemNoSolution.length}`);
  for (const g of gaps.problemNoSolution) console.log(`  - ${g}`);
  console.log(`POCs with no prerequisites: ${gaps.pocNoPrereq.length}`);
  for (const g of gaps.pocNoPrereq) console.log(`  - ${g}`);
  console.log(`Case studies not referenced: ${gaps.caseStudyUnreferenced.length}`);
  for (const g of gaps.caseStudyUnreferenced) console.log(`  - ${g}`);
}

// ─── Main (only runs when executed directly) ───────────────────────────────

async function main() {
  const patterns = [
    'system-design/**/*.md',
    'interview-prep/**/*.md',
    'problems-at-scale/**/*.md',
  ];

  const filePaths = await glob(patterns, {
    cwd: PAGES_DIR,
    ignore: ['**/database-archival-poc/**'],
  });

  // Filter skip list
  const articlePaths = filePaths.filter(f => {
    const base = f.split('/').pop();
    return !SKIP_NAMES.has(base);
  });

  // Load nodes
  const nodes = new Map();
  for (const relPath of articlePaths) {
    const fullPath = join(PAGES_DIR, relPath);
    const content = readFileSync(fullPath, 'utf8');
    const { data } = matter(content);
    const key = relPath.replace(/\.md$/, '');
    nodes.set(key, { fullPath, data, content });
  }

  console.log(`Found ${nodes.size} article nodes`);

  // Build reverse adjacency map
  const adj = buildAdjacencyMap(nodes);

  // Update linked_from for each file
  let updatedCount = 0;
  for (const [key, node] of nodes) {
    const incoming = computeLinkedFrom(key, adj);
    const { changed, newContent } = updateLinkedFrom(node.content, incoming);
    if (changed) {
      writeFileSync(node.fullPath, newContent);
      updatedCount++;
      // Update in-memory data too
      node.data.linked_from = incoming;
    }
  }

  console.log(`Updated linked_from in ${updatedCount} files`);

  generateKnowledgeGraph(nodes, adj);
  printGapReport(nodes);
}

// Only run main when this file is the entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Run tests — expect PASS**

```bash
cd .claude/scripts && npm test
```

Expected: All tests pass. If `ERR_UNKNOWN_FILE_EXTENSION` — ensure `"type": "module"` is in `package.json`.

---

### Task 4: Write failing tests for lint-graph

- [ ] **Create `.claude/scripts/__tests__/lint-graph.test.mjs`**

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { validateFrontmatterPaths, checkBidirectionalConsistency } =
  await import('../lint-graph.mjs');

describe('validateFrontmatterPaths', () => {
  test('returns no errors when all paths are valid keys in nodes map', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: { prerequisites: [], see_poc: ['interview-prep/practice-pocs/cache-aside-pattern'], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
      ['interview-prep/practice-pocs/cache-aside-pattern', {
        data: { prerequisites: ['system-design/caching/caching-fundamentals'], see_poc: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
    ]);
    const errors = validateFrontmatterPaths(nodes);
    assert.equal(errors.length, 0);
  });

  test('returns errors for paths that do not exist in nodes map', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: { prerequisites: [], see_poc: ['interview-prep/practice-pocs/NONEXISTENT'], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
    ]);
    const errors = validateFrontmatterPaths(nodes);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes('NONEXISTENT'));
  });
});

describe('checkBidirectionalConsistency', () => {
  test('detects when linked_from is stale (missing expected entry)', () => {
    const nodes = new Map([
      ['a/b/concept', {
        data: { see_poc: ['a/b/poc'], prerequisites: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
      ['a/b/poc', {
        data: { prerequisites: [], see_poc: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
        // linked_from should include 'a/b/concept' but doesn't
      }],
    ]);
    const warnings = checkBidirectionalConsistency(nodes);
    assert.ok(warnings.length > 0);
    assert.ok(warnings.some(w => w.includes('a/b/poc')));
  });

  test('no warnings when graph is fully synced', () => {
    const nodes = new Map([
      ['a/b/concept', {
        data: { see_poc: ['a/b/poc'], prerequisites: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
      ['a/b/poc', {
        data: { prerequisites: [], see_poc: [], solves_with: [], related_problems: [], case_studies: [], linked_from: ['a/b/concept'] }
      }],
    ]);
    const warnings = checkBidirectionalConsistency(nodes);
    assert.equal(warnings.length, 0);
  });
});
```

- [ ] **Run tests — expect FAIL**

```bash
cd .claude/scripts && npm test
```

Expected: `ERR_MODULE_NOT_FOUND` for lint-graph.mjs.

---

### Task 5: Implement lint-graph.mjs

- [ ] **Create `.claude/scripts/lint-graph.mjs`**

```javascript
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../');
const PAGES_DIR = join(REPO_ROOT, 'docs-site/pages');

const EDGE_FIELDS = ['prerequisites', 'solves_with', 'related_problems', 'case_studies', 'see_poc'];
const SKIP_NAMES = new Set(['CONTEXT.md', 'KNOWLEDGE-MAP.md', 'KNOWLEDGE-GRAPH.md', 'README.md', 'index.md', 'index.mdx']);

/**
 * Validate that all paths in frontmatter edges exist in the nodes map.
 * @param {Map<string, {data: object}>} nodes
 * @returns {string[]} array of error messages
 */
export function validateFrontmatterPaths(nodes) {
  const errors = [];
  for (const [key, node] of nodes) {
    for (const field of EDGE_FIELDS) {
      for (const target of (node.data[field] || [])) {
        if (!nodes.has(target)) {
          errors.push(`[${key}] ${field}: "${target}" does not resolve to a known article`);
        }
      }
    }
  }
  return errors;
}

/**
 * Check that all linked_from arrays are consistent with forward edges.
 * @param {Map<string, {data: object}>} nodes
 * @returns {string[]} array of warning messages
 */
export function checkBidirectionalConsistency(nodes) {
  const warnings = [];
  // Build expected linked_from from forward edges
  const expected = new Map();
  for (const [key, node] of nodes) {
    for (const field of EDGE_FIELDS) {
      for (const target of (node.data[field] || [])) {
        if (!expected.has(target)) expected.set(target, new Set());
        expected.get(target).add(key);
      }
    }
  }
  // Compare with actual linked_from
  for (const [key, node] of nodes) {
    const actual = new Set(node.data.linked_from || []);
    const exp = expected.get(key) || new Set();
    for (const e of exp) {
      if (!actual.has(e)) {
        warnings.push(`[${key}] linked_from is stale — missing "${e}" (run /sync-graph to fix)`);
      }
    }
  }
  return warnings;
}

async function main() {
  const filePaths = await glob(
    ['system-design/**/*.md', 'interview-prep/**/*.md', 'problems-at-scale/**/*.md'],
    { cwd: PAGES_DIR, ignore: ['**/database-archival-poc/**'] }
  );
  const articlePaths = filePaths.filter(f => !SKIP_NAMES.has(f.split('/').pop()));

  const nodes = new Map();
  for (const relPath of articlePaths) {
    const fullPath = join(PAGES_DIR, relPath);
    const content = readFileSync(fullPath, 'utf8');
    const { data } = matter(content);
    nodes.set(relPath.replace(/\.md$/, ''), { fullPath, data });
  }

  const errors = validateFrontmatterPaths(nodes);
  const warnings = checkBidirectionalConsistency(nodes);

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} broken reference(s):`);
    for (const e of errors) console.error(`  ${e}`);
  }
  if (warnings.length > 0) {
    console.warn(`\n⚠️  ${warnings.length} stale linked_from (run /sync-graph):`);
    for (const w of warnings) console.warn(`  ${w}`);
  }
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Graph is clean — no broken references, no stale linked_from');
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Run tests — expect PASS**

```bash
cd .claude/scripts && npm test
```

Expected: All tests pass.

---

### Task 6: Implement scaffold-article.mjs

No tests needed for the scaffolder — it's a template writer with no logic to unit test.

> **Note on inline YAML comments**: `gray-matter` strips inline YAML comments (e.g., `# beginner | intermediate | advanced`) on write-back. The `difficulty` hint comment in scaffold output is a write-time human hint only — it will not survive the first `/sync-graph` run. This is expected and does not affect data.

- [ ] **Create `.claude/scripts/scaffold-article.mjs`**

```javascript
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../');
const PAGES_DIR = join(REPO_ROOT, 'docs-site/pages');

const TEMPLATES = {
  concept: {
    outgoing: ['see_poc', 'case_studies', 'related_problems'],
    bodyTemplate: `## Problem Statement

What problem does this solve?

## Real-World Context

When do you actually need this? Include traffic numbers.

## Architecture

\`\`\`mermaid
graph TD
  A[Component] --> B[Component]
\`\`\`

## Implementation

\`\`\`javascript
// pseudocode
\`\`\`

## Trade-offs

- ✅ Pros
- ❌ Cons

## Real Examples

How Netflix, Instagram, etc. use this.

## Common Pitfalls

What to avoid.

## Key Takeaways

TL;DR summary.
`
  },
  problem: {
    outgoing: ['prerequisites', 'solves_with', 'related_problems'],
    bodyTemplate: `## The Problem

Describe the failure scenario.

## Why It Happens

Root cause analysis.

## Impact

Business and technical consequences.

## Solutions

\`\`\`mermaid
sequenceDiagram
\`\`\`

## Prevention

How to avoid this in new systems.
`
  },
  poc: {
    outgoing: ['prerequisites', 'related_problems'],
    bodyTemplate: `## What You'll Build

Clear deliverable.

## Why This Matters

Company examples with metrics.

## Setup

\`\`\`bash
docker compose up -d
\`\`\`

## Implementation

\`\`\`javascript
// working code
\`\`\`

## Testing

How to verify it works.

## Extensions

What to try next.
`
  },
  solution: {
    outgoing: ['prerequisites', 'see_poc', 'case_studies'],
    bodyTemplate: `## Overview

What pattern this is and when to use it.

## Implementation

\`\`\`mermaid
graph TD
\`\`\`

## Code Example

\`\`\`javascript
// implementation
\`\`\`

## Trade-offs

## When Not to Use This
`
  },
  'case-study': {
    outgoing: ['prerequisites', 'see_poc'],
    bodyTemplate: `## System Overview

Company and scale context.

## Architecture

\`\`\`mermaid
graph TD
\`\`\`

## Key Design Decisions

## Database Design

## Capacity Estimation

## Trade-offs
`
  },
  'interview-q': {
    outgoing: ['prerequisites', 'see_poc', 'case_studies'],
    bodyTemplate: `## Question

Full interview question.

## Clarifying Questions to Ask

## High-Level Design

\`\`\`mermaid
graph TD
\`\`\`

## Deep Dives

## Trade-offs

## Follow-up Questions
`
  },
};

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildFrontmatter(layer, section, title) {
  const template = TEMPLATES[layer];
  if (!template) throw new Error(`Unknown layer type: ${layer}. Must be one of: ${Object.keys(TEMPLATES).join(', ')}`);

  const fields = { prerequisites: [], solves_with: [], related_problems: [], case_studies: [], see_poc: [] };
  const fm = [
    '---',
    `title: "${title}"`,
    `layer: ${layer}`,
    `section: ${section}`,
    `difficulty: intermediate  # beginner | intermediate | advanced`,
    '',
    ...Object.entries(fields).map(([k, v]) => `${k}: []`),
    '',
    `linked_from: []  # DO NOT EDIT — auto-populated by /sync-graph`,
    `tags: []`,
    '---',
  ].join('\n');

  return fm;
}

function main() {
  const [,, layer, section, ...titleParts] = process.argv;
  const title = titleParts.join(' ');

  if (!layer || !section || !title) {
    console.error('Usage: node scaffold-article.mjs <layer> <section-path> <title>');
    console.error('Example: node scaffold-article.mjs concept system-design/databases "Write-Ahead Logging"');
    process.exit(1);
  }

  const slug = slugify(title);
  const outDir = join(PAGES_DIR, section);
  const outPath = join(outDir, `${slug}.md`);

  if (existsSync(outPath)) {
    console.error(`File already exists: ${outPath}`);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });

  const template = TEMPLATES[layer];
  if (!template) {
    console.error(`Unknown layer: ${layer}`);
    process.exit(1);
  }

  const content = buildFrontmatter(layer, section, title) + '\n\n# ' + title + '\n\n' + template.bodyTemplate;
  writeFileSync(outPath, content);

  console.log(`✅ Created: docs-site/pages/${section}/${slug}.md`);
  console.log(`   Layer: ${layer}`);
  console.log(`   Next: fill in relationship fields, then run /sync-graph`);
  console.log(`   Remember: add "${slug}" to ${section}/_meta.js`);
}

main();
```

---

### Task 7: Write SKILL.md files for all 4 skills

- [ ] **Create `.claude/skills/sync-graph/SKILL.md`**

```markdown
---
name: sync-graph
description: Rebuild all linked_from arrays across all 226 article files and regenerate KNOWLEDGE-GRAPH.md. Run after adding or editing any frontmatter relationships.
---

# /sync-graph

Rebuild the knowledge graph: scan all 226 article frontmatter files, compute bidirectional `linked_from` arrays, update every file, and regenerate `KNOWLEDGE-GRAPH.md`.

## Steps

1. Run the sync script:

```bash
cd /home/ubuntu/home/project/system-design-course/.claude/scripts && node sync-links.mjs
```

2. Report back to the user:
   - How many files were updated
   - The gap report output
   - Confirm KNOWLEDGE-GRAPH.md was regenerated

3. If there are errors (broken paths, missing files), surface them clearly with the file and field that caused the error.
```

- [ ] **Create `.claude/skills/new-article/SKILL.md`**

```markdown
---
name: new-article
description: Scaffold a new article with correct frontmatter for its layer type. Usage: /new-article <layer> <section-path> <title>
---

# /new-article

Scaffold a new article with the correct frontmatter template for its layer type, and add it to the section's `_meta.js`.

## Layer types
- `concept` — foundational theory article
- `problem` — real-world failure scenario
- `solution` — pattern or technique
- `poc` — hands-on implementation
- `case-study` — real company system design
- `interview-q` — interview question article

## Steps

1. Run the scaffold script with the provided arguments:

```bash
cd /home/ubuntu/home/project/system-design-course/.claude/scripts && node scaffold-article.mjs <layer> <section-path> "<title>"
```

2. Open the generated file and confirm frontmatter is correct.

3. Add the new slug to `docs-site/pages/<section-path>/_meta.js` in the correct position.

4. Remind the user to:
   - Fill in all relationship fields (prerequisites, see_poc, etc.)
   - Run `/sync-graph` after filling relationships
   - Write the article body
```

- [ ] **Create `.claude/skills/lint-graph/SKILL.md`**

```markdown
---
name: lint-graph
description: Validate that all frontmatter paths in the knowledge graph resolve to real files, and check that linked_from arrays are consistent with forward edges.
---

# /lint-graph

Validate the knowledge graph for broken references and stale `linked_from` arrays.

## Steps

1. Run the lint script:

```bash
cd /home/ubuntu/home/project/system-design-course/.claude/scripts && node lint-graph.mjs
```

2. Report results:
   - ✅ Clean: report "Graph is clean"
   - ❌ Broken references: list each file and the broken path — these must be fixed before they break navigation
   - ⚠️ Stale linked_from: suggest running `/sync-graph` to fix

3. Exit code 1 means broken references exist (suitable for CI).
```

- [ ] **Create `.claude/skills/gap-analysis/SKILL.md`**

```markdown
---
name: gap-analysis
description: Analyze the knowledge graph and report missing connections — concepts with no POC, problems with no solution, orphaned nodes, and thin topic coverage.
---

# /gap-analysis

Analyze the knowledge graph for gaps and produce a prioritized list of missing content.

## Steps

1. First run `/sync-graph` to ensure the graph is up-to-date.

2. Run the sync script in gap-only mode:

```bash
cd /home/ubuntu/home/project/system-design-course/.claude/scripts && node sync-links.mjs 2>&1 | grep -A1000 "GAP REPORT"
```

3. Analyze and present gaps in priority order:
   - **Critical**: Problems with no `solves_with` (readers have no path forward)
   - **High**: Concepts with no `see_poc` (no hands-on practice)
   - **Medium**: POCs with no `prerequisites` (floating, hard to discover)
   - **Low**: Case studies not referenced by any theory article

4. Suggest the top 5 next articles to write based on gap density (which topics have the most missing connections).
```

---

## Chunk 2: Layer 1 + Layer 2 (KNOWLEDGE-MAP.md + 28 CONTEXT.md files)

### Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `docs-site/pages/KNOWLEDGE-MAP.md` | Layer 1 master router |
| Modify | `docs-site/pages/_meta.js` | Add KNOWLEDGE-MAP entry (visible — it is a human-readable course index, not AI-only) |
| Create | `docs-site/pages/system-design/CONTEXT.md` | Layer 2: theory domain |
| Create | `docs-site/pages/system-design/databases/CONTEXT.md` | Layer 2: databases |
| Create | `docs-site/pages/system-design/caching/CONTEXT.md` | Layer 2: caching |
| Create | `docs-site/pages/system-design/queues/CONTEXT.md` | Layer 2: queues |
| Create | `docs-site/pages/system-design/patterns/CONTEXT.md` | Layer 2: patterns |
| Create | `docs-site/pages/system-design/scalability/CONTEXT.md` | Layer 2: scalability |
| Create | `docs-site/pages/system-design/api-design/CONTEXT.md` | Layer 2: api-design |
| Create | `docs-site/pages/system-design/load-balancing/CONTEXT.md` | Layer 2: load-balancing |
| Create | `docs-site/pages/system-design/monitoring/CONTEXT.md` | Layer 2: monitoring |
| Create | `docs-site/pages/system-design/performance/CONTEXT.md` | Layer 2: performance |
| Create | `docs-site/pages/system-design/consistency/CONTEXT.md` | Layer 2: consistency |
| Create | `docs-site/pages/system-design/security/CONTEXT.md` | Layer 2: security |
| Create | `docs-site/pages/system-design/case-studies/CONTEXT.md` | Layer 2: case-studies |
| Create | `docs-site/pages/interview-prep/CONTEXT.md` | Layer 2: interview domain |
| Create | `docs-site/pages/interview-prep/system-design/CONTEXT.md` | Layer 2: interview questions |
| Create | `docs-site/pages/interview-prep/practice-pocs/CONTEXT.md` | Layer 2: pocs |
| Create | `docs-site/pages/interview-prep/security-encryption/CONTEXT.md` | Layer 2: security topics |
| Create | `docs-site/pages/interview-prep/aws-cloud/CONTEXT.md` | Layer 2: aws |
| Create | `docs-site/pages/interview-prep/database-storage/CONTEXT.md` | Layer 2: database topics |
| Create | `docs-site/pages/interview-prep/caching-cdn/CONTEXT.md` | Layer 2: caching topics |
| Create | `docs-site/pages/problems-at-scale/CONTEXT.md` | Layer 2: failures domain |
| Create | `docs-site/pages/problems-at-scale/concurrency/CONTEXT.md` | Layer 2: concurrency |
| Create | `docs-site/pages/problems-at-scale/availability/CONTEXT.md` | Layer 2: availability |
| Create | `docs-site/pages/problems-at-scale/consistency/CONTEXT.md` | Layer 2: consistency |
| Create | `docs-site/pages/problems-at-scale/performance/CONTEXT.md` | Layer 2: performance |
| Create | `docs-site/pages/problems-at-scale/scalability/CONTEXT.md` | Layer 2: scalability |
| Create | `docs-site/pages/problems-at-scale/data-integrity/CONTEXT.md` | Layer 2: data-integrity |
| Create | `docs-site/pages/problems-at-scale/cost-optimization/CONTEXT.md` | Layer 2: cost |
| Modify | Each folder's `_meta.js` | Add `CONTEXT: { display: 'hidden' }` |

---

### Task 8: Create KNOWLEDGE-MAP.md (Layer 1)

- [ ] **Create `docs-site/pages/KNOWLEDGE-MAP.md`**

```markdown
---
title: "Knowledge Map"
description: "Master router for the system design knowledge graph. Always load this first."
---

# System Design Knowledge Map — Layer 1 Router

> **For AI agents**: Load this file first in every session. It tells you what lives where and which files to load for any task. Never load section content without first checking the routing table below.

## What This Knowledge Base Is

A comprehensive, implementation-focused system design course built on the 80/20 principle — covering 80% of essential system design topics with production-grade examples, hands-on POCs, and real failure scenarios. Every file is a node in a knowledge graph connected by typed edges.

## Node Type Legend

| Type | What It Is | Where It Lives |
|------|-----------|---------------|
| `concept` | Foundational theory article | `system-design/` |
| `solution` | Pattern or technique | `system-design/patterns/` |
| `problem` | Real-world failure scenario | `problems-at-scale/` |
| `poc` | Hands-on runnable implementation | `interview-prep/practice-pocs/` |
| `case-study` | Real company system design | `system-design/case-studies/` |
| `interview-q` | Interview question with full answer (many are case-study style) | `interview-prep/system-design/` |

## Section Map

| Section | Contains | Node Types |
|---------|----------|-----------|
| `system-design/` | 47 theory articles | concept, solution, case-study |
| `interview-prep/system-design/` | 33 interview questions | interview-q |
| `interview-prep/practice-pocs/` | 101 hands-on POCs | poc |
| `interview-prep/security-encryption/` | 5 security articles | concept |
| `interview-prep/aws-cloud/` | 5 AWS articles | concept |
| `interview-prep/database-storage/` | 6 database articles | concept |
| `interview-prep/caching-cdn/` | 5 caching articles | concept |
| `problems-at-scale/` | 24 failure scenarios | problem |

## Routing Table

| Task | Load First | Then |
|------|-----------|------|
| Learn a concept from scratch | `system-design/CONTEXT.md` | Follow `prerequisites` chain forward |
| Debug / understand a real failure | `problems-at-scale/CONTEXT.md` | Follow `solves_with` to solutions and POCs |
| Prepare for a system design interview | `interview-prep/CONTEXT.md` | Follow `prerequisites` + `see_poc` |
| Get hands-on code for a concept | `interview-prep/practice-pocs/CONTEXT.md` | Follow `prerequisites` back to theory |
| Understand how a real company solved this | `system-design/case-studies/CONTEXT.md` | Follow `prerequisites` to concepts |
| Find a solution pattern to implement | `system-design/patterns/CONTEXT.md` | Follow `prerequisites` to concepts, `see_poc` to practice |
| Find everything that links to a file | Read that file's `linked_from` field | Navigate backwards through graph |

## Traversal Patterns

```
Learn → Practice → See failure:
  concept (see_poc →) poc (related_problems →) problem

Debug backwards:
  problem (solves_with →) poc/solution (prerequisites →) concept

Interview prep path:
  interview-q (prerequisites →) concept (see_poc →) poc (case_studies →) case-study
```

## Graph Entry Points by Goal

| Goal | Start Here |
|------|-----------|
| "I need to understand caching" | `system-design/caching/caching-fundamentals` |
| "My system has a thundering herd problem" | `problems-at-scale/availability/thundering-herd` |
| "I have a system design interview" | `interview-prep/system-design/` (any question by topic) |
| "I want to practice Redis hands-on" | `interview-prep/practice-pocs/redis-key-value-cache` |
| "How does Netflix handle video streaming?" | `interview-prep/system-design/video-streaming-platform` |
| "What is the circuit breaker pattern?" | `system-design/patterns/circuit-breaker` |
| "Database is hitting hotspots" | `problems-at-scale/scalability/database-hotspots` |
```

---

### Task 9: Create all 28 CONTEXT.md files

> **Instructions for the agent executing this task**: Create each file below exactly as templated. Each must be under 100 lines. Routing only — no explanations of concepts, no content duplication. After creating each file, add `"CONTEXT": { "display": "hidden" }` to the corresponding folder's `_meta.js`.

- [ ] **Create `docs-site/pages/system-design/CONTEXT.md`**

```markdown
# system-design/ — Layer 2 Router

Theory articles covering foundational concepts, patterns, scalability, and real-world case studies.

## Subfolder Purposes

| Folder | Contains | Node Types |
|--------|----------|-----------|
| `databases/` | Replication, sharding, indexing, archival | concept |
| `caching/` | Caching strategies and patterns | concept |
| `queues/` | Message queues, Kafka vs RabbitMQ | concept |
| `patterns/` | Circuit breaker, microservices comms, backpressure | solution |
| `scalability/` | Horizontal scaling, CQRS, multi-region, chaos | concept |
| `api-design/` | REST/GraphQL/gRPC, rate limiting, idempotency | concept |
| `load-balancing/` | Load balancing strategies | concept |
| `monitoring/` | Observability and SLOs | concept |
| `performance/` | Connection pool management | concept |
| `consistency/` | Distributed consensus | concept |
| `security/` | Authentication at scale | concept |
| `case-studies/` | URL shortener, chat, YouTube, Uber, etc. | case-study |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Understand database scaling | `databases/` | `replication-basics.md`, `sharding-strategies.md` |
| Understand caching | `caching/` | `caching-fundamentals.md` |
| Understand message queues | `queues/` | `message-queue-basics.md`, `kafka-vs-rabbitmq.md` |
| Find a resilience pattern | `patterns/` | `circuit-breaker.md`, `timeouts-backpressure.md` |
| Scale a system | `scalability/` | `scaling-basics.md`, `microservices-architecture.md` |
| Design an API | `api-design/` | `rest-graphql-grpc.md`, `rate-limiting.md` |
| Real company architecture | `case-studies/` | relevant case study file |
```

- [ ] **Create remaining 27 CONTEXT.md files** using the same template pattern. For each subfolder:
  - **Read the actual files in the folder first** (`ls` + read 2-3 representative articles) before writing routing rows — do not invent paths or descriptions
  - One-sentence purpose (derive from reading the articles)
  - Table listing files and their node types
  - Routing table with 4-6 rows covering the most common questions about that section

  Files to create (apply the template pattern to each):
  - `system-design/databases/CONTEXT.md` — 6 articles: replication-basics, read-replicas, sharding-strategies, indexing-strategies, indexing-deep-dive, data-archival-strategies
  - `system-design/caching/CONTEXT.md` — 2 articles: caching-fundamentals, caching-strategies
  - `system-design/queues/CONTEXT.md` — 2 articles: message-queue-basics, kafka-vs-rabbitmq
  - `system-design/patterns/CONTEXT.md` — 3 articles: circuit-breaker, microservices-communication, timeouts-backpressure
  - `system-design/scalability/CONTEXT.md` — 12 articles: scaling-basics, stateless-architecture, auto-scaling, microservices-architecture, event-driven-architecture, async-processing, backpressure, high-availability, multi-region, cqrs, chaos-engineering, cdn-edge-computing
  - `system-design/api-design/CONTEXT.md` — 3 articles: rest-graphql-grpc, rate-limiting, idempotency
  - `system-design/load-balancing/CONTEXT.md` — 1 article: load-balancing-strategies
  - `system-design/monitoring/CONTEXT.md` — 1 article: observability-slos
  - `system-design/performance/CONTEXT.md` — 1 article: connection-pool-management
  - `system-design/consistency/CONTEXT.md` — 1 article: distributed-consensus
  - `system-design/security/CONTEXT.md` — 1 article: authentication-at-scale
  - `system-design/case-studies/CONTEXT.md` — 14 case studies: url-shortener, pastebin, rate-limiter, unique-id-generator, news-feed, chat-system, notification-system, uber-backend, ticket-booking, google-drive, youtube, netflix, payment-system, spotify
  - `interview-prep/CONTEXT.md` — 6 subsections
  - `interview-prep/system-design/CONTEXT.md` — 33 interview questions
  - `interview-prep/practice-pocs/CONTEXT.md` — 101 POCs
  - `interview-prep/security-encryption/CONTEXT.md` — 5 articles
  - `interview-prep/aws-cloud/CONTEXT.md` — 5 articles
  - `interview-prep/database-storage/CONTEXT.md` — 6 articles
  - `interview-prep/caching-cdn/CONTEXT.md` — 5 articles
  - `problems-at-scale/CONTEXT.md` — 7 subsections
  - `problems-at-scale/concurrency/CONTEXT.md` — 6 articles
  - `problems-at-scale/availability/CONTEXT.md` — 6 articles
  - `problems-at-scale/consistency/CONTEXT.md` — 3 articles
  - `problems-at-scale/performance/CONTEXT.md` — 3 articles
  - `problems-at-scale/scalability/CONTEXT.md` — 3 articles
  - `problems-at-scale/data-integrity/CONTEXT.md` — 2 articles
  - `problems-at-scale/cost-optimization/CONTEXT.md` — 1 article

- [ ] **Update every folder's `_meta.js` to hide CONTEXT.md from Nextra navigation**

For every `_meta.js` that now has a sibling `CONTEXT.md`, add this entry:

```javascript
// In each _meta.js where CONTEXT.md exists:
"CONTEXT": {
  "display": "hidden"
}
```

---

## Chunk 3: Frontmatter — system-design/ (57 files)

### Agent B Instructions

> You are Agent B. Your job: add typed YAML frontmatter to all article `.md` files in `docs-site/pages/system-design/`. Do NOT touch index.md, _meta.js, or CONTEXT.md files. Do NOT modify article body content — only prepend or replace the frontmatter block.

### Rules for determining frontmatter

**Layer type assignment:**
- Files in `databases/`, `caching/`, `queues/`, `scalability/`, `api-design/`, `load-balancing/`, `monitoring/`, `performance/`, `consistency/`, `security/` → `concept`
- Files in `patterns/` → `solution`
- Files in `case-studies/` → `case-study`

**Path format**: relative to `docs-site/pages/`, no leading slash, no `.md` extension.

**Relationship rules:**
- `prerequisites`: What concepts must a reader already understand? List 1-3 prerequisite articles.
- `see_poc`: Which POCs in `interview-prep/practice-pocs/` let someone practice this hands-on?
- `case_studies`: Which case studies demonstrate this concept in a real system?
- `related_problems`: Which problems in `problems-at-scale/` can arise if this is done wrong?
- `solves_with`: Leave empty for concept/solution/case-study nodes (only problem nodes use this).

---

### Task 10: Frontmatter for system-design/databases/ (6 files)

- [ ] **Add frontmatter to each file. Read the article first to understand its content.**

Example for `replication-basics.md`:
```yaml
---
title: "Database Replication Basics"
layer: concept
section: system-design/databases
difficulty: beginner
prerequisites: []
solves_with: []
related_problems:
  - problems-at-scale/availability/split-brain
  - problems-at-scale/consistency/stale-read-after-write
case_studies:
  - system-design/case-studies/url-shortener
see_poc:
  - interview-prep/practice-pocs/database-read-replicas
  - interview-prep/practice-pocs/database-crud
linked_from: []
tags: [databases, replication, availability]
---
```

Apply the same pattern to: `read-replicas.md`, `sharding-strategies.md`, `indexing-strategies.md`, `indexing-deep-dive.md`, `data-archival-strategies.md`. Read each file, identify relationships to actual existing files, write frontmatter.

---

### Task 11: Frontmatter for system-design/caching/ (2 files)

- [ ] **Add frontmatter to `caching-fundamentals.md` and `caching-strategies.md`**

`caching-fundamentals.md` example:
```yaml
---
title: "Caching Fundamentals"
layer: concept
section: system-design/caching
difficulty: beginner
prerequisites: []
solves_with: []
related_problems:
  - problems-at-scale/availability/thundering-herd
  - problems-at-scale/consistency/cache-invalidation-race
  - problems-at-scale/consistency/stale-read-after-write
case_studies:
  - system-design/case-studies/url-shortener
  - system-design/case-studies/news-feed
see_poc:
  - interview-prep/practice-pocs/redis-key-value-cache
  - interview-prep/practice-pocs/cache-aside-pattern
  - interview-prep/practice-pocs/write-through-caching
linked_from: []
tags: [caching, redis, performance]
---
```

---

### Task 12: Frontmatter for system-design/queues/ (2 files)

- [ ] **Add frontmatter to `message-queue-basics.md` and `kafka-vs-rabbitmq.md`**

---

### Task 13: Frontmatter for system-design/patterns/ (3 files)

- [ ] **Add frontmatter to `circuit-breaker.md`, `microservices-communication.md`, `timeouts-backpressure.md`**

These are `layer: solution` nodes. `prerequisites` should point to relevant concept articles.

---

### Task 14: Frontmatter for system-design/scalability/ (12 files)

- [ ] **Add frontmatter to all 12 scalability articles**

Read each file before adding frontmatter. Key relationships:
- `scaling-basics.md` → see_poc: none directly, related_problems: `problems-at-scale/scalability/`
- `microservices-architecture.md` → prerequisites: `scaling-basics.md`, see_poc: check interview-prep/practice-pocs/ for relevant POCs
- `event-driven-architecture.md` → see_poc: `kafka-basics-producer-consumer`, `redis-pubsub`
- `cqrs.md` → see_poc: `cqrs-pattern`, `event-sourcing-basics`

---

### Task 15: Frontmatter for system-design/api-design/ (3 files)

- [ ] **Add frontmatter to `rest-graphql-grpc.md`, `rate-limiting.md`, `idempotency.md`**

---

### Task 16: Frontmatter for system-design/load-balancing/, monitoring/, performance/, consistency/, security/ (5 files)

- [ ] **Add frontmatter to the single article in each of these sections**

---

### Task 17: Frontmatter for system-design/case-studies/ (14 files)

- [ ] **Add frontmatter to all 14 case studies**

These are `layer: case-study` nodes. Key fields:
- `prerequisites`: 2-4 concepts this case study demonstrates
- `see_poc`: relevant POCs that implement parts of this system

Example for `youtube.md`:
```yaml
---
title: "YouTube System Design"
layer: case-study
section: system-design/case-studies
difficulty: advanced
prerequisites:
  - system-design/caching/caching-fundamentals
  - system-design/databases/read-replicas
  - system-design/scalability/cdn-edge-computing
  - system-design/queues/message-queue-basics
solves_with: []
related_problems:
  - problems-at-scale/scalability/hot-partition
  - problems-at-scale/performance/connection-pool-starvation
case_studies: []
see_poc:
  - interview-prep/practice-pocs/kafka-basics-producer-consumer
  - interview-prep/practice-pocs/redis-key-value-cache
linked_from: []
tags: [video-streaming, cdn, distributed-systems]
---
```

---

## Chunk 4: Frontmatter — problems-at-scale/ (32 files)

### Agent C Instructions

> You are Agent C. Your job: add typed YAML frontmatter to all article `.md` files in `docs-site/pages/problems-at-scale/`. Do NOT touch index.md, _meta.js, or CONTEXT.md files. Do NOT modify article body content.

**All files here are `layer: problem`.**

**Relationship rules for problem nodes:**
- `prerequisites`: Concepts the reader needs to understand the problem (usually 1-2)
- `solves_with`: POCs or solution articles that directly address this problem — THIS IS THE MOST IMPORTANT FIELD for problem nodes
- `related_problems`: Other problems in problems-at-scale/ that commonly co-occur
- `case_studies`: Real company systems where this problem has manifested
- `see_poc`: Leave empty for problem nodes (use `solves_with` instead)

---

### Task 18: Frontmatter for problems-at-scale/concurrency/ (6 files)

- [ ] **Add frontmatter to all 6 concurrency articles**

Files: `counter-race.md`, `race-condition-inventory.md`, `double-booking.md`, `duplicate-orders.md`, `stock-order-matching-race.md`, `double-charge-payment.md`

Example for `double-booking.md`:
```yaml
---
title: "Double Booking Race Condition"
layer: problem
section: problems-at-scale/concurrency
difficulty: intermediate
prerequisites:
  - system-design/databases/replication-basics
solves_with:
  - interview-prep/practice-pocs/redis-distributed-lock
  - interview-prep/practice-pocs/database-transactions
  - interview-prep/practice-pocs/redis-atomic-inventory
related_problems:
  - problems-at-scale/concurrency/race-condition-inventory
  - problems-at-scale/concurrency/duplicate-orders
case_studies:
  - system-design/case-studies/ticket-booking
see_poc: []
linked_from: []
tags: [concurrency, locking, transactions, redis]
---
```

---

### Task 19: Frontmatter for problems-at-scale/availability/ (6 files)

- [ ] **Add frontmatter to all 6 availability articles**

Files: `thundering-herd.md`, `cascading-failures.md`, `retry-storm.md`, `timeout-domino-effect.md`, `split-brain.md`, `circuit-breaker-failure.md`

Example for `thundering-herd.md`:
```yaml
---
title: "Thundering Herd Problem"
layer: problem
section: problems-at-scale/availability
difficulty: advanced
prerequisites:
  - system-design/caching/caching-fundamentals
  - system-design/databases/read-replicas
solves_with:
  - interview-prep/practice-pocs/cache-aside-pattern
  - interview-prep/practice-pocs/circuit-breaker
  - interview-prep/practice-pocs/redis-rate-limiting
related_problems:
  - problems-at-scale/availability/cascading-failures
  - problems-at-scale/availability/retry-storm
case_studies:
  - interview-prep/system-design/video-streaming-platform
  - system-design/case-studies/youtube
see_poc: []
linked_from: []
tags: [caching, availability, thundering-herd, redis]
---
```

---

### Task 20: Frontmatter for problems-at-scale/consistency/, performance/, scalability/, data-integrity/, cost-optimization/ (13 files)

- [ ] **Add frontmatter to all remaining 13 articles across these 5 subdirectories**

Read each file first. Map `solves_with` to real POC filenames from `interview-prep/practice-pocs/` (check the known list: redis-*, database-*, kafka-*, postgresql-*, etc.).

---

## Chunk 5: Frontmatter — interview-prep/ topic sections (60 files)

### Agent D Instructions

> You are Agent D. Your job: add typed YAML frontmatter to all article `.md` files in:
> - `docs-site/pages/interview-prep/system-design/` (33 non-index files) — `layer: interview-q` — **run `ls` on this folder first to get exact filenames**
> - `docs-site/pages/interview-prep/security-encryption/` (5 non-index files) — `layer: concept`
> - `docs-site/pages/interview-prep/aws-cloud/` (5 non-index files) — `layer: concept`
> - `docs-site/pages/interview-prep/database-storage/` (6 non-index files) — `layer: concept`
> - `docs-site/pages/interview-prep/caching-cdn/` (5 non-index files) — `layer: concept`
> - Skip all `index.md` files and `_meta.js` files

**Relationship rules for interview-q nodes:**
- `prerequisites`: 2-4 concept or solution articles that cover the theory behind this question
- `see_poc`: POCs that implement components of the answer
- `case_studies`: Real company system designs that are this exact question at scale
- `related_problems`: Failure scenarios relevant to the system being designed

---

### Task 21: Frontmatter for interview-prep/system-design/ (33 files)

- [ ] **Run `ls docs-site/pages/interview-prep/system-design/` first to get exact filenames, then add frontmatter to all 33 interview question articles (skip index.md)**

Example for `video-streaming-platform.md`:
```yaml
---
title: "Design a Video Streaming Platform"
layer: interview-q
section: interview-prep/system-design
difficulty: advanced
prerequisites:
  - system-design/caching/caching-fundamentals
  - system-design/databases/read-replicas
  - system-design/scalability/cdn-edge-computing
  - system-design/queues/message-queue-basics
solves_with: []
related_problems:
  - problems-at-scale/availability/thundering-herd
  - problems-at-scale/scalability/hot-partition
case_studies:
  - system-design/case-studies/youtube
see_poc:
  - interview-prep/practice-pocs/kafka-basics-producer-consumer
  - interview-prep/practice-pocs/redis-key-value-cache
  - interview-prep/practice-pocs/cache-aside-pattern
linked_from: []
tags: [video-streaming, cdn, distributed-systems, netflix, youtube]
---
```

---

### Task 22: Frontmatter for interview-prep/security-encryption/, aws-cloud/, database-storage/, caching-cdn/ (21 files)

- [ ] **Add frontmatter to all 21 articles across these 4 topic sections** (5 + 5 + 6 + 5, skipping index.md in each)

These are all `layer: concept`. Link them to relevant POCs in `interview-prep/practice-pocs/` and relevant theory articles in `system-design/`.

---

## Chunk 6: Frontmatter — interview-prep/practice-pocs/ (101 files)

### Agent E Instructions

> You are Agent E. Your job: add typed YAML frontmatter to all 101 article `.md` files in `docs-site/pages/interview-prep/practice-pocs/`. All files here are `layer: poc`. Do NOT touch index.md, _meta.js, CONTEXT.md, or any file inside the `database-archival-poc/` subdirectory.

**Relationship rules for poc nodes:**
- `prerequisites`: 1-3 concept articles the reader should understand before attempting this POC
- `related_problems`: Problems in problems-at-scale/ that this POC helps solve
- `see_poc`: Leave empty (POCs don't point to other POCs — use related_problems instead)
- `solves_with`: Leave empty (only used by problem nodes)
- `case_studies`: Leave empty unless the POC directly implements a specific case study pattern

---

### Task 23: Frontmatter for POCs 1-10 (Redis basics)

- [ ] **Add frontmatter to**: `redis-key-value-cache.md`, `redis-counter.md`, `redis-distributed-lock.md`, `redis-job-queue.md`, `redis-leaderboard.md`, `redis-session-management.md`, `redis-rate-limiting.md`, `redis-pubsub.md`, `redis-streams.md`, `redis-hyperloglog.md`

Example for `redis-distributed-lock.md`:
```yaml
---
title: "Redis Distributed Lock"
layer: poc
section: interview-prep/practice-pocs
difficulty: intermediate
prerequisites:
  - system-design/caching/caching-fundamentals
  - system-design/databases/replication-basics
solves_with: []
related_problems:
  - problems-at-scale/concurrency/double-booking
  - problems-at-scale/concurrency/race-condition-inventory
case_studies:
  - system-design/case-studies/ticket-booking
see_poc: []
linked_from: []
tags: [redis, locking, concurrency, distributed-systems]
---
```

---

### Task 24: Frontmatter for POCs 11-30 (Database fundamentals)

- [ ] **Add frontmatter to all 20 database POCs**

`prerequisites` should link to relevant `system-design/databases/` concept articles.

---

### Task 25: Frontmatter for POCs 31-50 (Redis transactions, Lua, Advanced Redis, Kafka)

- [ ] **Add frontmatter to all 20 POCs in these groups**

Kafka POCs should link to `system-design/queues/message-queue-basics` and `kafka-vs-rabbitmq` as prerequisites.

---

### Task 26: Frontmatter for POCs 51-70 (PostgreSQL, API Design, Caching, Load Balancing)

- [ ] **Add frontmatter to all 20 POCs in these groups**

API design POCs should link to `system-design/api-design/rest-graphql-grpc` as prerequisite.

---

### Task 27: Frontmatter for POCs 71-101 (Connection Pool, Idempotency, Resilience, Event Sourcing, Security, Testing, Infrastructure, Data Lifecycle)

- [ ] **Add frontmatter to all remaining 33 POCs**

---

## Chunk 7: Integration + Validation

### Task 28: Run /sync-graph

- [ ] **Run the sync script**

```bash
cd /home/ubuntu/home/project/system-design-course/.claude/scripts && node sync-links.mjs
```

Expected output:
```
Found ~226 article nodes
Updated linked_from in X files
Generated KNOWLEDGE-GRAPH.md (226 nodes, Y edges)

=== GAP REPORT ===
Concepts with no POC: [list]
Problems with no solution: [list]
...
```

- [ ] **Verify KNOWLEDGE-GRAPH.md was created**

```bash
ls -la /home/ubuntu/home/project/system-design-course/docs-site/pages/KNOWLEDGE-GRAPH.md
head -50 /home/ubuntu/home/project/system-design-course/docs-site/pages/KNOWLEDGE-GRAPH.md
```

---

### Task 29: Run /lint-graph

- [ ] **Validate the graph**

```bash
cd /home/ubuntu/home/project/system-design-course/.claude/scripts && node lint-graph.mjs
```

Expected: `✅ Graph is clean — no broken references, no stale linked_from`

If there are errors: for each broken reference, either fix the path in the frontmatter that references it, or note it in the gap analysis. Exit code must be 0 before proceeding.

---

### Task 30: Verify docs site builds

- [ ] **Check the docs site still builds with all the new frontmatter**

```bash
cd /home/ubuntu/home/project/system-design-course/docs-site && npm run build 2>&1 | tail -20
```

Expected: Build succeeds. If Nextra errors on frontmatter fields it doesn't recognise, check that frontmatter is valid YAML and that no special characters are unescaped in title fields.

- [ ] **Check CONTEXT.md files are hidden in navigation**

```bash
npm run dev &
# Open http://localhost:3000 — CONTEXT.md entries should NOT appear in sidebar
```

---

### Task 31: Final validation checklist

- [ ] All article files have frontmatter: `grep -r "^layer:" docs-site/pages/system-design/ | wc -l` should be 47 (excludes index.md files)
- [ ] `grep -r "^layer:" docs-site/pages/problems-at-scale/ | wc -l` should be 24
- [ ] `grep -r "^layer:" docs-site/pages/interview-prep/ | wc -l` should be ~155
- [ ] `/lint-graph` exits 0
- [ ] `KNOWLEDGE-GRAPH.md` exists and has all 4 mermaid diagrams
- [ ] `KNOWLEDGE-MAP.md` exists with routing table
- [ ] 28 CONTEXT.md files exist
- [ ] All CONTEXT.md entries are `display: "hidden"` in their `_meta.js`
- [ ] All 4 SKILL.md files exist in `.claude/skills/`

---

## Reference: Known File Lists

### system-design/ articles (for Agent B)
```
system-design/databases/replication-basics
system-design/databases/read-replicas
system-design/databases/sharding-strategies
system-design/databases/indexing-strategies
system-design/databases/indexing-deep-dive
system-design/databases/data-archival-strategies
system-design/caching/caching-fundamentals
system-design/caching/caching-strategies
system-design/queues/message-queue-basics
system-design/queues/kafka-vs-rabbitmq
system-design/patterns/circuit-breaker
system-design/patterns/microservices-communication
system-design/patterns/timeouts-backpressure
system-design/scalability/scaling-basics
system-design/scalability/stateless-architecture
system-design/scalability/auto-scaling
system-design/scalability/microservices-architecture
system-design/scalability/event-driven-architecture
system-design/scalability/async-processing
system-design/scalability/backpressure
system-design/scalability/high-availability
system-design/scalability/multi-region
system-design/scalability/cqrs
system-design/scalability/chaos-engineering
system-design/scalability/cdn-edge-computing
system-design/api-design/rest-graphql-grpc
system-design/api-design/rate-limiting
system-design/api-design/idempotency
system-design/load-balancing/load-balancing-strategies
system-design/monitoring/observability-slos
system-design/performance/connection-pool-management
system-design/consistency/distributed-consensus
system-design/security/authentication-at-scale
system-design/case-studies/url-shortener
system-design/case-studies/pastebin
system-design/case-studies/rate-limiter
system-design/case-studies/unique-id-generator
system-design/case-studies/news-feed
system-design/case-studies/chat-system
system-design/case-studies/notification-system
system-design/case-studies/uber-backend
system-design/case-studies/ticket-booking
system-design/case-studies/google-drive
system-design/case-studies/youtube
system-design/case-studies/netflix
system-design/case-studies/payment-system
system-design/case-studies/spotify
```

### problems-at-scale/ articles (for Agent C)
```
problems-at-scale/concurrency/counter-race
problems-at-scale/concurrency/race-condition-inventory
problems-at-scale/concurrency/double-booking
problems-at-scale/concurrency/duplicate-orders
problems-at-scale/concurrency/stock-order-matching-race
problems-at-scale/concurrency/double-charge-payment
problems-at-scale/availability/thundering-herd
problems-at-scale/availability/cascading-failures
problems-at-scale/availability/retry-storm
problems-at-scale/availability/timeout-domino-effect
problems-at-scale/availability/split-brain
problems-at-scale/availability/circuit-breaker-failure
problems-at-scale/consistency/stale-read-after-write
problems-at-scale/consistency/cache-invalidation-race
problems-at-scale/consistency/message-out-of-order
problems-at-scale/performance/n-plus-one-query
problems-at-scale/performance/connection-pool-starvation
problems-at-scale/performance/thread-pool-exhaustion
problems-at-scale/scalability/database-hotspots
problems-at-scale/scalability/hot-partition
problems-at-scale/scalability/memory-leak-long-running
problems-at-scale/data-integrity/orphaned-records
problems-at-scale/data-integrity/duplicate-event-processing
problems-at-scale/cost-optimization/storage-bloat
```

### interview-prep/practice-pocs/ articles (for Agent E — use as targets in other agents' see_poc/solves_with)
```
interview-prep/practice-pocs/redis-key-value-cache
interview-prep/practice-pocs/redis-counter
interview-prep/practice-pocs/redis-distributed-lock
interview-prep/practice-pocs/redis-job-queue
interview-prep/practice-pocs/redis-leaderboard
interview-prep/practice-pocs/redis-session-management
interview-prep/practice-pocs/redis-rate-limiting
interview-prep/practice-pocs/redis-pubsub
interview-prep/practice-pocs/redis-streams
interview-prep/practice-pocs/redis-hyperloglog
interview-prep/practice-pocs/database-crud
interview-prep/practice-pocs/database-indexes
interview-prep/practice-pocs/database-n-plus-one
interview-prep/practice-pocs/database-explain
interview-prep/practice-pocs/database-connection-pooling
interview-prep/practice-pocs/database-transactions
interview-prep/practice-pocs/database-read-replicas
interview-prep/practice-pocs/database-sharding
interview-prep/practice-pocs/database-jsonb
interview-prep/practice-pocs/database-full-text-search
interview-prep/practice-pocs/database-triggers
interview-prep/practice-pocs/database-views
interview-prep/practice-pocs/database-materialized-views
interview-prep/practice-pocs/database-ctes
interview-prep/practice-pocs/database-window-functions
interview-prep/practice-pocs/database-partitioning
interview-prep/practice-pocs/database-foreign-keys
interview-prep/practice-pocs/database-check-constraints
interview-prep/practice-pocs/database-sequences
interview-prep/practice-pocs/database-vacuum
interview-prep/practice-pocs/redis-transactions-multi-exec
interview-prep/practice-pocs/redis-watch-optimistic-locking
interview-prep/practice-pocs/redis-atomic-inventory
interview-prep/practice-pocs/redis-banking-transfers
interview-prep/practice-pocs/redis-transaction-rollback
interview-prep/practice-pocs/redis-lua-scripting-basics
interview-prep/practice-pocs/redis-lua-rate-limiting
interview-prep/practice-pocs/redis-lua-leaderboards
interview-prep/practice-pocs/redis-lua-workflows
interview-prep/practice-pocs/redis-lua-performance-benchmarks
interview-prep/practice-pocs/redis-pubsub-patterns
interview-prep/practice-pocs/redis-streams-event-sourcing
interview-prep/practice-pocs/redis-cluster-sharding
interview-prep/practice-pocs/redis-persistence-strategies
interview-prep/practice-pocs/redis-monitoring-performance
interview-prep/practice-pocs/kafka-basics-producer-consumer
interview-prep/practice-pocs/kafka-consumer-groups-load-balancing
interview-prep/practice-pocs/kafka-streams-real-time-processing
interview-prep/practice-pocs/kafka-exactly-once-semantics
interview-prep/practice-pocs/kafka-performance-tuning-monitoring
interview-prep/practice-pocs/postgresql-btree-hash-indexes
interview-prep/practice-pocs/postgresql-composite-covering-indexes
interview-prep/practice-pocs/postgresql-explain-analyze-optimization
interview-prep/practice-pocs/postgresql-partitioning-strategies
interview-prep/practice-pocs/postgresql-connection-pooling-replication
interview-prep/practice-pocs/rest-api-best-practices
interview-prep/practice-pocs/graphql-server-implementation
interview-prep/practice-pocs/grpc-protocol-buffers
interview-prep/practice-pocs/api-versioning-strategies
interview-prep/practice-pocs/api-gateway-rate-limiting
interview-prep/practice-pocs/cache-aside-pattern
interview-prep/practice-pocs/write-through-caching
interview-prep/practice-pocs/cache-invalidation-strategies
interview-prep/practice-pocs/redis-cluster-caching
interview-prep/practice-pocs/http-caching-headers
interview-prep/practice-pocs/load-balancer-round-robin
interview-prep/practice-pocs/load-balancer-least-connections
interview-prep/practice-pocs/load-balancer-consistent-hashing
interview-prep/practice-pocs/circuit-breaker
interview-prep/practice-pocs/nginx-load-balancer
interview-prep/practice-pocs/connection-pool-sizing
interview-prep/practice-pocs/connection-leak-detection
interview-prep/practice-pocs/idempotency-keys
interview-prep/practice-pocs/redis-deduplication
interview-prep/practice-pocs/retry-backoff
interview-prep/practice-pocs/timeout-configuration
interview-prep/practice-pocs/backpressure-queues
interview-prep/practice-pocs/graceful-degradation
interview-prep/practice-pocs/distributed-tracing
interview-prep/practice-pocs/slo-dashboard
interview-prep/practice-pocs/event-sourcing-basics
interview-prep/practice-pocs/cqrs-pattern
interview-prep/practice-pocs/event-store-implementation
interview-prep/practice-pocs/saga-pattern
interview-prep/practice-pocs/outbox-pattern
interview-prep/practice-pocs/jwt-authentication
interview-prep/practice-pocs/oauth-flows
interview-prep/practice-pocs/api-key-management
interview-prep/practice-pocs/rate-limiting-algorithms
interview-prep/practice-pocs/rbac-implementation
interview-prep/practice-pocs/load-testing-k6
interview-prep/practice-pocs/chaos-engineering
interview-prep/practice-pocs/contract-testing
interview-prep/practice-pocs/database-testing
interview-prep/practice-pocs/integration-testing
interview-prep/practice-pocs/feature-flags
interview-prep/practice-pocs/blue-green-deployment
interview-prep/practice-pocs/canary-releases
interview-prep/practice-pocs/health-check-patterns
interview-prep/practice-pocs/service-discovery
interview-prep/practice-pocs/database-archival-strategies
```
