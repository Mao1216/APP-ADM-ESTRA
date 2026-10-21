import { displayUnit } from './lib/units';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList } from 'lucide-react';
import { supabase } from './lib/supabase';
import { sameId, taskEditable } from './lib/correctiveWorkflow';
import { UnifiedActions } from './UnifiedActions';
import { parseReportPeriod } from './lib/reporting';
import { personName, fiveWhyAnswers } from './lib/personNames';

const panel = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4';
const field = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900';
const primary = 'rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
const secondary = 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50';
const occurrenceDate = period => { const parsed=parseReportPeriod(period); return parsed ? `${parsed.year}-${String(['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].indexOf(parsed.month)+1).padStart(2,'0')}-01` : ''; };
async function rpc(name, params) { const { data, error } = await supabase.rpc(name, params); if (error) throw error; return data; }
function useOperation(onReload) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async operation => {
    setBusy(true); setError('');
    try { await operation(); await onReload(); return true; }
    catch (failure) { await onReload(); setError(failure.message || 'No se pudo guardar. Reintenta.'); return false; }
    finally { setBusy(false); }
  };
  return { busy, run, error };
}
function ErrorMessage({ message }) { return message ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p> : null; }
function Modal({ title, children, onClose }) {
  return createPortal(<div className="fixed inset-0 z-[120] bg-slate-950/50 p-3 sm:p-8 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={title}><div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"><header className="bg-slate-600 text-white px-5 py-3 flex items-center justify-between"><h2 className="text-lg font-medium">{title}</h2><button aria-label="Cerrar" className="text-2xl leading-none" onClick={onClose}>×</button></header><div className="overflow-y-auto p-5">{children}</div></div></div>, document.body);
}
const whyLevels = [
  ['Causa superficial', 'bg-rose-500'],
  ['Causa superficial', 'bg-rose-500'],
  ['Causa profunda', 'bg-orange-400'],
  ['Causa más profunda', 'bg-amber-400'],
  ['Causa raíz', 'bg-emerald-400'],
];
function FiveWhysModal({ report, analysis, workflow, canManage, onClose, onContinue }) {
  const initial = Array.from({ length: 5 }, (_, index) => analysis?.five_whys?.[index] || '');
  const [answers, setAnswers] = useState(initial);
  const operation = useOperation(workflow.reload);
  const editable = canManage && (!analysis || taskEditable({ review_status: 'Borrador' }, analysis));
  const complete = Boolean(fiveWhyAnswers(answers));
  const save = async event => {
    event.preventDefault();
    if (!editable) { onContinue(); return; }
    if (!complete) return;
    if (await operation.run(() => rpc('save_five_whys', { measurement: report.id, answers: fiveWhyAnswers(answers) }))) onContinue();
  };
  return <Modal title="Registro de análisis de causas" onClose={onClose}><form onSubmit={save} className="space-y-1">
    {whyLevels.map(([level, color], index) => <React.Fragment key={level + index}>
      <label className="block text-sm font-medium text-slate-800">{index + 1}. ¿Por qué ocurrió esto? → {level} <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full align-middle ${color}`}><span className="sr-only">{level}</span></span>
        <textarea aria-label={`Por qué ${index + 1}: ${level}`} rows={3} required={editable && index < 2} readOnly={!editable} className={`${field} mt-2 resize-y bg-slate-50`} value={answers[index]} onChange={event => setAnswers(current => current.map((answer, position) => position === index ? event.target.value : answer))} />
      </label>
      {index < whyLevels.length - 1 && <div aria-hidden="true" className="h-7 text-center text-4xl font-light leading-7 text-slate-400">↑</div>}
    </React.Fragment>)}
    <ErrorMessage message={operation.error} />
    <footer className="flex justify-end gap-3 border-t pt-4 mt-5"><button type="button" className={secondary} onClick={onClose}>Cerrar</button>{editable ? <button className={primary} disabled={operation.busy || !complete}>Guardar y continuar</button> : <button type="button" className={primary} onClick={onContinue}>Continuar</button>}</footer>
  </form></Modal>;
}
function AnalysisModal({ report, analysis, indicator, objective, workflow, users, canManage, onClose }) {
  const [tab,setTab]=useState('initial'); const [cause,setCause]=useState(analysis?.cause||''); const [deviation,setDeviation]=useState(analysis?.deviation_description||report.obs||`El resultado ${report.result} ${displayUnit(indicator.unit)} del periodo ${report.period} se encuentra fuera de la meta ${indicator.comparator} ${indicator.target} ${displayUnit(indicator.unit)}.`); const [complementary,setComplementary]=useState(analysis?.complementary_data||''); const operation=useOperation(workflow.reload);
  const editable=canManage && (!analysis || taskEditable({review_status:'Borrador'},analysis));
  const save=async event=>{event.preventDefault();if(await operation.run(()=>rpc('save_cause_analysis_details',{measurement:report.id,cause_text:cause,deviation_text:deviation,complementary_text:complementary}))) onClose();};
  const tabs=[['initial','Datos Iniciales'],['details','Detalles del análisis'],['complementary','Datos complementarios']];
  return <Modal title={analysis?.code ? `Análisis de causa ${analysis.code}` : 'Nuevo análisis de causa'} onClose={onClose}><form onSubmit={save} className="space-y-5"><nav className="flex flex-wrap gap-2 border-b pb-3">{tabs.map(([id,label])=><button type="button" key={id} onClick={()=>setTab(id)} className={`px-4 py-2 rounded-lg border text-sm ${tab===id?'bg-slate-700 text-white':'bg-white text-slate-700'}`}>{label}</button>)}</nav>{tab==='initial'&&<div className="space-y-5"><h3 className="rounded-lg bg-blue-50 px-4 py-2 font-semibold text-slate-700">Datos de contexto</h3><label className="block text-sm">Nombre del análisis<input className={`${field} mt-1 bg-slate-50`} readOnly value={`${indicator.code} · ${indicator.name} · ${report.period}`} /></label><div className="grid sm:grid-cols-2 gap-4"><label className="block text-sm">Responsable del proceso<input className={`${field} mt-1 bg-slate-50`} readOnly value={personName(objective?.ownerId || indicator.ownerId, users)} /></label><label className="block text-sm">Periodo<input className={`${field} mt-1 bg-slate-50`} readOnly value={report.period} /></label></div><h3 className="rounded-lg bg-blue-50 px-4 py-2 font-semibold text-slate-700">Relaciones</h3><div className="grid sm:grid-cols-2 gap-4"><label className="block text-sm">Objetivo relacionado<input className={`${field} mt-1 bg-slate-50`} readOnly value={`${objective?.code||''} · ${objective?.name||'Sin objetivo'}`} /></label><label className="block text-sm">Indicador relacionado<input className={`${field} mt-1 bg-slate-50`} readOnly value={`${indicator.code||''} · ${indicator.name}`} /></label></div></div>}{tab==='details'&&<div className="grid sm:grid-cols-2 gap-5"><label className="block text-sm">Fecha de ocurrencia<input type="date" className={`${field} mt-1 bg-slate-50`} readOnly value={occurrenceDate(report.period)} /></label><div></div><label className="block text-sm sm:col-span-2">Descripción de la desviación<textarea rows={6} className={`${field} mt-1`} required readOnly={!editable} value={deviation} onChange={e=>setDeviation(e.target.value)} /></label><label className="block text-sm sm:col-span-2">Análisis de causa<textarea aria-label="Análisis de causa" rows={6} className={`${field} mt-1`} required readOnly={!editable} value={cause} onChange={e=>setCause(e.target.value)} /></label></div>}{tab==='complementary'&&<label className="block text-sm">Datos complementarios<textarea rows={10} className={`${field} mt-1`} readOnly={!editable} placeholder="Ingresa información complementaria del análisis" value={complementary} onChange={e=>setComplementary(e.target.value)} /></label>}<ErrorMessage message={operation.error}/><footer className="flex justify-end gap-3 border-t pt-4"><button type="button" className={secondary} onClick={onClose}>Cerrar</button>{editable&&<button className={primary} disabled={operation.busy||!cause.trim()||!deviation.trim()}>Guardar</button>}</footer></form></Modal>;
}
function ActionsModal({ analysis, workflow, users=[], canManage, onClose }) { return <Modal title={"Acciones correctivas · " + analysis.code} onClose={onClose}><UnifiedActions {...{analysis,workflow,users,canManage}} /></Modal>; }
export function AnalysisHistoryButton({ report, indicator, objective, workflow, users = [], canManage }) {
  const [step,setStep]=useState(null);const analysis=workflow.analyses.find(item=>sameId(item.report_id,report.id));
  if(report.status!=='Fuera de meta') return null;
  if(!analysis&&!canManage) return <span className="text-slate-400">Sin análisis</span>;
  return <><button className="text-blue-700 underline font-medium" onClick={()=>setStep('whys')}>Análisis de causa</button>{step==='whys'&&<FiveWhysModal {...{report,analysis,workflow,canManage}} onClose={()=>setStep(null)} onContinue={()=>setStep('details')}/>} {step==='details'&&<AnalysisModal {...{report,analysis,indicator,objective,workflow,users,canManage}} onClose={()=>setStep(null)}/>}</>;
}
export function ActionsHistoryButton({ report, workflow, users, canManage }) {
  const [open,setOpen]=useState(false);const analysis=workflow.analyses.find(item=>sameId(item.report_id,report.id));
  if(!analysis) return <span className="text-slate-400">—</span>;
  const actionIds=workflow.actions.filter(item=>sameId(item.analysis_id,analysis.id)).map(item=>item.id);
  const actionCount=workflow.tasks.filter(item=>actionIds.some(id=>sameId(id,item.action_id))).length;
  return <><button aria-label={`Acciones: ${actionCount}`} className="inline-flex flex-col items-center gap-0.5 text-slate-600 hover:text-blue-700" onClick={()=>setOpen(true)}><span className="relative"><ClipboardList className="h-6 w-6" aria-hidden="true"/><span className="absolute -right-3 -top-2 rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{actionCount}</span></span><span className="text-xs font-medium">Acciones</span></button>{open&&<ActionsModal {...{analysis,workflow,users,canManage}} onClose={()=>setOpen(false)}/>}</>;
}
