// src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/features/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consulta from './pages/Consulta';
import Personas from './pages/Personas';
import Perfil from './pages/Perfil';
import Usuarios from './pages/Usuarios';
import OperacionesMasivas from './pages/OperacionesMasivas';
import authService from './services/authService';

// Importar
import WorkerMonitor from './pages/WorkerMonitor';

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
          <Route path="perfil" element={<Perfil />} />
          
          {/* Rutas solo para Admin */}
          <Route 
            path="operaciones-masivas" 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <OperacionesMasivas />
              </ProtectedRoute>
            } 
          />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <Usuarios />
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