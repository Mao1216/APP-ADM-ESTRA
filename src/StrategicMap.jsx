import React from 'react';
import { createPortal } from 'react-dom';
import { CircleDollarSign, GraduationCap, Users, X, Cog, Target, ChevronRight } from 'lucide-react';
import { displayUnit } from './lib/units';

const FOCI = [
  { key: 'Financiero', label: 'Financiero', Icon: CircleDollarSign, colors: ['border-amber-200 bg-amber-50/70', 'bg-amber-600 text-white', 'border-amber-200 hover:border-amber-500 hover:bg-amber-50 focus-visible:ring-amber-400'] },
  { key: 'Cliente', label: 'Cliente', Icon: Users, colors: ['border-teal-200 bg-teal-50/70', 'bg-teal-600 text-white', 'border-teal-200 hover:border-teal-500 hover:bg-teal-50 focus-visible:ring-teal-400'] },
  { key: 'Procesos', label: 'Procesos', Icon: Cog, colors: ['border-blue-200 bg-blue-50/70', 'bg-blue-600 text-white', 'border-blue-200 hover:border-blue-500 hover:bg-blue-50 focus-visible:ring-blue-400'] },
  { key: 'Personas/Aprendizaje', label: 'Personas / Aprendizaje', Icon: GraduationCap, colors: ['border-violet-200 bg-violet-50/70', 'bg-violet-600 text-white', 'border-violet-200 hover:border-violet-500 hover:bg-violet-50 focus-visible:ring-violet-400'] },
];

function InfoRow({ label, value }) {
  return <div className="flex min-w-0 justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
    <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
    <dd className="min-w-0 text-right text-xs font-medium leading-5 text-slate-800">{value || '—'}</dd>
  </div>;
}

function ObjectiveDetail({ objective, indicators, reports, users = [], close, openIndicator, canSelectIndicator }) {
  if (!objective) return null;
  const rows = indicators.filter(i => String(i.objectiveId) === String(objective.id));
  const measured = rows.filter(i => reports.some(r => String(r.indicatorId) === String(i.id))).length;
  const personName = id => users.find(user => String(user.id).toLowerCase() === String(id || '').toLowerCase() || String(user.email || '').toLowerCase() === String(id || '').toLowerCase())?.name || id || 'Sin asignar';
  return createPortal(<div role="dialog" aria-modal="true" aria-label={`Detalle de ${objective.name}`} onMouseDown={e => { if (e.target === e.currentTarget) close(); }} className="fixed inset-0 z-[100] flex justify-end bg-slate-950/35 backdrop-blur-[1px]">
    <section className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-6 py-5"><div><p className="text-xs font-semibold uppercase text-blue-700">{objective.code || 'Objetivo'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{objective.name}</h2></div><button onClick={close} aria-label="Cerrar detalle" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-5 p-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800"><Target className="h-4 w-4" />{objective.focus === 'Personas/Aprendizaje' ? 'Personas / Aprendizaje' : objective.focus || 'Sin foco definido'}</span>
        {objective.description && <p className="text-sm leading-6 text-slate-600">{objective.description}</p>}
        <section aria-label="Información del objetivo" className="border-y border-slate-200">
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <InfoRow label="Código" value={objective.code} />
            <InfoRow label="Responsable" value={personName(objective.ownerId)} />
            <InfoRow label="Avance" value={`${Number(objective.progress || 0)}%`} />
            <InfoRow label="Vigencia" value={objective.validityStartYear && objective.validityEndYear ? `${objective.validityStartYear} – ${objective.validityEndYear}` : null} />
            <InfoRow label="Indicadores medidos" value={`${measured} de ${rows.length}`} />
          </dl>
        </section>
        <section><h3 className="mb-1 font-bold">Indicadores del objetivo <span className="text-xs font-normal text-slate-500">{rows.length}</span></h3><div className="divide-y divide-slate-200">
          {rows.map(i => { const latest = reports.filter(r => String(r.indicatorId) === String(i.id)).at(-1); return <article key={i.id} className="py-3"><h4 className="font-semibold text-slate-900">{i.name}</h4><dl className="mt-1"><InfoRow label="Medición" value={latest?.result == null ? 'Sin medición' : `${latest.result} ${displayUnit(i.unit)}`} /><InfoRow label="Meta" value={`${i.comparator || ''} ${i.target ?? ''} ${displayUnit(i.unit)}`.trim()} /></dl>{canSelectIndicator(i) && <button onClick={() => openIndicator(i)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">Ver indicador <ChevronRight className="h-4 w-4" /></button>}</article>; })}
          {!rows.length && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">Este objetivo aun no tiene indicadores.</p>}
        </div></section>
      </div>
      <footer className="sticky bottom-0 border-t bg-white p-4"><button onClick={close} className="w-full rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">Volver al mapa BSC</button></footer>
    </section>
  </div>, document.body);
}

export default function StrategicMap({ objectives = [], indicators = [], reports = [], users = [], onClose, onSelectIndicator, canSelectIndicator = () => true }) {
  const [selected, setSelected] = React.useState(null);
  return <section className="flex min-h-[calc(100vh-7rem)] flex-col" aria-label="Mapa estrategico BSC">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D71920]">Gestión Estratégica</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Mapa estratégico BSC</h1><p className="mt-1 text-sm text-slate-500">Objetivos organizados por foco estratégico</p></div><div className="flex items-center gap-3"><p className="hidden rounded-lg border bg-white px-3 py-2 text-xs text-slate-500 lg:block">Selecciona un objetivo para ver sus indicadores</p><button onClick={onClose} aria-label="Cerrar gráfica BSC" className="rounded-lg border bg-white p-2.5 text-slate-500 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-[#D71920]"><X className="h-5 w-5" /></button></div></header>
    <div className="grid flex-1 grid-rows-4 gap-3 pb-3 max-md:grid-rows-none">{FOCI.map(({ key, label, Icon, colors }) => { const rows = objectives.filter(o => o.focus === key); return <section key={key} aria-label={`Foco ${label}`} className={`flex min-h-32 gap-3 rounded-2xl border p-2.5 md:p-3 ${colors[0]} max-md:min-h-28`}><div className={`flex w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center md:w-36 ${colors[1]}`}><Icon className="h-5 w-5" /><h2 className="text-xs font-bold md:text-sm">{label}</h2></div><div className="grid min-w-0 flex-1 grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-3">{rows.map(o => <button key={o.id} onClick={() => setSelected(o)} className={`group flex min-h-16 items-center justify-center gap-2 rounded-xl border bg-white/90 px-3 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${colors[2]}`}><span><span className="block text-[10px] font-bold text-slate-500">{o.code || 'OBJ'}</span><span className="mt-1 block text-xs font-semibold leading-4 md:text-sm">{o.name}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-600" /></button>)}</div></section>; })}</div>
    <ObjectiveDetail objective={selected} indicators={indicators} reports={reports} users={users} close={() => setSelected(null)} openIndicator={onSelectIndicator} canSelectIndicator={canSelectIndicator} />
  </section>;
}
