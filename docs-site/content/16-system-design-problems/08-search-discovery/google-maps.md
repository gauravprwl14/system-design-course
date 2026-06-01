---
title: "Design Google Maps — Navigation at Scale"
layer: case-study
section: "16-system-design-problems/08-search-discovery"
difficulty: advanced
tags: [graph, dijkstra, routing, tile-serving, geospatial, traffic, maps]
category: scalability
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "System Design Interview – Alex Xu Vol 2"
    url: "https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119"
    type: article
  - title: "Google Maps — How it Works Under the Hood"
    url: "https://cloud.google.com/blog/products/maps-platform/15-years-of-google-maps-platform"
    type: article
  - title: "Routing Algorithms — Contraction Hierarchies"
    url: "https://en.wikipedia.org/wiki/Contraction_hierarchies"
    type: article
---

# Design Google Maps — Navigation at Scale

**Difficulty**: 🔴 Advanced
**Reading Time**: Coming Soon
**Interview Frequency**: High

---

## The Core Problem

Computing shortest routes across 100 million road segments with real-time traffic in under 500ms — naive Dijkstra on a full road graph would take minutes. Hierarchical routing algorithms pre-compute "important" roads (highways, arterials) so routing can skip low-level roads, achieving sub-second performance on global-scale graphs.

## Functional Requirements

- Navigate between two locations with turn-by-turn directions
- Account for real-time traffic conditions
- Support walking, driving, cycling, transit modes
- Show map tiles at multiple zoom levels
- Estimated arrival time (ETA) with confidence interval

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Route computation latency | p99 < 500ms for driving routes |
| Map tile delivery | < 100ms from CDN |
| Traffic freshness | Road speeds updated every 2 minutes |
| Scale | 1B users, 25M route requests/day |

## Back-of-Envelope Estimates

- **Route requests**: 25M/day ÷ 86,400 = ~290 routing computations/sec
- **Road graph size**: 100M road segments × 100 bytes = ~10GB — fits in RAM on a large machine
- **Map tiles**: World map at 21 zoom levels → ~4.3 trillion tiles (99% ocean/empty; store only ~100B tiles)

## Key Design Decisions

1. **Contraction Hierarchies for Fast Routing** — pre-process road graph: add "shortcut" edges for frequent highway paths; during query, expand search from both source and destination simultaneously (bidirectional Dijkstra) only on high-importance nodes; reduces search space from 100M to ~1,000 nodes.
2. **Time-Dependent Edge Weights** — edge weight (travel time) varies by time of day and real-time traffic; incorporate historical speed profiles (Mon 8am on I-405 = 15mph) + live sensor/GPS data; re-weight edges every 2 minutes from anonymized user GPS.
3. **Vector Tiles for Map Rendering** — encode map geometry (roads, buildings) as vector data per tile; client renders at native resolution; tiles smaller than raster images; zoom and pan without re-requesting tiles; cache aggressively at CDN and client.

## High-Level Architecture

```mermaid
graph TD
    User[Mobile App] --> RoutingAPI[Routing API]
    RoutingAPI --> RouterEngine[Routing Engine\nContraction Hierarchies]
    RouterEngine --> RoadGraph[Road Graph DB\nIn-memory weighted graph]
    TrafficIngest[GPS / Sensor Data] --> TrafficProcessor[Traffic Processor\nReal-time speed updates]
    TrafficProcessor --> RoadGraph
    User --> TileAPI[Tile API]
    TileAPI --> TileCDN[Tile CDN\nVector tiles]
    TileCDN -->|Miss| TileStore[Tile Store\nGenerated from OSM]
```

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| Why doesn't Google Maps use plain Dijkstra on the full road graph? | Algorithm scalability, graph size |
| How does Google collect real-time traffic data? | Crowdsourced GPS, privacy implications |
| How would you re-route a user who takes a wrong turn? | Incremental re-routing, cost of replanning |

## Related Concepts

- [Yelp nearby search for point-of-interest lookup on maps](./yelp-nearby)
- [Uber Backend for real-time driver routing on the same map data](../04-reservation-scheduling/uber-backend)

---

*Full deep-dive with multiple approaches, trade-off tables, and pseudocode below.*

---

## Component Deep Dive 1: Routing Engine — Contraction Hierarchies

