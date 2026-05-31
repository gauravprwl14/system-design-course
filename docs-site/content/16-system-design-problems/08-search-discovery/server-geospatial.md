---
title: "Design a Geospatial Map Tile Server"
layer: case-study
section: "16-system-design-problems/08-search-discovery"
difficulty: intermediate
tags: [map-tiles, geospatial, cdn, tile-pyramid, vector-tiles, webp, raster, mapbox, openstreetmap, cdn-caching]
category: search
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "Mapbox Tile Architecture"
    url: "https://docs.mapbox.com/help/getting-started/how-web-apps-work/"
    type: article
  - title: "OpenStreetMap Tile Server Infrastructure"
    url: "https://wiki.openstreetmap.org/wiki/Tile_servers"
    type: article
  - title: "ByteByteGo — Google Maps System Design"
    url: "https://www.youtube.com/@ByteByteGo"
    type: article
---

# Design a Geospatial Map Tile Server

**Difficulty**: 🟡 Intermediate
**Reading Time**: ~25 minutes
**The Core Problem**: How do you serve high-resolution map tiles to 100M users at sub-200ms load times globally — with a tile pyramid spanning 22 zoom levels and delta updates when geography changes?

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Capacity Estimation](#2-capacity-estimation)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Tile Pyramid System](#4-tile-pyramid-system)
5. [Tile Generation Pipeline](#5-tile-generation-pipeline)
6. [CDN Caching Strategy](#6-cdn-caching-strategy)
7. [Delta Updates](#7-delta-updates)
8. [Raster vs Vector Tiles](#8-raster-vs-vector-tiles)
9. [Key Design Decisions](#9-key-design-decisions)
10. [Interview Questions](#10-interview-questions)
11. [Key Takeaways](#11-key-takeaways)
12. [References](#12-references)

---

## 1. Requirements

### Functional
- Serve map tiles for any location on Earth at zoom levels 0–22
- Support raster (PNG/WebP images) and vector tiles
- Tiles updated when underlying map data changes (roads, buildings)
- Global delivery with < 200ms tile load time

### Non-Functional
- **Scale**: 100M daily active users, 10 tile requests per map view = 1B tile requests/day
- **Storage**: Pre-rendered tiles for zoom 0–14 (most of the world)
- **CDN hit rate**: > 99% for zoom levels 0–16 (static; rarely changes)
- **Freshness**: High-zoom tiles (17–22, building level) updated within 24 hours of data change

---

## 2. Capacity Estimation

| Metric | Estimate |
|--------|----------|
| Tile requests/day | 1B |
| Tile requests/sec (peak) | 1B / 86400 × 3× = **34,700 RPS** |
| Tile size (PNG, Z0–Z14) | avg 15 KB |
| CDN bandwidth/day | 1B × 15KB × (1 - 0.99 cache hit) = **150 GB from origin** |
| Total pre-rendered tiles | Sum(4^z) for z=0..14 = 357M tiles × 15KB = **5.3 TB** |
| Zoom 15–22 tiles (on-demand) | 357M × 4^8 = ~92 billion possible, but only ~1% have data = **~900M tiles** |
| OSM data size | ~100 GB (OpenStreetMap planet.osm file) |

---

## 3. High-Level Architecture

```mermaid
graph TD
    UserApp[Map App\nBrowser / Mobile] -->|GET /tiles/{z}/{x}/{y}.webp| CDN[CDN\nCloudFront / Fastly]
    CDN -->|Cache miss| TileServer[Tile Server\nOrigin]
    TileServer -->|Zoom 0-14| PrerenCache[Pre-rendered Cache\nS3]
    TileServer -->|Zoom 15-22| Renderer[On-Demand Renderer\nMapnik / Mapbox GL]
    Renderer --> VectorData[(Vector Data Store\nPostGIS)]
    DataPipeline[Data Pipeline\nOSM + updates] --> VectorData
    DataPipeline --> TileGen[Tile Generator\nBatch re-render]
    TileGen --> PrerenCache
    CDN --> UserApp
```

---

## 4. Tile Pyramid System

### Tile Coordinate System (XYZ / TMS)
```
Each tile identified by: {zoom_level}/{x}/{y}
  z=0: 1 tile covers entire Earth (256×256 px)
  z=1: 4 tiles (2×2 grid)
  z=2: 16 tiles (4×4 grid)
  ...
  z=N: 4^N tiles

Total tiles per zoom:
  z=0:   1 tile
  z=10:  1M tiles
  z=14:  268M tiles
  z=18:  68B tiles (impossible to pre-render all)

Tile URL: https://tiles.example.com/{z}/{x}/{y}.webp
  z=15, x=10406, y=12535 → area around NYC midtown at street level
```

### Zoom Level Use Cases
| Zoom | Resolution | Use Case |
|------|-----------|---------|
| 0–3 | Continent | World overview |
| 4–7 | Country/State | Regional maps |
| 8–12 | City | City-level navigation |
| 13–16 | Neighborhood | Street-level view |
| 17–22 | Building | Building/address detail |

```
Pre-render strategy:
  z=0–14 (357M tiles): Pre-render ALL, store in S3, cache in CDN
    These tiles change rarely (geography, major roads)
    Cost: 357M × 15KB = 5.3 TB storage

  z=15–22: On-demand render + cache in CDN
    Too many tiles to pre-render (68B at z=18)
    Render only when requested, cache aggressively
```

---

## 5. Tile Generation Pipeline

### Raster Tile Generation (Mapnik)
```
Input: Vector data (PostGIS database with OSM data)
Process:
  1. Load map stylesheet (MapCSS / CartoCSS): defines colors, line widths, labels
  2. Query PostGIS for features in tile bounding box
  3. Render to 256×256 PNG/WebP image

Rendering pipeline:
  Raw OSM data (100 GB) → import-osm → PostGIS (spatial DB)
  PostGIS → Mapnik renderer → PNG tiles → WebP compression → S3

Batch re-render for zoom 0–14:
  Parallelized: 100 renderer workers × 3,570 tiles/worker = 357M tiles
  Time: 357M tiles / (100 workers × 100 tiles/sec) = 9.9 hours
  Triggered: when major map data changes (new road, border change)

Rendering performance:
  z=0–10: fast (few features per tile): 200ms/tile
  z=15–18: slow (many buildings): 2–5s/tile → cache is critical
```

### PostGIS Spatial Queries
```
Tile renderer queries PostGIS for features in bounding box:
  ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)

Spatial indexes critical:
  CREATE INDEX ON roads USING GIST (geom);
  CREATE INDEX ON buildings USING GIST (geom);

Query: "Get all roads in tile z=15, x=10406, y=12535"
  SELECT ST_AsGeoJSON(geom), name, road_type
  FROM roads
  WHERE geom && ST_MakeEnvelope(-74.01, 40.75, -73.99, 40.77, 4326);

Index lookup: O(log N) via GiST → ~5ms for tile
```

---

## 6. CDN Caching Strategy

### Cache Keys
```
Tile URL is a perfect cache key: /tiles/15/10406/12535.webp
  - Deterministic: same tile always returns same image (until map data changes)
  - High reuse: popular areas (NYC, London) requested millions of times/day
  - Cache-Control: public, max-age=86400 (1 day for z0-14)

Cache-Control by zoom:
  z=0–10 (rarely changes): max-age=604800 (1 week)
  z=11–16 (occasional changes): max-age=86400 (1 day)
  z=17–22 (frequent changes): max-age=3600 (1 hour)
```

### CDN Architecture
```
CDN PoP placement:
  Need < 200ms → CDN PoP within 1000km of user
  Major providers: Cloudfront (600+ PoPs), Fastly (80+ PoPs), Akamai (4000+ PoPs)

Cache behavior:
  Popular tiles (z=10–14, major cities): 99%+ hit rate (millions of requests/day)
  Long-tail tiles (rural areas): low hit rate, served from origin

  CDN serves 99% of traffic; origin handles 1% (10M tile renders/day)

Tile purge on update:
  When map data changes → purge affected tiles from CDN
  CDN API: POST /v1/purge { urls: ["/tiles/15/10406/*"] }
  Partial purge by z/x prefix: invalidate entire sub-region
```

---

## 7. Delta Updates

### Map Data Change Workflow
```
OSM data update cadence:
  Minor (road renamed, new POI): hourly diff files available from OSM
  Major (new road, border change): weekly full planet reprocessing

Incremental update pipeline:
  1. Download OSM diff file (osmChange XML): ~50 MB/day for planet
  2. Apply to PostGIS: osm2pgsql --append
  3. Identify affected tiles:
     - Compute bounding box of changed geometries
     - List tile IDs at zoom 14–22 within bounding box
  4. Re-render only affected tiles (not full planet)
  5. Upload new tiles to S3 (overwrites old)
  6. Purge affected tiles from CDN

Efficient tile invalidation:
  Changed geometry → bounding box → affected tile IDs (at each zoom level)
  Z=14: 1 bbox → ~100 tile IDs
  Z=18: 1 bbox → ~25,600 tile IDs

Tool: tirex (tile rendering queue system, used by OpenStreetMap)
```

---

## 8. Raster vs Vector Tiles

| Feature | Raster Tiles (PNG/WebP) | Vector Tiles (MVT) |
|---------|------------------------|-------------------|
| Rendering | Server-side, pre-rendered | Client-side (GPU) |
| Tile size | 15–50 KB | 5–20 KB |
| Styling | Fixed in tile | Dynamic in client |
| Rotation | Pixelated | Crisp at any angle |
| Retina (2×) | Double storage | Same tile, CSS scale |
| Storage | 5.3 TB (z0–14) | 1–2 TB (smaller) |
| Client CPU | Minimal | Higher (WebGL rendering) |

```
Vector tile format: Mapbox Vector Tile (MVT / PBF)
  Protobuf-encoded geometry + attributes
  Client (Mapbox GL JS) renders using WebGL
  Advantage: single tile set works for any style (dark mode, satellite, custom)

Raster still used for:
  Satellite imagery (inherently raster)
  Complex styles too expensive to render on client
  Older devices without WebGL support
```

---

## 9. Key Design Decisions

| Decision | Option A | Option B | Choice & Reason |
|----------|----------|----------|-----------------|
| Tile type | Raster (PNG) | Vector (MVT) | **Vector** for general maps (smaller, stylable, retina-ready); raster for satellite imagery |
| Pre-render scope | All zoom levels | Only z=0–14 | **z=0–14 only** — z=18 has 68B possible tiles, 99% empty; on-demand render + CDN cache for high zoom |
| CDN provider | Single CDN | Multi-CDN | **Multi-CDN** — map tile latency is user-facing; failover to secondary CDN if primary has issues |
| Update strategy | Full re-render | Delta (affected tiles only) | **Delta** — full planet re-render takes 10 hours; delta updates affected tiles in < 30 minutes |
| Image format | PNG | WebP | **WebP** — 25–30% smaller than PNG at same quality; supported by all modern browsers |

---

## 10. Interview Questions

| Question | Key Answer |
|----------|-----------|
| How do you handle a tile that spans multiple data regions? | Tile renderer queries by bounding box; spatial index handles cross-region features natively |
| How do you prevent hot-spot tiles (Times Square at z=18) from overloading origin? | CDN caches after first render; even at 10k requests/sec, only 1 origin request (first miss) |
| How do you serve satellite imagery? | Different pipeline: raw satellite images → geo-referenced → tiled at each zoom level; raster only (no vector) |
| How do you generate retina (2×) tiles? | Vector tiles: single tile, CSS scales up; raster: render at 512×512 for @2x URL suffix |
| What's the storage cost for the full tile pyramid? | z=0–14: 5.3 TB; z=15–18 (cached hot tiles): ~500 GB; total: ~6 TB (manageable on S3) |

---

## 11. Key Takeaways

- **Tile pyramid** (XYZ scheme) is the universal map tile standard — each zoom doubles linear resolution (4× tiles)
- **Pre-render only z=0–14** (357M tiles, 5.3 TB) — rendering all zoom levels is physically impossible; on-demand + CDN cache for high zoom
- **CDN cache hit rate > 99%** is achievable for popular areas — the same Times Square tile is requested millions of times daily
- **WebP over PNG** for raster tiles — 25–30% smaller, cutting CDN egress proportionally at 1B requests/day
- **Delta updates** (re-render only changed tiles) are critical — full planet re-render takes 10 hours; delta keeps map fresh in < 30 minutes

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [Mapbox Tile Architecture](https://docs.mapbox.com/help/getting-started/how-web-apps-work/) | 📖 Blog | Vector tile format, styling, and serving architecture |
| [ByteByteGo — Google Maps Design](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Tile pyramid, CDN strategy, and geospatial system design |
| [OpenStreetMap Tile Server Wiki](https://wiki.openstreetmap.org/wiki/Tile_servers) | 📚 Book | Open-source tile server infrastructure and toolchain |
| [Mapnik Documentation](https://mapnik.org/documentation/) | 📚 Book | Raster map rendering engine used by OSM and many providers |
