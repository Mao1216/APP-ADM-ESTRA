import React, { useState } from 'react';
import { BarChart3, LogOut } from 'lucide-react';
import StrategicMap from './StrategicMap';
import MeasurementChart from './MeasurementChart';
import { accountIdentities, supportIndicators } from './lib/responsibility';
import { MONTHS, parseReportPeriod } from './lib/reporting';
import { displayUnit } from './lib/units';
import { supabase } from './lib/supabase';
import biomontLogo from './assets/biomont-logo.png';
import kunturLogo from './assets/kuntur-pharma-logo.png';

const normalize = value => String(value || '').trim().toLowerCase();
export default function UserWorkspace({ session, objectives, indicators, reports, users, organizationPeople, onReload, onSignOut }) {
  const [view, setView] = useState('bsc');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ period: '', result: '', observations: '', noData: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isKunturAccount = /@kunturpharma\.pe$/i.test(session?.user?.email || '');
  const assigned = supportIndicators(indicators, accountIdentities(session.user.email, organizationPeople));
  const selected = assigned.find(indicator => String(indicator.id) === String(selectedId));
  const history = selected ? reports.filter(report => String(report.indicatorId) === String(selected.id)).sort((a, b) => (parseReportPeriod(a.period)?.order || 0) - (parseReportPeriod(b.period)?.order || 0)) : [];
  const openIndicator = indicator => {
    if (!assigned.some(item => String(item.id) === String(indicator.id))) return;
    setSelectedId(indicator.id); setView('indicators'); setError(''); setNotice('');
    setForm({ period: '', result: '', observations: '', noData: false });
  };
  const save = async event => {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const [year, month] = form.period.split('-');
      const result = form.noData ? null : Number(form.result);
      if (!/^\d{4}-\d{2}$/.test(form.period) || !MONTHS[Number(month) - 1] || (!form.noData && (!form.result.trim() || !Number.isFinite(result)))) throw new Error('Completa el periodo y el resultado.');
      const { error: failure } = await supabase.rpc('register_indicator_measurement', {
        indicator: selected.id, report_period: MONTHS[Number(month) - 1] + ',' + year,
        report_result: result, report_observations: form.noData ? null : form.observations.trim() || null,
      });
      if (failure) throw failure;
      await onReload();
      setForm({ period: '', result: '', observations: '', noData: false });
      setNotice('Medición registrada.');
    } catch (failure) { setError(failure.message || 'No se pudo registrar la medición.'); }
    finally { setBusy(false); }
  };
  const tabs = <>{[['bsc', 'Gráfica BSC'], ['indicators', 'Indicadores']].map(([key, name]) => <button key={key} onClick={() => { setView(key); setSelectedId(null); setError(''); }} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${view === key ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><BarChart3 className="h-5 w-5" />{name}</button>)}</>;
  return <div className="biomet-app flex min-h-screen bg-slate-50 text-slate-900"><aside className="app-sidebar fixed hidden h-full flex-col bg-slate-900 md:flex"><div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4"><img src={isKunturAccount ? kunturLogo : biomontLogo} alt={isKunturAccount ? "Kuntur Pharma" : "Biomont"} className={`h-9 ${isKunturAccount ? "w-28" : "w-12"} object-contain`} /><strong className="text-lg text-white">Gestión Estratégica</strong></div><nav className="flex flex-1 flex-col gap-1 p-3">{tabs}</nav><footer className="border-t border-slate-800 p-4 text-xs text-slate-400"><p className="truncate text-sm text-white">{session.user.user_metadata?.full_name || session.user.email}</p><p className="mt-1">Usuario</p><button onClick={onSignOut} className="mt-3 flex items-center gap-2 text-slate-300"><LogOut className="h-4 w-4" />Cerrar sesión</button></footer></aside><main className="app-main min-w-0 flex-1 p-4 md:p-6"><header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 p-2 md:hidden"><nav className="flex gap-2">{tabs}</nav><button onClick={onSignOut} aria-label="Cerrar sesión" className="p-2 text-white"><LogOut className="h-5 w-5" /></button></header>
    {view === 'bsc' ? <StrategicMap objectives={objectives} indicators={indicators} reports={reports} users={users} onClose={() => setView('indicators')} canSelectIndicator={indicator => assigned.some(item => String(item.id) === String(indicator.id))} onSelectIndicator={openIndicator} /> : <div className="space-y-5"><header><h1 className="text-3xl font-bold">Indicadores</h1><p className="mt-2 text-sm text-slate-500">Indicadores donde eres responsable de apoyo para registrar mediciones.</p></header>{selected ? <><button onClick={() => setSelectedId(null)} className="text-sm font-semibold text-blue-700">← Volver a indicadores</button><section className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold text-blue-700">{selected.code}</p><h2 className="mt-1 text-xl font-bold">{selected.name}</h2><p className="mt-2 text-sm text-slate-500">{objectives.find(item => item.id === selected.objectiveId)?.name}</p><p className="mt-3 text-sm">Meta: {selected.comparator} {selected.target} {displayUnit(selected.unit)} · {selected.frequency}</p></section><section className="rounded-xl border bg-white p-5"><MeasurementChart indicator={selected} reports={history} /></section><form onSubmit={save} className="space-y-4 rounded-xl border bg-white p-5"><h3 className="font-semibold">Registrar medición</h3><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Periodo<input required type="month" value={form.period} onChange={event => setForm({ ...form, period: event.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>{!form.noData && <label className="text-sm">Resultado {displayUnit(selected.unit)}<input required type="number" step="any" value={form.result} onChange={event => setForm({ ...form, result: event.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.noData} onChange={event => setForm({ ...form, noData: event.target.checked })} />Sin datos para este periodo</label>{!form.noData && <label className="block text-sm">Observaciones (opcional)<textarea value={form.observations} onChange={event => setForm({ ...form, observations: event.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}<button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar medición'}</button></form><section className="overflow-x-auto rounded-xl border bg-white p-5"><h3 className="mb-3 font-semibold">Historial de mediciones</h3><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Periodo</th><th>Resultado</th><th>Estado</th></tr></thead><tbody>{[...history].reverse().map(report => <tr key={report.id} className="border-b"><td className="py-3">{report.period}</td><td>{report.result == null ? 'Sin datos' : report.result + ' ' + displayUnit(selected.unit)}</td><td>{report.status}</td></tr>)}</tbody></table>{!history.length && <p className="py-4 text-sm text-slate-500">Aún no hay mediciones.</p>}</section></> : <><input aria-label="Buscar indicador" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre o código" className="w-full max-w-lg rounded-lg border bg-white p-3 text-sm" /><div className="divide-y rounded-xl border bg-white">{assigned.filter(item => normalize(item.code + ' ' + item.name).includes(normalize(search))).map(indicator => <button key={indicator.id} onClick={() => openIndicator(indicator)} className="block w-full p-5 text-left hover:bg-slate-50"><p className="text-xs text-blue-700">{indicator.code}</p><h2 className="mt-1 font-semibold">{indicator.name}</h2><p className="mt-1 text-sm text-slate-500">Meta: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)}</p></button>)}{!assigned.length && <p className="p-8 text-sm text-slate-500">No tienes indicadores asignados como responsable de apoyo.</p>}</div></>}</div>}
  </main></div>;
}
