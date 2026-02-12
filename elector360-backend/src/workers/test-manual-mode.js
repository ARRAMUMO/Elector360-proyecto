// Script para probar el scraper con resolución manual de captcha
require('dotenv').config();

// Forzar modo manual
process.env.CAPTCHA_MANUAL_MODE = 'true';

const RegistraduriaScrap = require('./scrapers/registraduria.scraper');

async function testManualMode() {
  const scraper = new RegistraduriaScrap();

  try {
    console.log('🚀 Inicializando scraper en MODO MANUAL...');
    console.log('📌 El navegador se abrirá visible para que puedas resolver el captcha manualmente.\n');

    // Configurar modo no-headless temporalmente
    const config = require('./config/worker.config');
    const originalHeadless = config.puppeteer.headless;
    config.puppeteer.headless = false;

    await scraper.init();

    // Restaurar configuración
    config.puppeteer.headless = originalHeadless;

    const documento = '1083432108';
    console.log(`\n🔍 Consultando documento: ${documento}`);
    console.log('⏳ Cuando aparezca el captcha, resuélvelo manualmente...\n');

    const resultado = await scraper.consultarPersona(documento);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO DE LA CONSULTA');
    console.log('='.repeat(60));

    if (resultado.success) {
      console.log('\n✅ ¡CONSULTA EXITOSA!\n');
      console.log('📋 Datos extraídos:');
      console.log(`   • Documento: ${resultado.datos.documento || 'N/A'}`);
      console.log(`   • Departamento: ${resultado.datos.datosElectorales.departamento || 'N/A'}`);
      console.log(`   • Municipio: ${resultado.datos.datosElectorales.municipio || 'N/A'}`);
      console.log(`   • Puesto: ${resultado.datos.datosElectorales.puestoVotacion || 'N/A'}`);
      console.log(`   • Dirección: ${resultado.datos.datosElectorales.direccion || 'N/A'}`);
      console.log(`   • Mesa: ${resultado.datos.datosElectorales.mesa || 'N/A'}`);
      if (resultado.datos.datosElectorales.zona) {
        console.log(`   • Zona: ${resultado.datos.datosElectorales.zona}`);
      }
      console.log('\n' + '='.repeat(60));
    } else {
      console.log('\n❌ CONSULTA FALLIDA\n');
      console.log(`Error: ${resultado.error}`);
      console.log('\n' + '='.repeat(60));
    }

  } catch (error) {
    console.error('\n❌ Error en el test:', error.message);
  } finally {
    await scraper.close();
    console.log('\n👋 Test finalizado');
  }
}

// Ejecutar
testManualMode();
