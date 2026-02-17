const ApiError = require('../utils/ApiError');

/**
 * Middleware que resuelve el scope de campaña del usuario.
 * - ADMIN: sin filtro (ve todo), o filtra opcionalmente via header X-Campana-Id
 * - COORDINADOR: filtra por su campaña
 * - LIDER: filtra por su campaña
 *
 * Inyecta en req:
 *   req.campanaId    - ObjectId de la campaña activa (o null para ADMIN global)
 *   req.campanaFilter - objeto MongoDB para spread en queries: { campana: id } o {}
 */
exports.resolveCampaign = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'No autorizado');
  }

  if (req.user.rol === 'ADMIN') {
    const campanaParam = req.query.campanaId || req.headers['x-campana-id'];
    if (campanaParam) {
      req.campanaId = campanaParam;
      req.campanaFilter = { campana: campanaParam };
    } else {
      req.campanaId = null;
      req.campanaFilter = {};
    }
  } else {
    if (!req.user.campana) {
      if (req.user.rol === 'COORDINADOR') {
        throw new ApiError(403, 'Coordinador no asignado a ninguna campaña. Contacta al administrador.');
      }
      // LIDER sin campaña: permitir acceso sin filtro (compatibilidad pre-migración)
      req.campanaId = null;
      req.campanaFilter = {};
    } else {
      const campanaId = req.user.campana._id || req.user.campana;
      req.campanaId = campanaId;
      req.campanaFilter = { campana: campanaId };
    }
  }

  next();
};
