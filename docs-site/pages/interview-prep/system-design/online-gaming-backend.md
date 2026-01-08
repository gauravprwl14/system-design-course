# Online Gaming Backend: How Fortnite Handles 350M Players

> **Time to Read:** 20-25 minutes
> **Difficulty:** Advanced
> **Key Concepts:** Client-Server Architecture, State Synchronization, Lag Compensation, Tick Rate

## 🎮 The Hook: 350 Million Players, 20ms Latency

**December 2023 - Fortnite Season Finale Event:**

- **350 million** registered players
- **10 million** concurrent players in-game
- **100 players** per match (Battle Royale)
- **Server tick rate:** 30 Hz (updates every 33ms)
- **Average player latency:** 20-50ms
- **Anti-cheat detections:** 5 million cheaters banned per year

**The impossible engineering:**
```
10M concurrent players:
- 100,000 game servers running simultaneously
- 30 state updates per second per server
- 100 players × 30 updates = 3,000 packets/sec per server
- Total: 300 million packets/second globally

Network bandwidth:
- Each packet: 100 bytes
- Per server: 3,000 × 100 bytes = 300 KB/sec
- All servers: 300 KB × 100,000 = 30 GB/sec

Expected: Complete chaos, constant lag ❌
Reality: 20ms latency, smooth gameplay ✅
```

**Traditional multiplayer (P2P):**
- Each player sends to 99 others: 100 × 99 = 9,900 connections
- Upload bandwidth: 99 connections × 30 Hz × 100 bytes = 297 KB/sec
- **Residential upload:** 10 Mbps = 1.25 MB/sec (enough for ~4 players)
- **Result:** Unplayable with 100 players

**Fortnite's architecture:**
- Dedicated authoritative servers
- Client prediction + server reconciliation
- Lag compensation (shoot where you see them, not where they are)
- Matchmaking by region + skill
- **Result:** 20ms latency for 350M players globally

**How?** Client-server architecture + prediction + lag compensation that made 100-player battles possible.

---

## 💔 The Problem: Real-Time Game State Synchronization

### The Latency Problem

```
Traditional Approach (Send Everything):

Player A fires weapon:
- Send to server (20ms)
- Server validates (5ms)
- Server sends to 99 other players (20ms)
- Other players see hit (total: 45ms)

Problem: 45ms delay = terrible experience
- Player already moved 2 meters (running speed: 5 m/sec)
- Hit detection misses
- Player feels laggy response
```

### The Three Impossible Requirements

**Requirement #1: Real-Time Feel (<50ms latency)**
```
Human perception:
- <20ms: Feels instant ✅
- 20-50ms: Acceptable (competitive gaming)
- 50-100ms: Noticeable lag ⚠️
- >100ms: Unplayable (fighting games, FPS) ❌

Network reality:
- US East → US West: 60ms
- US → EU: 100ms
- US → Asia: 200ms

Physics problem: Can't beat speed of light
```

**Requirement #2: Perfect Consistency (No Cheating)**
```
Scenario: Two players shoot each other simultaneously

Client-side hit detection (no server validation):
- Both players see themselves hit first
- Both think they won
- Opens door to cheating (modify client to always hit)

Server-side only:
- Latency penalty (40-50ms to register hit)
- Feels unresponsive
```

**Requirement #3: Scalability (Millions of Players)**
```
10M concurrent players:
- Need 100,000 game servers (100 players each)
- Each server costs $0.50/hour
- Cost: $50,000/hour = $1.2M/day = $438M/year

At scale:
- Can't run all servers at full capacity (wasteful)
- Can't spin up instantly (players wait)
- Can't place globally (network costs)
```

---

## ❌ Why Obvious Solutions Fail

### Anti-Pattern #1: Peer-to-Peer (P2P) Architecture

```javascript
// P2P gaming (doesn't scale beyond 8 players)

class P2PGame {
  constructor() {
    this.peers = [];  // Other players
    this.maxPeers = 7;  // 8 players total (me + 7 others)
  }

  // Connect to all other players directly
  connectToPeers(playerList) {
    for (const player of playerList) {
      const connection = this.createP2PConnection(player);
      this.peers.push(connection);

      // Send game state to this peer
      setInterval(() => {
        connection.send(this.getMyState());
      }, 33);  // 30 Hz
    }

    // Problems:
    // ❌ Upload bandwidth: n × 30 Hz × 100 bytes
    //    7 players × 30 × 100 = 21 KB/sec (manageable)
    //    99 players × 30 × 100 = 297 KB/sec (exceeds residential upload)
    //
    // ❌ No authoritative source (who decides collisions?)
    // ❌ Cheating (players can lie about their state)
    // ❌ Network complexity (O(n²) connections)
    // ❌ NAT traversal (firewalls block connections)
  }
}
```

