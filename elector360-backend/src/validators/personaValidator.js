const { body } = require('express-validator');
const { validate } = require('./validate');

exports.validatePersona = [
  body('documento')
    .matches(/^\d{5,10}$/)
    .withMessage('La cédula debe tener entre 5 y 10 dígitos'),

  body('nombres')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Los nombres son requeridos'),

  body('apellidos')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Los apellidos son requeridos'),

  body('telefono')
    .optional()
    .matches(/^3\d{9}$/)
    .withMessage('Teléfono debe tener 10 dígitos y comenzar con 3'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),

  // Campos de puesto de votación (datos electorales)
  body('puesto')
    .optional()
    .isObject()
    .withMessage('Puesto debe ser un objeto'),

  body('puesto.departamento')
    .optional()
    .trim()
    .isString()
    .withMessage('Departamento debe ser texto'),

  body('puesto.municipio')
    .optional()
    .trim()
    .isString()
    .withMessage('Municipio debe ser texto'),

  body('puesto.zona')
    .optional()
    .trim()
    .isString()
    .withMessage('Zona debe ser texto'),

  body('puesto.nombrePuesto')
    .optional()
    .trim()
    .isString()
    .withMessage('Nombre del puesto debe ser texto'),

  body('puesto.direccion')
    .optional()
    .trim()
    .isString()
    .withMessage('Dirección debe ser texto'),

  body('puesto.mesa')
    .optional()
    .trim()
    .isString()
    .withMessage('Mesa debe ser texto'),

  validate
];