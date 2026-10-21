import React from 'react';
import { Filter } from 'lucide-react';
export default function FilterPanel({ label = 'Filtros', children }) {
  return <details className="mb-4 rounded-lg border border-slate-200 bg-white p-2">
    <summary aria-label={label} title={label} className="flex w-fit cursor-pointer list-none items-center rounded-lg p-2 text-slate-600 hover:bg-slate-50"><Filter size={18} /><span className="sr-only">{label}</span></summary>
    <div className="p-2 space-y-4">{children}</div>
  </details>;
}
