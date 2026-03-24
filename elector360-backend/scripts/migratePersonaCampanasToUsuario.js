/**
 * Migración: Sincronizar campanas[] de Persona → campanas[] de Usuario (LIDER)
 *
 * Cuando una Persona fue compartida a otra campaña (COMPARTIR), el código anterior
 * solo actualizaba Persona.campanas[] pero NO Usuario.campanas[] del líder.
 * Esto causaba que el middleware de campaña del LIDER no reconociera la campaña
 * compartida y volvía al scope de la campaña principal.
 *
 * Este script itera todas las personas con campanas[] no vacías y asegura
 * que el usuario líder tenga esas campañas en su propio campanas[].
 *
 * Uso: node scripts/migratePersonaCampanasToUsuario.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Persona = require('../src/models/Persona');
const Usuario = require('../src/models/Usuario');

async function migrate() {
  console.log('============================================');
  console.log('  MIGRACIÓN: Persona.campanas[] → Usuario.campanas[]');
  console.log('============================================\n');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI no está configurado en .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Conectado a MongoDB.\n');

  try {
    // Obtener todas las personas con campanas[] no vacías
    const personas = await Persona.find({ campanas: { $exists: true, $ne: [] } })
      .select('lider.id campanas campana')
      .lean();

    console.log(`Personas con campanas[] compartidas: ${personas.length}`);

    // Agrupar por lider.id para hacer un update eficiente
    const liderCampanasMap = {};
    for (const persona of personas) {
      const liderId = persona.lider?.id?.toString();
      if (!liderId) continue;

      if (!liderCampanasMap[liderId]) {
        liderCampanasMap[liderId] = new Set();
      }
      // Agregar la campaña principal también
      if (persona.campana) {
        liderCampanasMap[liderId].add(persona.campana.toString());
      }
      // Agregar todas las campañas compartidas
      for (const c of persona.campanas || []) {
        liderCampanasMap[liderId].add(c.toString());
      }
    }

    console.log(`LIDERs a actualizar: ${Object.keys(liderCampanasMap).length}\n`);

    let actualizados = 0;
    for (const [liderId, campanaIds] of Object.entries(liderCampanasMap)) {
      const campanaObjectIds = [...campanaIds].map(id => new mongoose.Types.ObjectId(id));

      const result = await Usuario.findByIdAndUpdate(
        liderId,
        { $addToSet: { campanas: { $each: campanaObjectIds } } },
        { new: true }
      );

      if (result) {
        console.log(`  LIDER ${result.perfil?.nombres || liderId}: campanas[] → ${result.campanas.length} campañas`);
        actualizados++;
      }
    }

    console.log('\n============================================');
    console.log('  MIGRACIÓN COMPLETADA');
    console.log(`  LIDERs actualizados: ${actualizados}`);
    console.log('============================================');

  } catch (error) {
    console.error('\nERROR en migración:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado de MongoDB.');
  }
}

migrate();
