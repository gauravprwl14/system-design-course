# API Design: REST vs GraphQL vs gRPC

## 🎯 The $47M Question

How do you choose between **REST, GraphQL, and gRPC** when the wrong choice could cost millions?

**Netflix learned this the hard way:**
- Started with **REST APIs** for mobile apps
- **84% of bandwidth** wasted on unused data (over-fetching)
- Switched to **GraphQL** → reduced API calls by **73%**
- Then to **gRPC for internal services** → **15x faster** than REST

**The pattern:** Each protocol solves different problems. Use REST for public APIs, GraphQL for client-driven UIs, gRPC for microservices.

---

## 🚫 Anti-Patterns (What NOT to Do)

### ❌ **Wrong: REST for Everything**
```javascript
// Mobile app needs user + posts + comments
// REST requires 3 separate requests

// Request 1: Get user
GET /api/users/123
// Response: { id: 123, name: "Alice", email: "...", bio: "...", ... }
// Problem: Returns 20 fields, app only needs 2 (name, avatar)

// Request 2: Get user's posts
GET /api/users/123/posts
// Response: [{ id: 1, title: "...", body: "...", author: {...}, ... }]
// Problem: Returns full author object (already have it!)

// Request 3: Get comments for each post
GET /api/posts/1/comments
GET /api/posts/2/comments
GET /api/posts/3/comments
// Problem: N+1 queries! 1 + N requests = 31 requests for 30 posts
```

**Why This Fails:**
- **Over-fetching:** 84% of data unused (Netflix measured this)
- **Under-fetching:** Multiple round trips (3-30+ requests)
- **Network overhead:** 31 requests × 100ms latency = 3.1 seconds
- **Mobile data waste:** Users pay for unused bandwidth

### ❌ **Wrong: GraphQL for Public APIs**
```graphql
# Public API with GraphQL = Security nightmare
query {
  users {
    posts {
      comments {
        author {
          posts {
            comments {
              # ← Attacker can nest 100 levels deep!
            }
          }
        }
      }
    }
  }
}

# Result: Single query causes database meltdown
# Solution: Rate limiting, query depth limits, query cost analysis
# Problem: Why not just use REST with proper endpoints?
```

