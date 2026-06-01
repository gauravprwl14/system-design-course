/**
 * validate-links.mjs
 *
 * Static link validator for docs-site/content/ — catches broken internal links
 * and stale _meta.js keys BEFORE the Next.js build runs.
 *
 * Usage:
 *   node .claude/scripts/validate-links.mjs
 *
 * Exit code 0 = no broken links
 * Exit code 1 = broken links found
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { glob as fsGlob } from 'node:fs/promises';
import { join, dirname, resolve as resolvePath, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const glob = async (pattern, { cwd, absolute }) => {
  const results = [];
  for await (const entry of fsGlob(pattern, { cwd, absolute })) {
    results.push(entry);
  }
  return results;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../');
const CONTENT_DIR = join(REPO_ROOT, 'docs-site/content');
const BASE_PATH = '/system-design';

// ─── helpers ─────────────────────────────────────────────────────────────────

function isDirSync(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check whether a resolved path corresponds to an actual content file.
 * Accepts .md, .mdx, index.md, index.mdx, or a bare directory.
 */
function fileExists(p) {
  if (existsSync(p + '.md')) return true;
  if (existsSync(p + '.mdx')) return true;
  if (existsSync(join(p, 'index.md'))) return true;
  if (existsSync(join(p, 'index.mdx'))) return true;
  if (existsSync(p) && isDirSync(p)) return true;
  return false;
}

/**
 * Strip fenced code blocks from markdown content so we don't false-positive
 * on link-shaped syntax inside code (e.g. Python **kwargs, JS destructuring).
 * Replaces the body of each code block with blank lines (preserving line count).
 */
function stripCodeBlocks(content) {
  // Replace ``` fenced blocks (including optional language specifier)
  return content.replace(/^```[^\n]*\n([\s\S]*?)^```/gm, (match, body) => {
    const blankLines = body.replace(/[^\n]/g, '');
    return '```\n' + blankLines + '```';
  });
}

// ─── _meta.js validation ─────────────────────────────────────────────────────

async function validateMetaFiles() {
  const errors = [];
  const metaFiles = await glob('docs-site/content/**/_meta.js', {
    cwd: REPO_ROOT,
    absolute: true,
  });

  for (const metaPath of metaFiles) {
    const metaDir = dirname(metaPath);
    let exported;

    try {
      // Cache-bust with timestamp so repeated runs don't hit the module cache
      const mod = await import(pathToFileURL(metaPath).href + `?t=${Date.now()}`);
      exported = mod.default;
    } catch (err) {
      errors.push(`[_meta] ERROR: ${relative(REPO_ROOT, metaPath)} — failed to import: ${err.message}`);
      continue;
    }

    if (!exported || typeof exported !== 'object') continue;

    for (const [key, value] of Object.entries(exported)) {
      // Skip Nextra wildcard key
      if (key === '*') continue;

      // Skip separator and menu entries (they don't map to files)
      if (value && typeof value === 'object') {
        if (value.type === 'separator' || value.type === 'menu') continue;
      }

      // Skip keys that start with _ (Nextra internal separator convention)
      if (key.startsWith('_')) continue;

      // Check if key resolves to a .md/.mdx file or subdirectory
      if (!fileExists(join(metaDir, key))) {
        errors.push(
          `[_meta] BROKEN: ${relative(REPO_ROOT, metaPath)} → key "${key}" has no file or dir`
        );
      }
    }
  }

  return { errors, count: metaFiles.length };
}

// ─── markdown link validation ─────────────────────────────────────────────────

