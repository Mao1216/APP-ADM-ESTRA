import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('objetivos guardan un foco estratégico y los indicadores ya no piden recursos', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/017_objective_focus.sql', import.meta.url), 'utf8');
  assert.ok(app.includes('Foco estratégico *'));
  assert.ok(app.includes('focus: formData.focus'));
  assert.equal(app.includes('label="Recursos"'), false);
  assert.equal(app.includes('resource: formData.resource'), false);
  assert.ok(migration.includes("'Financiero', 'Cliente', 'Procesos', 'Personas/Aprendizaje'"));
});
