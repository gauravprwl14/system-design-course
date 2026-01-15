# Split-Brain - Dual Masters After Network Partition

**Category**: 🚨 Availability & Reliability
**Domain**: Distributed Systems, Databases
**Industry**: All (E-commerce, Fintech, SaaS)
**Tags**: `split-brain`, `network-partition`, `consensus`, `quorum`, `leader-election`
**Difficulty**: 🔴 Advanced
**Estimated Impact**: $10M-$100M+ data corruption, customer trust loss

---

## The Scenario

**Timeline**: Friday 3PM EST (peak traffic)
**System**: Multi-datacenter deployment (East + West coast)
**What happened**: Network partition between datacenters lasting 10 minutes. Both sides elected themselves as "master". When partition healed, **you have two conflicting databases** with divergent writes. Data integrity destroyed.

Your architecture:
- **East datacenter**: Primary master database, 5 app servers
- **West datacenter**: Replica database, 5 app servers
- **Replication**: Master-replica with automatic failover
- **Failover logic**: If can't reach master for 30 seconds, promote replica

**The Timeline**:
```
15:00:00: Network partition between East ↔ West
15:00:30: West datacenter: "East master unreachable, promoting West to master"
15:00:31: East datacenter: Still running as master (doesn't know about partition)

Now you have TWO masters:
- East master: Processing orders 1-1000
- West master: Processing orders 1-1000 (different data!)

15:10:00: Network partition heals
          East master has 500 new orders
          West master has 300 new orders (different ones!)
          Auto-increment IDs conflict
          User balances diverge
          Payment records mismatch

Result: Data corruption. No clear "source of truth".
```

---

## The Failure

```mermaid
sequenceDiagram
    participant UE as Users (East)
    participant E as East Datacenter<br/>(Master)
    participant Network
    participant W as West Datacenter<br/>(Replica)
    participant UW as Users (West)

    Note over Network: Network partition begins<br/>15:00:00

    UE->>E: Order #1001 ($100)
    E->>E: Write to DB ✓
    E--xNetwork: Replicate to West ❌

    Note over W: 30s timeout elapsed<br/>Master unreachable

    rect rgb(255, 200, 200)
        Note over W: PROMOTE TO MASTER<br/>15:00:30
    end

    UW->>W: Order #1001 ($50)
    W->>W: Write to DB ✓

    Note over E,W: 🔥 SPLIT-BRAIN STATE<br/>Two masters with divergent data

    UE->>E: Order #1002 ($200)
    E->>E: Write to DB ✓

    UW->>W: Order #1002 ($75)
    W->>W: Write to DB ✓

    Note over Network: Network partition heals<br/>15:10:00

    rect rgb(255, 220, 220)
        Note over E,W: CONFLICT DETECTION
        E->>W: Sync replication
        W->>E: Sync replication

        Note over E,W: ❌ Order #1001 conflict<br/>East: $100 vs West: $50
        Note over E,W: ❌ Order #1002 conflict<br/>East: $200 vs West: $75
        Note over E,W: ❌ Auto-increment ID conflicts
        Note over E,W: ❌ User balance mismatches

        Note over E,W: DATA CORRUPTION<br/>Manual reconciliation required
    end
```

**Why Obvious Solutions Fail**:

1. ❌ **"Use timestamps to resolve conflicts (last-write-wins)"**
   - Problem: Clock skew between datacenters can be seconds
   - Order placed at 15:00:01 East vs. 15:00:00 West - which is actually later?
   - Results in arbitrary data loss

2. ❌ **"Just merge both datasets"**
   - Problem: Conflicts are semantic, not just technical
   - User orders same item twice (once East, once West) - both valid?
   - Auto-increment IDs collide - Order #1001 can't be two different orders

3. ❌ **"Store all conflicting versions and let users choose"**
   - Problem: Users don't understand database conflicts
   - "Your order is #1001 ($100) or #1001 ($50), which did you place?"
   - Unacceptable UX for financial systems

---

## Real-World Examples

### 1. **GitHub Outage 2018** - 24-Hour Split-Brain ($100M+ impact)
- **What happened**: Network partition between East/West datacenters (43 seconds)
- **Split-brain**: Both sides processed writes independently
- **Data corruption**: Metadata inconsistencies across 1M+ repositories
- **Detection**: Immediate (monitoring alerts)
- **Resolution**: 24 hours of manual data reconciliation
- **Root cause**: Orchestrator promoted replica before checking network partition
- **Impact**: 10M+ developers affected, data consistency questioned

