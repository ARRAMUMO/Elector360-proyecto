// src/pages/Dashboard.jsx

import { useState, useEffect } from 'react';
import authService from '../services/authService';
import campanaService from '../services/campanaService';
import dashboardService from '../services/dashboardService';
import Spinner from '../components/common/Spinner';

function Dashboard() {
  const user = authService.getStoredUser();
  const esCoordi = user?.rol === 'COORDINADOR';
  const esAdmin = user?.rol === 'ADMIN';
  const esLider = user?.rol === 'LIDER';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [misCampanas, setMisCampanas] = useState([]);
  const [campanaActiva, setCampanaActivaState] = useState(() => authService.getCampanaActiva());

  useEffect(() => {
    if (esCoordi || esAdmin || esLider) {
      cargarMisCampanas().then(() => cargarStats());
    } else {
      cargarStats();
    }
  }, []);

  const cargarStats = async () => {
    const resultado = await dashboardService.obtenerEstadisticas();
    if (resultado.success) {
      setStats(resultado.estadisticas);
    }
    setLoading(false);
  };

  const cargarMisCampanas = async () => {
    const res = await campanaService.misCampanas();

    if (res.success && res.data?.length > 0) {
      setMisCampanas(res.data);
      const activa = authService.getCampanaActiva();
      if (!activa && res.data.length === 1) {
        const id = String(res.data[0]._id);
        authService.setCampanaActiva(id);
        setCampanaActivaState(id);
      }
      return;
    }

    // Fallback desde localStorage
    if (user?.campana) {
      const campanaId = String(user.campana._id || user.campana);
      setMisCampanas([{
        _id: campanaId,
        nombre: user.campana.nombre || 'Mi Campaña',
        estado: user.campana.estado || 'ACTIVA',
      }]);
      const activa = authService.getCampanaActiva();
      if (!activa) {
        authService.setCampanaActiva(campanaId);
        setCampanaActivaState(campanaId);
      }
    }
  };

  const seleccionarCampana = (campanaId) => {
    authService.setCampanaActiva(campanaId);
    setCampanaActivaState(campanaId);
    cargarStats();
  };

  if (loading) {
    return <Spinner message="Cargando estadisticas..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-800 to-teal-700 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Bienvenido, {user?.perfil?.nombres}
            {user?.campana?.nombre && (
              <span className="ml-2 text-sm text-teal-600 font-medium">
                | {user.campana.nombre}
              </span>
            )}
          </p>
        </div>

      </div>

      {/* Selección de campaña — COORDINADOR y LIDER */}
      {(esCoordi || esLider) && misCampanas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-lg">🏛️</span>
            Mis Campañas
            {misCampanas.length > 1 && (
              <span className="text-xs text-gray-400 font-normal">— Selecciona la que deseas gestionar</span>
            )}
          </h2>
          <div className={`grid gap-3 ${misCampanas.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {misCampanas.map(c => {
              const activa = campanaActiva === String(c._id);
              const estadoColor = c.estado === 'ACTIVA'
                ? 'bg-green-100 text-green-700'
                : c.estado === 'INACTIVA'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-500';
              return (
                <button
                  key={c._id}
                  onClick={() => seleccionarCampana(String(c._id))}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    activa
                      ? 'border-teal-500 bg-teal-50 shadow-md ring-2 ring-teal-200'
                      : 'border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${activa ? 'text-teal-800' : 'text-gray-800'}`}>
                        {c.nombre}
                      </p>
                      {c.candidato?.nombres && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {c.candidato.nombres} {c.candidato.apellidos}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor}`}>
                        {c.estado}
                      </span>
                      {activa && (
                        <span className="text-xs text-teal-600 font-semibold">✓ Activa</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-800">{c.totalPersonas ?? '—'}</p>
                      <p className="text-xs text-gray-400">Personas</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-800">{c.lideres ?? '—'}</p>
                      <p className="text-xs text-gray-400">Líderes</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">{c.confirmadas ?? '—'}</p>
                      <p className="text-xs text-gray-400">Confirmadas</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Estadisticas Principales */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Total Personas</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalPersonas.toLocaleString()}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">✅</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Actualizadas</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.personasActualizadas.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">{stats.porcentajeActualizadas}% del total</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">⏳</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Pendientes</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.personasPendientes.toLocaleString()}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Consultas Hoy</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.consultasHoy.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Monitor RPA */}
      {(esAdmin || esCoordi) && stats?.statsRPA && (
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
              <h3 className="font-bold text-amber-900 mb-1">No se pudieron cargar las estadisticas</h3>
              <p className="text-amber-800 text-sm">Verifica que el backend este corriendo en http://localhost:8080</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
