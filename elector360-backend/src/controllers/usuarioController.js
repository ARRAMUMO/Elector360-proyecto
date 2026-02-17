const asyncHandler = require('../utils/asyncHandler');
const usuarioService = require('../services/usuarioService');

/**
 * @desc    Listar usuarios
 * @route   GET /api/v1/usuarios
 * @access  Private (Admin only)
 */
exports.listarUsuarios = asyncHandler(async (req, res) => {
  const { page, limit, search, rol, estado } = req.query;

  const resultado = await usuarioService.listarUsuarios({
    page,
    limit,
    search,
    rol,
    estado,
    campanaFilter: req.campanaFilter
  });

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Obtener usuario por ID
 * @route   GET /api/v1/usuarios/:id
 * @access  Private (Admin only)
 */
exports.obtenerUsuario = asyncHandler(async (req, res) => {
  const usuario = await usuarioService.obtenerPorId(req.params.id);

  res.json({
    success: true,
    data: usuario
  });
});

/**
 * @desc    Crear usuario
 * @route   POST /api/v1/usuarios
 * @access  Private (Admin only)
 */
exports.crearUsuario = asyncHandler(async (req, res) => {
  const usuario = await usuarioService.crearUsuario(
    req.body,
    req.user.rol,
    req.campanaId
  );

  res.status(201).json({
    success: true,
    message: 'Usuario creado exitosamente',
    data: usuario
  });
});

/**
 * @desc    Actualizar usuario
 * @route   PUT /api/v1/usuarios/:id
 * @access  Private (Admin only)
 */
exports.actualizarUsuario = asyncHandler(async (req, res) => {
  const usuario = await usuarioService.actualizarUsuario(req.params.id, req.body);

  res.json({
    success: true,
    message: 'Usuario actualizado exitosamente',
    data: usuario
  });
});

/**
 * @desc    Eliminar usuario
 * @route   DELETE /api/v1/usuarios/:id
 * @access  Private (Admin only)
 */
exports.eliminarUsuario = asyncHandler(async (req, res) => {
  const resultado = await usuarioService.eliminarUsuario(req.params.id);

  res.json({
    success: true,
    message: resultado.message
  });
});

/**
 * @desc    Cambiar estado de usuario
 * @route   PATCH /api/v1/usuarios/:id/toggle-estado
 * @access  Private (Admin only)
 */
exports.cambiarEstado = asyncHandler(async (req, res) => {
  const usuario = await usuarioService.cambiarEstado(
    req.params.id,
    req.user.rol,
    req.campanaId
  );

  res.json({
    success: true,
    message: `Usuario ${usuario.estado === 'ACTIVO' ? 'activado' : 'desactivado'} exitosamente`,
    data: usuario
  });
});

/**
 * @desc    Obtener estadísticas de usuario
 * @route   GET /api/v1/usuarios/:id/estadisticas
 * @access  Private (Admin only)
 */
exports.obtenerEstadisticas = asyncHandler(async (req, res) => {
  const stats = await usuarioService.obtenerEstadisticas(req.params.id);

  res.json({
    success: true,
    data: stats
  });
});