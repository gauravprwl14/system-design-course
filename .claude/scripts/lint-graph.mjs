import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import matter from 'gray-matter';
import { EDGE_FIELDS, SKIP_NAMES } from './constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../');
const PAGES_DIR = join(REPO_ROOT, 'docs-site/pages');

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

export function checkBidirectionalConsistency(nodes) {
  const warnings = [];
  const expected = new Map();
  for (const [key, node] of nodes) {
    for (const field of EDGE_FIELDS) {
      for (const target of (node.data[field] || [])) {
        if (!expected.has(target)) expected.set(target, new Set());
        expected.get(target).add(key);
      }
    }
  }
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