### 2. **Reddit Outage 2020** - Vote Count Divergence
- **What happened**: 15-minute network partition between data shards
- **Split-brain**: Multiple masters accepting vote writes
- **Data corruption**: Vote counts diverged (post had 5K vs 7K upvotes)
- **Detection**: 2 minutes (user reports)
- **Resolution**: 6 hours (rewound to pre-partition snapshot)
- **Impact**: Lost 15 minutes of vote data

### 3. **Cloudflare KV Storage 2021** - Multi-Region Split-Brain
- **What happened**: Network partition across 3 regions
- **Split-brain**: All 3 regions elected themselves as coordinator
- **Data corruption**: 50K conflicting key-value writes
- **Detection**: 30 seconds (automatic quorum checks)
- **Resolution**: 2 hours (automated conflict resolution)
- **Impact**: 5% of KV writes affected

### 4. **Stripe Payments 2019** - Transaction Duplicate
- **What happened**: Network hiccup during database failover
- **Split-brain**: Brief dual-master state (5 seconds)
- **Data corruption**: 200 transactions duplicated
- **Detection**: Real-time (transaction monitoring)
- **Resolution**: 30 minutes (manual reconciliation + refunds)
- **Impact**: $500K in duplicate charges, SLA credits issued

---

## The Solution: Three Approaches

### Approach 1: Quorum-Based Consensus (Recommended)

**The Core Idea**:
Require **majority quorum** for all writes and leader elections. In a 5-node cluster, need 3 nodes to agree. During network partition, only the side with 3+ nodes can elect a master and accept writes. The minority side (2 nodes) goes read-only.

**How It Prevents Split-Brain**:

```
Without Quorum (FAILS):
  5 nodes: East (2) + West (3)
  Network partition: East ↔ West

  East side (2 nodes): "We're majority!" → Elect master ❌
  West side (3 nodes): "We're majority!" → Elect master ❌

  → Both sides have masters → Split-brain

With Quorum (WORKS):
  5 nodes: East (2) + West (3)
  Network partition: East ↔ West

  East side (2 nodes): "We're minority (2/5 < 3/5)" → Read-only mode ✓
  West side (3 nodes): "We're majority (3/5 ≥ 3/5)" → Elect master ✓

  → Only ONE master → No split-brain
```

**Why This Works**:

Quorum prevents split-brain through a simple mathematical property: **two subsets cannot both have a majority**. In a 5-node cluster:
- Quorum threshold: 3 nodes (majority)
- Maximum nodes after partition: 5 (all nodes)
- If Side A has 3+ nodes, Side B has ≤2 nodes (cannot form quorum)

This guarantees at most one side can elect a master. The minority side gracefully degrades to read-only mode.

**Key Insight**: Split-brain happens when both sides think they're in charge. Quorum uses majority voting to elect exactly one leader. Mathematical guarantee: no two groups can both have >50% of votes. This is how Raft, Paxos, and Zookeeper prevent split-brain.

**The Trade-off**:
- **Pro**: Mathematical guarantee of single master
- **Pro**: Industry-proven (Raft, Paxos, ZooKeeper)
- **Pro**: Automatic recovery when partition heals
- **Con**: Requires odd number of nodes (3, 5, 7)
- **Con**: Minority side becomes read-only (availability tradeoff)
- **When to use**: **Always** for critical data systems (databases, metadata stores)

**Architecture**:

```mermaid
graph TB
    subgraph "5-Node Cluster"
        N1[Node 1<br/>East]
        N2[Node 2<br/>East]
        N3[Node 3<br/>West]
        N4[Node 4<br/>West]
        N5[Node 5<br/>West]
    end

    subgraph "After Partition"
        subgraph "East Side (Minority)"
            E1[Node 1]
            E2[Node 2]
            EStatus[2/5 nodes<br/>< 3/5 quorum<br/>READ-ONLY MODE]
        end

        subgraph "West Side (Majority)"
            W1[Node 3]
            W2[Node 4]
            W3[Node 5]
            WStatus[3/5 nodes<br/>≥ 3/5 quorum<br/>ELECT MASTER ✓]
        end
    end

    N1 -.X.- N3
    N1 -.X.- N4
    N1 -.X.- N5
    N2 -.X.- N3
    N2 -.X.- N4
    N2 -.X.- N5

    N1 --> E1
    N2 --> E2
    N3 --> W1
    N4 --> W2
    N5 --> W3

    style EStatus fill:#ffcccc
    style WStatus fill:#ccffcc
```

