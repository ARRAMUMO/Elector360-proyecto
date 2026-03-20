const ApiError = require('../utils/ApiError');

/**
 * Genera el filtro de campaña incluyendo alianzas (campanas[]).
 * Usar este filtro en queries de Persona para ver personas de campañas aliadas.
 */
function buildCampanaFilter(campanaId) {
  if (!campanaId) return {};
  return { $or: [{ campana: campanaId }, { campanas: campanaId }] };
}

/**
 * Middleware que resuelve el scope de campaña del usuario.
 * - ADMIN: sin filtro (ve todo), o filtra opcionalmente via header X-Campana-Id
 * - COORDINADOR: usa su campaña activa; puede cambiar con X-Campana-Id si está en sus campañas
 * - LIDER: filtra por su campaña
 *
 * Inyecta en req:
 *   req.campanaId      - ObjectId de la campaña activa (o null para ADMIN global)
 *   req.campanaFilter  - filtro MongoDB simple: { campana: id } o {} (para colecciones sin alianzas)
 *   req.campanaFilterPersonas - filtro MongoDB con alianzas: { $or: [...] } (para queries de Persona)
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
      req.campanaFilterPersonas = buildCampanaFilter(campanaParam);
    } else {
      req.campanaId = null;
      req.campanaFilter = {};
      req.campanaFilterPersonas = {};
    }
  } else if (req.user.rol === 'COORDINADOR') {
    const campanaHeader = req.headers['x-campana-id'];
    const campanas = req.user.campanas || [];

    if (campanaHeader) {
      const campanaIds = campanas.map(c => String(c._id || c));
      const campanaPrincipal = String(req.user.campana?._id || req.user.campana || '');
      const campanaValida = campanaIds.includes(campanaHeader) || campanaPrincipal === campanaHeader;

      if (!campanaValida && campanas.length > 0) {
        throw new ApiError(403, 'No tienes acceso a esa campaña.');
      }
      req.campanaId = campanaHeader;
      req.campanaFilter = { campana: campanaHeader };
      req.campanaFilterPersonas = buildCampanaFilter(campanaHeader);
    } else if (req.user.campana) {
      const campanaId = req.user.campana._id || req.user.campana;
      req.campanaId = campanaId;
      req.campanaFilter = { campana: campanaId };
      req.campanaFilterPersonas = buildCampanaFilter(campanaId);
    } else {
      throw new ApiError(403, 'Coordinador no asignado a ninguna campaña. Contacta al administrador.');
    }
  } else {
    if (!req.user.campana) {
      req.campanaId = null;
      req.campanaFilter = {};
      req.campanaFilterPersonas = {};
    } else {
      const campanaId = req.user.campana._id || req.user.campana;
      req.campanaId = campanaId;
      req.campanaFilter = { campana: campanaId };
      req.campanaFilterPersonas = buildCampanaFilter(campanaId);
    }
  }

  next();
};
