import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import BioIndicatorsView from '../src/BioIndicatorsView';
import AssignedIndicatorPortfolio from '../src/IndicatorPortfolio';

const objectives = [{ id: 1, name: 'Incrementar los ingresos de la empresa' }, { id: 2, name: 'Mejorar la eficiencia operativa' }];
const users = [{ id: 'manuel', name: 'Manuel Olin' }, { id: 'john', name: 'John Cardenas' }];
const indicators = ['Rentabilidad financiera', 'Productividad de la planta', 'Cumplimiento de ventas', 'Rechazos de documentos', 'Disponibilidad de equipos', 'Satisfacción del cliente'].map((name, index) => ({ id: index + 1, code: `IND-2600${index + 1}`, name, objectiveId: index % 2 + 1, ownerId: index % 2 ? 'manuel' : 'john', target: 90, comparator: '>=', unit: '%', frequency: 'Mensual', formula: 'Resultado / total' }));
const reports = indicators.flatMap(indicator => ['Agosto', 'Septiembre', 'Octubre'].map((month, index) => ({ id: indicator.id * 10 + index, indicatorId: indicator.id, period: `${month},2026`, result: indicator.id === 6 ? null : (indicator.id % 3 === 0 ? 78 : 93) + index, status: indicator.id === 6 ? 'Sin datos' : indicator.id % 3 === 0 ? 'Fuera de meta' : 'En meta', measurement_target: 90, measurement_comparator: '>=' })));
function Preview() {
  const [view, setView] = useState('portfolio');
  const [filters, setFilters] = useState({ search: '', objectiveId: '', responsibleId: '', indicatorId: '' });
  return <div className="min-h-screen bg-slate-50"><aside className="fixed inset-y-0 left-0 hidden w-56 bg-slate-900 p-6 text-white md:block"><h2 className="text-xl font-bold">BIOMET</h2><div className="mt-12 space-y-4 text-sm"><button className="block" onClick={() => setView('portfolio')}>Indicadores</button><button className="block" onClick={() => setView('assigned')}>Estatus IND</button></div></aside><main className="p-6 md:ml-56 md:p-8"><nav className="mb-6 flex gap-4 text-sm"><button onClick={() => setView('portfolio')}>Portafolio</button><button onClick={() => setView('assigned')}>Asignados</button></nav>{view === 'portfolio' ? <BioIndicatorsView objectives={objectives} indicators={indicators} reports={reports} users={users} filters={filters} onChange={setFilters} /> : <AssignedIndicatorPortfolio indicators={indicators} objectives={objectives} reports={reports} users={users} onSelect={item => { setFilters({ ...filters, indicatorId: String(item.id) }); setView('portfolio'); }} />}</main></div>;
}
createRoot(document.getElementById('root')).render(<Preview />);
