const express = require('express');
const router = express.Router();
const informesController = require('../controllers/informesController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');
const { resolveCampaign } = require('../middleware/campaignScope');

router.use(protect);
router.use(resolveCampaign);
router.use(requireAdmin);

router.get('/coordinadores', informesController.listarCoordinadores);
router.get('/coordinador/:coordinadorId/excel', informesController.exportarExcel);
router.get('/coordinador/:coordinadorId', informesController.informeCoordinador);

module.exports = router;
