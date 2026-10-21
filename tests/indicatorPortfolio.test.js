import test from 'node:test';
import assert from 'node:assert/strict';
import { portfolioRows, portfolioCounts } from '../src/lib/indicatorPortfolio.js';
import { parseReportPeriod } from '../src/lib/reporting.js';

test('portfolio uses the latest report and distinguishes missing reports and no data', () => {
  const indicators = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const reports = [{ id: 1, indicatorId: 1, period: 'Agosto,2026', result: 90, status: 'En meta' }, { id: 2, indicatorId: 1, period: 'Octubre,2026', result: 0, status: 'Fuera de meta' }, { id: 3, indicatorId: 2, period: 'Octubre,2026', result: null, status: 'Sin datos' }];
  const rows = portfolioRows(indicators, reports);
  assert.equal(rows[0].latest.result, 0);
  assert.equal(rows[1].status, 'Sin datos');
  assert.deepEqual(portfolioCounts(rows), { total: 3, inTarget: 0, outOfTarget: 1, noData: 1, unreported: 1 });
  const august = portfolioRows(indicators, reports, String(parseReportPeriod('Agosto,2026').order));
  assert.equal(august[0].status, 'En meta');
  assert.equal(august[0].history.length, 1);
  assert.equal(august[1].status, 'Sin reporte');
  assert.equal(reports.length, 3);
});
