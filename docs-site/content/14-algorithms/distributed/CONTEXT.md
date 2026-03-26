# 14-algorithms/distributed/ — Layer 2 Router

Algorithms that make distributed systems work — consensus, failure detection, conflict resolution, and coordination protocols.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Overview: why distributed algorithms are hard and how they relate to real systems |
| gossip-protocol | Gossip (epidemic) protocol: membership, failure propagation, eventual consistency |
| phi-accrual-failure-detector | Phi Accrual Failure Detector: adaptive heartbeat-based failure detection used in Cassandra/Akka |
| vector-clocks | Vector clocks: tracking causality and ordering events across nodes (Dynamo, Riak) |
| crdt-conflict-free-data-types | CRDTs: data structures that merge without coordination — G-Counter, OR-Set, LWW-Register |
| two-phase-commit | Two-Phase Commit (2PC): atomic distributed transaction protocol — coordinator, participants, failure cases |
| paxos-made-simple | Paxos consensus: proposers, acceptors, learners — the theoretical foundation of consensus |
| raft-consensus | Raft consensus: leader election, log replication, safety — the practical alternative to Paxos |
| consistent-hashing-with-virtual-nodes | Consistent hashing with virtual nodes: load distribution, rebalancing during node changes |
| external-sorting | External sorting: merge sort over data larger than RAM — used in database query engines |
| topological-sort | Topological sort: dependency ordering via DFS/Kahn's — task schedulers, build systems, DAG processing |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| How does Raft leader election work? | raft-consensus.md |
| Paxos theory for interviews | paxos-made-simple.md |
| How does Cassandra detect node failures? | gossip-protocol.md + phi-accrual-failure-detector.md |
| Resolve write conflicts without locks | crdt-conflict-free-data-types.md + vector-clocks.md |
| Distributed transaction protocol | two-phase-commit.md |
| Add a node without rebalancing all keys | consistent-hashing-with-virtual-nodes.md |
| Sort a 1TB file | external-sorting.md |
| Process tasks respecting dependencies | topological-sort.md |
