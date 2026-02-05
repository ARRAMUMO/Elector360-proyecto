// src/components/features/auth/ProtectedRoute.jsx

import { Navigate } from 'react-router-dom';
import authService from '../../../services/authService';

function ProtectedRoute({ children, requiredRole = null }) {
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getStoredUser();

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si requiere un rol específico y no lo tiene, redirigir al dashboard
  if (requiredRole && user?.rol !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si todo está bien, mostrar el componente hijo
  return children;
}

export default ProtectedRoute;