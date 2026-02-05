// src/routes/worker.routes.js

const express = require('express');
const router = express.Router();
const workerController = require('../controllers/worker.controller');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');

// Todas las rutas requieren autenticación y rol ADMIN
router.use(protect);
router.use(requireAdmin);

/**
 * @route   GET /api/v1/worker/stats
 * @desc    Obtener estadísticas del worker
 * @access  Admin
 */
router.get('/stats', workerController.getStats);

/**
 * @route   GET /api/v1/worker/circuit-breaker
 * @desc    Obtener estado del circuit breaker
 * @access  Admin
 */
router.get('/circuit-breaker', workerController.getCircuitBreakerStatus);

/**
 * @route   POST /api/v1/worker/pause
 * @desc    Pausar worker
 * @access  Admin
 */
router.post('/pause', workerController.pauseWorker);

/**
 * @route   POST /api/v1/worker/resume
 * @desc    Reanudar worker
 * @access  Admin
 */
router.post('/resume', workerController.resumeWorker);

/**
 * @route   POST /api/v1/worker/retry/:consultaId
 * @desc    Reintentar consulta fallida
 * @access  Admin
 */
router.post('/retry/:consultaId', workerController.retryConsulta);

/**
 * @route   DELETE /api/v1/worker/clean
 * @desc    Limpiar consultas antiguas
 * @access  Admin
 */
router.delete('/clean', workerController.limpiarConsultasAntiguas);

/**
 * @route   GET /api/v1/worker/logs
 * @desc    Obtener logs recientes
 * @access  Admin
 */
router.get('/logs', workerController.getLogs);

/**
 * @route   GET /api/v1/worker/health
 * @desc    Health check del worker
 * @access  Admin
 */
router.get('/health', workerController.healthCheck);

/**
 * @route   GET /api/v1/worker/cola
 * @desc    Obtener consultas en cola con filtros
 * @access  Admin
 */
router.get('/cola', workerController.getCola);

/**
 * @route   DELETE /api/v1/worker/consulta/:consultaId
 * @desc    Eliminar consulta de la cola
 * @access  Admin
 */
router.delete('/consulta/:consultaId', workerController.eliminarConsulta);

/**
 * @route   PATCH /api/v1/worker/consulta/:consultaId/prioridad
 * @desc    Cambiar prioridad de una consulta
 * @access  Admin
 */
router.patch('/consulta/:consultaId/prioridad', workerController.cambiarPrioridad);

/**
 * @route   POST /api/v1/worker/retry-all
 * @desc    Reintentar todas las consultas con error
 * @access  Admin
 */
router.post('/retry-all', workerController.retryAll);

module.exports = router;