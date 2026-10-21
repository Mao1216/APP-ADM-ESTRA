// Prueba local de la app real. Sin credenciales ni escrituras a Supabase.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import AppErrorBoundary from '../src/AppErrorBoundary';
import { supabase } from '../src/lib/supabase';
import '../src/index.css';

const role = new URLSearchParams(window.location.search).get('role') === 'manager' ? 'gerente_responsable' : 'gcg';
const session = { user: { id: 'local-test-only', email: 'demo@example.invalid', user_metadata: { full_name: 'Usuario de prueba' } } };
supabase.auth.getSession = async () => ({ data: { session }, error: null });
supabase.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
supabase.rpc = async () => ({ error: { message: 'No se permiten escrituras en la prueba local.' } });
const objectives = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, code: `OBJ-2600${index + 1}`, name: index ? `Objetivo de prueba ${index + 1}` : 'Incrementar la productividad', description: 'Datos locales para verificar las pantallas.', category: 'Operaciones', owner_email: session.user.email, status: 'No iniciado', progress: 0, created_date: '2026-09-30', target_date: '2027-12-31', created_at: '2026-09-30T19:00:00Z', validity_start_year: 2026, validity_end_year: 2027, stakeholders: [] }));
const indicators = [{ id: 1, code: 'IND-26001', name: 'Productividad', objective_id: 1, target: 90, unit: '%', comparator: '>=', frequency: 'Mensual', formula: 'Producción real / planificada', owner_email: session.user.email, approval_status: 'Aprobado', status: 'En meta', created_at: '2026-09-30T19:00:00Z' }, { id: 2, code: 'IND-26002', name: 'Indicador de prueba', objective_id: 4, target: 90, unit: '%', comparator: '>=', frequency: 'Anual', owner_email: session.user.email, approval_status: 'Aprobado', status: 'Sin reporte', created_at: '2026-09-30T19:00:00Z' }];
const reports = ['Enero,2025', 'Febrero,2025', 'Enero,2026', 'Febrero,2026'].map((period, index) => ({ id: index + 1, indicator_id: 1, period, result: [70, 72, 82, 95][index], status: index === 3 ? 'En meta' : 'Fuera de meta', measurement_target: 90, measurement_comparator: '>=', registered_date: '2026-10-06', created_at: '2026-10-06T12:00:00Z' }));
if (new URLSearchParams(window.location.search).has('ranking')) {
  objectives.forEach((objective, index) => { objective.progress = [31, 82, 54, 68][index]; });
  objectives.push(...[28, 20, 15, 8].map((progress, index) => ({ ...objectives[0], id: index + 5, code: `OBJ-2600${index + 5}`, name: `Objetivo de prueba ${index + 5}`, progress })));
  reports.push({ ...reports[3], id: 5, period: 'Marzo,2026', result: 97 });
}
const tables = { profiles: [{ email: session.user.email, role }], organization_people: [], objectives, indicators, indicator_reports: reports, projects: [{ id: 1, objective_id: 1, name: 'Proyecto de prueba', status: 'En progreso', progress: 30, owner_email: session.user.email }], strategic_actions: [], indicator_change_requests: [] };
if (new URLSearchParams(window.location.search).has('strategic')) {
  tables.strategic_actions = [{ id: 1, objective_id: 1, name: 'Capacitar al equipo en gestión documental', description: 'Tres sesiones prácticas para mejorar la visualización, carga y aprobación de documentos.', owner_email: session.user.email, due_date: '2026-10-31', status: 'En progreso' }, { id: 2, objective_id: 1, name: 'Implementar controles de calidad', description: 'Revisar los procedimientos y establecer controles preventivos.', owner_email: session.user.email, due_date: '2026-11-15', status: 'En progreso' }];
}
if (new URLSearchParams(window.location.search).has('corrective')) {
  indicators[0].status = 'Fuera de meta'; reports[3].result = 70; reports[3].status = 'Fuera de meta';
  tables.cause_analyses = [{ id: 1, code: 'ANC-26001', report_id: 4, cause: 'Calibración incorrecta del equipo.', five_whys: ['La medición perdió precisión.', 'El equipo trabajó fuera de parámetros.', 'No se realizó la revisión programada.', 'La alerta de mantenimiento no fue atendida.', 'Calibración incorrecta del equipo.'], deviation_description: 'El resultado del periodo está fuera de meta.', complementary_data: '', status: 'En proceso', created_at: '2026-10-07T12:00:00Z' }];
  tables.corrective_actions = [{ id: 1, analysis_id: 1, name: 'Recalibrar equipos', description: 'Restablecer los parámetros.', responsible: session.user.email, due_date: '2026-11-30', created_at: '2026-10-07T12:00:00Z' }];
  tables.corrective_tasks = [{ id: 1, action_id: 1, name: 'Calibrar equipo', description: 'Verificar parámetros.', progress: 100, review_status: 'En revisión', notified_at: '2026-10-07T12:00:00Z', created_at: '2026-10-07T12:00:00Z' }];
  tables.corrective_evidence = []; tables.corrective_events = [];
}
supabase.from = table => {
  const query = { select: () => query, eq: () => query, order: async () => ({ data: tables[table] || [], error: null }), maybeSingle: async () => ({ data: { role }, error: null }), insert: () => { throw new Error('La prueba local no permite escrituras.'); }, update: () => { throw new Error('La prueba local no permite escrituras.'); } };
  return query;
};
createRoot(document.getElementById('root')).render(<AppErrorBoundary><App /></AppErrorBoundary>);
