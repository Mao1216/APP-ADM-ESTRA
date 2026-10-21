export function displayUnit(unit) {
  const value = String(unit || '').trim();
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'numero' ? '' : value;
}
