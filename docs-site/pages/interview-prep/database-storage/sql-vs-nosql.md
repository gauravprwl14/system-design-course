# SQL vs NoSQL: When to Use Each

## Question
**"Explain the difference between SQL and NoSQL databases. When would you use one over the other?"**

Common in: Backend, System Design, Database interviews

---

## 📊 Quick Answer

| Feature | SQL (Relational) | NoSQL (Non-Relational) |
|---------|------------------|------------------------|
| **Schema** | Fixed, predefined | Flexible, dynamic |
| **Data Model** | Tables with rows/columns | Documents, Key-Value, Column, Graph |
| **Scaling** | Vertical (hard to scale) | Horizontal (easy to scale) |
| **ACID** | Strong (transactions) | Eventual consistency (usually) |
| **Joins** | Powerful (multiple tables) | Limited (denormalized data) |
| **Use Case** | Structured data, complex queries | Unstructured data, high scalability |
| **Examples** | PostgreSQL, MySQL | MongoDB, Redis, Cassandra, DynamoDB |

**Simple Rule**:
- **SQL**: Banking, e-commerce orders, user management (need consistency)
- **NoSQL**: Logs, analytics, real-time feeds, IoT (need scale + speed)

---

## 🎯 Complete Comparison

### SQL Databases (Relational)

**Characteristics**:
- Structured data in tables (rows and columns)
- Predefined schema (must define columns before inserting data)
- ACID transactions (Atomicity, Consistency, Isolation, Durability)
- Strong consistency
- Powerful JOINs across tables

**Popular SQL Databases**:
- **PostgreSQL** - Feature-rich, ACID compliant
- **MySQL** - Fast, widely used (WordPress, Facebook)
- **Oracle** - Enterprise-grade
- **SQL Server** - Microsoft ecosystem

**Example Schema**:

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL
);

-- Complex query with JOINs
SELECT
  u.name,
  u.email,
  o.id as order_id,
  o.total,
  oi.quantity,
  p.name as product_name
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE u.id = 123
ORDER BY o.created_at DESC;
```

---

### NoSQL Databases

**Characteristics**:
- Flexible schema (can add fields on the fly)
- Horizontal scaling (add more servers easily)
- Eventual consistency (usually)
- Denormalized data (duplicate data to avoid JOINs)

**Types of NoSQL Databases**:

#### 1. Document Store (MongoDB, CouchDB)

```javascript
// MongoDB - Flexible schema
db.users.insertOne({
  _id: "123",
  name: "Alice",
  email: "alice@example.com",
  address: {
    street: "123 Main St",
    city: "New York",
    country: "USA"
  },
  orders: [
    {
      id: "order-1",
      total: 99.99,
      status: "shipped",
      items: [
        { product: "Laptop", quantity: 1, price: 99.99 }
      ]
    }
  ],
  created_at: new Date()
});

// Query
db.users.find({ "address.city": "New York" });

// Add new field without schema change
db.users.updateOne(
  { _id: "123" },
  { $set: { phone: "+1-234-567-8900" } }
);
```

**Use Cases**:
- Content management systems (CMS)
- User profiles
- Product catalogs
- Real-time analytics

---

#### 2. Key-Value Store (Redis, DynamoDB)

```javascript
// Redis - Simple key-value
await redis.set('user:123', JSON.stringify({ name: 'Alice', email: 'alice@example.com' }));
await redis.get('user:123'); // Get user

// Expiring keys (TTL)
await redis.setex('session:abc123', 3600, 'user-data'); // Expire in 1 hour

// Counters
await redis.incr('page:views:homepage');

