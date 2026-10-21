import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReportPeriod, comparisonData } from '../src/lib/reporting.js';

const reports = [
  { indicatorId: 1, period: 'Enero,2026', result: 12 },
  { indicatorId: 2, period: 'Enero,2026', result: 900 },
  { indicatorId: 1, period: 'Diciembre,2025', result: 10 },
  { indicatorId: 1, period: 'Enero,2025', result: 8 },
];
test('interpreta meses históricos con coma, espacios y setiembre', () => {
  assert.deepEqual(parseReportPeriod(' Setiembre, 2026 '), parseReportPeriod('Septiembre 2026'));
  assert.equal(parseReportPeriod('2026-01'), null);
  assert.equal(parseReportPeriod(undefined), null);
});
test('compara años sin mezclar indicadores ni alterar datos', () => {
  const original = structuredClone(reports);
  assert.deepEqual(comparisonData(reports, { indicatorId: '1', month: 'enero' }).map(r => r.resultado), [8, 12]);
  assert.deepEqual(reports, original);
});
test('cada gráfica tiene filtros independientes de año y mes', () => {
  assert.deepEqual(comparisonData(reports, { indicatorId: '1', year: '2025', month: 'enero' }).map(r => r.resultado), [8]);
  assert.deepEqual(comparisonData(reports, { indicatorId: '1', year: '2026', month: 'enero' }).map(r => r.resultado), [12]);
  assert.deepEqual(comparisonData(reports, { indicatorId: '1', year: '2024' }), []);
});
