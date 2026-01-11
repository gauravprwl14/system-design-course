# POC #20: Full-Text Search in PostgreSQL

## What You'll Build

**Production-grade search** without Elasticsearch:
- ✅ **tsvector & tsquery** - PostgreSQL full-text search
- ✅ **GIN indexes** - Fast text search on millions of rows
- ✅ **Ranking** - Sort by relevance
- ✅ **Stemming** - Match "running" and "run"
- ✅ **Fuzzy search** - Handle typos

**Time**: 20 min | **Difficulty**: ⭐⭐ Intermediate

---

## Why This Matters

| Company | Search Volume | Strategy |
|---------|--------------|----------|
| **Stack Overflow** | 100M queries/day | PostgreSQL full-text (until 50M posts) |
| **GitLab** | 10M queries/day | PostgreSQL full-text for code search |
| **Discourse** | 5M queries/day | PostgreSQL full-text for forums |

**When to use PostgreSQL search**:
- ✅ < 10M documents
- ✅ Simple search requirements
- ✅ Want to avoid Elasticsearch complexity

**When to use Elasticsearch**:
- ✅ > 10M documents
- ✅ Complex queries (facets, aggregations)
- ✅ Real-time analytics

---

## Quick Start

### Schema

```sql
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT,
  content TEXT,
  author VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add tsvector column
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Create GIN index (required for performance!)
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- Auto-update search_vector on INSERT/UPDATE
CREATE TRIGGER articles_search_update
BEFORE INSERT OR UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(search_vector, 'pg_catalog.english', title, content);

-- Sample data
INSERT INTO articles (title, content, author) VALUES
('PostgreSQL Full-Text Search', 'Learn how to implement full-text search in PostgreSQL using tsvector and tsquery.', 'Alice'),
('Building Scalable APIs', 'Best practices for building APIs that scale to millions of users.', 'Bob'),
('Database Indexing Strategies', 'Deep dive into B-Tree, GIN, and GiST indexes for query optimization.', 'Alice');
```

---

## Basic Search

```sql
-- Simple search
SELECT title
FROM articles
WHERE search_vector @@ to_tsquery('postgresql');

-- Multiple words (AND)
SELECT title
FROM articles
WHERE search_vector @@ to_tsquery('postgresql & search');

-- Multiple words (OR)
SELECT title
FROM articles
WHERE search_vector @@ to_tsquery('postgresql | mysql');

-- Phrase search (must be adjacent)
SELECT title
FROM articles
WHERE search_vector @@ phraseto_tsquery('full text search');

-- NOT operator
SELECT title
FROM articles
WHERE search_vector @@ to_tsquery('database & !mysql');
```

---

## Ranked Search

```sql
-- Rank by relevance
SELECT
  title,
  ts_rank(search_vector, query) AS rank
FROM articles, to_tsquery('postgresql') query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Weighted ranking (title more important than content)
SELECT
  title,
  ts_rank_cd(
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', content), 'B'),
    query
  ) AS rank
FROM articles, to_tsquery('database') query
WHERE
  setweight(to_tsvector('english', title), 'A') ||
  setweight(to_tsvector('english', content), 'B') @@ query
ORDER BY rank DESC;
```

---

## Highlighting Results

```sql
-- Highlight matching words
SELECT
  title,
  ts_headline(
    'english',
    content,
    to_tsquery('postgresql'),
    'StartSel=<b>, StopSel=</b>, MaxWords=50'
  ) AS snippet
FROM articles
WHERE search_vector @@ to_tsquery('postgresql');

-- Output:
-- title: PostgreSQL Full-Text Search
-- snippet: Learn how to implement full-text search in <b>PostgreSQL</b> using tsvector...
```

---

## Fuzzy Search (Typo Tolerance)

```sql
-- Install extension
CREATE EXTENSION pg_trgm;

-- Trigram index
CREATE INDEX idx_articles_title_trgm ON articles USING GIN (title gin_trgm_ops);

-- Fuzzy search with similarity
SELECT
  title,
  similarity(title, 'postgrsql') AS sim
FROM articles
WHERE title % 'postgrsql'  -- % operator = similar to
ORDER BY sim DESC;

-- Output: PostgreSQL Full-Text Search (sim: 0.8)
```

