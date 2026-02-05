const jwt = require('jsonwebtoken');
const Usuario = require('../../src/models/Usuario');
const Persona = require('../../src/models/Persona');

/**
 * Crear un usuario de prueba (LIDER)
 */
async function createTestUser(overrides = {}) {
  const defaultUser = {
    email: 'lider@test.com',
    password: 'password123',
    rol: 'LIDER',
    perfil: {
      nombres: 'Juan',
      apellidos: 'Pérez',
      telefono: '3001234567'
    },
    estado: 'ACTIVO'
  };

  const usuario = await Usuario.create({ ...defaultUser, ...overrides });
  return usuario;
}

/**
 * Crear un usuario administrador de prueba
 */
async function createTestAdmin(overrides = {}) {
  const defaultAdmin = {
    email: 'admin@test.com',
    password: 'password123',
    rol: 'ADMIN',
    perfil: {
      nombres: 'Admin',
      apellidos: 'Test',
      telefono: '3009876543'
    },
    estado: 'ACTIVO'
  };

  const admin = await Usuario.create({ ...defaultAdmin, ...overrides });
  return admin;
}

/**
 * Generar token de autenticación para un usuario
 */
function generateAuthToken(user) {
  const payload = {
    id: user._id,
    email: user.email,
    rol: user.rol
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
}

/**
 * Crear una persona de prueba
 */
async function createTestPersona(userId, overrides = {}) {
  const defaultPersona = {
    documento: '1234567890',
    nombres: 'Carlos',
    apellidos: 'Rodríguez',
    fechaNacimiento: new Date('1990-01-15'),
    lugarNacimiento: {
      departamento: 'CUNDINAMARCA',
      municipio: 'BOGOTÁ'
    },
    puesto: {
      departamento: 'CUNDINAMARCA',
      municipio: 'BOGOTÁ',
      zona: 'ZONA 1',
      nombrePuesto: 'ESCUELA CENTRAL',
      direccion: 'Calle 10 #5-25',
      mesa: '001'
    },
    telefono: '3101234567',
    email: 'carlos@test.com',
    estadoContacto: 'PENDIENTE',
    lider: {
      id: userId,
      nombre: 'Juan Pérez',
      email: 'lider@test.com'
    },
    estadoRPA: 'NUEVO',
    prioridad: 2,
    origen: 'MANUAL',
    confirmado: false
  };

  const persona = await Persona.create({ ...defaultPersona, ...overrides });
  return persona;
}

/**
 * Crear múltiples personas de prueba
 */
async function createMultiplePersonas(userId, count = 5) {
  const personas = [];
  for (let i = 0; i < count; i++) {
    const persona = await createTestPersona(userId, {
      documento: `123456789${i}`,
      nombres: `Persona${i}`,
      email: `persona${i}@test.com`
    });
    personas.push(persona);
  }
  return personas;
}

module.exports = {
  createTestUser,
  createTestAdmin,
  generateAuthToken,
  createTestPersona,
  createMultiplePersonas
};
