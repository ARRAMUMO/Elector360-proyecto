#!/usr/bin/env node

/**
 * TEST DE CONEXIÓN - MongoDB Atlas
 * 
 * Prueba la conexión y muestra las colecciones existentes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

async function testConnection() {
  try {
    console.log(colors.cyan + '\n🔌 Probando conexión a MongoDB Atlas...' + colors.reset);
    
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      console.error(colors.red + '❌ Error: MONGODB_URI no está configurado en .env' + colors.reset);
      process.exit(1);
    }

    console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Ocultar password
    
    // Conectar
    await mongoose.connect(MONGODB_URI);
    
    console.log(colors.green + '\n✅ Conexión exitosa a MongoDB Atlas' + colors.reset);
    
    // Obtener información
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    
    console.log(colors.cyan + '\n📊 Base de datos:' + colors.reset, dbName);
    
    // Listar colecciones
    const collections = await db.listCollections().toArray();
    
    console.log(colors.cyan + '\n📁 Colecciones encontradas (' + collections.length + '):' + colors.reset);
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   • ${collection.name} (${count} documentos)`);
    }
    
    // Verificar colecciones requeridas
    console.log(colors.cyan + '\n🔍 Verificando colecciones requeridas:' + colors.reset);
    
    const requiredCollections = [
      'Usuarios_sistema',
      'Personas',
      'Logs_consultas',
      'historico_cambios'
    ];
    
    for (const collName of requiredCollections) {
      const exists = collections.find(c => c.name === collName);
      if (exists) {
        const count = await db.collection(collName).countDocuments();
        console.log(colors.green + `   ✅ ${collName} (${count} documentos)` + colors.reset);
      } else {
        console.log(colors.yellow + `   ⚠️  ${collName} (no existe, se creará automáticamente)` + colors.reset);
      }
    }
    
    // Verificar si existe usuario admin
    console.log(colors.cyan + '\n👤 Verificando usuario administrador:' + colors.reset);
    
    try {
      const adminUser = await db.collection('Usuarios_sistema').findOne({ rol: 'ADMIN' });
      if (adminUser) {
        console.log(colors.green + '   ✅ Usuario admin encontrado:' + colors.reset);
        console.log('      Email:', adminUser.email);
        console.log('      Nombre:', adminUser.perfil?.nombres, adminUser.perfil?.apellidos);
        console.log('      Estado:', adminUser.estado);
      } else {
        console.log(colors.yellow + '   ⚠️  No se encontró usuario admin. Ejecuta: node seed.js' + colors.reset);
      }
    } catch (error) {
      console.log(colors.yellow + '   ⚠️  Colección Usuarios_sistema no existe aún' + colors.reset);
    }
    
    console.log(colors.green + '\n✨ Test completado exitosamente\n' + colors.reset);
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error(colors.red + '\n❌ Error en la conexión:' + colors.reset);
    console.error(error.message);
    
    if (error.message.includes('authentication failed')) {
      console.log(colors.yellow + '\n💡 Sugerencias:' + colors.reset);
      console.log('   1. Verifica que el usuario y contraseña sean correctos');
      console.log('   2. Verifica que el usuario tenga permisos en la base de datos');
      console.log('   3. Verifica la configuración en MongoDB Atlas');
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
      console.log(colors.yellow + '\n💡 Sugerencias:' + colors.reset);
      console.log('   1. Verifica tu conexión a internet');
      console.log('   2. Verifica que tu IP esté en la whitelist de MongoDB Atlas');
      console.log('   3. Intenta agregar 0.0.0.0/0 a la whitelist para pruebas');
    }
    
    process.exit(1);
  }
}

testConnection();