**Real-World Failure:**
- **Call of Duty (2007-2010):** P2P matchmaking
- **Host advantage:** Host player has 0ms latency, others have 50-100ms
- **Host migration:** If host quits, everyone disconnects (migrate to new host)
- **Cheating epidemic:** Players modify game state (god mode, wallhacks)
- **Result:** Switched to dedicated servers in 2011

---

### Anti-Pattern #2: Server Sends Full State Every Frame

```javascript
// Naive server: Send entire world state every frame

class NaiveGameServer {
  constructor() {
    this.players = [];
    this.entities = [];  // Bullets, grenades, vehicles, etc.
  }

  broadcastGameState() {
    // Send every 33ms (30 Hz)
    setInterval(() => {
      const fullState = {
        players: this.players.map(p => ({
          id: p.id,
          position: p.position,
          rotation: p.rotation,
          health: p.health,
          inventory: p.inventory,  // 50+ items
          stats: p.stats
        })),
        entities: this.entities,  // 1000+ objects
        environment: this.environment  // Map state
      };

      // Problems:
      // ❌ Huge packet size: 100 players × 500 bytes = 50 KB per packet
      // ❌ At 30 Hz: 50 KB × 30 = 1.5 MB/sec per player
      // ❌ 100 players: 150 MB/sec per server
      // ❌ 100,000 servers: 15 TB/sec globally ❌

      this.broadcastToAll(fullState);
    }, 33);
  }
}
```

**Bandwidth calculation:**
```
100 players per match:
- Full state: 50 KB
- Tick rate: 30 Hz
- Per player: 50 KB × 30 = 1.5 MB/sec
- All players: 1.5 MB × 100 = 150 MB/sec per server

Cost (AWS bandwidth):
- $0.09/GB outbound
- 150 MB/sec = 540 GB/hour = $48.60/hour per server
- 100,000 servers: $4.8M/hour = $115M/day ❌
```

**Real-World Lesson:**
- **Early multiplayer games (Quake, 1996):** Sent full state every frame
- **Modem speeds:** 56 Kbps (7 KB/sec max)
- **Max players:** 4-8 (bandwidth limit)
- **Solution:** Delta compression (only send what changed)

---

### Anti-Pattern #3: No Client Prediction (Wait for Server)

```javascript
// No prediction: Wait for server to validate everything

class NoPredictionClient {
  onPlayerInput(action) {
    // Player presses "move forward"

    // Don't move locally, wait for server
    this.sendToServer({
      type: 'input',
      action: 'moveForward',
      timestamp: Date.now()
    });

    // Problems:
    // ❌ Player doesn't move until server responds (40ms delay)
    // ❌ Feels laggy and unresponsive
    // ❌ Unplayable for fast-paced games (FPS, racing)
  }

  onServerUpdate(state) {
    // Only update when server sends new state
    // Latency: 40ms minimum (20ms to server + 20ms back)

    this.player.position = state.position;
    this.player.rotation = state.rotation;

    // Every movement delayed by 40ms → terrible UX
  }
}
```

**Real-World Impact:**
- **Cloud gaming (Stadia, xCloud):** No client prediction (stream video)
- **Input lag:** 40-80ms (controller → cloud → stream back)
- **Acceptable for:** Turn-based games, slow-paced games
- **Unacceptable for:** FPS, fighting games (require <20ms)
- **Result:** Cloud gaming struggles to compete with local gaming

---

## 🚀 The Paradigm Shift: Client Prediction + Server Authority

### The Key Insight

> "Let clients predict their own movement instantly (0ms), but keep server as source of truth. Reconcile differences when server responds."

**Old Mental Model:**
"Wait for server to validate every action. Server is always right. Never show unconfirmed state."

**New Mental Model:**
"Clients predict immediately for instant feedback. Server validates asynchronously. Correct client if prediction was wrong."

**The Breakthrough:**

