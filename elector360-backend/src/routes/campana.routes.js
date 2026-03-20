const express = require('express');
const router = express.Router();
const campanaController = require('../controllers/campanaController');
const { protect } = require('../middleware/auth');
const { requireAdmin, requireCoordinador } = require('../middleware/validateRole');

// Todas las rutas requieren autenticación
router.use(protect);

// Ruta para COORDINADOR (y ADMIN): ver sus propias campañas con stats
// DEBE ir antes de requireAdmin para que los coordinadores puedan acceder
router.get('/mis-campanas', requireCoordinador, campanaController.getMisCampanas);


// El resto de rutas requieren ser ADMIN
router.use(requireAdmin);

// Listar y crear
router.route('/')
  .get(campanaController.listarCampanas)
  .post(campanaController.crearCampana);

// Por ID
router.route('/:id')
  .get(campanaController.obtenerCampana)
  .put(campanaController.actualizarCampana)
  .delete(campanaController.eliminarCampana);

// Estadísticas de campaña
router.get('/:id/estadisticas', campanaController.obtenerEstadisticas);

module.exports = router;
