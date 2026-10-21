import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ExternalLink, Link2, RefreshCw, Search, User, X } from 'lucide-react';
import { supabase } from './lib/supabase';

const field = 'rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm';
const projectStatusClass = status => ({
  pendiente: 'bg-slate-100 text-slate-700',
  evaluacion: 'bg-violet-50 text-violet-700',
  evaluación: 'bg-violet-50 text-violet-700',
  implementacion: 'bg-blue-50 text-blue-700',
  implementación: 'bg-blue-50 text-blue-700',
  lanzamiento: 'bg-cyan-50 text-cyan-700',
  seguimiento: 'bg-teal-50 text-teal-700',
  finalizado: 'bg-green-50 text-green-700',
  standby: 'bg-amber-50 text-amber-800',
  cancelado: 'bg-red-50 text-red-700',
  planificado: 'bg-slate-100 text-slate-700',
  'en ejecución': 'bg-blue-50 text-blue-700',
  'en pausa': 'bg-amber-50 text-amber-800',
  concluido: 'bg-green-50 text-green-700',
}[String(status || '').toLowerCase()] || 'bg-slate-100 text-slate-700');
const date = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('es-PE') : 'Sin fecha';
const stamp = value => value ? new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Sin actualización';
function Progress({ value }) {
  return <div><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Avance</span><strong className="text-lg text-blue-700">{value ?? 0}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} /></div></div>;
}

