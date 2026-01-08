# Real-Time Collaborative Editing: How Google Docs Lets 50 People Edit Simultaneously

> **Time to Read:** 18-22 minutes
> **Difficulty:** Advanced
> **Key Concepts:** CRDT, Operational Transformation, WebSocket, Conflict Resolution

## 🎯 The Hook: 50 Editors, Zero Conflicts

**March 2024 - Google Workspace Stats:**

- **2 billion** Google Docs users worldwide
- **50 concurrent editors** per document (max limit)
- **Average collaboration lag:** 100ms (keystroke → others see it)
- **Conflict resolution:** 100% automatic (zero manual merges)
- **Documents created:** 5 million per day

**The impossible scenario:**
```
50 people editing same sentence:
- Person A types "Hello" at position 0
- Person B types "World" at position 0
- Person C deletes characters 0-4
- Person D formats text as bold
- Person E changes font to Arial

All happening in 100ms window

Expected: Complete chaos ❌
Reality: Perfect merge ✅
```

**Traditional version control (Git):**
- Manual conflict resolution ("<<<<<<< HEAD")
- One person at a time (locks)
- Merge commits every edit
- **Result:** 5 minutes to resolve simple conflicts

**Google Docs:**
- Automatic conflict resolution
- All editors see same final state
- No merge commits
- **Result:** 100ms to perfect merge

**How?** Operational Transformation + CRDTs + optimistic UI that made real-time editing possible.

---

## 💔 The Problem: Concurrent Editing Is Chaos

### The Race Condition Nightmare

```
Traditional Approach (Doesn't Work):

Document: "Hello World"
         Position: 0123456789

Time 0ms:
- Alice's screen: "Hello World"
- Bob's screen:   "Hello World"
- Both at position 0

Time 10ms:
- Alice types "Hi " → "Hi Hello World" (local)
- Bob types "Hey " → "Hey Hello World" (local)

Time 110ms (both send to server):
- Server receives: "Hi Hello World" from Alice
- Server receives: "Hey Hello World" from Bob
- Which one wins? 💥

Option 1: Last Write Wins
- Result: "Hey Hello World" (Alice's edit lost!)
- Alice sees her "Hi" disappear ❌

Option 2: Manual Merge
- Show Alice: "Conflict detected, resolve manually"
- Terrible UX for real-time editing ❌

Option 3: Lock Document
- Only one person can edit at a time
- Not collaborative anymore ❌
```

### The Three Killers

**Killer #1: The Position Problem**
```javascript
// Naive approach (fails immediately)
class NaiveCollaboration {
  applyEdit(edit) {
    const { position, insertText } = edit;

    // Problem: Position is already outdated!
    // While user typed at position 5,
    // someone else inserted 10 chars at position 2
    // Now position 5 is actually position 15!

    this.document.insertAt(position, insertText); // ❌ Wrong position
  }
}
```

**Real-World Impact:**
- User A types at position 10: "Hello"
- User B (simultaneously) inserts 20 chars at position 5
- User A's "Hello" appears at wrong position (30 instead of 10)
- **Result:** Gibberish document

**Killer #2: The Ordering Problem**
```
Two operations arrive simultaneously:
- Op1: Delete chars 5-10
- Op2: Insert "test" at position 7

Which executes first changes the result:
- Op1 then Op2: "test" inserted at wrong position (chars 5-10 gone)
- Op2 then Op1: Delete removes "test" that was just inserted

Both users see DIFFERENT documents! ❌
```

**Killer #3: The Network Latency Problem**
```
Latency matrix:
- US → EU: 100ms
- US → Asia: 200ms
- US → Australia: 250ms

User in Sydney edits at time T
- Sees result locally: T + 0ms
- US user sees it: T + 250ms
- EU user sees it: T + 350ms (routed through US)

For 250ms, all users see different documents! ❌
```

---

## ❌ Why Obvious Solutions Fail

### Anti-Pattern #1: Locking (No Concurrent Editing)

