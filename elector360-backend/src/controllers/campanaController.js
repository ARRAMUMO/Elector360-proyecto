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
