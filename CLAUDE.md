# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **System Design Knowledge Base** - a comprehensive, implementation-focused learning resource for developers. It contains 100+ articles covering system design fundamentals, real-world case studies, and practical proof-of-concepts (POCs).

**Two Main Components:**
1. **Root directory**: Markdown articles organized by topic (databases, caching, queues, etc.)
2. **docs-site/**: Nextra-powered documentation website that renders all content

**Philosophy**: 80/20 principle - cover 80% of essential system design topics with 20% of effort. Focus on practical implementation, real-world examples, and production-grade patterns.

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

The repository follows a **dual structure** pattern:

1. **Source Content** (root directory): Original markdown files organized by topic
   - `01-databases/` - Database scaling, replication, sharding
   - `02-caching/` - Caching strategies and patterns
   - `03-queues/` - Message queues and async processing
   - `04-load-balancing/` through `12-consistency/` - Other core topics
   - `interview-prep/` - Interview questions organized by category

2. **Documentation Site** (docs-site/): Nextra site that renders the content
   - `docs-site/pages/system-design/` - Symlinked to root topic directories
   - `docs-site/pages/interview-prep/` - Interview prep content
   - `docs-site/theme.config.jsx` - Nextra theme configuration
   - `docs-site/pages/_meta.js` - Navigation structure

### Key Design Patterns

**Content Symlinks**: The docs-site uses symbolic links to reference markdown files from the root directory. This allows single-source content management.

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

The `interview-prep/practice-pocs/` directory contains hands-on proof-of-concepts:
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
1. Create `.md` or `.mdx` file in appropriate `pages/` subdirectory
2. Add entry to `_meta.json` in that directory
3. Page automatically appears in navigation

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

- **Don't create duplicate content**: Articles exist in root, referenced by docs-site via symlinks
- **Mermaid diagrams work automatically**: Nextra supports them out of the box
- **Use `.mdx` for React components**: Use `.md` for simple markdown
- **100+ article structure exists**: Refer to PROJECT-SUMMARY.md and GETTING-STARTED.md for content roadmap
- **Interview prep is a key feature**: 149+ real questions with detailed answers
- **Production-grade focus**: Examples should reflect patterns used at scale (FAANG companies)

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
| 2026-01-08 | observability-stack | Added OTel, Jaeger, Prometheus, Grafana to architecture docs |
| 2026-01-08 | kms-architecture-docs | Created comprehensive KMS architecture documentation (35 files) |