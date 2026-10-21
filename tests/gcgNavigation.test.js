import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('comparisons are restricted to the GCG monitor', () => {
  assert.match(app, /isGcg && <ComparisonCharts/);
});

test('GCG review uses change requests instead of indicator approval', () => {
  assert.match(app, /currentView === 'gcg-review' && isGcg && <ChangeRequests isGcg/);
  assert.doesNotMatch(app, /<GcgReviewView/);
});

test('GCG creates indicators from a valid objective detail', () => {
  const detail = app.slice(app.indexOf('const ObjectiveDetailView'), app.indexOf('const ProjectFormView'));
  const sidebar = app.slice(app.indexOf('<nav className="px-4'), app.indexOf('</nav>', app.indexOf('<nav className="px-4')));
  assert.match(detail, /isGcg && <Button onClick=\{\(\) => navigateTo\('new-indicator', 'Nuevo Indicador', \{ objectiveId: obj\.id, objectiveTab: 'indicators' \}\)/);
  assert.doesNotMatch(sidebar, /navigateTo\('new-indicator'/);
  assert.match(app, /if \(!isGcg \|\| !obj\)/);
  assert.match(app, /objective_id: obj.id/);
  assert.match(app, /if \(view === 'new-indicator' && !params.objectiveId\) setSelectedObjectiveId\(null\)/);
});

test('requests in Visualizations are hidden from GCG', () => {
  assert.match(app, /!isGcg && <button onClick=\{\(\) => navigateTo\('change-requests'/);
});