The routing engine is the most latency-critical component in the entire system. A naive Dijkstra run on a 100 million node road graph takes 5–30 seconds — far beyond the 500ms p99 target. The solution is **Contraction Hierarchies (CH)**, a two-phase algorithm that pre-processes the graph offline and then answers online queries in milliseconds.

**Phase 1 — Preprocessing (offline, runs nightly):**

Every node in the road graph is assigned an "importance" rank. Importance is computed by simulating removal of a node and counting how many shortest paths need new shortcut edges to maintain correctness. Motorways and major arterials rank highest; residential cul-de-sacs rank lowest. Nodes are iteratively contracted from least to most important. When a node is contracted, shortcut edges are added between its neighbors if the shortest path between them passes through that node. After contraction, the graph has ~2–3x more edges but queries only need to visit the top 0.01% of nodes (roughly 10,000 nodes out of 100 million).

**Phase 2 — Online Query (bidirectional Dijkstra on hierarchy):**

At query time, a bidirectional search runs simultaneously from source and destination. The forward search only traverses edges going up the importance hierarchy; the backward search only traverses edges going down. The two frontiers meet somewhere in the middle at a high-importance node (usually a motorway junction). This reduces the effective search space from 100 million nodes to roughly 1,000 nodes, yielding query times of 1–10ms on a single core.

**Time-dependent CH (TDCH):**

Traffic makes edge weights non-constant. Each road segment stores a speed profile array — 288 slots (one per 5 minutes over 24 hours) — encoding historical speeds by day-of-week and time-of-day. Real-time GPS deltas are blended in with exponential decay (recent observations weighted 3x more than 1-hour-old data). TDCH re-runs preprocessing every 4 hours for structural changes (road closures, construction) and applies live edge-weight patches without full recomputation.

```mermaid
sequenceDiagram
    participant Client
    participant RoutingAPI
    participant CHEngine
    participant GraphStore
    participant TrafficStore

    Client->>RoutingAPI: POST /route {origin, dest, depart_at}
    RoutingAPI->>TrafficStore: GetEdgeWeights(region_bbox, depart_at)
    TrafficStore-->>RoutingAPI: live_speed_map[edge_id → speed_mps]
    RoutingAPI->>CHEngine: Query(origin_node, dest_node, edge_weights)
    CHEngine->>GraphStore: LoadContractedSubgraph(region)
    GraphStore-->>CHEngine: contracted_graph (in-memory slab)
    CHEngine-->>CHEngine: Bidirectional Dijkstra (forward up / backward up)
    CHEngine-->>RoutingAPI: path_node_ids[], total_time_sec
    RoutingAPI-->>Client: turn_by_turn[], eta, polyline
```

| Approach | Query Latency | Preprocessing Time | Memory | Trade-off |
|----------|--------------|-------------------|--------|-----------|
| Plain Dijkstra | 5–30s | None | 10GB | Correct, too slow for p99 target |
| A* with heuristic | 500ms–2s | None | 10GB | Better than Dijkstra but still 10x too slow for complex routes |
| Contraction Hierarchies | 1–50ms | 4–8h (global) | 25GB (with shortcuts) | Fastest queries; preprocessing must re-run on topology changes |
| RAPTOR (transit) | 20–200ms | 1–2h | 5GB | Optimal for public transit; not applicable to driving |

---

## Component Deep Dive 2: Real-Time Traffic Ingestion Pipeline

Traffic data is not collected from roadside sensors alone — the majority comes from anonymized GPS pings from users who have opted into location sharing. Google Maps processes roughly **25 million active navigation sessions** at peak, generating ~1 GPS ping per second per session = **25 million GPS events/sec**. This stream cannot be stored raw and must be aggregated into per-segment speed estimates within 2 minutes.

**Ingestion flow:**

GPS pings arrive via a gRPC stream from mobile clients. Each ping carries `{user_token_hash, lat, lng, speed_mps, heading_deg, accuracy_m, timestamp_ms}`. The user token is one-way hashed on-device — no PII reaches the backend. A map-matching service snaps each GPS point to the most likely road segment using Hidden Markov Model (HMM) inference. The matched result is `{segment_id, observed_speed_mps, confidence}`.

A distributed stream processor (Apache Kafka + Flink) partitions events by `segment_id` and maintains a rolling 2-minute window. For each segment it computes a weighted median speed, discarding outliers (e.g., stopped GPS points during a tunnel). The median is written to a Redis cluster keyed by `segment_id` with a 5-minute TTL.