```
Without Client Prediction (Laggy):

Player presses W (move forward):
T=0ms:   Client sends input to server
T=20ms:  Server receives input
T=25ms:  Server simulates movement
T=45ms:  Client receives update, THEN moves

Total delay: 45ms (feels laggy) ❌

With Client Prediction (Instant):

Player presses W (move forward):
T=0ms:   Client predicts movement immediately (moves on screen)
         ALSO sends input to server
T=20ms:  Server receives input
T=25ms:  Server simulates movement (authoritative)
T=45ms:  Client receives server update
         If prediction was correct: do nothing ✅
         If prediction was wrong: snap to server position (rare)

Perceived delay: 0ms (instant feedback) ✅
```

**Why this changes everything:**

1. **Instant feedback** (client predicts = 0ms delay)
2. **Server authority** (server validates = prevents cheating)
3. **Rare corrections** (predictions are 95%+ accurate)
4. **Best of both worlds** (responsive + authoritative)

**This means:**
- Players feel instant response (prediction)
- Server prevents cheating (authoritative)
- Corrections are smooth (reconciliation)
- Works over high-latency networks (200ms still playable)

Fortnite doesn't wait for the server. It predicts optimistically and corrects when wrong.

---

## ✅ The Solution: Fortnite's Complete Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│            Fortnite Multiplayer Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Client (Player's Device)                                │
│     ┌──────────────────────────────────────┐               │
│     │  Player Input                         │               │
│     │  → Predict movement (instant, 0ms)   │               │
│     │  → Render predicted state            │               │
│     │  → Send input to server (UDP)        │               │
│     │                                       │               │
│     │  Receive Server Update                │               │
│     │  → Compare with prediction           │               │
│     │  → If different: reconcile (smooth)  │               │
│     │  → Update other players' positions   │               │
│     └──────────────────────────────────────┘               │
│            ↓ (UDP, 30 packets/sec)                          │
│  2. Game Server (AWS EC2, c5.2xlarge)                      │
│     ┌──────────────────────────────────────┐               │
│     │  Receive Inputs from 100 Players     │               │
│     │  → Validate (anti-cheat checks)      │               │
│     │  → Simulate game world (tick)        │               │
│     │  → Calculate collisions, hits        │               │
│     │  → Update authoritative state        │               │
│     │                                       │               │
│     │  Broadcast Updates (30 Hz)           │               │
│     │  → Delta compression (only changes)  │               │
│     │  → Priority-based (nearby players)   │               │
│     │  → Send to all clients               │               │
│     └──────────────────────────────────────┘               │
│            ↓ (Metrics, Logs)                                │
│  3. Matchmaking Service (Microservice)                     │
│     ┌──────────────────────────────────────┐               │
│     │  Find 100 players:                    │               │
│     │  - Similar skill level (ELO/MMR)     │               │
│     │  - Same region (low latency)         │               │
│     │  - Fill match in <30 seconds         │               │
│     │                                       │               │
│     │  Assign to optimal server:            │               │
│     │  - Lowest latency for all players    │               │
│     │  - Server capacity available         │               │
│     └──────────────────────────────────────┘               │
│            ↓                                                 │
│  4. Fleet Manager (AWS GameLift)                           │
│     ┌──────────────────────────────────────┐               │
│     │  Auto-scaling:                        │               │
│     │  - Scale up during peak hours        │               │
│     │  - Scale down during off-peak        │               │
│     │  - Pre-warm for events               │               │
│     │                                       │               │
│     │  Server health monitoring:            │               │
│     │  - Kill unresponsive servers         │               │
│     │  - Migrate players if crash          │               │
│     └──────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component #1: Client-Side Prediction

