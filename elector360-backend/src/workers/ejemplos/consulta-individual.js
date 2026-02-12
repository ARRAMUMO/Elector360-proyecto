// Ejemplo: Consulta INDIVIDUAL con modo manual
require('dotenv').config();

const RegistraduriaScrap = require('../scrapers/registraduria.scraper');

async function consultaIndividual() {
  const scraper = new RegistraduriaScrap();

  try {
    console.log('📋 EJEMPLO: Consulta Individual (Modo Manual)');
    console.log('='.repeat(60));
    console.log('Este script consulta UN solo documento.');
    console.log('El captcha se resolverá MANUALMENTE.\n');

    // Asegurarse de que el navegador esté visible
    const config = require('../config/worker.config');
    config.puppeteer.headless = false; // Navegador visible

    await scraper.init();

    const documento = '1083432108'; // Documento de ejemplo
    const isBatch = false; // Consulta individual

    console.log(`Consultando: ${documento}\n`);

    const resultado = await scraper.consultarPersona(documento, isBatch);

    if (resultado.success) {
      console.log('\n✅ CONSULTA EXITOSA');
      console.log('='.repeat(60));
      console.log('Datos extraídos:');
      console.log(JSON.stringify(resultado.datos, null, 2));
    } else {
      console.log('\n❌ CONSULTA FALLIDA');
      console.log(`Error: ${resultado.error}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

consultaIndividual();
