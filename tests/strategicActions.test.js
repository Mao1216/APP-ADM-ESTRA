import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
test('action status is persisted and controls prevent duplicate saves and expose failures', () => {
  const cards = readFileSync(new URL('../src/StrategicActions.jsx', import.meta.url), 'utf8');
  assert.ok(cards.includes("['Cerrado', 'En progreso']"));
  assert.ok(cards.includes('busyId != null'));
  assert.ok(cards.includes('await onStatusChange(action, status)'));
  assert.ok(cards.includes('role="alert"'));
  assert.ok(app.includes("update({ status, updated_at: new Date().toISOString() }).eq('id', action.id)"));
});
test('action deletion requires confirmation and targets only the selected record', () => {
  const cards = readFileSync(new URL('../src/StrategicActions.jsx', import.meta.url), 'utf8');
  assert.ok(cards.includes('aria-label="Eliminar acción estratégica"'));
  assert.ok(cards.includes('await onDelete(pendingDelete)'));
  assert.ok(cards.includes('!canEdit || busyId != null || !pendingDelete || !onDelete'));
  assert.ok(app.includes(".delete().eq('id', action.id).select('id').single()"));
  assert.ok(app.includes('items.filter(item => item.id !== action.id)'));
});

test('solo las acciones en progreso se muestran fuera del historial', () => {
  const cards = readFileSync(new URL('../src/StrategicActions.jsx', import.meta.url), 'utf8');
  assert.ok(cards.includes("const inProgressActions = actions.filter(isInProgress)"));
  assert.ok(cards.includes('inProgressActions.map'));
  assert.ok(cards.includes('Historial de acciones estratégicas'));
  assert.ok(cards.includes('Fecha de término de la actividad'));
});
test('GCG can open objective projects, create actions, edit actions and link projects', () => {
  assert.ok(app.includes("label: 'Proyectos', icon: FolderKanban, visible: isResponsibleManager || isGcg"));
  assert.ok(app.includes("navigateTo('link-project', 'Vincular proyecto'"));
  assert.ok(app.includes('canEdit={isResponsibleManager || isGcg}'));
  assert.ok(app.includes("['new-project', 'edit-action', 'link-project'].includes(view) && !isResponsibleManager && !isGcg"));
  assert.ok(app.includes("supabase.from('projects').insert({ objective_id: objective.id"));
  assert.ok(app.includes("objectiveTab: 'projects'"));
});
test('personal indicator status name is consistent in navigation and heading', () => {
  const portfolio = readFileSync(new URL('../src/IndicatorPortfolio.jsx', import.meta.url), 'utf8');
  assert.equal(app.includes('Estatus IND'), false);
  assert.equal(portfolio.includes('Estatus IND'), false);
  assert.ok(app.includes('Mis indicadores'));
  assert.ok(portfolio.includes('Mis indicadores'));
});
test('Aurio is registered in directory and role assignment, preserving existing authentication', () => {
  const migration = readFileSync(new URL('../supabase/migrations/016_aurio_responsible_manager.sql', import.meta.url), 'utf8');
  assert.ok(migration.includes('Aurio de la Cruz'));
  assert.ok(migration.includes("('adelacruz@biomont.com.pe', 'gerente_responsable')"));
  assert.ok(migration.includes('update public.profiles'));
  assert.ok(migration.includes('insert into public.organization_people'));
  assert.equal(migration.includes('insert into auth.users'), false);
});