**At 10x load (250M events/sec):**

Kafka partitioning becomes the bottleneck. The fix is geographic sharding — each Kafka topic partition is assigned a geohash cell (precision 5 ≈ 4.9km × 4.9km cells), capping partition throughput at ~2.5M events/sec. Flink scales horizontally across partitions. Redis write throughput limits at ~500k writes/sec per node; at 10x load, Redis Cluster with 50 shards handles ~25M writes/sec total.

```mermaid
graph LR
    GPS[Mobile GPS Pings\n25M events/sec] --> Kafka[Kafka\nPartitioned by geohash]
    Kafka --> MapMatch[Map Matching Service\nHMM snap to road segment]
    MapMatch --> Flink[Flink Stream Processor\n2-min rolling window per segment]
    Flink --> Redis[Redis Cluster\nsegment_id → speed_mps, TTL=5min]
    Redis --> CHEngine[Routing Engine\nedge weight lookup]
    Flink --> HistoricalDB[BigTable\nlong-term speed profiles]
```

| Approach | Latency to Update | Storage | Staleness Risk |
|----------|------------------|---------|----------------|
| GPS crowdsourcing (current) | 2 min | ~50GB Redis (active segments) | Low if user density high; high on rural roads |
| Road sensor networks | 5–15 min | Negligible | Moderate; fixed install locations |
| Commercial data feeds (TomTom, HERE) | 5 min | External API cost | Low accuracy; expensive per-call |

---

## Component Deep Dive 3: Tile Serving and Vector Tile Generation

Map tiles are pre-rendered slices of the world at 21 discrete zoom levels. At zoom 0, the entire world fits in a single 256×256 tile. At zoom 21, a single tile covers roughly 0.3m × 0.3m — individual buildings are visible. The total tile count across all zoom levels is ~4.3 trillion, but 99% of Earth is ocean or uninhabited; the meaningfully unique tile set is ~100 billion tiles.

**Vector vs. Raster tiles:**

Raster tiles are PNG/JPEG images pre-rendered server-side. They are large (10–100KB each) and fixed-resolution — zooming in makes them blurry. Google Maps switched to vector tiles around 2013. Vector tiles encode geometry as binary Protocol Buffer data (roads as polylines, buildings as polygons, labels as point + text). File size is 5–20KB per tile. The client GPU renders the geometry at native display resolution. This enables smooth zoom animations (fractional zoom levels) and reduces total tile bytes transferred by ~80%.

**Tile generation pipeline:**

Raw geodata (OpenStreetMap contributions + proprietary surveys + satellite imagery analysis) is processed by a Geo Data Processing pipeline that simplifies geometry (Douglas-Peucker algorithm), assigns style layers, and encodes into Mapbox Vector Tile (MVT) format. Tiles are generated in parallel using a global job queue — rendering all 100B relevant tiles takes ~3 days on a 10,000-core cluster. Changed tiles (due to new road data or business updates) are re-rendered incrementally within minutes using a change-detection diff feed.

**Quadtree decomposition and tile addressing:**

The tile coordinate system uses a quadtree structure. At zoom level `z`, the world is divided into a 2^z × 2^z grid of tiles. Each tile at zoom `z` subdivides into four tiles at zoom `z+1`. Tiles are addressed by `(z, x, y)` where `x` is the column (west=0) and `y` is the row (north=0). This scheme lets clients request precisely the tiles visible in the current viewport based on screen bounds and zoom level, without any server-side computation.

```mermaid
graph TD
    Z0["Zoom 0 — 1 tile<br/>(entire world)"]
    Z1["Zoom 1 — 4 tiles<br/>(hemispheres)"]
    Z2["Zoom 2 — 16 tiles<br/>(continental scale)"]
    Z10["Zoom 10 — ~1M tiles<br/>(city scale, ~150km²/tile)"]
    Z15["Zoom 15 — ~1B tiles<br/>(neighborhood scale, ~1km²/tile)"]
    Z21["Zoom 21 — ~4.3T tiles<br/>(building scale, ~0.3m²/tile)"]

    Z0 -->|split into 4| Z1
    Z1 -->|split into 4| Z2
    Z2 -->|"... ×4 per level"| Z10
    Z10 -->|"... ×4 per level"| Z15
    Z15 -->|"... ×4 per level"| Z21
```

