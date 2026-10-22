import assert from 'node:assert/strict';
import test from 'node:test';
import { addDaysToDateString, isOverdue } from '../lib/date';

test('civil date arithmetic crosses month, year and leap-day boundaries', () => {
  assert.equal(addDaysToDateString('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysToDateString('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysToDateString('2024-02-28', 1), '2024-02-29');
  assert.equal(addDaysToDateString('2024-02-29', 1), '2024-03-01');
});

test('overdue comparisons use civil date ordering', () => {
  assert.equal(isOverdue('2026-10-20', '2026-10-21'), true);
  assert.equal(isOverdue('2026-10-21', '2026-10-21'), false);
  assert.equal(isOverdue('2026-10-22', '2026-10-21'), false);
});
