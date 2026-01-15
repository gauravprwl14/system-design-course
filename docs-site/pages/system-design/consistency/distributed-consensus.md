# Distributed Consensus - How Nodes Agree Without a Leader

> **TL;DR:** Consensus is how distributed systems agree on values despite failures. Get it wrong and you get split-brain, data loss, or system halt. RAFT made it understandable; Paxos made careers.

## The Split-Brain Nightmare

**GitHub's 2018 Incident:**

```
What happened:
├── Network partition between East and West data centers
├── Both sides thought they were the "primary"
├── Both accepted writes for 24 hours
├── Result: Divergent data, manual reconciliation

Timeline:
├── 10:00 AM: Network link degraded
├── 10:05 AM: Failover triggered (West becomes primary)
├── 10:06 AM: East didn't get memo, still accepting writes
├── 10:07 AM - Next Day: BOTH accepting writes
├── Next Day: "Why do we have conflicting data?"

Cost: 24+ hours of manual data reconciliation
Root cause: Consensus protocol didn't handle partition correctly
```

**This is why we need distributed consensus.**

---

## The Consensus Problem

```
THE FUNDAMENTAL CHALLENGE:

Network of nodes:
  ┌─────┐     ┌─────┐     ┌─────┐
  │Node1│ ──? │Node2│ ──? │Node3│
  └─────┘     └─────┘     └─────┘

Challenges:
├── Nodes can fail at any time
├── Network can partition
├── Messages can be delayed, lost, or duplicated
├── Clocks are not synchronized

Goal: All nodes agree on the same sequence of values
      Even when some nodes fail
      Even when network partitions

Requirements:
├── Safety: All nodes agree on same value (no divergence)
├── Liveness: System eventually makes progress
└── Fault tolerance: Works with minority of nodes failed
```

---

## RAFT: Consensus Made Understandable

### The Mental Model

```
RAFT OVERVIEW:
┌─────────────────────────────────────────────────────────────────┐
│                        LEADER                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Node 1 (LEADER)                         │ │
│  │  Log: [SET x=1] [SET y=2] [SET x=3]                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              ▼            ▼            ▼                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Node 2     │ │   Node 3     │ │   Node 4     │            │
│  │  (FOLLOWER)  │ │  (FOLLOWER)  │ │  (FOLLOWER)  │            │
│  │  Log: same   │ │  Log: same   │ │  Log: same   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  Key insight: ONE leader at a time                             │
│  All writes go through leader                                   │
│  Leader replicates to followers                                 │
│  Commit when majority (quorum) has the entry                   │
└─────────────────────────────────────────────────────────────────┘
```

### RAFT States

```
NODE STATES:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────┐    Timeout    ┌───────────┐   Wins Election      │
│  │ FOLLOWER │ ─────────────▶│ CANDIDATE │ ──────────────────┐  │
│  └──────────┘               └───────────┘                   │  │
│       ▲                          │                          ▼  │
│       │                          │ Loses Election    ┌────────┐│
│       │                          └──────────────────▶│ LEADER ││
│       │                                              └────────┘│
│       │                                                   │    │
│       └───────────────────────────────────────────────────┘    │
│                      Discovers higher term                      │
│                                                                 │
│  Normal operation: 1 Leader, N-1 Followers                     │
│  Leader failure: Followers timeout → Candidate → New Leader    │
└─────────────────────────────────────────────────────────────────┘
```

### Leader Election

```
ELECTION PROCESS:

Initial state: All followers, no leader

Node 2 times out (random 150-300ms):
├── Increments term: term = 2
├── Votes for self
├── Sends RequestVote to all nodes
├── Needs majority (3 of 5) to win

Voting rules:
├── Each node votes once per term
├── Vote for candidate with higher term
├── Vote for candidate with more complete log
└── First-come-first-served within term

Election scenarios:
├── Node 2 gets 3 votes → Becomes leader
├── Node 2 gets 2 votes, Node 3 gets 2 → Split vote, retry
└── Node 2's log is behind → Denied, better candidate wins
```

### Log Replication

```
WRITE PATH:

Client: "SET x = 5"
    │
    ▼
┌────────────────────────────────────────────────────────────────┐
│ LEADER receives request                                        │
├────────────────────────────────────────────────────────────────┤
│ 1. Append to local log (uncommitted)                          │
│    Log: [..., (term:3, SET x=5)]                              │
│                                                                │
│ 2. Send AppendEntries RPC to all followers                    │
│    ──────────────────────────────────────────────────────────▶│
│                                                                │
│ 3. Wait for majority acknowledgment                           │
│    ◀────────── ACK from Node 2                                │
│    ◀────────── ACK from Node 3                                │
│    (2 + self = 3 = majority of 5)                             │
│                                                                │
│ 4. Commit entry (apply to state machine)                      │
│    x = 5 ✅                                                    │
│                                                                │
│ 5. Notify followers to commit                                 │
│    (piggyback on next AppendEntries)                          │
│                                                                │
│ 6. Respond to client: "Success"                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation: Simple RAFT

```javascript
// Simplified RAFT node implementation
class RaftNode {
  constructor(nodeId, peers) {
    this.nodeId = nodeId;
    this.peers = peers;

    // Persistent state
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = []; // [{term, command}]

    // Volatile state
    this.commitIndex = 0;
    this.lastApplied = 0;
    this.state = 'FOLLOWER';

    // Leader state
    this.nextIndex = {};  // For each peer
    this.matchIndex = {}; // For each peer

    // Timing
    this.electionTimeout = this.randomTimeout(150, 300);
    this.heartbeatInterval = 50;

    this.startElectionTimer();
  }

