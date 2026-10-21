// Clasificación de una medición frente a su meta.
// Para metas máximas (<= / <), el cumplimiento crece cuando el resultado baja.
export function measurementComplianceBand(result, target, comparator) {
  const actual = Number(result);
  const goal = Number(target);
  if (!Number.isFinite(actual) || !Number.isFinite(goal) || goal <= 0) return { percent: null, band: null };

  const raw = ['<=', '<'].includes(comparator)
    ? 100 + ((goal - actual) / goal) * 100
    : (actual / goal) * 100;
  const percent = Math.max(0, Math.round(raw));
  if (percent <= 80) return { percent, band: 'pesimista' };
  if (percent <= 100) return { percent, band: 'optimista' };
  return { percent, band: 'excepcional' };
}

export function complianceMark(result, target, comparator, band) {
  return measurementComplianceBand(result, target, comparator).band === band ? 'X' : '';
}
