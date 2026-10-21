import test from 'node:test';
import assert from 'node:assert/strict';
import { activeObjectives, objectiveActivityStatus } from '../src/lib/objectiveViews.js';

const now = new Date('2026-10-09T12:00:00Z');
test('manual activity status takes precedence over validity and is counted consistently', () => {
  const active = { id: 1, status: 'Activo', validityStartYear: 2020, validityEndYear: 2021 };
  const inactive = { id: 2, status: 'No activo', validityStartYear: 2026, validityEndYear: 2027 };
  assert.equal(objectiveActivityStatus(active, now), 'Activo');
  assert.equal(objectiveActivityStatus(inactive, now), 'No activo');
  assert.deepEqual(activeObjectives([active, inactive], now).map(item => item.id), [1]);
});
test('existing objective states retain their validity-based activity until changed manually', () => {
  assert.equal(objectiveActivityStatus({ status: 'No iniciado', validityStartYear: 2026, validityEndYear: 2027 }, now), 'Activo');
  assert.equal(objectiveActivityStatus({ status: 'Cumplido', validityStartYear: 2020, validityEndYear: 2021 }, now), 'No activo');
});
