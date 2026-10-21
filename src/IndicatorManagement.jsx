import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FilePenLine, History, X } from 'lucide-react';
import { IndicatorControls } from './Governance';
import { IndicatorRequestFlyout } from './ChangeRequestsView';

export default function IndicatorManagement({ indicator, reports, users, session, onReload, onError, onNotify }) {
  const [view, setView] = useState('');
  return <><div className="mb-4 flex flex-wrap justify-end gap-2"><button onClick={() => setView('edit')} className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"><FilePenLine className="h-4 w-4" />Realizar modificación</button><button onClick={() => setView('history')} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><History className="h-4 w-4" />Historial</button></div>
    {view === 'edit' && createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-label="Realizar modificación"><section className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"><header className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-semibold text-blue-700">{indicator.code}</p><h2 className="mt-1 text-xl font-bold">Realizar modificación</h2></div><button aria-label="Cerrar formulario" onClick={() => setView('')} className="p-2"><X className="h-5 w-5" /></button></header><div className="p-5"><IndicatorControls requestOnly indicator={indicator} reports={reports} users={users} session={session} isGcg canManage onReload={onReload} onError={onError} onNotify={message => { onNotify(message); setView(''); }} /></div></section></div>, document.body)}
    {view === 'history' && <IndicatorRequestFlyout directHistory history indicatorId={indicator.id} indicators={[indicator]} reports={reports} users={users} onClose={() => setView('')} onViewHistory={null} />}
  </>;
}
