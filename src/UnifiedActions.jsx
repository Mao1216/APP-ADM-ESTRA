import { displayUnit } from './lib/units';
import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { sameId, validateEvidence, attentionIndicators } from './lib/correctiveWorkflow';
import { personName } from './lib/personNames';

const input = 'w-full rounded-lg border border-slate-300 p-2 text-sm';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50';
export function UnifiedActions({ analysis, workflow, users = [], canManage }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState([]);
  const actions = workflow.actions.filter(row => sameId(row.analysis_id, analysis.id));
  const rows = actions.flatMap(action => workflow.tasks.filter(task => sameId(task.action_id, action.id)).map(task => ({ ...task, responsible: action.responsible, due_date: action.due_date })));
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      files.forEach(validateEvidence);
      const { data: id, error: failure } = await supabase.rpc('save_unified_corrective_action', { analysis: analysis.id, item: editing.id || null, action_name: editing.name, action_description: editing.description, action_responsible: editing.responsible, action_due_date: editing.due_date, action_progress: Number(editing.progress) });
      if (failure) throw failure;
      setEditing(current => ({ ...current, id }));
      for (const file of files) {
        const path = `${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const upload = await supabase.storage.from('corrective-evidence').upload(path, file);
        if (upload.error) throw upload.error;
        const registered = await supabase.rpc('register_corrective_evidence', { task: id, path, original_name: file.name, bytes: file.size });
        if (registered.error) { await supabase.storage.from('corrective-evidence').remove([path]); throw registered.error; }
        setFiles(current => current.filter(value => value !== file));
      }
      setEditing(null); setFiles([]);
    } catch (failure) { setError(failure.message); }
    finally { await workflow.reload(); setBusy(false); }
  };
  const download = async evidence => {
    const { data, error: failure } = await supabase.storage.from('corrective-evidence').download(evidence.storage_path);
    if (failure) { setError(failure.message); return; }
    const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = evidence.file_name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Acciones correctivas</h3>{canManage && !editing && <button className={button} onClick={() => setEditing({ name: '', description: '', responsible: '', due_date: '', progress: 0 })}>＋ Acción</button>}</div>
    {rows.map(row => <article key={row.id} className="rounded-lg border p-4 space-y-2"><div className="flex justify-between gap-3"><h4 className="font-semibold">{row.name}</h4><span>{row.progress}% · {Number(row.progress) === 100 ? 'Completada' : 'En proceso'}</span></div><p className="whitespace-pre-wrap text-sm">{row.description}</p><p className="text-xs text-slate-500">Responsable: {personName(row.responsible, users)} · Fecha fin: {row.due_date || '—'}</p><div className="space-y-1">{workflow.evidence.filter(item => sameId(item.task_id, row.id)).map(item => <button key={item.id} className="block text-sm text-blue-700 underline" onClick={() => download(item)}>{item.file_name}</button>)}</div>{canManage && <button className={button} disabled={busy} onClick={() => { setEditing(row); setFiles([]); }}>Editar avance y evidencias</button>}</article>)}
    {!rows.length && <p className="text-sm text-slate-500">Sin acciones registradas.</p>}
    {editing && canManage && <form onSubmit={save} className="rounded-lg border p-4 space-y-3"><label className="block text-sm">Nombre<input required className={input} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label><label className="block text-sm">Descripción<textarea required className={input} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}/></label><label className="block text-sm">Responsable<select required className={input} value={editing.responsible || ''} onChange={e => setEditing({ ...editing, responsible: e.target.value })}><option value="">Seleccionar</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="block text-sm">Fecha fin<input required type="date" className={input} value={editing.due_date || ''} onChange={e => setEditing({ ...editing, due_date: e.target.value })}/></label><label className="block text-sm">Avance %<input required type="number" min="0" max="100" step="1" className={input} value={editing.progress} onChange={e => setEditing({ ...editing, progress: e.target.value })}/></label><label className="block text-sm">Evidencias (máximo 20 MB por archivo)<input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))}/></label><div className="flex gap-2"><button disabled={busy} className={button}>Guardar acción</button><button type="button" disabled={busy} className={button} onClick={() => setEditing(null)}>Cancelar</button></div></form>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}

export function OutOfTargetView({ indicators, objectives, reports, workflow, onSelect }) {
  const entries = attentionIndicators(indicators, reports, workflow.analyses);
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Fuera de meta</h1><p className="text-slate-500">Consulta los indicadores, análisis de causa, acciones, avances y evidencias.</p>{workflow.error && <p role="alert">{workflow.error}</p>}{entries.map(({ indicator, report, label }) => { const objective = objectives.find(row => sameId(row.id, indicator.objectiveId)); return <button key={indicator.id} onClick={() => onSelect(indicator)} className="block w-full rounded-xl border bg-white p-5 text-left space-y-2"><h2 className="font-semibold">{indicator.code} · {indicator.name}</h2><p className="text-sm text-slate-500">{objective?.code} · {objective?.name}</p><p className="text-sm">{report.period} · Resultado: {report.result} {displayUnit(indicator.unit)} · {label}</p></button>; })}{!entries.length && <p>No hay indicadores fuera de meta.</p>}</div>;
}
