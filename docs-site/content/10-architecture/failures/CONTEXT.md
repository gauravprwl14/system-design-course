# 10-architecture/failures/ — Layer 2 Router

Distributed architecture failure case studies — how cascading failures, retry storms, thundering herds, circuit breaker misbehavior, timeout chains, and split-brain scenarios occur and how to prevent them.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Overview of distributed systems failure modes covered in this section |
| cascading-failures | How a single slow dependency triggers a chain of failures across the system |
| circuit-breaker-failure | When circuit breakers themselves cause problems: flapping, premature opening |
| retry-storm | How well-intentioned retries amplify load and topple an already-degraded service |
| thundering-herd | The spike of traffic that hits a system when a cache expires or a service recovers |
| timeout-domino-effect | How poorly chosen timeouts in a call chain cause cascading latency across services |
| split-brain | Distributed consensus failures where two nodes believe they are the authoritative leader |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Understand how failures propagate between services | cascading-failures.md |
| Debug why a circuit breaker is causing problems | circuit-breaker-failure.md |
| Prevent retries from making an outage worse | retry-storm.md |
| Handle the post-recovery traffic spike | thundering-herd.md |
| Choose timeout values that don't chain-fail | timeout-domino-effect.md |
| Resolve conflicting leaders in distributed state | split-brain.md |
| Find hands-on implementations of defenses | See 10-architecture/hands-on/ |
