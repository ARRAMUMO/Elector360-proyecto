/**
 * Script de migración: Agregar soporte multi-campaña
 *
 * Este script:
 * 1. Crea una campaña default "Campaña Principal"
 * 2. Asigna esa campaña a todos los Usuarios (excepto ADMIN)
 * 3. Asigna esa campaña a todas las Personas
 * 4. Asigna esa campaña a ColaConsulta, ConsultaRPA, HistorialCambio
 * 5. Elimina el índice único antiguo { documento: 1 }
 * 6. Mongoose creará automáticamente el nuevo índice { documento: 1, campana: 1 }
 *
 * Uso: node scripts/migrateToCampaigns.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Importar modelos
const Campana = require('../src/models/Campana');
const Usuario = require('../src/models/Usuario');
const Persona = require('../src/models/Persona');
const ColaConsulta = require('../src/models/ColaConsulta');
const ConsultaRPA = require('../src/models/consultaRPA.model');
const HistorialCambio = require('../src/models/HistorialCambio');

async function migrate() {
  console.log('====================================');
  console.log('  MIGRACIÓN: Multi-Campaña');
  console.log('====================================\n');

  // Conectar a MongoDB
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI no está configurado en .env');
    process.exit(1);
  }

  console.log('Conectando a MongoDB...');
  await mongoose.connect(uri);
  console.log('Conectado.\n');

  try {
    // Paso 1: Crear campaña default
    console.log('[1/6] Creando campaña default...');
    let campanaDefault = await Campana.findOne({ nombre: 'Campaña Principal' });
    if (!campanaDefault) {
      campanaDefault = await Campana.create({
        nombre: 'Campaña Principal',
        descripcion: 'Campaña migrada automáticamente desde datos existentes',
        tipo: 'OTRO',
        estado: 'ACTIVA'
      });
      console.log(`  Campaña creada: ${campanaDefault._id}`);
    } else {
      console.log(`  Campaña ya existe: ${campanaDefault._id}`);
    }

    const campanaId = campanaDefault._id;

    // Paso 2: Asignar campaña a usuarios (excepto ADMIN)
    console.log('\n[2/6] Asignando campaña a usuarios...');
    const resultUsuarios = await Usuario.updateMany(
      { rol: { $ne: 'ADMIN' }, campana: null },
      { $set: { campana: campanaId } }
    );
    console.log(`  ${resultUsuarios.modifiedCount} usuarios actualizados`);

    // Paso 3: Asignar campaña a personas
    console.log('\n[3/6] Asignando campaña a personas...');
    const resultPersonas = await Persona.updateMany(
      { campana: null },
      { $set: { campana: campanaId } }
    );
    console.log(`  ${resultPersonas.modifiedCount} personas actualizadas`);

    // Paso 4: Asignar campaña a ColaConsulta
    console.log('\n[4/6] Asignando campaña a cola de consultas...');
    const resultCola = await ColaConsulta.updateMany(
      { campana: null },
      { $set: { campana: campanaId } }
    );
    console.log(`  ${resultCola.modifiedCount} registros actualizados`);

    // Paso 5: Asignar campaña a ConsultaRPA
    console.log('\n[5/6] Asignando campaña a consultas RPA...');
    const resultRPA = await ConsultaRPA.updateMany(
      { campana: null },
      { $set: { campana: campanaId } }
    );
    console.log(`  ${resultRPA.modifiedCount} registros actualizados`);

    // Paso 6: Asignar campaña a HistorialCambio
    console.log('\n[6/6] Asignando campaña a historial de cambios...');
    const resultHistorial = await HistorialCambio.updateMany(
      { campana: null },
      { $set: { campana: campanaId } }
    );
    console.log(`  ${resultHistorial.modifiedCount} registros actualizados`);

    // Paso extra: Eliminar índice único antiguo de documento si existe
    console.log('\nEliminando índice antiguo { documento: 1 } si existe...');
    try {
      const collection = mongoose.connection.collection('personas');
      const indexes = await collection.indexes();
      const oldIndex = indexes.find(idx =>
        idx.key && idx.key.documento === 1 && !idx.key.campana && idx.unique
      );
      if (oldIndex) {
        await collection.dropIndex(oldIndex.name);
        console.log(`  Índice "${oldIndex.name}" eliminado`);
      } else {
        console.log('  No se encontró índice antiguo');
      }
    } catch (err) {
      console.log(`  Nota: ${err.message}`);
    }

    // Sincronizar índices nuevos
    console.log('\nSincronizando índices de Mongoose...');
    await Persona.syncIndexes();
    console.log('  Índices sincronizados');

    // Resumen
    console.log('\n====================================');
    console.log('  MIGRACIÓN COMPLETADA');
    console.log('====================================');
    console.log(`  Campaña: ${campanaDefault.nombre} (${campanaId})`);
    console.log(`  Usuarios: ${resultUsuarios.modifiedCount}`);
    console.log(`  Personas: ${resultPersonas.modifiedCount}`);
    console.log(`  Cola: ${resultCola.modifiedCount}`);
    console.log(`  RPA: ${resultRPA.modifiedCount}`);
    console.log(`  Historial: ${resultHistorial.modifiedCount}`);

  } catch (error) {
    console.error('\nERROR en migración:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado de MongoDB.');
  }
}

migrate();
