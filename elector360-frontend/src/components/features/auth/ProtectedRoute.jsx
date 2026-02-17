// src/components/features/auth/ProtectedRoute.jsx

import { Navigate } from 'react-router-dom';
import authService from '../../../services/authService';

function ProtectedRoute({ children, requiredRole = null, allowedRoles = null }) {
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getStoredUser();

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si se pasa allowedRoles (array), verificar que el rol del usuario esté incluido
  if (allowedRoles && !allowedRoles.includes(user?.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si requiere un rol específico y no lo tiene, redirigir al dashboard (legacy)
  if (requiredRole && user?.rol !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si todo está bien, mostrar el componente hijo
  return children;
}

export default ProtectedRoute;