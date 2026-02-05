#!/usr/bin/env node

/**
 * SEED SCRIPT - Elector360 Backend
 * 
 * Crea el usuario administrador inicial en la base de datos
 * 
 * Uso:
 *   node seed.js
 * 
 * Variables de entorno requeridas:
 *   MONGODB_URI
 *   ADMIN_EMAIL (opcional, default: admin@elector360.com)
 *   ADMIN_PASSWORD (opcional, default: password123)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Configuración
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@elector360.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';
const MONGODB_URI = process.env.MONGODB_URI;

// Esquema simplificado de Usuario
const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { type: String, enum: ['ADMIN', 'LIDER'], required: true },
  perfil: {
    nombres: { type: String, required: true },
    apellidos: { type: String, required: true },
    telefono: String,
    foto: String
  },
  estado: {
    type: String,
    enum: ['ACTIVO', 'INACTIVO'],
    default: 'ACTIVO'
  },
  stats: {
    personasRegistradas: { type: Number, default: 0 },
    consultasRealizadas: { type: Number, default: 0 },
    ultimaConsulta: Date
  },
  ultimoLogin: Date
}, { timestamps: true });

const Usuario = mongoose.model('Usuario', usuarioSchema);

// Función principal
async function seed() {
  try {
    console.log('\n' + colors.cyan + colors.bright + '╔═══════════════════════════════════════╗');
    console.log('║   ELECTOR360 - Seed Database         ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset + '\n');

    // Verificar variables de entorno
    if (!MONGODB_URI) {
      console.error(colors.red + '❌ Error: MONGODB_URI no está configurado en .env' + colors.reset);
      process.exit(1);
    }

    // Conectar a MongoDB
    console.log(colors.yellow + '⏳ Conectando a MongoDB...' + colors.reset);
    await mongoose.connect(MONGODB_URI);
    console.log(colors.green + '✅ Conectado a MongoDB' + colors.reset + '\n');

    // Verificar si ya existe el admin
    console.log(colors.yellow + '🔍 Verificando si el administrador ya existe...' + colors.reset);
    const adminExistente = await Usuario.findOne({ email: ADMIN_EMAIL });

    if (adminExistente) {
      console.log(colors.yellow + '\n⚠️  El usuario administrador ya existe:' + colors.reset);
      console.log('   Email:', colors.cyan + ADMIN_EMAIL + colors.reset);
      console.log('   Creado:', adminExistente.createdAt);
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const respuesta = await new Promise(resolve => {
        readline.question('\n¿Deseas sobrescribirlo? (s/N): ', resolve);
      });
      readline.close();

      if (respuesta.toLowerCase() !== 's') {
        console.log(colors.yellow + '\n❌ Operación cancelada' + colors.reset);
        await mongoose.connection.close();
        process.exit(0);
      }

      // Eliminar admin existente
      await Usuario.deleteOne({ email: ADMIN_EMAIL });
      console.log(colors.green + '✅ Usuario anterior eliminado' + colors.reset);
    }

    // Crear nuevo usuario admin
    console.log(colors.yellow + '\n🔐 Encriptando contraseña...' + colors.reset);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    console.log(colors.yellow + '👤 Creando usuario administrador...' + colors.reset);
    const admin = await Usuario.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      rol: 'ADMIN',
      perfil: {
        nombres: 'Admin',
        apellidos: 'Sistema'
      },
      estado: 'ACTIVO',
      stats: {
        personasRegistradas: 0,
        consultasRealizadas: 0
      }
    });

    // Mostrar resumen
    console.log(colors.green + colors.bright + '\n╔═══════════════════════════════════════╗');
    console.log('║   ✅ USUARIO ADMIN CREADO            ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    console.log('\n📧 Email:   ', colors.cyan + colors.bright + ADMIN_EMAIL + colors.reset);
    console.log('🔑 Password:', colors.cyan + colors.bright + ADMIN_PASSWORD + colors.reset);
    console.log('👤 Rol:     ', colors.cyan + 'ADMIN' + colors.reset);
    console.log('📅 Creado:  ', admin.createdAt);
    console.log('🆔 ID:      ', admin._id);

    console.log(colors.yellow + '\n⚠️  IMPORTANTE:' + colors.reset);
    console.log('   1. Cambia la contraseña después del primer login');
    console.log('   2. No uses esta contraseña en producción');
    console.log('   3. Guarda estas credenciales en un lugar seguro');

    console.log(colors.green + '\n✨ Seed completado exitosamente\n' + colors.reset);

    // Cerrar conexión
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error(colors.red + '\n❌ Error en seed:' + colors.reset, error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar seed
seed();