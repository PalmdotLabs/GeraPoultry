import assert from 'node:assert/strict';
import test from 'node:test';
import { createFlockRequestSchema } from '../src/index.ts';

const shedA = 'dcb5386d-ce4c-4d25-9a1a-232941837cd7';
const shedB = '8b20119c-0d03-4bfc-90f9-a9d4b1f35cf5';
const arrival = {
  batchCode: '  NOV-01  ',
  breedId: 'b2aa634d-15a8-408b-a442-a09d80b8ed2e',
  arrivalDate: '2026-11-26',
  ageAtArrival: 0,
  ageUnit: 'days',
  birdsHoused: 100,
  placements: [
    { shedId: shedA, birdCount: 30 },
    { shedId: shedB, birdCount: 70 },
  ],
  submissionId: '9bf77159-c12a-44cc-8787-956b9d41db30',
};

test('flock arrival preserves an explicit age and accepts a balanced split', () => {
  assert.deepEqual(createFlockRequestSchema.parse(arrival), {
    ...arrival,
    batchCode: 'NOV-01',
  });
});

test('flock arrival rejects incomplete allocations and equivalent shed IDs', () => {
  for (const placements of [
    [{ shedId: shedA, birdCount: 99 }],
    [
      { shedId: shedA, birdCount: 30 },
      { shedId: shedA.toUpperCase(), birdCount: 70 },
    ],
    [{ shedId: shedA, birdCount: -1 }],
  ]) {
    const result = createFlockRequestSchema.safeParse({
      ...arrival,
      placements,
    });
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.every((issue) => issue.path[0] === 'placements'),
    );
  }
});
