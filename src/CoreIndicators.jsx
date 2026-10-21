import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Star, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { displayUnit } from './lib/units';

export default function CoreIndicators({ indicators = [], objectives = [], coreRows = [], onReload, onNotify, onError, onOpenIndicator }) {
  const initial = useMemo(() => coreRows.map(row => String(row.indicator_id)), [coreRows]);
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelected(initial), [initial.join('|')]);

  const toggle = id => {
    const value = String(id);
    setSelected(current => current.includes(value)
      ? current.filter(item => item !== value)
      : current.length < 4 ? [...current, value] : current);
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('set_core_indicators', { selected_indicator_ids: selected.map(Number) });
    setBusy(false);
    if (error) { onError(`No se pudieron guardar los indicadores core: ${error.message}`); return; }
    await onReload();
    onNotify('Indicadores core actualizados.');
  };

  return <div className="fade-in space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-wider text-[#D71920]">Gobierno de indicadores</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Indicadores core</h1><p className="mt-2 text-slate-500">Selecciona hasta cuatro indicadores prioritarios para el seguimiento ejecutivo. Puedes cambiarlos cuando lo requieras.</p></header>
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-blue-950">{selected.length}/4 seleccionados</p><p className="mt-1 text-sm text-blue-800">Los indicadores core se muestran como referencia de gestión para GCG.</p></div><button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{busy ? 'Guardando…' : 'Guardar selección'}</button></div></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-slate-900">Indicadores disponibles</h2><p className="mt-1 text-sm text-slate-500">Marca los cuatro que deben formar parte del tablero core.</p></div><div className="divide-y divide-slate-100">{indicators.map(indicator => { const objective = objectives.find(item => String(item.id) === String(indicator.objectiveId)); const checked = selected.includes(String(indicator.id)); return <label key={indicator.id} className={`flex cursor-pointer items-start gap-4 p-5 transition-colors ${checked ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}><input type="checkbox" checked={checked} onChange={() => toggle(indicator.id)} disabled={!checked && selected.length >= 4} className="mt-1 h-4 w-4 accent-[#1D4ED8]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{indicator.name}</p>{checked && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"><Star className="h-3 w-3" />Core</span>}</div><p className="mt-1 text-sm text-slate-500">{objective?.name || 'Sin objetivo'} · Meta: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)}</p></div><button type="button" onClick={event => { event.preventDefault(); onOpenIndicator(indicator); }} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white">Ver</button></label>; })}{!indicators.length && <p className="p-8 text-center text-sm text-slate-500">Aún no hay indicadores disponibles.</p>}</div></section>
  </div>;
}
