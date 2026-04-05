# Audio Listen Feature — Design Spec

**Date**: 2026-04-05  
**Status**: Approved  
**Approach**: Web Speech API (browser-native, zero cost)

---

## Overview

Add a "Listen to this article" audio player to selected articles in the System Design Knowledge Base. Users can click Play and have the article read aloud by the browser's built-in TTS engine — no server, no API calls, no storage cost.

The feature is **config-driven** and **opt-in per article** via frontmatter. The player is only visible on explicitly enabled articles.

---

## Architecture

```
Markdown Article (tts: true in frontmatter)
        ↓
layout.jsx reads frontmatter (server component)
  → if tts === true → inject <AudioPlayer /> into TOC extraContent
        ↓
AudioPlayer (client component)
  → on Play: queries article DOM → extracts clean text → splits into chunks
  → feeds chunks sequentially to window.speechSynthesis
  → exposes: Play/Pause, Stop, Speed dropdown, Progress bar
        ↓
User hears the article
(100% browser-side — no server, no API, no cost)
```

---

## Config System

### Two levels of config

#### 1. Article-level (frontmatter)

Minimum required to enable audio:

```yaml
---
title: "Circuit Breaker Pattern"
tts: true
---
```

Optional overrides:

```yaml
---
tts: true
tts_skip: ["code", "tables", "diagrams"]   # override global skip list
tts_intro: "Welcome to the Circuit Breaker deep dive."  # custom opening line
---
```

#### 2. Global defaults (`docs-site/audio.config.js`)

```js
export const audioDefaults = {
  // content types skipped globally (overridable per article via tts_skip)
  skip: ['code', 'diagrams'],

  // speed options shown in dropdown
  speeds: [0.75, 1, 1.25, 1.5, 2],
  defaultSpeed: 1,

  // preferred voice language (browser falls back if unavailable)
  voiceLang: 'en-US',
}
```

This file is the single knobs panel — no logic, only values.

---

## AudioPlayer Component

### File structure

```
docs-site/
├── audio.config.js
├── components/
│   └── AudioPlayer/
│       ├── index.jsx              ← UI only, consumes the hook
│       ├── useAudioPlayer.js      ← all Web Speech API logic
│       └── extractArticleText.js  ← DOM text extraction utility
```

### State

```js
{
  status: 'idle' | 'playing' | 'paused',
  speed: 1,
  progress: 0,          // 0–100 percentage
  currentChunk: 0,
  totalChunks: N,
  estimatedTime: null   // seconds remaining
}
```

### Chunking strategy

The Web Speech API silently fails or crashes on very long strings. Solution: split article text at paragraph/heading boundaries into chunks, then chain them:

```
Full article text
  → split by paragraph / heading
  → chunks = ['Intro...', 'Section 1...', ...]
  → speak chunks[0]
      utterance.onend → speak chunks[1]
      utterance.onend → speak chunks[2]
      ...
Progress = currentChunk / totalChunks * 100
```

### DOM text extraction

**Included:**
- `article h1, h2, h3, h4` — headings
- `article p` — body paragraphs
- `article li` — bullet points
- `article blockquote` — callouts

**Skipped (globally):**
- `pre, code, .nextra-code` — code blocks
- `[class*="mermaid"]` — diagrams
- `table` — confusing when spoken linearly
- `.nextra-callout .icon` — emoji icons
- `nav, footer, .toc` — layout chrome

Per-article `tts_skip` frontmatter overrides the global skip list for that article only.

### UI

```
┌─────────────────────────────────────┐
│  🔊 Listen to this article          │
│                                     │
│  [▶ Play]  [■ Stop]                 │
│                                     │
│  Speed: [1x ▾]                      │
│                                     │
│  ████████░░░░░░░░  45%  ~4 min left │
└─────────────────────────────────────┘
```

Renders inside TOC `extraContent` slot (already exists in `layout.jsx`).  
Speed options are driven by `audio.config.js → speeds` array.

### Error handling & logging

**On API unavailability** (iOS Safari, unsupported browser):

```js
if (typeof window === 'undefined' || !window.speechSynthesis) {
  console.warn('[AudioPlayer] speechSynthesis not available', {
    browser: navigator.userAgent,
    reason: 'API missing or restricted (likely iOS Safari)',
  })
  return null  // hide component silently
}
```

**On playback error:**

```js
utterance.onerror = (event) => {
  console.error('[AudioPlayer] speech error', {
    error: event.error,        // e.g. 'canceled', 'interrupted', 'audio-busy'
    chunk: currentChunk,
    totalChunks,
    text: chunk.slice(0, 100)  // first 100 chars of failing chunk
  })
}
```

This allows debugging from DevTools → Console without surfacing errors to the user.

---

## Browser Compatibility

| Browser | Status |
|---|---|
| Chrome / Edge | Full support |
| Firefox | Full support |
| Safari macOS | Full support |
| Safari iOS | Restricted — user gesture required, no auto-play |
| Samsung Internet | Full support |

Component hides itself gracefully if `window.speechSynthesis` is undefined.

---

## MVP Rollout Plan

### Phase 0 — Build & validate (3 articles)

Enable on these 3 articles from `10-architecture/concepts/`:

| File | Reason |
|---|---|
| `circuit-breaker.md` | Most searched concept, dense prose |
| `microservices-architecture.md` | Entry point for most users, very long |
| `event-driven-architecture.md` | Complex, benefits most from listen-while-commuting |

Change per article: add `tts: true` to frontmatter. Nothing else.

**Validate**: voices load, chunking works, progress tracks, errors log correctly.

### Phase 1 — Expand to full section

Enable all of `10-architecture/concepts/` (~18 articles).  
One line per article in frontmatter.

### Phase 2 — Full rollout

- Enable remaining sections one by one
- Evaluate upgrading to floating bar UI (zero AudioPlayer logic changes needed)
- Evaluate upgrading to pre-generated audio (AWS Polly / Google TTS) for better voice quality

---

## What's Out of Scope (MVP)

- Pre-generated audio files (Phase 2 consideration)
- Floating sticky player bar (Phase 2 upgrade)
- Voice selection UI (user picks voice)
- Highlighting text as it's read
- Mobile-first layout changes
