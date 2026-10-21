import { displayUnit } from './lib/units';
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MONTHS, parseReportPeriod } from './lib/reporting';
import { measurementTicks } from './lib/indicatorViews';
import { comparisonLines } from './lib/comparisonLines';

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
function Filters({ indicators, years, shared, onShared, yearA, yearB, onYearA, onYearB }) {
  const toggleMonth = month => onShared({ ...shared, months: shared.months.includes(month) ? shared.months.filter(item => item !== month) : [...shared.months, month] });
  return <div role="group" aria-label="Filtros de comparativa" className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-4">
    <label className="text-sm font-medium text-slate-600">Indicador<select aria-label="Comparativa: Indicador" className={field} value={shared.indicatorId} onChange={event => onShared({ ...shared, indicatorId: event.target.value })}><option value="">Seleccionar</option>{indicators.map(indicator => <option key={indicator.id} value={indicator.id}>{indicator.code} · {indicator.name}</option>)}</select></label>
    <div className="text-sm font-medium text-slate-600">Meses<details className="relative mt-1"><summary aria-label="Comparativa: Meses" className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{shared.months.length === MONTHS.length ? 'Todos' : `${shared.months.length} seleccionados`}</summary><div className="absolute left-0 top-full z-20 mt-1 min-w-[15rem] rounded-lg border border-slate-200 bg-white p-3 shadow-xl"><div className="mb-3 flex gap-4"><button type="button" onClick={() => onShared({ ...shared, months: MONTHS.map(month => month.toLowerCase()) })} className="text-xs underline">Todos</button><button type="button" onClick={() => onShared({ ...shared, months: [] })} className="text-xs underline">Ninguno</button></div><div className="grid grid-cols-2 gap-2">{MONTHS.map(month => <label key={month} className="flex items-center gap-2 text-xs"><input type="checkbox" aria-label={`Comparativa: ${month}`} checked={shared.months.includes(month.toLowerCase())} onChange={() => toggleMonth(month.toLowerCase())} />{month}</label>)}</div></div></details></div>
    <label className="text-sm font-medium text-blue-700">Año A<select aria-label="Comparativa: Año A" className={field} value={yearA} onChange={event => onYearA(event.target.value)}><option value="">Todos</option>{years.map(year => <option key={year}>{year}</option>)}</select></label>
    <label className="text-sm font-medium text-red-700">Año B<select aria-label="Comparativa: Año B" className={field} value={yearB} onChange={event => onYearB(event.target.value)}><option value="">Todos</option>{years.map(year => <option key={year}>{year}</option>)}</select></label>
  </div>;
}

export default function ComparisonLines({ indicators, reports }) {
  const [shared, setShared] = useState({ indicatorId: '', months: MONTHS.map(month => month.toLowerCase()) });
  const [yearA, setYearA] = useState('');
  const [yearB, setYearB] = useState('');
  const a = { ...shared, year: yearA };
  const b = { ...shared, year: yearB };
  const years = [...new Set(reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean))].sort().reverse();
  const indicatorA = indicators.find(indicator => String(indicator.id) === a.indicatorId);
  const indicatorB = indicators.find(indicator => String(indicator.id) === b.indicatorId);

  const data = comparisonLines(reports, a, b);
  const ticks = measurementTicks(data.map(row => ({ resultado: row.a, meta: row.b })), 0);
  const ready = Boolean(a.indicatorId && b.indicatorId);
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
    <header><h2 className="text-lg font-bold text-slate-900">Comparativa de indicadores</h2><p className="text-sm text-slate-500 mt-1">Compara dos indicadores o dos años del mismo indicador por mes.</p></header>
    <Filters indicators={indicators} years={years} shared={shared} onShared={setShared} yearA={yearA} yearB={yearB} onYearA={setYearA} onYearB={setYearB} />
    <p className="text-xs text-slate-500">{a.year && b.year ? 'Los años seleccionados se comparan por el mismo mes. El detalle de cada punto conserva su año.' : 'Selecciona un año en ambos filtros para superponer los meses de años distintos; con Todos se usa la fecha real.'} Ambas líneas usan la misma escala numérica; las unidades se conservan en el detalle.</p>
    {ready && data.length ? <div className="h-80" aria-label="Comparativa de indicadores con dos líneas"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 24, bottom: 12, left: 16 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="period" padding={{ left: 24, right: 24 }} tickMargin={10} tick={{ fontSize: 11 }} />
      <YAxis yAxisId="a" ticks={ticks} domain={[ticks[0], ticks.at(-1)]} interval={0} width={80} tickMargin={12} tick={{ fontSize: 11 }} />
      <Tooltip formatter={(value, name, item) => { const key = item.dataKey; const indicator = key === 'a' ? indicatorA : indicatorB; return [`${value} ${displayUnit(indicator?.unit)} · ${item.payload[`${key}Period`] || ''}`, name]; }} />
      <Legend /><Line yAxisId="a" type="linear" dataKey="a" name={`Comparativa A · ${indicatorA?.name || ''}`} stroke="#1d4ed8" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
      <Line yAxisId="a" type="linear" dataKey="b" name={`Comparativa B · ${indicatorB?.name || ''}`} stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
    </LineChart></ResponsiveContainer></div> : <p className="py-14 text-center text-slate-500">{ready ? 'No hay mediciones para los filtros seleccionados.' : 'Selecciona un indicador para ver las dos líneas.'}</p>}
    {ready && ['a', 'b'].some(key => !data.some(row => row[key] !== null)) && <p className="text-sm text-amber-700">Una de las selecciones no tiene mediciones para estos filtros; sus valores no se sustituyen por cero.</p>}
  </section>;
}
