// Ejemplo: Consulta MASIVA con Anti-Captcha automático
require('dotenv').config();

const RegistraduriaScrap = require('../scrapers/registraduria.scraper');
const captchaResolver = require('../services/captcha-resolver.service');

async function consultaMasiva() {
  const scraper = new RegistraduriaScrap();

  try {
    console.log('📦 EJEMPLO: Consulta Masiva (Batch)');
    console.log('='.repeat(60));
    console.log('Este script consulta MÚLTIPLES documentos.');
    console.log('El captcha se resolverá AUTOMÁTICAMENTE con Anti-Captcha.\n');

    // Verificar configuración
    const config = captchaResolver.getConfig();
    console.log('Configuración:');
    console.log(`  - Modo: ${config.mode}`);
    console.log(`  - Batch Mode: ${config.batchMode}`);
    console.log(`  - Individual Mode: ${config.individualMode}`);
    console.log(`  - Anti-Captcha Key: ${config.hasAntiCaptchaKey ? '✅ Configurada' : '❌ No configurada'}`);
    console.log();

    if (!config.hasAntiCaptchaKey && config.batchMode === 'anticaptcha') {
      console.log('⚠️  ADVERTENCIA: Anti-Captcha no está configurado.');
      console.log('    Configura ANTICAPTCHA_API_KEY en .env');
      return;
    }

    // Verificar balance
    try {
      const balance = await captchaResolver.getBalance();
      console.log(`💰 Balance de ${balance.service}: $${balance.balance}\n`);
    } catch (e) {
      console.log('⚠️  No se pudo verificar balance\n');
    }

    await scraper.init();

    // Lista de documentos para consultar
    const documentos = [
      '1083432108',
      '1045667173',
      '22571137'
      // Agregar más documentos aquí
    ];

    console.log(`📋 Documentos a consultar: ${documentos.length}\n`);
    console.log('='.repeat(60));

    const resultados = [];
    const isBatch = true; // Consulta masiva

    for (let i = 0; i < documentos.length; i++) {
      const doc = documentos[i];
      console.log(`\n[${i + 1}/${documentos.length}] Consultando: ${doc}`);

      const resultado = await scraper.consultarPersona(doc, isBatch);

      if (resultado.success) {
        console.log(`✅ Exitoso: ${resultado.datos.datosElectorales.municipio}`);
        resultados.push({
          documento: doc,
          success: true,
          datos: resultado.datos
        });
      } else {
        console.log(`❌ Fallido: ${resultado.error}`);
        resultados.push({
          documento: doc,
          success: false,
          error: resultado.error
        });
      }

      // Delay entre consultas para no sobrecargar
      if (i < documentos.length - 1) {
        console.log('⏳ Esperando 3 segundos...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Reiniciar navegador cada 10 consultas
        if ((i + 1) % 10 === 0) {
          console.log('🔄 Reiniciando navegador...');
          await scraper.close();
          await scraper.init();
        }
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(60));

    const exitosos = resultados.filter(r => r.success).length;
    const fallidos = resultados.filter(r => !r.success).length;

    console.log(`Total consultado: ${resultados.length}`);
    console.log(`✅ Exitosos: ${exitosos} (${((exitosos / resultados.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Fallidos: ${fallidos} (${((fallidos / resultados.length) * 100).toFixed(1)}%)`);

    // Guardar resultados
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `resultados-batch-${timestamp}.json`;

    fs.writeFileSync(filename, JSON.stringify(resultados, null, 2));
    console.log(`\n💾 Resultados guardados en: ${filename}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

consultaMasiva();
