import React from 'react';

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) { console.error('Gestión Estratégica: error de pantalla', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section role="alert" className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">No se pudo mostrar esta pantalla</h1>
        <p className="text-slate-600 mt-3">Ocurrió un error al cargar Gestión Estratégica. Recarga la aplicación para volver a intentarlo. No se han borrado tus datos ni cerrado tu sesión.</p>
        <button onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white">Recargar aplicación</button>
      </section>
    </main>;
  }
}
