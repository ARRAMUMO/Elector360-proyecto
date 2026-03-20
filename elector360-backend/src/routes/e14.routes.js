const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { resolveCampaign } = require('../middleware/campaignScope');
const { requireLider, requireAdmin, requireCoordinador } = require('../middleware/validateRole');
const e14Controller = require('../controllers/e14Controller');
const upload = require('../middleware/upload');

// Todas las rutas requieren autenticación y scope de campaña
router.use(protect);
router.use(resolveCampaign);

// Resumen (tarjetas)
router.get('/resumen', e14Controller.obtenerResumen);

// Análisis cruzado
router.get('/analisis', e14Controller.obtenerAnalisis);

// CRUD resultados
router.get('/resultados', requireLider, e14Controller.listarResultados);
router.post('/resultados', requireCoordinador, e14Controller.guardarResultado);
router.put('/resultados/:id', requireCoordinador, e14Controller.actualizarResultado);
router.delete('/resultados/:id', requireCoordinador, e14Controller.eliminarResultado);

// Seguidores de una mesa específica
router.get('/resultados/:id/seguidores', requireLider, e14Controller.obtenerSeguidoresMesa);

// Importar desde Excel
router.post('/importar-excel', requireCoordinador, upload.single('archivo'), e14Controller.importarExcel);

// Verificar cumplimiento de votos (cruza E-14 × Personas) — todos los roles
router.post('/verificar-votos', requireLider, e14Controller.verificarVotos);

// Verificar cobertura de puestos de votación (Personas vs ResultadoMesa importados)
router.get('/verificar-puestos', requireCoordinador, e14Controller.verificarPuestosVotacion);

// Vista del líder: sus personas con estadoVoto
router.get('/mis-personas', requireLider, e14Controller.getMisPersonas);

// Informe de líder: mesas agrupadas con votos y otros líderes compartiendo mesa
router.get('/informe-lider', requireLider, e14Controller.getInformeLider);

// Exportar informe Excel
router.get('/exportar-informe', requireLider, e14Controller.exportarInforme);

// Borrar TODOS los resultados de la campaña activa del usuario
router.delete('/resultados', requireCoordinador, e14Controller.limpiarResultados);

module.exports = router;