**Why This Fails:**
- **DoS attacks** via deeply nested queries
- **Complexity** for simple CRUD operations
- **Caching hell** (can't use CDN effectively)
- **Documentation burden** (schema maintenance)

### ❌ **Wrong: gRPC for Browser Clients**
```protobuf
// gRPC requires HTTP/2 and binary protocol
// Browsers don't fully support gRPC-Web yet

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}

// Client code (requires grpc-web proxy!)
const client = new UserServiceClient('https://api.example.com');
const request = new GetUserRequest();
request.setUserId(123);

client.getUser(request, {}, (err, response) => {
  // Problem: Need gRPC-Web proxy (Envoy) in front of backend
  // Problem: Binary protocol not debuggable in DevTools
  // Problem: Limited browser support
});
```

**Why This Fails:**
- **Browser incompatibility** (needs proxy)
- **Tooling overhead** (Envoy, protobuf compilation)
- **Debugging pain** (binary format)
- **Overkill** for simple client-server communication

---

## 💡 Paradigm Shift

> **"The best API protocol is the one that matches your data access pattern."**

**The Decision Matrix:**

| Protocol | Best For | When to Use |
|----------|----------|-------------|
| **REST** | Public APIs, CRUD operations | Simple resources, caching, third-party integrations |
| **GraphQL** | Client-driven UIs, mobile apps | Complex data fetching, multiple clients with different needs |
| **gRPC** | Internal microservices | High performance, type safety, streaming, service mesh |

**Netflix's Evolution:**
1. **2010:** REST for everything → over-fetching hell
2. **2013:** Falcor (precursor to GraphQL) → 73% fewer API calls
3. **2016:** gRPC for internal services → 15x faster than REST
4. **2024:** REST (public), GraphQL (UI), gRPC (backend)

---

## ✅ The Solution: Use All Three (in the Right Places)

### **1. REST: The Reliable Workhorse**

**When to Use:**
- ✅ Public APIs (third-party developers)
- ✅ Simple CRUD operations (GET/POST/PUT/DELETE)
- ✅ Resource-based data (users, posts, products)
- ✅ Need HTTP caching (CDN, browser cache)

**Example: Stripe API (Best-in-Class REST)**
```javascript
// Clean, predictable resource endpoints
GET    /v1/customers/cus_123
POST   /v1/customers
PUT    /v1/customers/cus_123
DELETE /v1/customers/cus_123

// Nested resources
GET /v1/customers/cus_123/subscriptions

// Filtering & pagination
GET /v1/charges?limit=100&starting_after=ch_123

// Idempotency (retry safety)
POST /v1/charges
Headers: { "Idempotency-Key": "unique_key_123" }

// Versioning (backwards compatibility)
GET /v1/customers  (current API)
GET /v2/customers  (new version, old still works)
```

**REST Best Practices:**
- Use **nouns** for resources, **verbs** for HTTP methods
- Implement **pagination** (limit/offset or cursor-based)
- Use **HTTP status codes** correctly (200, 201, 400, 401, 404, 500)
- Support **filtering** with query params (`?status=active&sort=created_at`)
- Add **versioning** (`/v1/`, `/v2/`) for breaking changes
- Implement **rate limiting** (429 Too Many Requests)
- Use **ETags** for caching (`If-None-Match` header)

**Performance:**
- Latency: **~50-200ms** per request (network + processing)
- Throughput: **1,000-10,000 req/sec** per server
- Data efficiency: **Over-fetching common** (84% for Netflix)

---

### **2. GraphQL: The Flexible Query Language**

**When to Use:**
- ✅ Mobile apps (minimize data transfer)
- ✅ Complex UIs with varying data needs
- ✅ Multiple clients (iOS, Android, Web) with different requirements
- ✅ Rapid frontend iteration (no backend changes needed)

**Example: Shopify GraphQL API**
```graphql
# Single request fetches exactly what's needed
query {
  shop {
    name
    products(first: 10) {
      edges {
        node {
          id
          title
          variants(first: 5) {
            edges {
              node {
                price
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
}

# Response: Only requested fields (no over-fetching!)
{
  "data": {
    "shop": {
      "name": "My Store",
      "products": {
        "edges": [
          {
            "node": {
              "id": "gid://shopify/Product/123",
              "title": "T-Shirt",
              "variants": {
                "edges": [
                  { "node": { "price": "19.99", "inventoryQuantity": 50 } }
                ]
              }
            }
          }
        ]
      }
    }
  }
}
```

**GraphQL Schema (Type Safety)**
```graphql
type Query {
  user(id: ID!): User
  posts(limit: Int, offset: Int): [Post!]!
}

type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
  comments: [Comment!]!
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  deletePost(id: ID!): Boolean!
}

input CreatePostInput {
  title: String!
  body: String!
}
```

**Server Implementation (Node.js + Apollo)**
```javascript
const { ApolloServer, gql } = require('apollo-server');

// Schema definition
const typeDefs = gql`
  type Query {
    user(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    author: User!
  }
`;

// Resolvers (data fetching logic)
const resolvers = {
  Query: {
    user: async (_, { id }, { dataSources }) => {
      return dataSources.usersAPI.getUser(id);
    }
  },

  User: {
    // Batching with DataLoader (solves N+1 problem)
    posts: async (user, _, { dataSources }) => {
      return dataSources.postsAPI.getPostsByUserId(user.id);
    }
  },

  Post: {
    author: async (post, _, { dataSources }) => {
      // DataLoader batches these into single query
      return dataSources.usersAPI.getUser(post.authorId);
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
server.listen().then(({ url }) => console.log(`🚀 Server ready at ${url}`));
```

**GraphQL Best Practices:**
- **Limit query depth** (max 5-10 levels to prevent DoS)
- **Implement query cost analysis** (assign cost to each field)
- **Use DataLoader** for batching (solves N+1 problem)
- **Add pagination** (cursor-based, not offset)
- **Rate limit by query cost** (not just request count)
- **Version schema carefully** (deprecate fields, don't break)
- **Monitor slow resolvers** (query execution time)

**Performance:**
- Latency: **~30-100ms** (single request vs REST's multiple)
- Data efficiency: **~70% reduction** in payload size (Shopify measured)
- Network: **73% fewer requests** (Netflix measured)

**GraphQL Gotchas:**
- ❌ **Caching is hard** (can't use HTTP cache easily)
- ❌ **File uploads tricky** (requires multipart spec)
- ❌ **Query complexity** can cause DoS (need safeguards)

---

### **3. gRPC: The High-Performance Beast**

**When to Use:**
- ✅ Internal microservices (service-to-service)
- ✅ Real-time streaming (bidirectional)
- ✅ Polyglot environments (Go, Java, Python, etc.)
- ✅ Type safety required (compile-time checks)

**Example: Netflix Internal Service Mesh**
```protobuf
// user_service.proto
syntax = "proto3";

package netflix.users;

service UserService {
  // Unary RPC (request-response)
  rpc GetUser(GetUserRequest) returns (User);

  // Server streaming (one request, multiple responses)
  rpc GetUserActivity(GetUserActivityRequest) returns (stream Activity);

  // Client streaming (multiple requests, one response)
  rpc BulkCreateUsers(stream CreateUserRequest) returns (BulkCreateResponse);

  // Bidirectional streaming (chat, real-time updates)
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message GetUserRequest {
  int64 user_id = 1;
}

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  repeated string roles = 4;  // Type-safe repeated field
}

message Activity {
  int64 timestamp = 1;
  string action = 2;
  string resource = 3;
}
```

**Server Implementation (Go)**
```go
package main

import (
  "context"
  "log"
  "net"

  pb "github.com/netflix/user-service/proto"
  "google.golang.org/grpc"
)

type server struct {
  pb.UnimplementedUserServiceServer
}

// Unary RPC
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
  // Fetch from database
  user := &pb.User{
    Id:    req.UserId,
    Name:  "Alice",
    Email: "alice@netflix.com",
    Roles: []string{"admin", "user"},
  }
  return user, nil
}

// Server streaming RPC
func (s *server) GetUserActivity(req *pb.GetUserActivityRequest, stream pb.UserService_GetUserActivityServer) error {
  // Fetch activities and stream them
  activities := fetchActivities(req.UserId)

  for _, activity := range activities {
    if err := stream.Send(activity); err != nil {
      return err
    }
  }

  return nil
}

func main() {
  lis, err := net.Listen("tcp", ":50051")
  if err != nil {
    log.Fatalf("failed to listen: %v", err)
  }

  grpcServer := grpc.NewServer(
    grpc.MaxRecvMsgSize(10 * 1024 * 1024),  // 10 MB max message
    grpc.ConnectionTimeout(time.Second * 5),
  )

  pb.RegisterUserServiceServer(grpcServer, &server{})

  log.Println("gRPC server listening on :50051")
  if err := grpcServer.Serve(lis); err != nil {
    log.Fatalf("failed to serve: %v", err)
  }
}
```

**Client Implementation (Node.js)**
```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Load protobuf
const packageDefinition = protoLoader.loadSync('user_service.proto');
const proto = grpc.loadPackageDefinition(packageDefinition).netflix.users;

// Create client
const client = new proto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Unary call
client.GetUser({ user_id: 123 }, (err, response) => {
  console.log('User:', response);
  // User: { id: 123, name: 'Alice', email: 'alice@netflix.com', roles: ['admin', 'user'] }
});

// Server streaming
const activityStream = client.GetUserActivity({ user_id: 123 });

activityStream.on('data', (activity) => {
  console.log('Activity:', activity);
});

activityStream.on('end', () => {
  console.log('Stream ended');
});
```

**gRPC Best Practices:**
- **Use HTTP/2** (multiplexing, header compression)
- **Enable compression** (gzip for payloads >1 KB)
- **Implement health checks** (`grpc.health.v1.Health`)
- **Add interceptors** for auth, logging, metrics
- **Use deadlines** (timeout for all RPCs)
- **Version protobufs carefully** (add fields, don't remove)
- **Monitor stream lifetimes** (detect stuck connections)

**Performance:**
- Latency: **~5-20ms** (15x faster than REST for Netflix)
- Throughput: **100K-1M+ req/sec** per server (binary protocol)
- Data efficiency: **~30% smaller** than JSON (protobuf compression)

**gRPC Advantages:**
- ✅ **Type safety** (compile-time errors, not runtime)
- ✅ **Code generation** (client libraries in 10+ languages)
- ✅ **Streaming** (server, client, bidirectional)
- ✅ **HTTP/2** (multiplexing, server push)

---

## 🏢 Real-World Decision Matrix

### **Stripe (Public Payment API)**
**Choice:** REST
- **Why:** Third-party developers expect REST
- **Scale:** 10,000+ req/sec, 99.99% uptime
- **Tradeoff:** Over-fetching accepted for simplicity

### **Shopify (E-commerce Admin)**
**Choice:** GraphQL
- **Why:** Complex UIs with varying data needs (web, mobile, POS)
- **Result:** 70% reduction in payload size
- **Tradeoff:** Query cost monitoring required

### **Netflix (Microservices)**
**Choice:** gRPC (internal), REST (public API)
- **Why:** 15x faster for service-to-service, type safety
- **Scale:** 1 billion+ RPC calls/day
- **Tradeoff:** Complexity (protobuf compilation, tooling)

### **GitHub (Git Operations)**
**Choice:** All three!
- **REST:** Public API (v3)
- **GraphQL:** Advanced queries (v4)
- **gRPC:** Internal Git operations
- **Why:** Different use cases, different protocols

---

## 📊 Performance Comparison

| Metric | REST | GraphQL | gRPC |
|--------|------|---------|------|
| **Latency** | ~100ms | ~50ms | ~10ms |
| **Throughput** | 10K req/sec | 20K req/sec | 1M req/sec |
| **Payload Size** | 100% (baseline) | 30% (70% smaller) | 20% (80% smaller) |
| **Network Calls** | N (multiple endpoints) | 1 (single query) | 1 (streaming) |
| **Caching** | ✅ Easy (HTTP) | ❌ Hard | ❌ Very hard |
| **Browser Support** | ✅ Native | ✅ Native | ❌ Needs proxy |
| **Type Safety** | ❌ No | ✅ Schema | ✅ Protobuf |
| **Tooling** | ✅ Excellent | ✅ Good | ⚠️ Requires setup |

---

## 🎯 The Netflix Playbook

**Phase 1: REST (2007-2012)**
- Public API for third-party apps
- **Problem:** Mobile apps over-fetching 84% of data

**Phase 2: Falcor → GraphQL (2013-2016)**
- Developed Falcor (similar to GraphQL)
- **Result:** 73% fewer API calls, 40% faster mobile app

**Phase 3: gRPC for Microservices (2016+)**
- Internal services migrated to gRPC
- **Result:** 15x faster than REST, 30% smaller payloads

**Current Architecture (2024):**
```
┌──────────────────────────────────────────────┐
│  Netflix Architecture                        │
├──────────────────────────────────────────────┤
│                                              │
│  Public API (REST)                           │
│  └─> Third-party developers                 │
│                                              │
│  Client Apps (GraphQL)                       │
│  ├─> iOS, Android, Web, Smart TVs           │
│  └─> Single query = user + recommendations  │
│                                              │
│  Backend Services (gRPC)                     │
│  ├─> Recommendation Engine                  │
│  ├─> Video Encoding                         │
│  ├─> User Authentication                    │
│  └─> Billing Service                        │
│      (1 billion+ RPC calls/day)             │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🚀 Next Steps

1. **Evaluate your use case:**
   - Public API → **REST**
   - Complex UI → **GraphQL**
   - Microservices → **gRPC**

2. **Start small:**
   - REST: Stripe API as reference
   - GraphQL: Apollo Server tutorial
   - gRPC: Build a simple Go service

3. **Monitor performance:**
   - REST: Cache hit rate, response time
   - GraphQL: Query cost, resolver time
   - gRPC: RPC latency, stream duration

**Up Next:** POC #56 - RESTful API Best Practices (How Stripe built the world's best API)

---

## 📚 References

- [REST API Design Best Practices](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)
- [GraphQL Official Docs](https://graphql.org/learn/)
- [gRPC Performance Benchmarks](https://grpc.io/docs/guides/benchmarking/)
- [Netflix Falcor](https://netflix.github.io/falcor/)
- [Shopify GraphQL Design Tutorial](https://shopify.engineering/shopify-graphql-design-tutorial)
