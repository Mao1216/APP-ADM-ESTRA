import { displayUnit } from './lib/units';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, Target, FolderKanban, Settings, User, Plus, 
  ChevronRight, AlertCircle, CheckCircle2, Clock, ArrowRight, ArrowLeft, BarChart3, Calendar, Users, Activity, LogOut, FilePenLine, History, Trash2, Star
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import biomontLogo from './assets/biomont-logo.png';
import strategicLoginHero from './assets/strategic-login-hero.png';
import kunturLogo from './assets/kuntur-pharma-logo.png';

const APP_TITLE = 'Gestión Estratégica';
import { supabase } from './lib/supabase';
import { observeAuthentication } from './lib/authLifecycle';
import { accountIdentities, indicatorAccess } from './lib/responsibility';
import { IndicatorControls, AssignedIndicators } from './Governance';
import ChangeRequests, { IndicatorRequestFlyout } from './ChangeRequestsView';
import MeasurementChart from './MeasurementChart';
import { reportedProgress, weightedMeasurementValue } from './lib/indicatorViews';
import { activeObjectives, objectiveActivityStatus, withLinkedProjectProgress } from './lib/objectiveViews';
import ObjectiveStatusControl from './ObjectiveStatusControl';
import BioIndicatorsView, { IndicatorFilterMenu, IndicatorYearFilter } from './BioIndicatorsView';
import ObjectiveProgressList from './ObjectiveProgressList';
import StrategicMap from './StrategicMap';
import StrategicActions from './StrategicActions';
import PmoProjects from './PmoProjects';
import MicrosoftDirectory, { loadMicrosoftDirectory } from './MicrosoftDirectory';
import UserWorkspace from './UserWorkspace';
import CoreIndicators from './CoreIndicators';
import useCorrectiveWorkflow from './useCorrectiveWorkflow';
import { AnalysisHistoryButton, ActionsHistoryButton } from './CorrectiveWorkflow';
import { attentionIndicators } from './lib/correctiveWorkflow';
import { personName } from './lib/personNames';
import { complianceMark, measurementComplianceBand } from './lib/complianceBand';

const ROLE_LABELS = {
  usuario: 'Usuario',
  gerente_responsable: 'Gerente responsable',
  gcg: 'GCG',
  super_admin: 'Super admin',
};

const toObjective = (row) => ({ ...row, ownerId: row.owner_email, createdDate: row.created_date, targetDate: row.target_date, validityStartYear: row.validity_start_year, validityEndYear: row.validity_end_year, focus: row.focus });
const toProject = (row) => ({ ...row, objectiveId: row.objective_id, ownerId: row.owner_email });
const toAction = (row) => ({ ...row, objectiveId: row.objective_id, projectId: row.project_id, dueDate: row.due_date, completedAt: row.completed_at, ownerId: row.owner_email });
const toIndicator = (row) => ({ ...row, objectiveId: row.objective_id, ownerId: row.owner_email, approvalStatus: row.approval_status, reviewFrequency: row.review_frequency, target: Number(row.target) });
const toReport = (row) => ({ ...row, indicatorId: row.indicator_id, assignmentId: row.site_assignment_id, date: row.registered_date, result: row.result == null ? null : Number(row.result), obs: row.observations });

// La aplicación inicia sin datos operativos. Los usuarios registrados crean los
// objetivos, acciones, indicadores y reportes reales desde BIOMET.
const INITIAL_OBJECTIVES = [];
const INITIAL_PROJECTS = [];
const INITIAL_TASKS = [];
const INITIAL_INDICATORS = [];
const INITIAL_REPORTS = [];

const calculateIndicatorStatus = (result, target, comparator) => {
  const res = parseFloat(result);
  const tgt = parseFloat(target);
  let isSuccess = false;
  switch (comparator) {
    case '>': isSuccess = res > tgt; break;
    case '>=': isSuccess = res >= tgt; break;
    case '=': isSuccess = res === tgt; break;
    case '<=': isSuccess = res <= tgt; break;
    case '<': isSuccess = res < tgt; break;
    default: isSuccess = false;
  }
  return isSuccess ? 'En meta' : 'Fuera de meta'; 
};

