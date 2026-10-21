import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { objectiveActivityStatus } from './lib/objectiveViews';

export default function ObjectiveStatusControl({ objective, canEdit, onChange }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = objectiveActivityStatus(objective);
  const style = status === 'Activo' ? 'border-green-100 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-100 text-slate-600';
  const save = async next => {
    if (!canEdit || busy) return;
    if (next === objective.status) { setOpen(false); return; }
    setBusy(true); setError('');
    try { await onChange(objective, next); setOpen(false); }
    catch (failure) { setError(failure.message || 'No se pudo guardar el estatus.'); }
    finally { setBusy(false); }
  };
  return <div className="relative shrink-0" onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setOpen(false); }}>
    {canEdit ? <button type="button" aria-label={`Cambiar estatus del objetivo ${objective.code || objective.name}`} aria-expanded={open} disabled={busy} onClick={() => setOpen(!open)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${style}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{busy ? 'Guardando…' : status}<ChevronDown className="h-3.5 w-3.5" /></button> : <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${style}`}>{status}</span>}
    {open && <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{['Activo', 'No activo'].map(next => <button key={next} type="button" disabled={busy} onClick={() => save(next)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{next}{status === next && <Check className="h-3.5 w-3.5 text-green-600" />}</button>)}</div>}
    {error && <p role="alert" className="mt-2 max-w-44 text-xs text-red-700">{error}</p>}
  </div>;
}
