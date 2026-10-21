import React from 'react';
import { rankedObjectives } from './lib/objectiveViews';

export default function ObjectiveProgressList({ objectives }) {
  const rows = rankedObjectives(objectives);
  if (!rows.length) return <p className="h-80 flex items-center justify-center text-sm text-slate-500">No hay objetivos registrados.</p>;
  return <div role="region" aria-label="Avance por objetivo, ordenado de mayor a menor" tabIndex={0} className="h-80 overflow-y-auto pr-3" style={{ scrollbarGutter: 'stable' }}>
    {rows.map(objective => <div key={objective.id} className="border-b border-slate-100 py-4 last:border-b-0">
      <h3 className="mb-2.5 break-words text-sm font-semibold leading-5 text-slate-800">{objective.name}</h3>
      <div className="grid grid-cols-[6rem_minmax(0,1fr)_3rem] sm:grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-3">
      <span className="text-xs font-medium text-slate-500">{objective.code || 'Sin código'}</span>
      <div role="progressbar" aria-label={objective.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={objective.progress} className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-[#D71920]" style={{ width: `${objective.progress}%` }} /></div>
      <span className="text-xs text-slate-600 text-right tabular-nums">{objective.progress}%</span>
      </div>
    </div>)}
  </div>;
}