```javascript
// Fortnite client: Predict movement instantly

class GameClient {
  constructor() {
    this.player = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0
    };
    this.inputHistory = [];  // Sent inputs waiting for server ack
    this.serverTick = 0;
  }

  // Player presses W (move forward)
  onInput(inputType) {
    const input = {
      type: inputType,
      timestamp: Date.now(),
      sequenceNumber: this.inputHistory.length,
      rotation: this.player.rotation
    };

    // 1. PREDICT movement immediately (client-side, instant)
    this.applyInput(input);

    // 2. Store input in history (for reconciliation later)
    this.inputHistory.push(input);

    // 3. Send to server (UDP, unreliable but fast)
    this.sendToServer(input);
  }

  // Apply input to local player state (prediction)
  applyInput(input) {
    const moveSpeed = 5.5;  // meters per second (Fortnite running speed)
    const deltaTime = 1 / 60;  // 60 FPS

    switch (input.type) {
      case 'moveForward':
        this.player.position.x += Math.cos(this.player.rotation) * moveSpeed * deltaTime;
        this.player.position.z += Math.sin(this.player.rotation) * moveSpeed * deltaTime;
        break;
      case 'jump':
        if (this.player.isGrounded) {
          this.player.velocity.y = 7.0;  // Jump velocity
        }
        break;
      case 'shoot':
        // Instant feedback: show muzzle flash, recoil
        this.showMuzzleFlash();
        break;
    }

    // Update immediately on screen (0ms delay = feels instant)
    this.render();
  }

  // Server sends authoritative update
  onServerUpdate(serverState) {
    const { playerPosition, tick } = serverState;

    // Find which inputs the server has processed
    const lastProcessedInput = serverState.lastProcessedInput;

    // Remove acknowledged inputs from history
    this.inputHistory = this.inputHistory.filter(
      input => input.sequenceNumber > lastProcessedInput
    );

    // Server's position is authoritative
    this.player.position = playerPosition;

    // Replay unacknowledged inputs (reconciliation)
    for (const input of this.inputHistory) {
      this.applyInput(input);
    }

    // If prediction was correct: No visible change ✅
    // If prediction was wrong: Smooth correction (rare)
  }
}
```

### Component #2: Authoritative Game Server

```javascript
// Fortnite game server: Authoritative simulation

class GameServer {
  constructor() {
    this.players = new Map();  // playerId → PlayerState
    this.tick = 0;
    this.tickRate = 30;  // 30 Hz (33ms per tick)

    // Start game loop
    setInterval(() => this.gameTick(), 1000 / this.tickRate);
  }

  // Main game loop (runs 30 times per second)
  gameTick() {
    this.tick++;

    // 1. Process all pending inputs from players
    for (const [playerId, player] of this.players) {
      this.processPlayerInputs(playerId);
    }

    // 2. Simulate game world (physics, AI, etc.)
    this.simulatePhysics();
    this.checkCollisions();
    this.updateAI();

    // 3. Generate state updates for all players
    for (const [playerId, player] of this.players) {
      const update = this.generateUpdateForPlayer(playerId);
      this.sendToClient(playerId, update);
    }
  }

  // Process inputs received from client
  processPlayerInputs(playerId) {
    const player = this.players.get(playerId);
    const pendingInputs = player.pendingInputs;

    for (const input of pendingInputs) {
      // Validate input (anti-cheat)
      if (!this.validateInput(input, player)) {
        console.log(`Invalid input from ${playerId}: ${input.type}`);
        continue;  // Reject cheating attempt
      }

      // Apply input to authoritative state
      this.applyInputToPlayer(player, input);

      // Remember last processed input (for client reconciliation)
      player.lastProcessedInput = input.sequenceNumber;
    }

    // Clear processed inputs
    player.pendingInputs = [];
  }

  // Validate input for anti-cheat
  validateInput(input, player) {
    // Check movement speed (anti-speed-hack)
    const maxSpeed = 6.0;  // meters per second
    if (input.type === 'moveForward') {
      const predictedPosition = this.calculatePosition(player, input);
      const distance = this.distance(player.position, predictedPosition);
      const timeDelta = (input.timestamp - player.lastInputTime) / 1000;

      if (distance / timeDelta > maxSpeed) {
        return false;  // Moving too fast → cheating
      }
    }

    // Check teleportation (anti-teleport-hack)
    if (input.type === 'setPosition') {
      return false;  // Clients can't set position directly
    }

    // Additional checks...
    return true;
  }

  // Apply validated input to player
  applyInputToPlayer(player, input) {
    const moveSpeed = 5.5;
    const deltaTime = 1 / this.tickRate;

    switch (input.type) {
      case 'moveForward':
        player.position.x += Math.cos(input.rotation) * moveSpeed * deltaTime;
        player.position.z += Math.sin(input.rotation) * moveSpeed * deltaTime;
        break;
      case 'jump':
        if (player.isGrounded) {
          player.velocity.y = 7.0;
        }
        break;
      case 'shoot':
        // Server authoritative hit detection
        const hit = this.performRaycast(player.position, input.aimDirection);
        if (hit) {
          this.damagePlayer(hit.playerId, 30);
        }
        break;
    }

    player.lastInputTime = input.timestamp;
  }

  // Generate state update for specific player
  generateUpdateForPlayer(playerId) {
    const player = this.players.get(playerId);

    // Nearby players (area of interest)
    const nearbyPlayers = this.getPlayersInRadius(player.position, 100);

    return {
      tick: this.tick,
      lastProcessedInput: player.lastProcessedInput,
      playerPosition: player.position,
      playerHealth: player.health,
      nearbyPlayers: nearbyPlayers.map(p => ({
        id: p.id,
        position: p.position,
        rotation: p.rotation,
        animation: p.currentAnimation  // Running, jumping, shooting
      }))
    };
  }
}
```