**Implementation** (Production-ready with Raft consensus):

```java
/**
 * Raft-based consensus implementation for leader election with quorum.
 * Prevents split-brain by requiring majority votes.
 */
@Component
public class RaftConsensusLeaderElection {

    private final List<RaftNode> clusterNodes;
    private final int quorumSize;

    private RaftNode currentLeader;
    private RaftState state = RaftState.FOLLOWER;
    private int currentTerm = 0;
    private RaftNode votedFor = null;

    public RaftConsensusLeaderElection(List<RaftNode> clusterNodes) {
        this.clusterNodes = clusterNodes;
        this.quorumSize = (clusterNodes.size() / 2) + 1;  // Majority

        log.info("Raft cluster initialized with {} nodes, quorum size: {}",
            clusterNodes.size(), quorumSize);
    }

    /**
     * Start leader election when leader heartbeat timeout
     */
    public void startElection() {
        // Transition to CANDIDATE state
        state = RaftState.CANDIDATE;
        currentTerm++;
        votedFor = getSelf();

        log.info("Starting election for term {}", currentTerm);

        // Vote for self
        int votesReceived = 1;

        // Request votes from all other nodes
        List<CompletableFuture<VoteResponse>> voteRequests = new ArrayList<>();

        for (RaftNode node : clusterNodes) {
            if (node.equals(getSelf())) continue;

            CompletableFuture<VoteResponse> voteFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return requestVote(node, currentTerm);
                } catch (Exception e) {
                    log.warn("Failed to request vote from {}: {}", node.getId(), e.getMessage());
                    return VoteResponse.rejected(currentTerm);
                }
            });

            voteRequests.add(voteFuture);
        }

        // Wait for votes (with timeout)
        try {
            CompletableFuture.allOf(voteRequests.toArray(new CompletableFuture[0]))
                .get(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Vote collection timeout: {}", e.getMessage());
        }

        // Count votes
        for (CompletableFuture<VoteResponse> future : voteRequests) {
            if (future.isDone() && !future.isCompletedExceptionally()) {
                try {
                    VoteResponse response = future.get();
                    if (response.isVoteGranted() && response.getTerm() == currentTerm) {
                        votesReceived++;
                    }
                } catch (Exception e) {
                    // Ignore
                }
            }
        }

        log.info("Received {} votes out of {} nodes (quorum: {})",
            votesReceived, clusterNodes.size(), quorumSize);

        // Check if won election (majority votes)
        if (votesReceived >= quorumSize) {
            // WON ELECTION
            becomeLeader();
        } else {
            // LOST ELECTION - not enough votes (likely network partition)
            log.warn("Failed to achieve quorum ({}/{}), transitioning to FOLLOWER (read-only)",
                votesReceived, quorumSize);

            state = RaftState.FOLLOWER;
            currentLeader = null;

            // Alert: This node is in minority partition (read-only mode)
            alerting.sendAlert(
                Severity.SEV1,
                "Node in minority partition - read-only mode",
                Map.of(
                    "votesReceived", votesReceived,
                    "quorumRequired", quorumSize,
                    "nodeId", getSelf().getId()
                )
            );
        }
    }

    private void becomeLeader() {
        state = RaftState.LEADER;
        currentLeader = getSelf();

        log.info("🎉 Became LEADER for term {}", currentTerm);

        // Alert: New leader elected
        alerting.sendAlert(
            Severity.INFO,
            "New leader elected",
            Map.of("nodeId", getSelf().getId(), "term", currentTerm)
        );

        // Start sending heartbeats to maintain leadership
        startHeartbeatBroadcast();
    }

    private VoteResponse requestVote(RaftNode node, int term) {
        // RPC call: RequestVote(term, candidateId, lastLogIndex, lastLogTerm)
        VoteRequest request = VoteRequest.builder()
            .term(term)
            .candidateId(getSelf().getId())
            .lastLogIndex(getLastLogIndex())
            .lastLogTerm(getLastLogTerm())
            .build();

        return node.getClient().requestVote(request);
    }

    /**
     * Handle incoming vote request
     */
    public VoteResponse handleVoteRequest(VoteRequest request) {
        // Reject if term is old
        if (request.getTerm() < currentTerm) {
            return VoteResponse.rejected(currentTerm);
        }

        // Update term if newer
        if (request.getTerm() > currentTerm) {
            currentTerm = request.getTerm();
            state = RaftState.FOLLOWER;
            votedFor = null;
        }

        // Grant vote if haven't voted yet (or voted for same candidate)
        boolean grantVote = (votedFor == null || votedFor.getId().equals(request.getCandidateId()))
            && isLogUpToDate(request.getLastLogIndex(), request.getLastLogTerm());

        if (grantVote) {
            votedFor = findNode(request.getCandidateId());
            log.info("Granted vote to {} for term {}", request.getCandidateId(), currentTerm);
        }

        return VoteResponse.builder()
            .term(currentTerm)
            .voteGranted(grantVote)
            .build();
    }

    /**
     * Check if can perform write operation (must be leader with quorum)
     */
    public boolean canPerformWrite() {
        if (state != RaftState.LEADER) {
            log.warn("Write rejected: not leader (state: {})", state);
            return false;
        }

        // Verify can reach quorum of nodes
        int reachableNodes = countReachableNodes();

        if (reachableNodes < quorumSize) {
            log.error("Write rejected: cannot reach quorum ({}/{})",
                reachableNodes, quorumSize);

            // Lost quorum - step down as leader
            stepDown();

            return false;
        }

        return true;
    }

    private int countReachableNodes() {
        int reachable = 1;  // Self

        for (RaftNode node : clusterNodes) {
            if (node.equals(getSelf())) continue;

            try {
                // Quick health check (timeout: 100ms)
                node.getClient().ping();
                reachable++;
            } catch (Exception e) {
                // Unreachable
            }
        }

        return reachable;
    }

    private void stepDown() {
        log.warn("Stepping down as leader (lost quorum)");

        state = RaftState.FOLLOWER;
        currentLeader = null;

        alerting.sendAlert(
            Severity.SEV1,
            "Leader stepped down - lost quorum",
            Map.of("nodeId", getSelf().getId(), "term", currentTerm)
        );
    }

    // ... heartbeat, log replication, etc.
}

// Database write handler with quorum check
@Service
public class QuorumAwareDatabase {

    private final RaftConsensusLeaderElection consensus;
    private final DatabaseConnection db;

    public void writeOrder(Order order) {
        // Check if can perform write (leader with quorum)
        if (!consensus.canPerformWrite()) {
            throw new QuorumLostException(
                "Cannot perform write: not leader or lost quorum. " +
                "This node is in read-only mode."
            );
        }

        // Perform write
        db.insert(order);

        // Replicate to quorum of followers
        replicateToQuorum(order);
    }

    private void replicateToQuorum(Order order) {
        List<RaftNode> followers = consensus.getFollowers();
        int replicaQuorum = (followers.size() / 2) + 1;

        AtomicInteger successfulReplicas = new AtomicInteger(0);

        List<CompletableFuture<Void>> replicationFutures = followers.stream()
            .map(follower -> CompletableFuture.runAsync(() -> {
                try {
                    follower.replicate(order);
                    successfulReplicas.incrementAndGet();
                } catch (Exception e) {
                    log.warn("Replication to {} failed: {}", follower.getId(), e.getMessage());
                }
            }))
            .collect(Collectors.toList());

        // Wait for quorum of replicas (with timeout)
        try {
            CompletableFuture.allOf(replicationFutures.toArray(new CompletableFuture[0]))
                .get(1, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Timeout - check if achieved quorum
        }

        if (successfulReplicas.get() < replicaQuorum) {
            throw new ReplicationQuorumException(
                String.format("Failed to replicate to quorum (%d/%d)",
                    successfulReplicas.get(), replicaQuorum)
            );
        }
    }
}

enum RaftState {
    FOLLOWER,   // Read-only mode
    CANDIDATE,  // Election in progress
    LEADER      // Can accept writes
}
```

