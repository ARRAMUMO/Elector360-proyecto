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
    return <Spinner message="Cargando estadisticas..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header de la pagina */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-800 to-teal-700 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-gray-500 mt-1">
          Bienvenido, {user?.perfil?.nombres}
        </p>
      </div>

      {/* Estadisticas Principales */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Personas */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Total Personas</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalPersonas.toLocaleString()}
            </p>
          </div>

          {/* Actualizadas */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">✅</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Actualizadas</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.personasActualizadas.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              {stats.porcentajeActualizadas}% del total
            </p>
          </div>

          {/* Pendientes */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">⏳</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Pendientes</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.personasPendientes.toLocaleString()}
            </p>
          </div>

          {/* Consultas Hoy */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Consultas Hoy</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.consultasHoy.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Monitor RPA (Solo Admin) */}
      {user?.rol === 'ADMIN' && stats?.statsRPA && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">🤖</span>
            Monitor RPA
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 text-center border border-emerald-100/50">
              <p className="text-gray-500 text-sm mb-1">En Cola</p>
              <p className="text-2xl font-bold text-emerald-900">{stats.statsRPA.enCola}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 text-center border border-green-100/50">
              <p className="text-gray-500 text-sm mb-1">Procesadas Hoy</p>
              <p className="text-2xl font-bold text-green-900">{stats.statsRPA.procesadasHoy}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-lg p-4 text-center border border-rose-100/50">
              <p className="text-gray-500 text-sm mb-1">Errores Hoy</p>
              <p className="text-2xl font-bold text-red-800">{stats.statsRPA.erroresHoy}</p>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-4 text-center border border-teal-100/50">
              <p className="text-gray-500 text-sm mb-1">Costo Hoy</p>
              <p className="text-2xl font-bold text-teal-900">${stats.statsRPA.costoHoy}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error al cargar */}
      {!stats && !loading && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="font-bold text-amber-900 mb-1">
                No se pudieron cargar las estadisticas
              </h3>
              <p className="text-amber-800 text-sm">
                Verifica que el backend este corriendo en http://localhost:8080
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