---

## Performance Comparison

### Without Index (LIKE)

```sql
EXPLAIN ANALYZE
SELECT * FROM articles WHERE title LIKE '%search%';

-- Seq Scan (cost=0.00..15000.00) (time=450ms)
-- Scans all 1M rows
```

### With GIN Index (Full-Text)

```sql
EXPLAIN ANALYZE
SELECT * FROM articles WHERE search_vector @@ to_tsquery('search');

-- Bitmap Index Scan using idx_articles_search (cost=4.00..120.00) (time=8ms)
-- 56x faster!
```

---

## Real-World Example: Blog Search

```javascript
const { Pool } = require('pg');

const pool = new Pool({/*...*/});

async function searchArticles(query, page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;

  const result = await pool.query(`
    SELECT
      id,
      title,
      author,
      ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank,
      ts_headline(
        'english',
        content,
        websearch_to_tsquery('english', $1),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=50'
      ) AS snippet,
      created_at
    FROM articles
    WHERE search_vector @@ websearch_to_tsquery('english', $1)
    ORDER BY rank DESC, created_at DESC
    LIMIT $2 OFFSET $3
  `, [query, pageSize, offset]);

  return result.rows;
}

// Usage
const results = await searchArticles('postgresql database', 1, 10);
console.log(results);

// Output:
// [
//   {
//     title: 'PostgreSQL Full-Text Search',
//     rank: 0.456,
//     snippet: '...full-text search in <mark>PostgreSQL</mark>...',
//     author: 'Alice'
//   }
// ]
```

---

## Advanced: Multi-Language Search

```sql
-- Detect language and search
CREATE OR REPLACE FUNCTION search_multilang(query_text TEXT)
RETURNS TABLE (
  id INT,
  title TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    ts_rank(
      to_tsvector('simple', a.title || ' ' || a.content),
      plainto_tsquery('simple', query_text)
    ) AS rank
  FROM articles a
  WHERE
    to_tsvector('simple', a.title || ' ' || a.content) @@
    plainto_tsquery('simple', query_text)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## Autocomplete with Trigrams

```sql
-- Fast prefix search
SELECT title
FROM articles
WHERE title ILIKE 'postgre%'
LIMIT 5;

-- With trigram index
CREATE INDEX idx_articles_title_trgm ON articles USING GIN (title gin_trgm_ops);

-- Even faster autocomplete
SELECT
  title,
  similarity(title, 'postgre') AS sim
FROM articles
WHERE title % 'postgre'
ORDER BY sim DESC
LIMIT 5;
```

---

## Key Takeaways

1. **GIN Index is Required**
   - Without it, full-text search is slower than LIKE
   - With it, 50-100x faster

2. **Use websearch_to_tsquery**
   - Handles "quoted phrases", -excluded words
   - User-friendly Google-like syntax

3. **Stemming is Automatic**
   - "running" matches "run"
   - "databases" matches "database"

4. **Ranking Matters**
   - ts_rank for relevance sorting
   - Weight title > content > tags

5. **When to Upgrade to Elasticsearch**
   - > 10M documents
   - Need facets/aggregations
   - Multi-language complexity

---

## Search Features Comparison

| Feature | PostgreSQL FTS | Elasticsearch |
|---------|---------------|---------------|
| **Setup** | Built-in | External service |
| **Scale** | <10M docs | Billions |
| **Speed** | Fast (GIN index) | Faster |
| **Ranking** | Basic | Advanced (BM25) |
| **Facets** | Manual | Built-in |
| **Cost** | Free (same DB) | $$$ (separate cluster) |

---

## Related POCs

- **POC #12: Indexes** - GIN indexes for full-text
- **POC #19: JSONB** - Search JSON fields
- **POC #14: EXPLAIN** - Analyze search performance

---

**Production examples**:
- **Stack Overflow**: PostgreSQL FTS until 50M posts
- **GitLab**: Code search with PostgreSQL
- **Discourse**: Forum search with PostgreSQL

**Remember**: Start with PostgreSQL FTS, migrate to Elasticsearch only when necessary!