  randomTimeout(min, max) {
    return min + Math.random() * (max - min);
  }

  // ==========================================
  // LEADER ELECTION
  // ==========================================

  startElectionTimer() {
    clearTimeout(this.electionTimer);
    this.electionTimer = setTimeout(() => {
      this.startElection();
    }, this.electionTimeout);
  }

  async startElection() {
    this.state = 'CANDIDATE';
    this.currentTerm++;
    this.votedFor = this.nodeId;

    console.log(`[${this.nodeId}] Starting election for term ${this.currentTerm}`);

    let votes = 1; // Vote for self
    const majority = Math.floor(this.peers.length / 2) + 1;

    // Request votes from all peers
    const votePromises = this.peers.map(async (peer) => {
      try {
        const response = await this.sendRequestVote(peer, {
          term: this.currentTerm,
          candidateId: this.nodeId,
          lastLogIndex: this.log.length - 1,
          lastLogTerm: this.log.length > 0 ? this.log[this.log.length - 1].term : 0
        });

        if (response.voteGranted) {
          votes++;
        }
        if (response.term > this.currentTerm) {
          this.stepDown(response.term);
        }
      } catch (e) {
        // Peer unreachable
      }
    });

    await Promise.allSettled(votePromises);

    if (this.state === 'CANDIDATE' && votes >= majority) {
      this.becomeLeader();
    } else {
      this.startElectionTimer();
    }
  }

  becomeLeader() {
    console.log(`[${this.nodeId}] Became LEADER for term ${this.currentTerm}`);
    this.state = 'LEADER';

    // Initialize leader state
    this.peers.forEach(peer => {
      this.nextIndex[peer] = this.log.length;
      this.matchIndex[peer] = 0;
    });

    // Start heartbeats
    this.sendHeartbeats();
  }

  stepDown(term) {
    this.state = 'FOLLOWER';
    this.currentTerm = term;
    this.votedFor = null;
    this.startElectionTimer();
  }

  // ==========================================
  // LOG REPLICATION
  // ==========================================

  async appendEntry(command) {
    if (this.state !== 'LEADER') {
      throw new Error('Not the leader');
    }

    // Append to local log
    const entry = { term: this.currentTerm, command };
    this.log.push(entry);
    const entryIndex = this.log.length - 1;

    // Replicate to followers
    let acks = 1; // Self
    const majority = Math.floor(this.peers.length / 2) + 1;

    const replicatePromises = this.peers.map(async (peer) => {
      try {
        const success = await this.sendAppendEntries(peer, {
          term: this.currentTerm,
          leaderId: this.nodeId,
          prevLogIndex: entryIndex - 1,
          prevLogTerm: entryIndex > 0 ? this.log[entryIndex - 1].term : 0,
          entries: [entry],
          leaderCommit: this.commitIndex
        });

        if (success) {
          acks++;
          this.matchIndex[peer] = entryIndex;
          this.nextIndex[peer] = entryIndex + 1;
        }
      } catch (e) {
        // Retry logic here
      }
    });

    await Promise.allSettled(replicatePromises);

    // Commit if majority
    if (acks >= majority) {
      this.commitIndex = entryIndex;
      this.applyCommitted();
      return { success: true, index: entryIndex };
    }

    return { success: false };
  }

  applyCommitted() {
    while (this.lastApplied < this.commitIndex) {
      this.lastApplied++;
      const entry = this.log[this.lastApplied];
      this.applyToStateMachine(entry.command);
    }
  }

  applyToStateMachine(command) {
    // Apply command to your actual state machine
    console.log(`[${this.nodeId}] Applied: ${JSON.stringify(command)}`);
  }

  // ==========================================
  // RPC HANDLERS
  // ==========================================

  handleRequestVote(request) {
    // Vote if:
    // 1. Candidate term >= my term
    // 2. Haven't voted this term (or voted for this candidate)
    // 3. Candidate's log is at least as up-to-date

    if (request.term < this.currentTerm) {
      return { term: this.currentTerm, voteGranted: false };
    }

    if (request.term > this.currentTerm) {
      this.stepDown(request.term);
    }

    const logOk = this.isLogUpToDate(request.lastLogIndex, request.lastLogTerm);
    const canVote = (this.votedFor === null || this.votedFor === request.candidateId);

    if (canVote && logOk) {
      this.votedFor = request.candidateId;
      this.startElectionTimer(); // Reset timer
      return { term: this.currentTerm, voteGranted: true };
    }

    return { term: this.currentTerm, voteGranted: false };
  }

