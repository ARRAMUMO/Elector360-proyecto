// src/pages/OperacionesMasivas.jsx

import { useState, useEffect, useRef, useCallback } from 'react';
import operacionesMasivasService from '../services/operacionesMasivasService';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';

// Mapear errores técnicos a mensajes entendibles
const formatearError = (error) => {
  if (!error) return 'Error desconocido';
  const e = error.toLowerCase();
  if (e.includes('detached frame') || e.includes('target closed') || e.includes('session closed'))
    return 'Error de navegador';
  if (e.includes('no encontrado') || e.includes('no censado') || e.includes('no existe') || e.includes('no aparece'))
    return 'No encontrado en censo electoral';
  if (e.includes('captcha') || e.includes('2captcha'))
    return 'Error de captcha';
  if (e.includes('timeout') || e.includes('navigation'))
    return 'Tiempo de espera agotado';
  if (e.includes('máximo de intentos'))
    return 'Máximo de intentos alcanzado';
  if (e.includes('net::') || e.includes('econnrefused') || e.includes('enotfound'))
    return 'Error de conexión';
  return error.length > 60 ? error.substring(0, 60) + '...' : error;
};

function OperacionesMasivas() {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('consultar');
  const [file, setFile] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [estado, setEstado] = useState(null);
  const [velocidad, setVelocidad] = useState(null); // consultas/min
  const [eta, setEta] = useState(null); // minutos restantes
  const [resultadosRPA, setResultadosRPA] = useState(null);
  const [loadingResultados, setLoadingResultados] = useState(false);
  const prevEstadoRef = useRef(null);
  const intervalRef = useRef(null);
  const prevEnProcesoRef = useRef(null);

  // Función para cargar estado del RPA
  const cargarEstado = useCallback(async () => {
    const resultado = await operacionesMasivasService.obtenerEstado();
    if (resultado.success) {
      const nuevoEstado = resultado.estado;

      // Calcular velocidad y ETA
      const prev = prevEstadoRef.current;
      if (prev && nuevoEstado.enProceso) {
        const completadasDelta = (nuevoEstado.completadas + nuevoEstado.errores) - (prev.completadas + prev.errores);
        const tiempoDelta = (Date.now() - prev._timestamp) / 1000; // segundos

        if (tiempoDelta > 0 && completadasDelta >= 0) {
          const velPorSeg = completadasDelta / tiempoDelta;
          const velPorMin = Math.round(velPorSeg * 60);
          setVelocidad(velPorMin);

          const pendientes = nuevoEstado.pendientes + nuevoEstado.procesando;
          if (velPorSeg > 0) {
            const segsRestantes = pendientes / velPorSeg;
            setEta(Math.ceil(segsRestantes / 60));
          } else {
            setEta(null);
          }
        }
      }

      nuevoEstado._timestamp = Date.now();
      prevEstadoRef.current = nuevoEstado;
      setEstado(nuevoEstado);
    }
  }, []);

  useEffect(() => {
    // Carga inicial
    cargarEstado();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cargarEstado]);

  // Polling dinámico: 3s cuando hay proceso activo, 15s cuando inactivo
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const intervalo = estado?.enProceso ? 3000 : 15000;
    intervalRef.current = setInterval(cargarEstado, intervalo);

    // Limpiar velocidad/ETA cuando no hay proceso
    if (!estado?.enProceso) {
      setVelocidad(null);
      setEta(null);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [estado?.enProceso, cargarEstado]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validar tipo de archivo
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setAlert({ type: 'error', message: 'Solo se permiten archivos Excel (.xlsx, .xls)' });
        return;
      }

      // Validar tamaño (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setAlert({ type: 'error', message: 'El archivo no debe superar los 10MB' });
        return;
      }

      setFile(selectedFile);
      setAlert(null);
    }
  };

  const handleConsultarExcel = async () => {
    if (!file) {
      setAlert({ type: 'error', message: 'Selecciona un archivo Excel' });
      return;
    }

    if (estado?.enProceso) {
      setAlert({ type: 'error', message: 'Hay un proceso en curso. Espera a que termine antes de subir otro archivo.' });
      return;
    }

    setLoading(true);
    setAlert(null);
    setResultados(null);

    const resultado = await operacionesMasivasService.consultarDesdeExcel(file);

    if (resultado.success) {
      setResultados(resultado.resultados);
      const encoladas = resultado.resultados.encoladas || 0;
      setAlert({
        type: 'success',
        message: `Proceso completado: ${encoladas} consultas encoladas`
      });
      // Auto-switch a pestaña Estado si hay encoladas
      if (encoladas > 0) {
        cargarEstado();
        setActiveTab('estado');
      }
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }

    setLoading(false);
  };

  const handleActualizarExcel = async () => {
    if (!file) {
      setAlert({ type: 'error', message: 'Selecciona un archivo Excel' });
      return;
    }

    setLoading(true);
    setAlert(null);
    setResultados(null);

    const resultado = await operacionesMasivasService.actualizarDesdeExcel(file);

    if (resultado.success) {
      setResultados(resultado.resultados);
      setAlert({ 
        type: 'success', 
        message: `✅ Proceso completado: ${resultado.resultados.actualizadas || 0} personas actualizadas` 
      });
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }

    setLoading(false);
  };

  const handleActualizarTodo = async () => {
    if (!confirm('¿Estás seguro de actualizar TODAS las personas de la base de datos? Este proceso puede tomar varios minutos.')) {
      return;
    }

    setLoading(true);
    setAlert(null);

    const resultado = await operacionesMasivasService.actualizarTodo();

    if (resultado.success) {
      setAlert({
        type: 'success',
        message: `Proceso iniciado: ${resultado.data.encoladas || 0} personas encoladas para actualización`
      });
      cargarEstado();
      setActiveTab('estado');
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }

    setLoading(false);
  };

  const handleDescargarPlantilla = async () => {
    const resultado = await operacionesMasivasService.descargarPlantilla();
    if (resultado.success) {
      setAlert({ type: 'success', message: '✅ Plantilla descargada' });
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  const handleGenerarReporte = async () => {
    if (!resultados) {
      setAlert({ type: 'error', message: 'No hay resultados para generar reporte' });
      return;
    }

    const resultado = await operacionesMasivasService.generarReporte(resultados);
    if (resultado.success) {
      setAlert({ type: 'success', message: '✅ Reporte generado y descargado' });
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  // Cargar resultados RPA completados
  const cargarResultadosRPA = async () => {
    setLoadingResultados(true);
    const resultado = await operacionesMasivasService.obtenerResultados();
    if (resultado.success) {
      setResultadosRPA(resultado.data);
    }
    setLoadingResultados(false);
  };

  // Descargar reporte con datos de votación
  const handleDescargarReporteResultados = async () => {
    const resultado = await operacionesMasivasService.descargarReporteResultados();
    if (resultado.success) {
      setAlert({ type: 'success', message: 'Reporte de resultados descargado' });
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  // Auto-cargar resultados cuando el proceso termine (transición enProceso → !enProceso)
  useEffect(() => {
    if (prevEnProcesoRef.current === true && estado && !estado.enProceso && estado.completadas > 0) {
      cargarResultadosRPA();
    }
    prevEnProcesoRef.current = estado?.enProceso ?? null;
  }, [estado?.enProceso]);

  const handleLimpiarCola = async () => {
    if (!confirm('¿Estás seguro de limpiar la cola de consultas completadas (más de 7 días)?')) {
      return;
    }

    const resultado = await operacionesMasivasService.limpiarCola();
    if (resultado.success) {
      setAlert({
        type: 'success',
        message: `Cola limpiada: ${resultado.data.eliminadas || 0} consultas eliminadas`
      });
      cargarEstado();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  // Gestión de errores individuales
  const handleReintentarConsulta = async (id) => {
    const resultado = await operacionesMasivasService.reintentarConsulta(id);
    if (resultado.success) {
      setAlert({ type: 'success', message: 'Consulta reencolada para reintentar' });
      cargarEstado();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  const handleEliminarConsulta = async (id) => {
    const resultado = await operacionesMasivasService.eliminarConsulta(id);
    if (resultado.success) {
      cargarEstado();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  const handleReintentarTodos = async () => {
    if (!confirm(`¿Reintentar las ${estado?.errores || 0} consultas con error?`)) return;

    const resultado = await operacionesMasivasService.reintentarTodosErrores();
    if (resultado.success) {
      setAlert({ type: 'success', message: `${resultado.data.reintentadas} consultas reencoladas` });
      cargarEstado();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  const handleEliminarTodos = async () => {
    if (!confirm(`¿Eliminar todas las ${estado?.errores || 0} consultas con error? Esta acción no se puede deshacer.`)) return;

    const resultado = await operacionesMasivasService.eliminarTodosErrores();
    if (resultado.success) {
      setAlert({ type: 'success', message: `${resultado.data.eliminadas} errores eliminados` });
      cargarEstado();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-800 to-teal-700 bg-clip-text text-transparent">
          Operaciones Masivas
        </h1>
        <p className="text-gray-500 mt-1">
          Gestión masiva de datos con archivos Excel
        </p>
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
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="border-b border-emerald-100">
          <nav className="flex -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('consultar')}
              className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'consultar'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-base sm:text-lg mr-1">🔍</span>
              <span className="hidden sm:inline">Consultar</span>
              <span className="sm:hidden">Consultar</span>
            </button>
            <button
              onClick={() => setActiveTab('actualizar')}
              className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'actualizar'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-base sm:text-lg mr-1">📝</span>
              <span className="hidden sm:inline">Actualizar</span>
              <span className="sm:hidden">Actualizar</span>
            </button>
            <button
              onClick={() => setActiveTab('estado')}
              className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'estado'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-base sm:text-lg mr-1">📊</span>
              <span className="hidden sm:inline">Estado</span>
              <span className="sm:hidden">Estado</span>
            </button>
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {/* Tab 1: Consultar desde Excel */}
          {activeTab === 'consultar' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Consultar Personas desde Excel
                </h3>
                <p className="text-sm text-gray-600">
                  Sube un archivo Excel con documentos para buscar personas en la base de datos o consultar en la Registraduría
                </p>
              </div>

              <button
                onClick={handleDescargarPlantilla}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-primary-300 text-primary-700 rounded-xl hover:bg-primary-50 hover:border-primary-400 transition-all font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar Plantilla Excel
              </button>

              {/* Drag and Drop Area */}
              <div className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all duration-300 ${
                file
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50'
              }`}>
                <input
                  type="file"
                  id="file-upload-consultar"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">{file.name}</p>
                      <p className="text-sm text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setFile(null); }}
                      className="text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Quitar archivo
                    </button>
                  </div>
                ) : (
                  <label htmlFor="file-upload-consultar" className="cursor-pointer block">
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-medium text-primary-600">Click para seleccionar</span>
                        <span className="text-gray-500"> o arrastra aquí</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Excel (.xlsx, .xls) - Máximo 10MB
                      </p>
                    </div>
                  </label>
                )}
              </div>

              {/* Aviso si hay proceso activo */}
              {estado?.enProceso && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Hay un proceso en curso ({estado.pendientes + estado.procesando} pendientes). Espera a que termine para iniciar otro.
                </div>
              )}

              {/* Botón Iniciar Consulta */}
              <button
                onClick={handleConsultarExcel}
                disabled={!file || loading || estado?.enProceso}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                  file && !loading && !estado?.enProceso
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando Excel...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Iniciar Consulta Masiva
                  </>
                )}
              </button>

              {/* Resultados */}
              {resultados && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-blue-900">Resultados del Procesamiento</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                      <p className="text-xs sm:text-sm text-gray-500 mb-1">Total</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{resultados.total || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm border-l-4 border-green-500">
                      <p className="text-xs sm:text-sm text-green-600 mb-1">En BD</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-700">{resultados.encontradas || resultados.encontradasEnBD || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm border-l-4 border-blue-500">
                      <p className="text-xs sm:text-sm text-blue-600 mb-1">Encoladas</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-700">{resultados.encoladas || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm border-l-4 border-red-500">
                      <p className="text-xs sm:text-sm text-red-600 mb-1">Errores</p>
                      <p className="text-xl sm:text-2xl font-bold text-red-700">{resultados.errores || 0}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerarReporte}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar Reporte Excel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Actualizar desde Excel */}
          {activeTab === 'actualizar' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Actualizar Datos de Contacto
                </h3>
                <p className="text-sm text-gray-600">
                  Sube un archivo Excel con documentos y datos de contacto (teléfono, email) para actualizar personas existentes
                </p>
              </div>

              {/* Drag and Drop Area */}
              <div className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all duration-300 ${
                file
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50'
              }`}>
                <input
                  type="file"
                  id="file-upload-actualizar"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-800">{file.name}</p>
                      <p className="text-sm text-blue-600">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setFile(null); }}
                      className="text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Quitar archivo
                    </button>
                  </div>
                ) : (
                  <label htmlFor="file-upload-actualizar" className="cursor-pointer block">
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-medium text-primary-600">Click para seleccionar</span>
                        <span className="text-gray-500"> o arrastra aquí</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Excel (.xlsx, .xls) - Máximo 10MB
                      </p>
                    </div>
                  </label>
                )}
              </div>

              {/* Botón Actualizar */}
              <button
                onClick={handleActualizarExcel}
                disabled={!file || loading}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                  file && !loading
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Actualizando datos...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Actualizar Personas
                  </>
                )}
              </button>

              {/* Actualizar toda la BD */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 sm:p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">
                      Actualizar Toda la Base de Datos
                    </h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Encola TODAS las personas para actualización RPA. Proceso largo.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleActualizarTodo}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Iniciando proceso...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      Actualizar Toda la BD
                    </>
                  )}
                </button>
              </div>

              {/* Resultados */}
              {resultados && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-green-900">Resultados de Actualización</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                      <p className="text-xs sm:text-sm text-gray-500 mb-1">Total</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{resultados.total || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm border-l-4 border-green-500">
                      <p className="text-xs sm:text-sm text-green-600 mb-1">Actualizadas</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-700">{resultados.actualizadas || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm border-l-4 border-red-500">
                      <p className="text-xs sm:text-sm text-red-600 mb-1">Errores</p>
                      <p className="text-xl sm:text-2xl font-bold text-red-700">{resultados.errores || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Estado de Procesamiento */}
          {activeTab === 'estado' && (
            <div className="space-y-6">
              {estado ? (
                <>
                  <div className={`rounded-lg p-6 ${
                    estado.enProceso 
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' 
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">
                        Estado del RPA
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        estado.enProceso 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {estado.enProceso ? 'Procesando' : 'Inactivo'}
                      </span>
                    </div>

                    {estado.enProceso && estado.progreso !== undefined && (
                      <div className="mb-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Progreso</span>
                          <span className="text-sm font-bold text-gray-900">
                            {estado.progreso}% ({estado.completadas + estado.errores}/{estado.total})
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-primary-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${estado.progreso}%` }}
                          ></div>
                        </div>
                        {/* Velocidad y ETA */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            {velocidad !== null ? `${velocidad} consultas/min` : 'Calculando velocidad...'}
                          </span>
                          <span>
                            {eta !== null ? (eta <= 1 ? 'Menos de 1 min restante' : `~${eta} min restantes`) : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 p-6 text-center">
                      <p className="text-sm text-gray-600 mb-1">Pendientes</p>
                      <p className="text-3xl font-bold text-gray-900">{estado.pendientes || 0}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 p-6 text-center">
                      <p className="text-sm text-blue-600 mb-1">Procesando</p>
                      <p className="text-3xl font-bold text-blue-900">{estado.procesando || 0}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 p-6 text-center">
                      <p className="text-sm text-green-600 mb-1">Completadas</p>
                      <p className="text-3xl font-bold text-green-900">{estado.completadas || 0}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 p-6 text-center">
                      <p className="text-sm text-red-600 mb-1">Errores</p>
                      <p className="text-3xl font-bold text-red-900">{estado.errores || 0}</p>
                    </div>
                  </div>

                  {/* Errores recientes con gestión */}
                  {estado.erroresRecientes?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-red-900 text-sm">
                          Errores ({estado.errores})
                        </h4>
                        <div className="flex gap-2">
                          <button
                            onClick={handleReintentarTodos}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            Reintentar Todos
                          </button>
                          <button
                            onClick={handleEliminarTodos}
                            className="text-xs px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                          >
                            Eliminar Todos
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {estado.erroresRecientes.map((err) => (
                          <div key={err._id || err.documento} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm border border-red-100">
                            <span className="font-mono text-gray-700 shrink-0">{err.documento}</span>
                            <span className="text-red-600 text-xs truncate flex-1" title={err.error}>
                              {formatearError(err.error)}
                            </span>
                            <span className="text-gray-400 text-xs shrink-0">
                              {err.intentos}/{err.maximoIntentos}
                            </span>
                            <button
                              onClick={() => handleReintentarConsulta(err._id)}
                              className="shrink-0 p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Reintentar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEliminarConsulta(err._id)}
                              className="shrink-0 p-1 text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resultados con datos de votación */}
                  {(estado.completadas > 0 || resultadosRPA) && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900">Resultados con Datos de Votación</h4>
                        <div className="flex gap-2">
                          <button
                            onClick={cargarResultadosRPA}
                            disabled={loadingResultados}
                            className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                          >
                            {loadingResultados ? 'Cargando...' : 'Ver Resultados'}
                          </button>
                          <button
                            onClick={handleDescargarReporteResultados}
                            className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Descargar Reporte
                          </button>
                        </div>
                      </div>

                      {resultadosRPA && resultadosRPA.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gradient-to-r from-emerald-50 to-teal-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Cédula</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Nombres</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Apellidos</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Departamento</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Municipio</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Puesto</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Mesa</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {resultadosRPA.map((r, i) => (
                                <tr key={i} className={r.estado === 'ERROR' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                  <td className="px-3 py-2 font-mono text-gray-900">{r.documento}</td>
                                  <td className="px-3 py-2 text-gray-700">{r.nombres || '-'}</td>
                                  <td className="px-3 py-2 text-gray-700">{r.apellidos || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600">{r.departamento || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600">{r.municipio || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={r.puesto}>{r.puesto || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600">{r.mesa || '-'}</td>
                                  <td className="px-3 py-2">
                                    {r.estado === 'COMPLETADO' ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
                                    ) : (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700" title={r.error}>Error</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {resultadosRPA && resultadosRPA.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No hay resultados completados aún</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={cargarEstado}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      <span className="mr-2">🔄</span>
                      Actualizar Estado
                    </button>
                    <button
                      onClick={handleLimpiarCola}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      <span className="mr-2">🗑️</span>
                      Limpiar Cola Antigua
                    </button>
                  </div>
                </>
              ) : (
                <Spinner message="Cargando estado..." />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ayuda */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-6">
        <h3 className="font-bold text-emerald-900 mb-3 flex items-center">
          <span className="mr-2">ℹ️</span>
          Informacion Importante
        </h3>
        <ul className="space-y-2 text-sm text-emerald-800">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Los archivos Excel deben contener una columna "documento" con los números de cédula</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Para actualizaciones, incluye columnas: telefono, email, estadoContacto</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Las consultas RPA se procesan en segundo plano y pueden tomar varios minutos</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Puedes revisar el estado del procesamiento en la pestaña "Estado de Procesamiento"</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default OperacionesMasivas;