import { displayUnit } from './lib/units';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Area, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { measurementSeries, measurementTicks } from './lib/indicatorViews';
import { deviationAssessment } from './lib/measurementDeviation';
import { historicalComparisonSeries } from './lib/historicalComparison';
import { parseReportPeriod } from './lib/reporting';
import { supabase } from './lib/supabase';

const NAVY = '#112B50';
const PREVIOUS = '#a3adbb';
const formatValue = value => Number(value).toLocaleString('es-PE', { maximumFractionDigits: 4 });
const valueWithUnit = (value, unit) => value == null ? 'Sin medición' : `${formatValue(value)} ${unit}`.trim();

function MeasurementTooltip({ active, payload, label, unit, defaultComparator, comparison, year }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  if (comparison) return <div className="min-w-52 rounded-xl border border-slate-200 bg-white p-3.5 text-sm shadow-xl">
    <p className="mb-3 font-semibold text-slate-900">{row.monthName}</p>
    {[{ year, value: row.resultado, color: NAVY }, { year: Number(year) - 1, value: row.previous, color: PREVIOUS }].map(item =>
      <p key={item.year} className="mt-2 flex items-center justify-between gap-6"><span className="flex items-center gap-2 text-slate-600"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.year}</span><strong style={{ color: item.color }}>{valueWithUnit(item.value, unit)}</strong></p>)}
  </div>;
  if (row.resultado == null) return null;
  const comparator = row.comparator || defaultComparator;
  const assessment = deviationAssessment(row.resultado, row.meta, comparator);
  const inTarget = assessment.status === 'en_meta';
  const moderate = assessment.status === 'desviacion_moderada';
  return <div className="min-w-56 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl">
    <p className="font-semibold text-slate-900">{label}</p>
    <div className="mt-3 space-y-2 text-sm">
      <p className="flex justify-between gap-5 text-slate-600"><span>Meta de la medición</span><strong className="text-slate-900">{comparator} {valueWithUnit(row.meta, unit)}</strong></p>
      <p className="flex justify-between gap-5 text-slate-600"><span>Resultado</span><strong style={{ color: NAVY }}>{valueWithUnit(row.resultado, unit)}</strong></p>
      <p className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${inTarget ? 'bg-green-50 text-green-700' : moderate ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{inTarget ? 'En meta' : moderate ? 'Desviación ≤ 20%' : 'Desviación crítica'}</p>
    </div>
  </div>;
}