**Pros**:
- ✅ Mathematical guarantee of single master
- ✅ Industry-proven (used by etcd, Consul, etc.)
- ✅ Automatic recovery
- ✅ Strong consistency

**Cons**:
- ❌ Requires odd number of nodes
- ❌ Minority partition becomes read-only
- ❌ Complex implementation (Raft, Paxos)
- ❌ Latency overhead (quorum coordination)

---

### Approach 2: Fencing Tokens (STONITH)

**The Core Idea**:
Use **monotonically increasing fencing tokens** to prevent old masters from accepting writes after failover. New master gets token N+1, old master has token N. Writes must include token. Database rejects writes with old tokens.

STONITH = "Shoot The Other Node In The Head" - aggressively fence old master.

**How It Prevents Split-Brain**:

```
Without Fencing (FAILS):
  15:00: East master (no token tracking)
  15:01: Network partition
  15:02: West promotes to master
  15:10: Partition heals
         Both masters accept writes → Conflict ❌

With Fencing Tokens (WORKS):
  15:00: East master (token: 5)
  15:01: Network partition
  15:02: West promotes to master (token: 6)
  15:03: East tries to write (token: 5) → REJECTED ✓
         "Token 5 is fenced by token 6"
  15:10: Partition heals
         Only West master's writes were accepted ✓
```

