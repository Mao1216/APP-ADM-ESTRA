// Datos locales de prueba. Este archivo no es entrada del build de producción.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import BioIndicatorsView from '../src/BioIndicatorsView';
import ChangeRequestsView from '../src/ChangeRequestsView';
import { supabase } from '../src/lib/supabase';

const objectives = [{ id: 1, code: 'OBJ-26001', name: 'Incrementar la productividad' }];
const indicators = [{ id: 1, code: 'IND-26001', name: 'Productividad', objectiveId: 1, target: 90, comparator: '>=', unit: '%', formula: 'Producción real / producción planificada', frequency: 'Mensual', created_at: '2026-09-30T19:00:00Z' }];
const reports = [{ id: 1, indicatorId: 1, period: 'Enero,2026', result: 82, status: 'Fuera de meta', measurement_target: 90 }, { id: 2, indicatorId: 1, period: 'Febrero,2026', result: 95, status: 'En meta', measurement_target: 90 }];
const requests = [{ id: 1, indicator_id: 1, kind: 'target', status: 'Pendiente', previous: { target: 90, comparator: '>=' }, proposed: { target: 95, comparator: '>=' }, reason: 'Actualizar la meta del indicador para el siguiente periodo.', created_at: '2026-10-06T15:00:00Z' }, { id: 2, indicator_id: 1, kind: 'report', status: 'Rechazado', previous: { result: 82 }, proposed: { result: 88 }, reason: 'Corrección solicitada para la medición de enero.', created_at: '2026-10-05T15:00:00Z', reviewed_at: '2026-10-06T15:00:00Z' }];
supabase.from = () => ({ select: () => ({ order: async () => ({ data: requests, error: null }) }) });
function Preview() { const [view, setView] = React.useState('indicators'); return <main className="min-h-screen bg-slate-50 p-4 sm:p-8 max-w-7xl mx-auto"><nav className="flex gap-4 mb-6"><button onClick={() => setView('indicators')}>Probar Indicadores</button><button onClick={() => setView('requests')}>Probar Solicitudes</button></nav>{view === 'indicators' ? <BioIndicatorsView objectives={objectives} indicators={indicators} reports={reports} /> : <ChangeRequestsView isGcg={false} indicators={indicators} onReload={async () => {}} onError={() => {}} />}</main>; }
createRoot(document.getElementById('root')).render(<Preview />);