export default function PmoProjects({ objective, projects, canManage, canSync, accessToken, onReload, onNotify }) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') onReload(); };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [onReload]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    supabase.from('pmo_project_catalog').select('*').order('code').then(({ data, error: failure }) => {
      if (!active) return;
      setCatalog(data || []);
      setError(failure ? 'No se pudo cargar el catálogo de proyectos. Verifica que las migraciones de PMO estén instaladas.' : '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [open]);
  const linked = new Set(projects.map(project => project.catalog_id).filter(Boolean));
  const hasOfficialCatalog = catalog.some(project => !project.is_demo);
  const visibleCatalog = hasOfficialCatalog ? catalog.filter(project => !project.is_demo || linked.has(project.id)) : catalog;
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rows = visibleCatalog.filter(project => normalize(project.code + ' ' + project.name).includes(normalize(search)) && (!status || project.status === status));
  const syncCatalog = async () => {
    if (syncing || !accessToken) return;
    setSyncing(true); setError('');
    try {
      const response = await fetch('/api/pmo-sync', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'No se pudo actualizar el catálogo de PMO.');
      await onReload();
      onNotify(`Catálogo PMO actualizado: ${payload.synchronized} proyectos.`);
    } catch (failure) { setError(failure.message || 'No se pudo actualizar el catálogo de PMO.'); }
    finally { setSyncing(false); }
  };
  const mutate = async (name, args, message) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.rpc(name, args);
      if (failure) throw failure;
      await onReload();
      onNotify(message);
      setOpen(false); setSelected([]);
    } catch (failure) { setError(failure.message || 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3"><h3 className="text-base font-bold text-slate-900">Proyectos vinculados</h3><div className="flex flex-wrap items-center gap-2">{canSync && <button disabled={syncing} onClick={syncCatalog} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Actualizando…' : 'Actualizar catálogo PMO'}</button>}{canManage && <button onClick={() => { setSelected([]); setOpen(true); setError(''); }} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"><Link2 className="h-4 w-4" />Vincular proyecto PMO</button>}</div></header>
    {error && !open && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="space-y-3">{projects.map(project => <article key={project.id} className="overflow-hidden rounded-lg border border-slate-200"><div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]"><div className="p-4"><div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="rounded bg-slate-100 px-2 py-1 font-semibold">{project.catalog_id ? 'PMO' : 'Registro'}</span><span>{project.code || ''}</span></div><h4 className="text-sm font-semibold text-slate-900">{project.name}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{project.description || 'Sin descripción'}</p><div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500"><p className="flex items-center gap-2"><User className="h-3.5 w-3.5" />Responsable: {project.responsible_name || 'Sin asignar'}</p><p className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Fecha de término: {date(project.end_date)}</p></div></div><div className="flex flex-col border-t border-slate-100 p-4 lg:border-l lg:border-t-0"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${projectStatusClass(project.status)}`}>{project.status}</span></div><div className="mt-3"><Progress value={project.progress} /></div><div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="flex min-w-0 items-center gap-1.5 truncate text-slate-500"><RefreshCw className="h-3.5 w-3.5 shrink-0 text-emerald-600" />Actualizado en catálogo · {stamp(project.updated_at)}</span><div className="flex shrink-0 items-center gap-3">{project.project_url && <a href={project.project_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-blue-700">Ver en PMO<ExternalLink className="h-3 w-3" /></a>}{project.project_url && canManage && <span className="h-4 border-l border-slate-200" />}{canManage && <button disabled={busy} onClick={() => { if (window.confirm('¿Desvincular este proyecto del objetivo? El proyecto seguirá en el catálogo.')) mutate('unlink_catalog_project', { project: project.id }, 'Proyecto desvinculado.'); }} className="flex items-center gap-1 font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"><Link2 className="h-3.5 w-3.5" />Desvincular</button>}</div></div></div></div></article>)}{!projects.length && <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Selecciona un proyecto del catálogo para vincularlo a este objetivo.</div>}</div>
    {open && createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Vincular proyecto de PMO" onKeyDown={event => { if (event.key === 'Escape' && !busy) setOpen(false); }}><div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between p-6"><div><h2 className="text-xl font-bold">Vincular proyecto de PMO</h2><p className="mt-1 text-sm text-slate-500">Selecciona uno o varios proyectos del catálogo</p></div><button autoFocus disabled={busy} aria-label="Cerrar" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="flex flex-wrap gap-3 px-6 pb-4"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Buscar proyecto" placeholder="Buscar por nombre o código" value={search} onChange={event => setSearch(event.target.value)} className={field + ' w-full pl-10'} /></label><select aria-label="Estatus de proyectos" value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="">Todos los estados</option>{['En ejecución', 'Planificado', 'Concluido', 'En pausa', 'Cancelado'].map(item => <option key={item}>{item}</option>)}</select></div>{error && <p role="alert" className="mx-6 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="space-y-3 overflow-y-auto px-6 pb-5">{loading ? <p className="p-8 text-center text-slate-500">Cargando proyectos…</p> : rows.map(project => <label key={project.id} className={`flex cursor-pointer flex-wrap items-center gap-4 rounded-xl border p-4 ${selected.includes(project.id) ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200'} ${linked.has(project.id) ? 'opacity-50' : ''}`}><input type="checkbox" name="pmo-project" value={project.id} disabled={busy || linked.has(project.id)} checked={selected.includes(project.id)} onChange={() => setSelected(current => current.includes(project.id) ? current.filter(id => id !== project.id) : [...current, project.id])} /><span className="text-xs text-slate-500">{project.code}</span><div className="min-w-48 flex-1"><p className="text-sm font-semibold">{project.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{project.description}</p></div><span className={`rounded-lg px-2 py-1 text-xs ${linked.has(project.id) ? 'bg-slate-100 text-slate-500' : projectStatusClass(project.status)}`}>{linked.has(project.id) ? 'Ya vinculado' : project.status}</span><div className="w-36"><Progress value={project.progress} /></div></label>)}{!loading && !rows.length && <p className="p-8 text-center text-sm text-slate-500">No hay proyectos que coincidan con la búsqueda.</p>}</div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-5"><span className="text-xs text-slate-500">{selected.length ? `${selected.length} proyecto${selected.length === 1 ? '' : 's'} seleccionado${selected.length === 1 ? '' : 's'}` : 'Selecciona uno o varios proyectos'}</span><div className="flex gap-3"><button disabled={busy} onClick={() => setOpen(false)} className={field}>Cancelar</button><button disabled={busy || !selected.length} onClick={() => mutate('link_catalog_projects', { objective: objective.id, catalog_projects: selected }, 'Proyectos vinculados al objetivo.')} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Vinculando…' : 'Vincular proyectos'}</button></div></footer></div></div>, document.body)}
  </section>;
}
