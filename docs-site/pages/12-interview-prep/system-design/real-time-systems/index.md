---
title: "Real-Time Systems"
description: "Live streaming, video conferencing, collaborative editing, gaming backends, and WebSocket architectures"
---

# Real-Time Systems

These are some of the hardest system design questions — they require low latency, high throughput, and stateful connections at massive scale. Common in senior and staff-level interviews at companies like Google, Twitch, and Zoom.

## What's Covered

| Topic | Difficulty | Why It Matters |
|-------|-----------|----------------|
| WebSocket Architecture | 🔴 Advanced | Foundation for all real-time communication |
| Live Streaming (Twitch) | 🔴 Advanced | 15M concurrent viewers, sub-second latency |
| Video Streaming Platform | 🔴 Advanced | Netflix/YouTube scale video delivery |
| Video Conferencing | 🔴 Advanced | Zoom/Google Meet — WebRTC + media servers |
| Collaborative Editing (Google Docs) | 🔴 Advanced | OT/CRDT for simultaneous edits |
| Online Gaming Backend | 🔴 Advanced | Fortnite's 350M players, tick-rate servers |

## Study Order

Start with **WebSocket Architecture** as the foundation. Then **Video Streaming** (YouTube-style, easier), followed by **Live Streaming** (Twitch, harder due to latency requirements). **Video Conferencing** introduces WebRTC. **Collaborative Editing** and **Online Gaming** are the most complex — save these for last.

## Common Interview Patterns

- "How would you build a chat application?" → WebSocket architecture
- "Design YouTube" → Video streaming platform
- "Design Zoom" → Video conferencing + WebRTC
- "How does Google Docs handle simultaneous edits?" → Operational transforms / CRDT
- "What's the difference between live streaming and video-on-demand?" → Latency vs throughput trade-offs
