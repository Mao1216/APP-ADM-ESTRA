import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeObjectives, rankedObjectives } from '../src/lib/objectiveViews.js';
import { comparisonLines } from '../src/lib/comparisonLines.js';

test('objectives in their validity period are active regardless of obsolete stored status', () => {
  const objectives = Array.from({ length: 4 }, (_, id) => ({ id, status: 'No iniciado', validityStartYear: 2026, validityEndYear: 2027 }));
  assert.equal(activeObjectives(objectives, new Date('2026-10-06T12:00:00Z')).length, 4);
  assert.equal(activeObjectives(objectives, new Date('2028-01-01T12:00:00Z')).length, 0);
  assert.equal(activeObjectives([{ validityStartYear: 2027, validityEndYear: 2028 }], new Date('2026-10-06T12:00:00Z')).length, 0);
});

test('the same months from two years align with independent filters and retain original periods', () => {
  const reports = [{ id: 1, indicatorId: 1, period: 'Enero,2025', result: 70 }, { id: 2, indicatorId: 1, period: 'Enero,2026', result: 95 }, { id: 3, indicatorId: 2, period: 'Enero,2026', result: 1000 }];
  const rows = comparisonLines(reports, { indicatorId: '1', year: '2025' }, { indicatorId: '1', year: '2026' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].period, 'Enero');
  assert.equal(rows[0].a, 70);
  assert.equal(rows[0].b, 95);
  assert.equal(rows[0].aPeriod, 'Enero 2025');
  assert.equal(rows[0].bPeriod, 'Enero 2026');
});

test('missing measurements remain null; zero results are preserved; repeated periods use the latest report', () => {
  const reports = [{ id: 2, indicatorId: 1, period: 'Enero,2026', result: 0 }, { id: 1, indicatorId: 1, period: 'Enero,2026', result: 88 }, { id: 3, indicatorId: 2, period: 'Febrero,2026', result: 55 }];
  const rows = comparisonLines(reports, { indicatorId: '1', year: '2026', month: 'enero' }, { indicatorId: '2', year: '2026', month: 'febrero' });
  assert.deepEqual(rows.map(row => [row.a, row.b]), [[0, null], [null, 55]]);
  assert.equal(comparisonLines(reports, { indicatorId: '' }, { indicatorId: '' }).length, 0);
});

test('without two specific years the comparison preserves chronological dates', () => {
  const rows = comparisonLines([{ indicatorId: 1, period: 'Enero,2026', result: 2 }, { indicatorId: 1, period: 'Diciembre,2025', result: 1 }], { indicatorId: '1' }, { indicatorId: '1', year: '2026' });
  assert.deepEqual(rows.map(row => row.period), ['Diciembre 2025', 'Enero 2026']);
});

test('GCG navigation hides breadcrumb links and the duplicate objective shortcut, while preserving edited texts', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const headerStart = source.indexOf('<header className="h-14');
  const header = source.slice(headerStart, source.indexOf('</header>', headerStart));
  assert.match(header, /onClick=\{goBack\}/);
  assert.doesNotMatch(header, /navHistory.map/);
  const sidebarStart = source.indexOf('<nav className="px-3');
  const sidebar = source.slice(sidebarStart, source.indexOf('</nav>', sidebarStart));
  assert.doesNotMatch(sidebar, /navigateTo\('new-objective'/);
  assert.doesNotMatch(source, /<Badge status=\{obj.status\}/);
  assert.match(source, /indicadores con medición/);
  assert.match(source, /Proyectos PMO/);
  assert.match(source, /\{\(isResponsibleManager \|\| isGcg\) \? <>/);
  assert.match(source, /<ObjectiveProgressList objectives=\{scopedObjectives\}/);
  const progressList = readFileSync(new URL('../src/ObjectiveProgressList.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(progressList, /title=\{objective.name\}|role="tooltip"|cursor-help/);
  assert.match(progressList, /<h3[^>]*>\{objective.name\}<\/h3>/);
  assert.match(progressList, /h-80 overflow-y-auto/);
  assert.match(progressList, /grid-cols-\[6rem_minmax\(0,1fr\)_3rem\]/);
  assert.match(progressList, /border-b border-slate-100 py-4/);
});

test('objectives sort by progress without changing the original list, retaining all rows', () => {
  const objectives = [8, 54, 31, 82, 15, 68, 20, 28].map((progress, id) => ({ id, progress, name: `Objective ${id}` }));
  assert.deepEqual(rankedObjectives(objectives).map(row => row.progress), [82, 68, 54, 31, 28, 20, 15, 8]);
  assert.deepEqual(objectives.map(row => row.progress), [8, 54, 31, 82, 15, 68, 20, 28]);
  assert.deepEqual(rankedObjectives([{ progress: null }, { progress: '10' }, { progress: 'invalid' }]).map(row => row.progress), [10, 0, 0]);
  assert.deepEqual(rankedObjectives([]), []);
});

test('multi-month filters are independent, preserve chronology and exclude unselected months', () => {
  const reports = ['Marzo,2026', 'Enero,2026', 'Febrero,2026'].map((period, id) => ({ id, indicatorId: 1, period, result: id + 10 }));
  const rows = comparisonLines(reports, { indicatorId: '1', year: '2026', months: ['enero', 'marzo'] }, { indicatorId: '1', year: '2026', months: ['febrero', 'marzo'] });
  assert.deepEqual(rows.map(row => [row.period, row.a, row.b]), [['Enero', 11, null], ['Febrero', null, 12], ['Marzo', 10, 10]]);
  assert.deepEqual(comparisonLines(reports, { indicatorId: '1', months: [] }, { indicatorId: '1', months: [] }), []);
  assert.equal(comparisonLines(reports, { indicatorId: '1', months: ['enero','febrero','marzo'] }, { indicatorId: '' }).length, 3);
});
