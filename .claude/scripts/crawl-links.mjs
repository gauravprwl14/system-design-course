#!/usr/bin/env node
/**
 * crawl-links.mjs — Runtime link crawler for the system-design-course docs site.
 *
 * Usage:
 *   node .claude/scripts/crawl-links.mjs
 *   node .claude/scripts/crawl-links.mjs --url http://localhost:3000/system-design
 *   node .claude/scripts/crawl-links.mjs --url https://rnd.blr0.geekydev.com/system-design --auth user:pass
 *   node .claude/scripts/crawl-links.mjs --url https://... --auth user:pass --no-skip-external
 *
 * Design decisions:
 *   - Uses linkinator's Node.js API (LinkChecker class + EventEmitter) for programmatic control.
 *   - External links are skipped by default via a `linksToSkip` filter function — this keeps
 *     crawl time under 5 minutes for ~815 pages (external checks alone can take hours).
 *   - Internal-only filtering is done by comparing each link's origin+prefix against BASE_URL's
 *     origin + basePath prefix, so it never follows https://github.com, mailto:, etc.
 *   - Basic Auth is injected as an `Authorization` header on every request; linkinator passes
 *     the `headers` option to its underlying fetch, so this transparently covers nginx auth.
 *   - Progress is reported on every `pagestart` event (throttled to every 50 pages for brevity).
 *   - Broken links are collected and written to stdout immediately when found.
 *   - Exit code 1 is set if any broken links were discovered.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Resolve the linkinator install (lives in docs-site/node_modules) ──────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');
const docsNodeModules = path.join(repoRoot, 'docs-site', 'node_modules');

// Dynamic import with explicit path so the script works from any cwd.
const linkinatorPath = path.join(docsNodeModules, 'linkinator', 'build', 'src', 'index.js');
const { LinkChecker, LinkState } = await import(linkinatorPath);

// ── CLI argument parsing ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    url: 'http://localhost:3000/system-design',
    auth: null,          // "user:password" string
    skipExternal: true,  // --no-skip-external to disable
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      opts.url = args[++i];
    } else if (arg === '--auth' && args[i + 1]) {
      opts.auth = args[++i];
    } else if (arg === '--skip-external') {
      opts.skipExternal = true;
    } else if (arg === '--no-skip-external') {
      opts.skipExternal = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node crawl-links.mjs [options]

Options:
  --url <url>          Base URL to crawl (default: http://localhost:3000/system-design)
  --auth <user:pass>   HTTP Basic Auth credentials for production (e.g. admin:secret)
  --skip-external      Skip external links (default: true)
  --no-skip-external   Also check external links (slow — thousands of links)
  --help               Show this help

Examples:
  # Local dev server:
  node .claude/scripts/crawl-links.mjs

  # Production:
  node .claude/scripts/crawl-links.mjs \\
    --url https://rnd.blr0.geekydev.com/system-design \\
    --auth myuser:mypassword
      `.trim());
      process.exit(0);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv);
const BASE_URL = opts.url.replace(/\/$/, ''); // strip trailing slash

// ── Derive the URL origin + basePath prefix for internal-link detection ───────
// e.g. BASE_URL = "http://localhost:3000/system-design"
//  → origin  = "http://localhost:3000"
//  → prefix  = "http://localhost:3000/system-design"
let parsedBase;
try {
  parsedBase = new URL(BASE_URL);
} catch {
  console.error(`[ERROR] Invalid --url value: "${BASE_URL}"`);
  process.exit(1);
}
const ORIGIN = parsedBase.origin;              // e.g. "http://localhost:3000"
const INTERNAL_PREFIX = BASE_URL;              // e.g. "http://localhost:3000/system-design"

// ── Build Authorization header if --auth is provided ─────────────────────────
const headers = {};
if (opts.auth) {
  const encoded = Buffer.from(opts.auth).toString('base64');
  headers['Authorization'] = `Basic ${encoded}`;
}

// ── Build skip list ───────────────────────────────────────────────────────────
// linksToSkip accepts an async function: (url: string) => Promise<boolean>
// Return true  → skip this link (don't check it)
// Return false → check this link
async function linksToSkip(link) {
  // Always skip mailto: and tel: links
  if (/^mailto:|^tel:/i.test(link)) return true;

  // Always skip bare anchors
  if (link.startsWith('#')) return true;

  // If skip-external is on, skip anything outside our origin/basePath
  if (opts.skipExternal) {
    // Skip if link doesn't start with our internal prefix
    // (covers both same-origin non-basePath paths and external origins)
    if (!link.startsWith(INTERNAL_PREFIX)) {
      return true;
    }
  }

  return false;
}

// ── Main crawl ────────────────────────────────────────────────────────────────
console.log(`\n[crawl-links] Starting crawl`);
console.log(`  Base URL      : ${BASE_URL}`);
console.log(`  Auth          : ${opts.auth ? 'yes (Basic Auth)' : 'none'}`);
console.log(`  Skip external : ${opts.skipExternal}`);
console.log(`  Internal prefix: ${INTERNAL_PREFIX}\n`);

const checker = new LinkChecker();

let pageCount = 0;
let brokenCount = 0;
const brokenLinks = [];

// pagestart fires each time the crawler begins parsing a new page
checker.on('pagestart', (url) => {
  pageCount++;
  if (pageCount % 50 === 0 || pageCount === 1) {
    console.log(`  Checking page ${pageCount}... (${url})`);
  }
});

// link fires for every link found (OK, BROKEN, or SKIPPED)
checker.on('link', (result) => {
  if (result.state === LinkState.BROKEN) {
    brokenCount++;
    const status = result.status ?? 'ERR';
    const parent = result.parent ?? '(unknown)';
    const msg = `[${status}] ${result.url}\n       found on: ${parent}`;
    brokenLinks.push(msg);
    console.error(`  BROKEN ${msg}`);
  }
});

let results;
try {
  results = await checker.check({
    path: BASE_URL,
    recurse: true,
    timeout: 10_000,
    concurrency: 10,    // 10 parallel requests — enough speed without hammering
    linksToSkip,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    // Allow self-signed certs on local dev
    allowInsecureCerts: true,
  });
} catch (err) {
  console.error(`\n[crawl-links] Fatal error: ${err.message}`);
  process.exit(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────');
console.log(`Crawl complete`);
console.log(`  Pages visited : ${pageCount}`);
console.log(`  Links checked : ${results.links.length}`);
console.log(`  Broken links  : ${brokenCount}`);

if (brokenCount > 0) {
  console.error('\nBroken link details:');
  brokenLinks.forEach((msg, i) => console.error(`  ${i + 1}. ${msg}`));
  console.error('\n[FAIL] Broken links found. Fix them and re-run.');
  process.exit(1);
} else {
  console.log('\n[PASS] No broken links found.');
}
