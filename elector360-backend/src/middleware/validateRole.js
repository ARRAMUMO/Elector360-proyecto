const ApiError = require('../utils/ApiError');

exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'No autorizado');
    }

    if (!roles.includes(req.user.rol)) {
      throw new ApiError(403, 'No tienes permisos para realizar esta acción');
    }

    next();
  };
};

// Shortcuts
exports.requireAdmin = exports.requireRole('ADMIN');
exports.requireCoordinador = exports.requireRole('COORDINADOR', 'ADMIN');
exports.requireLider = exports.requireRole('LIDER', 'COORDINADOR', 'ADMIN');