Each quadtree node corresponds to a bounded geographic region (bounding box). This hierarchical structure enables efficient spatial queries: to find all tiles that intersect a viewport, traverse the quadtree top-down and collect tiles whose bounding boxes overlap the viewport. Traversal depth is bounded by zoom level, limiting search to O(log N) nodes regardless of total tile count.

**Caching strategy:**

Static tiles (zoom 0–12, rarely changes) are cached at CDN edge nodes globally with 30-day TTL and ~98% hit rate. Dynamic tiles (zoom 13–21, updated when road data changes) carry 1-hour CDN TTL. The CDN miss path fetches from a regional tile object store (Google Cloud Storage equivalent) — cold cache misses add 20–50ms. The client app pre-fetches tiles for the predicted 5km navigation corridor to eliminate mid-route cache misses.

| Tile Strategy | Storage | Latency | Freshness | Best For |
|--------------|---------|---------|-----------|---------|
| Raster (PNG/JPEG) | 30–100KB/tile | Fast (CDN) | Stale until re-render | Satellite imagery, hillshading |
| Vector (MVT protobuf) | 5–20KB/tile | Fast (CDN) + client render | Real-time style updates | Road maps, labels, POIs |
| Hybrid (raster base + vector overlay) | 35–120KB/tile | Fast (CDN) | Mixed | Google Maps current approach |

---

## Routing Algorithm Comparison

When candidates design Google Maps in an interview, they typically propose one of four approaches. The table below captures when each is appropriate and where each fails.

| Algorithm | Query Latency | Preprocessing | Memory Overhead | Handles Live Traffic? | Verdict |
|-----------|--------------|---------------|-----------------|----------------------|---------|
| Plain Dijkstra | 5–30 s (100M nodes) | None | 10 GB | Yes (re-run each query) | Unusable at scale — fails the 500ms SLA by 6–60x |
| A* with Euclidean heuristic | 1–5 s | None | 10 GB | Yes (re-run each query) | 3–10x improvement over Dijkstra, still 2–10x too slow for global routes |
| Bidirectional Dijkstra | 2–10 s | None | 10 GB | Yes | Cuts search space ~50% — still too slow for large graphs |
| Contraction Hierarchies (CH) | 1–50 ms | 4–8 h (offline) | 25 GB (with shortcuts) | Via TDCH edge weights | Production standard; Google, Uber, HERE all use this |
| RAPTOR (transit) | 20–200 ms | 1–2 h | 5 GB | Partial (schedule-based) | Best for public transit multi-leg journeys; not for driving |
| Arc Flags + ALT | 10–100 ms | 2–4 h | 20 GB | Partial | Alternative to CH; better for dynamically changing graphs |

**Why CH wins at this scale:** The key insight is that most long-distance routes use only the top 0.01% of the road hierarchy (motorways, trunk roads). CH exploits this by pre-contracting low-importance nodes. The offline preprocessing is a one-time cost; query time pays nothing for nodes below the current hierarchy level being explored. The bidirectional search on the contracted graph explores roughly 1,000 nodes instead of 100 million.

---

## Google Maps Traffic Aggregation — H3 Hexagonal Indexing

