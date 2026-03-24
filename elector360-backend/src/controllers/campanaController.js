const asyncHandler = require('../utils/asyncHandler');
const campanaService = require('../services/campanaService');
const ApiError = require('../utils/ApiError');

/**
 * @desc    Listar campañas
 * @route   GET /api/v1/campanas
 * @access  Private (Admin only)
 */
exports.listarCampanas = asyncHandler(async (req, res) => {
  const { page, limit, search, estado, tipo } = req.query;

  const resultado = await campanaService.listarCampanas({
    page, limit, search, estado, tipo
  });

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Obtener campaña por ID
 * @route   GET /api/v1/campanas/:id
 * @access  Private (Admin only)
 */
exports.obtenerCampana = asyncHandler(async (req, res) => {
  const campana = await campanaService.obtenerPorId(req.params.id);

  res.json({
    success: true,
    data: campana
  });
});

/**
 * @desc    Crear campaña
 * @route   POST /api/v1/campanas
 * @access  Private (Admin only)
 */
exports.crearCampana = asyncHandler(async (req, res) => {
  const campana = await campanaService.crearCampana(req.body);

  res.status(201).json({
    success: true,
    message: 'Campaña creada exitosamente',
    data: campana
  });
});

/**
 * @desc    Actualizar campaña
 * @route   PUT /api/v1/campanas/:id
 * @access  Private (Admin only)
 */
exports.actualizarCampana = asyncHandler(async (req, res) => {
  const campana = await campanaService.actualizarCampana(req.params.id, req.body);

  res.json({
    success: true,
    message: 'Campaña actualizada exitosamente',
    data: campana
  });
});

/**
 * @desc    Eliminar campaña
 * @route   DELETE /api/v1/campanas/:id
 * @access  Private (Admin only)
 */
exports.eliminarCampana = asyncHandler(async (req, res) => {
  const resultado = await campanaService.eliminarCampana(req.params.id);

  res.json({
    success: true,
    message: resultado.message
  });
});

/**
 * @desc    Obtener estadísticas de una campaña
 * @route   GET /api/v1/campanas/:id/estadisticas
 * @access  Private (Admin only)
 */
exports.obtenerEstadisticas = asyncHandler(async (req, res) => {
  const stats = await campanaService.obtenerEstadisticas(req.params.id);

  res.json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Obtener las campañas del coordinador autenticado con stats básicas
 * @route   GET /api/v1/campanas/mis-campanas
 * @access  Private (Coordinador / Admin)
 */
exports.getMisCampanas = asyncHandler(async (req, res) => {
  // Para ADMIN: devuelve todas. Para COORDINADOR: devuelve las de su array campanas[]
  // más la campana principal si existe
  let campanaIds = [];

  if (req.user.rol === 'ADMIN') {
    // ADMIN ve todas las campañas (sin límite práctico, usar listar para paginación)
    const { campanas } = await campanaService.listarCampanas({ limit: 200 });
    return res.json({ success: true, data: campanas });
  }

  // COORDINADOR / LIDER: recopilar IDs únicos de campana + campanas[]
  const idsSet = new Set();
  if (req.user.campana) idsSet.add(String(req.user.campana._id || req.user.campana));
  (req.user.campanas || []).forEach(c => idsSet.add(String(c._id || c)));
  campanaIds = [...idsSet];

  if (campanaIds.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const liderId = req.user.rol === 'LIDER' ? req.user._id : null;
  const campanasConStats = await campanaService.listarPorIds(campanaIds, liderId);
  res.json({ success: true, data: campanasConStats });
});

