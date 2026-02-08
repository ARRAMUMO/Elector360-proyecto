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
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-teal-50 via-40% via-green-50 via-60% to-cyan-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-300 rounded-full opacity-25 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-300 rounded-full opacity-25 blur-3xl"></div>
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-green-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-200 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in relative z-10 border border-white/50">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 via-teal-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
            <span className="text-4xl">🗳️</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-700 via-teal-600 to-green-700 bg-clip-text text-transparent mb-2">
            Elector360
          </h1>
          <p className="text-gray-500">
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
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-gray-50/50 transition-colors"
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
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-gray-50/50 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 text-white py-3 rounded-lg hover:from-emerald-600 hover:via-teal-600 hover:to-green-700 font-medium transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            Iniciar Sesión
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Elector360 v1.0.0 © 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;