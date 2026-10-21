import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { EMPTY_CORRECTIVE_DATA } from './lib/correctiveWorkflow';

const tables = { analyses: 'cause_analyses', actions: 'corrective_actions', tasks: 'corrective_tasks', evidence: 'corrective_evidence', events: 'corrective_events' };
export default function useCorrectiveWorkflow(userId) {
  const [data, setData] = useState(EMPTY_CORRECTIVE_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const account = useRef(userId); account.current = userId;
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (!supabase || !userId) return;
    const request = ++sequence.current;
    const isCurrent = () => account.current === userId && request === sequence.current;
    setLoading(true);
    try {
      const results = await Promise.all(Object.entries(tables).map(async ([key, table]) => ({ key, ...await supabase.from(table).select('*').order('created_at', { ascending: false }) })));
      const failure = results.find(result => result.error)?.error;
      if (failure) throw failure;
      if (!isCurrent()) return;
      setData(Object.fromEntries(results.map(result => [result.key, result.data || []])));
      setError('');
    } catch (failure) {
      if (!isCurrent()) return;
      setError(['42P01','PGRST205'].includes(failure.code) ? 'El módulo de acciones correctivas requiere aplicar la migración 008 en Supabase.' : `No se pudieron cargar los análisis: ${failure.message}`);
    } finally { if (isCurrent()) setLoading(false); }
  }, [userId]);
  useEffect(() => { setData(EMPTY_CORRECTIVE_DATA); setError(''); setLoading(false); if (userId) reload(); return () => { sequence.current += 1; }; }, [userId, reload]);
  return { ...data, loading, error, reload };
}
