// test-rpa-completo.js - Prueba completa del scraper de Registraduría
require('dotenv').config();
const RegistraduriaScrap = require('./src/workers/scrapers/registraduria.scraper');

const DOCUMENTO_PRUEBA = '1083432108';

async function testRPACompleto() {
  const scraper = new RegistraduriaScrap();

  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     PRUEBA COMPLETA DEL RPA - REGISTRADURÍA           ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('📋 Configuración:');
    console.log(`   Documento: ${DOCUMENTO_PRUEBA}`);
    console.log(`   API Key 2Captcha: ${process.env.CAPTCHA_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);
    console.log('');

    // 1. Inicializar scraper
    console.log('1️⃣ Inicializando navegador...');
    await scraper.init();
    console.log('   ✅ Navegador iniciado\n');

    // 2. Consultar documento
    console.log('2️⃣ Consultando documento...');
    console.log('   (Esto puede tomar 1-2 minutos por el captcha)\n');

    const startTime = Date.now();
    const resultado = await scraper.consultarPersona(DOCUMENTO_PRUEBA);
    const duration = Date.now() - startTime;

    // 3. Mostrar resultado
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    RESULTADO                          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    if (resultado.success) {
      console.log('✅ CONSULTA EXITOSA\n');
      console.log('📊 Datos obtenidos:');
      console.log('   ├─ Documento:', resultado.datos.documento);
      console.log('   ├─ Departamento:', resultado.datos.datosElectorales?.departamento);
      console.log('   ├─ Municipio:', resultado.datos.datosElectorales?.municipio);
      console.log('   ├─ Puesto:', resultado.datos.datosElectorales?.puestoVotacion);
      console.log('   ├─ Dirección:', resultado.datos.datosElectorales?.direccion);
      console.log('   └─ Mesa:', resultado.datos.datosElectorales?.mesa);
    } else {
      console.log('❌ CONSULTA FALLIDA');
      console.log('   Error:', resultado.error);
    }

    console.log('\n⏱️  Tiempo de ejecución:', (duration / 1000).toFixed(2), 'segundos');

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message);
    console.error(error.stack);
  } finally {
    // Cerrar scraper
    console.log('\n🛑 Cerrando navegador...');
    await scraper.close();
    console.log('✅ Prueba completada\n');
  }
}

testRPACompleto();