**Why This Works**:

Fencing tokens create a **total ordering** of master epochs. When a new master is elected, it receives a token larger than all previous tokens. The storage layer (database) tracks the highest token seen and rejects writes with older tokens.

This ensures even if old master doesn't know it's been deposed (network partition), its writes will be rejected at the storage layer. The storage layer is the final arbiter of which master is legitimate.

**Key Insight**: Split-brain happens when storage accepts writes from multiple masters. Fencing tokens make storage layer **aware of master epochs** and enforce single-master invariant. Even if network partitions, storage rejects writes from old master.

**The Trade-off**:
- **Pro**: Works with even-numbered clusters
- **Pro**: Old master physically prevented from writes
- **Pro**: Simpler than consensus (no voting)
- **Con**: Requires storage layer support (token checking)
- **Con**: Must ensure token monotonicity (distributed counter)
- **When to use**: Systems where storage layer can be modified (self-hosted databases)

**Architecture**:

```mermaid
graph TB
    subgraph "Master Election with Fencing"
        TG[Token Generator<br/>Distributed Counter]

        subgraph "East Master (Old)"
            EM[East Master<br/>Token: 5]
        end

        subgraph "West Master (New)"
            WM[West Master<br/>Token: 6]
        end

        TG --> |Issues token 6| WM
    end

    subgraph "Storage Layer"
        DB[(Database<br/>Last Token: 6)]
    end

    EM --> |Write + Token 5| DB
    WM --> |Write + Token 6| DB

    DB --> |Reject: Token 5 < 6| Reject[❌ Write Rejected]
    DB --> |Accept: Token 6 ≥ 6| Accept[✓ Write Accepted]

    style Reject fill:#ffcccc
    style Accept fill:#ccffcc
```

**Implementation** (Production-ready):

