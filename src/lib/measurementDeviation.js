export function compareMeasurement(value, target, comparator) {
  const result = Number(value);
  const goal = Number(target);
  if (!Number.isFinite(result) || !Number.isFinite(goal)) return false;
  return ({ '>': result > goal, '>=': result >= goal, '=': result === goal, '<=': result <= goal, '<': result < goal })[comparator] || false;
}

export function deviationAssessment(value, target, comparator) {
  const result = Number(value);
  const goal = Number(target);
  if (!Number.isFinite(goal)) return { status: 'sin_dato', critical: null, criticalLower: null, criticalUpper: null };
  const allowance = Math.abs(goal) * 0.2;
  if (['<', '<='].includes(comparator)) {
    const critical = goal + allowance;
    if (!Number.isFinite(result)) return { status: 'sin_dato', critical, criticalLower: null, criticalUpper: critical };
    if (compareMeasurement(result, goal, comparator)) return { status: 'en_meta', critical, criticalLower: null, criticalUpper: critical };
    return { status: result <= critical ? 'desviacion_moderada' : 'desviacion_critica', critical, criticalLower: null, criticalUpper: critical };
  }
  if (['>', '>='].includes(comparator)) {
    const critical = goal - allowance;
    if (!Number.isFinite(result)) return { status: 'sin_dato', critical, criticalLower: critical, criticalUpper: null };
    if (compareMeasurement(result, goal, comparator)) return { status: 'en_meta', critical, criticalLower: critical, criticalUpper: null };
    return { status: result >= critical ? 'desviacion_moderada' : 'desviacion_critica', critical, criticalLower: critical, criticalUpper: null };
  }
  const criticalLower = goal - allowance;
  const criticalUpper = goal + allowance;
  if (!Number.isFinite(result)) return { status: 'sin_dato', critical: null, criticalLower, criticalUpper };
  if (compareMeasurement(result, goal, comparator)) return { status: 'en_meta', critical: null, criticalLower, criticalUpper };
  return { status: result >= criticalLower && result <= criticalUpper ? 'desviacion_moderada' : 'desviacion_critica', critical: null, criticalLower, criticalUpper };
}