function MeasurementDot({ cx, cy, payload, comparison, indicator }) {
  if (payload?.resultado == null || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const status = deviationAssessment(payload.resultado, payload.meta ?? indicator.target, payload.comparator || indicator.comparator).status;
  const color = comparison ? NAVY : status === 'en_meta' ? '#16a34a' : status === 'desviacion_moderada' ? '#f59e0b' : '#dc2626';
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />;
}

function EndLabel({ x, y, index, lastIndex, text, color, offset = -10 }) {
  if (index !== lastIndex || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <text x={x + 12} y={y + offset} fill={color} fontSize={12} fontWeight={600}>{text}</text>;
}

function ValueLabel({ x, y, value, unit, color = NAVY, offset = -14 }) {
  if (value == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <text className="hidden sm:block" x={x} y={y + offset} textAnchor="middle" fill={color} fontSize={11} fontWeight={600}>{valueWithUnit(value, unit)}</text>;
}

export default function MeasurementChart({ indicator, reports, year: controlledYear, showYearFilter = true, headerAction }) {
  const calendarYear = String(new Date().getFullYear());
  const [localYear, setYear] = useState(calendarYear);
  const [comparison, setComparison] = useState(false);
  const year = controlledYear == null ? localYear : String(controlledYear);
  const comparisonYear = year || calendarYear;
  const previousYear = String(Number(comparisonYear) - 1);
  const gradientId = `measurement-area-${useId().replace(/:/g, '')}`;
  const yearInputId = `measurement-year-${useId().replace(/:/g, '')}`;
  const years = useMemo(() => [...new Set([calendarYear, ...reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean)])].sort((a, b) => Number(b) - Number(a)), [reports, calendarYear]);
  const [history, setHistory] = useState([]);
  useEffect(() => { setComparison(false); }, [indicator.id]);
  useEffect(() => {
    let active = true;
    setHistory([]);
    if (!supabase) return () => { active = false; };
    supabase.from('indicator_target_history').select('*').eq('indicator_id', indicator.id).order('created_at').then(({ data }) => { if (active) setHistory(data || []); });
    return () => { active = false; };
  }, [indicator.id]);
  const selectedReports = year ? reports.filter(report => parseReportPeriod(report.period)?.year === year) : reports;
  const resolvedReports = selectedReports.map(report => {
    const recordedAt = report.created_at || report.registered_date || report.date;
    const nextChange = report.measurement_target == null && recordedAt && history.find(change => new Date(change.created_at) > new Date(recordedAt));
    return { ...report, measurement_target: report.measurement_target ?? (nextChange ? nextChange.target : indicator.target), measurement_comparator: report.measurement_comparator || (nextChange && nextChange.comparator) || indicator.comparator };
  });
  const trendData = measurementSeries(resolvedReports).map(row => ({ ...row, ...deviationAssessment(row.resultado, row.meta, row.comparator) }));
  const comparedData = historicalComparisonSeries(reports, comparisonYear);
  const data = comparison ? comparedData : trendData;
  const hasCurrent = data.some(row => row.resultado != null);
  const hasPrevious = comparison && data.some(row => row.previous != null);
  const ticks = measurementTicks(data, comparison ? 0 : indicator.target);
  const lastCurrentIndex = data.findLastIndex(row => row.resultado != null);
  const lastPreviousIndex = comparison ? data.findLastIndex(row => row.previous != null) : -1;
  const lastTargetIndex = data.findLastIndex(row => row.meta != null);
  const unit = displayUnit(indicator.unit);
  const currentDot = props => <MeasurementDot {...props} comparison={comparison} indicator={indicator} />;
  const controlStyle = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50';
  return <section aria-label={`Gráfica de medición de ${indicator.name}`}>
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-slate-900">{comparison ? 'Gráfica de Comparativa' : 'Tendencia Histórica'}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {showYearFilter && !comparison && <select id={yearInputId} aria-label="Año de tendencia histórica" value={year} onChange={event => setYear(event.target.value)} className={controlStyle}>
          {years.map(value => <option key={value} value={value}>{value}</option>)}<option value="">Todos los años</option>
        </select>}
        <button type="button" aria-pressed={comparison} onClick={() => setComparison(!comparison)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${comparison ? 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800' : 'border-slate-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50'}`}><BarChart3 className="h-4 w-4" />Comparativa</button>
        {comparison && <button type="button" onClick={() => setComparison(false)} className={controlStyle}>Volver a tendencia</button>}
        {headerAction}
      </div>
    </header>
    {!hasCurrent && !hasPrevious ? <p className="rounded-xl border border-slate-100 bg-slate-50 py-16 text-center text-sm text-slate-500">{comparison ? `Sin mediciones registradas para ${comparisonYear} ni ${previousYear}.` : year ? `Sin mediciones registradas en ${year}.` : 'Sin mediciones registradas.'}</p> : <>
      <div className="h-[23rem] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-white p-2 sm:p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 30, right: 116, left: 0, bottom: 16 }} accessibilityLayer>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315c8c" stopOpacity={0.42} /><stop offset="100%" stopColor="#315c8c" stopOpacity={0.08} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" padding={{ left: 18, right: 12 }} tickMargin={12} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={value => comparison || !year ? value : value.split(' ')[0].slice(0, 3)} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis ticks={ticks} interval={0} domain={[ticks[0], ticks[ticks.length - 1]]} width={60} tickMargin={8} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={value => `${formatValue(value)}${unit === '%' ? '%' : ''}`} axisLine={false} tickLine={false} />
            <Tooltip filterNull={false} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} content={<MeasurementTooltip unit={unit} defaultComparator={indicator.comparator} comparison={comparison} year={comparisonYear} />} />
            <Area type="linear" dataKey="resultado" name={comparison ? comparisonYear : 'Medición'} stroke={NAVY} strokeWidth={2.5} fill={`url(#${gradientId})`} baseValue={0} dot={currentDot} activeDot={currentDot} connectNulls={false} isAnimationActive={false}>
              <LabelList dataKey="resultado" content={props => <ValueLabel {...props} unit={unit} />} />
              {comparison && <LabelList dataKey="resultado" content={props => <EndLabel {...props} lastIndex={lastCurrentIndex} text={comparisonYear} color={NAVY} />} />}
            </Area>
            {comparison ? <Line type="linear" dataKey="previous" name={previousYear} stroke={PREVIOUS} strokeWidth={2} dot={{ r: 4, fill: PREVIOUS, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5, fill: PREVIOUS }} connectNulls={false} isAnimationActive={false}>
              <LabelList dataKey="previous" content={props => <ValueLabel {...props} unit={unit} color="#7c8798" offset={18} />} />
              <LabelList dataKey="previous" content={props => <EndLabel {...props} lastIndex={lastPreviousIndex} text={previousYear} color="#7c8798" offset={20} />} />
            </Line> : <>
              <Line type="stepAfter" dataKey="meta" name="Meta" stroke={NAVY} strokeDasharray="6 4" strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false}>
                <LabelList dataKey="meta" content={props => <EndLabel {...props} lastIndex={lastTargetIndex} text={`Meta · ${valueWithUnit(data[lastTargetIndex]?.meta, unit)}`} color={NAVY} />} />
              </Line>
            </>}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!comparison && <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: NAVY }} />Medición</span>
        <span className="flex items-center gap-2"><i className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: NAVY }} />Meta</span>
      </div>}
      {comparison && (!hasCurrent || !hasPrevious) && <p className="mt-3 text-xs text-slate-500">Sin mediciones de {hasCurrent ? previousYear : comparisonYear}; se muestran únicamente los valores disponibles.</p>}
    </>}
  </section>;
}