// Matches [text](url) and [text](url "title")
// Does NOT match ![image](url) — the leading [^\!] check handles that,
// but we do it by checking the char before the match via the surrounding regex structure.
// We use a capture that ensures [text]( syntax — image links start with ![ which is fine
// because we'd still want to validate image src links... but image src are typically
// media files not .md. We skip them below via the shouldSkipUrl check.
const LINK_RE = /\[([^\]]*)\]\(([^)#][^)"]*?)(?:\s+"[^"]*")?\)/g;

const SKIP_PREFIXES = ['http://', 'https://', 'mailto:', 'ftp:', '//'];

// URL patterns that indicate non-page content (images, media, data files)
const SKIP_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
                         '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.wav',
                         '.json', '.yaml', '.yml', '.toml', '.xml', '.csv'];

function shouldSkipUrl(url) {
  if (!url || url.trim() === '') return true;
  const trimmed = url.trim();

  // Pure fragment
  if (trimmed.startsWith('#')) return true;

  // External protocols
  for (const prefix of SKIP_PREFIXES) {
    if (trimmed.startsWith(prefix)) return true;
  }

  // Media / data file extensions
  const lower = trimmed.toLowerCase().split('#')[0].split('?')[0];
  for (const ext of SKIP_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }

  return false;
}

function resolveMarkdownUrl(url, sourceFilePath) {
  // Strip fragment
  const withoutFragment = url.split('#')[0].trim();
  if (!withoutFragment) return null; // was only a fragment

  // Strip .md or .mdx extension if present (Nextra routes don't use them)
  let withoutExt = withoutFragment;
  if (withoutExt.endsWith('.mdx')) withoutExt = withoutExt.slice(0, -4);
  else if (withoutExt.endsWith('.md')) withoutExt = withoutExt.slice(0, -3);

  if (withoutExt.startsWith('/')) {
    // Root-relative: resolve from CONTENT_DIR
    return join(CONTENT_DIR, withoutExt);
  } else {
    // Relative: resolve from source file's directory
    const sourceDir = dirname(sourceFilePath);
    return resolvePath(sourceDir, withoutExt);
  }
}

async function validateMarkdownLinks() {
  const errors = [];
  const warnings = [];
  const mdFiles = await glob('docs-site/content/**/*.md', {
    cwd: REPO_ROOT,
    absolute: true,
  });

  for (const filePath of mdFiles) {
    let rawContent;
    try {
      rawContent = readFileSync(filePath, 'utf8');
    } catch (err) {
      errors.push(`[link] ERROR: ${relative(REPO_ROOT, filePath)} — could not read file: ${err.message}`);
      continue;
    }

    // Remove code blocks to avoid false positives on code like (**params) or [key](value)
    const content = stripCodeBlocks(rawContent);
    const lines = content.split('\n');
    const isIndexFile = filePath.endsWith('/index.md');

    let inInlineCode = false; // simple per-line inline code tracking

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const currentLineNum = i + 1;

      // Skip lines that are entirely inline code or HTML comment lines
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('<!--')) continue;

      // Reset regex for each line
      LINK_RE.lastIndex = 0;
      let match;

      while ((match = LINK_RE.exec(line)) !== null) {
        const rawUrl = match[2].trim();

        if (shouldSkipUrl(rawUrl)) continue;

        // Gap 2: detect links that embed the basePath prefix
        if (rawUrl.startsWith(BASE_PATH + '/') || rawUrl === BASE_PATH) {
          const relSource = relative(REPO_ROOT, filePath);
          errors.push(
            `[link] BROKEN: ${relSource}:${currentLineNum} → ${rawUrl} — link embeds basePath prefix (use ${rawUrl.slice(BASE_PATH.length) || '/'} instead)`
          );
          continue;
        }

        const resolvedPath = resolveMarkdownUrl(rawUrl, filePath);
        if (!resolvedPath) continue;

        // Only validate links that resolve within CONTENT_DIR
        if (!resolvedPath.startsWith(CONTENT_DIR)) continue;

        if (!fileExists(resolvedPath)) {
          const relSource = relative(REPO_ROOT, filePath);
          const relResolved = relative(REPO_ROOT, resolvedPath);
          errors.push(
            `[link] BROKEN: ${relSource}:${currentLineNum} → ${rawUrl} (resolved: ${relResolved}.md)`
          );
        } else if (isIndexFile && rawUrl.startsWith('./')) {
          // Gap 1: relative ./subdir links in index pages are risky at runtime
          // The browser resolves ./ relative to the URL, which for index pages
          // (served without a trailing slash) means the PARENT directory, causing double-path 404s.
          const afterDotSlash = rawUrl.slice(2).split('/')[0].split('#')[0].split('?')[0];
          if (afterDotSlash) {
            // Check if the segment is a subdirectory (not a sibling file in same dir)
            const fileDir = dirname(filePath);
            const potentialSubdir = join(fileDir, afterDotSlash);
            if (isDirSync(potentialSubdir)) {
              const relSource = relative(REPO_ROOT, filePath);
              warnings.push(
                `[warn] RISKY: ${relSource}:${currentLineNum} → ${rawUrl} — relative link in index page may 404 at runtime (use absolute path instead)`
              );
            }
          }
        }
      }
    }
  }

  return { errors, warnings, count: mdFiles.length };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // --meta-only: only validate _meta.js keys (used in prebuild — these cause actual build failures)
  // --strict:    validate everything and exit 1 on any error (default for standalone run)
  // default:     validate everything, warn on markdown links, exit 1 only on _meta.js errors
  const args = process.argv.slice(2);
  const metaOnly = args.includes('--meta-only');
  const strict = args.includes('--strict');

  console.log('Validating internal links in docs-site/content/ ...\n');

  const metaResult = await validateMetaFiles();
  const linkResult = metaOnly ? { errors: [], warnings: [], count: 0 } : await validateMarkdownLinks();

  const metaErrors = metaResult.errors;
  const linkErrors = linkResult.errors;
  const linkWarnings = linkResult.warnings;
  const allErrors = [...metaErrors, ...linkErrors];

  if (allErrors.length > 0) {
    for (const err of allErrors) {
      console.log(err);
    }
    console.log('');
  }

  if (linkWarnings.length > 0) {
    for (const w of linkWarnings) {
      console.log(w);
    }
    console.log('');
  }

  const broken = allErrors.length;
  const riskyCount = linkWarnings.length;
  const mode = metaOnly ? ' [meta-only mode]' : strict ? ' [strict mode]' : '';
  console.log(
    `✓ ${linkResult.count} files checked, ${metaResult.count} _meta.js files checked, ${broken} broken links found, ${riskyCount} risky relative links (warnings)${mode}`
  );

  // In prebuild (meta-only): only fail on _meta.js errors (these break the Next.js build)
  // In strict mode: fail on any error
  // Default standalone: warn on markdown link errors, fail only on _meta.js errors
  const fatalCount = strict ? broken : metaErrors.length;
  process.exit(fatalCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
