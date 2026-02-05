const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Usuario = require('../models/Usuario');

exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Obtener token del header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'No autorizado - Token no proporcionado');
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuario
    req.user = await Usuario.findById(decoded.id).select('-password');

    if (!req.user) {
      throw new ApiError(401, 'Usuario no encontrado');
    }

    if (req.user.estado === 'INACTIVO') {
      throw new ApiError(401, 'Usuario inactivo');
    }

    next();
  } catch (error) {
    throw new ApiError(401, 'No autorizado - Token inválido');
  }
});