const express = require('express');
const router = express.Router();
const operacionesMasivasController = require('../controllers/operacionesMasivasController');
const { protect } = require('../middleware/auth');
const { requireCoordinador } = require('../middleware/validateRole');
const { resolveCampaign } = require('../middleware/campaignScope');
const upload = require('../middleware/upload');

// Todas las rutas requieren autenticación, ser COORDINADOR o ADMIN, y scope de campaña
router.use(protect);
router.use(requireCoordinador);
router.use(resolveCampaign);

// Actualizar toda la base de datos
router.post('/actualizar-todo', operacionesMasivasController.actualizarBaseDatosCompleta);

// Consultar desde Excel
router.post(
  '/consultar-excel',
  upload.single('file'),
  operacionesMasivasController.consultarDesdeExcel
);

// Actualizar desde Excel
router.post(
  '/actualizar-excel',
  upload.single('file'),
  operacionesMasivasController.actualizarDesdeExcel
);

// Generar reporte de resultados
router.post('/generar-reporte', operacionesMasivasController.generarReporte);

// Obtener estado de procesamiento
router.get('/estado', operacionesMasivasController.obtenerEstado);

// Obtener resultados completados con datos de votación
router.get('/resultados', operacionesMasivasController.obtenerResultados);

// Descargar reporte Excel con datos de votación
router.get('/reporte-resultados', operacionesMasivasController.descargarReporteResultados);

// Gestión de errores (bulk primero, luego por ID)
router.put('/errores/reintentar-todos', operacionesMasivasController.reintentarTodosErrores);
router.delete('/errores/todos', operacionesMasivasController.eliminarTodosErrores);
router.put('/errores/:id/reintentar', operacionesMasivasController.reintentarConsulta);
router.delete('/errores/:id', operacionesMasivasController.eliminarConsulta);

// Limpiar cola antigua
router.delete('/limpiar-cola', operacionesMasivasController.limpiarCola);

// Descargar plantilla Excel
router.get('/plantilla', operacionesMasivasController.descargarPlantilla);

module.exports = router;
