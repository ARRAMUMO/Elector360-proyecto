const { body } = require('express-validator');
const { validate } = require('./validate');

exports.validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  
  validate
];

exports.validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  
  body('rol')
    .isIn(['ADMIN', 'LIDER'])
    .withMessage('Rol inválido'),
  
  body('perfil.nombres')
    .notEmpty()
    .withMessage('Los nombres son requeridos')
    .trim(),
  
  body('perfil.apellidos')
    .notEmpty()
    .withMessage('Los apellidos son requeridos')
    .trim(),
  
  validate
];