### Component #3: Lag Compensation (Hit Detection)

```javascript
// Lag compensation: "Shoot where you see them, not where they are"

class LagCompensation {
  constructor() {
    this.positionHistory = new Map();  // playerId → [positions over time]
    this.maxHistoryTime = 1000;  // Store 1 second of history
  }

  // Store player position every tick
  recordPosition(playerId, position, timestamp) {
    if (!this.positionHistory.has(playerId)) {
      this.positionHistory.set(playerId, []);
    }

    const history = this.positionHistory.get(playerId);
    history.push({ position, timestamp });

    // Remove old history (>1 second ago)
    const cutoff = timestamp - this.maxHistoryTime;
    this.positionHistory.set(
      playerId,
      history.filter(record => record.timestamp > cutoff)
    );
  }

  // Perform hit detection with lag compensation
  checkHit(shooterId, targetId, shootTimestamp, aimRay) {
    const shooterLatency = this.getPlayerLatency(shooterId);

    // "Rewind time" to when shooter saw the target
    const whenShooterSaw = shootTimestamp - shooterLatency;

    // Get target's position at that time
    const historicalPosition = this.getHistoricalPosition(targetId, whenShooterSaw);

    // Perform raycast against historical position
    const hitbox = this.getPlayerHitbox(historicalPosition);
    const hit = this.rayIntersectsHitbox(aimRay, hitbox);

    if (hit) {
      // Hit confirmed! Reward shooter for accurate aim
      // Even though target has moved since then (on server's current state)
      return {
        hit: true,
        damage: this.calculateDamage(hit.bodyPart),
        position: historicalPosition
      };
    }

    return { hit: false };
  }

  // Get player's position at specific timestamp
  getHistoricalPosition(playerId, timestamp) {
    const history = this.positionHistory.get(playerId);
    if (!history || history.length === 0) {
      return null;
    }

    // Find closest historical position
    let closest = history[0];
    for (const record of history) {
      if (Math.abs(record.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp)) {
        closest = record;
      }
    }

    return closest.position;
  }
}
```

---

## 🏆 Social Proof: Real-World Numbers

### Fortnite (Epic Games)
- **Players:** 350 million registered, 10M concurrent
- **Matches per day:** 100 million
- **Server tick rate:** 30 Hz (33ms per update)
- **Infrastructure:** AWS (100,000+ EC2 instances)
- **Cost estimate:** $50M-100M/year in server costs
- **Client prediction accuracy:** 98% (rarely wrong)
- **Anti-cheat bans:** 5 million/year

### Call of Duty: Warzone (Activision)
- **Players:** 100 million
- **Match size:** 150 players (larger than Fortnite)
- **Server tick rate:** 20 Hz (50ms per update, lower than Fortnite)
- **Dedicated servers:** Yes (switched from P2P)
- **Latency:** 30-80ms average
- **Why slower:** Larger maps, more players per server

### League of Legends (Riot Games)
- **Players:** 150 million monthly
- **Concurrent:** 8 million peak
- **Server tick rate:** 30 Hz
- **Match size:** 10 players (easier to optimize than 100)
- **Latency:** <30ms (excellent for MOBA genre)
- **Infrastructure:** Riot's own data centers + cloud

### PUBG (KRAFTON)
- **Players:** 75 million monthly
- **Match size:** 100 players
- **Server tick rate:** 60 Hz (16ms, highest in genre)
- **Why higher:** Slower-paced gameplay allows 60 Hz
- **Latency:** 20-60ms
- **Cheating problem:** Major issue (less effective anti-cheat)

---

## ⚡ Quick Win: Build Multiplayer Game in 30 Minutes

### Simple Multiplayer Shooter (Node.js + Socket.IO)

