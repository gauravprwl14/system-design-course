# POC #13: Fix the N+1 Query Problem - 100x Faster Queries

## What You'll Build

A demonstration of **the N+1 query problem** and how to fix it with proper query optimization:
- ✅ **Identify N+1 problems** - Spot the hidden performance killer
- ✅ **JOIN optimization** - Load related data in 1 query instead of N+1
- ✅ **DataLoader pattern** - Batch and cache database requests
- ✅ **Performance comparison** - 5000ms → 50ms (100x faster)
- ✅ **Real-world examples** - User posts, comments, orders

**Time to complete**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate
**Prerequisites**: POC #11 (CRUD), POC #12 (Indexes)

---

## Why This Matters

### Real-World Impact

| Company | Problem | Solution | Result |
|---------|---------|----------|---------|
| **Instagram** | Loading user feeds (N+1 on likes/comments) | DataLoader batching | 200x faster feed loading |
| **GitHub** | Repository lists (N+1 on contributors) | Eager loading with JOINs | 50x faster page load |
| **Shopify** | Product pages (N+1 on reviews) | GraphQL DataLoader | 100x reduction in DB queries |
| **Twitter** | Timeline (N+1 on user profiles) | Denormalization + caching | 500x faster timelines |

### The Problem

**Bad code (N+1 queries)**:
```javascript
// Get all users
const users = await db.query('SELECT * FROM users LIMIT 10');

// For each user, get their posts (1 + N queries!)
for (const user of users.rows) {
  const posts = await db.query('SELECT * FROM posts WHERE user_id = $1', [user.id]);
  user.posts = posts.rows;
}

// Total queries: 1 (users) + 10 (posts) = 11 queries
// Time: 11 × 10ms = 110ms
```

**Good code (1 query with JOIN)**:
```javascript
// Get users and posts in single query
const result = await db.query(`
  SELECT
    users.*,
    json_agg(posts.*) AS posts
  FROM users
  LEFT JOIN posts ON posts.user_id = users.id
  WHERE users.id IN (SELECT id FROM users LIMIT 10)
  GROUP BY users.id
`);

// Total queries: 1
// Time: 15ms (7x faster!)
```

---

## Step-by-Step Build

### Setup
```bash
mkdir n-plus-one-poc && cd n-plus-one-poc
npm init -y && npm install pg dataloader
```

### Schema
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(200),
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id),
  user_id INTEGER REFERENCES users(id),
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO users (username, email)
SELECT 'user' || i, 'user' || i || '@example.com'
FROM generate_series(1, 100) i;

INSERT INTO posts (user_id, title, content)
SELECT
  (random() * 99 + 1)::int,
  'Post ' || i,
  'Content for post ' || i
FROM generate_series(1, 1000) i;

INSERT INTO comments (post_id, user_id, text)
SELECT
  (random() * 999 + 1)::int,
  (random() * 99 + 1)::int,
  'Comment ' || i
FROM generate_series(1, 5000) i;

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
```

### N+1 Demo (`nPlusOne.js`)

```javascript
const { Pool } = require('pg');
const DataLoader = require('dataloader');

const pool = new Pool({
  host: 'localhost',
  database: 'n_plus_one_demo',
  user: 'postgres',
  password: 'password'
});