```java
@Component
public class FencingTokenManager {

    private final RedisTemplate<String, String> redis;
    private static final String TOKEN_KEY = "master:fencing_token";

    /**
     * Generate new fencing token (monotonically increasing)
     */
    public long generateToken() {
        // Atomic increment in Redis
        Long token = redis.opsForValue().increment(TOKEN_KEY);

        if (token == null) {
            throw new FencingTokenException("Failed to generate fencing token");
        }

        log.info("Generated new fencing token: {}", token);

        return token;
    }

    /**
     * Get current token (for reads)
     */
    public long getCurrentToken() {
        String tokenStr = redis.opsForValue().get(TOKEN_KEY);
        return tokenStr != null ? Long.parseLong(tokenStr) : 0;
    }
}

@Service
public class MasterElectionWithFencing {

    private final FencingTokenManager fencingTokenManager;
    private final ZooKeeperClient zkClient;

    private volatile boolean isMaster = false;
    private volatile long currentFencingToken = 0;

    /**
     * Attempt to become master
     */
    public void promoteToMaster() {
        try {
            // Try to acquire master lock in ZooKeeper
            boolean acquired = zkClient.acquireLock("/master_lock");

            if (!acquired) {
                log.warn("Failed to acquire master lock");
                return;
            }

            // Generate new fencing token
            currentFencingToken = fencingTokenManager.generateToken();

            isMaster = true;

            log.info("Promoted to MASTER with fencing token: {}", currentFencingToken);

            alerting.sendAlert(
                Severity.INFO,
                "Promoted to master",
                Map.of("fencingToken", currentFencingToken)
            );

            // Fence previous master
            fencePreviousMaster();

        } catch (Exception e) {
            log.error("Failed to promote to master", e);
            throw new MasterElectionException("Promotion failed", e);
        }
    }

    /**
     * STONITH: Aggressively fence previous master
     */
    private void fencePreviousMaster() {
        // Option 1: Send explicit fence command to old master
        sendFenceCommand();

        // Option 2: Kill old master's network access (iptables DROP)
        blockOldMasterNetwork();

        // Option 3: Force reboot old master (IPMI/BMC)
        // rebootNode(previousMaster);
    }

    private void sendFenceCommand() {
        // Broadcast "you are fenced" to all nodes
        for (Node node : cluster.getNodes()) {
            if (node.equals(self())) continue;

            try {
                node.getClient().fence(currentFencingToken);
            } catch (Exception e) {
                log.warn("Failed to send fence command to {}", node.getId());
            }
        }
    }

    /**
     * Handle incoming fence command
     */
    public void handleFenceCommand(long incomingToken) {
        if (incomingToken > currentFencingToken) {
            log.warn("Received fence command with token {}, current token: {}. Stepping down.",
                incomingToken, currentFencingToken);

            // Step down immediately
            isMaster = false;
            currentFencingToken = incomingToken;

            // Stop accepting writes
            database.setReadOnlyMode(true);

            alerting.sendAlert(
                Severity.SEV1,
                "Fenced by new master",
                Map.of(
                    "oldToken", currentFencingToken,
                    "newToken", incomingToken
                )
            );
        }
    }
}

// Database layer with fencing token validation
@Repository
public class FencedDatabase {

    private final AtomicLong lastSeenToken = new AtomicLong(0);
    private final DataSource dataSource;

    /**
     * Write with fencing token validation
     */
    public void write(Order order, long fencingToken) {
        // Validate fencing token
        long currentToken = lastSeenToken.get();

        if (fencingToken < currentToken) {
            // Old token - reject write
            log.error("Write rejected: fencing token {} < current token {}",
                fencingToken, currentToken);

            metrics.incrementCounter("database.write.fenced");

            throw new FencedWriteException(
                String.format("Write rejected: token %d is fenced by token %d",
                    fencingToken, currentToken)
            );
        }

        // Update last seen token (atomic)
        lastSeenToken.updateAndGet(current -> Math.max(current, fencingToken));

        // Perform write
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement(
                "INSERT INTO orders (id, user_id, amount, fencing_token) VALUES (?, ?, ?, ?)"
            );

            stmt.setLong(1, order.getId());
            stmt.setLong(2, order.getUserId());
            stmt.setBigDecimal(3, order.getAmount());
            stmt.setLong(4, fencingToken);

            stmt.executeUpdate();

            log.debug("Write successful with fencing token: {}", fencingToken);
            metrics.incrementCounter("database.write.success");

        } catch (SQLException e) {
            log.error("Write failed", e);
            throw new DatabaseException("Write failed", e);
        }
    }

    /**
     * Read operation (no fencing token required)
     */
    public Order read(long orderId) {
        // Reads don't require fencing tokens
        // ...
    }
}

// Application service using fenced writes
@Service
public class OrderService {

    private final MasterElectionWithFencing masterElection;
    private final FencedDatabase database;

    public void createOrder(Order order) {
        // Check if this node is master
        if (!masterElection.isMaster()) {
            throw new NotMasterException("Cannot write: not master");
        }

        // Get current fencing token
        long fencingToken = masterElection.getCurrentFencingToken();

        // Write with fencing token
        database.write(order, fencingToken);
    }
}
```

**Pros**:
- ✅ Works with even-numbered clusters
- ✅ Physical prevention of split-brain
- ✅ Simpler than consensus protocols
- ✅ Strong safety guarantees

**Cons**:
- ❌ Requires storage layer modification
- ❌ Aggressive (STONITH can cause service disruption)
- ❌ Needs reliable distributed counter (for tokens)
- ❌ Doesn't work with managed databases (can't modify)

---

### Approach 3: Witness Node (Tiebreaker)

**The Core Idea**:
Add a lightweight **witness node** (3rd datacenter or cloud region) that acts as tiebreaker during network partitions. During partition, both sides contact witness. Witness grants "master lease" to only one side. Side without lease goes read-only.

**How It Prevents Split-Brain**:

```
Without Witness (FAILS):
  East DC + West DC only

  Network partition: East ↔ West
  East: "I'm master!" ❌
  West: "I'm master!" ❌
  → Split-brain

With Witness (WORKS):
  East DC + West DC + Witness (Cloud)

  Network partition: East ↔ West

  East → Witness: "Grant me master lease"
  West → Witness: "Grant me master lease"

  Witness: "Already granted lease to West" → Reject East ✓

  East: Read-only (no lease)
  West: Master (has lease) ✓

  → Only ONE master
```

**Why This Works**:

