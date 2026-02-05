// src/pages/Login.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@elector360.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Si ya está autenticado, redirigir al dashboard
  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await authService.login(email, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  if (loading) {
    return <Spinner fullScreen message="Iniciando sesión..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full animate-fade-in">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🗳️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Elector360
          </h1>
          <p className="text-gray-600">
            Sistema de Gestión Electoral
          </p>
        </div>

        {/* Alerta de error */}
        {error && (
          <div className="mb-6">
            <Alert type="error" message={error} onClose={() => setError('')} />
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            Iniciar Sesión
          </button>
        </form>

        {/* Credenciales de prueba */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800 mb-2 font-medium">
            Credenciales de Prueba:
          </p>
          <div className="text-xs text-blue-700 space-y-1">
            <p>Email: admin@elector360.com</p>
            <p>Password: password123</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Elector360 v1.0.0 © 2024
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;