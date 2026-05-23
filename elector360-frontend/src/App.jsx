// src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/features/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consulta from './pages/Consulta';
import Personas from './pages/Personas';
import Mesas from './pages/Mesas';
import Perfil from './pages/Perfil';
import Usuarios from './pages/Usuarios';
import OperacionesMasivas from './pages/OperacionesMasivas';
import Campanas from './pages/Campanas';
import authService from './services/authService';

// Importar
import WorkerMonitor from './pages/WorkerMonitor';
import E14 from './pages/E14';
import Informes from './pages/Informes';

function App() {
  const isAuthenticated = authService.isAuthenticated();

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública - Login */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          } 
        />

        {/* Rutas protegidas con Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="consulta" element={<Consulta />} />
          <Route path="personas" element={<Personas />} />
          <Route path="mesas" element={<Mesas />} />
          <Route path="e14" element={<E14 />} />
          <Route path="perfil" element={<Perfil />} />
          
          {/* Rutas para Admin y Coordinador */}
          <Route
            path="operaciones-masivas"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COORDINADOR']}>
                <OperacionesMasivas />
              </ProtectedRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COORDINADOR']}>
                <Usuarios />
              </ProtectedRoute>
            }
          />

          {/* Rutas solo para Admin */}
          <Route
            path="campanas"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <Campanas />
              </ProtectedRoute>
            }
          />
          <Route
            path="worker-monitor"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <WorkerMonitor />
              </ProtectedRoute>
            }
          />
          <Route
            path="informes"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <Informes />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Ruta 404 */}
        <Route
          path="*"
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Navigate to="/login" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;