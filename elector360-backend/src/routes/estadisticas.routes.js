const express = require('express');
const router = express.Router();
const estadisticasController = require('../controllers/estadisticasController');
const { protect } = require('../middleware/auth');
const { requireCoordinador } = require('../middleware/validateRole');
const { resolveCampaign } = require('../middleware/campaignScope');

// Todas las rutas requieren autenticación y scope de campaña
router.use(protect);
router.use(resolveCampaign);

// Dashboard stats (LIDER, COORDINADOR y ADMIN)
router.get('/dashboard', estadisticasController.getDashboardStats);

// Historial de consultas (para Dashboard)
router.get('/historial', estadisticasController.getHistorialConsultas);

// Por departamento (ADMIN y COORDINADOR)
router.get(
  '/por-departamento',
  requireCoordinador,
  estadisticasController.getEstadisticasPorDepartamento
);

module.exports = router;
