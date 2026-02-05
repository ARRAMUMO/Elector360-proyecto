const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const ApiError = require('../utils/ApiError');

/**
 * @desc    Login de usuario
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email y contraseña son requeridos');
  }

  const result = await authService.login(email, password);

  res.json({
    success: true,
    data: result
  });
});

/**
 * @desc    Registro de usuario
 * @route   POST /api/v1/auth/register
 * @access  Private (Admin only)
 */
exports.register = asyncHandler(async (req, res) => {
  const usuario = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: 'Usuario registrado exitosamente',
    data: usuario
  });
});

/**
 * @desc    Refresh token
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token es requerido');
  }

  const result = await authService.refreshToken(refreshToken);

  res.json({
    success: true,
    data: result
  });
});

/**
 * @desc    Obtener usuario actual
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res) => {
  const usuario = await authService.getCurrentUser(req.user._id);

  res.json({
    success: true,
    data: usuario
  });
});

/**
 * @desc    Logout (client-side)
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res) => {
  // El logout se maneja en el cliente eliminando el token
  // Aquí podríamos invalidar el token si usáramos una blacklist

  res.json({
    success: true,
    message: 'Logout exitoso'
  });
});

/**
 * @desc    Cambiar contraseña
 * @route   PUT /api/v1/auth/change-password
 * @access  Private
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Contraseña actual y nueva son requeridas');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'La nueva contraseña debe tener al menos 6 caracteres');
  }

  const result = await authService.changePassword(
    req.user._id,
    currentPassword,
    newPassword
  );

  res.json({
    success: true,
    message: result.message
  });
});