Google Maps uses a hexagonal tiling system (similar to Uber's H3) for aggregating GPS probe data into traffic speed estimates. Hexagons have a critical advantage over squares: **every hexagon has exactly 6 equidistant neighbors**, while squares have 4 edge-adjacent neighbors (distance 1) and 4 diagonal neighbors (distance √2 ≈ 1.41). This distortion in square grids causes inaccurate spatial averaging — a traffic event at a grid diagonal appears "farther away" than it geometrically is.

**How Google Maps uses hexagonal aggregation:**

GPS pings are snapped to road segments via HMM map-matching. For aggregating speeds across a region (e.g., to detect a traffic jam spanning multiple segments), pings are bucketed into hexagonal cells at resolution 8 (average cell area ~0.74 km²). For each cell, the median observed speed is computed over a 5-minute rolling window. The resulting "hex-speed" surface is then interpolated back to individual segment estimates for CH edge weights.

The benefit over rectangular geohash cells: hexagonal cells have uniform distance to neighbors, so a single GPS ping contributes equally to its own cell and all 6 adjacent cells (inverse-distance weighting). With geohash rectangles, the contribution depends on which of 4 or 8 neighbor directions the neighbor lies in — introducing directional bias in dense urban street grids.

**Waze crowdsourcing model (comparison):**

Waze (owned by Google) uses a purer crowdsourcing approach: users explicitly report incidents (accidents, police, road closures) through the app. These reports are validated by agreement — if 3+ independent users report the same incident within 2km and 5 minutes, the incident is confirmed and shown to all users. This social validation mechanism filters GPS noise and allows traffic alerts to propagate in under 30 seconds (vs. 2-minute batch aggregation in the sensor-only pipeline). The trade-off: requires active community engagement; rural areas with low Waze density get poor coverage.

---

## Data Model

```sql
-- Road graph stored as adjacency list in a columnar store (BigTable equivalent)
-- Row key: segment_id (uint64, geohash-ordered for locality)

CREATE TABLE road_segments (
    segment_id        BIGINT PRIMARY KEY,       -- geohash-encoded 64-bit ID
    from_node_id      BIGINT NOT NULL,
    to_node_id        BIGINT NOT NULL,
    length_meters     FLOAT NOT NULL,
    road_class        SMALLINT NOT NULL,        -- 0=motorway, 1=trunk, 2=primary … 7=path
    speed_limit_mps   FLOAT,                    -- NULL if unknown
    oneway            BOOLEAN DEFAULT FALSE,
    toll              BOOLEAN DEFAULT FALSE,
    geom              GEOMETRY(LINESTRING, 4326),
    ch_rank           INT,                      -- contraction hierarchy importance rank
    ch_level          SMALLINT,                 -- hierarchy level (0=local, 5=motorway)
    INDEX idx_from_node (from_node_id),
    INDEX idx_to_node   (to_node_id),
    INDEX idx_ch_rank   (ch_rank)               -- used during CH query phase
);

-- Shortcut edges added during CH preprocessing
CREATE TABLE ch_shortcuts (
    shortcut_id       BIGINT PRIMARY KEY,
    from_node_id      BIGINT NOT NULL,
    to_node_id        BIGINT NOT NULL,
    via_node_id       BIGINT NOT NULL,          -- contracted node this shortcut bypasses
    weight_seconds    FLOAT NOT NULL,           -- free-flow travel time
    INDEX idx_from    (from_node_id),
    INDEX idx_to      (to_node_id)
);

-- Time-dependent speed profiles (historical, per segment, per 5-min slot)
CREATE TABLE speed_profiles (
    segment_id        BIGINT NOT NULL,
    day_of_week       TINYINT NOT NULL,         -- 0=Mon, 6=Sun
    slot_index        SMALLINT NOT NULL,        -- 0..287 (288 slots × 5min = 24h)
    speed_mps         FLOAT NOT NULL,
    sample_count      INT NOT NULL,             -- number of GPS pings in this slot
    PRIMARY KEY (segment_id, day_of_week, slot_index)
);

-- Live traffic (Redis, not SQL — shown as table for clarity)
-- Key:   "traffic:{segment_id}"
-- Value: { speed_mps: float, confidence: float, updated_at: epoch_ms }
-- TTL:   300 seconds (5 min)

-- Map tiles stored in object storage (GCS/S3-equivalent)
-- Key pattern: "tiles/{z}/{x}/{y}.mvt"
-- Metadata table for invalidation tracking:
CREATE TABLE tile_metadata (
    tile_key          VARCHAR(40) PRIMARY KEY,  -- "z/x/y"
    zoom_level        TINYINT NOT NULL,
    last_generated_at TIMESTAMP NOT NULL,
    data_version      INT NOT NULL,             -- increment triggers CDN invalidation
    size_bytes        INT NOT NULL,
    INDEX idx_zoom_version (zoom_level, data_version)
);

-- Navigation sessions (written on session start, updated on reroute)
CREATE TABLE nav_sessions (
    session_id        UUID PRIMARY KEY,
    user_id_hash      CHAR(64) NOT NULL,        -- SHA-256 of user_id, one-way
    origin_lat        DOUBLE NOT NULL,
    origin_lng        DOUBLE NOT NULL,
    dest_lat          DOUBLE NOT NULL,
    dest_lng          DOUBLE NOT NULL,
    mode              ENUM('driving','walking','cycling','transit') NOT NULL,
    route_polyline    TEXT,                     -- encoded polyline
    eta_seconds       INT,
    reroute_count     SMALLINT DEFAULT 0,
    started_at        TIMESTAMP NOT NULL,
    completed_at      TIMESTAMP,
    INDEX idx_user_hash (user_id_hash),
    INDEX idx_started   (started_at)
);
```

---

## Re-routing and Navigation Session Management

When a user takes a wrong turn, the navigation system must detect the deviation and compute a new route in under 1 second — fast enough that the audio instruction "recalculating" plays before the user drives past the next junction.

**Deviation detection:**

The mobile client continuously samples GPS at 1Hz during navigation. Each new GPS point is checked against the current route polyline using perpendicular distance. If the GPS point is more than **30 meters from the route polyline** for **3 consecutive samples** (3 seconds), a deviation is declared. This threshold balances false positives (GPS drift in urban canyons) against latency — waiting 10 seconds before re-routing would be too slow for fast-moving vehicles.

**Incremental re-routing:**

A full CH query from the current GPS position to the destination is triggered. Because the contracted graph is already loaded in the routing engine's memory (it was used for the original route computation), the bidirectional Dijkstra query completes in 5–20ms. The new route shares the majority of its path with the original route beyond the first common major junction — typically only the first 0.5–5km of path differs.

**Session state management:**

Each navigation session maintains state in a distributed session store (Redis Cluster, keyed by `session_id`):

```
session:{session_id} → {
  current_route_node_ids: [...],
  current_segment_index: int,   // which edge the user is on
  eta_seconds: int,
  reroute_count: int,
  last_gps: {lat, lng, ts},
  traffic_snapshot_version: int // used to detect stale edge weights
}
```

Sessions expire after 24 hours of inactivity (TTL). At peak, Google Maps handles ~25 million concurrent navigation sessions — the session store must sustain ~25M key-value entries with ~1,000 reads/sec and ~200 writes/sec per session (GPS updates). With 25M sessions at ~500 bytes each, that is ~12GB of session state, easily accommodated in a Redis Cluster across 20 nodes (0.6GB per node).

**Traffic-triggered re-routing:**

Beyond wrong turns, routes may need updating because traffic conditions changed mid-journey. The navigation client compares the current traffic snapshot version against the version used to compute the active route every 60 seconds. If the edge weight for any segment in the upcoming 10km of route has changed by more than 15% (travel time), the client triggers a silent background re-route. If the new route saves more than 2 minutes vs. the current route, the user is prompted: "Faster route available — 4 minutes faster." This 2-minute threshold was tuned empirically to avoid overwhelming users with constant re-routing suggestions while still capturing meaningful time savings.

```mermaid
graph TD
    GPS[GPS Client\n1Hz samples] -->|"perpendicular_dist > 30m for 3s"| DeviationDetect[Deviation Detector]
    DeviationDetect -->|"deviation confirmed"| RerouteReq[Re-route Request]
    GPS -->|"route still valid"| ETAUpdate[ETA Updater\nevery 60s]
    ETAUpdate -->|"edge weight delta > 15%\nfor next 10km"| SilentReroute[Silent Re-route\nbackground]
    SilentReroute -->|"new route saves > 2min"| UserPrompt[User Prompt\n'Faster route available']
    RerouteReq --> CHEngine[CH Engine\n5-20ms query]
    UserPrompt -->|"accepted"| CHEngine
    CHEngine --> SessionStore[Session Store\nRedis, update route]
    SessionStore --> Client[Update Client\nPush new polyline]
```

---

## Scale Bottlenecks

| Traffic Level | Component That Breaks | Symptoms | Mitigation |
|---------------|----------------------|----------|------------|
| 10x baseline (2,900 route req/sec) | Routing Engine — single-region | p99 latency creeps to 800ms; CPU at 90% | Horizontal sharding by geographic region; 10 regional routing clusters, each holding a subgraph |
| 10x baseline (250M GPS events/sec) | Kafka ingest brokers | Consumer lag grows; traffic data goes stale (>10 min) | Increase Kafka partitions from 100 → 1,000; add geo-sharding to prevent hot partitions in dense cities |
| 100x baseline (29,000 route req/sec) | CH preprocessing pipeline | Nightly CH rebuild takes >24h; shortcuts become stale | Incremental CH updates for local topology changes; full rebuild only for structural changes (new highways) |
| 100x baseline (tile requests) | CDN origin — tile store | Tile store read IOPS saturated; CDN miss latency >500ms | Increase CDN PoP count from 50 → 200; pre-warm tiles along predicted navigation corridors |
| 1,000x baseline (290,000 route req/sec) | Map-matching service (HMM snapping) | CPU-bound HMM inference cannot keep up; GPS lag increases | Pre-compute road graph spatial index (R-tree) per region; serve map matching from in-memory index; scale to 1,000 stateless matching pods |
| 1,000x baseline (storage) | Speed profiles table (BigTable) | Hot row contention on dense urban segment_ids; read amplification | Shard speed profiles by geohash cell prefix; cache top 10M urban segment profiles in regional Redis |

---

## How Uber Built This (Routing and ETA at Scale)

Uber operates one of the largest real-time routing systems outside of Google Maps, handling **15 million trips per day** across 70+ countries with sub-200ms ETA requirements. Their engineering blog documents several non-obvious architectural decisions.

**H3 Geospatial Indexing:**

Uber built [H3](https://www.uber.com/blog/h3/), a hexagonal hierarchical geospatial indexing system, to partition the world into uniform hexagonal cells at 16 resolution levels. Hexagonal grids have constant neighbor-distance (unlike rectangular grids where diagonal neighbors are 1.41x farther) — this property makes distance calculations and supply-demand balancing more accurate. Resolution 9 cells (~0.1 km² each) are used for driver-supply tracking; resolution 7 (~5 km²) for surge pricing zones.

**OSRM for Open-Source Routing:**

Uber runs [OSRM](https://project-osrm.org/) (Open Source Routing Machine), which also uses Contraction Hierarchies. Their global road graph is partitioned into ~3,000 geographic cells. Each routing query is answered by a cell-local OSRM instance in <50ms. Cross-cell routes stitch together cell boundary paths using a higher-level graph. At peak, Uber serves **4 million route requests/minute** (67,000 req/sec) across their fleet.

**ETA Model — Not Just Routing:**

A non-obvious decision: ETA is not simply `route_distance / average_speed`. Uber trained a gradient boosted tree model ([published in 2022](https://www.uber.com/blog/deepeta-how-uber-predicts-arrival-times/)) that takes routing output as features and also incorporates: historical trip durations for that specific origin-destination corridor, day-of-week and time-of-day seasonality, weather data, and local event calendars (concerts, sports). Their DeepETA neural network reduced mean absolute percentage error (MAPE) by 26% vs. pure routing-based ETA, with 99th percentile error dropping from ±18 minutes to ±7 minutes on 30-minute trips.

**Specific numbers from Uber engineering blog:**
- Road graph: 50 million road segments ingested from HERE Maps + OpenStreetMap
- Traffic ingestion: 5 billion GPS pings processed per day
- H3 index covers 2.3 billion cells at resolution 15 (finest granularity)
- OSRM routing cluster: 3,200 pods, each handling ~2,100 req/sec
- ETA p50 error: 1.2 minutes on 15-minute trips; p99 error: 6.8 minutes

---

## Interview Angle

**What the interviewer is testing:** Whether you can reason about graph algorithm scalability — specifically, why O(V+E) Dijkstra is unusable at 100M nodes and how pre-computation shifts work from query time to preprocessing time. They are also testing whether you understand the difference between static and dynamic data (tile serving vs. real-time traffic are completely different problems with different SLAs).

**Common mistakes candidates make:**

1. **Proposing A* as the solution for scale.** A* with a good heuristic is 2–10x faster than Dijkstra but still operates on the full graph — at 100M nodes it still takes 1–5 seconds. The correct answer requires hierarchical pre-computation (CH, ALT, or similar). A* is used for small local graph subsets, not global routing.

2. **Forgetting that traffic makes edge weights time-dependent.** Candidates who design a static weighted graph miss the core operational challenge: edge weights change every 2 minutes across the entire globe. This invalidates cached routes, requires partial CH rebuild on topology changes, and forces the ETA model to be probabilistic rather than deterministic.

3. **Conflating tile serving with routing.** Tiles are static pre-generated artifacts served from CDN with >98% cache hit rate and zero computation at request time. Routing is a real-time compute problem. Treating them as the same kind of problem (e.g., "just cache routes") misses that routes are personalized (origin + destination + departure time = unique), while tiles are shared by all users viewing the same area.

**The insight that separates good from great answers:** Great candidates mention that re-routing on wrong turns is not a full re-computation from scratch — it uses incremental CH queries starting from the nearest valid road node. Because the contracted graph is already in memory, a re-route query takes 5–20ms. The remaining portion of the original CH hierarchy is reused, and only the local path from the current position to the first shared node changes. This is why navigation reroutes feel instant — it is genuinely fast, not a UX trick.

**How to structure your answer in a 45-minute interview:**

| Time | Focus |
|------|-------|
| 0–5 min | Clarify requirements: driving only or multi-modal? ETA accuracy SLA? Offline support? |
| 5–15 min | High-level components: routing engine, tile server, traffic ingestion, client |
| 15–25 min | Deep dive routing: why naive Dijkstra fails, CH preprocessing concept, bidirectional query |
| 25–35 min | Deep dive traffic: GPS probe pipeline, Kafka + Flink, Redis edge weights, TDCH |
| 35–40 min | Tile serving: vector vs. raster, CDN strategy, quadtree addressing |
| 40–45 min | Scale numbers, bottlenecks, re-routing logic |

**Follow-up questions to anticipate:**

- "How do you handle GPS spoofing?" — traffic adversaries can flood fake GPS pings to manipulate routing for all users. Defense: outlier detection (speed > 200mph), anomaly scoring per device hash, rate-limiting probe contributions per token.
- "How does Google Maps work offline?" — clients download a compressed subgraph for a geographic region (e.g., a city). The CH hierarchy for that region is pre-computed and bundled. Offline routing runs the same CH query on device, but with no live traffic overlay — uses historical speed profiles only.
- "How do you support alternate routes?" — run CH k-shortest paths with a penalty on shared edges. After the first shortest path, edges on that path have their weights temporarily inflated (×1.3), and CH runs again. Repeat for 3 alternate routes. Each run takes <50ms, so returning 3 alternatives adds <150ms total.

---

## Key Numbers to Remember

| Metric | Value | Context |
|--------|-------|---------|
| Road graph size (global) | 100M nodes, ~200M edges | Raw graph before CH preprocessing |
| CH shortcut overhead | 2–3x more edges after preprocessing | ~400–600M total edges including shortcuts |
| CH preprocessing time | 4–8 hours (global, parallel) | Nightly batch on 1,000-core cluster |
| CH query latency | 1–50ms | Bidirectional Dijkstra on contracted graph |
| GPS ingestion rate (Google) | 25M events/sec at peak | From active navigation sessions |
| Traffic update frequency | Every 2 minutes | Per road segment speed estimate |
| Total map tiles (relevant) | ~100B tiles | Out of 4.3T theoretical max at zoom 21 |
| CDN hit rate (zoom 0–12) | ~98% | Static tiles, 30-day TTL |
| Vector tile size | 5–20KB | vs. 30–100KB for equivalent raster PNG |
| ETA p99 error (Uber DeepETA) | ±7 minutes on 30-min trips | After ML model, vs. ±18 min pure routing |
| Uber routing throughput | 67,000 req/sec peak | Across 3,200 OSRM pods |
| Route re-computation on wrong turn | 5–20ms | Incremental CH from current node |

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [System Design Interview Vol 2 — Alex Xu](https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119) | 📚 Book | Chapter on designing a proximity service and maps system |
| [ByteByteGo — Design Google Maps](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Search "Google Maps design" — routing algorithms, tile rendering, real-time traffic |
| [Google Maps Engineering: How ETA Works](https://cloud.google.com/blog/products/maps-platform/how-google-maps-eta-works) | 📖 Blog | Machine learning for ETA prediction with real-time traffic signals |
| [Uber Engineering: H3 Geospatial Indexing](https://www.uber.com/blog/h3/) | 📖 Blog | Hexagonal hierarchical geospatial indexing for proximity and area queries |
| [OpenStreetMap Architecture](https://wiki.openstreetmap.org/wiki/Component_overview) | 📚 Docs | Open-source maps architecture — data ingestion, tile rendering, API |
| [Uber DeepETA: How Uber Predicts Arrival Times](https://www.uber.com/blog/deepeta-how-uber-predicts-arrival-times/) | 📖 Blog | ML model that reduced ETA MAPE by 26% over pure routing |
| [Contraction Hierarchies — Wikipedia](https://en.wikipedia.org/wiki/Contraction_hierarchies) | 📚 Docs | Original CH algorithm explanation with pseudocode |
| [OSRM — Open Source Routing Machine](https://project-osrm.org/) | 📚 Docs | Production-grade CH-based routing engine used by Uber and others |