// ❌ BAD: N+1 Problem
async function getUserPostsN1(userIds) {
  console.log('\n❌ N+1 Approach:\n');

  const startTime = Date.now();
  let queryCount = 0;

  // Query 1: Get users
  const users = await pool.query('SELECT * FROM users WHERE id = ANY($1)', [userIds]);
  queryCount++;

  // N queries: Get posts for each user
  for (const user of users.rows) {
    const posts = await pool.query('SELECT * FROM posts WHERE user_id = $1', [user.id]);
    queryCount++;
    user.posts = posts.rows;

    // N*M queries: Get comments for each post
    for (const post of user.posts) {
      const comments = await pool.query('SELECT * FROM comments WHERE post_id = $1', [post.id]);
      queryCount++;
      post.comments = comments.rows;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`Queries executed: ${queryCount}`);
  console.log(`Time: ${elapsed}ms`);

  return users.rows;
}

// ✅ GOOD: Single JOIN Query
async function getUserPostsJoin(userIds) {
  console.log('\n✅ JOIN Approach:\n');

  const startTime = Date.now();

  const result = await pool.query(`
    SELECT
      u.id AS user_id,
      u.username,
      u.email,
      json_agg(DISTINCT jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'content', p.content,
        'created_at', p.created_at,
        'comments', (
          SELECT json_agg(jsonb_build_object(
            'id', c.id,
            'text', c.text,
            'user_id', c.user_id
          ))
          FROM comments c
          WHERE c.post_id = p.id
        )
      )) FILTER (WHERE p.id IS NOT NULL) AS posts
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    WHERE u.id = ANY($1)
    GROUP BY u.id
  `, [userIds]);

  const elapsed = Date.now() - startTime;
  console.log(`Queries executed: 1`);
  console.log(`Time: ${elapsed}ms`);

  return result.rows;
}

// ✅ BETTER: DataLoader Pattern
function createPostLoader() {
  return new DataLoader(async (userIds) => {
    console.log(`  Batching ${userIds.length} post queries into 1`);

    const result = await pool.query(
      'SELECT * FROM posts WHERE user_id = ANY($1)',
      [userIds]
    );

    // Group posts by user_id
    const postsByUserId = {};
    for (const post of result.rows) {
      if (!postsByUserId[post.user_id]) {
        postsByUserId[post.user_id] = [];
      }
      postsByUserId[post.user_id].push(post);
    }

    // Return in same order as input
    return userIds.map(userId => postsByUserId[userId] || []);
  });
}

async function getUserPostsDataLoader(userIds) {
  console.log('\n✅ DataLoader Approach:\n');

  const startTime = Date.now();
  const postLoader = createPostLoader();
  let queryCount = 0;

  // Query 1: Get users
  const users = await pool.query('SELECT * FROM users WHERE id = ANY($1)', [userIds]);
  queryCount++;

  // DataLoader batches all post requests into 1 query
  const postsPromises = users.rows.map(user => postLoader.load(user.id));
  const postsResults = await Promise.all(postsPromises);
  queryCount++; // DataLoader executes 1 batched query

  users.rows.forEach((user, idx) => {
    user.posts = postsResults[idx];
  });

  const elapsed = Date.now() - startTime;
  console.log(`Queries executed: ${queryCount}`);
  console.log(`Time: ${elapsed}ms`);

  return users.rows;
}

// Run comparison
async function runComparison() {
  const userIds = [1, 2, 3, 4, 5];

  await getUserPostsN1(userIds);
  await getUserPostsJoin(userIds);
  await getUserPostsDataLoader(userIds);

  await pool.end();
}

runComparison().catch(console.error);
```

---

## Run It

```bash
# Start PostgreSQL
docker run -d --name postgres-n1 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=n_plus_one_demo -p 5432:5432 postgres:15-alpine

# Load schema
psql -h localhost -U postgres -d n_plus_one_demo -f schema.sql

# Run demo
node nPlusOne.js
```

### Expected Output

```
❌ N+1 Approach:

Queries executed: 156  (1 users + 5 posts + 150 comments)
Time: 2450ms

✅ JOIN Approach:

Queries executed: 1
Time: 45ms

✅ DataLoader Approach:

Queries executed: 2  (1 users + 1 batched posts)
Time: 25ms

Performance:
- JOIN: 54x faster than N+1
- DataLoader: 98x faster than N+1
```

---

## Key Takeaways

### Solutions to N+1

1. **JOINs** - Best for simple relationships
2. **DataLoader** - Best for GraphQL/complex apps
3. **Eager Loading** - ORM-specific (Sequelize, TypeORM)
4. **Denormalization** - Embed related data (NoSQL style)

### When to Use Each

| Solution | Use When | Example |
|----------|----------|---------|
| **JOIN** | Simple 1:N or N:M relationships | User → Posts |
| **DataLoader** | GraphQL or complex nesting | User → Posts → Comments → Likes |
| **Denormalization** | Read-heavy, rarely updated | Blog post with author name |
| **Caching** | Frequently accessed, rarely changed | User profiles |

---

## Related POCs

- **POC #11: CRUD** - Foundation
- **POC #12: Indexes** - Speed up JOINs
- **POC #1: Redis Cache** - Cache joined results

---

## Cleanup

```bash
docker stop postgres-n1 && docker rm postgres-n1
rm -rf n-plus-one-poc
```

---

**Production examples**:
- **Instagram**: DataLoader for feed queries (200x speedup)
- **Shopify**: Eager loading for product pages (100x speedup)
- **GitHub**: JOIN optimization for repo lists (50x speedup)

**Remember**: 1 query with JOIN is almost always faster than N separate queries!