```javascript
// Lock-based editing (defeats the purpose)

class LockBasedEditing {
  async requestEdit(userId, documentId) {
    // Check if document is locked
    const lock = await redis.get(`lock:${documentId}`);

    if (lock && lock !== userId) {
      return {
        allowed: false,
        message: `Document locked by ${lock}. Please wait...`
      };
    }

    // Acquire lock
    await redis.setex(`lock:${documentId}`, 30, userId);

    // Problems:
    // ❌ Only one person can edit at a time
    // ❌ If user forgets to unlock (crash), doc locked forever
    // ❌ Terrible UX ("Wait your turn")
    // ❌ Not "collaborative" at all

    return { allowed: true };
  }
}
```

**Real-World Failure:**
- **Microsoft Word (pre-2010):** Document locking for simultaneous editing
- **User experience:** "Document is locked by john@company.com"
- **Workflow:** Email John to close the file, wait, then edit
- **Result:** People stopped collaborating, emailed files instead

---

### Anti-Pattern #2: Last Write Wins

```javascript
// Last write wins (data loss guaranteed)

class LastWriteWins {
  async handleEdit(edit, userId, timestamp) {
    // Simply overwrite with latest edit
    this.document = edit.newContent;
    this.lastModified = timestamp;
    this.lastModifiedBy = userId;

    // Broadcast to everyone
    this.broadcast(edit);

    // Problems:
    // ❌ Earlier edits get completely lost
    // ❌ Users see their text disappear randomly
    // ❌ No way to recover lost edits
    // ❌ Creates trust issues ("Why did my work vanish?")
  }
}
```

**Real-World Failure:**
- **Etherpad (early version, 2008):** Last write wins
- **Bug:** Two users typing simultaneously → one user's text vanishes
- **User reaction:** "Is someone deleting my work?!"
- **Result:** Lost user trust, had to rebuild with OT

---

### Anti-Pattern #3: Periodic Sync (Merge Conflicts)

```javascript
// Periodic sync with manual conflict resolution

class PeriodicSync {
  async syncDocument() {
    // Every 5 seconds, send local changes to server
    setInterval(async () => {
      const localChanges = this.getLocalChanges();
      const response = await this.sendToServer(localChanges);

      if (response.conflicts) {
        // Show merge conflict UI (like Git)
        this.showConflictResolution(response.conflicts);

        // Problems:
        // ❌ Interrupts user's workflow
        // ❌ Forces manual conflict resolution
        // ❌ Loses "real-time" feeling (5sec delay)
        // ❌ Confusing for non-technical users
      }
    }, 5000);
  }

  showConflictResolution(conflicts) {
    // Git-style conflict markers
    const conflictText = `
      <<<<<<< Your version
      ${conflicts.yours}
      =======
      ${conflicts.theirs}
      >>>>>>> Their version
    `;

    // ❌ Terrible UX for real-time collaboration
    alert('Conflict detected! Choose which version to keep:');
  }
}
```

**Real-World Limitation:**
- **Dropbox Paper (early version):** Sync every few seconds
- **Issue:** 3-5 second delay before seeing others' changes
- **User confusion:** "Did they receive my edit? Should I wait?"
- **Result:** Felt like slow turn-based editing, not real-time

---

## 🚀 The Paradigm Shift: Operational Transformation

### The Key Insight

> "Instead of syncing final document state, sync the *operations* that created it. Transform conflicting operations so they can coexist."

**Old Mental Model:**
"Sync the document content every few seconds. If conflicts arise, ask user to resolve."

**New Mental Model:**
"Every keystroke is an operation (insert, delete, format). When operations conflict, transform them mathematically so both can apply without conflicts."

**The Breakthrough:**

```
Without OT (State-based):
- Alice's doc: "Hello World"
- Bob's doc:   "Hello World"

Alice inserts "Beautiful " at position 6:
- Alice's doc: "Hello Beautiful World"

Bob inserts "Amazing " at position 6:
- Bob's doc:   "Hello Amazing World"

Server receives both:
- Conflict! Both edited position 6
- Must choose one or merge manually ❌

With OT (Operation-based):
- Alice's doc: "Hello World"
- Bob's doc:   "Hello World"

Alice's operation: Insert("Beautiful ", 6)
Bob's operation:   Insert("Amazing ", 6)

Server transforms operations:
- Alice's op stays: Insert("Beautiful ", 6)
- Bob's op transforms: Insert("Amazing ", 16)
  (position adjusted because Alice inserted 10 chars)

Final result (both users):
- "Hello Beautiful Amazing World" ✅
- Both edits preserved
- No conflicts
- Automatic merge
```