```javascript
// Server (server.js)
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const players = new Map();
const tickRate = 30;
let tick = 0;

// Game loop
setInterval(() => {
  tick++;

  // Broadcast game state to all players
  const state = Array.from(players.values());
  io.emit('gameState', { tick, players: state });
}, 1000 / tickRate);

// Player connects
io.on('connection', (socket) => {
  const playerId = socket.id;

  // Add player
  players.set(playerId, {
    id: playerId,
    x: Math.random() * 800,
    y: Math.random() * 600,
    rotation: 0,
    health: 100
  });

  console.log(`Player ${playerId} connected`);

  // Player input
  socket.on('input', (input) => {
    const player = players.get(playerId);
    if (!player) return;

    // Apply input (server authoritative)
    const speed = 5;
    switch (input.type) {
      case 'move':
        player.x += Math.cos(input.rotation) * speed;
        player.y += Math.sin(input.rotation) * speed;
        player.rotation = input.rotation;
        break;
      case 'shoot':
        // Raycast hit detection
        const hit = checkHit(player, input.aimAngle);
        if (hit) {
          const target = players.get(hit.playerId);
          target.health -= 30;
          io.emit('playerHit', { shooter: playerId, target: hit.playerId });
        }
        break;
    }
  });

  // Player disconnects
  socket.on('disconnect', () => {
    players.delete(playerId);
    console.log(`Player ${playerId} disconnected`);
  });
});

function checkHit(shooter, aimAngle) {
  // Simple raycast
  const rayLength = 1000;
  const rayEnd = {
    x: shooter.x + Math.cos(aimAngle) * rayLength,
    y: shooter.y + Math.sin(aimAngle) * rayLength
  };

  // Check collision with other players
  for (const [id, player] of players) {
    if (id === shooter.id) continue;

    const distance = Math.sqrt(
      Math.pow(player.x - shooter.x, 2) + Math.pow(player.y - shooter.y, 2)
    );

    if (distance < 30) {  // Player hitbox radius
      return { playerId: id };
    }
  }

  return null;
}

server.listen(3000, () => {
  console.log('Game server running on http://localhost:3000');
});
```

**Client HTML:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Multiplayer Shooter</title>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <canvas id="game" width="800" height="600"></canvas>
  <script>
    const socket = io();
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    let myId = null;
    let players = [];

    // Receive game state
    socket.on('gameState', (state) => {
      players = state.players;
      render();
    });

    socket.on('connect', () => {
      myId = socket.id;
    });

    // Send input
    document.addEventListener('keydown', (e) => {
      const input = {};

      if (e.key === 'w') {
        input.type = 'move';
        input.rotation = -Math.PI / 2;  // Up
      }
      if (e.key === 'ArrowUp') {
        input.type = 'move';
        input.rotation = -Math.PI / 2;
      }
      // ... other keys

      socket.emit('input', input);
    });

    function render() {
      ctx.clearRect(0, 0, 800, 600);

      // Draw all players
      for (const player of players) {
        ctx.fillStyle = player.id === myId ? 'blue' : 'red';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  </script>
</body>
</html>
```

**Run it:**
```bash
npm install express socket.io
node server.js

# Open http://localhost:3000 in multiple tabs
# Use WASD to move, space to shoot
```

---

## 🎯 Call to Action: Master Game Backend Architecture

**What you learned:**
- ✅ Client prediction provides instant feedback (0ms perceived latency)
- ✅ Server authority prevents cheating (server is source of truth)
- ✅ Lag compensation makes hits feel fair (shoot where you see them)
- ✅ Tick rate balances bandwidth vs. responsiveness (30-60 Hz)
- ✅ Delta compression reduces bandwidth 10x (only send changes)

**Next steps:**
1. **POC:** Build the multiplayer shooter above (30 min)
2. **Deep dive:** Study Valve's Source Engine networking
3. **Advanced:** Implement interest management (area of interest)
4. **Interview:** Practice explaining client prediction algorithm

**Common interview questions:**
- "How does Fortnite handle 100 players in real-time?"
- "What's the difference between client prediction and lag compensation?"
- "How do you prevent cheating in multiplayer games?"
- "Design a matchmaking system for 10M concurrent players"
- "Explain how to handle network packet loss in games"

---

**Time to read:** 20-25 minutes
**Difficulty:** ⭐⭐⭐⭐ Advanced
**Key takeaway:** Client prediction + server authority = responsive AND cheat-proof gaming

*Related articles:* Real-Time Systems, WebSocket Architecture, Distributed State Synchronization
