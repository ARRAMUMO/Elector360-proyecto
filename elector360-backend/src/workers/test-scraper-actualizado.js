// Script para probar el scraper actualizado
require('dotenv').config();

const RegistraduriaScrap = require('./scrapers/registraduria.scraper');

async function testScraper() {
  const scraper = new RegistraduriaScrap();

  try {
    console.log('🚀 Inicializando scraper...');
    await scraper.init();

    const documento = '1083432108';
    console.log(`\n🔍 Consultando documento: ${documento}`);

    const resultado = await scraper.consultarPersona(documento);

    console.log('\n📊 RESULTADO DE LA CONSULTA:');
    console.log(JSON.stringify(resultado, null, 2));

    if (resultado.success) {
      console.log('\n✅ ¡Consulta exitosa!');
      console.log('\n📋 Datos extraídos:');
      console.log(`   Documento: ${resultado.datos.documento}`);
      console.log(`   Departamento: ${resultado.datos.datosElectorales.departamento}`);
      console.log(`   Municipio: ${resultado.datos.datosElectorales.municipio}`);
      console.log(`   Puesto: ${resultado.datos.datosElectorales.puestoVotacion}`);
      console.log(`   Dirección: ${resultado.datos.datosElectorales.direccion}`);
      console.log(`   Mesa: ${resultado.datos.datosElectorales.mesa}`);
      if (resultado.datos.datosElectorales.zona) {
        console.log(`   Zona: ${resultado.datos.datosElectorales.zona}`);
      }
    } else {
      console.log('\n❌ Consulta fallida:', resultado.error);
    }

  } catch (error) {
    console.error('\n❌ Error en el test:', error);
  } finally {
    await scraper.close();
    console.log('\n👋 Test finalizado');
  }
}

// Ejecutar
testScraper();
