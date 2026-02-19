const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController');
const { protect } = require('../middleware/auth');
const { requireAdmin, requireCoordinador, requireLider } = require('../middleware/validateRole');
const { resolveCampaign } = require('../middleware/campaignScope');
const { validatePersona } = require('../validators/personaValidator');
const upload = require('../middleware/upload');

// Todas las rutas requieren autenticación y scope de campaña
router.use(protect);
router.use(resolveCampaign);

// Listar y crear
router.route('/')
  .get(personaController.listarPersonas)
  .post(validatePersona, personaController.crearPersona);

// Importar personas desde Excel (todos los roles autenticados)
router.post('/importar', requireLider, upload.single('file'), personaController.importarDesdeExcel);

// Descargar plantilla de importación
router.get('/plantilla-importacion', requireLider, personaController.descargarPlantillaImportacion);

// Mesas de votación
router.get('/mesas', personaController.obtenerMesas);
router.get('/mesas/detalle', personaController.obtenerPersonasPorMesa);

// Exportar CSV
router.get('/export/csv', personaController.exportarCSV);

// Exportar Excel
router.get('/export/excel', personaController.exportarExcel);

// Por documento
router.get('/documento/:documento', personaController.obtenerPorDocumento);

// Asignar/reasignar líder (Coordinador/Admin)
router.put('/:id/asignar-lider', requireCoordinador, personaController.asignarLider);

// Por ID
router.route('/:id')
  .get(personaController.obtenerPersona)
  .put(personaController.actualizarPersona)
  .delete(requireAdmin, personaController.eliminarPersona);

module.exports = router;
