# Distributed Systems

Distributed systems are hard. Partial failures, network partitions, and clock skew create problems that don't exist in single-node systems. This section gives you the mental models to reason about them.

## What You'll Learn

- **Concepts**: CAP theorem, consensus algorithms, consistency models, two-phase commit
- **Failure Modes**: Race conditions, double charges, stale reads — real production disasters

## Where to Start

1. [CAP Theorem (Practical)](./concepts/cap-theorem-practical) — The fundamental trade-off
2. [ACID vs BASE](./concepts/acid-vs-base) — Consistency guarantees explained
3. [Double Booking](./failures/double-booking) — The classic distributed system failure
4. [Raft Consensus](./concepts/raft-consensus) — How distributed agreement works
