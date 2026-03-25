import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../');
const PAGES_DIR = join(REPO_ROOT, 'docs-site/pages');

const TEMPLATES = {
  concept: `## Problem Statement\n\nWhat problem does this solve?\n\n## Real-World Context\n\nWhen do you actually need this?\n\n## Architecture\n\n\`\`\`mermaid\ngraph TD\n  A[Component] --> B[Component]\n\`\`\`\n\n## Implementation\n\n\`\`\`javascript\n// pseudocode\n\`\`\`\n\n## Trade-offs\n\n## Real Examples\n\n## Common Pitfalls\n\n## Key Takeaways\n`,
  problem: `## The Problem\n\n## Why It Happens\n\n## Impact\n\n## Solutions\n\n## Prevention\n`,
  poc: `## What You'll Build\n\n## Why This Matters\n\n## Setup\n\n\`\`\`bash\ndocker compose up -d\n\`\`\`\n\n## Implementation\n\n\`\`\`javascript\n// working code\n\`\`\`\n\n## Testing\n\n## Extensions\n`,
  solution: `## Overview\n\n## Implementation\n\n\`\`\`mermaid\ngraph TD\n\`\`\`\n\n## Code Example\n\n## Trade-offs\n\n## When Not to Use This\n`,
  'case-study': `## System Overview\n\n## Architecture\n\n\`\`\`mermaid\ngraph TD\n\`\`\`\n\n## Key Design Decisions\n\n## Database Design\n\n## Capacity Estimation\n\n## Trade-offs\n`,
  'interview-q': `## Question\n\n## Clarifying Questions to Ask\n\n## High-Level Design\n\n\`\`\`mermaid\ngraph TD\n\`\`\`\n\n## Deep Dives\n\n## Trade-offs\n\n## Follow-up Questions\n`,
};

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function main() {
  const [,, layer, section, ...titleParts] = process.argv;
  const title = titleParts.join(' ');

  if (section.includes('..')) {
    console.error('Invalid section path: must not contain ".."');
    process.exit(1);
  }

  if (!layer || !section || !title) {
    console.error('Usage: node scaffold-article.mjs <layer> <section-path> <title>');
    process.exit(1);
  }

  if (!TEMPLATES[layer]) {
    console.error(`Unknown layer: ${layer}. Must be one of: ${Object.keys(TEMPLATES).join(', ')}`);
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

  const frontmatter = [
    '---',
    `title: "${title}"`,
    `layer: ${layer}`,
    `section: ${section}`,
    `difficulty: intermediate`,
    `prerequisites: []`,
    `solves_with: []`,
    `related_problems: []`,
    `case_studies: []`,
    `see_poc: []`,
    `linked_from: []`,
    `tags: []`,
    '---',
  ].join('\n');

  const content = frontmatter + '\n\n# ' + title + '\n\n' + TEMPLATES[layer];
  writeFileSync(outPath, content);

  console.log(`✅ Created: docs-site/pages/${section}/${slug}.md`);
  console.log(`   Layer: ${layer}`);
  console.log(`   Next: fill in relationship fields, then run /sync-graph`);
  console.log(`   Remember: add "${slug}" to ${section}/_meta.js`);
}

main();