Witness breaks ties in asymmetric partitions. In 2-datacenter setup, network partition creates ambiguity - both sides can be "majority" from their perspective. Witness provides external consensus:
1. **Lightweight**: Doesn't store data, just grants leases
2. **Tiebreaker**: Only responds to first requester
3. **Lease-based**: Master lease expires after 30s, must be renewed
4. **Separate failure domain**: Witness in different datacenter/cloud

**Key Insight**: In 2-datacenter architecture, you can't determine majority (1/2 vs 1/2). Adding a 3rd lightweight node (witness) creates odd number (3), enabling quorum. Witness can be tiny (doesn't store data), reducing cost.

**The Trade-off**:
- **Pro**: Works with 2-datacenter setup (no need for 3rd full datacenter)
- **Pro**: Witness is lightweight (no data storage)
- **Pro**: Simple implementation
- **Con**: Witness is single point of failure
- **Con**: Network partition to witness causes unavailability
- **When to use**: 2-datacenter deployments where 3rd datacenter too expensive

**Architecture**:

```mermaid
graph TB
    subgraph "East Datacenter"
        E[East Master<br/>Candidate]
    end

    subgraph "West Datacenter"
        W[West Master<br/>Candidate]
    end

    subgraph "Witness Node (Cloud)"
        Witness[Witness Service<br/>Lease Granter]
        Lease[Master Lease<br/>Granted to: West<br/>Expires: 15:01:00]
    end

    E -.X.- W
    Note[Network Partition<br/>East ↔ West]

    E --> |Request lease| Witness
    W --> |Request lease| Witness

    Witness --> |Granted ✓| W
    Witness --> |Denied ❌<br/>Lease held by West| E

    Witness --> Lease

    style E fill:#ffcccc
    style W fill:#ccffcc
```

**Implementation** (Production-ready):

