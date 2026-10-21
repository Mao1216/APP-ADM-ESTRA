import { MONTHS, parseReportPeriod } from './reporting.js';

export function comparisonLines(reports, filtersA, filtersB) {
  const alignMonths = Boolean(filtersA.year && filtersB.year);
  const rows = new Map();
  const latest = [...reports].sort((a, b) => String(a.created_at || a.registered_date || '').localeCompare(String(b.created_at || b.registered_date || '')) || Number(a.id || 0) - Number(b.id || 0));
  for (const [key, filters] of [['a', filtersA], ['b', filtersB]]) {
    if (!filters.indicatorId) continue;
    for (const report of latest) {
      const period = parseReportPeriod(report.period);
      if (!period || String(report.indicatorId) !== String(filters.indicatorId) || (filters.year && period.year !== filters.year)) continue;
      if (Array.isArray(filters.months) ? !filters.months.includes(period.month) : filters.month && period.month !== filters.month) continue;
      const monthIndex = MONTHS.findIndex(month => month.toLowerCase() === period.month);
      const order = alignMonths ? monthIndex : period.order;
      const row = rows.get(order) || { order, period: alignMonths ? MONTHS[monthIndex] : `${MONTHS[monthIndex]} ${period.year}`, a: null, b: null };
      row[key] = report.result == null || report.status === 'Sin datos' ? null : Number(report.result);
      row[`${key}Period`] = report.period.replace(',', ' ');
      rows.set(order, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.order - b.order);
}
