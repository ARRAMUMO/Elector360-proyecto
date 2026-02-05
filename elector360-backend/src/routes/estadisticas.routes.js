const express = require('express');
const router = express.Router();
const estadisticasController = require('../controllers/estadisticasController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');

// Todas las rutas requieren autenticación
router.use(protect);

// Dashboard stats (LIDER y ADMIN)
router.get('/dashboard', estadisticasController.getDashboardStats);

// Historial de consultas (para Dashboard)
router.get('/historial', estadisticasController.getHistorialConsultas);

// Por departamento (solo ADMIN)
router.get(
  '/por-departamento', 
  requireAdmin,
  estadisticasController.getEstadisticasPorDepartamento
);

module.exports = router;