**Why this changes everything:**

1. **Operations are commutative** (order doesn't matter after transformation)
2. **Every user sees same final state** (eventual consistency)
3. **No data loss** (all edits preserved)
4. **Zero manual intervention** (math handles conflicts)
5. **Sub-second latency** (lightweight ops, not full doc)

**This means:**
- 50 people can edit simultaneously ✅
- All see same document eventually ✅
- No merge conflicts ✅
- Works over high-latency networks ✅
- Scales to millions of documents ✅

Google Docs doesn't sync documents. It syncs the *history* of operations that created the document.

---

## ✅ The Solution: Google Docs Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────┐
│           Google Docs Real-Time Collaboration                  │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Client-Side (Browser)                                     │
│     ┌──────────────────────────────────────────┐             │
│     │  User types "H"                           │             │
│     │  → Create operation: Insert("H", pos=0)  │             │
│     │  → Apply locally (optimistic UI)         │             │
│     │  → Send to server via WebSocket          │             │
│     └──────────────────────────────────────────┘             │
│            ↓                                                   │
│  2. WebSocket Connection (Bidirectional)                      │
│     ┌──────────────────────────────────────────┐             │
│     │  Persistent connection to server         │             │
│     │  → Send ops immediately (no polling)     │             │
│     │  ← Receive others' ops in real-time     │             │
│     │  Latency: 50-100ms globally              │             │
│     └──────────────────────────────────────────┘             │
│            ↓                                                   │
│  3. Collaboration Server (Google Cloud)                       │
│     ┌──────────────────────────────────────────┐             │
│     │  Receive op from Alice: Insert("H", 0)  │             │
│     │                                           │             │
│     │  Transform against pending ops:          │             │
│     │  - Bob inserted "W" at 0 (5ms earlier)  │             │
│     │  - Transform Alice's op: Insert("H", 1) │             │
│     │    (position shifted by Bob's insert)    │             │
│     │                                           │             │
│     │  Store to history log                    │             │
│     │  Broadcast to all connected clients      │             │
│     └──────────────────────────────────────────┘             │
│            ↓                                                   │
│  4. Operation History (Bigtable)                              │
│     ┌──────────────────────────────────────────┐             │
│     │  Immutable log of all operations:        │             │
│     │  T=0ms:  Insert("W", 0) by Bob          │             │
│     │  T=5ms:  Insert("H", 1) by Alice        │             │
│     │  T=10ms: Insert("o", 2) by Carol        │             │
│     │  ...                                      │             │
│     │                                           │             │
│     │  Used for: Replay, undo/redo, history   │             │
│     └──────────────────────────────────────────┘             │
│            ↓                                                   │
│  5. Periodic Snapshots (Every 1000 ops)                       │
│     ┌──────────────────────────────────────────┐             │
│     │  Snapshot current document state         │             │
│     │  → Speeds up new user joins              │             │
│     │  → Don't need to replay 10M ops          │             │
│     │  Instead: Load snapshot + replay 1000   │             │
│     └──────────────────────────────────────────┘             │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### Component #1: Operational Transformation Engine

```javascript
// Simplified OT implementation (core algorithm)

class OperationalTransformation {
  // Transform two concurrent operations
  transform(op1, op2) {
    // Both ops start from same document state
    // Need to transform so both can apply

    if (op1.type === 'insert' && op2.type === 'insert') {
      return this.transformInsertInsert(op1, op2);
    }

    if (op1.type === 'insert' && op2.type === 'delete') {
      return this.transformInsertDelete(op1, op2);
    }

    if (op1.type === 'delete' && op2.type === 'delete') {
      return this.transformDeleteDelete(op1, op2);
    }

    // ... other combinations
  }

  transformInsertInsert(op1, op2) {
    // Both insert at same document state
    // Adjust position based on which came first

    if (op1.position < op2.position) {
      // op1 before op2 → op2's position shifts right
      return {
        op1: op1, // unchanged
        op2: {
          ...op2,
          position: op2.position + op1.text.length
        }
      };
    } else if (op1.position > op2.position) {
      // op2 before op1 → op1's position shifts right
      return {
        op1: {
          ...op1,
          position: op1.position + op2.text.length
        },
        op2: op2 // unchanged
      };
    } else {
      // Same position → tie-break by user ID (deterministic)
      if (op1.userId < op2.userId) {
        return {
          op1: op1,
          op2: {
            ...op2,
            position: op2.position + op1.text.length
          }
        };
      } else {
        return {
          op1: {
            ...op1,
            position: op1.position + op2.text.length
          },
          op2: op2
        };
      }
    }
  }

  transformInsertDelete(insert, del) {
    // Insert and delete conflict

    if (insert.position <= del.position) {
      // Insert before delete → delete position shifts right
      return {
        insert: insert,
        delete: {
          ...del,
          position: del.position + insert.text.length
        }
      };
    } else if (insert.position >= del.position + del.length) {
      // Insert after delete → insert position shifts left
      return {
        insert: {
          ...insert,
          position: insert.position - del.length
        },
        delete: del
      };
    } else {
      // Insert within delete range
      // Delete partially, insert, delete rest
      const splitDelete = {
        delete1: {
          type: 'delete',
          position: del.position,
          length: insert.position - del.position
        },
        delete2: {
          type: 'delete',
          position: insert.position + insert.text.length,
          length: del.length - (insert.position - del.position)
        }
      };

      return {
        insert: insert,
        delete: [splitDelete.delete1, splitDelete.delete2]
      };
    }
  }

  transformDeleteDelete(op1, op2) {
    // Two deletes conflict
    // Complex case: ranges may overlap

    const range1 = { start: op1.position, end: op1.position + op1.length };
    const range2 = { start: op2.position, end: op2.position + op2.length };

    if (range1.end <= range2.start) {
      // No overlap: op1 before op2
      return {
        op1: op1,
        op2: {
          ...op2,
          position: op2.position - op1.length
        }
      };
    } else if (range2.end <= range1.start) {
      // No overlap: op2 before op1
      return {
        op1: {
          ...op1,
          position: op1.position - op2.length
        },
        op2: op2
      };
    } else {
      // Overlap: adjust both
      const overlapStart = Math.max(range1.start, range2.start);
      const overlapEnd = Math.min(range1.end, range2.end);
      const overlapLength = overlapEnd - overlapStart;

      return {
        op1: {
          ...op1,
          length: op1.length - overlapLength
        },
        op2: {
          ...op2,
          length: op2.length - overlapLength,
          position: Math.max(0, op2.position - (range1.start < range2.start ? op1.length - overlapLength : 0))
        }
      };
    }
  }
}
```

### Component #2: Client-Side Editor

```javascript
// Google Docs client-side collaboration logic

class CollaborativeEditor {
  constructor(documentId, userId) {
    this.documentId = documentId;
    this.userId = userId;
    this.document = "";
    this.pendingOps = [];
    this.serverAck = 0; // Last acknowledged operation
    this.ot = new OperationalTransformation();

    this.connectToServer();
  }

  // User types a character
  onKeyPress(char, position) {
    // 1. Apply locally immediately (optimistic UI)
    this.document = this.insertAt(this.document, position, char);

    // 2. Create operation
    const op = {
      type: 'insert',
      position: position,
      text: char,
      userId: this.userId,
      timestamp: Date.now()
    };

    // 3. Add to pending queue
    this.pendingOps.push(op);

    // 4. Send to server
    this.sendToServer(op);

    // 5. Update UI
    this.render();
  }

  // Receive operation from another user
  onServerOperation(op) {
    // Transform against all pending operations
    let transformedOp = op;

    for (const pendingOp of this.pendingOps) {
      const result = this.ot.transform(transformedOp, pendingOp);
      transformedOp = result.op1; // Other user's op
      // result.op2 would update pendingOp, but we don't modify pending
    }

    // Apply transformed operation
    if (transformedOp.type === 'insert') {
      this.document = this.insertAt(
        this.document,
        transformedOp.position,
        transformedOp.text
      );
    } else if (transformedOp.type === 'delete') {
      this.document = this.deleteAt(
        this.document,
        transformedOp.position,
        transformedOp.length
      );
    }

    // Update UI
    this.render();
  }

  // Server acknowledges our operation
  onServerAck(opId) {
    // Remove from pending queue
    this.pendingOps = this.pendingOps.filter(op => op.id !== opId);
    this.serverAck++;
  }

  // Helper: Insert at position
  insertAt(text, position, insert) {
    return text.slice(0, position) + insert + text.slice(position);
  }

  // Helper: Delete at position
  deleteAt(text, position, length) {
    return text.slice(0, position) + text.slice(position + length);
  }

  // WebSocket connection
  connectToServer() {
    this.ws = new WebSocket(`wss://docs.google.com/ws/${this.documentId}`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'operation') {
        this.onServerOperation(message.op);
      } else if (message.type === 'ack') {
        this.onServerAck(message.opId);
      }
    };
  }

  sendToServer(op) {
    this.ws.send(JSON.stringify({
      type: 'operation',
      documentId: this.documentId,
      op: op
    }));
  }
}
```

### Component #3: Server-Side Collaboration Hub

```javascript
// Google Docs server handling multiple editors

