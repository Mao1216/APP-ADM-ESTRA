import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterIndicators } from '../src/lib/indicatorViews.js';
import { portfolioRows } from '../src/lib/indicatorPortfolio.js';

test('GCG status filter uses the latest report, and No reportado includes unreported indicators', () => {
  const indicators = [{ id: 1, name: 'Ventas', status: 'En meta' }, { id: 2, name: 'Producción', status: 'Fuera de meta' }, { id: 3, name: 'Calidad' }];
  const reports = [{ id: 1, indicatorId: 1, period: 'Enero,2026', status: 'En meta', result: 10 }, { id: 2, indicatorId: 1, period: 'Febrero,2026', status: 'Fuera de meta', result: 5 }, { id: 3, indicatorId: 3, period: 'Febrero,2026', status: 'Sin datos', result: null }];
  const rows = portfolioRows(indicators, reports).map(row => ({ ...row.indicator, status: row.status }));
  assert.deepEqual(filterIndicators(rows, { status: 'Fuera de meta' }).map(row => row.id), [1]);
  assert.deepEqual(filterIndicators(rows, { status: 'No reportado' }).map(row => row.id), [2]);
  assert.deepEqual(filterIndicators(rows, { status: 'En meta' }), []);
  assert.deepEqual(filterIndicators(rows, { status: 'Sin datos' }).map(row => row.id), [3]);
});

test('request summaries show creation date only while the detail retains period', () => {
  const source = readFileSync(new URL('../src/ChangeRequestsView.jsx', import.meta.url), 'utf8');
  const flyout = source.split('export function IndicatorRequestFlyout')[1].split('export default function')[0];
  assert.equal(flyout.includes('requestPeriod(request, reports)'), false);
  assert.ok(flyout.includes('formatDate(request.created_at)'));
  assert.ok(source.split('export function IndicatorRequestFlyout')[0].includes('Periodo: {requestPeriod(request, reports)}'));
});

test('reporting navigation and GCG read-only corrective consultation remain centralized', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../src/BioIndicatorsView.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('Reportería'));
  assert.equal(app.includes('Visualizaciones'), false);
  assert.equal(app.includes("navigateTo('out-of-target'"), false);
  assert.equal(app.includes('id="indicator-actions"'), false);
  assert.ok(view.includes('workflow={workflow} users={users} canManage={false}'));
});
