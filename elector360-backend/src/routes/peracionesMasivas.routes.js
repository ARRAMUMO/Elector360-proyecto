const express = require('express');
const router = express.Router();
const operacionesMasivasController = require('../controllers/operacionesMasivasController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');
const upload = require('../middleware/upload');

// Todas las rutas requieren autenticación y ser ADMIN
router.use(protect);
router.use(requireAdmin);

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

// Limpiar cola antigua
router.delete('/limpiar-cola', operacionesMasivasController.limpiarCola);

// Descargar plantilla Excel
router.get('/plantilla', operacionesMasivasController.descargarPlantilla);

module.exports = router;