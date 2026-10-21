const normalize = value => String(value ?? '').trim().toLowerCase();

export function supportIndicators(indicators, identities) {
  return indicators.filter(indicator => Boolean(normalize(indicator.reporter_email)) && identities.some(id => normalize(id) === normalize(indicator.reporter_email)));
}

export function accountIdentities(email, people = []) {
  const normalizedEmail = normalize(email);
  if (!normalizedEmail) return [];
  return [normalizedEmail, ...people.filter(person => normalize(person.email) === normalizedEmail).map(person => normalize(person.id))];
}

export function indicatorAccess(indicator, objective, identities, isSuperAdmin = false) {
  const matches = value => Boolean(normalize(value)) && identities.some(id => normalize(id) === normalize(value));
  const canManage = isSuperAdmin || matches(indicator.ownerId) || matches(objective?.ownerId);
  return { canManage, canReport: canManage || matches(indicator.reporter_email) };
}
