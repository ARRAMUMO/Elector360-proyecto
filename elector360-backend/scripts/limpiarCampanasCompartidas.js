/**
 * Script de limpieza: Eliminar campanas[] compartidas de Personas y Usuarios
 *
 * Revierte los datos generados por la feature "Mover/Compartir persona entre campañas":
 * 1. Vacía Persona.campanas[] (cada persona vuelve solo a su campana principal)
 * 2. Limpia Usuario.campanas[] dejando solo la campana principal del LIDER
 *    (la que coincide con Usuario.campana)
 *
 * Uso: node scripts/limpiarCampanasCompartidas.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Persona = require('../src/models/Persona');

async function limpiar() {
  console.log('============================================');
  console.log('  LIMPIEZA: Campañas compartidas');
  console.log('============================================\n');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI no está configurado en .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Conectado a MongoDB.\n');

  try {
    // 1. Vaciar campanas[] de todas las personas
    console.log('[1/2] Limpiando Persona.campanas[]...');
    const resPersonas = await Persona.updateMany(
      { campanas: { $exists: true, $ne: [] } },
      { $set: { campanas: [] } }
    );
    console.log(`  ${resPersonas.modifiedCount} personas limpiadas\n`);

    // 2. No se toca Usuario.campanas[] — esas asignaciones son legítimas
    //    (el coordinador asigna LIDERs a múltiples campañas desde Usuarios.jsx)
    console.log('[2/2] Usuario.campanas[] no se modifica (asignaciones del coordinador).\n');

    console.log('============================================');
    console.log('  LIMPIEZA COMPLETADA');
    console.log('============================================');

  } catch (error) {
    console.error('\nERROR en limpieza:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado de MongoDB.');
  }
}

limpiar();
