import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedIndicatorSummary } from '../src/lib/indicatorViews.js';

const reports = [{ period: 'Diciembre,2025', result: 100 }, { period: 'Enero,2026', result: 3 }, { period: 'Febrero,2026', result: 5 }, { period: 'Marzo,2026', result: null, status: 'Sin datos' }];
test('weighted card defaults to latest year, excludes Sin datos, and shows count and target status', () => {
  const summary = weightedIndicatorSummary({ target: 4, comparator: '<=' }, reports);
  assert.equal(summary.year, '2026');
  assert.equal(summary.value, 4);
  assert.equal(summary.count, 2);
  assert.equal(summary.status, 'En meta');
  assert.equal(weightedIndicatorSummary({ target: 4, comparator: '<=' }, reports, '2025').status, 'Fuera de meta');
});
test('weighted card respects all target comparators at equality', () => {
  for (const comparator of ['<', '>', '<=', '>=', '=']) {
    assert.equal(weightedIndicatorSummary({ target: 4, comparator }, reports, '2026').status, ['<=', '>=', '='].includes(comparator) ? 'En meta' : 'Fuera de meta');
  }
});
test('weighted card does not classify missing values or borrow measurements from another year', () => {
  for (const rows of [[], [{ period: 'Enero,2026', result: null, status: 'Sin datos' }]]) {
    const summary = weightedIndicatorSummary({ target: 4, comparator: '<=' }, rows, '2026');
    assert.equal(summary.display, '—'); assert.equal(summary.status, null); assert.equal(summary.count, 0);
  }
  assert.equal(weightedIndicatorSummary({ target: 4, comparator: '<=' }, reports, '2027').value, null);
});
