---
title: "Messaging & Streaming"
description: "Async processing, event-driven systems, social feeds, content delivery, and document workflows"
---

# Messaging & Streaming

These questions cover asynchronous communication patterns — from event queues to news feeds to content delivery pipelines. Async design is a core skill for building scalable, decoupled systems.

## What's Covered

| Topic | Difficulty | Why It Matters |
|-------|-----------|----------------|
| Message Queues: Kafka vs RabbitMQ | 🟡 Intermediate | Choosing the right async backbone |
| Event-Driven Architecture | 🔴 Advanced | Decoupled systems that scale independently |
| Social Media Feed | 🔴 Advanced | Twitter/Instagram timeline — classic interview question |
| Audio Streaming (Spotify) | 🟡 Intermediate | Delivering audio to 574M users |
| PDF Converter | 🟡 Intermediate | Async document processing pipeline |
| CMS Design | 🟡 Intermediate | Content management with versioning and delivery |

## Study Order

Start with **Message Queues** to understand Kafka vs RabbitMQ trade-offs. Then **Event-Driven Architecture** for the broader pattern. **Social Media Feed** is a classic interview question worth mastering. **Audio Streaming** and **PDF Converter** demonstrate real async pipeline design.

## Common Interview Patterns

- "Design Twitter's feed" → Social media feed (fan-out on write vs read)
- "How would you process 1M uploads/hour?" → Message queues + async workers
- "How does Spotify stream audio without buffering?" → Audio streaming
- "What's the difference between Kafka and RabbitMQ?" → Message queues comparison
