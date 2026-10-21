export const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function parseReportPeriod(value) {
  const parts = String(value || '').toLowerCase().replace(',', ' ').trim().split(/\s+/);
  const month = parts[0]?.replace('setiembre', 'septiembre');
  const monthIndex = MONTHS.findIndex(item => item.toLowerCase() === month);
  if (parts.length !== 2 || monthIndex < 0 || !/^\d{4}$/.test(parts[1])) return null;
  return { month, year: parts[1], order: Number(parts[1]) * 12 + monthIndex };
}

export function comparisonData(reports, { indicatorId, year = '', month = '' }) {
  return reports.map(report => ({ report, period: parseReportPeriod(report.period) }))
    .filter(item => item.period && String(item.report.indicatorId) === String(indicatorId) && (!year || item.period.year === year) && (!month || item.period.month === month))
    .sort((a, b) => a.period.order - b.period.order)
    .map(({ report }) => ({ period: report.period.replace(',', ' '), resultado: report.status === 'Sin datos' ? null : report.result }));
}
