export function requestStatus(status) { return status === 'Pendiente' ? 'En revisión' : status; }

export function requestGroups(requests, history) {
  return requests.filter(request => history ? ['Aprobado', 'Rechazado'].includes(request.status) : request.status === 'Pendiente');
}

export function requestPeriod(request, reports = []) {
  return request.proposed?.period || request.previous?.period || reports.find(report => String(report.id) === String(request.report_id))?.period || '';
}
