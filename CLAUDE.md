# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **System Design Knowledge Base** - a comprehensive, implementation-focused learning resource for developers. It contains 100+ articles covering system design fundamentals, real-world case studies, and practical proof-of-concepts (POCs).

**Main Component:**
- **docs-site/**: Nextra-powered documentation website containing all content (articles, POCs, interview prep)

**Philosophy**: 80/20 principle - cover 80% of essential system design topics with 20% of effort. Focus on practical implementation, real-world examples, and production-grade patterns.

**Note**: Historical root-level folders (01-databases through 12-consistency) have been archived to consolidate all content in docs-site/. Run `./archive-root-folders.sh` if cleanup hasn't been performed yet.

## Development Commands

### Documentation Site (docs-site/)

```bash
# Navigate to docs-site
cd docs-site

# Install dependencies (first time only)
npm install

# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint Next.js code
npm run lint
```

### Clear Next.js Cache (if having issues)

```bash
cd docs-site
rm -rf .next
npm run dev
```

## Repository Architecture

### Content Organization

All content is centralized in **docs-site/pages/**:

1. **System Design Topics** (`docs-site/pages/system-design/`):
   - `databases/` - Database scaling, replication, sharding (4 articles)
   - `caching/` - Caching strategies and patterns (1 article)
   - `queues/` - Message queues and async processing (1 article)
   - `patterns/` - Design patterns (1 article)
   - `case-studies/` - Real-world system designs (1 article)
   - `load-balancing/`, `scalability/`, `performance/`, `api-design/`, `monitoring/`, `security/`, `consistency/` - Index pages with planned articles

2. **Interview Preparation** (`docs-site/pages/interview-prep/`):
   - `system-design/` - 34+ system design interview questions
   - `security-encryption/` - Security interview topics
   - `aws-cloud/`, `database-storage/`, `caching-cdn/` - Cloud and infrastructure topics
   - `practice-pocs/` - 60+ hands-on proof-of-concepts

3. **Problems at Scale** (`docs-site/pages/problems-at-scale/`):
   - `concurrency/` - Race conditions, double booking, payment issues
   - `availability/` - Thundering herd, cascading failures
   - `scalability/`, `consistency/`, `performance/`, `data-integrity/`, `cost-optimization/` - Other problem categories

### Key Design Patterns

**Single Source of Truth**: All content lives in docs-site/pages/ for simplified maintenance and single-source management.

**Meta Files**: Each directory in `docs-site/pages/` has a `_meta.json` or `_meta.js` file that controls:
- Navigation order
- Section titles
- Icons/emojis for sidebar

**Article Structure**: Each comprehensive article follows this template:
1. Problem Statement - What problem does this solve?
2. Real-World Context - When you actually need this
3. Architecture Diagram - Visual representation (Mermaid)
4. Implementation - Pseudocode and examples
5. Trade-offs - Pros, cons, alternatives
6. Real Examples - How companies use this
7. Common Pitfalls - What to avoid
8. Key Takeaways - TL;DR summary

### Practice POCs

The `docs-site/pages/interview-prep/practice-pocs/` directory contains hands-on proof-of-concepts:
- **Redis POCs**: 10+ examples (cache, distributed lock, job queue, rate limiting, etc.)
- **Database POCs**: 20+ examples (CRUD, indexes, transactions, sharding, partitioning, etc.)
- **Kafka POCs**: Event streaming examples
- Each POC is implementation-focused with working code examples

## Content Guidelines

### When Adding New Articles

1. **Choose appropriate difficulty level**: Add emoji to title or meta
   - 🟢 Beginner - Fundamental concepts
   - 🟡 Intermediate - Requires basic knowledge
   - 🔴 Advanced - Complex distributed systems

2. **Include Mermaid diagrams**: Visual architecture helps understanding
   ```mermaid
   graph TD
     A[Component] --> B[Component]
   ```

3. **Provide real-world context**: Include traffic numbers, scale, when you actually need this

4. **Add code examples**: Use language-agnostic pseudocode or JavaScript/Node.js

5. **Reference real companies**: How Netflix, Instagram, Uber, etc. solve the problem

6. **Update navigation**: Add entry to appropriate `_meta.json` file

7. **Update cheat sheet**: Add a dense entry (key numbers + decision rule + trap + link) to the corresponding `cheat-sheets/<domain>.md` file — see "Cheat Sheet Update Rule" section below

### When Adding New Articles — Cheat Sheet Update Rule

**Every new concept article must also update its corresponding cheat sheet.**
POCs and index pages are exempt. Only articles that teach a concept need a cheat sheet entry.

#### 1. Article → Cheat Sheet Mapping

| Article location | Update this cheat sheet |
|-----------------|------------------------|
| `12-interview-prep/quick-reference/aws-cloud/` | `cheat-sheets/aws.md` |
| `12-interview-prep/quick-reference/databases/` | `cheat-sheets/databases.md` |
| `12-interview-prep/quick-reference/caching/` | `cheat-sheets/caching.md` |
| `12-interview-prep/quick-reference/security/` | `cheat-sheets/security.md` |
| `12-interview-prep/system-design/` | `cheat-sheets/system-design.md` |
| `01-databases/`, `02-caching/`, `03-redis/` | corresponding domain cheat sheet |
| `04-messaging/`, `05-distributed-systems/` | `cheat-sheets/messaging.md` |
| `06-scalability/`, `10-architecture/` | `cheat-sheets/system-design.md` |
| `07-api-design/`, `09-observability/` | `cheat-sheets/networking.md` |
| `08-security/` | `cheat-sheets/security.md` |
| `problems-at-scale/` | `cheat-sheets/system-design.md` |
| New domain (no existing cheat sheet) | Create `cheat-sheets/<domain>.md` + add to `cheat-sheets/_meta.js` |

#### 2. Cheat Sheet Entry Template

Add a new subsection to the relevant cheat sheet section. Each entry must be dense — no paragraphs:

```markdown
**[Topic Name]** — [one-line description]
| | [Option A] | [Option B] |
|-|-----------|-----------|
| [dimension] | [value] | [value] |

- Key number: [value] (memorize this)
- Decision: Use [A] when [condition] / [B] when [condition]
- Trap: [the #1 mistake candidates make]
- [Article link](../path/to/article)
```

Minimum required per entry:
- At least one key number or fact
- One decision rule (when to use X vs Y) if applicable
- One trap or pitfall
- Link to the full article

#### 3. Cheat Sheet Section Organization

Each cheat sheet is divided into numbered sections. Add new entries to the most relevant existing section. If the topic doesn't fit any existing section, add a new `## N. [Topic Name]` section at the end before any "Common Mistakes" or "Key Numbers" sections.

#### 4. Keeping Cheat Sheets Scannable

- Tables over paragraphs
- Bullet points over sentences
- Bold key numbers, not full sentences
- Max 5-8 lines per entry (quick scan, not full read)
- Link to deep article for anything needing more explanation

### When Adding Practice POCs

POCs should be:
- **Runnable**: Include actual code that can be executed
- **Focused**: Single concept per POC
- **Practical**: Solve real-world problems
- **Well-commented**: Explain what each section does
- **Self-contained**: Include setup instructions

## Project Roadmap Context

**Current Progress**:
- 25+ theory articles completed
- 30+ practice POCs completed
- Interview prep section with 149+ analyzed questions

**Priority Areas** (from CONTINUATION_PLAN.md):
1. Real-world scalability articles (streaming, high-traffic systems)
2. More practice POCs (target: 1000+)
3. Message queue POCs (Kafka, RabbitMQ)
4. API design POCs (REST, GraphQL, gRPC)

**Article Generation Plan**: Follow ARTICLE_GENERATION_PLAN.md for structured content creation across phases

## Working with Nextra

**Theme Configuration**: Edit `docs-site/theme.config.jsx` to customize:
- Logo, colors, footer
- Banner announcements
- Search placeholder text
- Social metadata

**Adding New Pages**:
1. Create `.md` or `.mdx` file in appropriate `docs-site/pages/` subdirectory
2. Add entry to `_meta.js` (or `_meta.json`) in that directory
3. Page automatically appears in navigation
4. All content should be created directly in docs-site/pages/ (no root-level folders)

**Search Issues**: If search isn't working, rebuild search index:
```bash
cd docs-site
rm -rf .next
npm run dev
```

## Git Workflow

**Main branch**: Not explicitly set (working on `dev` branch currently)

**Commit style**: Based on recent commits, use conventional format:
- `feat: Add POC #XX - Description`
- `feat: Add article on Topic (Week X Day Y)`

**Modified files tracking**: Check `git status` to see modified POCs and articles before committing

## Important Notes

- **Single source of truth**: All content is in docs-site/pages/ - don't create content in root directory
- **Mermaid diagrams work automatically**: Nextra supports them out of the box
- **Use `.mdx` for React components**: Use `.md` for simple markdown
- **100+ article structure exists**: Refer to PROJECT-SUMMARY.md and GETTING-STARTED.md for content roadmap
- **Interview prep is a key feature**: 120+ real questions with detailed answers
- **Production-grade focus**: Examples should reflect patterns used at scale (FAANG companies)
- **Archived folders**: Root-level numbered folders (01-12) have been archived - content lives in docs-site/

## Related Documentation

- `README.md` - Main repository overview
- `GETTING-STARTED.md` - Learning paths for different skill levels
- `PROJECT-SUMMARY.md` - Detailed content statistics and structure
- `CONTINUATION_PLAN.md` - Roadmap for future content
- `ARTICLE_GENERATION_PLAN.md` - Structured plan for 120+ articles
- `NAVIGATION-GUIDE.md` - Guide to navigating the knowledge base
- `docs-site/README.md` - Documentation site setup and features


## Session Changelog

At the end of each significant development session, create a session summary in `session-summary/` with the following:

### File Naming Convention

```
session-summary/YYYY-MM-DD_HH-MM-SS_<short-description>.md
```

Example: `2026-01-08_04-45-02_kms-architecture-docs.md`

### Session Summary Template

Each session summary should include:

1. **Header**: Date, Session ID, Duration
2. **Objective**: What was the goal of this session
3. **Changes Made**: Directory structure, files created/modified
4. **Key Technical Decisions**: Important choices made and rationale
5. **Architecture Highlights**: Summary of architectural changes
6. **Files Modified**: List of changed files
7. **Next Steps**: Suggested follow-up tasks
8. **Context at Session End**: Token usage, active plans, branch

### When to Create a Summary

Create a session summary when:
- Completing a major feature or documentation effort
- Making significant architectural changes
- Before context window approaches limits (>70% usage)
- At natural stopping points in multi-session work

### Recent Sessions

| Date | Session | Description |
|------|---------|-------------|
| 2026-01-10 | data-cleanup | Consolidated repository structure - migrated to single-source docs-site/ |
| 2026-01-10 | problems-at-scale-section | Added Problems at Scale section with concurrency and availability issues |
| 2026-01-09 | system-design-articles-phase4 | Added 16 system design articles (Microservices, Infrastructure, Database, Observability) |
| 2026-01-08 | observability-stack | Added OTel, Jaeger, Prometheus, Grafana to architecture docs |
| 2026-01-08 | kms-architecture-docs | Created comprehensive KMS architecture documentation (35 files) |