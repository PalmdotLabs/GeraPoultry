import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countCollectedEggs,
  recordEggCollectionRequestSchema,
} from '../src/index.ts';

const fixture = {
  collectionDate: '2026-11-26',
  shedId: 'dcb5386d-ce4c-4d25-9a1a-232941837cd7',
  gradeId: '8b20119c-0d03-4bfc-90f9-a9d4b1f35cf5',
  shift: '  Morning  ',
  good: { trays: 2, looseEggs: 5 },
  cracked: { trays: 0, looseEggs: 2 },
  dirty: { trays: 0, looseEggs: 3 },
  submissionId: '9bf77159-c12a-44cc-8787-956b9d41db30',
};

test('egg collection counts each tray as 30 eggs and allows shed-only entries', () => {
  const input = recordEggCollectionRequestSchema.parse(fixture);
  assert.equal(input.shift, 'Morning');
  assert.equal(input.flockId, undefined);
  assert.deepEqual(
    [input.good, input.cracked, input.dirty].map(countCollectedEggs),
    [65, 2, 3],
  );
});

test('egg collection rejects invalid counts and per-category storage overflow', () => {
  for (const good of [
    { trays: -1, looseEggs: 0 },
    { trays: 0.5, looseEggs: 0 },
    { trays: 1, looseEggs: 2_147_483_647 },
  ]) {
    assert.equal(
      recordEggCollectionRequestSchema.safeParse({ ...fixture, good }).success,
      false,
    );
  }
});
