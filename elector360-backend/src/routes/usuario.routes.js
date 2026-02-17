const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { protect } = require('../middleware/auth');
const { requireCoordinador } = require('../middleware/validateRole');
const { resolveCampaign } = require('../middleware/campaignScope');

// Todas las rutas requieren autenticación, ser COORDINADOR o ADMIN, y scope de campaña
router.use(protect);
router.use(requireCoordinador);
router.use(resolveCampaign);

// Listar y crear
router.route('/')
  .get(usuarioController.listarUsuarios)
  .post(usuarioController.crearUsuario);

// Por ID
router.route('/:id')
  .get(usuarioController.obtenerUsuario)
  .put(usuarioController.actualizarUsuario)
  .delete(usuarioController.eliminarUsuario);

// Cambiar estado
router.patch('/:id/toggle-estado', usuarioController.cambiarEstado);

// Estadísticas
router.get('/:id/estadisticas', usuarioController.obtenerEstadisticas);

module.exports = router;
