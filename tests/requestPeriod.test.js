import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPeriod } from '../src/lib/requestViews.js';

test('request periods use the captured snapshot before the linked report', () => {
  const reports = [{ id: 7, period: 'Octubre,2026' }];
  assert.equal(requestPeriod({ report_id: 7, proposed: { period: 'Septiembre,2026' } }, reports), 'Septiembre,2026');
  assert.equal(requestPeriod({ report_id: 7, previous: { period: 'Agosto,2026' } }, reports), 'Agosto,2026');
  assert.equal(requestPeriod({ report_id: '7', proposed: { result: 21 } }, reports), 'Octubre,2026');
  assert.equal(requestPeriod({ kind: 'target', proposed: { target: 18 } }, reports), '');
  assert.equal(requestPeriod({ report_id: 99 }, reports), '');
});
