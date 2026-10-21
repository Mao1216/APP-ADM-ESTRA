import { parseReportPeriod } from './reporting.js';

export function reportedProgress(indicators, reports) {
  const reportedIds = new Set(reports.map(report => String(report.indicatorId)));
  const reported = indicators.filter(indicator => reportedIds.has(String(indicator.id))).length;
  return { reported, total: indicators.length, progress: indicators.length ? Math.round(reported * 100 / indicators.length) : 0 };
}

export function measurementSeries(reports) {
  return [...reports].sort((a, b) => (parseReportPeriod(a.period)?.order || 0) - (parseReportPeriod(b.period)?.order || 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')) || Number(a.id) - Number(b.id))
    .map(report => ({ period: report.period.replace(',', ' '), resultado: report.result == null || report.status === 'Sin datos' ? null : Number(report.result), meta: report.measurement_target == null ? null : Number(report.measurement_target), comparator: report.measurement_comparator || null }));
}

export function measurementTicks(data, target) {
  const values = [Number(target), ...data.flatMap(row => Object.values(row).filter(value => typeof value === 'number'))].filter(value => value !== null && Number.isFinite(value));
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const rawStep = (high - low) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= rawStep) * magnitude;
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  return Array.from({ length: Math.round((end - start) / step) + 1 }, (_, index) => Number((start + index * step).toPrecision(12)));
}

const MONTH_ABBREVIATIONS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function weightedMeasurementValue(reports, year, referenceYear = new Date().getFullYear()) {
  const rows = reports
    .map(report => ({ report, period: parseReportPeriod(report.period) }))
    .filter(item => item.period && (!year || item.period.year === String(year)) && item.report.result != null && item.report.status !== 'Sin datos' && Number.isFinite(Number(item.report.result)))
    .sort((a, b) => a.period.order - b.period.order);
  if (!rows.length) return { value: null, label: 'Valor ponderado', count: 0 };

  const value = rows.reduce((sum, item) => sum + Number(item.report.result), 0) / rows.length;
  const firstMonth = rows[0].period.order % 12;
  const lastMonth = rows.at(-1).period.order % 12;
  const measuredYear = Number(rows[0].period.year);
  const completeYear = new Set(rows.map(item => item.period.order % 12)).size === 12;
  const label = completeYear && measuredYear < referenceYear
    ? `Valor del año ${measuredYear}`
    : `Valor ponderado ${MONTH_ABBREVIATIONS[firstMonth]} - ${MONTH_ABBREVIATIONS[lastMonth]} ${measuredYear}`;
  return { value, label, count: rows.length };
}

const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function weightedIndicatorSummary(indicator, reports, year = '') {
  const activeYear = String(year || reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean).sort((a, b) => Number(b) - Number(a))[0] || '');
  const weighted = weightedMeasurementValue(reports, activeYear);
  const value = weighted.value;
  const target = Number(indicator?.target);
  const comparisons = {
    '>': value > target, '>=': value >= target, '=': value === target,
    '<=': value <= target, '<': value < target,
  };
  return {
    ...weighted, year: activeYear,
    display: value === null ? '—' : Number(value.toFixed(2)),
    status: value === null || !Number.isFinite(target) ? null : comparisons[indicator?.comparator] ? 'En meta' : 'Fuera de meta',
  };
}

export function filterIndicators(indicators, { search = '', objectiveId = '', responsibleId = '', status = '' }) {
  const query = normalizeSearch(search);
  return indicators.filter(indicator => {
    const searchable = normalizeSearch(`${indicator.code || ''} ${indicator.name || ''}`);
    const responsible = indicator.ownerId || indicator.owner_email || indicator.reporter_email || '';
    return searchable.includes(query)
      && (!objectiveId || String(indicator.objectiveId) === String(objectiveId))
      && (!responsibleId || String(responsible) === String(responsibleId))
      && (!status || indicator.status === (status === 'No reportado' ? 'Sin reporte' : status));
  });
}

export function creationYear(entity) {
  return entity.created_at ? new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric' }).format(new Date(entity.created_at)) : '';
}
