---
title: "Storage & Databases"
description: "Database scaling, search systems, distributed file storage, and geospatial queries at scale"
---

# Storage & Databases

These questions focus on the data layer — how you store, index, search, and retrieve data at massive scale. Database design questions are among the most common in senior engineer interviews.

## What's Covered

| Topic | Difficulty | Why It Matters |
|-------|-----------|----------------|
| Database Replication | 🟡 Intermediate | Read scaling and high availability |
| Database Sharding | 🔴 Advanced | Horizontal scaling for petabyte-scale data |
| Database Indexing Deep Dive | 🔴 Advanced | Query performance fundamentals |
| Distributed File System (GFS/HDFS) | 🔴 Advanced | Storing large files across many machines |
| Search Engine Architecture | 🔴 Advanced | Building Google-scale search with Elasticsearch |
| Typeahead Search | 🟡 Intermediate | Autocomplete at millions of queries/second |
| Geospatial Service | 🔴 Advanced | Proximity queries — used in Uber, Lyft, DoorDash |

## Study Order

Start with **Replication** and **Sharding** as these are foundational. **Indexing** rounds out your SQL knowledge. Then move to **Typeahead Search** (often asked standalone), followed by **Search Engine Architecture**, **Geospatial**, and **Distributed File System** for advanced rounds.

## Common Interview Patterns

- "How would you scale your database to 1 billion users?" → Sharding + replication
- "Design Uber's driver location feature" → Geospatial service
- "How does Google autocomplete work?" → Typeahead search
- "Design HDFS or S3" → Distributed file system
