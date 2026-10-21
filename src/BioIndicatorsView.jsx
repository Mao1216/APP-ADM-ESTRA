import { displayUnit } from './lib/units';
import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { AttentionPanel, IndicatorPortfolioCard, PortfolioSummary, PortfolioStatus } from './IndicatorPortfolio';
import { portfolioRows } from './lib/indicatorPortfolio';
import MeasurementChart from './MeasurementChart';
import { filterIndicators, weightedIndicatorSummary } from './lib/indicatorViews';
import { parseReportPeriod } from './lib/reporting';
import { personName } from './lib/personNames';
import { complianceMark, measurementComplianceBand } from './lib/complianceBand';
import IndicatorManagement from './IndicatorManagement';
import SearchableIndicatorSelect from './SearchableIndicatorSelect';
import { AnalysisHistoryButton, ActionsHistoryButton } from './CorrectiveWorkflow';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function IndicatorFilterMenu({ objectives, indicators, reports = [], isGcg = false, users = [], sites = [], assignments = [], filters, onChange }) {
  const statusIndicators = portfolioRows(indicators, reports).map(row => ({ ...row.indicator, status: row.status }));
  const responsibles = [...new Map(indicators.map(item => {
    const id = item.ownerId || item.owner_email || item.reporter_email || '';
    return id ? [String(id), personName(id, users)] : null;
  }).filter(Boolean))].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const apply = next => {
    const matches = filterIndicators(statusIndicators, next);
    const selectedStillMatches = matches.some(item => String(item.id) === String(next.indicatorId));
    onChange({ ...next, indicatorId: selectedStillMatches ? next.indicatorId : '' });
  };
  const change = key => event => apply({ ...filters, [key]: event.target.value });
  const matches = filterIndicators(statusIndicators, { ...filters, search: '' });
  return <details className="relative ml-auto shrink-0">
    <summary aria-label="Filtros de indicadores" title="Filtros de indicadores" className="flex cursor-pointer list-none items-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"><Filter className="h-5 w-5" /><span className="sr-only">Filtros de indicadores</span></summary>
    <div className="absolute right-0 top-full z-[60] mt-2 w-[min(92vw,48rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Filtros de indicadores</p>{(filters.search || filters.objectiveId || filters.responsibleId || filters.siteId || filters.status || filters.indicatorId) && <button type="button" className="text-sm font-medium text-blue-700" onClick={() => onChange({ search: '', objectiveId: '', responsibleId: '', siteId: '', indicatorId: '' })}>Limpiar</button>}</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SearchableIndicatorSelect indicators={matches} value={filters.indicatorId} onChange={indicatorId => onChange({ ...filters, search: '', indicatorId })} />
        <label className="text-sm font-medium text-slate-700">Objetivo<select className={input} value={filters.objectiveId} onChange={change('objectiveId')}><option value="">Todos los objetivos</option>{objectives.map(item => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Responsable<select className={input} value={filters.responsibleId} onChange={change('responsibleId')}><option value="">Todos los responsables</option>{responsibles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {isGcg && <label className="text-sm font-medium text-slate-700">Sede<select aria-label="Filtrar por sede" className={input} value={filters.siteId || ''} onChange={change('siteId')}><option value="">Todas las sedes</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
      </div>
      {isGcg && <label className="mt-4 block text-sm font-medium text-slate-700">Estatus<select aria-label="Estatus de indicadores" className={input} value={filters.status || ''} onChange={change('status')}><option value="">Todos los estatus</option>{['Fuera de meta', 'No reportado', 'En meta', 'Sin datos'].map(status => <option key={status}>{status}</option>)}</select></label>}
    </div>
  </details>;
}

export function IndicatorYearFilter({ reports, year, onChange }) {
  const years = [...new Set([String(new Date().getFullYear()), ...reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean)])].sort((a, b) => Number(b) - Number(a));
  return <details className="relative ml-auto shrink-0"><summary aria-label="Filtrar indicador por año" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><Filter className="h-5 w-5" /></summary><div className="absolute right-0 top-full z-[60] mt-2 w-56 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><label className="block text-sm font-semibold text-slate-700">Año<select aria-label="Año del indicador" className={input} value={year} onChange={event => onChange(event.target.value)}><option value="">Todos los años</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></details>;
}

function SimpleMeasurementHistory({ rows, indicator }) {
  const condition = row => {
    if (row.result == null) return 'Sin datos';
    const band = measurementComplianceBand(row.result, indicator.target, indicator.comparator).band;
    return ({ pesimista: 'Pesimista', optimista: 'Optimista', excepcional: 'Excepcional' })[band] || 'Sin condición';
  };
  return <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden"><div className="p-5 border-b"><h3 className="font-semibold">Historial de mediciones · modelo simple</h3><p className="mt-1 text-xs text-slate-500">La condición consolida el estándar de cumplimiento de cada medición.</p></div><div className="overflow-x-auto"><table className="w-full text-center text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Periodo</th><th className="p-3">Resultado</th><th className="p-3">Condición</th><th className="p-3">Estado</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.period}</td><td className="p-3 font-medium">{row.result == null ? 'Sin datos' : row.result + ' ' + displayUnit(indicator.unit)}</td><td className="p-3">{condition(row)}</td><td className="p-3"><div className="flex justify-center"><PortfolioStatus status={row.status} /></div></td></tr>)}{!rows.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Sin mediciones.</td></tr>}</tbody></table></div></section>;
}

