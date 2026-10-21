// Simulación local: nunca consulta ni escribe en Supabase real.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IndicatorCorrectiveWorkflow, VerificationsView } from '../src/CorrectiveWorkflow';
import { supabase } from '../src/lib/supabase';
import '../src/index.css';

const params = new URLSearchParams(window.location.search);
const gcg = params.get('role') === 'gcg';
const efficacy = params.has('efficacy');
const indicators = [{ id: 1, objectiveId: 1, code: 'IND-26001', name: 'Productividad', unit: '%' }];
const objectives = [{ id: 1, code: 'OBJ-26001', name: 'Incrementar la productividad' }];
const reports = [{ id: 1, indicatorId: 1, period: 'Enero,2026', result: 60, status: 'Fuera de meta' }, { id: 2, indicatorId: 1, period: 'Febrero,2026', result: 70, status: 'Fuera de meta' }];
const data = {
  analyses: [{ id: 1, code: 'ANC-26001', report_id: 1, cause: 'Calibración incorrecta del equipo.', five_whys: ['La medición perdió precisión.', 'El equipo trabajó fuera de parámetros.', 'No se realizó la revisión programada.', 'La alerta de mantenimiento no fue atendida.', 'Calibración incorrecta del equipo.'], deviation_description: 'Resultado fuera de meta.', complementary_data: '', status: efficacy ? 'Pendiente de verificación' : 'En proceso', approved_at: efficacy ? '2026-02-01' : null, followup_report_id: efficacy ? 2 : null }],
  actions: [{ id: 1, analysis_id: 1, name: 'Recalibrar los equipos', description: 'Restablecer los parámetros y capacitar al personal.' }],
  tasks: [{ id: 1, action_id: 1, name: 'Calibración del equipo', description: 'Verificar los parámetros con el patrón certificado.', progress: 100, review_status: gcg ? 'En revisión' : 'Borrador', notified_at: '2026-10-07' }, { id: 2, action_id: 1, name: 'Capacitación del personal', description: 'Capacitar a los operadores en el procedimiento.', progress: 30, review_status: 'Borrador' }],
  evidence: [], events: []
};
if (efficacy) { data.analyses.push({ id: 2, report_id: 2, cause: 'Falta de materia prima, una causa diferente.', status: 'En proceso' }); data.tasks.forEach(task => { task.progress = 100; task.review_status = 'Aprobado'; }); }
const storedFiles = new Map();
supabase.storage.from = () => ({ upload: async (path,file) => { storedFiles.set(path,file); return { error: null }; }, remove: async paths => { paths.forEach(path => storedFiles.delete(path)); return { error: null }; }, download: async path => ({ data: storedFiles.get(path), error: null }) });
let nextId = 10;
supabase.rpc = async (name, args) => {
  const task = data.tasks.find(item => item.id === args.task);
  let result = null;
  if (name === 'register_corrective_evidence') data.evidence.push({ id: nextId++, task_id: args.task, storage_path: args.path, file_name: args.original_name, file_size: args.bytes });
  if (name === 'notify_corrective_task') { if (task.progress !== 100) return { error: { message: 'Falta 100%' } }; task.review_status = 'En revisión'; }
  if (name === 'review_corrective_task') { task.review_status = args.approve ? 'Aprobado' : 'Observado'; task.review_note = args.review_comment; }
  if (name === 'save_corrective_task') { const values = { name: args.task_name, description: args.task_description, progress: args.task_progress }; if (task) Object.assign(task, values); else { result = nextId++; data.tasks.push({ id: result, action_id: args.action, review_status: 'Borrador', ...values }); } }
  if (name === 'save_cause_analysis') { result = nextId++; data.analyses.push({ id: result, report_id: args.measurement, cause: args.cause_text, status: 'En proceso' }); }
  if (name === 'save_five_whys') {
    const reportAnalysis = data.analyses.find(item => item.report_id === args.measurement);
    if (reportAnalysis) Object.assign(reportAnalysis, { five_whys: args.answers, cause: args.answers[4] });
    else { result = nextId++; data.analyses.push({ id: result, code: 'ANC-26002', report_id: args.measurement, five_whys: args.answers, cause: args.answers[4], status: 'En proceso' }); }
  }
  if (name === 'save_cause_analysis_details') Object.assign(data.analyses.find(item => item.report_id === args.measurement), { cause: args.cause_text, deviation_description: args.deviation_text, complementary_data: args.complementary_text });
  if (name === 'add_corrective_action') { result = nextId++; data.actions.push({ id: result, analysis_id: args.analysis, name: args.action_name, description: args.action_description }); }
  if (name === 'update_corrective_action') Object.assign(data.actions.find(item => item.id === args.action), { name: args.action_name, description: args.action_description });
  if (name === 'decide_cause_efficacy') data.analyses.find(item => item.id === args.analysis).status = args.same_cause ? 'No eficaz' : 'Eficaz';
  return { data: result, error: null };
};
function Preview() {
  const [, render] = useState(0);
  const workflow = { ...structuredClone(data), loading: false, error: '', reload: async () => render(value => value + 1) };
  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8"><div className="max-w-5xl mx-auto space-y-6"><p className="text-xs text-slate-500">Prueba local · {gcg ? 'GCG' : 'Gerente responsable'} · Datos simulados</p>{gcg ? <VerificationsView {...{ workflow, indicators, objectives, reports }} /> : <IndicatorCorrectiveWorkflow indicator={indicators[0]} {...{ reports, workflow }} canManage />}</div></main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
