import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { validateFrontmatterPaths, checkBidirectionalConsistency } =
  await import('../lint-graph.mjs');

describe('validateFrontmatterPaths', () => {
  test('returns no errors when all paths are valid keys in nodes map', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: { prerequisites: [], see_poc: ['interview-prep/practice-pocs/cache-aside-pattern'], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
      ['interview-prep/practice-pocs/cache-aside-pattern', {
        data: { prerequisites: ['system-design/caching/caching-fundamentals'], see_poc: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
    ]);
    const errors = validateFrontmatterPaths(nodes);
    assert.equal(errors.length, 0);
  });

  test('returns errors for paths that do not exist in nodes map', () => {
    const nodes = new Map([
      ['system-design/caching/caching-fundamentals', {
        data: { prerequisites: [], see_poc: ['interview-prep/practice-pocs/NONEXISTENT'], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
    ]);
    const errors = validateFrontmatterPaths(nodes);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes('NONEXISTENT'));
  });
});

describe('checkBidirectionalConsistency', () => {
  test('detects when linked_from is stale (missing expected entry)', () => {
    const nodes = new Map([
      ['a/b/concept', {
        data: { see_poc: ['a/b/poc'], prerequisites: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
      ['a/b/poc', {
        data: { prerequisites: [], see_poc: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
    ]);
    const warnings = checkBidirectionalConsistency(nodes);
    assert.ok(warnings.length > 0);
    assert.ok(warnings.some(w => w.includes('a/b/poc')));
  });

  test('no warnings when graph is fully synced', () => {
    const nodes = new Map([
      ['a/b/concept', {
        data: { see_poc: ['a/b/poc'], prerequisites: [], solves_with: [], related_problems: [], case_studies: [], linked_from: [] }
      }],
      ['a/b/poc', {
        data: { prerequisites: [], see_poc: [], solves_with: [], related_problems: [], case_studies: [], linked_from: ['a/b/concept'] }
      }],
    ]);
    const warnings = checkBidirectionalConsistency(nodes);
    assert.equal(warnings.length, 0);
  });
});
