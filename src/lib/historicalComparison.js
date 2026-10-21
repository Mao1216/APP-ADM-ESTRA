import { MONTHS, parseReportPeriod } from './reporting.js';

// Each month has its own slot. Missing reports never become zero or shift years.
export function historicalComparisonSeries(reports, year) {
  const currentYear = String(year);
  const previousYear = String(Number(year) - 1);
  const byPeriod = new Map();
  const sorted = [...reports].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    Number(a.id || 0) - Number(b.id || 0));
  for (const report of sorted) {
    const period = parseReportPeriod(report.period);
    if (!period || ![currentYear, previousYear].includes(period.year)) continue;
    const value = report.result == null || report.status === 'Sin datos' || !Number.isFinite(Number(report.result))
      ? null : Number(report.result);
    byPeriod.set(period.order, value);
  }
  return MONTHS.map((month, index) => ({
    period: month.slice(0, 3),
    monthName: month,
    resultado: byPeriod.get(Number(currentYear) * 12 + index) ?? null,
    previous: byPeriod.get(Number(previousYear) * 12 + index) ?? null,
  }));
}
