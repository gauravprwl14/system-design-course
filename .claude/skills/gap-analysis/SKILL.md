---
name: gap-analysis
description: Analyze the knowledge graph and report missing connections — concepts with no POC, problems with no solution, orphaned nodes, and thin topic coverage.
---

# /gap-analysis

Analyze the knowledge graph for gaps and produce a prioritized list of missing content.

## Steps

1. First ensure `/sync-graph` has been run recently.

2. Run the sync script to get the gap report:

```bash
cd /home/ubuntu/home/project/system-design-course/.claude/scripts && node sync-links.mjs 2>&1 | grep -A1000 "GAP REPORT"
```

3. Analyze and present gaps in priority order:
   - **Critical**: Problems with no `solves_with` (readers have no path forward)
   - **High**: Concepts with no `see_poc` (no hands-on practice)
   - **Medium**: POCs with no `prerequisites` (floating, hard to discover)
   - **Low**: Case studies not referenced by any theory article

4. Suggest the top 5 next articles to write based on gap density.
