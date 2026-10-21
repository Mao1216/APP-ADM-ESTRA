import React, { useState } from 'react';
import { supabase } from './lib/supabase';

export async function loadMicrosoftDirectory() {
  const people = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('microsoft_directory')
      .select('email, microsoft_id, full_name').order('email').range(offset, offset + 999);
    if (error) return { data: [], error };
    people.push(...(data || []));
    if (!data || data.length < 1000) return { data: people, error: null };
  }
}

export default function MicrosoftDirectory({ session, onReload }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const synchronize = async () => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const token = session?.provider_token;
      if (!token) throw new Error('Vuelve a iniciar sesión con Microsoft para autorizar la lectura del directorio.');
      let next = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999';
      const people = new Map();
      const visited = new Set();
      while (next) {
        const url = new URL(next);
        if (url.origin !== 'https://graph.microsoft.com' || visited.has(next)) throw new Error('Microsoft devolvió una respuesta de paginación inválida.');
        visited.add(next);
        const response = await fetch(next, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
        if (response.status === 401) throw new Error('La autorización de Microsoft venció. Cierra sesión y vuelve a entrar.');
        if (response.status === 403) throw new Error('Microsoft no permite leer el directorio. Confirma con TI el permiso delegado User.ReadBasic.All en la aplicación usada para iniciar sesión.');
        if (response.status === 429) throw new Error('Microsoft limitó las consultas. Espera unos minutos antes de reintentar.');
        if (!response.ok) throw new Error('No se pudo consultar el directorio de Microsoft.');
        const page = await response.json();
        if (!Array.isArray(page.value)) throw new Error('La respuesta del directorio no es válida.');
        for (const user of page.value) {
          const email = String(user.mail || user.userPrincipalName || '').trim().toLowerCase();
          if (!email.includes('@') || email.includes('#ext#') || !user.displayName?.trim()) continue;
          people.set(email, { microsoft_id: user.id, email, full_name: user.displayName.trim() });
        }
        next = page['@odata.nextLink'] || '';
      }
      if (!people.size) throw new Error('Microsoft no devolvió personas con nombre y correo.');
      const { data, error: failure } = await supabase.rpc('sync_microsoft_directory', { people: [...people.values()] });
      if (failure) throw new Error(['PGRST202', '42883'].includes(failure.code) ? 'Falta activar el directorio en Supabase con la migración 030.' : failure.message);
      await onReload();
      setNotice(`Directorio actualizado: ${data} personas. Sus accesos y roles se mantienen independientes.`);
    } catch (failure) {
      setError(failure.name === 'TimeoutError' ? 'Microsoft tardó demasiado en responder. Vuelve a intentarlo.' : failure.message);
    } finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold text-slate-900">Directorio de Microsoft</h2><p className="mt-2 text-sm leading-6 text-slate-500">Importa nombres y correos corporativos para buscar responsables. La sincronización no concede acceso a Gestión Estratégica ni asigna roles.</p><button type="button" disabled={busy} onClick={synchronize} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Sincronizando…' : 'Sincronizar directorio'}</button>{notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</section>;
}