class CollaborationServer {
  constructor() {
    this.documents = new Map(); // documentId → Document
    this.connections = new Map(); // userId → WebSocket
  }

  handleConnection(ws, userId, documentId) {
    // Store connection
    this.connections.set(userId, ws);

    // Get or create document
    let doc = this.documents.get(documentId);
    if (!doc) {
      doc = new Document(documentId);
      this.documents.set(documentId, doc);
    }

    // Send current document state to new user
    ws.send(JSON.stringify({
      type: 'init',
      document: doc.getState(),
      operations: doc.getRecentOperations(1000) // Last 1000 ops
    }));

    // Handle incoming operations
    ws.on('message', (data) => {
      const message = JSON.parse(data);

      if (message.type === 'operation') {
        this.handleOperation(message.op, documentId, userId);
      }
    });

    ws.on('close', () => {
      this.connections.delete(userId);
      doc.removeUser(userId);
    });
  }

  handleOperation(op, documentId, userId) {
    const doc = this.documents.get(documentId);

    // Apply operation to document
    doc.applyOperation(op);

    // Acknowledge to sender
    const senderWs = this.connections.get(userId);
    senderWs.send(JSON.stringify({
      type: 'ack',
      opId: op.id
    }));

    // Broadcast to all other users
    this.broadcast(documentId, {
      type: 'operation',
      op: op
    }, userId); // Exclude sender
  }

