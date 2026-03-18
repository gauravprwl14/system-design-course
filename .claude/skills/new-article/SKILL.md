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
