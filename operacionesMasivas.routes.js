const express = require('express');
const router = express.Router();
const controller = require('../controllers/operacionesMasivasController');
const multer = require('multer');
const path = require('path');

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Asegúrate de que esta carpeta exista o usa /tmp
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

// Middleware de autenticación (asumiendo que tienes uno)
// const auth = require('../middleware/auth');
// router.use(auth); // Proteger todas las rutas

// Rutas
router.post('/actualizar-todo', controller.actualizarTodo);
router.post('/consultar-excel', upload.single('file'), controller.consultarExcel);
router.post('/actualizar-excel', upload.single('file'), controller.actualizarExcel);
router.post('/generar-reporte', controller.generarReporte);
router.get('/estado', controller.obtenerEstado);
router.get('/plantilla', controller.descargarPlantilla);

module.exports = router;