  broadcast(documentId, message, excludeUserId) {
    const doc = this.documents.get(documentId);

    for (const userId of doc.getConnectedUsers()) {
      if (userId === excludeUserId) continue;

      const ws = this.connections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }
}

class Document {
  constructor(id) {
    this.id = id;
    this.content = "";
    this.operations = []; // Operation history
    this.users = new Set();
  }

  applyOperation(op) {
    // Transform against pending operations (if any)
    let transformedOp = op;

    // Apply to document
    if (op.type === 'insert') {
      this.content = this.insertAt(this.content, transformedOp.position, transformedOp.text);
    } else if (op.type === 'delete') {
      this.content = this.deleteAt(this.content, transformedOp.position, transformedOp.length);
    }

    // Store in history
    this.operations.push(op);

    // Persist to database (async)
    this.persistOperation(op);
  }

  async persistOperation(op) {
    // Store to Google Bigtable
    await bigtable.insert({
      documentId: this.id,
      timestamp: Date.now(),
      operation: op
    });
  }

  getState() {
    return this.content;
  }

  getRecentOperations(n) {
    return this.operations.slice(-n);
  }

  getConnectedUsers() {
    return Array.from(this.users);
  }

  removeUser(userId) {
    this.users.delete(userId);
  }

  insertAt(text, position, insert) {
    return text.slice(0, position) + insert + text.slice(position);
  }

