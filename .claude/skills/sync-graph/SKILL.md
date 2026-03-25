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