const getStatusColor = (status) => {
  switch(status?.toLowerCase()) {
    case 'cumplido':
    case 'completado': return 'bg-green-100 text-green-700 border-green-200';
    case 'sin datos':
    case 'en meta': return 'bg-green-100 text-green-700 border-green-200';
    case 'en riesgo': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'fuera de meta': return 'bg-red-100 text-red-700 border-red-200';
    case 'no cumplido': 
    case 'retrasado': return 'bg-red-100 text-red-700 border-red-200';
    case 'en progreso': return 'bg-blue-50 text-blue-700 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getStatusIcon = (status, className="w-4 h-4") => {
  switch(status?.toLowerCase()) {
    case 'cumplido': return <CheckCircle2 className={`${className} text-green-600`} />;
    case 'sin datos':
    case 'en meta': return <CheckCircle2 className={`${className} text-green-600`} />;
    case 'en riesgo': return <AlertCircle className={`${className} text-yellow-600`} />;
    case 'fuera de meta': return <AlertCircle className={`${className} text-red-600`} />;
    case 'en progreso': return <Activity className={`${className} text-blue-600`} />;
    default: return <Clock className={`${className} text-slate-400`} />;
  }
};

const Card = ({ children, className = "", onClick = null }) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : ''} ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, status }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 w-fit ${getStatusColor(status)}`}>
    {getStatusIcon(status, "w-3 h-3")}
    {children}
  </span>
);

const Button = ({ children, variant = 'primary', className = "", ...props }) => {
  const variants = {
    primary: "bg-[#1D4ED8] hover:bg-[#1e40af] text-white shadow-sm",
    secondary: "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600"
  };
  return (
    <button className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ label, className = "", ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
    <input className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-shadow text-sm text-slate-900" {...props} />
  </div>
);

const Select = ({ label, options, className = "", ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
    <select className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-shadow text-sm text-slate-900" {...props}>
      <option value="">Seleccionar...</option>
      {options.map((opt, i) => (
        <option key={i} value={opt.value || opt}>{opt.label || opt}</option>
      ))}
    </select>
  </div>
);

const SearchablePeopleSelect = ({ label, options, value, onChange, multiple = false, required = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedIds = multiple ? value : (value ? [value] : []);
  const selected = options.filter(person => selectedIds.includes(person.id));
  const filtered = options.filter(person => person.name.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id) => {
    if (multiple) onChange(selectedIds.includes(id) ? selectedIds.filter(item => item !== id) : [...selectedIds, id]);
    else { onChange(id); setOpen(false); setQuery(''); }
  };
  return <div className="flex flex-col gap-1.5 relative"><label className="text-sm font-medium text-slate-700">{label}{required ? ' *' : ''}</label><button type="button" onClick={() => setOpen(!open)} className="min-h-10 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-left flex items-center justify-between gap-3"><span className={selected.length ? 'text-slate-900' : 'text-slate-400'}>{multiple ? (selected.length ? `${selected.length} persona${selected.length > 1 ? 's' : ''} seleccionada${selected.length > 1 ? 's' : ''}` : 'Seleccionar personas...') : (selected[0]?.name || 'Seleccionar...')}</span><ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} /></button>{multiple && selected.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1">{selected.map(person => <span key={person.id} className="px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700">{person.name}</span>)}</div>}{open && <div className="absolute z-30 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2"><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar persona..." className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]" /><div className="max-h-48 overflow-y-auto mt-2">{filtered.length ? filtered.map(person => <button type="button" key={person.id} onClick={() => toggle(person.id)} className="w-full px-3 py-2 text-left rounded-md hover:bg-slate-50 flex items-center justify-between gap-3"><span><span className="block text-sm font-medium text-slate-800">{person.name}</span><span className="block text-xs text-slate-500">{ROLE_LABELS[person.role] || person.role}</span></span>{selectedIds.includes(person.id) && <CheckCircle2 className="w-4 h-4 text-[#1D4ED8]" />}</button>) : <p className="px-3 py-4 text-sm text-slate-500">No se encontraron personas.</p>}</div></div>}</div>;
};

const monthOrder = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
const reportPeriodTime = (report) => {
  const [month = '', year = '0'] = String(report.period || '').toLowerCase().replace(',', ' ').trim().split(/\s+/);
  const monthIndex = monthOrder[month];
  if (Number.isInteger(monthIndex) && /^\d{4}$/.test(year)) return new Date(Number(year), monthIndex, 1).getTime();
  return new Date(report.date || report.registered_date || 0).getTime();
};
const sortReportsByPeriod = (items, direction = 'asc') => [...items].sort((a, b) => direction === 'asc' ? reportPeriodTime(a) - reportPeriodTime(b) : reportPeriodTime(b) - reportPeriodTime(a));

const ProgressBar = ({ progress, status }) => {
  let color = 'bg-[#3B82F6]';
  if (status === 'Cumplido' || status === 'En meta') color = 'bg-green-500';
  if (status === 'Fuera de meta') color = 'bg-red-500';
  if (status === 'En riesgo') color = 'bg-yellow-500';
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${progress}%` }}></div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [bscVisible, setBscVisible] = useState(true);
  const [navHistory, setNavHistory] = useState([{ id: 'dashboard', name: 'Monitor' }]);
  
  const [objectives, setObjectives] = useState(INITIAL_OBJECTIVES);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [indicators, setIndicators] = useState(INITIAL_INDICATORS);
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [profiles, setProfiles] = useState([]);
  const [organizationPeople, setOrganizationPeople] = useState([]);
  const [sites, setSites] = useState([]);
  const [siteAssignments, setSiteAssignments] = useState([]);
  const [microsoftPeople, setMicrosoftPeople] = useState([]);
  const [dashboardMessages, setDashboardMessages] = useState([]);
  const [coreIndicatorRows, setCoreIndicatorRows] = useState([]);
  
  const [selectedObjectiveId, setSelectedObjectiveId] = useState(null);
  const [selectedObjectiveTab, setSelectedObjectiveTab] = useState('summary');
  const [objectiveStatusFilter, setObjectiveStatusFilter] = useState('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(null);
  const [indicatorRequestFlyout, setIndicatorRequestFlyout] = useState(null);
  const [indicatorRequestForm, setIndicatorRequestForm] = useState(false);
  const [indicatorFilters, setIndicatorFilters] = useState({ search: '', objectiveId: '', responsibleId: '', siteId: '', indicatorId: '' });
  const [bioIndicatorYear, setBioIndicatorYear] = useState(String(new Date().getFullYear()));
  const changeIndicatorFilters = next => {
    if (next.indicatorId !== indicatorFilters.indicatorId) setBioIndicatorYear(String(new Date().getFullYear()));
    setIndicatorFilters(next);
  };
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [portfolioFilter, setPortfolioFilter] = useState(null);
  const [generalObjectiveFilter, setGeneralObjectiveFilter] = useState('Todos');
  const [selectedRole, setSelectedRole] = useState(null);
  const [session, setSession] = useState(null);
  const corrective = useCorrectiveWorkflow(session?.user?.id);
  useEffect(() => {
    if (['indicator-detail', 'objectives', 'bio-indicators'].includes(currentView)) corrective.reload();
  }, [currentView, corrective.reload]);
  const [assignedRole, setAssignedRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [dataError, setDataError] = useState('');
  const [notification, setNotification] = useState(null);
  const notify = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    window.setTimeout(() => setNotification(current => current?.message === message ? null : current), 3800);
  };
  const isGeneralManager = false;
  const isResponsibleManager = selectedRole?.name === 'Gerente responsable';
  const isGcg = selectedRole?.name === 'GCG';
  const isSuperAdmin = assignedRole === 'super_admin';
  const availableUsers = [
    ...organizationPeople.map(person => ({ id: person.id, email: person.email, name: microsoftPeople.find(item => item.email === person.email?.toLowerCase())?.full_name || person.full_name, role: person.role, avatar: person.full_name.slice(0, 2).toUpperCase() })),
    ...microsoftPeople.filter(person => !organizationPeople.some(item => item.email?.toLowerCase() === person.email)).map(person => ({ id: person.email, email: person.email, name: person.full_name, role: profiles.find(item => item.email?.toLowerCase() === person.email)?.role || 'directory', avatar: person.full_name.slice(0, 2).toUpperCase() })),
    ...profiles.filter(profile => !organizationPeople.some(person => person.email && person.email === profile.email) && !microsoftPeople.some(person => person.email === profile.email?.toLowerCase())).map(profile => ({
    id: profile.email,
    name: profile.email,
    role: profile.role,
    avatar: profile.email.slice(0, 2).toUpperCase(),
    })),
  ];
  const MOCK_USERS = availableUsers;
  const currentAccountIds = accountIdentities(session?.user?.email, organizationPeople);
  const signedInEmail = session?.user?.email?.trim().toLowerCase();
  const isKunturAccount = /@kunturpharma\.pe$/i.test(signedInEmail || '');
  const signedInPerson = organizationPeople.find(person => person.email?.trim().toLowerCase() === signedInEmail)
    || microsoftPeople.find(person => person.email?.trim().toLowerCase() === signedInEmail);
  const signedInName = signedInPerson?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Usuario';
  const personalizedMessage = dashboardMessages.find(message => String(message.recipient_email || '').trim().toLowerCase() === String(session?.user?.email || '').trim().toLowerCase())?.message?.trim();
  const dashboardIntroduction = personalizedMessage || 'Aquí está el resumen estratégico de tu organización.';
  const accountOwns = value => currentAccountIds.some(id => String(id).trim().toLowerCase() === String(value ?? '').trim().toLowerCase());
  const isManagerScoped = isResponsibleManager && !isSuperAdmin;
  const objectivesWithProjectProgress = withLinkedProjectProgress(objectives, projects);
  const scopedObjectives = isManagerScoped ? objectivesWithProjectProgress.filter(objective => accountOwns(objective.ownerId)) : objectivesWithProjectProgress;
  const managerAssignments = siteAssignments.filter(assignment => assignment.active && accountOwns(assignment.responsible_email));
  const scopedIndicators = isManagerScoped
    ? indicators.filter(indicator => {
      const assignments = siteAssignments.filter(item => String(item.indicator_id) === String(indicator.id) && item.active);
      return assignments.length
        ? managerAssignments.some(item => String(item.indicator_id) === String(indicator.id))
        : indicatorAccess(indicator, objectivesWithProjectProgress.find(objective => objective.id === indicator.objectiveId), currentAccountIds).canReport;
    })
    : indicators;
  const scopedProjects = isManagerScoped
    ? projects.filter(project => scopedObjectives.some(objective => objective.id === project.objectiveId))
    : projects;
  const scopedTasks = isManagerScoped
    ? tasks.filter(task => scopedObjectives.some(objective => objective.id === task.objectiveId))
    : tasks;
  const scopedReports = isManagerScoped
    ? reports.filter(report => report.assignmentId
      ? managerAssignments.some(assignment => String(assignment.id) === String(report.assignmentId))
      : scopedIndicators.some(indicator => indicator.id === report.indicatorId))
    : reports;

  const loadOperationalData = async () => {
    if (!supabase) return;
    const [profilesResult, peopleResult, objectivesResult, projectsResult, actionsResult, indicatorsResult, reportsResult, messagesResult, catalogResult, directoryResult, sitesResult, assignmentsResult, coreResult] = await Promise.all([
      supabase.from('profiles').select('email, role').order('email'),
      supabase.from('organization_people').select('id, full_name, email, role').eq('active', true).order('full_name'),
      supabase.from('objectives').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('strategic_actions').select('*').order('created_at', { ascending: false }),
      supabase.from('indicators').select('*').order('created_at', { ascending: false }),
      supabase.from('indicator_reports').select('*').order('registered_date', { ascending: true }),
      supabase.from('dashboard_messages').select('recipient_email, message, updated_at').order('updated_at', { ascending: false }),
      supabase.from('pmo_project_catalog').select('*'),
      loadMicrosoftDirectory(),
      supabase.from('sites').select('*').eq('active', true).order('name'),
      supabase.from('indicator_site_assignments').select('*').eq('active', true),
      supabase.from('core_indicators').select('*').order('position'),
    ]);
    const firstError = [profilesResult, peopleResult, objectivesResult, projectsResult, actionsResult, indicatorsResult, reportsResult].find(result => result.error)?.error;
    if (firstError) {
      setDataError('La estructura de datos de Supabase aún no está disponible. Ejecuta la migración 002_operational_data.sql.');
      return;
    }
    setProfiles(profilesResult.data || []);
    setOrganizationPeople(peopleResult.data || []);
    setMicrosoftPeople(directoryResult.data || []);
    setObjectives((objectivesResult.data || []).map(toObjective));
    setProjects((projectsResult.data || []).map(row => {
      const catalog = (catalogResult.data || []).find(item => item.id === row.catalog_id);
      return toProject(catalog ? { ...row, ...catalog, id: row.id, catalog_id: catalog.id } : row);
    }));
    setTasks((actionsResult.data || []).map(toAction));
    setIndicators((indicatorsResult.data || []).map(toIndicator));
    setReports((reportsResult.data || []).map(toReport));
    setSites(sitesResult.data || []);
    setSiteAssignments(assignmentsResult.data || []);
    setCoreIndicatorRows(coreResult.data || []);
    setDashboardMessages(messagesResult.data || []);
    setDataError('');
    await corrective.reload();
  };

  useEffect(() => {
    if (!supabase) {
      setAuthError('Falta configurar la conexión con Supabase.');
      setAuthLoading(false);
      return undefined;
    }

    const resetAuthentication = () => {
      setSession(null);
      setAssignedRole(null);
      setSelectedRole(null);
      setCurrentView('dashboard');
      setNavHistory([{ id: 'dashboard', name: 'Monitor' }]);
      setAuthLoading(false);
    };

    const loadAssignedRole = async (activeSession, isCurrent) => {
      if (!activeSession?.user) {
        resetAuthentication();
        return;
      }

      const email = activeSession.user.email?.trim().toLowerCase();
      if (!email) {
        if (isCurrent()) {
          setSession(activeSession);
          setAuthError('Microsoft no devolvió un correo para esta cuenta.');
          setAuthLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('role_assignments')
        .select('role')
        .eq('email', email)
        .maybeSingle();

      if (!isCurrent()) return;
      setSession(activeSession);
      if (error) {
        setAuthError('No se pudo verificar tu rol. Reintenta sin cerrar la sesión.');
      } else if (!data?.role || !['gcg', 'gerente_responsable', 'super_admin', 'usuario', 'gerente_general'].includes(data.role)) {
        setAssignedRole(null);
        setSelectedRole(null);
        setAuthError(`Tu correo corporativo no tiene un rol asignado en ${APP_TITLE}. Contacta al administrador.`);
      } else {
        setAuthError('');
        const role = data.role === 'gerente_general' ? 'gcg' : data.role;
        setAssignedRole(role);
        setSelectedRole(role === 'super_admin' ? null : { key: role, name: ROLE_LABELS[role] });
        await loadOperationalData();
      }
      setAuthLoading(false);
    };

    return observeAuthentication(supabase.auth, {
      onAccount: loadAssignedRole,
      onRefresh: activeSession => setSession(activeSession),
      onSignedOut: resetAuthentication,
      onError: () => {
        setAuthError('No se pudo verificar la sesión. Recarga para reintentar.');
        setAuthLoading(false);
      },
    });
  }, []);

  const signInWithMicrosoft = async () => {
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: window.location.origin, scopes: 'email https://graph.microsoft.com/User.ReadBasic.All' },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setCurrentView('dashboard');
    setNavHistory([{ id: 'dashboard', name: 'Monitor' }]);
  };

  const navigateTo = (view, name, params = {}) => {
    setIndicatorRequestFlyout(null);
    setIndicatorRequestForm(false);
    if ((['new-objective', 'new-indicator', 'edit-indicator', 'gcg-review', 'core-indicators'].includes(view) && !isGcg)
      || (['edit-target', 'report-indicator', 'indicator-status'].includes(view) && !isResponsibleManager)
      || (['new-project', 'edit-action', 'link-project'].includes(view) && !isGcg)) return;
    setCurrentView(view);
    if (view === 'new-indicator' && !params.objectiveId) setSelectedObjectiveId(null);
    if (params.objectiveId) setSelectedObjectiveId(params.objectiveId);
    if (params.objectiveTab) setSelectedObjectiveTab(params.objectiveTab);
    else if (view === 'objective-detail') setSelectedObjectiveTab('summary');
    if (params.indicatorId) setSelectedIndicatorId(params.indicatorId);
    if (params.actionId) setSelectedActionId(params.actionId);
    if (['dashboard', 'objectives', 'gcg-review', 'indicator-status', 'settings'].includes(view)) {
      setNavHistory([{ id: view, name }]);
    } else {
      let newHistory = [...navHistory];
      if (newHistory.length > 3) newHistory = [newHistory[0]];
      newHistory.push({ id: view, name, ...params });
      setNavHistory(newHistory);
    }
  };

  const restoreHistory = (index) => {
    const destination = navHistory[index];
    setCurrentView(destination.id);
    if (destination.objectiveId) setSelectedObjectiveId(destination.objectiveId);
    setSelectedObjectiveTab(destination.objectiveTab || 'summary');
    if (destination.indicatorId) setSelectedIndicatorId(destination.indicatorId);
    if (destination.actionId) setSelectedActionId(destination.actionId);
    setNavHistory(navHistory.slice(0, index + 1));
  };

  const goBack = () => {
    if (currentView === 'bio-indicators' && indicatorFilters.indicatorId) {
      changeIndicatorFilters({ ...indicatorFilters, indicatorId: '' });
      return;
    }
    if (navHistory.length > 1) restoreHistory(navHistory.length - 2);
  };

  const MonitorView = () => {
    const activeObjectiveCount = activeObjectives(scopedObjectives).length;
    const fulfilled = scopedObjectives.filter(o => o.status === 'Cumplido').length;
    const atRisk = scopedObjectives.filter(o => o.status === 'En riesgo').length;
    const indicatorsInTarget = scopedIndicators.filter(indicator => indicator.status === 'En meta').length;
    const indicatorsOutOfTarget = scopedIndicators.filter(indicator => indicator.status === 'Fuera de meta').length;
    const overdueIndicators = scopedIndicators.filter(indicator => !scopedReports.some(report => report.indicatorId === indicator.id)).length;
    const averageProgress = scopedObjectives.length ? Math.round(scopedObjectives.reduce((total, objective) => total + objective.progress, 0) / scopedObjectives.length) : 0;
    const indicatorReporting = reportedProgress(scopedIndicators, scopedReports);
    const indicatorProgress = indicatorReporting.progress;
    const projectsProgress = scopedProjects.length
      ? Math.round(scopedProjects.reduce((total, project) => total + Number(project.progress || 0), 0) / scopedProjects.length)
      : 0;
    const criticalIndicators = scopedIndicators
      .map(indicator => {
        const hasReport = scopedReports.some(report => report.indicatorId === indicator.id);
        const status = hasReport ? indicator.status : 'Vencido';
        return { ...indicator, criticalStatus: status };
      })
      .filter(indicator => indicator.criticalStatus === 'Vencido' || indicator.criticalStatus === 'Fuera de meta');
    const distribution = [
      { name: 'Cumplidos', value: fulfilled, color: '#16a34a' },
      { name: 'En progreso', value: scopedObjectives.filter(o => o.status === 'En progreso').length, color: '#2563eb' },
      { name: 'En riesgo', value: atRisk, color: '#f59e0b' }
    ].filter(item => item.value > 0);
    const isBehindSchedule = (objective) => {
      const start = new Date(objective.createdDate || new Date().toISOString().split('T')[0]);
      const end = new Date(objective.targetDate);
      const now = new Date();
      const expected = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
      return objective.status === 'En riesgo' || objective.progress + 10 < expected;
    };
    const alerts = scopedObjectives.filter(isBehindSchedule).filter(objective => !portfolioFilter || objective.status === portfolioFilter);
    const perspectives = ['Todos', ...new Set(scopedObjectives.map(objective => objective.category))];
    const generalObjectives = scopedObjectives.filter(objective => generalObjectiveFilter === 'Todos' || objective.category === generalObjectiveFilter);

    return (
      <div className="space-y-6 fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#D71920] uppercase tracking-[0.16em]">{APP_TITLE}</p>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mt-1">Gestión Estratégica</h1>
            <p className="text-slate-500 mt-1">Vista ejecutiva del avance de los objetivos de Biomont.</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-slate-600 shadow-sm"><Calendar className="w-4 h-4 text-[#D71920]" /> Periodo: 2026</div>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isGeneralManager ? 'xl:grid-cols-2' : 'xl:grid-cols-4'} gap-4`}>
          {(isResponsibleManager || isGcg) ? <>
            <Card className="p-5 border-l-4 border-l-[#D71920]"><p className="text-sm font-medium text-slate-500">Indicadores activos</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{scopedIndicators.length}</h3><Activity className="w-6 h-6 text-[#D71920]" /></div><div className="border-t border-slate-100 pt-3 mt-3"><p className="text-sm text-slate-600">Avance de indicadores <span className="font-semibold text-slate-900">{indicatorProgress}%</span></p><p className="text-xs text-slate-500 mt-1">{indicatorReporting.reported} de {indicatorReporting.total} indicadores con medición</p><ProgressBar progress={indicatorProgress} status="En progreso" /></div></Card>
            <Card className="p-5 border-l-4 border-l-blue-600"><p className="text-sm font-medium text-slate-500">Proyectos registrados</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{scopedProjects.length}</h3><FolderKanban className="w-6 h-6 text-blue-600" /></div><div className="border-t border-slate-100 pt-3 mt-3"><p className="text-sm text-slate-600">Avance de proyectos <span className="font-semibold text-slate-900">{projectsProgress}%</span></p><p className="text-xs text-slate-500 mt-1">Proyectos PMO</p><ProgressBar progress={projectsProgress} status="En progreso" /></div></Card>
            <Card className="p-5 border-l-4 border-l-green-500"><p className="text-sm font-medium text-slate-500">{isGcg ? 'Objetivos activos' : 'Número de acciones'}</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{isGcg ? activeObjectiveCount : scopedTasks.length}</h3><CheckCircle2 className="w-6 h-6 text-green-600" /></div><p className="text-xs text-green-700 mt-3">{isGcg ? 'Según el estatus de los objetivos' : 'Acciones estratégicas registradas'}</p></Card>
            <Card className="p-5 border-l-4 border-l-amber-500"><p className="text-sm font-medium text-slate-500">Indicadores sin medición</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{overdueIndicators}</h3><Clock className="w-6 h-6 text-amber-500" /></div><p className="text-xs text-slate-500 mt-3">Pendientes de su primer reporte</p></Card>
          </> : <>
            <Card className="p-5 border-l-4 border-l-[#D71920]"><p className="text-sm font-medium text-slate-500">Avance estratégico</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{averageProgress}%</h3><Activity className="w-6 h-6 text-[#D71920]" /></div><p className="text-xs text-slate-500 mt-3">Promedio de objetivos activos</p></Card>
            <Card className="p-5 border-l-4 border-l-blue-600"><p className="text-sm font-medium text-slate-500">Objetivos activos</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{activeObjectiveCount}</h3><Target className="w-6 h-6 text-blue-600" /></div><p className="text-xs text-slate-500 mt-3">En seguimiento este periodo</p></Card>
            {!isGeneralManager && <Card className="p-5 border-l-4 border-l-green-500"><p className="text-sm font-medium text-slate-500">Objetivos cumplidos</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{fulfilled}</h3><CheckCircle2 className="w-6 h-6 text-green-600" /></div><p className="text-xs text-green-700 mt-3">Resultados logrados</p></Card>}
            {!isGeneralManager && <Card className="p-5 border-l-4 border-l-amber-500"><p className="text-sm font-medium text-slate-500">Alertas de riesgo</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-slate-900">{atRisk}</h3><AlertCircle className="w-6 h-6 text-amber-500" /></div><p className="text-xs text-amber-700 mt-3">Requieren atención</p></Card>}
          </>}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 p-6"><div className="flex items-center justify-between mb-6"><div><h2 className="text-lg font-bold text-slate-900">Avance por objetivo</h2><p className="text-sm text-slate-500">Progreso acumulado del plan estratégico</p></div>{!isGeneralManager && <button onClick={() => navigateTo('objectives', 'Objetivos')} className="text-sm font-semibold text-[#D71920] hover:underline">Ver objetivos</button>}</div><ObjectiveProgressList objectives={scopedObjectives} /></Card>
          {(isResponsibleManager || isGcg) ? <Card className="p-6"><div><h2 className="text-lg font-bold text-slate-900">Estado de indicadores</h2><p className="text-sm text-slate-500">Resumen de la última medición registrada.</p></div><div className="grid grid-cols-1 gap-3 mt-5"><div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-green-800">En meta</p><p className="text-xs text-green-700 mt-0.5">Reportados dentro de la meta</p></div><span className="text-2xl font-bold text-green-700">{indicatorsInTarget}</span></div><div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-red-800">Fuera de meta</p><p className="text-xs text-red-700 mt-0.5">Reportados fuera de la meta</p></div><span className="text-2xl font-bold text-red-700">{indicatorsOutOfTarget}</span></div><div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-amber-800">Vencido</p><p className="text-xs text-amber-700 mt-0.5">Aún no tienen reporte</p></div><span className="text-2xl font-bold text-amber-700">{overdueIndicators}</span></div></div></Card> : <Card className="p-6"><div className="flex items-start justify-between gap-2"><div><h2 className="text-lg font-bold text-slate-900">Estado del portafolio</h2><p className="text-sm text-slate-500">Haz clic en una categoría para filtrar las alertas.</p></div>{portfolioFilter && <button onClick={() => setPortfolioFilter(null)} className="text-xs font-semibold text-[#D71920]">Limpiar</button>}</div><div className="h-56 mt-2"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={4} cursor="pointer" onClick={(entry) => setPortfolioFilter(portfolioFilter === entry.name ? null : entry.name)}>{distribution.map(item => <Cell key={item.name} fill={item.color} opacity={!portfolioFilter || portfolioFilter === item.name ? 1 : .35} />)}</Pie><Tooltip /><Legend iconType="circle" /></PieChart></ResponsiveContainer></div></Card>}
        </div>

        {isGeneralManager ? <Card className="overflow-hidden"><div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Objetivos</h2><p className="text-sm text-slate-500">Consulta el avance de los objetivos estratégicos.</p></div><select value={generalObjectiveFilter} onChange={event => setGeneralObjectiveFilter(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white"><option value="Todos">Todas las perspectivas</option>{perspectives.slice(1).map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="divide-y divide-slate-100">{generalObjectives.map(objective => <button key={objective.id} onClick={() => navigateTo('objective-detail', objective.name, { objectiveId: objective.id })} className="w-full p-5 text-left hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1 min-w-0"><p className="font-semibold text-slate-900 break-words">{objective.name}</p><p className="text-sm text-slate-500 mt-0.5">{objective.category} · Meta: {objective.targetDate}</p></div><div className="w-full sm:w-48 shrink-0"><div className="flex justify-between text-xs text-slate-500 mb-1"><span>Avance</span><span>{objective.progress}%</span></div><ProgressBar progress={objective.progress} status={objective.status} /></div></button>)}</div></Card> : (isResponsibleManager || isGcg) ? <Card className="overflow-hidden"><div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Alertas</h2><p className="text-sm text-slate-500">Indicadores críticos: vencidos o fuera de meta.</p></div><Badge status={criticalIndicators.length ? 'Fuera de meta' : 'Cumplido'}>{criticalIndicators.length ? `${criticalIndicators.length} alertas` : 'Sin alertas'}</Badge></div><div className="divide-y divide-slate-100">{criticalIndicators.length ? criticalIndicators.map(indicator => { const objective = objectives.find(item => item.id === indicator.objectiveId); return <button key={indicator.id} onClick={() => navigateTo('indicator-detail', indicator.name, { indicatorId: indicator.id })} className="w-full p-5 text-left hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1 min-w-0"><p className="font-semibold text-slate-900 break-words">{indicator.name}</p><p className="text-sm text-slate-500 mt-0.5">Objetivo: {objective?.name || 'Sin objetivo asignado'}</p></div><div className="text-sm text-slate-500">Meta: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)}</div><Badge status={indicator.criticalStatus === 'Vencido' ? 'En riesgo' : 'Fuera de meta'}>{indicator.criticalStatus}</Badge></button>}) : <p className="p-8 text-center text-sm text-slate-500">No hay indicadores vencidos ni fuera de meta.</p>}</div></Card> : <Card className="overflow-hidden"><div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Alertas</h2><p className="text-sm text-slate-500">Objetivos con avance menor al esperado según el tiempo transcurrido.</p></div><Badge status={alerts.length ? 'En riesgo' : 'Cumplido'}>{alerts.length ? `${alerts.length} alertas` : 'Sin alertas'}</Badge></div><div className="divide-y divide-slate-100">{alerts.length ? alerts.map(objective => <button key={objective.id} onClick={() => navigateTo('objective-detail', objective.name, { objectiveId: objective.id })} className="w-full p-5 text-left hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1 min-w-0"><p className="font-semibold text-slate-900 break-words">{objective.name}</p><p className="text-sm text-slate-500 mt-0.5">Responsable: {MOCK_USERS.find(user => user.id === objective.ownerId)?.name}</p></div><div className="w-full sm:w-48 shrink-0"><div className="flex justify-between text-xs text-slate-500 mb-1"><span>Avance</span><span>{objective.progress}%</span></div><ProgressBar progress={objective.progress} status={objective.status} /></div><Badge status={objective.status}>{objective.status}</Badge></button>) : <p className="p-8 text-center text-sm text-slate-500">No hay objetivos con retraso respecto al tiempo registrado.</p>}</div></Card>}
      </div>
    );
  };

  const ObjectivesView = () => {
    const visibleObjectives = scopedObjectives.filter(objective => !objectiveStatusFilter || objectiveActivityStatus(objective) === objectiveStatusFilter);
    const changeObjectiveStatus = async (objective, status) => {
      if (!(isGcg || isResponsibleManager) || !['Activo', 'No activo'].includes(status) || !scopedObjectives.some(item => item.id === objective.id)) throw new Error('No puedes cambiar el estatus de este objetivo.');
      const { data, error } = await supabase.from('objectives').update({ status, updated_at: new Date().toISOString() }).eq('id', objective.id).select().single();
      if (error) throw new Error('No se pudo guardar el estatus. Inténtalo nuevamente.');
      setObjectives(items => items.map(item => item.id === objective.id ? toObjective(data) : item));
      notify(`Objetivo marcado como ${status.toLowerCase()}.`);
    };
    const activeObs = activeObjectives(scopedObjectives).length;
    const registeredIndicators = scopedIndicators.length;
    const measuredIndicators = reportedProgress(scopedIndicators, scopedReports).reported;
    const riskInds = attentionIndicators(scopedIndicators, scopedReports, corrective.analyses);

    return (
      <div className="space-y-8 fade-in">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Buenos días, {signedInName}</h1>
            <p className="mt-1 whitespace-pre-line text-slate-500">{dashboardIntroduction}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3"><label className="text-xs font-medium text-slate-500">Estatus de objetivos<select aria-label="Filtrar objetivos por estatus" value={objectiveStatusFilter} onChange={event => setObjectiveStatusFilter(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="">Todos los objetivos</option><option value="Activo">Activos</option><option value="No activo">No activos</option></select></label>
          {isGcg && <Button onClick={() => navigateTo('new-objective', 'Nuevo Objetivo')}>
            <Plus className="w-4 h-4" /> Nuevo Objetivo
          </Button>}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border-l-4 border-l-[#3B82F6]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Objetivos Activos</p>
                <h3 className="text-3xl font-bold text-slate-900">{activeObs}</h3>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg"><Target className="w-5 h-5 text-blue-600" /></div>
            </div>
          </Card>
          <Card className="p-5 border-l-4 border-l-yellow-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Indicadores registrados</p>
                <h3 className="text-3xl font-bold text-slate-900">{registeredIndicators}/{scopedObjectives.length}</h3>
              </div>
              <div className="p-2 bg-yellow-50 rounded-lg"><AlertCircle className="w-5 h-5 text-yellow-600" /></div>
            </div>
          </Card>
          <Card className="p-5 border-l-4 border-l-green-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Indicadores con medición</p>
                <h3 className="text-3xl font-bold text-slate-900">{measuredIndicators}</h3>
              </div>
              <div className="p-2 bg-green-50 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
            </div>
          </Card>
          <Card className="p-5 border-l-4 border-l-[#14B8A6]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Proyectos registrados</p>
                <h3 className="text-3xl font-bold text-slate-900">{scopedProjects.length}</h3>
              </div>
              <div className="p-2 bg-teal-50 rounded-lg"><FolderKanban className="w-5 h-5 text-teal-600" /></div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-[#0F172A]">Objetivos Estratégicos</h2>
              <button onClick={() => navigateTo('objectives', 'Objetivos')} className="text-sm text-[#1D4ED8] hover:underline font-medium flex items-center gap-1">
                Ver todos <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid gap-4">
              {!visibleObjectives.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No hay objetivos con este estatus.</p>}
              {visibleObjectives.map(obj => {
                const owner = availableUsers.find(u => u.id === obj.ownerId);
                const objProjects = projects.filter(p => p.objectiveId === obj.id);
                const objIndicators = indicators.filter(i => i.objectiveId === obj.id);
                
                return (
                  <Card key={obj.id} className="p-5 hover:-translate-y-0.5 transition-transform duration-200 group" onClick={() => navigateTo('objective-detail', obj.name, { objectiveId: obj.id })}>
                    <div className="flex justify-between items-start gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-blue-700 mb-1">{obj.code}</p><h3 className="break-words text-lg font-semibold text-slate-900 group-hover:text-[#1D4ED8] transition-colors">{obj.name}</h3>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-1">{obj.description}</p>
                      </div>
                      <ObjectiveStatusControl objective={obj} canEdit={isGcg || isResponsibleManager} onChange={changeObjectiveStatus} />
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-slate-700">Avance</span>
                        <span className="font-bold text-slate-900">{obj.progress}%</span>
                      </div>
                      <ProgressBar progress={obj.progress} status={obj.status} />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5" title="Proyectos"><FolderKanban className="w-4 h-4 text-slate-400" /> {objProjects.length}</div>
                        <div className="flex items-center gap-1.5" title="Indicadores"><BarChart3 className="w-4 h-4 text-slate-400" /> {objIndicators.length}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600" title={owner?.name}>{owner?.avatar}</div>
                        <span className="text-xs text-slate-500 hidden sm:inline">{owner?.name}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#0F172A] flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Requiere tu atención
            </h2>
            <Card className="p-0 border-yellow-200 shadow-sm">
              <div className="divide-y divide-slate-100">
                {riskInds.length > 0 ? (
                  riskInds.map(({ indicator: ind, report: latestReport, label }) => {
                    const obj = objectives.find(o => o.id === ind.objectiveId);
                    return (
                      <div key={ind.id} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => navigateTo('indicator-detail', ind.name, { indicatorId: ind.id, objectiveId: obj?.id })}>
                        <p className="text-xs text-slate-500 mb-1 truncate">{obj?.name}</p>
                        <h4 className="text-sm font-semibold text-slate-900 mb-2">{ind.code ? `${ind.code} · ` : ''}{ind.name}</h4>
                        <p className="text-xs text-slate-600 mb-2">{corrective.error ? 'Análisis no disponible' : corrective.loading ? 'Consultando análisis…' : label}</p>
                        <div className="flex justify-between items-center text-sm">
                          <div><span className="text-slate-500 block text-xs">Resultado</span><span className="font-bold text-red-600">{latestReport?.result ?? '—'} {displayUnit(ind.unit)}</span></div>
                          <div className="text-right"><span className="text-slate-500 block text-xs">Meta</span><span className="font-medium text-slate-700">{ind.comparator} {ind.target} {displayUnit(ind.unit)}</span></div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="p-8 text-center text-slate-500 text-sm">No hay indicadores fuera de meta. ¡Buen trabajo!</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const ObjectiveFormView = () => {
    const [formData, setFormData] = useState({ name: '', description: '', focus: '', ownerId: '', validityStartYear: '', validityEndYear: '' });

    const handleSubmit = async (e) => {
      e.preventDefault();
      const { data, error } = await supabase.from('objectives').insert({
        name: formData.name,
        description: formData.description,
        focus: formData.focus,
        owner_email: formData.ownerId || null,
        target_date: `${formData.validityEndYear}-12-31`,
        validity_start_year: Number(formData.validityStartYear),
        validity_end_year: Number(formData.validityEndYear),
        created_by: session.user.id,
      }).select().single();
      if (error) {
        setDataError('No se pudo crear el objetivo. Inténtalo nuevamente.');
        return;
      }
      setObjectives([toObjective(data), ...objectives]);
      notify('Objetivo estratégico creado correctamente.');
      navigateTo(isGeneralManager ? 'dashboard' : 'objectives', isGeneralManager ? 'Monitor' : 'Objetivos');
    };

    return (
      <div className="max-w-2xl mx-auto fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F172A]">Nuevo objetivo estratégico</h1>
          <p className="text-slate-500">Define claramente la meta que la organización busca alcanzar.</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Nombre del objetivo *" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <textarea className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-h-[100px] text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <Select label="Foco estratégico *" required options={['Financiero', 'Cliente', 'Procesos', 'Personas/Aprendizaje']} value={formData.focus} onChange={event => setFormData({ ...formData, focus: event.target.value })} />
            <SearchablePeopleSelect label="Responsable principal" required options={availableUsers.filter(user => user.role === 'gerente_responsable')} value={formData.ownerId} onChange={ownerId => setFormData({ ...formData, ownerId })} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <Input label="Inicio de vigencia *" type="number" min="2020" max="2100" placeholder="2026" required value={formData.validityStartYear} onChange={e => setFormData({...formData, validityStartYear: e.target.value})} />
               <Input label="Fin de vigencia *" type="number" min="2020" max="2100" placeholder="2027" required value={formData.validityEndYear} onChange={e => setFormData({...formData, validityEndYear: e.target.value})} />
            </div>
            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => navigateTo(isGeneralManager ? 'dashboard' : 'objectives', isGeneralManager ? 'Monitor' : 'Objetivos')}>Cancelar</Button>
              <Button type="submit">Crear objetivo</Button>
            </div>
          </form>
        </Card>
      </div>
    );
  };

  const ObjectiveDetailView = () => {
    const obj = objectivesWithProjectProgress.find(o => o.id === selectedObjectiveId);
    const [activeTab, setActiveTab] = useState(selectedObjectiveTab);
    useEffect(() => setActiveTab(selectedObjectiveTab), [selectedObjectiveTab]);
    if (!obj || (isManagerScoped && !scopedObjectives.some(objective => objective.id === obj.id))) {
      return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No tienes acceso a este objetivo.</div>;
    }
    const owner = availableUsers.find(u => u.id === obj.ownerId);
    const objProjects = projects.filter(p => p.objectiveId === obj.id);
    const objActions = tasks.filter(task => task.objectiveId === obj.id);
    const objIndicators = indicators.filter(i => i.objectiveId === obj.id);

    return (
      <div className="fade-in space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f0f9ff] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none opacity-60"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-2">{obj.code}</p><h1 className="text-2xl font-bold text-[#0F172A]">{obj.name}</h1>
                <p className="text-slate-500 mt-1 max-w-3xl">{obj.description}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-bold text-[#1D4ED8]">{obj.progress}%</div>
                <p className="text-sm text-slate-500 font-medium">Avance general</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-slate-100">
              <div><p className="text-xs text-slate-400 mb-1">Responsable</p><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600">{owner?.avatar}</div><span className="text-sm font-medium text-slate-900">{owner?.name}</span></div></div>
              <div><p className="text-xs text-slate-400 mb-1">Foco estratégico</p><p className="text-sm font-medium text-slate-900">{obj.focus || 'Sin foco definido'}</p></div>
              <div><p className="text-xs text-slate-400 mb-1">Periodo de vigencia</p><p className="text-sm font-medium text-slate-900 flex items-center gap-1"><Calendar className="w-4 h-4 text-slate-400" /> {obj.validityStartYear} - {obj.validityEndYear}</p></div>
              <div><p className="text-xs text-slate-400 mb-1">Proyectos activos</p><p className="text-sm font-medium text-slate-900">{objProjects.length}</p></div>
              <div><p className="text-xs text-slate-400 mb-1">Indicadores medidos</p><p className="text-sm font-medium text-slate-900">{reportedProgress(objIndicators, reports).reported}</p></div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex gap-6 overflow-x-auto whitespace-nowrap pr-2">
            {[ { id: 'summary', label: 'Resumen', icon: Activity, visible: true }, { id: 'projects', label: 'Proyectos', icon: FolderKanban, visible: isResponsibleManager || isGcg }].filter(tab => tab.visible).map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedObjectiveTab(tab.id); setNavHistory(history => history.map((entry, index) => index === history.length - 1 && entry.id === 'objective-detail' ? { ...entry, objectiveTab: tab.id } : entry)); }} className={`pb-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="py-4">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <Card className="p-5">
                 <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><FolderKanban className="w-5 h-5 text-slate-400"/> Estado de Proyectos</h3>
                 {objProjects.length === 0 ? <p className="text-sm text-slate-500 italic">No hay proyectos vinculados.</p> : (
                   <div className="space-y-4">
                     {objProjects.map(p => (
                       <div key={p.id}>
                         <div className="flex justify-between text-sm mb-1"><span className="font-medium text-slate-700 truncate">{p.name}</span><span className="text-slate-500">{p.progress}%</span></div>
                         <ProgressBar progress={p.progress} status={p.status} />
                       </div>
                     ))}
                   </div>
                 )}
               </Card>
               <Card className="p-5">
                 <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-slate-400"/> Indicadores Clave</h3>
                 {objIndicators.length === 0 ? <div className="space-y-3"><p className="text-sm text-slate-500 italic">No hay indicadores definidos.</p>{isGcg && <Button onClick={() => navigateTo('new-indicator', 'Nuevo Indicador', { objectiveId: obj.id, objectiveTab: 'summary' })} className="w-fit text-xs py-1.5"><Plus className="w-4 h-4"/> Crear indicador</Button>}</div> : (
                   <div className="space-y-3">
                     {objIndicators.map(ind => {
                        const latest = sortReportsByPeriod(reports.filter(r => r.indicatorId === ind.id), 'desc')[0];
                        return (
                          <button type="button" key={ind.id} onClick={() => navigateTo('indicator-detail', ind.name, { indicatorId: ind.id, objectiveId: obj.id, objectiveTab: 'summary' })} className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                            <div><p className="text-sm font-medium text-slate-800">{ind.name}</p><p className="text-xs text-slate-500 mt-0.5">Meta: {ind.comparator} {ind.target} {displayUnit(ind.unit)}</p></div>
                            <div className="text-right"><Badge status={ind.status}>{ind.status}</Badge><p className="text-xs font-bold mt-1 text-slate-700">Actual: {latest?.result || '-'} {displayUnit(ind.unit)}</p></div>
                          </button>
                        )
                     })}
                   </div>
                 )}
               </Card>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-4">
              <PmoProjects objective={obj} projects={objProjects} canManage={isGcg} canSync={isGcg} accessToken={session?.access_token} onReload={loadOperationalData} onNotify={notify} />
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">Acciones estratégicas</h3>{isResponsibleManager && <p className="mt-1 text-sm text-slate-500">Solo consulta: la creación y vinculación se gestionan por GCG.</p>}</div>{isGcg && <Button onClick={() => navigateTo('new-project', 'Añadir acción stratégique', { objectiveId: obj.id, objectiveTab: 'projects' })}><Plus className="h-4 w-4" />Añadir acción estratégica</Button>}</div>
              <StrategicActions actions={objActions} users={availableUsers} onDelete={async action => { if (!isGcg) throw new Error('Solo GCG puede eliminar esta acción.'); const { error } = await supabase.from('strategic_actions').delete().eq('id', action.id).select('id').single(); if (error) throw new Error('No se pudo eliminar la acción. Inténtalo nuevamente.'); setTasks(items => items.filter(item => item.id !== action.id)); notify('Acción estratégica eliminada.'); }} onStatusChange={async (action, status) => { if (!isGcg || !['Cerrado', 'En progreso'].includes(status)) throw new Error('Solo GCG puede cambiar el estatus.'); const now = new Date().toISOString(); const { data, error } = await supabase.from('strategic_actions').update({ status, completed_at: status === 'Cerrado' ? now : null, updated_at: now }).eq('id', action.id).select().single(); if (error) throw new Error('No se pudo guardar el estatus.'); setTasks(items => items.map(item => item.id === action.id ? toAction(data) : item)); notify(status === 'Cerrado' ? 'Acción cerrada; se registró la fecha de término real.' : 'Acción reabierta.'); }} canEdit={isGcg} onEdit={action => navigateTo('edit-action', 'Editar acción estratégica', { objectiveId: obj.id, actionId: action.id, objectiveTab: 'projects' })} />
            </div>
          )}

        </div>
      </div>
    );
  };


  const ProjectFormView = () => {
    const obj = objectives.find(item => item.id === selectedObjectiveId);
    const [formData, setFormData] = useState({ name: '', description: '', dueDate: '', ownerId: '' });
    const handleSubmit = async (e) => {
      e.preventDefault();
      const { data, error } = await supabase.from('strategic_actions').insert({
        objective_id: selectedObjectiveId,
        name: formData.name,
        description: formData.description,
        due_date: formData.dueDate || null,
        owner_email: formData.ownerId || null,
      }).select().single();
      if (error) {
        setDataError('No se pudo registrar la acción estratégica. Inténtalo nuevamente.');
        return;
      }
      setTasks(items => [...items, toAction(data)]);
      notify('Acción estratégica registrada correctamente.');
      navigateTo('objective-detail', obj?.name || 'Objetivo', { objectiveId: selectedObjectiveId, objectiveTab: 'projects' });
    };
    return <div className="max-w-2xl mx-auto fade-in"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Añadir acción estratégica</h1><p className="text-slate-500">{isGcg ? 'GCG' : 'Gerencia responsable'} · {obj?.name}</p></div><Card className="p-6"><form onSubmit={handleSubmit} className="space-y-5"><Input label="Nombre de la acción estratégica *" required placeholder="Ej.: Implementar tablero de producción" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /><div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Descripción</label><textarea rows={3} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div><Select label="Responsable *" required options={availableUsers.map(user => ({ value: user.id, label: user.name }))} value={formData.ownerId} onChange={e => setFormData({...formData, ownerId: e.target.value})} /><Input label="Fecha de término de la actividad" type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} /><div className="pt-4 border-t border-slate-100 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => navigateTo('objective-detail', obj?.name, { objectiveId: selectedObjectiveId, objectiveTab: 'projects' })}>Cancelar</Button><Button type="submit">Registrar acción</Button></div></form></Card></div>;
  };


  const EditActionView = () => {
    const action = tasks.find(item => item.id === selectedActionId);
    const objective = objectives.find(item => item.id === action?.objectiveId);
    const [formData, setFormData] = useState({ name: action?.name || '', description: action?.description || '', dueDate: action?.dueDate || '', ownerId: action?.ownerId || '' });
    if (!action) return <div className="text-center text-slate-500 py-12">No se encontró la acción estratégica.</div>;
    const handleSubmit = async (event) => {
      event.preventDefault();
      const { data, error } = await supabase.from('strategic_actions').update({ name: formData.name, description: formData.description, due_date: formData.dueDate || null, owner_email: formData.ownerId || null, updated_at: new Date().toISOString() }).eq('id', action.id).select().single();
      if (error) { setDataError('No se pudo actualizar la acción estratégica. Inténtalo nuevamente.'); return; }
      setTasks(items => items.map(item => item.id === action.id ? toAction(data) : item));
      notify('Acción estratégica actualizada correctamente.');
      navigateTo('objective-detail', objective?.name || 'Objetivo', { objectiveId: action.objectiveId, objectiveTab: 'projects' });
    };
    return <div className="max-w-2xl mx-auto fade-in"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Editar acción estratégica</h1><p className="text-slate-500">{objective?.name}</p></div><Card className="p-6"><form onSubmit={handleSubmit} className="space-y-5"><Input label="Nombre de la acción estratégica *" required value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} /><div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Descripción</label><textarea rows={3} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" value={formData.description} onChange={event => setFormData({ ...formData, description: event.target.value })} /></div><Select label="Responsable *" required options={availableUsers.map(user => ({ value: user.id, label: user.name }))} value={formData.ownerId} onChange={event => setFormData({ ...formData, ownerId: event.target.value })} /><Input label="Fecha de término de la actividad" type="date" value={formData.dueDate} onChange={event => setFormData({ ...formData, dueDate: event.target.value })} /><div className="pt-4 border-t border-slate-100 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => navigateTo('objective-detail', objective?.name || 'Objetivo', { objectiveId: action.objectiveId, objectiveTab: 'projects' })}>Cancelar</Button><Button type="submit">Guardar cambios</Button></div></form></Card></div>;
  };

  const EditTargetView = () => {
    const indicator = indicators.find(item => item.id === selectedIndicatorId);
    const [target, setTarget] = useState(indicator?.target ?? '');
    const [comparator, setComparator] = useState(indicator?.comparator ?? '>=');
    if (!indicator) return <div className="text-center text-slate-500 py-12">No se encontró el indicador.</div>;
    const handleSubmit = async (event) => {
      event.preventDefault();
      const { error } = await supabase.from('indicator_change_requests').insert({ indicator_id: indicator.id, kind: 'target', proposed: { target: Number(target), comparator }, reason: 'Solicitud de cambio de meta', requested_by: session.user.id });
      if (error) { setDataError('No se pudo actualizar la meta del indicador.'); return; }
      notify('Solicitud enviada. La meta vigente se conserva hasta la aprobación de GCG.');
      navigateTo('indicator-detail', indicator.name, { indicatorId: indicator.id });
    };
    return <div className="max-w-xl mx-auto fade-in"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Editar meta del indicador</h1><p className="text-slate-500">Al guardar, el indicador volverá a la aprobación de GCG.</p></div><Card className="p-6"><form onSubmit={handleSubmit} className="space-y-5"><Select label="Comparador *" required options={[{ value: '>=', label: 'Mayor o igual (>=)' }, { value: '>', label: 'Mayor (>)' }, { value: '<=', label: 'Menor o igual (<=)' }, { value: '<', label: 'Menor (<)' }, { value: '=', label: 'Igual (=)' }]} value={comparator} onChange={event => setComparator(event.target.value)} /><Input label={`Nueva meta${displayUnit(indicator.unit) ? ' (' + displayUnit(indicator.unit) + ')' : ''} *`} type="number" step="0.01" required value={target} onChange={event => setTarget(event.target.value)} /><div className="flex justify-end gap-3 pt-3"><Button type="button" variant="ghost" onClick={() => navigateTo('indicator-detail', indicator.name, { indicatorId: indicator.id })}>Cancelar</Button><Button type="submit">Enviar a aprobación</Button></div></form></Card></div>;
  };

  const IndicatorStatusView = () => <div className="fade-in space-y-6"><div><p className="text-sm font-semibold text-[#D71920] uppercase tracking-wider">Gerencia responsable</p><h1 className="text-2xl font-bold text-slate-900 mt-1">Mis indicadores</h1><p className="text-slate-500 mt-1">Consulta los indicadores que tienes asignados para reporte.</p></div><Card className="overflow-hidden"><div className="p-5 border-b border-slate-200 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Indicadores asignados</h2><span className="text-sm text-slate-500">{scopedIndicators.length} indicadores</span></div>{scopedIndicators.length ? <div className="divide-y divide-slate-100">{scopedIndicators.map(indicator => { const objective = objectives.find(item => item.id === indicator.objectiveId); return <button key={indicator.id} type="button" onClick={() => navigateTo('indicator-detail', indicator.name, { indicatorId: indicator.id, objectiveId: indicator.objectiveId })} className="w-full p-5 text-left hover:bg-slate-50"><p className="font-semibold text-slate-900 break-words">{indicator.name}</p><p className="mt-1 text-sm text-slate-500">Objetivo: {objective?.name || 'Sin objetivo asignado'}</p><p className="mt-1 text-xs text-slate-500">Meta: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)} · {indicator.frequency}</p></button>; })}</div> : <p className="p-10 text-center text-sm text-slate-500">Aún no tienes indicadores asignados.</p>}</Card></div>;

  const EditIndicatorView = () => {
    const indicator = indicators.find(item => item.id === selectedIndicatorId);
    const [formData, setFormData] = useState(() => indicator ? ({ name: indicator.name, formula: indicator.formula || '', target: indicator.target, unit: indicator.unit, comparator: indicator.comparator, frequency: indicator.frequency, reviewFrequency: indicator.reviewFrequency || indicator.frequency, ownerId: indicator.ownerId || '' }) : null);
    if (!indicator || !formData) return <div className="text-center text-slate-500 py-12">No se encontró el indicador.</div>;
    const handleSubmit = async (event) => { event.preventDefault(); const { data, error } = await supabase.from('indicators').update({ name: formData.name, formula: formData.formula, target: Number(formData.target), unit: formData.unit, comparator: formData.comparator, frequency: formData.frequency, review_frequency: formData.reviewFrequency, owner_email: formData.ownerId || null, approval_status: 'Aprobado', updated_at: new Date().toISOString() }).eq('id', indicator.id).select().single(); if (error) { setDataError('No se pudo actualizar el indicador.'); return; } setIndicators(items => items.map(item => item.id === indicator.id ? toIndicator(data) : item)); notify('Indicador actualizado.'); navigateTo('indicator-status', 'Mis indicadores'); };
    return <div className="max-w-3xl mx-auto fade-in"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Editar indicador</h1><p className="text-slate-500 mt-1">Actualiza la información operativa del indicador.</p></div><form onSubmit={handleSubmit} className="space-y-5"><Card className="p-6"><div className="space-y-4"><Input label="Nombre del indicador *" required value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} /><Input label="Fórmula" value={formData.formula} onChange={event => setFormData({ ...formData, formula: event.target.value })} /><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Select label="Comparador *" required options={[{ value: '>=', label: 'Mayor o igual (>=)' }, { value: '>', label: 'Mayor (>)' }, { value: '<=', label: 'Menor o igual (<=)' }, { value: '<', label: 'Menor (<)' }, { value: '=', label: 'Igual (=)' }]} value={formData.comparator} onChange={event => setFormData({ ...formData, comparator: event.target.value })} /><Input label={"Meta (" + displayUnit(formData.unit) + ") *"} type="number" step="0.01" required value={formData.target} onChange={event => setFormData({ ...formData, target: event.target.value })} /><Select label="Unidad *" required options={['%', 'Número', 'Soles', 'Dólares', 'Horas', 'Días', 'Ratio']} value={formData.unit} onChange={event => setFormData({ ...formData, unit: event.target.value })} /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Select label="Plazo *" required options={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']} value={formData.frequency} onChange={event => setFormData({ ...formData, frequency: event.target.value })} /><Select label="Frecuencia de revisión *" required options={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']} value={formData.reviewFrequency} onChange={event => setFormData({ ...formData, reviewFrequency: event.target.value })} /><Select label="Responsable del reporte *" required options={availableUsers.map(user => ({ value: user.id, label: user.name }))} value={formData.ownerId} onChange={event => setFormData({ ...formData, ownerId: event.target.value })} /></div></div></Card><div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => navigateTo('indicator-status', 'Mis indicadores')}>Cancelar</Button><Button type="submit">Guardar cambios</Button></div></form></div>;
  };

  const IndicatorFormView = () => {
    const obj = objectives.find(o => String(o.id) === String(selectedObjectiveId));
    const [formData, setFormData] = useState({ name: '', formula: '', target: '', unit: '%', comparator: '>=', frequency: 'Mensual', reviewFrequency: 'Mensual', ownerId: '', siteAssignments: [{ siteId: '', responsibleEmail: '', weight: '1' }] });

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!isGcg || !obj) { setDataError('Solo GCG puede crear indicadores desde un objetivo válido.'); return; }
      if (indicators.some(item => String(item.objectiveId) === String(obj.id))) { setDataError('Este objetivo ya tiene un indicador. Cada objetivo admite solo uno.'); return; }
      const invalidAssignment = formData.siteAssignments.some(item => !item.siteId || !item.responsibleEmail || !Number(item.weight));
      const duplicateSites = new Set(formData.siteAssignments.map(item => item.siteId)).size !== formData.siteAssignments.length;
      if (invalidAssignment || duplicateSites) { setDataError(duplicateSites ? 'Cada sede puede registrarse una sola vez.' : 'Completa sede, responsable y ponderación para cada asignación.'); return; }
      const { data, error } = await supabase.from('indicators').insert({
        objective_id: obj.id,
        name: formData.name,
        formula: formData.formula,
        target: parseFloat(formData.target),
        unit: formData.unit,
        comparator: formData.comparator,
        frequency: formData.frequency,
        review_frequency: formData.reviewFrequency,
        owner_email: formData.siteAssignments[0]?.responsibleEmail || null,
        approval_status: 'Aprobado',
      }).select().single();
      if (error) {
        setDataError(`No se pudo guardar el indicador: ${error.message}`);
        return;
      }
      const { data: assignmentRows, error: assignmentError } = await supabase.from('indicator_site_assignments').insert(formData.siteAssignments.map(item => ({ indicator_id: data.id, site_id: Number(item.siteId), responsible_email: item.responsibleEmail, weight: Number(item.weight), active: true }))).select();
      if (assignmentError) {
        await supabase.from('indicators').delete().eq('id', data.id);
        setDataError(`No se pudo guardar las sedes del indicador: ${assignmentError.message}`);
        return;
      }
      setIndicators([...indicators, toIndicator(data)]);
      setSiteAssignments(items => [...items, ...(assignmentRows || [])]);
      notify('Indicador creado y asignado por sede.');
      navigateTo('objective-detail', obj.name, { objectiveId: obj.id, objectiveTab: 'summary' });
    };

    return (
      <div className="max-w-3xl mx-auto fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2"><span>Objetivo</span> <ChevronRight className="w-3 h-3" /> <span className="font-medium text-slate-900 truncate max-w-[300px]">{obj?.name}</span></div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Nuevo indicador estratégico</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-bold text-[#1D4ED8] uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">1. Información General</h3>
            <div className="space-y-4">
              <Input label="Nombre del indicador *" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-bold text-[#1D4ED8] uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">2. Medición</h3>
            <div className="space-y-4">
              <Input label="Fórmula" value={formData.formula} onChange={e => setFormData({...formData, formula: e.target.value})} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <Select label="Comparador *" required options={[ {value: '>=', label: 'Mayor o igual (>=)'}, {value: '>', label: 'Mayor (>)'}, {value: '<=', label: 'Menor o igual (<=)'}, {value: '<', label: 'Menor (<)'}, {value: '=', label: 'Igual (=)'} ]} value={formData.comparator} onChange={e => setFormData({...formData, comparator: e.target.value})} />
                <Input label={"Meta (" + displayUnit(formData.unit) + ") *"} type="number" step="0.01" required value={formData.target} onChange={e => setFormData({...formData, target: e.target.value})} />
                <Select label="Unidad *" required options={['%', 'Número', 'Soles', 'Dólares', 'Horas', 'Días', 'Ratio']} value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-bold text-[#1D4ED8] uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">3. Gestión</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select label="Plazo *" required options={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']} value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} />
              <Select label="Frecuencia de revisión *" required options={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']} value={formData.reviewFrequency} onChange={e => setFormData({...formData, reviewFrequency: e.target.value})} />
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Asignación por sede</h4><p className="text-xs text-slate-500">El mismo indicador se reporta de forma independiente en cada sede.</p></div><Button type="button" variant="secondary" className="px-3 py-1.5" onClick={() => setFormData({ ...formData, siteAssignments: [...formData.siteAssignments, { siteId: '', responsibleEmail: '', weight: '1' }] })}><Plus className="h-4 w-4" />Añadir sede</Button></div><div className="space-y-3">{formData.siteAssignments.map((assignment, index) => <div key={index} className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_1fr_120px_auto]"><Select label="Sede *" required options={sites.map(site => ({ value: String(site.id), label: site.name }))} value={assignment.siteId} onChange={event => setFormData({ ...formData, siteAssignments: formData.siteAssignments.map((item, itemIndex) => itemIndex === index ? { ...item, siteId: event.target.value } : item) })} /><Select label="Responsable *" required options={availableUsers.filter(user => user.role === 'gerente_responsable').map(user => ({ value: user.email || user.id, label: user.name }))} value={assignment.responsibleEmail} onChange={event => setFormData({ ...formData, siteAssignments: formData.siteAssignments.map((item, itemIndex) => itemIndex === index ? { ...item, responsibleEmail: event.target.value } : item) })} /><Input label="Ponderación *" required min="0.01" step="0.01" type="number" value={assignment.weight} onChange={event => setFormData({ ...formData, siteAssignments: formData.siteAssignments.map((item, itemIndex) => itemIndex === index ? { ...item, weight: event.target.value } : item) })} />{formData.siteAssignments.length > 1 && <Button type="button" variant="ghost" className="self-end text-red-600" onClick={() => setFormData({ ...formData, siteAssignments: formData.siteAssignments.filter((_, itemIndex) => itemIndex !== index) })}>Quitar</Button>}</div>)}</div></div>
          </Card>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => obj ? navigateTo('objective-detail', obj.name, { objectiveId: obj.id, objectiveTab: 'summary' }) : navigateTo('objectives', 'Objetivos')}>Cancelar</Button>
            <Button type="submit">Guardar Indicador</Button>
          </div>
        </form>
      </div>
    );
  };

  const IndicatorDetailView = () => {
    const [historyView, setHistoryView] = useState('detailed');
    const ind = indicators.find(i => i.id === selectedIndicatorId);
    const obj = objectives.find(o => o.id === ind?.objectiveId);
    if (!ind) return null;
    const indAssignments = siteAssignments.filter(assignment => String(assignment.indicator_id) === String(ind.id) && assignment.active);
    const visibleAssignmentIds = isManagerScoped ? managerAssignments.filter(assignment => String(assignment.indicator_id) === String(ind.id)).map(assignment => String(assignment.id)) : null;
    const indReports = sortReportsByPeriod(reports.filter(r => r.indicatorId === ind.id && (!visibleAssignmentIds || !r.assignmentId || visibleAssignmentIds.includes(String(r.assignmentId)))));
    const latestReport = indReports[indReports.length - 1];
    const reportYears = [...new Set(indReports.map(report => reportPeriodTime(report) ? String(new Date(reportPeriodTime(report)).getUTCFullYear()) : '').filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    const activeWeightedYear = reportYears[0] || '';
    const weighted = weightedMeasurementValue(indReports, activeWeightedYear);
    const weightedDisplay = weighted.value === null ? '—' : (Number.isInteger(weighted.value) ? weighted.value : Number(weighted.value.toFixed(2)));
    const weightedStatus = weighted.value === null ? 'Sin reporte' : calculateIndicatorStatus(weighted.value, ind.target, ind.comparator);
    const ownIds = accountIdentities(session.user.email, organizationPeople);
    const { canManage, canReport: legacyCanReport } = indicatorAccess(ind, obj, ownIds, isSuperAdmin);
    const canReport = legacyCanReport || managerAssignments.some(assignment => String(assignment.indicator_id) === String(ind.id));
    const reporter = ind.reporter_email ? personName(ind.reporter_email, availableUsers) : 'Sin asignar';
    const historyCondition = report => {
      if (report.result == null) return 'Sin datos';
      const band = measurementComplianceBand(report.result, ind.target, ind.comparator).band;
      return ({ pesimista: 'Pesimista', optimista: 'Optimista', excepcional: 'Excepcional' })[band] || 'Sin condición';
    };

    return (
      <div className="fade-in space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span className="cursor-pointer hover:text-[#1D4ED8]" onClick={() => navigateTo('objective-detail', obj?.name, { objectiveId: obj?.id })}>Objetivo</span> <ChevronRight className="w-3 h-3" /> <span className="font-medium text-slate-900">Indicador</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 space-y-2">
            <p className="text-xs font-semibold text-blue-700 mb-2">{ind.code}</p>
            <h1 className="text-2xl font-bold text-[#0F172A]">{ind.name}</h1>
            <p className="text-sm text-slate-500">Mide el avance del objetivo: <span className="font-medium text-slate-700">{obj?.name}</span></p>
            <div className="flex gap-4 mt-4 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200 inline-flex">
              <div><span className="font-medium">Fórmula:</span> {ind.formula || 'N/A'}</div>
              <div className="w-px bg-slate-200"></div>
              <div><span className="font-medium">Frecuencia:</span> {ind.frequency}</div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><User className="h-4 w-4 text-blue-600" /><span>Responsable de reporte:</span><span className="font-semibold text-slate-800">{reporter}</span></p>
          </div>
          <div className="md:col-span-2">
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              {(isGcg || canReport) && <button type="button" onClick={() => setIndicatorRequestForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"><FilePenLine className="h-4 w-4" />{isGcg ? 'Realizar modificación' : 'Solicitar modificación'}</button>}
              {isGcg && <button type="button" onClick={async () => { if (!window.confirm(`¿Eliminar el indicador “${ind.name}”? También se eliminarán sus mediciones y análisis asociados.`)) return; const { error } = await supabase.rpc('delete_indicator', { indicator: ind.id }); if (error) { setDataError(`No se pudo eliminar el indicador: ${error.message}`); return; } await loadOperationalData(); corrective.reload(); notify('Indicador eliminado.'); navigateTo('objective-detail', obj?.name || 'Objetivo', { objectiveId: obj?.id, objectiveTab: 'summary' }); }} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"><Trash2 className="h-4 w-4" />Eliminar indicador</button>}
              {!isGcg && <button type="button" onClick={() => setIndicatorRequestFlyout('pending')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><Clock className="h-4 w-4 text-amber-600" />En revisión</button>}
              <button type="button" onClick={() => setIndicatorRequestFlyout('history')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><History className="h-4 w-4 text-slate-500" />Historial</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className={`p-6 flex flex-col justify-center items-center text-center border-t-4 ${latestReport?.status === 'En meta' ? 'border-t-green-500' : latestReport?.status === 'Fuera de meta' ? 'border-t-red-500' : 'border-t-slate-300'}`}>
              <p className="text-sm font-medium text-slate-500 mb-2">Último reporte</p>
              <div className="text-4xl font-bold text-slate-900 mb-2">{latestReport?.result ?? '—'} <span className="text-xl text-slate-500 font-normal">{displayUnit(ind.unit)}</span></div>
              <Badge status={latestReport?.status || 'Sin reporte'}>{latestReport?.status || 'Sin reporte'}</Badge>
              <p className="text-xs text-slate-400 mt-3">Meta: {ind.comparator} {ind.target} {displayUnit(ind.unit)}</p>
            </Card>
            <Card className="p-5 flex flex-col justify-center items-center text-center border-t-4 border-t-blue-500">
              <p className="text-sm font-medium text-slate-500 mb-2">Valor ponderado{activeWeightedYear ? ` ${activeWeightedYear}` : ''}</p>
              <div className="text-4xl font-bold text-slate-900">{weightedDisplay} <span className="text-xl text-slate-500 font-normal">{displayUnit(ind.unit)}</span></div>
              {weighted.value !== null && <div className="mt-3"><Badge status={weightedStatus}>{weightedStatus}</Badge></div>}
              {!!weighted.count && <p className="mt-1 text-xs text-slate-400">{weighted.count} medición{weighted.count === 1 ? '' : 'es'}</p>}
            </Card>
            </div>
          </div>
        </div>
        <Card className="p-6">
          <MeasurementChart indicator={ind} reports={indReports} headerAction={isResponsibleManager && canReport ? <Button onClick={() => navigateTo('report-indicator', 'Registrar Resultado', { indicatorId: ind.id })} variant="secondary">Registrar resultado</Button> : null} />
        </Card>
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h3 className="font-semibold text-slate-900">Historial de Mediciones</h3><p className="mt-1 text-xs text-slate-500">{historyView === 'detailed' ? 'Vista detallada por estándar de cumplimiento.' : 'Vista simple con una condición consolidada.'}</p></div><button type="button" onClick={() => setHistoryView(view => view === 'detailed' ? 'simple' : 'detailed')} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">{historyView === 'detailed' ? 'Ver modelo simple' : 'Ver modelo detallado'}</button></div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-center text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr><th className="w-[13%] px-3 py-3 text-center">Periodo</th><th className="w-[12%] px-3 py-3 text-center">Fecha Reporte</th><th className="w-[11%] px-3 py-3 text-center">Resultado</th><th className="w-[13%] px-3 py-3 text-center">Estado</th>{historyView === 'detailed' ? <><th className="w-[8%] px-2 py-3 text-center">Pesimista</th><th className="w-[8%] px-2 py-3 text-center">Optimista</th><th className="w-[9%] px-2 py-3 text-center">Excepcional</th></> : <th className="w-[18%] px-3 py-3 text-center">Condición</th>}<th className="w-[16%] px-3 py-3 text-center">Análisis de causa</th><th className="w-[10%] px-3 py-3 text-center">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indReports.length === 0 && <tr><td colSpan="9" className="px-6 py-8 text-center text-slate-500">Aún no existen resultados registrados para este indicador.</td></tr>}
                {[...indReports].reverse().map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-4 font-medium text-slate-900">{r.period}</td>
                    <td className="px-3 py-4 text-slate-500">{r.registeredDate || r.date}</td>
                    <td className="px-3 py-4 font-bold text-slate-900">{r.result == null ? 'Sin datos' : `${r.result} ${displayUnit(ind.unit)}`}</td>
                    <td className="px-3 py-4"><div className="flex justify-center"><Badge status={r.status}>{r.status}</Badge></div></td>
                    {historyView === 'detailed' ? <><td className="px-4 py-4 text-center font-bold text-red-700">{complianceMark(r.result, ind.target, ind.comparator, 'pesimista')}</td><td className="px-4 py-4 text-center font-bold text-amber-700">{complianceMark(r.result, ind.target, ind.comparator, 'optimista')}</td><td className="px-4 py-4 text-center font-bold text-green-700">{complianceMark(r.result, ind.target, ind.comparator, 'excepcional')}</td></> : <td className="px-3 py-4 text-center font-semibold text-slate-700">{historyCondition(r)}</td>}
                    <td className="px-3 py-4"><div className="flex justify-center"><AnalysisHistoryButton report={r} indicator={ind} objective={obj} workflow={corrective} users={availableUsers} canManage={isResponsibleManager && canManage} /></div></td>
                    <td className="px-3 py-4"><div className="flex justify-center"><ActionsHistoryButton report={r} workflow={corrective} users={availableUsers} canManage={isResponsibleManager && canManage} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {indicatorRequestFlyout && <IndicatorRequestFlyout directHistory={isGcg} indicatorId={ind.id} indicators={indicators} users={organizationPeople} reports={reports} history={indicatorRequestFlyout === 'history'} onClose={() => setIndicatorRequestFlyout(null)} onViewHistory={isGcg ? null : () => { setIndicatorRequestFlyout(null); navigateTo('indicator-request-history', 'Historial de solicitudes', { indicatorId: ind.id }); }} />}
        {indicatorRequestForm && createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label={isGcg ? 'Realizar modificación' : 'Solicitar modificación'}><div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-semibold text-blue-700">{ind.code}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{isGcg ? 'Realizar modificación' : 'Solicitar modificación'}</h2></div><button autoFocus onClick={() => setIndicatorRequestForm(false)} aria-label="Cerrar formulario" className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100">×</button></header><div className="p-6"><p className="mb-5 text-sm text-slate-500">{ind.name}</p><IndicatorControls requestOnly indicator={ind} reports={indReports} isGcg={isGcg} canManage={canManage} users={availableUsers} session={session} onReload={loadOperationalData} onError={setDataError} onNotify={message => { notify(message); setIndicatorRequestForm(false); }} /></div></div></div>, document.body)}
      </div>
    );
  };

  const ReportFormView = () => {
    const ind = indicators.find(i => i.id === selectedIndicatorId);
    const reportingAssignments = siteAssignments.filter(assignment => String(assignment.indicator_id) === String(ind?.id) && assignment.active && (!isManagerScoped || accountOwns(assignment.responsible_email)));
    const [formData, setFormData] = useState({ period: '', result: '', obs: '', noData: false, assignmentId: reportingAssignments[0] ? String(reportingAssignments[0].id) : '' });
    const registrationDate = new Date().toLocaleDateString('en-CA');
    const registrationDateLabel = registrationDate.split('-').reverse().join('-');
    const formatPeriod = (value) => { const [year, month] = value.split('-'); const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']; return value ? `${months[Number(month) - 1]},${year}` : ''; };

    const handleSubmit = async (e) => {
      e.preventDefault();
      const calcStatus = formData.noData ? 'Sin datos' : calculateIndicatorStatus(formData.result, ind.target, ind.comparator);
      setDataError('');
      const rpc = formData.assignmentId ? 'register_site_indicator_measurement' : 'register_indicator_measurement';
      const payload = formData.assignmentId
        ? { indicator: ind.id, assignment: Number(formData.assignmentId), report_period: formatPeriod(formData.period), report_result: formData.noData ? null : parseFloat(formData.result), report_observations: formData.noData ? null : formData.obs || null }
        : { indicator: ind.id, report_period: formatPeriod(formData.period), report_result: formData.noData ? null : parseFloat(formData.result), report_observations: formData.noData ? null : formData.obs || null };
      const { error } = await supabase.rpc(rpc, payload);
      if (error) {
        setDataError(`No se pudo registrar el resultado: ${error.message || 'inténtalo nuevamente.'}`);
        return;
      }
      await loadOperationalData();
      notify(`Resultado registrado: indicador ${calcStatus.toLowerCase()}.`, ['En meta', 'Sin datos'].includes(calcStatus) ? 'success' : 'warning');
      navigateTo('indicator-detail', ind.name, { indicatorId: ind.id });
    };

    return (
      <div className="max-w-xl mx-auto fade-in">
         <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#0F172A]">Registrar Resultado</h1>
          <p className="text-slate-500 mt-1">{ind?.name}</p>
        </div>
        <Card className="p-6">
          <div className="bg-slate-50 p-4 rounded-lg mb-6 flex justify-between items-center border border-slate-200">
             <div><p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Meta a cumplir</p><p className="text-lg font-bold text-[#1D4ED8]">{ind?.comparator} {ind?.target} {displayUnit(ind?.unit)}</p></div>
             <div className="text-right"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Frecuencia</p><p className="text-sm font-medium text-slate-700">{ind?.frequency}</p></div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {reportingAssignments.length > 0 && <Select label="Sede *" required options={reportingAssignments.map(assignment => ({ value: String(assignment.id), label: `${sites.find(site => String(site.id) === String(assignment.site_id))?.name || 'Sede'} · ${personName(assignment.responsible_email, availableUsers)}` }))} value={formData.assignmentId} onChange={e => setFormData({ ...formData, assignmentId: e.target.value })} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Input label="Periodo de Registro *" type="month" required value={formData.period} onChange={e => setFormData({...formData, period: e.target.value})} /><div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Fecha de registro</label><div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">{registrationDateLabel}</div></div></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.noData} onChange={e => setFormData({ ...formData, noData: e.target.checked })}/>Sin datos para este periodo</label>
            {!formData.noData && <div className="relative">
              <Input label={`Resultado obtenido${displayUnit(ind?.unit) ? ' (' + displayUnit(ind?.unit) + ')' : ''} *`} type="number" step="0.01" required className="text-lg" value={formData.result} onChange={e => setFormData({...formData, result: e.target.value})} />
              {formData.result && <div className="absolute right-3 top-9"><Badge status={calculateIndicatorStatus(formData.result, ind.target, ind.comparator)}>{calculateIndicatorStatus(formData.result, ind.target, ind.comparator)}</Badge></div>}
            </div>}
            {!formData.noData && <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Observaciones (Opcional)</label><textarea className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-sm" rows={3} value={formData.obs} onChange={e => setFormData({...formData, obs: e.target.value})} /></div>}
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => navigateTo('indicator-detail', ind.name, { indicatorId: ind.id })}>Cancelar</Button>
              <Button type="submit">Guardar Registro</Button>
            </div>
          </form>
        </Card>
      </div>
    )
  }

  const SettingsView = () => {
    const [recipientEmail, setRecipientEmail] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const recipient = availableUsers.find(user => String(user.email || '').toLowerCase() === recipientEmail);
    const existingMessage = dashboardMessages.find(item => String(item.recipient_email || '').toLowerCase() === recipientEmail);

    useEffect(() => {
      setMessage(existingMessage?.message || '');
    }, [recipientEmail, existingMessage?.message]);

    const saveMessage = async event => {
      event.preventDefault();
      if (!recipientEmail || !message.trim() || busy) return;
      setBusy(true);
      const { error } = await supabase.from('dashboard_messages').upsert({
        recipient_email: recipientEmail,
        message: message.trim(),
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'recipient_email' });
      setBusy(false);
      if (error) {
        setDataError(`No se pudo guardar el mensaje: ${error.message}`);
        return;
      }
      await loadOperationalData();
      notify(`Mensaje actualizado para ${recipient?.name || recipientEmail}.`);
    };


    return <div className="max-w-3xl fade-in space-y-6"><div><h1 className="text-2xl font-bold text-slate-900">Configuración</h1><p className="text-slate-500 mt-1">Administra las preferencias generales de {APP_TITLE}.</p></div>{isGcg && <MicrosoftDirectory session={session} onReload={loadOperationalData} />}<Card className="p-6"><h2 className="font-semibold text-slate-900">Preferencias de visualización</h2><div className="mt-5 space-y-4"><label className="flex items-center justify-between gap-4 py-3 border-b border-slate-100"><span><span className="block text-sm font-medium text-slate-800">Alertas estratégicas</span><span className="block text-xs text-slate-500 mt-1">Muestra objetivos retrasados en el Monitor.</span></span><input type="checkbox" defaultChecked className="w-4 h-4 accent-[#D71920]" /></label><label className="flex items-center justify-between gap-4 py-3"><span><span className="block text-sm font-medium text-slate-800">Vista compacta</span><span className="block text-xs text-slate-500 mt-1">Reduce el espacio entre elementos del dashboard.</span></span><input type="checkbox" className="w-4 h-4 accent-[#D71920]" /></label></div></Card>{isGcg && <Card className="p-6"><div><h2 className="font-semibold text-slate-900">Mensaje personalizado del monitor</h2><p className="mt-1 text-sm text-slate-500">Selecciona una persona y escribe el texto que verá debajo de su saludo en Objetivos.</p></div><form onSubmit={saveMessage} className="mt-5 space-y-4"><Select label="Persona destinataria *" required options={availableUsers.filter(user => user.email).map(user => ({ value: String(user.email).toLowerCase(), label: user.name }))} value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} /><div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Texto personalizado *</label><textarea required maxLength={600} rows={4} value={message} onChange={event => setMessage(event.target.value)} placeholder="Ej.: Recuerda registrar la medición de este mes antes del cierre." className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#3B82F6]" /><p className="text-right text-xs text-slate-400">{message.length}/600</p></div><div className="flex flex-wrap justify-end gap-3"><Button type="submit" disabled={!recipientEmail || !message.trim() || busy}>{busy ? 'Guardando…' : existingMessage ? 'Actualizar mensaje' : 'Guardar mensaje'}</Button></div></form></Card>}<Card className="p-6"><h2 className="font-semibold text-slate-900">Sesión</h2><p className="text-sm text-slate-500 mt-2">Correo: {session?.user?.email}</p><p className="text-sm text-slate-500 mt-1">Rol actual: {selectedRole?.name || ROLE_LABELS[assignedRole]}</p><div className="mt-4 flex flex-wrap gap-3">{isSuperAdmin && <Button variant="secondary" onClick={() => { setSelectedRole(null); setCurrentView('dashboard'); }}>Cambiar rol</Button>}<Button variant="secondary" onClick={signOut}><LogOut className="w-4 h-4" />Cerrar sesión</Button></div></Card><Card className="p-6"><h2 className="font-semibold text-slate-900">Información de la plataforma</h2><p className="text-sm text-slate-500 mt-2">{APP_TITLE} · Plataforma estratégica de Biomont</p></Card></div>;
  };

  const AuthShell = ({ children }) => <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06265a] p-5" style={{ backgroundImage: `linear-gradient(90deg, rgba(3, 31, 91, 0.94) 0%, rgba(10, 71, 157, 0.74) 52%, rgba(16, 113, 185, 0.35) 100%), url(${strategicLoginHero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}><div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-slate-950/45" /><div className="relative w-full max-w-[1200px]">{children}</div></main>;

  if (authLoading) return <AuthShell><div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm"><img src={biomontLogo} alt="Biomont" className="h-16 w-auto object-contain mx-auto mb-5" /><p className="text-slate-600">Verificando tu acceso…</p></div></AuthShell>;

  if (!session) return <AuthShell><div className="grid min-h-[min(760px,calc(100vh-2.5rem))] items-center gap-10 lg:grid-cols-[1fr_minmax(460px,0.9fr)]"><section className="hidden max-w-xl self-center text-white lg:block"><p className="mb-8 text-sm font-bold uppercase tracking-[0.22em] text-blue-100">Gestión Estratégica</p><h1 className="max-w-lg text-5xl font-bold leading-[1.08] tracking-tight xl:text-6xl">Transformamos la estrategia en valor real</h1><div className="mt-8 h-1.5 w-24 rounded-full bg-[#E51B2A]" /><p className="mt-8 max-w-md text-xl leading-8 text-blue-50">Accede a la plataforma de gestión estratégica de Biomont.</p></section><section className="mx-auto w-full max-w-[560px] rounded-[2rem] border border-white/70 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm sm:p-12"><img src={biomontLogo} alt="Biomont" className="mx-auto mb-7 h-16 w-auto object-contain" /><div className="border-t border-slate-200 pt-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D71920]">Plataforma estratégica</p><h1 className="mt-3 text-3xl font-bold text-[#0A2D66]">Bienvenido</h1><p className="mt-3 text-slate-500">Inicia sesión con tu cuenta corporativa.</p>{authError && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{authError}</p>}<button type="button" onClick={signInWithMicrosoft} className="mt-8 flex w-full items-center justify-between rounded-2xl bg-[#1767D3] px-6 py-5 text-left text-lg font-semibold text-white shadow-xl shadow-blue-900/20 transition hover:bg-[#1158ba] focus:outline-none focus:ring-4 focus:ring-blue-300"><span className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-xl font-bold text-[#1767D3]">▣</span>Iniciar sesión con Microsoft</span><ArrowRight className="h-6 w-6" /></button><p className="mt-7 text-sm text-slate-500">Acceso seguro mediante Microsoft Entra ID</p><p className="mt-8 text-xs text-slate-400">Biomont · {APP_TITLE}</p></div></section></div></AuthShell>;

  if (!assignedRole || authError) return <AuthShell><div className="mx-auto max-w-md rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-bold">Acceso no autorizado</h1><p className="mt-3 text-sm text-slate-600">{authError || `Tu cuenta no tiene un rol asignado en ${APP_TITLE}. Contacta al administrador.`}</p><Button className="mt-5 w-full" variant="secondary" onClick={signOut}>Cerrar sesión</Button></div></AuthShell>;

  if (selectedRole?.key === 'usuario') return <UserWorkspace session={session} objectives={objectivesWithProjectProgress} indicators={indicators} reports={reports} users={availableUsers} organizationPeople={organizationPeople} onReload={loadOperationalData} onSignOut={signOut} />;

  if (!selectedRole && assignedRole === 'super_admin') {
    const roles = [
      { key: 'gerente_responsable', name: 'Gerente responsable', description: 'Reporta indicadores asignados y delega responsables de reporte.', icon: Target, color: 'bg-blue-50 text-blue-600 border-blue-100' },
      { key: 'gcg', name: 'GCG', description: 'Crea objetivos e indicadores y aprueba solicitudes de modificación.', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      { key: 'usuario', name: 'Usuario', description: 'Consulta y registra únicamente los indicadores donde fue asignado como apoyo.', icon: User, color: 'bg-violet-50 text-violet-600 border-violet-100' }
    ];
    return <AuthShell><div className="text-center mb-9"><img src={biomontLogo} alt="Biomont" className="h-20 w-auto object-contain mx-auto mb-6" /><p className="text-sm font-bold text-[#D71920] uppercase tracking-[0.2em]">Super administrador</p><h1 className="text-4xl font-bold text-slate-900 mt-2">Selecciona una vista</h1><p className="text-slate-500 mt-3 max-w-xl mx-auto">Elige el rol con el que deseas ingresar a {APP_TITLE}.</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-5">{roles.map(role => { const Icon = role.icon; return <button key={role.name} onClick={() => setSelectedRole(role)} className="bg-white border border-slate-200 rounded-2xl p-6 text-left shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-[#D71920]/40 transition-all group"><div className={`w-12 h-12 border rounded-xl flex items-center justify-center ${role.color}`}><Icon className="w-6 h-6" /></div><h2 className="text-lg font-bold text-slate-900 mt-5">{role.name}</h2><p className="text-sm text-slate-500 leading-6 mt-2">{role.description}</p><div className="flex items-center gap-2 text-sm font-semibold text-[#D71920] mt-6">Ingresar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></div></button>})}</div><div className="text-center mt-7"><button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-800">Cerrar sesión de {session.user.email}</button></div></AuthShell>;
  }

  return (
    <div className="biomet-app min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900">
      <aside className="app-sidebar bg-[#0F172A] text-slate-300 flex-col hidden md:flex fixed h-full z-20">
        <div className="h-14 flex items-center px-4 border-b border-slate-800">
          <div className="flex items-center gap-2"><img src={isKunturAccount ? kunturLogo : biomontLogo} alt={isKunturAccount ? "Kuntur Pharma" : "Biomont"} className={`${isKunturAccount ? "w-28" : "w-12"} h-9 object-contain`} /><span className="text-white font-bold text-lg tracking-tight">{APP_TITLE}</span></div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            <div className="pt-2 pb-1"><p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reportería</p></div>
            <button onClick={() => { setBscVisible(true); navigateTo('dashboard', 'Monitor estratégico'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'dashboard' && bscVisible ? 'bg-[#1e293b] text-white' : 'hover:bg-slate-800 hover:text-white'}`}><BarChart3 className="w-5 h-5" /> Gráfica BSC</button>
            <button onClick={() => { setBscVisible(false); navigateTo('dashboard', 'Monitor estratégico'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'dashboard' && !bscVisible ? 'bg-[#1e293b] text-white' : 'hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard className="w-5 h-5" /> Monitor estratégico</button>
            <button onClick={() => navigateTo('bio-indicators', 'Indicadores general')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${currentView === 'bio-indicators' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}><BarChart3 className="w-5 h-5" />Indicadores general</button>{!isGcg && <button onClick={() => navigateTo('change-requests', 'Solicitudes')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${currentView === 'change-requests' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}><FilePenLine className="w-5 h-5" />Solicitudes</button>}
            <div className="pt-4 pb-1"><p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gestión Estratégica</p></div>
            <button onClick={() => navigateTo(isGeneralManager ? 'new-objective' : 'objectives', isGeneralManager ? 'Crear objetivo' : 'Objetivos')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${(currentView.includes('objective') && currentView !== 'dashboard') ? 'bg-[#1e293b] text-white' : 'hover:bg-slate-800 hover:text-white'}`}><Target className="w-5 h-5" /> {isGeneralManager ? 'Crear objetivo' : 'Objetivos'}</button>
            {isResponsibleManager && <button onClick={() => navigateTo('indicator-status', 'Mis indicadores')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'indicator-status' || currentView === 'edit-indicator' ? 'bg-[#1e293b] text-white' : 'hover:bg-slate-800 hover:text-white'}`}><BarChart3 className="w-5 h-5" /> Mis indicadores</button>}
            {isGcg && <button onClick={() => navigateTo('gcg-review', 'Solicitudes')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'gcg-review' ? 'bg-[#1e293b] text-white' : 'hover:bg-slate-800 hover:text-white'}`}><CheckCircle2 className="w-5 h-5" /> Solicitudes</button>}
            {isGcg && <button onClick={() => navigateTo('core-indicators', 'Indicadores core')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'core-indicators' ? 'bg-[#1e293b] text-white' : 'hover:bg-slate-800 hover:text-white'}`}><Star className="w-5 h-5" /> Indicadores core</button>}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2"><div className="w-9 h-9 shrink-0 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-white">{signedInName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div><div className="flex-1 overflow-hidden"><p className="text-sm font-medium text-white truncate">{signedInName}</p><p className="text-xs text-slate-500 truncate">{selectedRole.name}</p></div><button onClick={() => navigateTo('settings', 'Configuración')} aria-label="Abrir configuración" className="p-1 rounded hover:bg-slate-700"><Settings className="w-4 h-4 text-slate-400 hover:text-white" /></button></div>
        </div>
      </aside>
      <main className="app-main min-w-0 flex-1 flex flex-col min-h-screen">
        <header className="h-14 min-h-14 shrink-0 bg-white border-b border-slate-200 flex items-center px-4 md:px-5 sticky top-0 z-50 isolate overflow-visible shadow-sm gap-3">
           {(navHistory.length > 1 || (currentView === 'bio-indicators' && indicatorFilters.indicatorId)) && <button onClick={goBack} className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900" aria-label="Retroceder"><ArrowLeft className="w-4 h-4" /> <span>Atrás</span></button>}
           {currentView === 'bio-indicators' && (indicatorFilters.indicatorId ? <IndicatorYearFilter reports={reports.filter(report => String(report.indicatorId) === String(indicatorFilters.indicatorId))} year={bioIndicatorYear} onChange={setBioIndicatorYear} /> : <IndicatorFilterMenu reports={reports} isGcg={isGcg} objectives={objectivesWithProjectProgress} indicators={indicators} users={availableUsers} sites={sites} assignments={siteAssignments} filters={indicatorFilters} onChange={changeIndicatorFilters} />)}

        </header>
        <div className="app-content p-4 md:p-6 flex-1 relative z-0">
          {dataError && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3"><span>{dataError}</span><button onClick={() => setDataError('')} className="font-semibold shrink-0">Cerrar</button></div>}
          {currentView === 'dashboard' && (bscVisible ? <StrategicMap objectives={objectivesWithProjectProgress} indicators={indicators} reports={reports} users={availableUsers} onClose={() => setBscVisible(false)} onSelectIndicator={indicator => { setBscVisible(false); navigateTo('indicator-detail', indicator.name, { indicatorId: indicator.id }); }} /> : <MonitorView />)}
          {currentView === 'bio-indicators' && <BioIndicatorsView workflow={corrective} objectives={objectivesWithProjectProgress} indicators={isManagerScoped ? scopedIndicators : indicators} reports={isManagerScoped ? scopedReports : reports} users={availableUsers} sites={sites} assignments={siteAssignments} filters={indicatorFilters} onChange={changeIndicatorFilters} year={bioIndicatorYear} isGcg={isGcg} session={session} onReload={loadOperationalData} onError={setDataError} onNotify={notify} />}
          {currentView === 'change-requests' && <ChangeRequests isGcg={isGcg} indicators={indicators} users={organizationPeople} onReload={loadOperationalData} onError={setDataError} />}
          {currentView === 'indicator-request-history' && <ChangeRequests isGcg={isGcg} indicators={indicators} users={organizationPeople} reports={reports} onReload={loadOperationalData} onError={setDataError} indicatorId={selectedIndicatorId} initialHistory onBack={goBack} />}
          {currentView === 'objectives' && <ObjectivesView />}
          {currentView === 'new-objective' && <ObjectiveFormView />}
          {currentView === 'objective-detail' && <ObjectiveDetailView />}
          {currentView === 'new-project' && <ProjectFormView />}
          {currentView === 'edit-action' && <EditActionView />}
          {currentView === 'new-indicator' && <IndicatorFormView />}
          {currentView === 'indicator-status' && <AssignedIndicators indicators={indicators} objectives={objectivesWithProjectProgress} reports={reports} users={availableUsers} ownIds={accountIdentities(session.user.email, organizationPeople)} isSuperAdmin={isSuperAdmin} onSelect={i => navigateTo('indicator-detail', i.name, { indicatorId: i.id })} />}
          {currentView === 'edit-indicator' && <EditIndicatorView />}
          {currentView === 'edit-target' && <EditTargetView />}
          {currentView === 'gcg-review' && isGcg && <ChangeRequests isGcg indicators={indicators} users={organizationPeople} onReload={loadOperationalData} onError={setDataError} />}
          {currentView === 'core-indicators' && isGcg && <CoreIndicators indicators={indicators} objectives={objectivesWithProjectProgress} coreRows={coreIndicatorRows} onReload={loadOperationalData} onError={setDataError} onNotify={notify} onOpenIndicator={indicator => navigateTo('indicator-detail', indicator.name, { indicatorId: indicator.id })} />}
          {currentView === 'settings' && <SettingsView />}
          {currentView === 'indicator-detail' && <IndicatorDetailView />}
          {currentView === 'report-indicator' && <ReportFormView />}
        </div>
      </main>
      {notification && <div role="status" className={`fixed right-5 top-5 z-[100] flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg fade-in ${notification.type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-white text-slate-800'}`}><div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notification.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{notification.type === 'warning' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}</div><span>{notification.message}</span><button onClick={() => setNotification(null)} aria-label="Cerrar notificación" className="ml-1 text-slate-400 hover:text-slate-700">×</button></div>}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-50">
        <button onClick={() => navigateTo('dashboard', 'Monitor estratégico')} className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-[#D71920]' : 'text-slate-500'}`}><LayoutDashboard className="w-5 h-5" /><span className="text-[10px] font-medium">Monitor</span></button>
        {isGeneralManager ? <button onClick={() => navigateTo('new-objective', 'Nuevo Objetivo')} className="flex flex-col items-center gap-1 text-[#1D4ED8]"><div className="bg-blue-50 p-2 rounded-full mb-[-10px] translate-y-[-10px] border shadow-sm"><Plus className="w-5 h-5" /></div><span className="text-[10px] font-medium">Objetivo</span></button> : <button onClick={() => navigateTo('objectives', 'Objetivos')} className="flex flex-col items-center gap-1 text-slate-500"><Target className="w-5 h-5" /><span className="text-[10px] font-medium">Objetivos</span></button>}
        <button onClick={() => navigateTo('bio-indicators', 'Indicadores general')} className="flex flex-col items-center gap-1 text-slate-500"><BarChart3 className="w-5 h-5" /><span className="text-[10px] font-medium">Indicadores general</span></button>
        <button onClick={() => navigateTo(isGcg ? 'gcg-review' : 'change-requests', isGcg ? 'Revisión GCG' : 'Solicitudes')} className="flex flex-col items-center gap-1 text-slate-500"><CheckCircle2 className="w-5 h-5" /><span className="text-[10px] font-medium">{isGcg ? 'Revisión GCG' : 'Solicitudes'}</span></button>
      </div>
    </div>
  );
}