  isLogUpToDate(lastIndex, lastTerm) {
    const myLastTerm = this.log.length > 0 ? this.log[this.log.length - 1].term : 0;
    const myLastIndex = this.log.length - 1;

    if (lastTerm > myLastTerm) return true;
    if (lastTerm === myLastTerm && lastIndex >= myLastIndex) return true;
    return false;
  }

  handleAppendEntries(request) {
    if (request.term < this.currentTerm) {
      return { term: this.currentTerm, success: false };
    }

    this.startElectionTimer(); // Reset election timeout

    if (request.term > this.currentTerm) {
      this.stepDown(request.term);
    }

    // Check log consistency
    if (request.prevLogIndex >= 0) {
      if (this.log.length <= request.prevLogIndex ||
          this.log[request.prevLogIndex].term !== request.prevLogTerm) {
        return { term: this.currentTerm, success: false };
      }
    }

    // Append entries
    for (let i = 0; i < request.entries.length; i++) {
      const index = request.prevLogIndex + 1 + i;
      if (index < this.log.length) {
        if (this.log[index].term !== request.entries[i].term) {
          this.log.splice(index); // Remove conflicting entries
        }
      }
      if (index >= this.log.length) {
        this.log.push(request.entries[i]);
      }
    }

    // Update commit index
    if (request.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(request.leaderCommit, this.log.length - 1);
      this.applyCommitted();
    }

    return { term: this.currentTerm, success: true };
  }
}
```

---

## Quorum and Fault Tolerance

```
QUORUM MATH:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Nodes    Quorum    Can Tolerate    Notes                      │
│  ─────    ──────    ────────────    ─────                      │
│    3        2          1 failure    Minimum for consensus      │
│    5        3          2 failures   Common production setup    │
│    7        4          3 failures   High availability          │
│                                                                 │
│  Formula: Quorum = floor(N/2) + 1                              │
│  Fault tolerance = N - Quorum = floor((N-1)/2)                 │
│                                                                 │
│  Why odd numbers?                                               │
│  ├── 4 nodes: quorum = 3, tolerates 1 (same as 3 nodes!)      │
│  ├── 5 nodes: quorum = 3, tolerates 2 (better!)               │
│  └── Even numbers waste a node                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Split-Brain Prevention

```
HOW RAFT PREVENTS SPLIT-BRAIN:

Network partition:
┌─────────────────┐    ✗    ┌─────────────────┐
│   Partition A   │ ═══════ │   Partition B   │
│                 │         │                 │
│  Node1 (Leader) │         │  Node3          │
│  Node2          │         │  Node4          │
│                 │         │  Node5          │
└─────────────────┘         └─────────────────┘
     2 nodes                     3 nodes

What happens:
├── Partition A: Leader has only 2 nodes
│   └── Cannot commit (needs 3 of 5)
│   └── Writes FAIL (safety preserved!)
│
├── Partition B: Nodes timeout, start election
│   └── Node3 becomes leader (has 3 nodes = majority)
│   └── Writes SUCCEED
│
└── When healed: Node1 sees higher term, steps down
    All nodes sync to Node3's log

KEY INSIGHT: Only ONE partition can have majority
            Old leader cannot commit without majority
            New leader requires majority to be elected
```

---

## Real-World Usage

### etcd (Kubernetes)

```
Uses: RAFT for consensus
Cluster: Typically 3 or 5 nodes
Purpose: Store cluster state, secrets, configs

Example:
kubectl get pods  →  API Server  →  etcd (consensus)  →  response

Why RAFT:
- Strong consistency for cluster state
- Leader handles all writes
- Followers provide read scaling
```

### CockroachDB

```
Uses: RAFT for range consensus
Architecture: Data split into ranges, each has RAFT group

Table data:
├── Range 1 (keys a-m): RAFT group of 3 replicas
├── Range 2 (keys n-z): RAFT group of 3 replicas
└── Each range has independent leader

Benefits:
- Horizontal scaling (add more ranges)
- Automatic leader balancing
- Survive multiple failures
```

### Consul

```
Uses: RAFT for service catalog consensus
Purpose: Service discovery, health checking

Write path:
1. Client: Register service
2. Leader: Commit to RAFT log
3. Majority ACK
4. Apply to state machine
5. Return success
```

---

## Key Takeaways

### RAFT in One Minute

```
1. ONE leader at a time (prevents split-brain)
2. Leader handles ALL writes
3. Leader replicates to followers
4. Commit when MAJORITY ACKs (quorum)
5. Leader fails → election → new leader
6. New leader has most up-to-date log
```

### When to Use Consensus

```
✅ USE consensus for:
├── Distributed locks
├── Configuration management
├── Leader election
├── Strongly consistent data stores
└── Coordination services

❌ DON'T USE consensus for:
├── High-throughput data (too slow)
├── Eventually consistent is OK
├── Single-node systems
└── Read-heavy, rarely-write data
```

---

## Related Content

- [Split-Brain Problem](/problems-at-scale/availability/split-brain)
- [Database Replication](/system-design/databases/replication-basics)
- [Microservices Communication](/system-design/patterns/microservices-communication)