export default function BioIndicatorsView({ objectives, indicators, reports, users = [], sites = [], assignments = [], filters, onChange, year = '', isGcg = false, workflow, session, onReload, onError, onNotify }) {
  const [historyMode, setHistoryMode] = useState('detail');
  const scopedIndicatorIds = filters.siteId ? new Set(assignments.filter(assignment => String(assignment.site_id) === String(filters.siteId) && assignment.active).map(assignment => String(assignment.indicator_id))) : null;
  const availableIndicators = scopedIndicatorIds ? indicators.filter(indicator => scopedIndicatorIds.has(String(indicator.id))) : indicators;
  const list = filterIndicators(portfolioRows(availableIndicators, reports).map(row => ({ ...row.indicator, status: row.status })), filters);
  const indicator = list.find(item => String(item.id) === String(filters.indicatorId));
  const objective = objectives.find(item => item.id === indicator?.objectiveId);
  const rows = reports.filter(report => report.indicatorId === indicator?.id && (!filters.siteId || assignments.some(assignment => String(assignment.id) === String(report.assignmentId) && String(assignment.site_id) === String(filters.siteId))) && (!year || parseReportPeriod(report.period)?.year === year)).sort((a, b) => (parseReportPeriod(b.period)?.order || 0) - (parseReportPeriod(a.period)?.order || 0) || Number(b.id) - Number(a.id));
  const latest = rows[0];
  const weighted = weightedIndicatorSummary(indicator, rows, year);
  const siteAssignments = assignments.filter(assignment => String(assignment.indicator_id) === String(indicator?.id) && assignment.active);
  const latestByAssignment = siteAssignments.map(assignment => ({ assignment, report: reports.filter(report => String(report.assignmentId) === String(assignment.id) && (!year || parseReportPeriod(report.period)?.year === year)).sort((a, b) => (parseReportPeriod(b.period)?.order || 0) - (parseReportPeriod(a.period)?.order || 0))[0] })).filter(item => item.report?.result !== null && item.report?.result !== undefined);
  const totalWeight = latestByAssignment.reduce((sum, item) => sum + Number(item.assignment.weight || 1), 0);
  const globalWeighted = totalWeight ? latestByAssignment.reduce((sum, item) => sum + Number(item.report.result) * Number(item.assignment.weight || 1), 0) / totalWeight : null;
  const portfolio = portfolioRows(list, reports);
  const select = item => onChange({ ...filters, indicatorId: String(item.id) });
  return <div className="fade-in space-y-6">
    <header><p className="text-xs font-medium text-slate-500">Reportería / Indicadores general</p><h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-2">Indicadores general</h1><p className="text-sm text-slate-500 mt-2">Seguimiento integral del portafolio</p></header>
    {!indicator && <PortfolioSummary rows={portfolio} />}
    {!list.length && <p className="rounded-xl bg-white border p-8 text-center text-slate-500">No hay indicadores que coincidan con estos filtros.</p>}
    {indicator ? <div className="space-y-6">
      {isGcg && <IndicatorManagement indicator={indicator} reports={reports.filter(report => report.indicatorId === indicator.id)} users={users} session={session} onReload={onReload} onError={onError} onNotify={onNotify} />}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-6">
        <div><p className="text-sm text-slate-500">{objective?.code} · {objective?.name}</p><p className="text-xs font-semibold text-blue-700 mt-4">{indicator.code}</p><h2 className="text-2xl font-bold text-slate-900 mt-1">{indicator.name}</h2><p className="text-slate-500 mt-3 break-words">Fórmula: {indicator.formula || '—'}</p><p className="text-sm text-slate-500 mt-2">Frecuencia: {indicator.frequency}</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center"><p className="text-sm text-slate-500">Última medición · {latest?.period || 'Sin reporte'}</p><p className="text-4xl font-bold text-slate-900 mt-3">{latest?.status === 'Sin datos' ? 'Sin datos' : latest?.result ?? '—'} <span className="text-xl">{displayUnit(indicator.unit)}</span></p><div className="mt-3 flex justify-center"><PortfolioStatus status={latest?.status || 'Sin reporte'} /></div><p className="text-xs text-slate-500 mt-3">Meta actual: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)}</p></div>
          <div aria-label="Valor ponderado del indicador" className="rounded-xl border border-slate-200 border-t-4 border-t-blue-500 bg-white p-5 text-center shadow-sm"><p className="text-sm font-medium text-slate-500">Valor ponderado{weighted.year ? ` ${weighted.year}` : ''}</p><p className="mt-3 text-4xl font-bold text-slate-900">{weighted.display} <span className="text-xl font-normal text-slate-500">{weighted.value !== null ? displayUnit(indicator.unit) : ''}</span></p>{weighted.status && <div className="mt-3 flex justify-center"><PortfolioStatus status={weighted.status} /></div>}<p className="mt-3 text-xs text-slate-400">{weighted.count ? `${weighted.count} medición${weighted.count === 1 ? '' : 'es'}` : 'Sin mediciones con datos'}</p></div>
        </div>
      </section>
      {isGcg && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm font-semibold text-blue-900">Ponderación global por sede</p><p className="mt-1 text-sm text-blue-800">Consolida la última medición reportada de cada sede según su ponderación.</p><p className="mt-3 text-3xl font-bold text-blue-950">{globalWeighted === null ? '—' : Number(globalWeighted.toFixed(2))} <span className="text-lg font-normal">{globalWeighted === null ? '' : displayUnit(indicator.unit)}</span></p><p className="mt-2 text-xs text-blue-700">{latestByAssignment.length} de {siteAssignments.length} sede(s) con datos · Ponderación total: {totalWeight || 0}</p></section>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6"><MeasurementChart indicator={indicator} reports={reports.filter(report => String(report.indicatorId) === String(indicator.id))} year={year} showYearFilter={false} /></section>
      <div className="flex justify-end"><button type="button" onClick={() => setHistoryMode(value => value === 'detail' ? 'simple' : 'detail')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{historyMode === 'detail' ? 'Ver modelo simple' : 'Ver modelo detallado'}</button></div>
      {historyMode === 'detail' && <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden"><h3 className="p-5 border-b font-semibold">Historial de mediciones</h3><div className="overflow-x-auto"><table className="w-full table-fixed text-center text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="w-[14%] p-3 text-center">Periodo</th><th className="w-[14%] p-3 text-center">Resultado</th><th className="w-[12%] p-3 text-center">Pesimista</th><th className="w-[12%] p-3 text-center">Optimista</th><th className="w-[12%] p-3 text-center">Excepcional</th><th className="w-[14%] p-3 text-center">Estado</th>{isGcg && workflow && <><th className="w-[11%] p-3 text-center">Análisis de causa</th><th className="w-[7%] p-3 text-center">Acciones</th></>}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.period}</td><td className="p-3 font-medium">{row.result == null ? 'Sin datos' : row.result + ' ' + displayUnit(indicator.unit)}</td><td className="p-3 font-bold text-red-700">{complianceMark(row.result, indicator.target, indicator.comparator, 'pesimista')}</td><td className="p-3 font-bold text-amber-700">{complianceMark(row.result, indicator.target, indicator.comparator, 'optimista')}</td><td className="p-3 font-bold text-green-700">{complianceMark(row.result, indicator.target, indicator.comparator, 'excepcional')}</td><td className="p-3"><div className="flex justify-center"><PortfolioStatus status={row.status} /></div></td>{isGcg && workflow && <><td className="p-3"><div className="flex justify-center"><AnalysisHistoryButton report={row} indicator={indicator} objective={objective} workflow={workflow} users={users} canManage={false} /></div></td><td className="p-3"><div className="flex justify-center"><ActionsHistoryButton report={row} workflow={workflow} users={users} canManage={false} /></div></td></>}</tr>)}{!rows.length && <tr><td colSpan={isGcg && workflow ? 8 : 6} className="p-8 text-center text-slate-500">Sin mediciones.</td></tr>}</tbody></table></div></section>}
      {historyMode === 'simple' && <SimpleMeasurementHistory rows={rows} indicator={indicator} />}
    </div> : list.length > 0 && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]"><div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{portfolio.map(row => <IndicatorPortfolioCard key={row.indicator.id} row={row} objective={objectives.find(item => item.id === row.indicator.objectiveId)} users={users} onSelect={select} />)}</div><AttentionPanel rows={portfolio} objectives={objectives} onSelect={select} /></div>}
  </div>;
}