// Lists
await redis.lpush('queue:emails', 'send-to-alice@example.com');
await redis.rpop('queue:emails');
```

**Use Cases**:
- Caching
- Session storage
- Rate limiting
- Real-time leaderboards

---

#### 3. Wide-Column Store (Cassandra, HBase)

```sql
-- Cassandra - Column families
CREATE TABLE user_activity (
  user_id UUID,
  timestamp TIMESTAMP,
  activity_type TEXT,
  details TEXT,
  PRIMARY KEY (user_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC);

-- Insert
INSERT INTO user_activity (user_id, timestamp, activity_type, details)
VALUES (uuid(), toTimestamp(now()), 'page_view', '/products/123');

-- Query
SELECT * FROM user_activity
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000
  AND timestamp > '2024-01-01';
```

**Use Cases**:
- Time-series data
- IoT sensor data
- Event logging
- Analytics

---

#### 4. Graph Database (Neo4j, ArangoDB)

```cypher
// Neo4j - Graph relationships
CREATE (alice:User {name: 'Alice', email: 'alice@example.com'})
CREATE (bob:User {name: 'Bob', email: 'bob@example.com'})
CREATE (carol:User {name: 'Carol', email: 'carol@example.com'})

CREATE (alice)-[:FOLLOWS]->(bob)
CREATE (bob)-[:FOLLOWS]->(carol)
CREATE (alice)-[:FOLLOWS]->(carol)

// Find friends of friends
MATCH (user:User {name: 'Alice'})-[:FOLLOWS]->(friend)-[:FOLLOWS]->(fof)
WHERE NOT (user)-[:FOLLOWS]->(fof)
RETURN fof.name

// Recommendation: People you might know
```

**Use Cases**:
- Social networks
- Recommendation engines
- Fraud detection
- Knowledge graphs

---

## 💻 Real-World Examples

### Example 1: E-commerce System

```javascript
// Hybrid approach: SQL + NoSQL
// ecommerce-architecture.js

// SQL (PostgreSQL) - For structured, transactional data
const pgPool = new Pool({ /* ... */ });

// Users, orders, payments (need ACID transactions)
app.post('/api/checkout', async (req, res) => {
  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create order
    const order = await client.query(
      'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, req.body.total, 'pending']
    );

    // 2. Deduct inventory
    await client.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [req.body.quantity, req.body.productId]
    );

    // 3. Create payment record
    await client.query(
      'INSERT INTO payments (order_id, amount, status) VALUES ($1, $2, $3)',
      [order.id, req.body.total, 'completed']
    );

    await client.query('COMMIT');

    res.json({ success: true, order });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
});

// NoSQL (MongoDB) - For product catalog (flexible schema)
const { MongoClient } = require('mongodb');
const mongoClient = new MongoClient('mongodb://localhost:27017');
const db = mongoClient.db('ecommerce');

// Products with varying attributes
app.get('/api/products/:id', async (req, res) => {
  const product = await db.collection('products').findOne({
    _id: req.params.id
  });

  res.json(product);
});

/*
Product document:
{
  _id: "product-123",
  name: "Laptop",
  price: 999.99,
  category: "Electronics",
  specs: {
    cpu: "Intel i7",
    ram: "16GB",
    storage: "512GB SSD"
  },
  images: ["img1.jpg", "img2.jpg"],
  reviews: [
    { user: "Alice", rating: 5, comment: "Great laptop!" }
  ]
}

Different product:
{
  _id: "product-456",
  name: "T-Shirt",
  price: 19.99,
  category: "Clothing",
  sizes: ["S", "M", "L", "XL"],
  colors: ["red", "blue", "green"],
  material: "Cotton"
}
*/

// Redis - For session storage and caching
const Redis = require('ioredis');
const redis = new Redis();

// Cache product details
app.get('/api/products/:id', async (req, res) => {
  const cacheKey = `product:${req.params.id}`;

  // Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // Fetch from MongoDB
  const product = await db.collection('products').findOne({
    _id: req.params.id
  });

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(product));

  res.json(product);
});
```

---

### Example 2: Social Media Platform

```javascript
// social-media-architecture.js

// SQL (PostgreSQL) - User accounts, authentication
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await pgPool.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
    [email, hashedPassword, name]
  );

  res.json(user.rows[0]);
});

// MongoDB - Posts, comments (flexible, nested data)
app.post('/api/posts', async (req, res) => {
  const post = {
    user_id: req.user.id,
    content: req.body.content,
    media: req.body.media || [],
    likes: [],
    comments: [],
    created_at: new Date()
  };

  const result = await db.collection('posts').insertOne(post);

  res.json({ id: result.insertedId });
});

// Add comment to post (embedded document)
app.post('/api/posts/:id/comments', async (req, res) => {
  await db.collection('posts').updateOne(
    { _id: req.params.id },
    {
      $push: {
        comments: {
          user_id: req.user.id,
          text: req.body.text,
          created_at: new Date()
        }
      }
    }
  );

  res.json({ success: true });
});

// Neo4j - Social graph (followers, recommendations)
app.post('/api/follow/:userId', async (req, res) => {
  const session = neo4jDriver.session();

  await session.run(`
    MATCH (follower:User {id: $followerId})
    MATCH (followee:User {id: $followeeId})
    CREATE (follower)-[:FOLLOWS]->(followee)
  `, {
    followerId: req.user.id,
    followeeId: req.params.userId
  });

  session.close();

  res.json({ success: true });
});