  deleteAt(text, position, length) {
    return text.slice(0, position) + text.slice(position + length);
  }
}
```

---

## 🏆 Social Proof: Real-World Numbers

### Google Docs
- **Users:** 2 billion worldwide
- **Concurrent editors:** Up to 50 per document
- **Operations:** Billions per day
- **Conflict resolution:** 100% automatic
- **Average latency:** 100ms (keystroke → others see it)
- **Reliability:** 99.9% uptime
- **Scale:** Handles 5 million new docs per day

### Figma (Design Collaboration)
- **Users:** 4 million designers
- **Concurrent editors:** Up to 200 per file (more than Google Docs!)
- **Operations:** Millions per second
- **Technology:** Custom CRDT (not OT)
- **Latency:** 50ms average (faster than Google Docs)
- **Why:** Design requires even more real-time interaction

### Notion (Knowledge Base)
- **Users:** 30 million
- **Concurrent editors:** Up to 20 per page
- **Technology:** Hybrid OT + CRDT
- **Unique feature:** Block-level collaboration (granular locking)
- **Latency:** 150ms average

### Microsoft 365 (Word Online)
- **Users:** 345 million Office 365 subscribers
- **Technology:** OT (licensed from Google after patent dispute)
- **Latency:** 200ms average (slower than Google Docs)
- **Why slower:** More complex formatting, legacy compatibility

---

## ⚡ Quick Win: Build Collaborative Editor in 20 Minutes

### Minimal Collaborative Text Editor

```javascript
// Simple collaborative editor using ShareDB (open-source OT library)

const ShareDB = require('sharedb');
const WebSocket = require('ws');
const http = require('http');

// 1. Create ShareDB server
const backend = new ShareDB();
const connection = backend.connect();

// 2. Create HTTP server
const server = http.createServer();

// 3. Attach WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  const stream = new WebSocket.Stream(ws);
  backend.listen(stream);
});

// 4. Client-side code (browser)
const clientHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Collaborative Editor</title>
  <script src="https://cdn.jsdelivr.net/npm/sharedb@1.0.0/dist/sharedb-client.js"></script>
</head>
<body>
  <h1>Collaborative Text Editor</h1>
  <textarea id="editor" rows="20" cols="80"></textarea>

  <script>
    // Connect to ShareDB server
    const socket = new WebSocket('ws://localhost:8080');
    const connection = new sharedb.Connection(socket);

    // Get or create document
    const doc = connection.get('documents', 'my-document');

    doc.subscribe((err) => {
      if (err) throw err;

      // Initialize document if new
      if (!doc.type) {
        doc.create({ content: '' }, (err) => {
          if (err) throw err;
        });
        return;
      }

      // Bind to textarea
      const editor = document.getElementById('editor');
      editor.value = doc.data.content;

      // Listen for local changes
      editor.addEventListener('input', (e) => {
        const op = [
          { p: ['content'], si: e.data }  // String insert
        ];
        doc.submitOp(op);
      });

      // Listen for remote changes
      doc.on('op', (op) => {
        // Update textarea with remote changes
        editor.value = doc.data.content;
      });
    });
  </script>
</body>
</html>
`;

// 5. Serve HTML
server.on('request', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(clientHTML);
});

// 6. Start server
server.listen(8080, () => {
  console.log('Collaborative editor running on http://localhost:8080');
  console.log('Open in multiple tabs to test real-time collaboration!');
});
```

**Test it:**
```bash
# Install dependencies
npm install sharedb ws

# Run server
node server.js

# Open http://localhost:8080 in 2-3 browser tabs
# Type in one tab → see it appear in others instantly!
```

---

## 🎯 Call to Action: Master Real-Time Collaboration

**What you learned:**
- ✅ Operational Transformation (OT) transforms conflicting operations
- ✅ Operations (not state) are synced for real-time collaboration
- ✅ WebSocket provides bidirectional real-time communication
- ✅ Optimistic UI applies local changes immediately (feels instant)
- ✅ Transform ensures eventual consistency (all users see same document)

**Next steps:**
1. **POC:** Build the collaborative editor above (20 min)
2. **Deep dive:** Study Google's OT whitepaper
3. **Advanced:** Implement CRDTs (Conflict-free Replicated Data Types)
4. **Interview:** Practice explaining OT transformation algorithm

**Common interview questions:**
- "How does Google Docs handle simultaneous editing?"
- "What's the difference between OT and CRDTs?"
- "How do you ensure eventual consistency in distributed systems?"
- "Design a collaborative code editor like VS Code Live Share"
- "Explain how to handle network partitions in collaborative editing"

---

**Time to read:** 18-22 minutes
**Difficulty:** ⭐⭐⭐⭐ Advanced
**Key takeaway:** OT transforms operations so conflicting edits can coexist perfectly

*Related articles:* WebSocket Architecture, Real-Time Systems, Distributed Consensus
