const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/validateRole');
const { validateLogin, validateRegister } = require('../validators/authValidator');

// Rutas públicas
router.post('/login', validateLogin, authController.login);
router.post('/refresh', authController.refreshToken);

// Rutas protegidas
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);
router.put('/change-password', protect, authController.changePassword);

// Solo admin puede registrar usuarios
router.post('/register', protect, requireAdmin, validateRegister, authController.register);

module.exports = router;