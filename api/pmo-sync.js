import { createClient } from '@supabase/supabase-js';

const PFMS_PROJECTS_URL = 'https://pmo-biomont.vercel.app/api/externo/proyectos-estrategicos';
const send = (response, status, body) => response.status(status).json(body);

function canRunSync(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.authorization === `Bearer ${secret}`);
}

async function isGcgRequest(request, supabase) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return false;
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const email = userData?.user?.email?.trim().toLowerCase();
  if (userError || !email) return false;
  const { data: assignment, error: roleError } = await supabase.from('role_assignments').select('role').eq('email', email).maybeSingle();
  return !roleError && assignment?.role === 'gcg';
}

function toCatalogProject(project, generatedAt) {
  const progress = Number(project?.avance);
  if (!project?.codigo || !project?.nombre || !Number.isFinite(progress) || progress < 0 || progress > 100) return null;
  return {
    code: String(project.codigo).trim(), name: String(project.nombre).trim(),
    description: String(project.alcance || 'Sin alcance registrado.').trim(),
    responsible_name: String(project.sponsor || 'Sin responsable asignado').trim(),
    status: String(project.estado?.nombre || project.estado?.codigo || 'Pendiente').trim(),
    source_status_code: String(project.estado?.codigo || '').trim() || null,
    progress: Math.round(progress * 100) / 100, end_date: project.fecha_termino || null,
    project_url: project.enlace || null, is_demo: false, source: 'pfms',
    updated_at: generatedAt || new Date().toISOString(),
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) { response.setHeader('Allow', 'GET, POST'); return send(response, 405, { error: 'Método no permitido.' }); }
  const apiKey = process.env.PFMS_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceRoleKey) return send(response, 503, { error: 'Falta una configuración privada de la sincronización.' });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // GET lo invoca Vercel Cron; POST lo solicita una sesión GCG autenticada.
  if (request.method === 'GET' ? !canRunSync(request) : !(await isGcgRequest(request, supabase))) return send(response, 401, { error: 'No autorizado.' });

  try {
    const upstream = await fetch(PFMS_PROJECTS_URL, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'User-Agent': 'BIOMET/1.0 (PMO project synchronization)' } });
    if (!upstream.ok) return send(response, 502, { error: `La API de PMO respondió con ${upstream.status}.` });
    const payload = await upstream.json();
    if (!Array.isArray(payload?.proyectos)) return send(response, 502, { error: 'La API de PMO devolvió un formato no reconocido.' });

    const rows = payload.proyectos.map(project => toCatalogProject(project, payload.generado_en)).filter(Boolean);
    if (rows.length !== payload.proyectos.length) return send(response, 502, { error: 'La API de PMO contiene uno o más proyectos inválidos.' });

    const { error } = await supabase.from('pmo_project_catalog').upsert(rows, { onConflict: 'code' });
    if (error) throw error;
    return send(response, 200, { synchronized: rows.length, generated_at: payload.generado_en || null });
  } catch (error) {
    console.error('PMO synchronization failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return send(response, 500, { error: 'No se pudo sincronizar el catálogo de PMO.' });
  }
}
