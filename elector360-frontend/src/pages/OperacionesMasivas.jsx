// src/pages/OperacionesMasivas.jsx

import { useState, useEffect } from 'react';
import operacionesMasivasService from '../services/operacionesMasivasService';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';

function OperacionesMasivas() {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('consultar');
  const [file, setFile] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [estado, setEstado] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    cargarEstado();
    const interval = setInterval(() => {
      cargarEstado();
    }, 10000); // Actualizar cada 10 segundos

    return () => clearInterval(interval);
  }, []);

  const cargarEstado = async () => {
    const resultado = await operacionesMasivasService.obtenerEstado();
    if (resultado.success) {
      setEstado(resultado.estado);
    }
  };

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

    setLoading(true);
    setAlert(null);
    setResultados(null);

    const resultado = await operacionesMasivasService.consultarDesdeExcel(file);

    if (resultado.success) {
      setResultados(resultado.resultados);
      setAlert({ 
        type: 'success', 
        message: `✅ Proceso completado: ${resultado.resultados.encoladas || 0} consultas encoladas` 
      });
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
        message: `✅ Proceso iniciado: ${resultado.data.encoladas || 0} personas encoladas para actualización` 
      });
      cargarEstado();
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

  const handleLimpiarCola = async () => {
    if (!confirm('¿Estás seguro de limpiar la cola de consultas completadas (más de 7 días)?')) {
      return;
    }

    const resultado = await operacionesMasivasService.limpiarCola();
    if (resultado.success) {
      setAlert({ 
        type: 'success', 
        message: `✅ Cola limpiada: ${resultado.data.eliminadas || 0} consultas eliminadas` 
      });
      cargarEstado();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          📤 Operaciones Masivas
        </h1>
        <p className="text-gray-600 mt-1">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('consultar')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'consultar'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔍 Consultar desde Excel
            </button>
            <button
              onClick={() => setActiveTab('actualizar')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'actualizar'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📝 Actualizar desde Excel
            </button>
            <button
              onClick={() => setActiveTab('estado')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'estado'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Estado de Procesamiento
            </button>
          </nav>
        </div>

        <div className="p-6">
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

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleDescargarPlantilla}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  <span className="mr-2">📥</span>
                  Descargar Plantilla
                </button>
              </div>

              {/* Drag and Drop Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
                <input
                  type="file"
                  id="file-upload-consultar"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file-upload-consultar" className="cursor-pointer">
                  <div className="space-y-2">
                    <div className="text-6xl">📄</div>
                    <div className="text-sm text-gray-600">
                      {file ? (
                        <span className="font-medium text-primary-600">{file.name}</span>
                      ) : (
                        <>
                          <span className="font-medium text-primary-600">Click para seleccionar</span>
                          {' '}o arrastra un archivo aquí
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Archivos Excel (.xlsx, .xls) - Máximo 10MB
                    </p>
                  </div>
                </label>
              </div>

              <button
                onClick={handleConsultarExcel}
                disabled={!file || loading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Procesando...' : 'Procesar Consultas'}
              </button>

              {/* Resultados */}
              {resultados && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h4 className="font-bold text-blue-900 mb-4">Resultados</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-gray-900">{resultados.total || 0}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-green-600">Encontradas</p>
                      <p className="text-2xl font-bold text-green-900">{resultados.encontradas || 0}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-blue-600">Encoladas</p>
                      <p className="text-2xl font-bold text-blue-900">{resultados.encoladas || 0}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-red-600">Errores</p>
                      <p className="text-2xl font-bold text-red-900">{resultados.errores || 0}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerarReporte}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Generar Reporte Detallado
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
                <input
                  type="file"
                  id="file-upload-actualizar"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file-upload-actualizar" className="cursor-pointer">
                  <div className="space-y-2">
                    <div className="text-6xl">📄</div>
                    <div className="text-sm text-gray-600">
                      {file ? (
                        <span className="font-medium text-primary-600">{file.name}</span>
                      ) : (
                        <>
                          <span className="font-medium text-primary-600">Click para seleccionar</span>
                          {' '}o arrastra un archivo aquí
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Archivos Excel (.xlsx, .xls) - Máximo 10MB
                    </p>
                  </div>
                </label>
              </div>

              <button
                onClick={handleActualizarExcel}
                disabled={!file || loading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Procesando...' : 'Actualizar Personas'}
              </button>

              {/* Actualizar toda la BD */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="font-bold text-yellow-900 mb-2">
                  ⚠️ Actualizar Toda la Base de Datos
                </h4>
                <p className="text-sm text-yellow-800 mb-4">
                  Esto encolará TODAS las personas para actualización con RPA. Puede tomar varios minutos u horas dependiendo de la cantidad.
                </p>
                <button
                  onClick={handleActualizarTodo}
                  disabled={loading}
                  className="w-full bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Iniciando...' : 'Actualizar Toda la BD'}
                </button>
              </div>

              {/* Resultados */}
              {resultados && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h4 className="font-bold text-green-900 mb-4">Resultados</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">Total Procesadas</p>
                      <p className="text-2xl font-bold text-gray-900">{resultados.total || 0}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-green-600">Actualizadas</p>
                      <p className="text-2xl font-bold text-green-900">{resultados.actualizadas || 0}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center col-span-2">
                      <p className="text-sm text-red-600">Errores</p>
                      <p className="text-2xl font-bold text-red-900">{resultados.errores || 0}</p>
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
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Progreso</span>
                          <span className="text-sm font-bold text-gray-900">{estado.progreso}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${estado.progreso}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                      <p className="text-sm text-gray-600 mb-1">Pendientes</p>
                      <p className="text-3xl font-bold text-gray-900">{estado.pendientes || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                      <p className="text-sm text-blue-600 mb-1">Procesando</p>
                      <p className="text-3xl font-bold text-blue-900">{estado.procesando || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                      <p className="text-sm text-green-600 mb-1">Completadas</p>
                      <p className="text-3xl font-bold text-green-900">{estado.completadas || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                      <p className="text-sm text-red-600 mb-1">Errores</p>
                      <p className="text-3xl font-bold text-red-900">{estado.errores || 0}</p>
                    </div>
                  </div>

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
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3 flex items-center">
          <span className="mr-2">ℹ️</span>
          Información Importante
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
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