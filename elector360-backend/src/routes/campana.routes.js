const express = require('express');
const router = express.Router();
const campanaController = require('../controllers/campanaController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');

// Todas las rutas requieren autenticación y ser ADMIN
router.use(protect);
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