// Friend suggestions
app.get('/api/suggestions', async (req, res) => {
  const session = neo4jDriver.session();

  const result = await session.run(`
    MATCH (user:User {id: $userId})-[:FOLLOWS]->(friend)-[:FOLLOWS]->(suggestion)
    WHERE NOT (user)-[:FOLLOWS]->(suggestion) AND user <> suggestion
    RETURN suggestion.id, COUNT(*) as mutual_friends
    ORDER BY mutual_friends DESC
    LIMIT 10
  `, { userId: req.user.id });

  session.close();

  const suggestions = result.records.map(r => ({
    userId: r.get('suggestion.id'),
    mutualFriends: r.get('mutual_friends').toNumber()
  }));

  res.json(suggestions);
});

// Redis - Activity feed cache
app.get('/api/feed', async (req, res) => {
  const cacheKey = `feed:${req.user.id}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // Fetch from MongoDB
  const posts = await db.collection('posts')
    .find({ user_id: { $in: req.user.following } })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  // Cache for 2 minutes
  await redis.setex(cacheKey, 120, JSON.stringify(posts));

  res.json(posts);
});
```

---

## 📊 Decision Matrix

### When to Use SQL

✅ **Use SQL when**:
- Data has clear structure and relationships
- Need ACID transactions (banking, payments)
- Complex queries with JOINs
- Data integrity is critical
- Frequent updates to existing records

**Examples**:
- Banking systems
- E-commerce orders
- User authentication
- Inventory management
- Accounting systems

---

### When to Use NoSQL

✅ **Use NoSQL when**:
- Schema changes frequently
- Need horizontal scaling (millions of users)
- Denormalized data (few JOINs)
- High read/write throughput
- Eventual consistency is acceptable

**Examples**:
- Social media feeds
- Real-time analytics
- IoT sensor data
- Content management
- Logging/monitoring

---

## ⚖️ Trade-offs

### SQL Advantages
- ✅ Strong consistency (ACID)
- ✅ Powerful query language (SQL)
- ✅ Data integrity (foreign keys, constraints)
- ✅ Mature ecosystem
- ✅ Standardized (portable across vendors)

### SQL Disadvantages
- ❌ Hard to scale horizontally
- ❌ Schema changes require migrations
- ❌ Slower for simple key-value lookups
- ❌ Not ideal for unstructured data

---

### NoSQL Advantages
- ✅ Flexible schema
- ✅ Horizontal scaling (sharding)
- ✅ High performance for specific use cases
- ✅ Better for unstructured data
- ✅ Optimized for specific data models (graph, document, etc.)

### NoSQL Disadvantages
- ❌ Eventual consistency (usually)
- ❌ No standardized query language
- ❌ Complex queries are harder
- ❌ Data duplication (denormalization)
- ❌ Limited transaction support

---

## 🎓 Interview Tips

### Common Questions

**Q: Can you use both SQL and NoSQL together?**
A: "Yes! This is called **polyglot persistence**. Use SQL for transactional data (orders, payments) and NoSQL for catalog data (products, posts). Example: E-commerce uses PostgreSQL for orders + MongoDB for product catalog + Redis for caching."

**Q: How do you scale SQL databases?**
A: "1) Vertical scaling (bigger server), 2) Read replicas (for read-heavy workloads), 3) Sharding (split data across servers), 4) Caching (Redis) to reduce DB load. NoSQL scales horizontally more easily."

**Q: What is CAP theorem?**
A: "CAP = Consistency, Availability, Partition Tolerance. You can only have 2 of 3:
- SQL databases choose **CP** (consistency + partition tolerance)
- NoSQL databases often choose **AP** (availability + partition tolerance)
- Can't have all 3 in a distributed system."

**Q: When is NoSQL a bad choice?**
A: "When you need complex transactions (multi-table updates must succeed together), strong consistency (banking), or complex reporting with JOINs across many entities. NoSQL doesn't handle these well."

---

## 🔗 Related Questions

- [Database Scaling Strategies](/interview-prep/database-storage/scaling-strategies)
- [Query Optimization](/interview-prep/database-storage/query-optimization)
- [Indexing Strategies](/interview-prep/database-storage/indexing-strategies)
- [Redis Caching Fundamentals](/interview-prep/caching-cdn/redis-fundamentals)

---

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [CAP Theorem Explained](https://en.wikipedia.org/wiki/CAP_theorem)
- [Database Comparison](https://db-engines.com/en/ranking)
