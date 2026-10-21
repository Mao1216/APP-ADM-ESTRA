import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionIndicators, latestMeasurement, taskEditable, validateEvidence } from '../src/lib/correctiveWorkflow.js';

const origin = { id: 1, indicatorId: 1, period: 'Enero,2026', status: 'Fuera de meta', created_at: '2026-01-31' };
const analysis = { status: 'En proceso', approved_at: null };
test('las acciones completadas y anteriormente revisadas siguen siendo editables', () => {
  for (const review_status of ['Borrador', 'En revisión', 'Aprobado']) {
    assert.equal(taskEditable({ progress: 100, review_status }, analysis), true);
  }
  assert.equal(taskEditable({}, null), false);
});
test('alertas usan la última medición y distinguen causas existentes', () => {
  const reports = [origin, { ...origin, id: 2, period: 'Febrero,2026', status: 'En meta' }];
  assert.equal(latestMeasurement(reports, '1').id, 2);
  assert.equal(attentionIndicators([{ id: 1, status: 'Fuera de meta' }], reports, []).length, 0);
  assert.equal(attentionIndicators([{ id: '1' }], [origin], [])[0].label, 'Sin análisis de causa');
  assert.equal(attentionIndicators([{ id: 1 }], [origin], [{ report_id: '1' }])[0].label, 'Con análisis de causa');
});
test('evidencias rechazan archivos vacíos y mayores a 20 MB', () => {
  assert.throws(() => validateEvidence({ size: 0 }));
  assert.throws(() => validateEvidence({ size: 20 * 1024 * 1024 + 1 }));
  assert.equal(validateEvidence({ size: 20 * 1024 * 1024 }).size, 20971520);
});
