const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');

// Todas las rutas requieren autenticación y ser ADMIN
router.use(protect);
router.use(requireAdmin);

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