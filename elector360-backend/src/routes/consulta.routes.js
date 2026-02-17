const express = require('express');
const router = express.Router();
const consultaController = require('../controllers/consultaController');
const { protect } = require('../middleware/auth');
const { resolveCampaign } = require('../middleware/campaignScope');

// Todas las rutas requieren autenticación y scope de campaña
router.use(protect);
router.use(resolveCampaign);

// Crear consulta RPA (alias para buscar)
router.post('/', consultaController.consultarPersona);

// Buscar/Consultar persona
router.post('/buscar', consultaController.consultarPersona);

// Obtener estado de consulta
router.get('/estado/:consultaId', consultaController.obtenerEstadoConsulta);

// Confirmar y agregar persona a mi base
router.post('/confirmar/:personaId', consultaController.confirmarPersona);

// Historial de consultas
router.get('/historial', consultaController.obtenerHistorial);

// Endpoint para el Worker RPA (guardar resultado)
router.post('/rpa/resultado', consultaController.guardarResultadoRPA);

module.exports = router;
