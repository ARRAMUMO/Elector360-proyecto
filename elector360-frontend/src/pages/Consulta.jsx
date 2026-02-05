// src/pages/Consulta.jsx
import { useState } from 'react';
import consultaService from '../services/consultaService';
import Alert from '../components/common/Alert';

function Consulta() {
  const [documento, setDocumento] = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [alert, setAlert] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [consultaRPA, setConsultaRPA] = useState(null);
  const [progreso, setProgreso] = useState(0);
  const [estadoBusqueda, setEstadoBusqueda] = useState(null); // Estado de la búsqueda

  // Estados para el modal de confirmación
  const [showModalConfirmar, setShowModalConfirmar] = useState(false);
  const [datosConfirmacion, setDatosConfirmacion] = useState({
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    departamento: '',
    municipio: '',
    zona: '',
    nombrePuesto: '',
    direccion: '',
    mesa: ''
  });
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    setResultado(null);
    setConsultaRPA(null);
    setProgreso(0);
    setEstadoBusqueda({ tipo: 'buscando', documento });

    try {
      // Buscar persona
      const respuesta = await consultaService.buscarPersona(documento);
      console.log('Respuesta buscarPersona:', respuesta);

      if (respuesta.success && respuesta.data) {
        const data = respuesta.data;
        // El backend usa 'encontrado' y 'consultaId', no 'encontrada' y 'consulta._id'
        const { encontrado, enBD, enCola, persona, consultaId, mensaje } = data;

        // Caso 1: Persona encontrada en BD y actualizada (sin necesidad de RPA)
        if (encontrado && persona && !enCola) {
          setResultado(persona);
          setEstadoBusqueda({
            tipo: 'encontrada_bd',
            documento,
            fuente: 'Base de Datos',
            fecha: new Date().toLocaleString()
          });
          setAlert({
            type: 'success',
            message: mensaje || '✅ Persona encontrada en la base de datos'
          });
        }
        // Caso 2: Persona encontrada pero desactualizada - mostrar datos y consultar RPA
        else if (persona && consultaId) {
          // Mostrar datos actuales mientras se actualiza
          setResultado(persona);
          setConsultaRPA({ _id: consultaId, estado: data.estado });
          setEstadoBusqueda({
            tipo: 'actualizando_rpa',
            documento,
            consultaId: consultaId,
            fuente: 'Base de Datos (actualizando...)',
            fecha: new Date().toLocaleString()
          });
          setAlert({
            type: 'info',
            message: mensaje || '🔄 Persona encontrada. Actualizando datos desde Registraduría...'
          });
          iniciarPolling(consultaId);
        }
        // Caso 3: Persona no está en BD, se encola consulta RPA
        else if (consultaId && !persona) {
          setConsultaRPA({ _id: consultaId, estado: data.estado });
          setEstadoBusqueda({
            tipo: 'consultando_rpa',
            documento,
            consultaId: consultaId,
            fecha: new Date().toLocaleString()
          });
          setAlert({ type: 'info', message: mensaje || '🤖 Consultando en la Registraduría...' });
          iniciarPolling(consultaId);
        }
        // Caso 4: Persona no encontrada y no se puede consultar RPA
        else if (enBD === false && !persona && !consultaId) {
          setEstadoBusqueda({
            tipo: 'no_encontrada',
            documento,
            fecha: new Date().toLocaleString()
          });
          setAlert({
            type: 'warning',
            message: mensaje || '⚠️ Esta persona no se encuentra registrada'
          });
        }
        // Caso fallback
        else {
          // Si hay algún dato de persona, mostrarlo
          if (persona) {
            setResultado(persona);
          }
          setEstadoBusqueda({
            tipo: persona ? 'encontrada_bd' : 'procesada',
            documento,
            fuente: persona ? 'Base de Datos' : undefined,
            fecha: new Date().toLocaleString()
          });
          setAlert({
            type: persona ? 'success' : 'info',
            message: mensaje || (persona ? '✅ Persona encontrada' : 'Consulta procesada')
          });
        }
      } else {
        // Error del servidor
        setEstadoBusqueda({
          tipo: 'error',
          documento,
          error: respuesta.error || 'Error en la búsqueda',
          fecha: new Date().toLocaleString()
        });
        setAlert({
          type: 'error',
          message: respuesta.error || 'Error en la búsqueda'
        });
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setEstadoBusqueda({
        tipo: 'error',
        documento,
        error: 'Error de conexión con el servidor',
        fecha: new Date().toLocaleString()
      });
      setAlert({ type: 'error', message: 'Error de conexión con el servidor' });
    } finally {
      setLoading(false);
    }
  };

  const iniciarPolling = async (consultaId) => {
    if (!consultaId) return;
    setPolling(true);
    let progresoActual = 0;
    let intentos = 0;
    let errores429 = 0;
    const maxIntentos = 36; // 36 intentos x 5 segundos = 3 minutos máximo
    let intervaloActual = 5000; // 5 segundos inicial

    // Intervalo para actualizar la barra de progreso
    const intervaloProgreso = setInterval(() => {
      progresoActual += 1.5;
      if (progresoActual <= 90) {
        setProgreso(progresoActual);
      }
    }, 500);

    // Función para verificar el estado de la consulta
    const verificarEstado = async () => {
      intentos++;
      console.log(`Polling intento ${intentos}/${maxIntentos} para consulta ${consultaId}`);

      try {
        const resultado = await consultaService.obtenerEstado(consultaId);
        console.log('Estado actual:', resultado);

        // Reset errores 429 si la consulta fue exitosa
        if (resultado.success) {
          errores429 = 0;
          intervaloActual = 5000; // Restaurar intervalo normal
        }

        if (resultado.success && resultado.consulta) {
          setConsultaRPA(resultado.consulta);

          // Consulta completada exitosamente
          if (resultado.consulta.estado === 'COMPLETADO') {
            clearInterval(intervaloProgreso);
            setProgreso(100);
            setPolling(false);

            // Obtener los datos de la persona
            const datosPersona = resultado.consulta.persona || resultado.consulta.datosPersona;
            console.log('Datos persona obtenidos:', datosPersona);

            if (datosPersona) {
              setResultado(datosPersona);
              setEstadoBusqueda(prev => ({
                ...prev,
                tipo: 'completada_rpa',
                fuente: 'Registraduría Nacional',
                tiempoEjecucion: resultado.consulta.tiempoEjecucion
              }));
              setAlert({ type: 'success', message: '✅ Consulta completada exitosamente' });
            }
            return; // Terminado
          }

          // Consulta con error
          if (resultado.consulta.estado === 'ERROR') {
            clearInterval(intervaloProgreso);
            setPolling(false);
            setEstadoBusqueda(prev => ({
              ...prev,
              tipo: 'error_rpa',
              error: resultado.consulta.error || 'Error en la consulta'
            }));
            setAlert({
              type: 'error',
              message: resultado.consulta.error || 'Error al consultar en la Registraduría'
            });
            return; // Terminado con error
          }

          // Aún procesando - continuar polling
          if (intentos < maxIntentos) {
            setTimeout(verificarEstado, intervaloActual);
          } else {
            // Timeout
            clearInterval(intervaloProgreso);
            setPolling(false);
            setAlert({ type: 'warning', message: '⚠️ La consulta está tomando más tiempo del esperado. Por favor, intenta de nuevo.' });
          }
        } else {
          // Error al obtener estado - verificar si es 429
          if (resultado.error?.includes('Demasiadas')) {
            errores429++;
            // Aumentar intervalo con backoff exponencial
            intervaloActual = Math.min(intervaloActual * 1.5, 15000);
            console.log(`Rate limit alcanzado (${errores429}x), aumentando intervalo a ${intervaloActual}ms`);
          }

          if (intentos < maxIntentos) {
            setTimeout(verificarEstado, intervaloActual);
          } else {
            clearInterval(intervaloProgreso);
            setPolling(false);
            setAlert({ type: 'error', message: resultado.error || 'Error al obtener estado de la consulta' });
          }
        }
      } catch (error) {
        console.error('Error en polling:', error);
        if (intentos < maxIntentos) {
          setTimeout(verificarEstado, intervaloActual);
        } else {
          clearInterval(intervaloProgreso);
          setPolling(false);
          setAlert({ type: 'error', message: 'Error de conexión. Por favor, intenta de nuevo.' });
        }
      }
    };

    // Iniciar el polling después de un pequeño delay
    setTimeout(verificarEstado, 3000);
  };

  const limpiar = () => {
    setDocumento('');
    setResultado(null);
    setConsultaRPA(null);
    setAlert(null);
    setProgreso(0);
    setEstadoBusqueda(null);
    setShowModalConfirmar(false);
    setDatosConfirmacion({
      nombres: '',
      apellidos: '',
      telefono: '',
      email: '',
      departamento: '',
      municipio: '',
      zona: '',
      nombrePuesto: '',
      direccion: '',
      mesa: ''
    });
  };

  // Abrir modal para agregar persona a la base de datos
  const abrirModalConfirmar = () => {
    if (!resultado) return;

    // Pre-llenar los campos con los datos existentes
    const rawPuesto = resultado.puesto || {};
    const rawDatosElectorales = resultado.datosElectorales || {};

    setDatosConfirmacion({
      nombres: resultado.nombres || '',
      apellidos: resultado.apellidos || '',
      telefono: resultado.telefono || '',
      email: resultado.email || '',
      departamento: rawPuesto.departamento || rawDatosElectorales.departamento || resultado.departamento || '',
      municipio: rawPuesto.municipio || rawDatosElectorales.municipio || resultado.municipio || '',
      zona: rawPuesto.zona || rawDatosElectorales.zona || resultado.zona || '',
      nombrePuesto: rawPuesto.nombrePuesto || rawDatosElectorales.puestoVotacion || rawDatosElectorales.nombrePuesto || resultado.puestoVotacion || resultado.nombrePuesto || '',
      direccion: rawPuesto.direccion || rawDatosElectorales.direccion || resultado.direccion || '',
      mesa: rawPuesto.mesa || rawDatosElectorales.mesa || resultado.mesa || ''
    });
    setShowModalConfirmar(true);
  };

  // Manejar cambios en el formulario de confirmación
  const handleConfirmacionChange = (e) => {
    const { name, value } = e.target;
    setDatosConfirmacion(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Guardar persona confirmada
  const confirmarYGuardar = async () => {
    if (!resultado?._id) {
      setAlert({ type: 'error', message: 'No se puede guardar: falta el ID de la persona' });
      return;
    }

    setGuardando(true);

    try {
      // Construir datos adicionales incluyendo nombres, apellidos y puesto de votación
      const datosAdicionales = {
        nombres: datosConfirmacion.nombres.trim() || undefined,
        apellidos: datosConfirmacion.apellidos.trim() || undefined,
        telefono: datosConfirmacion.telefono.trim() || undefined,
        email: datosConfirmacion.email.trim() || undefined,
        puesto: {
          departamento: datosConfirmacion.departamento.trim() || undefined,
          municipio: datosConfirmacion.municipio.trim() || undefined,
          zona: datosConfirmacion.zona.trim() || undefined,
          nombrePuesto: datosConfirmacion.nombrePuesto.trim() || undefined,
          direccion: datosConfirmacion.direccion.trim() || undefined,
          mesa: datosConfirmacion.mesa.trim() || undefined
        }
      };

      // Limpiar campos vacíos del puesto
      Object.keys(datosAdicionales.puesto).forEach(key => {
        if (!datosAdicionales.puesto[key]) {
          delete datosAdicionales.puesto[key];
        }
      });

      if (Object.keys(datosAdicionales.puesto).length === 0) {
        delete datosAdicionales.puesto;
      }

      const respuesta = await consultaService.confirmarPersona(resultado._id, datosAdicionales);

      if (respuesta.success) {
        setAlert({ type: 'success', message: '✅ Persona agregada a tu base exitosamente' });
        setShowModalConfirmar(false);
        // Actualizar el resultado con los nuevos datos
        setResultado(respuesta.persona || resultado);
        setEstadoBusqueda(prev => ({
          ...prev,
          tipo: 'encontrada_bd',
          fuente: 'Base de Datos'
        }));
      } else {
        setAlert({ type: 'error', message: respuesta.error || 'Error al guardar la persona' });
      }
    } catch (error) {
      console.error('Error al confirmar persona:', error);
      setAlert({ type: 'error', message: 'Error al guardar la persona' });
    } finally {
      setGuardando(false);
    }
  };

  // Función para solicitar actualización de datos electorales via RPA
  const solicitarActualizacion = async () => {
    if (!resultado?.documento) return;

    setLoading(true);
    setAlert({ type: 'info', message: '🔄 Creando consulta en Registraduría...' });
    setEstadoBusqueda(prev => ({
      ...prev,
      tipo: 'consultando_rpa',
      fuente: undefined
    }));

    try {
      // Usar el endpoint POST /consultas para crear una nueva consulta RPA
      const respuesta = await consultaService.crearConsultaRPA(resultado.documento);
      console.log('Respuesta crearConsultaRPA:', respuesta);

      if (respuesta.success && respuesta.consulta?._id) {
        setConsultaRPA(respuesta.consulta);
        setEstadoBusqueda(prev => ({
          ...prev,
          tipo: 'actualizando_rpa',
          consultaId: respuesta.consulta._id,
          fuente: 'Consultando Registraduría...',
          fecha: new Date().toLocaleString()
        }));
        setAlert({ type: 'info', message: '🤖 Consulta encolada. Esperando resultados...' });
        iniciarPolling(respuesta.consulta._id);
      } else {
        setAlert({
          type: 'error',
          message: respuesta.error || 'No se pudo crear la consulta RPA'
        });
        setEstadoBusqueda(prev => ({
          ...prev,
          tipo: 'encontrada_bd',
          fuente: 'Base de Datos'
        }));
      }
    } catch (error) {
      console.error('Error al crear consulta RPA:', error);
      setAlert({ type: 'error', message: 'Error al crear consulta RPA' });
      setEstadoBusqueda(prev => ({
        ...prev,
        tipo: 'encontrada_bd'
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🔍 Consultar Persona</h1>
        <p className="text-gray-600 mt-1">Busca una persona por número de cédula</p>
      </div>

      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Número de Cédula</label>
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 1234567890"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
              minLength="7"
              maxLength="15"
              disabled={loading || polling}
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading || polling || documento.length < 7}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Buscando...' : polling ? 'Consultando...' : 'Buscar'}
            </button>
            
            {(resultado || consultaRPA) && (
              <button
                type="button"
                onClick={limpiar}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Panel de Estado de Búsqueda */}
      {estadoBusqueda && (
        <div className={`rounded-xl p-5 border ${
          estadoBusqueda.tipo === 'buscando' ? 'bg-gray-50 border-gray-200' :
          estadoBusqueda.tipo === 'encontrada_bd' ? 'bg-green-50 border-green-200' :
          estadoBusqueda.tipo === 'completada_rpa' ? 'bg-green-50 border-green-200' :
          estadoBusqueda.tipo === 'consultando_rpa' ? 'bg-blue-50 border-blue-200' :
          estadoBusqueda.tipo === 'actualizando_rpa' ? 'bg-indigo-50 border-indigo-200' :
          estadoBusqueda.tipo === 'no_encontrada' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {/* Icono según estado */}
              {estadoBusqueda.tipo === 'buscando' ? (
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600 mr-4"></div>
              ) : estadoBusqueda.tipo === 'encontrada_bd' || estadoBusqueda.tipo === 'completada_rpa' ? (
                <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : estadoBusqueda.tipo === 'consultando_rpa' ? (
                <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              ) : estadoBusqueda.tipo === 'actualizando_rpa' ? (
                <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              ) : estadoBusqueda.tipo === 'no_encontrada' ? (
                <div className="h-10 w-10 bg-yellow-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              ) : (
                <div className="h-10 w-10 bg-red-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}

              <div>
                <h3 className={`font-bold text-lg ${
                  estadoBusqueda.tipo === 'buscando' ? 'text-gray-800' :
                  estadoBusqueda.tipo === 'encontrada_bd' || estadoBusqueda.tipo === 'completada_rpa' ? 'text-green-800' :
                  estadoBusqueda.tipo === 'consultando_rpa' ? 'text-blue-800' :
                  estadoBusqueda.tipo === 'actualizando_rpa' ? 'text-indigo-800' :
                  estadoBusqueda.tipo === 'no_encontrada' ? 'text-yellow-800' :
                  'text-red-800'
                }`}>
                  {estadoBusqueda.tipo === 'buscando' ? 'Buscando...' :
                   estadoBusqueda.tipo === 'encontrada_bd' ? 'Encontrada en Base de Datos' :
                   estadoBusqueda.tipo === 'completada_rpa' ? 'Consulta RPA Completada' :
                   estadoBusqueda.tipo === 'consultando_rpa' ? 'Consultando Registraduría...' :
                   estadoBusqueda.tipo === 'actualizando_rpa' ? 'Actualizando desde Registraduría...' :
                   estadoBusqueda.tipo === 'no_encontrada' ? 'No Encontrada' :
                   'Error en la Búsqueda'}
                </h3>
                <p className="text-sm text-gray-600">
                  Documento: <span className="font-mono font-semibold">{estadoBusqueda.documento}</span>
                  {estadoBusqueda.fecha && <span className="ml-3 text-gray-400">• {estadoBusqueda.fecha}</span>}
                </p>
              </div>
            </div>

            {/* Badge de fuente */}
            {estadoBusqueda.fuente && (
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                estadoBusqueda.fuente === 'Registraduría Nacional' ? 'bg-blue-100 text-blue-800' :
                estadoBusqueda.fuente.includes('actualizando') ? 'bg-indigo-100 text-indigo-800' :
                'bg-green-100 text-green-800'
              }`}>
                {estadoBusqueda.fuente}
              </span>
            )}
          </div>

          {/* Info adicional */}
          {(estadoBusqueda.tiempoEjecucion || estadoBusqueda.consultaId) && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex gap-4 text-sm">
              {estadoBusqueda.consultaId && (
                <span className="text-gray-500">
                  ID: <span className="font-mono">{estadoBusqueda.consultaId.slice(-8)}</span>
                </span>
              )}
              {estadoBusqueda.tiempoEjecucion && (
                <span className="text-gray-500">
                  Tiempo: <span className="font-semibold">{estadoBusqueda.tiempoEjecucion}ms</span>
                </span>
              )}
            </div>
          )}

          {/* Mensaje de error */}
          {estadoBusqueda.error && (
            <div className="mt-3 p-3 bg-red-100 rounded-lg">
              <p className="text-sm text-red-800">{estadoBusqueda.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Sección de Estado de Consulta RPA */}
      {(polling || consultaRPA) && (
        <div className={`rounded-xl p-6 border ${
          consultaRPA?.estado === 'COMPLETADO' ? 'bg-green-50 border-green-200' :
          consultaRPA?.estado === 'ERROR' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {polling ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              ) : consultaRPA?.estado === 'COMPLETADO' ? (
                <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : consultaRPA?.estado === 'ERROR' ? (
                <div className="h-8 w-8 bg-red-500 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : (
                <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div>
                <h3 className={`font-bold ${
                  consultaRPA?.estado === 'COMPLETADO' ? 'text-green-900' :
                  consultaRPA?.estado === 'ERROR' ? 'text-red-900' :
                  'text-blue-900'
                }`}>
                  {polling ? 'Consultando Registraduría' :
                   consultaRPA?.estado === 'COMPLETADO' ? 'Consulta Completada' :
                   consultaRPA?.estado === 'ERROR' ? 'Error en Consulta' :
                   'Estado de Consulta'}
                </h3>
                <p className={`text-sm ${
                  consultaRPA?.estado === 'COMPLETADO' ? 'text-green-700' :
                  consultaRPA?.estado === 'ERROR' ? 'text-red-700' :
                  'text-blue-700'
                }`}>
                  Documento: {consultaRPA?.documento || documento}
                </p>
              </div>
            </div>

            {/* Badge de Estado */}
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              consultaRPA?.estado === 'EN_COLA' ? 'bg-yellow-100 text-yellow-800' :
              consultaRPA?.estado === 'PROCESANDO' ? 'bg-blue-100 text-blue-800' :
              consultaRPA?.estado === 'COMPLETADO' ? 'bg-green-100 text-green-800' :
              consultaRPA?.estado === 'ERROR' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {consultaRPA?.estado || 'INICIANDO'}
            </span>
          </div>

          {/* Barra de progreso solo durante polling */}
          {polling && (
            <div className="mb-4">
              <div className="w-full bg-blue-100 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${progreso}%` }}></div>
              </div>
              <p className="text-xs text-blue-600 mt-1 text-right">{progreso}%</p>
            </div>
          )}

          {/* Detalles de la consulta */}
          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg ${
            consultaRPA?.estado === 'COMPLETADO' ? 'bg-green-100/50' :
            consultaRPA?.estado === 'ERROR' ? 'bg-red-100/50' :
            'bg-blue-100/50'
          }`}>
            <div>
              <p className="text-xs text-gray-500 uppercase">ID Consulta</p>
              <p className="font-mono text-sm truncate">{consultaRPA?._id?.slice(-8) || '---'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Prioridad</p>
              <p className="font-medium">{consultaRPA?.prioridad || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Intentos</p>
              <p className="font-medium">{consultaRPA?.intentos || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Tiempo</p>
              <p className="font-medium">{consultaRPA?.tiempoEjecucion ? `${consultaRPA.tiempoEjecucion}ms` : '-'}</p>
            </div>
          </div>

          {/* Mensaje de error si aplica */}
          {consultaRPA?.estado === 'ERROR' && consultaRPA?.error && (
            <div className="mt-4 p-3 bg-red-100 rounded-lg">
              <p className="text-sm text-red-800">
                <span className="font-semibold">Error: </span>{consultaRPA.error}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mostrar Resultado Final */}
      {resultado && (() => {
        // Extraer datos electorales de cualquier estructura (BD o RPA)
        // Prioridad: puesto > datosElectorales > campos directos
        const rawPuesto = resultado.puesto || {};
        const rawDatosElectorales = resultado.datosElectorales || {};
        const datosElectorales = {
          departamento: rawPuesto.departamento || rawDatosElectorales.departamento || resultado.departamento,
          municipio: rawPuesto.municipio || rawDatosElectorales.municipio || resultado.municipio,
          zona: rawPuesto.zona || rawDatosElectorales.zona || resultado.zona,
          puestoVotacion: rawPuesto.nombrePuesto || rawDatosElectorales.puestoVotacion || rawDatosElectorales.nombrePuesto || resultado.puestoVotacion || resultado.nombrePuesto,
          direccion: rawPuesto.direccion || rawDatosElectorales.direccion || resultado.direccion,
          mesa: rawPuesto.mesa || rawDatosElectorales.mesa || resultado.mesa
        };

        // Verificar si hay al menos un dato electoral
        const hayDatosElectorales = datosElectorales.departamento ||
                                     datosElectorales.municipio ||
                                     datosElectorales.zona ||
                                     datosElectorales.puestoVotacion ||
                                     datosElectorales.direccion ||
                                     datosElectorales.mesa;

        return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resultado de la Consulta
                </h3>
                <p className="text-green-100 text-sm mt-1">Cédula: {resultado.documento}</p>
              </div>
              <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium">
                {resultado.fuenteDatos === 'RPA' ? 'Registraduría' : resultado.fuenteDatos || 'Base de Datos'}
              </span>
            </div>
          </div>

          {/* Datos Personales */}
          <div className="p-6 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Datos Personales
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nombres</p>
                <p className="font-semibold text-gray-900 mt-1">{resultado.nombres || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Apellidos</p>
                <p className="font-semibold text-gray-900 mt-1">{resultado.apellidos || 'N/A'}</p>
              </div>
              {resultado.email && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                  <p className="font-semibold text-gray-900 mt-1">{resultado.email}</p>
                </div>
              )}
              {resultado.telefono && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Teléfono</p>
                  <p className="font-semibold text-gray-900 mt-1">{resultado.telefono}</p>
                </div>
              )}
              {resultado.estadoContacto && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Estado de Contacto</p>
                  <span className={`inline-flex px-2 py-1 mt-1 text-xs font-semibold rounded-full ${
                    resultado.estadoContacto === 'CONFIRMADO' ? 'bg-green-100 text-green-800' :
                    resultado.estadoContacto === 'CONTACTADO' ? 'bg-blue-100 text-blue-800' :
                    resultado.estadoContacto === 'NO_CONTACTADO' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {resultado.estadoContacto}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Información de Votación - Sección Principal */}
          {hayDatosElectorales && (
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
              <h4 className="text-lg font-bold text-blue-900 mb-5 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Información de Votación
              </h4>

              {/* Tarjeta de Mesa de Votación destacada */}
              {datosElectorales.mesa && (
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 mb-5 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-200 text-sm uppercase tracking-wide font-medium">Mesa de Votación</p>
                      <p className="text-5xl font-black mt-1">{datosElectorales.mesa}</p>
                    </div>
                    <div className="bg-white/20 rounded-full p-4">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Departamento */}
                {datosElectorales.departamento && (
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                      <div className="bg-blue-100 rounded-lg p-2 mr-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Departamento</p>
                        <p className="font-bold text-gray-900 text-lg mt-0.5">{datosElectorales.departamento}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Municipio */}
                {datosElectorales.municipio && (
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                      <div className="bg-green-100 rounded-lg p-2 mr-3">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Municipio</p>
                        <p className="font-bold text-gray-900 text-lg mt-0.5">{datosElectorales.municipio}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Zona */}
                {datosElectorales.zona && (
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                      <div className="bg-orange-100 rounded-lg p-2 mr-3">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-orange-600 uppercase tracking-wide font-semibold">Zona</p>
                        <p className="font-bold text-gray-900 text-lg mt-0.5">{datosElectorales.zona}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Puesto de Votación */}
              {datosElectorales.puestoVotacion && (
                <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm mt-4">
                  <div className="flex items-start">
                    <div className="bg-purple-100 rounded-lg p-3 mr-4">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Puesto de Votación</p>
                      <p className="font-bold text-gray-900 text-xl mt-1">{datosElectorales.puestoVotacion}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dirección */}
              {datosElectorales.direccion && (
                <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm mt-4">
                  <div className="flex items-start">
                    <div className="bg-red-100 rounded-lg p-3 mr-4">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Dirección del Puesto</p>
                      <p className="font-bold text-gray-900 text-lg mt-1">{datosElectorales.direccion}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Si no hay datos electorales, mostrar mensaje y botón de actualización */}
          {!hayDatosElectorales && (
            <div className="p-6 bg-yellow-50 border-t border-yellow-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center text-yellow-800">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm font-medium">No hay datos electorales disponibles para esta persona</p>
                </div>
                <button
                  onClick={solicitarActualizacion}
                  disabled={loading || polling}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading || polling ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Consultando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Consultar en Registraduría
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Botón para agregar a mi base (solo si no está confirmada) */}
          {!resultado.confirmado && resultado._id && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">¿Deseas agregar esta persona a tu base de datos?</p>
                  <p className="text-xs text-gray-500 mt-1">Podrás completar los datos que falten antes de guardar</p>
                </div>
                <button
                  onClick={abrirModalConfirmar}
                  className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Agregar a Mi Base
                </button>
              </div>
            </div>
          )}

          {/* Mensaje si ya está confirmada */}
          {resultado.confirmado && (
            <div className="p-4 border-t border-green-200 bg-green-50">
              <div className="flex items-center text-green-800">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">Esta persona ya está en tu base de datos</p>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Modal de Confirmación - Completar Datos */}
      {showModalConfirmar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Agregar a Mi Base
                  </h3>
                  <p className="text-green-100 text-sm mt-1">
                    Completa los datos faltantes {resultado?.nombres && resultado?.apellidos
                      ? `de ${resultado.nombres} ${resultado.apellidos}`
                      : `- Cédula: ${resultado?.documento}`}
                  </p>
                </div>
                <button
                  onClick={() => setShowModalConfirmar(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-6">
              {/* Datos Personales */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Datos Personales
                  {(!datosConfirmacion.nombres || !datosConfirmacion.apellidos) && (
                    <span className="ml-2 text-xs text-red-600 font-normal">(Requeridos)</span>
                  )}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombres
                      {!datosConfirmacion.nombres && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      name="nombres"
                      value={datosConfirmacion.nombres}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: JUAN CARLOS"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        !datosConfirmacion.nombres ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellidos
                      {!datosConfirmacion.apellidos && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      name="apellidos"
                      value={datosConfirmacion.apellidos}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: PEREZ GOMEZ"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        !datosConfirmacion.apellidos ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Datos de Contacto */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Datos de Contacto
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      name="telefono"
                      value={datosConfirmacion.telefono}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: 3001234567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={datosConfirmacion.email}
                      onChange={handleConfirmacionChange}
                      placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Datos de Puesto de Votación */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Puesto de Votación
                  {(!datosConfirmacion.departamento || !datosConfirmacion.mesa) && (
                    <span className="ml-2 text-xs text-orange-600 font-normal">(Campos recomendados)</span>
                  )}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento
                      {!datosConfirmacion.departamento && <span className="text-orange-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      name="departamento"
                      value={datosConfirmacion.departamento}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: ATLANTICO"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        !datosConfirmacion.departamento ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Municipio
                      {!datosConfirmacion.municipio && <span className="text-orange-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      name="municipio"
                      value={datosConfirmacion.municipio}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: BARRANQUILLA"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        !datosConfirmacion.municipio ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                    <input
                      type="text"
                      name="zona"
                      value={datosConfirmacion.zona}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: URBANA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Puesto</label>
                    <input
                      type="text"
                      name="nombrePuesto"
                      value={datosConfirmacion.nombrePuesto}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: IE MARIA EMMA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      name="direccion"
                      value={datosConfirmacion.direccion}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: CRA 12 No 6-61"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mesa
                      {!datosConfirmacion.mesa && <span className="text-orange-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      name="mesa"
                      value={datosConfirmacion.mesa}
                      onChange={handleConfirmacionChange}
                      placeholder="Ej: 13"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        !datosConfirmacion.mesa ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Nota informativa */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p>Los campos marcados con <span className="text-red-500 font-semibold">*</span> (rojo) son requeridos.</p>
                    <p className="mt-1">Los campos marcados con <span className="text-orange-500 font-semibold">*</span> (naranja) están vacíos pero son recomendados para un mejor seguimiento electoral.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-end space-x-3">
              <button
                onClick={() => setShowModalConfirmar(false)}
                disabled={guardando}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarYGuardar}
                disabled={guardando || !datosConfirmacion.nombres.trim() || !datosConfirmacion.apellidos.trim()}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {guardando ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar Persona
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Consulta;