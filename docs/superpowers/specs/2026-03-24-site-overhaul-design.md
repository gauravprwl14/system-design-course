# Site Overhaul Design Spec
**Date:** 2026-03-24
**Branch:** upgrade/nextra-4

## Objective

Fix all 404 navigation issues, add AI Agents interview content, and add Mermaid diagrams to the 106 content files that currently lack them — all in parallel using isolated git worktrees.

## Problem Summary

1. **404s on navigation** — `/system-design/messaging` and similar paths give 404 due to:
   - `_meta.js` files missing `index` entries for section landing pages
   - Broken relative links using old paths (e.g., `/messaging/...` instead of `/04-messaging/...`)
2. **Missing AI Agents interview content** — `13-agent-workflows` has agent content but `12-interview-prep` has no AI/agents interview Q&A
3. **106 content files without diagrams** — primarily overview stubs, CONTEXT files, and section index pages

## Architecture

### Four Parallel Agents in Isolated Worktrees

#### Agent A — Navigation & 404 Fixes
**Branch:** `fix/navigation-404s`

Scope:
- Audit every section `_meta.js` to ensure `index` entry is present where `index.md` exists
- Fix `04-messaging/_meta.js` (add index entry)
- Fix broken links in `navigation.md`, cheat sheets, and concept files using old paths
- Verify `/system-design/12-interview-prep` renders with proper sidebar
- Add missing overview stubs where `_meta.js` references them but files don't exist

#### Agent B — AI Agents Interview Section
**Branch:** `feat/ai-agents-interview`

Scope:
- Create `12-interview-prep/system-design/ai-and-agents/` directory
- Create `_meta.js` for the new section
- Write 6–8 interview Q&A files:
  1. `agent-loop-design.md` — designing the agent perception-action loop
  2. `tool-calling-patterns.md` — function calling, tool schemas, safety
  3. `multi-agent-coordination.md` — orchestrator/worker patterns, state sharing
  4. `rag-architecture.md` — retrieval-augmented generation system design
  5. `llm-api-design.md` — designing APIs on top of LLMs (rate limiting, caching, fallbacks)
  6. `agent-observability.md` — tracing, evals, prompt versioning
  7. `prompt-injection-defense.md` — attack vectors and mitigations
- Update `12-interview-prep/system-design/_meta.js` to include `ai-and-agents`
- Update `12-interview-prep/index.md` to mention the new section

Each file must include: problem statement, clarifying questions, architecture diagram (Mermaid), key components, trade-offs, real examples, common pitfalls.

#### Agent C — Diagrams Batch 1
**Branch:** `feat/diagrams-batch-1`

Scope: Add Mermaid diagrams to files in:
- `12-interview-prep/` overview and section files (~25 files)
- `problems-at-scale/` overview and CONTEXT files (~15 files)

#### Agent D — Diagrams Batch 2
**Branch:** `feat/diagrams-batch-2`

Scope: Add Mermaid diagrams to files in:
- `06-scalability/` overview files (~5 files)
- `13-agent-workflows/` case-studies overview (~3 files)
- `interview-prep/` CONTEXT files (~10 files)
- Remaining overview stubs across all sections

## Merge Strategy

All four branches target `upgrade/nextra-4`. After all agents complete:
1. Merge Agent A first (navigation fixes are foundational)
2. Merge Agent B (new content)
3. Merge Agents C and D (diagram additions, no conflicts expected)
4. `npm run build` in `docs-site/`
5. `pm2 restart system-design`

## Success Criteria

- [ ] `/system-design/04-messaging` and all section landing pages return 200
- [ ] Sidebar shows on all section pages
- [ ] `12-interview-prep` has AI Agents section visible in navigation
- [ ] All content `.md` files have at least one Mermaid diagram
- [ ] No broken links in cheat sheets or navigation.md
