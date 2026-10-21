import { parseReportPeriod } from './reporting.js';

export function portfolioRows(indicators, reports, period = '') {
  return indicators.map(indicator => {
    const history = reports.filter(report => String(report.indicatorId) === String(indicator.id))
      .sort((a, b) => (parseReportPeriod(a.period)?.order || 0) - (parseReportPeriod(b.period)?.order || 0) || Number(a.id) - Number(b.id));
    const selected = period ? history.filter(report => parseReportPeriod(report.period)?.order === Number(period)) : history;
    const latest = selected.at(-1);
    return { indicator, history: period ? history.filter(report => (parseReportPeriod(report.period)?.order || 0) <= Number(period)) : history, latest, status: latest?.status || 'Sin reporte' };
  });
}

export function portfolioCounts(rows) {
  return {
    total: rows.length,
    inTarget: rows.filter(row => row.status === 'En meta').length,
    outOfTarget: rows.filter(row => row.status === 'Fuera de meta').length,
    noData: rows.filter(row => row.status === 'Sin datos').length,
    unreported: rows.filter(row => row.status === 'Sin reporte').length,
  };
}
