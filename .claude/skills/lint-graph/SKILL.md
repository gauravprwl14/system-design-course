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
   - ❌ Broken references: list each file and the broken path
   - ⚠️ Stale linked_from: suggest running `/sync-graph` to fix

3. Exit code 1 means broken references exist (suitable for CI).