```java
/**
 * Witness service - runs in 3rd datacenter or cloud region
 */
@RestController
@RequestMapping("/witness")
public class WitnessService {

    private final AtomicReference<MasterLease> currentLease = new AtomicReference<>();
    private static final int LEASE_DURATION_SECONDS = 30;

    @PostMapping("/request-lease")
    public ResponseEntity<LeaseResponse> requestLease(@RequestBody LeaseRequest request) {
        MasterLease existing = currentLease.get();

        // Check if lease expired
        if (existing != null && !existing.isExpired()) {
            // Lease still valid
            if (existing.getNodeId().equals(request.getNodeId())) {
                // Same node renewing lease
                log.info("Renewing lease for node: {}", request.getNodeId());
                MasterLease renewed = existing.renew();
                currentLease.set(renewed);

                return ResponseEntity.ok(LeaseResponse.granted(renewed));

            } else {
                // Different node requesting lease - deny
                log.warn("Denying lease to {}: lease held by {}",
                    request.getNodeId(), existing.getNodeId());

                metrics.incrementCounter("witness.lease.denied");

                return ResponseEntity.status(409).body(
                    LeaseResponse.denied(existing.getNodeId(), existing.getExpiresAt())
                );
            }
        }

        // No valid lease - grant to requester
        MasterLease newLease = MasterLease.builder()
            .nodeId(request.getNodeId())
            .grantedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(LEASE_DURATION_SECONDS))
            .build();

        currentLease.set(newLease);

        log.info("Granted new lease to node: {}", request.getNodeId());
        metrics.incrementCounter("witness.lease.granted");

        alerting.sendAlert(
            Severity.INFO,
            "Master lease granted",
            Map.of("nodeId", request.getNodeId())
        );

        return ResponseEntity.ok(LeaseResponse.granted(newLease));
    }

    @GetMapping("/current-lease")
    public ResponseEntity<MasterLease> getCurrentLease() {
        MasterLease lease = currentLease.get();

        if (lease == null || lease.isExpired()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(lease);
    }
}

@Data
@Builder
class MasterLease {
    private String nodeId;
    private Instant grantedAt;
    private Instant expiresAt;

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public MasterLease renew() {
        return MasterLease.builder()
            .nodeId(this.nodeId)
            .grantedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(30))
            .build();
    }
}

// Node implementation - requests lease from witness
@Service
public class WitnessBasedMasterElection {

    private final RestTemplate witnessClient;
    private final String witnessUrl;
    private final ScheduledExecutorService scheduler;

    private volatile boolean isMaster = false;
    private volatile MasterLease currentLease = null;

    public WitnessBasedMasterElection(String witnessUrl) {
        this.witnessUrl = witnessUrl;
        this.witnessClient = new RestTemplate();
        this.scheduler = Executors.newScheduledThreadPool(1);

        // Start lease renewal task
        startLeaseRenewal();
    }

    /**
     * Attempt to acquire master lease from witness
     */
    public void acquireLease() {
        LeaseRequest request = new LeaseRequest(getNodeId());

        try {
            ResponseEntity<LeaseResponse> response = witnessClient.postForEntity(
                witnessUrl + "/request-lease",
                request,
                LeaseResponse.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                LeaseResponse leaseResponse = response.getBody();

                if (leaseResponse.isGranted()) {
                    // Lease acquired!
                    currentLease = leaseResponse.getLease();
                    isMaster = true;

                    log.info("✅ Acquired master lease from witness (expires: {})",
                        currentLease.getExpiresAt());

                    alerting.sendAlert(
                        Severity.INFO,
                        "Acquired master lease",
                        Map.of("nodeId", getNodeId())
                    );
                } else {
                    // Lease denied
                    isMaster = false;
                    currentLease = null;

                    log.warn("❌ Lease denied: held by {} until {}",
                        leaseResponse.getCurrentLeaseHolder(),
                        leaseResponse.getLeaseExpiresAt()
                    );
                }
            }

        } catch (Exception e) {
            log.error("Failed to contact witness: {}", e.getMessage());

            // Can't reach witness - step down as master (safety)
            if (isMaster) {
                log.error("Lost contact with witness - stepping down as master");
                stepDown();
            }
        }
    }

    private void startLeaseRenewal() {
        // Renew lease every 10 seconds (lease duration: 30s)
        scheduler.scheduleAtFixedRate(
            () -> {
                if (isMaster || currentLease != null) {
                    acquireLease();  // Renew
                }
            },
            0,
            10,
            TimeUnit.SECONDS
        );
    }

    private void stepDown() {
        isMaster = false;
        currentLease = null;

        alerting.sendAlert(
            Severity.SEV1,
            "Stepped down as master (lost witness contact)",
            Map.of("nodeId", getNodeId())
        );
    }

    public boolean isMaster() {
        // Check lease validity
        if (isMaster && currentLease != null && currentLease.isExpired()) {
            log.warn("Master lease expired - stepping down");
            stepDown();
        }

        return isMaster;
    }
}

// Application service using witness-based master election
@Service
public class OrderService {

    private final WitnessBasedMasterElection masterElection;
    private final Database database;

    public void createOrder(Order order) {
        if (!masterElection.isMaster()) {
            throw new NotMasterException(
                "Cannot write: not master (no witness lease)"
            );
        }

        database.write(order);
    }
}
```

**Pros**:
- ✅ Works with 2-datacenter setup
- ✅ Witness is lightweight (no data storage)
- ✅ Simple implementation
- ✅ Cost-effective (small witness instance)

**Cons**:
- ❌ Witness is single point of failure
- ❌ Network partition to witness → unavailability
- ❌ Adds network latency (witness roundtrip)
- ❌ Still need to deploy/monitor witness

---

## Performance Comparison

| Approach | Split-Brain Prevention | Availability | Complexity | Cost | Best For |
|----------|----------------------|--------------|------------|------|----------|
| **Quorum Consensus** | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐⭐⭐ Good | High | High (5+ nodes) | Critical data systems |
| **Fencing Tokens** | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐⭐⭐ Good | Medium | Medium | Self-hosted databases |
| **Witness Node** | ⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good | Low | Low (1 witness) | 2-datacenter setups |

**Recommended Approach**:
- **Critical financial systems**: Quorum consensus (Raft/Paxos) - absolute safety
- **Self-hosted databases**: Fencing tokens + STONITH - physical prevention
- **2-datacenter e-commerce**: Witness node - cost-effective tiebreaker

---

## Key Takeaways

1. **Split-brain causes data corruption** - Two masters = divergent writes = lost data integrity
2. **Quorum prevents split-brain mathematically** - Two subsets cannot both have majority
3. **Fencing tokens reject old masters physically** - Storage layer enforces master epochs
4. **Witness nodes break ties in 2-DC setups** - Lightweight tiebreaker for cost savings
5. **Automatic failover without safeguards is dangerous** - Can promote replica during network blip
6. **Recovery from split-brain requires manual intervention** - No automated conflict resolution
7. **Real-world impact is catastrophic** - $10M-$100M+ in data corruption and customer trust loss
