# 09-observability/failures/ — Layer 2 Router

Observability-related failure modes — what goes wrong when thread pools saturate or log/metric storage grows unbounded.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Overview of common observability and performance failure scenarios |
| thread-pool-exhaustion | How thread pool exhaustion causes latency spikes and request queuing cascades |
| storage-bloat | How uncontrolled log/metric volume leads to disk saturation and system failure |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Diagnose why a service stops accepting requests | thread-pool-exhaustion.md |
| Understand why observability infrastructure runs out of disk | storage-bloat.md |
| Learn broader distributed failure patterns | See 10-architecture/failures/ |
