export function personName(identity, people = []) {
  const key = String(identity || '').trim().toLowerCase();
  if (!key) return 'Sin asignar';
  if (key === 'sig@biomont.com.pe') return 'SIG';
  const person = people.find(row => [row.id, row.email].some(value => String(value || '').trim().toLowerCase() === key));
  return person?.full_name || person?.name || 'Responsable asignado';
}

export function fiveWhyAnswers(values) {
  if (!Array.isArray(values) || !String(values[0] || '').trim() || !String(values[1] || '').trim()) return null;
  return values.slice(0, 5).map(value => String(value || '').trim()).filter(Boolean);
}
