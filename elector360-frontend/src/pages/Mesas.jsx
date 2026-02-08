// src/pages/Mesas.jsx

import { useState, useEffect, useCallback } from 'react';
import personaService from '../services/personaService';
import Spinner from '../components/common/Spinner';

function Mesas() {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [filtros, setFiltros] = useState({
    departamento: '',
    municipio: '',
    nombrePuesto: ''
  });
  const [filtrosAplicados, setFiltrosAplicados] = useState({});

  // Detalle de mesa
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [personasMesa, setPersonasMesa] = useState([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const cargarMesas = useCallback(async (filtrosActivos = {}) => {
    setLoading(true);
    setError(null);
    const resultado = await personaService.obtenerMesas(filtrosActivos);
    if (resultado.success) {
      setMesas(resultado.mesas);
    } else {
      setError(resultado.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarMesas();
  }, [cargarMesas]);

  const aplicarFiltros = () => {
    const activos = {};
    if (filtros.departamento.trim()) activos.departamento = filtros.departamento.trim();
    if (filtros.municipio.trim()) activos.municipio = filtros.municipio.trim();
    if (filtros.nombrePuesto.trim()) activos.nombrePuesto = filtros.nombrePuesto.trim();
    setFiltrosAplicados(activos);
    setMesaSeleccionada(null);
    cargarMesas(activos);
  };

  const limpiarFiltros = () => {
    setFiltros({ departamento: '', municipio: '', nombrePuesto: '' });
    setFiltrosAplicados({});
    setMesaSeleccionada(null);
    cargarMesas();
  };

  const verDetalleMesa = async (mesa) => {
    if (mesaSeleccionada?.mesa === mesa.mesa && mesaSeleccionada?.nombrePuesto === mesa.nombrePuesto) {
      setMesaSeleccionada(null);
      setPersonasMesa([]);
      return;
    }

    setMesaSeleccionada(mesa);
    setLoadingDetalle(true);
    const resultado = await personaService.obtenerPersonasPorMesa({
      departamento: mesa.departamento,
      municipio: mesa.municipio,
      nombrePuesto: mesa.nombrePuesto,
      mesa: mesa.mesa
    });
    if (resultado.success) {
      setPersonasMesa(resultado.personas);
    } else {
      setPersonasMesa([]);
    }
    setLoadingDetalle(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') aplicarFiltros();
  };

  // Calcular totales
  const totalPersonas = mesas.reduce((acc, m) => acc + m.totalPersonas, 0);
  const totalConfirmados = mesas.reduce((acc, m) => acc + m.confirmados, 0);
  const totalPendientes = mesas.reduce((acc, m) => acc + m.pendientes, 0);
  const totalNoContactados = mesas.reduce((acc, m) => acc + m.noContactados, 0);

  const estadoContactoColor = (estado) => {
    const colores = {
      CONFIRMADO: 'bg-emerald-100 text-emerald-800',
      CONTACTADO: 'bg-teal-100 text-teal-800',
      PENDIENTE: 'bg-amber-100 text-amber-800',
      NO_CONTACTADO: 'bg-gray-100 text-gray-700'
    };
    return colores[estado] || 'bg-gray-100 text-gray-700';
  };

  if (loading && mesas.length === 0) {
    return <Spinner message="Cargando mesas de votacion..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-800 to-teal-700 bg-clip-text text-transparent">
          Mesas de Votacion
        </h1>
        <p className="text-gray-500 mt-1">
          Personas registradas por mesa de votacion
        </p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-emerald-100 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-medium">Total Mesas</p>
          <p className="text-2xl font-bold text-gray-900">{mesas.length}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-emerald-100 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-medium">Total Personas</p>
          <p className="text-2xl font-bold text-emerald-700">{totalPersonas.toLocaleString()}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-emerald-100 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-medium">Confirmados</p>
          <p className="text-2xl font-bold text-green-700">{totalConfirmados.toLocaleString()}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-emerald-100 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-medium">Pendientes</p>
          <p className="text-2xl font-bold text-amber-600">{totalPendientes.toLocaleString()}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-emerald-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Departamento"
            value={filtros.departamento}
            onChange={(e) => setFiltros({ ...filtros, departamento: e.target.value })}
            onKeyDown={handleKeyDown}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-gray-50/50"
          />
          <input
            type="text"
            placeholder="Municipio"
            value={filtros.municipio}
            onChange={(e) => setFiltros({ ...filtros, municipio: e.target.value })}
            onKeyDown={handleKeyDown}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-gray-50/50"
          />
          <input
            type="text"
            placeholder="Nombre del puesto"
            value={filtros.nombrePuesto}
            onChange={(e) => setFiltros({ ...filtros, nombrePuesto: e.target.value })}
            onKeyDown={handleKeyDown}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-gray-50/50"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={aplicarFiltros}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm"
          >
            Buscar
          </button>
          {Object.keys(filtrosAplicados).length > 0 && (
            <button
              onClick={limpiarFiltros}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4">
          <p className="text-rose-800 text-sm">{error}</p>
        </div>
      )}

      {/* Tabla de mesas */}
      {mesas.length === 0 && !loading ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-8 border border-emerald-100 text-center">
          <p className="text-gray-500">No se encontraron mesas con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-emerald-100">
              <thead className="bg-gradient-to-r from-emerald-50 to-teal-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">Departamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">Municipio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">Puesto</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">Mesa</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">Confirmados</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">Pendientes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">No Contactados</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {mesas.map((mesa, idx) => {
                  const isSelected = mesaSeleccionada?.mesa === mesa.mesa && mesaSeleccionada?.nombrePuesto === mesa.nombrePuesto && mesaSeleccionada?.departamento === mesa.departamento;
                  return (
                    <tr
                      key={`${mesa.departamento}-${mesa.municipio}-${mesa.nombrePuesto}-${mesa.mesa}-${idx}`}
                      className={`hover:bg-emerald-50/50 transition-colors ${isSelected ? 'bg-emerald-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">{mesa.departamento}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{mesa.municipio}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{mesa.nombrePuesto}</div>
                        {mesa.direccion && (
                          <div className="text-xs text-gray-400">{mesa.direccion}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{mesa.mesa}</td>
                      <td className="px-4 py-3 text-sm text-center font-bold text-emerald-700">{mesa.totalPersonas}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          {mesa.confirmados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {mesa.pendientes}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {mesa.noContactados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => verDetalleMesa(mesa)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {isSelected ? 'Ocultar' : 'Ver detalle'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle de mesa seleccionada */}
      {mesaSeleccionada && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-100 to-teal-50 border-b border-emerald-200/60">
            <h3 className="text-sm font-bold text-emerald-900">
              Detalle - Mesa {mesaSeleccionada.mesa} | {mesaSeleccionada.nombrePuesto} | {mesaSeleccionada.municipio}, {mesaSeleccionada.departamento}
            </h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              {mesaSeleccionada.totalPersonas} personas registradas
            </p>
          </div>

          {loadingDetalle ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              <span className="ml-3 text-sm text-gray-500">Cargando personas...</span>
            </div>
          ) : personasMesa.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              No se encontraron personas en esta mesa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-emerald-100">
                <thead className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">Documento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">Nombres</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">Apellidos</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">Telefono</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">Estado Contacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {personasMesa.map((persona, idx) => (
                    <tr key={persona._id || idx} className="hover:bg-emerald-50/50">
                      <td className="px-4 py-2 text-sm text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{persona.documento}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{persona.nombres}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{persona.apellidos}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{persona.telefono || '-'}</td>
                      <td className="px-4 py-2 text-sm text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoContactoColor(persona.estadoContacto)}`}>
                          {persona.estadoContacto}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Mesas;
