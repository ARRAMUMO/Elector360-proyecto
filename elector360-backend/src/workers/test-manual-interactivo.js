// Script para prueba manual interactiva
require('dotenv').config();

// Forzar modo manual y no-headless
process.env.CAPTCHA_MANUAL_MODE = 'true';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const captchaService = require('./services/captcha.service');
const helpers = require('./utils/helpers');

puppeteer.use(StealthPlugin());

async function testInteractivo() {
  let browser;
  const documento = '1083432108';

  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 TEST INTERACTIVO - Scraper Registraduría Nacional');
    console.log('='.repeat(70));
    console.log('\n📌 INSTRUCCIONES:');
    console.log('   1. Se abrirá un navegador Chrome VISIBLE');
    console.log('   2. El formulario se llenará automáticamente');
    console.log('   3. IMPORTANTE: Debes resolver el captcha MANUALMENTE');
    console.log('   4. Después del captcha, el script continuará automáticamente');
    console.log('   5. Verificaremos que los datos se extraigan correctamente\n');
    console.log('⏱️  Tienes hasta 5 MINUTOS para resolver el captcha\n');
    console.log('='.repeat(70));
    console.log('\n⏳ Iniciando en 3 segundos...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Iniciar navegador VISIBLE
    console.log('🌐 Abriendo navegador...');
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1400,900',
        '--start-maximized'
      ],
      defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(60000);

    // Navegar a la página
    console.log('📄 Navegando a la Registraduría...');
    await page.goto('https://eleccionescolombia.registraduria.gov.co/identificacion', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Llenar documento
    console.log(`\n✍️  Llenando documento: ${documento}`);
    const documentSelector = '#document';
    await page.waitForSelector(documentSelector, { timeout: 10000 });
    await page.click(documentSelector);
    await page.type(documentSelector, documento, { delay: 100 });

    console.log('✅ Documento ingresado\n');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Intentar resolver captcha automáticamente primero
    console.log('🔐 Intentando resolver captcha automáticamente...');
    try {
      const siteKey = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          const src = iframe.src || '';
          const match = src.match(/[?&]k=([^&]+)/);
          if (match) return match[1];
        }
        return null;
      });

      if (siteKey) {
        console.log(`   SiteKey encontrado: ${siteKey}`);
        const solution = await captchaService.solveRecaptchaV2(siteKey, page.url());

        // Inyectar solución
        await page.evaluate((token) => {
          document.querySelectorAll('[name="g-recaptcha-response"]').forEach(el => {
            el.innerHTML = token;
            el.value = token;
          });

          if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
            Object.keys(window.___grecaptcha_cfg.clients).forEach(clientId => {
              const client = window.___grecaptcha_cfg.clients[clientId];
              if (!client) return;

              Object.keys(client).forEach(key => {
                if (isNaN(key)) return;
                const widget = client[key];
                if (widget && widget.callback && typeof widget.callback === 'function') {
                  try { widget.callback(token); } catch (e) {}
                }
              });
            });
          }
        }, solution);

        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('   ✅ Token inyectado');
      }
    } catch (error) {
      console.log(`   ⚠️  Resolución automática falló: ${error.message}`);
    }

    // Verificar si el botón está habilitado
    const buttonEnabled = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
      return submitButton ? !submitButton.disabled : false;
    });

    if (!buttonEnabled) {
      console.log('\n' + '='.repeat(70));
      console.log('👆 ACCIÓN REQUERIDA: Resuelve el captcha MANUALMENTE');
      console.log('='.repeat(70));
      console.log('\n   1. Haz clic en el checkbox "No soy un robot"');
      console.log('   2. Completa el desafío si aparece');
      console.log('   3. Espera a que el botón "Consultar" se habilite');
      console.log('   4. El script continuará automáticamente\n');
      console.log('⏱️  Esperando... (máximo 5 minutos)\n');

      // Esperar a que se resuelva el captcha
      await page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
          return submitButton && !submitButton.disabled;
        },
        { timeout: 300000 } // 5 minutos
      );

      console.log('✅ ¡Captcha resuelto!\n');
    } else {
      console.log('✅ Captcha ya está resuelto\n');
    }

    // Click en Consultar
    console.log('🔍 Haciendo click en "Consultar"...');
    const initialContent = await page.evaluate(() => document.body.innerText);

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.click();
      }
    });

    console.log('⏳ Esperando resultados...');

    // Esperar a que aparezcan los resultados
    await page.waitForFunction(
      (initial) => {
        const current = document.body.innerText;
        return current !== initial &&
               (current.includes('Departamento') ||
                current.includes('Municipio') ||
                current.includes('Mesa'));
      },
      { timeout: 30000 },
      initialContent
    );

    console.log('✅ Resultados cargados\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extraer datos
    console.log('📊 Extrayendo datos...');
    const datos = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      const extraerValor = (texto, etiqueta) => {
        const regex = new RegExp(etiqueta + '\\s*:?\\s*([A-ZÑ0-9][A-ZÑ0-9\\s\\-\\.#]+)', 'i');
        const match = texto.match(regex);
        return match ? match[1].trim().split('\n')[0].trim() : '';
      };

      return {
        documento: extraerValor(bodyText, 'Documento de identidad|C\\.C\\.?|Cédula'),
        departamento: extraerValor(bodyText, 'Departamento'),
        municipio: extraerValor(bodyText, 'Municipio'),
        puesto: extraerValor(bodyText, 'Puesto'),
        direccion: extraerValor(bodyText, 'Dirección'),
        mesa: extraerValor(bodyText, 'Mesa'),
        zona: extraerValor(bodyText, 'Zona'),
        bodyText: bodyText.substring(0, 1000)
      };
    });

    // Mostrar resultados
    console.log('\n' + '='.repeat(70));
    console.log('✅ ¡ÉXITO! Datos extraídos correctamente');
    console.log('='.repeat(70));
    console.log('\n📋 INFORMACIÓN EXTRAÍDA:\n');
    console.log(`   • Documento:     ${datos.documento || '❌ No extraído'}`);
    console.log(`   • Departamento:  ${datos.departamento || '❌ No extraído'}`);
    console.log(`   • Municipio:     ${datos.municipio || '❌ No extraído'}`);
    console.log(`   • Puesto:        ${datos.puesto || '❌ No extraído'}`);
    console.log(`   • Dirección:     ${datos.direccion || '❌ No extraído'}`);
    console.log(`   • Mesa:          ${datos.mesa || '❌ No extraído'}`);
    console.log(`   • Zona:          ${datos.zona || '❌ No extraído'}`);
    console.log('\n' + '='.repeat(70));

    // Validar extracción
    const exito = datos.departamento && datos.municipio && datos.puesto;
    if (exito) {
      console.log('\n✅ VALIDACIÓN: Datos principales extraídos correctamente');
      console.log('✅ El scraper está funcionando correctamente\n');
    } else {
      console.log('\n⚠️  ADVERTENCIA: Algunos datos no se extrajeron');
      console.log('📄 Texto completo de la página:');
      console.log(datos.bodyText);
    }

    // Mantener navegador abierto unos segundos
    console.log('⏳ Manteniendo navegador abierto 10 segundos para revisión...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log('✅ Navegador cerrado');
    }
    console.log('\n' + '='.repeat(70));
    console.log('👋 Test finalizado');
    console.log('='.repeat(70) + '\n');
  }
}

// Ejecutar
testInteractivo();
