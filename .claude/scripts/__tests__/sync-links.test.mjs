import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

const { buildAdjacencyMap, computeLinkedFrom, updateLinkedFrom } =
  await import('../sync-links.mjs');

describe('buildAdjacencyMap', () => {
  test('extracts all forward edges from frontmatter', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: {
          prerequisites: [],
          see_poc: ['interview-prep/practice-pocs/cache-aside-pattern'],
          solves_with: [],
          related_problems: [],
          case_studies: [],
        }
      }],
      ['problems-at-scale/availability/thundering-herd', {
        data: {
          prerequisites: ['system-design/caching/caching-fundamentals'],
          solves_with: ['interview-prep/practice-pocs/cache-aside-pattern'],
          related_problems: [],
          case_studies: [],
          see_poc: [],
        }
      }],
    ]);

    const adj = buildAdjacencyMap(nodes);

    assert.deepEqual(
      adj.get('interview-prep/practice-pocs/cache-aside-pattern'),
      new Set([
        'system-design/caching/caching-fundamentals',
        'problems-at-scale/availability/thundering-herd',
      ])
    );
    assert.deepEqual(
      adj.get('system-design/caching/caching-fundamentals'),
      new Set(['problems-at-scale/availability/thundering-herd'])
    );
  });

  test('returns empty map for nodes with no edges', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: { prerequisites: [], see_poc: [], solves_with: [], related_problems: [], case_studies: [] }
      }]
    ]);
    const adj = buildAdjacencyMap(nodes);
    assert.equal(adj.size, 0);
  });
});

describe('computeLinkedFrom', () => {
  test('returns sorted array of files that reference a given key', () => {
    const adj = new Map([
      ['system-design/caching/caching-fundamentals', new Set([
        'problems-at-scale/availability/thundering-herd',
        'interview-prep/system-design/caching-strategies',
      ])]
    ]);
    const result = computeLinkedFrom('system-design/caching/caching-fundamentals', adj);
    assert.deepEqual(result, [
      'interview-prep/system-design/caching-strategies',
      'problems-at-scale/availability/thundering-herd',
    ]);
  });

  test('returns empty array when no files reference this key', () => {
    const adj = new Map();
    const result = computeLinkedFrom('system-design/caching/caching-fundamentals', adj);
    assert.deepEqual(result, []);
  });
});

describe('updateLinkedFrom', () => {
  test('returns true and new content when linked_from changes', () => {
    const content = readFileSync(join(FIXTURES, 'concept-article.md'), 'utf8');
    const incoming = ['problems-at-scale/availability/thundering-herd'];
    const { changed, newContent } = updateLinkedFrom(content, incoming);
    assert.equal(changed, true);
    const parsed = matter(newContent);
    assert.deepEqual(parsed.data.linked_from, incoming);
  });

  test('returns false when linked_from is already correct', () => {
    const raw = readFileSync(join(FIXTURES, 'problem-article.md'), 'utf8');
    const { changed } = updateLinkedFrom(raw, []);
    assert.equal(changed, false);
  });

  test('preserves all other frontmatter fields', () => {
    const content = readFileSync(join(FIXTURES, 'concept-article.md'), 'utf8');
    const { newContent } = updateLinkedFrom(content, ['some/other/file']);
    const parsed = matter(newContent);
    assert.equal(parsed.data.title, 'Caching Fundamentals');
    assert.equal(parsed.data.layer, 'concept');
    assert.deepEqual(parsed.data.see_poc, ['interview-prep/practice-pocs/cache-aside-pattern']);
  });
});
