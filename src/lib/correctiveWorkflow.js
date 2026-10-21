import { parseReportPeriod } from './reporting.js';

export const EMPTY_CORRECTIVE_DATA = { analyses: [], actions: [], tasks: [], evidence: [], events: [] };
export const sameId = (a, b) => a != null && b != null && String(a) === String(b);
export function latestMeasurement(reports, indicatorId) {
  return reports.filter(report => sameId(report.indicatorId, indicatorId)).sort((a, b) => (parseReportPeriod(b.period)?.order ?? -1) - (parseReportPeriod(a.period)?.order ?? -1) || String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id))[0];
}
export function attentionIndicators(indicators, reports, analyses) {
  return indicators.flatMap(indicator => {
    const report = latestMeasurement(reports, indicator.id);
    if (report?.status !== 'Fuera de meta') return [];
    const analysis = analyses.find(item => sameId(item.report_id, report.id));
    return [{ indicator, report, analysis, label: analysis ? 'Con análisis de causa' : 'Sin análisis de causa' }];
  });
}
export function taskEditable(task, analysis) {
  return Boolean(analysis);
}
export function validateEvidence(file) {
  if (!file || file.size < 1 || file.size > 20 * 1024 * 1024) throw new Error('Cada evidencia debe pesar entre 1 byte y 20 MB.');
  return file;
}
