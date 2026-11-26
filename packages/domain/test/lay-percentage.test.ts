import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHenDayProductionRate } from '../src/lay-percentage';

test('hen-day rate uses live hens and includes all produced eggs', () => {
  assert.equal(calculateHenDayProductionRate(80, 100), 80);
  assert.equal(calculateHenDayProductionRate(0, 100), 0);
  assert.equal(calculateHenDayProductionRate(101, 100), 101);
});

test('zero live hens yields an undefined rate rather than infinity or zero', () => {
  assert.equal(calculateHenDayProductionRate(0, 0), null);
  assert.equal(calculateHenDayProductionRate(5, 0), null);
});

test('invalid counts fail before calculation', () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateHenDayProductionRate(value, 100), RangeError);
    assert.throws(() => calculateHenDayProductionRate(10, value), RangeError);
  }
});
