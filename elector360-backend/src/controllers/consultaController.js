const asyncHandler = require('../utils/asyncHandler');
const consultaService = require('../services/consultaService');
const ApiError = require('../utils/ApiError');
const rpaWorker = require('../workers/main.worker');

/**
 * @desc    Consultar persona por cédula
 * @route   POST /api/v1/consultas/buscar
 * @access  Private
 */
exports.consultarPersona = asyncHandler(async (req, res) => {
  const { documento } = req.body;

  if (!documento) {
    throw new ApiError(400, 'El documento es requerido');
  }

  // Validar formato
  if (!/^\d{5,10}$/.test(documento)) {
    throw new ApiError(400, 'Documento debe tener entre 5 y 10 dígitos');
  }

  const resultado = await consultaService.consultarPorDocumento(
    documento,
    req.user._id,
    req.campanaId
  );

  // Si se encoló una consulta RPA, asegurarse de que el worker esté procesando
  if (resultado.consultaId && rpaWorker.isInitialized() && !rpaWorker.isPolling()) {
    rpaWorker.startProcessing();
  }

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Obtener estado de consulta
 * @route   GET /api/v1/consultas/estado/:consultaId
 * @access  Private
 */
exports.obtenerEstadoConsulta = asyncHandler(async (req, res) => {
  const { consultaId } = req.params;

  const resultado = await consultaService.obtenerEstadoConsulta(consultaId);

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Confirmar y agregar persona a mi base
 * @route   POST /api/v1/consultas/confirmar/:personaId
 * @access  Private
 */
exports.confirmarPersona = asyncHandler(async (req, res) => {
  const { personaId } = req.params;
  const datosAdicionales = req.body;

  const persona = await consultaService.confirmarYAgregarPersona(
    personaId,
    req.user,
    datosAdicionales,
    req.campanaId
  );

  res.json({
    success: true,
    message: 'Persona agregada a tu base exitosamente',
    data: persona
  });
});

/**
 * @desc    Reclamar persona (fuerza reasignación aunque tenga otro líder)
 * @route   POST /api/v1/consultas/reclamar/:personaId
 * @access  Private
 */
exports.reclamarPersona = asyncHandler(async (req, res) => {
  const { personaId } = req.params;
  const datosAdicionales = req.body;

  const persona = await consultaService.reclamarPersona(
    personaId,
    req.user,
    datosAdicionales,
    req.campanaId
  );

  res.json({
    success: true,
    message: 'Persona reclamada exitosamente',
    data: persona
  });
});

/**
 * @desc    Registrar nueva persona en esta campaña (cuando no existe en ella)
 * @route   POST /api/v1/consultas/registrar-nueva
 * @access  Private
 */
exports.registrarNuevaPersona = asyncHandler(async (req, res) => {
  const { documento, ...datosAdicionales } = req.body;

  if (!documento) {
    throw new ApiError(400, 'El documento es requerido');
  }

  const persona = await consultaService.registrarNuevaPersona(
    documento,
    req.user,
    datosAdicionales,
    req.campanaId
  );

  res.status(201).json({
    success: true,
    message: 'Persona registrada en tu campaña exitosamente',
    data: persona
  });
});

/**
 * @desc    Forzar nueva consulta RPA para persona existente en BD
 * @route   POST /api/v1/consultas/solicitar-actualizacion
 * @access  Private
 */
exports.solicitarActualizacionRPA = asyncHandler(async (req, res) => {
  const { documento, prioridad = 2 } = req.body;

  if (!documento) {
    throw new ApiError(400, 'El documento es requerido');
  }

  if (!/^\d{5,10}$/.test(documento)) {
    throw new ApiError(400, 'Documento debe tener entre 5 y 10 dígitos');
  }

  const consulta = await consultaService.encolarConsulta(
    documento,
    req.user._id,
    prioridad,
    null,
    req.campanaId
  );

  // Si el worker está inicializado pero en standby, arrancarlo automáticamente
  if (rpaWorker.isInitialized() && !rpaWorker.isPolling()) {
    rpaWorker.startProcessing();
  }

  res.json({
    success: true,
    data: consulta
  });
});

/**
 * @desc    Obtener historial de consultas del usuario
 * @route   GET /api/v1/consultas/historial
 * @access  Private
 */
exports.obtenerHistorial = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, estado } = req.query;

  const resultado = await consultaService.obtenerHistorialUsuario(
    req.user._id,
    { page: parseInt(page), limit: parseInt(limit), estado }
  );

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Guardar resultado de RPA (llamado por Worker)
 * @route   POST /api/v1/consultas/rpa/resultado
 * @access  Private (Worker API Key)
 */
exports.guardarResultadoRPA = asyncHandler(async (req, res) => {
  const { documento, datos } = req.body;

  // TODO: Validar que la petición viene del Worker (API Key)

  const persona = await consultaService.guardarResultadoRPA(documento, datos);

  res.json({
    success: true,
    message: 'Resultado guardado exitosamente',
    data: persona
  });
});