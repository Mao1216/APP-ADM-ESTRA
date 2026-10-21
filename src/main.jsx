import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import AppErrorBoundary from './AppErrorBoundary.jsx'
import './index.css'

const App = lazy(() => import('./App.jsx'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-slate-600" role="status">Cargando Gestión Estratégica…</main>}>
        <App />
      </Suspense>
    </AppErrorBoundary>
  </React.StrictMode>,
)
