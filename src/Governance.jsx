import { displayUnit } from './lib/units';
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { indicatorAccess } from './lib/responsibility';
import AssignedIndicatorPortfolio from './IndicatorPortfolio';

const box = 'bg-white border border-slate-200 rounded-lg p-3 space-y-2';
const field = 'border border-slate-300 rounded-lg p-2 text-sm w-full';
const button = 'bg-blue-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50';
const compactDetails = 'bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm';

export { default as ComparisonCharts } from './ComparisonLines';

export function AssignedIndicators({ indicators, objectives, reports = [], users = [], ownIds, isSuperAdmin = false, onSelect }) {
  const assigned = indicators.filter(i => indicatorAccess(i, objectives.find(o => o.id === i.objectiveId), ownIds, isSuperAdmin).canReport);
  return <AssignedIndicatorPortfolio indicators={assigned} objectives={objectives} reports={reports} users={users} onSelect={onSelect} />;
}

export function BioIndicators({ objectives, indicators, reports }) {
  const [search, setSearch] = useState('');
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Bio Indicadores</h1><p className="text-slate-500">Portafolio institucional · solo visualización para todos los usuarios.</p><input aria-label="Buscar objetivo o indicador" placeholder="Buscar objetivo o indicador" className={field} value={search} onChange={e => setSearch(e.target.value)}/>{objectives.filter(o => `${o.name} ${indicators.filter(i => i.objectiveId === o.id).map(i => i.name).join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(o => <section key={o.id} className={box}><h2 className="font-bold">{o.name}</h2><p>{o.description}</p><p className="text-sm text-slate-500">Vigencia: {o.validityStartYear || '—'} a {o.validityEndYear || '—'} · Avance: {o.progress}%</p>{indicators.filter(i => i.objectiveId === o.id).map(i => <article key={i.id} className="border-t pt-4"><h3 className="font-semibold">{i.name}</h3><p className="text-sm">Meta: {i.comparator} {i.target} {displayUnit(i.unit)} · {i.frequency}</p><p className="text-sm text-slate-500">Fórmula: {i.formula || '—'}</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Periodo</th><th className="text-left">Resultado</th><th className="text-left">Estado</th></tr></thead><tbody>{reports.filter(r => r.indicatorId === i.id).map(r => <tr key={r.id}><td>{r.period}</td><td>{r.result} {displayUnit(i.unit)}</td><td>{r.status}</td></tr>)}</tbody></table></div></article>)}{!indicators.some(i => i.objectiveId === o.id) && <p className="text-slate-500">Sin indicadores.</p>}</section>)}{!objectives.length && <p>No hay objetivos registrados.</p>}</div>;
}

export function IndicatorControls({ indicator, reports, isGcg, canManage, users, session, onReload, onError, onNotify, requestOnly = false }) {
  const [kind, setKind] = useState('target');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [reportId, setReportId] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [comparator, setComparator] = useState(indicator.comparator);
  const [historicalTarget, setHistoricalTarget] = useState('');
  const selectedReport = reports.find(r => String(r.id) === reportId);
  const normalizedReportSearch = reportSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const matchingReports = normalizedReportSearch
    ? reports.filter(report => `${report.period} ${report.result ?? 'Sin datos'}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalizedReportSearch))
    : [];
  const needsHistoricalTarget = kind === 'report' && selectedReport && selectedReport.measurement_target == null;
  const [delegate, setDelegate] = useState(users.find(user => user.email && user.email.toLowerCase() === String(indicator.reporter_email || '').toLowerCase())?.id || indicator.reporter_email || '');
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState([]);
  const [definition, setDefinition] = useState({ name: indicator.name, resource: indicator.resource || '', formula: indicator.formula || '', unit: indicator.unit, frequency: indicator.frequency, review_frequency: indicator.reviewFrequency || indicator.frequency, owner_email: indicator.ownerId || '' });
  useEffect(() => {
    if (!isGcg) { setAudit([]); return; }
    let active = true;
    supabase.from('indicator_change_audit').select('id,kind,reason,changed_email,created_at').eq('indicator_id', indicator.id).order('created_at', { ascending: false }).then(({ data }) => { if (active) setAudit(data || []); });
    return () => { active = false; };
  }, [indicator.id, isGcg]);
  const saveDefinition = async e => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.rpc('apply_gcg_indicator_change', { indicator: indicator.id, change_kind: 'definition', target_report: null, proposed: definition, change_reason: 'Actualización de definición por GCG' });
    setBusy(false);
    if (error) onError(error.message); else { await onReload(); const { data } = await supabase.from('indicator_change_audit').select('id,kind,reason,changed_email,created_at').eq('indicator_id', indicator.id).order('created_at', { ascending: false }); setAudit(data || []); onNotify('Definición actualizada por GCG.'); }
  };
  const submit = async e => {
    e.preventDefault();
    if (kind === 'assign') { await assign(); return; }
    setBusy(true);
    const proposed = kind === 'target' ? { target: Number(value), comparator } : kind === 'report' ? { result: Number(value), period: selectedReport?.period } : kind === 'delete_report' ? { period: selectedReport?.period } : { name: value };
    if (needsHistoricalTarget) {
      if (historicalTarget === '') { setBusy(false); onError('Indica la meta histórica para la revisión de GCG.'); return; }
      proposed.measurement_target = Number(historicalTarget);
      proposed.measurement_comparator = comparator;
    }
    const direct = isGcg;
    const { error } = direct
      ? await supabase.rpc('apply_gcg_indicator_change', { indicator: indicator.id, change_kind: kind, target_report: ['report', 'delete_report'].includes(kind) ? Number(reportId) : null, proposed, change_reason: reason })
      : await supabase.from('indicator_change_requests').insert({ indicator_id: indicator.id, report_id: ['report', 'delete_report'].includes(kind) ? Number(reportId) : null, kind, proposed, reason, requested_by: session.user.id });
    setBusy(false);
    if (error) { onError(error.message); return; }
    setValue(''); setReason(''); setReportId(''); await onReload(); if (direct) { const { data } = await supabase.from('indicator_change_audit').select('id,kind,reason,changed_email,created_at').eq('indicator_id', indicator.id).order('created_at', { ascending: false }); setAudit(data || []); } onNotify(direct ? 'Cambio aplicado y guardado en el historial.' : 'Solicitud enviada a GCG. El registro vigente no cambia.');
  };
  const assign = async () => {
    if (!delegate) return;
    setBusy(true);
    const { error } = await supabase.rpc('assign_indicator_reporter', { indicator: indicator.id, reporter: delegate });
    setBusy(false);
    if (error) onError(error.message); else { await onReload(); onNotify('Responsable de reporte actualizado.'); }
  };
  return <div className={`${requestOnly ? 'grid grid-cols-1' : 'grid grid-cols-1 md:grid-cols-2'} gap-3 items-start text-sm [&_summary]:text-sm [&_summary]:font-medium [&_form]:mt-3`}>
    {needsHistoricalTarget && <div className={box}><p className="text-sm text-amber-800">Esta medición anterior no tiene meta histórica. Indica la meta que correspondía; GCG debe verificarla al aprobar la corrección.</p><label className="text-sm">Meta histórica propuesta<input type="number" step="any" className={field} value={historicalTarget} onChange={e => setHistoricalTarget(e.target.value)}/></label><label className="text-sm">Comparador histórico<select className={field} value={comparator} onChange={e => setComparator(e.target.value)}>{['>=','>','<=','<','='].map(c => <option key={c}>{c}</option>)}</select></label></div>}
    {isGcg && <details className={box}><summary className="cursor-pointer font-semibold">Editar definición · GCG</summary><form onSubmit={saveDefinition} className="space-y-3">
      {Object.entries({ name: 'Nombre', resource: 'Recursos', formula: 'Fórmula', unit: 'Unidad' }).map(([key,label]) => <label key={key} className="block text-sm">{label}<input required={key === 'name' || key === 'unit'} className={field} value={definition[key]} onChange={e => setDefinition({ ...definition, [key]: e.target.value })}/></label>)}
      {['frequency','review_frequency'].map(key => <label key={key} className="block text-sm">{key === 'frequency' ? 'Frecuencia de medición' : 'Frecuencia de revisión'}<select className={field} value={definition[key]} onChange={e => setDefinition({ ...definition, [key]: e.target.value })}>{['Mensual','Bimestral','Trimestral','Semestral','Anual'].map(f => <option key={f}>{f}</option>)}</select></label>)}
      <label className="block text-sm">Responsable del reporte<select required className={field} value={definition.owner_email} onChange={e => setDefinition({ ...definition, owner_email: e.target.value })}><option value="">Seleccionar</option>{users.filter(u => u.role === 'gerente_responsable').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><p className="text-xs text-slate-500">Cada cambio realizado por GCG queda registrado en el historial.</p><button className={button} disabled={busy}>Guardar definición</button>
    </form></details>}
    <details open={requestOnly || undefined} className={requestOnly ? 'request-form space-y-3' : box}><summary className={requestOnly ? 'hidden' : 'cursor-pointer font-semibold'}>{isGcg ? 'Modificar indicador' : 'Solicitar modificación a GCG'}</summary><form onSubmit={submit} className="space-y-3"><select aria-label="Tipo de modificación" className={field} value={kind} onChange={e => {setKind(e.target.value); setValue(''); setReportId(''); setReportSearch('');}}>{(isGcg || canManage) && <option value="assign">Asignar responsable de reporte</option>}<option value="target">Cambiar meta</option><option value="report">Corregir medición registrada</option><option value="delete_report">Eliminar reporte</option><option value="definition">Cambiar nombre del indicador</option></select>{kind === 'target' && <select aria-label="Comparador propuesto" className={field} value={comparator} onChange={e => setComparator(e.target.value)}>{['>=','>','<=','<','='].map(c => <option key={c}>{c}</option>)}</select>}{['report', 'delete_report'].includes(kind) && <div className="relative"><input aria-label="Buscar medición" required className={field} placeholder="Buscar periodo o resultado..." value={reportSearch} onChange={e => { setReportSearch(e.target.value); setReportId(''); }} />{reportSearch && !selectedReport && <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">{matchingReports.length ? matchingReports.map(report => <button key={report.id} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50" onClick={() => { setReportId(String(report.id)); setReportSearch(`${report.period}: ${report.result ?? 'Sin datos'}`); }}><strong>{report.period}</strong><span className="ml-2 text-slate-500">Resultado: {report.result ?? 'Sin datos'}</span></button>) : <p className="px-3 py-2 text-sm text-slate-500">No se encontraron mediciones.</p>}</div>}{selectedReport && <p className="mt-2 text-xs text-slate-500">Medición seleccionada: <strong>{selectedReport.period}</strong> · Resultado: <strong>{selectedReport.result ?? 'Sin datos'}</strong></p>}</div>}{!['delete_report', 'assign'].includes(kind) && <input aria-label="Valor propuesto" required type={kind === 'definition' ? 'text' : 'number'} step="any" className={field} placeholder="Nuevo valor propuesto" value={value} onChange={e => setValue(e.target.value)}/>}{kind === 'assign' && <label className="block text-sm font-medium text-slate-700">Responsable adicional<select aria-label="Responsable del reporte" required className={field} value={delegate} onChange={event => setDelegate(event.target.value)}><option value="" disabled>Seleccionar responsable adicional</option>{users.filter(user => user.id !== indicator.ownerId && user.id !== session.user.id && user.email !== session.user.email && user.id !== session.user.email).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>}{kind !== 'assign' && <textarea aria-label="Motivo" required className={field} placeholder="Motivo de la modificación" value={reason} onChange={e => setReason(e.target.value)}/>}<button disabled={busy || (['report', 'delete_report'].includes(kind) && !reportId)} className={button}>{kind === 'assign' ? 'Guardar responsable' : isGcg ? 'Guardar cambio' : 'Enviar solicitud'}</button></form></details>
    {isGcg && !requestOnly && <details className={box}><summary className="cursor-pointer font-semibold">Historial de cambios</summary><div className="space-y-2 text-xs text-slate-600">{audit.map(entry => <article key={entry.id} className="border-t border-slate-100 pt-2"><strong>{({ target: 'Meta', report: 'Medición', delete_report: 'Eliminación de reporte', definition: 'Definición' })[entry.kind] || entry.kind}</strong> · {new Date(entry.created_at).toLocaleString('es-PE')}<br />{entry.reason}<br /><span className="text-slate-400">{entry.changed_email}</span></article>)}{!audit.length && <p>No hay cambios directos registrados.</p>}</div></details>}
    {!isGcg && canManage && !requestOnly && <details className={box}><summary className="cursor-pointer font-semibold">Asignar responsable de reporte</summary><select aria-label="Responsable del reporte" className={field} value={delegate} onChange={e => setDelegate(e.target.value)}><option value="" disabled>Seleccionar responsable adicional</option>{users.filter(u => u.id !== indicator.ownerId && u.id !== session.user.id && u.email !== session.user.email && u.id !== session.user.email).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button disabled={busy || !delegate} className={button} onClick={assign}>Guardar responsable</button></details>}
  </div>;
}

export { default as ChangeRequests } from './ChangeRequestsView';
