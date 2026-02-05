// src/pages/Dashboard.jsx

import { useState, useEffect } from 'react';
import authService from '../services/authService';
import dashboardService from '../services/dashboardService';
import Spinner from '../components/common/Spinner';

function Dashboard() {
  const user = authService.getStoredUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarStats();
  }, []);

  const cargarStats = async () => {
    const resultado = await dashboardService.obtenerEstadisticas();
    if (resultado.success) {
      setStats(resultado.estadisticas);
    }
    setLoading(false);
  };

  if (loading) {
    return <Spinner message="Cargando estadísticas..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header de la página */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="text-gray-600 mt-1">
          Bienvenido, {user?.perfil?.nombres}
        </p>
      </div>

      {/* Estadísticas Principales */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Personas */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-sm text-gray-600 font-medium">Total Personas</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalPersonas.toLocaleString()}
            </p>
          </div>

          {/* Actualizadas */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">✅</span>
              </div>
              <p className="text-sm text-gray-600 font-medium">Actualizadas</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.personasActualizadas.toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {stats.porcentajeActualizadas}% del total
            </p>
          </div>

          {/* Pendientes */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">⏳</span>
              </div>
              <p className="text-sm text-gray-600 font-medium">Pendientes</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.personasPendientes.toLocaleString()}
            </p>
          </div>

          {/* Consultas Hoy */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-sm text-gray-600 font-medium">Consultas Hoy</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.consultasHoy.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Monitor RPA (Solo Admin) */}
      {user?.rol === 'ADMIN' && stats?.statsRPA && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">🤖</span>
            Monitor RPA
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-gray-600 text-sm mb-1">En Cola</p>
              <p className="text-2xl font-bold text-blue-900">{stats.statsRPA.enCola}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-gray-600 text-sm mb-1">Procesadas Hoy</p>
              <p className="text-2xl font-bold text-green-900">{stats.statsRPA.procesadasHoy}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-gray-600 text-sm mb-1">Errores Hoy</p>
              <p className="text-2xl font-bold text-red-900">{stats.statsRPA.erroresHoy}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-gray-600 text-sm mb-1">Costo Hoy</p>
              <p className="text-2xl font-bold text-purple-900">${stats.statsRPA.costoHoy}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error al cargar */}
      {!stats && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="font-bold text-yellow-900 mb-1">
                No se pudieron cargar las estadísticas
              </h3>
              <p className="text-yellow-800 text-sm">
                Verifica que el backend esté corriendo en http://localhost:8080
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;