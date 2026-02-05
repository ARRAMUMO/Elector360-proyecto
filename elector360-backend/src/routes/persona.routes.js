const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');
const { validatePersona } = require('../validators/personaValidator');

// Todas las rutas requieren autenticación
router.use(protect);

// Listar y crear
router.route('/')
  .get(personaController.listarPersonas)
  .post(validatePersona, personaController.crearPersona);

// Mesas de votación
router.get('/mesas', personaController.obtenerMesas);
router.get('/mesas/detalle', personaController.obtenerPersonasPorMesa);

// Exportar CSV
router.get('/export/csv', personaController.exportarCSV);

// Por documento
router.get('/documento/:documento', personaController.obtenerPorDocumento);

// Por ID
router.route('/:id')
  .get(personaController.obtenerPersona)
  .put(personaController.actualizarPersona)
  .delete(requireAdmin, personaController.eliminarPersona);

module.exports = router;