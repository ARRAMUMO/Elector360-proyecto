// src/pages/WorkerMonitor.jsx

import { useState, useEffect } from 'react';
import api from '../services/api';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';

function WorkerMonitor() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [cola, setCola] = useState([]);
  const [colaPagination, setColaPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    cargarDatos();

    if (autoRefresh) {
      const interval = setInterval(() => {
        cargarDatos();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, filtroEstado]);

  const cargarDatos = async () => {
    try {
      const [statsRes, logsRes, colaRes] = await Promise.all([
        api.get('/worker/stats'),
        api.get('/worker/logs?limit=20'),
        api.get(`/worker/cola?limit=50${filtroEstado ? `&estado=${filtroEstado}` : ''}`)
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }

      if (logsRes.data.success) {
        setLogs(logsRes.data.data);
      }

      if (colaRes.data.success) {
        setCola(colaRes.data.data.consultas || []);
        setColaPagination(colaRes.data.data.pagination || { total: 0, page: 1, pages: 1 });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const handlePauseWorker = async () => {
    if (!confirm('¿Pausar el worker RPA?')) return;

    try {
      const response = await api.post('/worker/pause');
      if (response.data.success) {
        setAlert({ type: 'success', message: 'Worker pausado' });
        cargarDatos();
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Error pausando worker' });
    }
  };

  const handleResumeWorker = async () => {
    try {
      const response = await api.post('/worker/resume');
      if (response.data.success) {
        setAlert({ type: 'success', message: 'Worker reanudado' });
        cargarDatos();
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Error reanudando worker' });
    }
  };

  const handleLimpiarCola = async () => {
    if (!confirm('¿Limpiar consultas antiguas (7+ días)?')) return;

    try {
      const response = await api.delete('/worker/clean?dias=7');
      if (response.data.success) {
        setAlert({
          type: 'success',
          message: `${response.data.data.eliminadas} consultas eliminadas`
        });
        cargarDatos();
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Error limpiando cola' });
    }
  };

  const handleRetry = async (consultaId) => {
    try {
      const response = await api.post(`/worker/retry/${consultaId}`);
      if (response.data.success) {
        setAlert({ type: 'success', message: 'Consulta reencolada' });
        cargarDatos();
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Error reintentando' });
    }
  };

  const handleRetryAll = async () => {
    if (!confirm('¿Reintentar TODAS las consultas con error?')) return;

    try {
      const response = await api.post('/worker/retry-all');
      if (response.data.success) {
        setAlert({
          type: 'success',
          message: `${response.data.data.reencoladas} consultas reencoladas`
        });
        cargarDatos();
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Error reintentando' });
    }
  };

  const handleEliminarConsulta = async (consultaId) => {
    if (!confirm('¿Eliminar esta consulta de la cola?')) return;

    try {
      const response = await api.delete(`/worker/consulta/${consultaId}`);
      if (response.data.success) {
        setAlert({ type: 'success', message: 'Consulta eliminada' });
        cargarDatos();
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Error eliminando' });
    }
  };

  const handleCambiarPrioridad = async (consultaId, prioridad) => {
    try {
      const response = await api.patch(`/worker/consulta/${consultaId}/prioridad`, { prioridad });
      if (response.data.success) {
        setAlert({ type: 'success', message: 'Prioridad actualizada' });
        cargarDatos();
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Error cambiando prioridad' });
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      EN_COLA: 'bg-yellow-100 text-yellow-800',
      PROCESANDO: 'bg-blue-100 text-blue-800',
      COMPLETADO: 'bg-green-100 text-green-800',
      ERROR: 'bg-red-100 text-red-800'
    };
    return badges[estado] || 'bg-gray-100 text-gray-800';
  };

  const getPrioridadBadge = (prioridad) => {
    const badges = {
      1: 'bg-red-100 text-red-800',
      2: 'bg-yellow-100 text-yellow-800',
      3: 'bg-gray-100 text-gray-800'
    };
    const labels = { 1: 'Alta', 2: 'Media', 3: 'Baja' };
    return { className: badges[prioridad] || 'bg-gray-100', label: labels[prioridad] || 'Normal' };
  };

  const getCircuitBreakerColor = (state) => {
    const colors = {
      CLOSED: 'bg-green-100 text-green-800 border-green-200',
      OPEN: 'bg-red-100 text-red-800 border-red-200',
      HALF_OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[state] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading && !stats) {
    return <Spinner message="Cargando monitor..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            🤖 Monitor RPA Worker
          </h1>
          <p className="text-gray-600 mt-1">
            Monitoreo y gestión de la cola de consultas
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>

          <button
            onClick={cargarDatos}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📊 Estadísticas
          </button>
          <button
            onClick={() => setActiveTab('cola')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'cola'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📋 Cola ({colaPagination.total})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📜 Logs Recientes
          </button>
        </nav>
      </div>

      {stats && (
        <>
          {/* Tab: Estadísticas */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Circuit Breaker Status */}
              <div className={`rounded-xl border-2 p-6 ${getCircuitBreakerColor(stats.worker.circuitBreaker.state)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold mb-1">Circuit Breaker</h3>
                    <p className="text-sm opacity-80">Estado: {stats.worker.circuitBreaker.state}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Fallos: {stats.worker.circuitBreaker.failureCount}</p>
                    <p className="text-sm">Éxitos: {stats.worker.circuitBreaker.successCount}</p>
                  </div>
                </div>
              </div>

              {/* Estadísticas Principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <p className="text-sm text-gray-600 mb-1">Total Procesadas</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.worker.totalProcessed}</p>
                  <p className="text-xs text-green-600 mt-1">Éxito: {stats.worker.successRate}</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <p className="text-sm text-gray-600 mb-1">En Cola</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.cola.EN_COLA || 0}</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <p className="text-sm text-gray-600 mb-1">Con Error</p>
                  <p className="text-3xl font-bold text-red-600">{stats.cola.ERROR || 0}</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <p className="text-sm text-gray-600 mb-1">Tiempo Promedio</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {(stats.worker.averageTime / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>

              {/* Controles */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Controles del Worker</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handlePauseWorker}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                  >
                    ⏸️ Pausar Worker
                  </button>
                  <button
                    onClick={handleResumeWorker}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    ▶️ Reanudar Worker
                  </button>
                  <button
                    onClick={handleRetryAll}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    🔄 Reintentar Errores
                  </button>
                  <button
                    onClick={handleLimpiarCola}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    🗑️ Limpiar Antiguas
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Cola */}
          {activeTab === 'cola' && (
            <div className="space-y-4">
              {/* Filtros */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Filtrar por estado:</label>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="EN_COLA">En Cola</option>
                    <option value="PROCESANDO">Procesando</option>
                    <option value="COMPLETADO">Completado</option>
                    <option value="ERROR">Error</option>
                  </select>
                  <span className="text-sm text-gray-500">
                    Total: {colaPagination.total} consultas
                  </span>
                </div>
              </div>

              {/* Tabla de Cola */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Documento
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Prioridad
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Intentos
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Usuario
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cola.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            No hay consultas en la cola
                          </td>
                        </tr>
                      ) : (
                        cola.map((consulta) => {
                          const prioridadInfo = getPrioridadBadge(consulta.prioridad);
                          return (
                            <tr key={consulta._id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {consulta.documento}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadge(consulta.estado)}`}>
                                  {consulta.estado}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {consulta.estado === 'EN_COLA' ? (
                                  <select
                                    value={consulta.prioridad || 2}
                                    onChange={(e) => handleCambiarPrioridad(consulta._id, parseInt(e.target.value))}
                                    className={`px-2 py-1 text-xs font-semibold rounded-full border-0 cursor-pointer ${prioridadInfo.className}`}
                                  >
                                    <option value={1}>Alta</option>
                                    <option value={2}>Media</option>
                                    <option value={3}>Baja</option>
                                  </select>
                                ) : (
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${prioridadInfo.className}`}>
                                    {prioridadInfo.label}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {consulta.intentos || 0}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {consulta.usuario?.perfil?.nombres || consulta.usuario?.email || '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(consulta.createdAt).toLocaleString('es-CO')}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-2">
                                {consulta.estado === 'ERROR' && (
                                  <button
                                    onClick={() => handleRetry(consulta._id)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Reintentar"
                                  >
                                    🔄
                                  </button>
                                )}
                                {['EN_COLA', 'ERROR'].includes(consulta.estado) && (
                                  <button
                                    onClick={() => handleEliminarConsulta(consulta._id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Eliminar"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Logs */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">📜 Logs Recientes</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Documento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Intentos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tiempo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {log.documento}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadge(log.estado)}`}>
                            {log.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.intentos}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.tiempoEjecucion ? `${(log.tiempoEjecucion / 1000).toFixed(1)}s` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.createdAt).toLocaleString('es-CO')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {log.estado === 'ERROR' && (
                            <button
                              onClick={() => handleRetry(log._id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              🔄 Reintentar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WorkerMonitor;
