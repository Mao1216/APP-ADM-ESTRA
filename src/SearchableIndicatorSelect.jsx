import React, { useId, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { filterIndicators } from './lib/indicatorViews';

export default function SearchableIndicatorSelect({ indicators, value, onChange }) {
  const listId = useId();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = indicators.find(item => String(item.id) === String(value));
  const label = item => `${item.code ? `${item.code} · ` : ''}${item.name}`;
  const options = filterIndicators(indicators, { search: query });
  const choose = item => { setOpen(false); setQuery(''); onChange(String(item.id)); };
  const openList = () => { setQuery(''); setActive(0); setOpen(true); };
  const keyboard = event => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { openList(); return; }
      setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    }
    if (event.key === 'Enter' && open) { event.preventDefault(); if (options[active]) choose(options[active]); }
  };
  return <div className="min-w-0 text-sm font-medium text-slate-700">
    <label htmlFor={`${listId}-input`}>Indicador</label>
    <div className="relative mt-1" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input ref={inputRef} id={`${listId}-input`} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && options[active] ? `${listId}-${options[active].id}` : undefined} autoComplete="off" placeholder="Buscar y seleccionar…" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={open ? query : selected ? label(selected) : ''} onFocus={openList} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={keyboard} />
      <button type="button" aria-label="Mostrar opciones de indicador" aria-expanded={open} className="absolute inset-y-0 right-0 px-2 text-slate-500 hover:text-blue-700" onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { inputRef.current?.focus(); openList(); } }}><ChevronDown className="h-4 w-4" /></button>
      {open && <div id={listId} role="listbox" aria-label="Opciones de indicadores" className="absolute left-0 top-full z-[70] mt-1 max-h-64 w-[min(26rem,80vw)] min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{options.map((item, index) => <button key={item.id} id={`${listId}-${item.id}`} type="button" role="option" aria-selected={String(item.id) === String(value)} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-normal leading-5 ${active === index ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}><span className="break-words">{label(item)}</span>{String(item.id) === String(value) && <Check className="h-4 w-4 shrink-0 text-blue-700" />}</button>)}{!options.length && <p className="px-3 py-4 text-xs font-normal text-slate-500">No hay indicadores que coincidan.</p>}</div>}
    </div>
    <p aria-live="polite" className="mt-1 text-xs font-normal text-slate-500">{options.length} indicador{options.length === 1 ? '' : 'es'} disponible{options.length === 1 ? '' : 's'}</p>
  </div>;
}
