// Script para probar consulta completa con la nueva página
require('dotenv').config(); // Cargar variables de entorno

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const captchaService = require('./services/captcha.service');

puppeteer.use(StealthPlugin());

async function testConsulta() {
  let browser;
  try {
    console.log('🚀 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: false, // Ver el proceso
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    const documento = '1083432108';

    console.log('📄 Navegando a la página...');
    await page.goto('https://eleccionescolombia.registraduria.gov.co/identificacion', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 1. Llenar campo de documento
    console.log(`\n✍️ Llenando documento: ${documento}`);
    const documentSelector = '#document';
    await page.waitForSelector(documentSelector, { timeout: 10000 });
    await page.click(documentSelector);
    await page.type(documentSelector, documento, { delay: 150 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Resolver captcha
    console.log('\n🔐 Resolviendo reCAPTCHA...');
    const siteKey = '6Lc9DmgrAAAAAJAjWVhjDy1KSgqzqJikY5z7I9SV';
    const pageUrl = page.url();

    try {
      const solution = await captchaService.solveRecaptchaV2(siteKey, pageUrl);
      console.log('✅ Captcha resuelto, inyectando solución...');

      // Inyectar solución
      await page.evaluate((token) => {
        const textarea = document.getElementById('g-recaptcha-response');
        if (textarea) {
          textarea.innerHTML = token;
          textarea.value = token;
        }

        // Trigger callback si existe
        if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
          Object.keys(window.___grecaptcha_cfg.clients).forEach(key => {
            const client = window.___grecaptcha_cfg.clients[key];
            if (client && client.callback) {
              client.callback(token);
            }
          });
        }
      }, solution);

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('⚠️ Error resolviendo captcha:', error.message);
      console.log('⏳ Esperando 60 segundos para resolución manual...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }

    // 3. Click en consultar
    console.log('\n🔍 Enviando formulario...');

    // Guardar contenido inicial para comparar
    const initialContent = await page.evaluate(() => document.body.innerText);

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
      const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
      if (submitButton) {
        submitButton.click();
      }
    });
    console.log('✅ Click en botón ejecutado');

    // 4. Esperar a que cambie el contenido de la página
    console.log('\n⏳ Esperando cambios en la página...');

    try {
      await page.waitForFunction(
        (initial) => {
          const current = document.body.innerText;
          return current !== initial &&
                 (current.includes('Departamento') ||
                  current.includes('Municipio') ||
                  current.includes('Mesa') ||
                  current.includes('no encontrado'));
        },
        { timeout: 30000 },
        initialContent
      );
      console.log('✅ Contenido cambió - resultados encontrados');
    } catch (error) {
      console.log('⚠️ Timeout esperando cambios. Continuando de todas formas...');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Inspeccionar estructura de resultados
    const resultados = await page.evaluate(() => {
      return {
        bodyText: document.body.innerText,
        hasTable: !!document.querySelector('table'),
        hasList: !!document.querySelector('ul'),
        hasCards: !!document.querySelector('.card, [class*="card"]'),
        hasDivResults: document.querySelectorAll('div').length,
        // Buscar elementos que contengan información típica
        departamentoText: document.body.innerText.match(/Departamento[:\s]*([\w\s]+)/i)?.[0],
        municipioText: document.body.innerText.match(/Municipio[:\s]*([\w\s]+)/i)?.[0],
        puestoText: document.body.innerText.match(/Puesto[:\s]*([\w\s\-\.]+)/i)?.[0],
        mesaText: document.body.innerText.match(/Mesa[:\s]*([\w\s]+)/i)?.[0],
        direccionText: document.body.innerText.match(/Dirección[:\s]*([\w\s\#\-\.]+)/i)?.[0]
      };
    });

    console.log('\n📊 ESTRUCTURA DE RESULTADOS:');
    console.log(JSON.stringify(resultados, null, 2));

    // 6. Screenshot de resultados
    await page.screenshot({ path: 'resultados-consulta.png', fullPage: true });
    console.log('\n📸 Screenshot de resultados guardado: resultados-consulta.png');

    // 7. Extraer todos los divs con información
    const detallesHTML = await page.evaluate(() => {
      // Buscar el contenedor principal de resultados
      const bodyHTML = document.body.innerHTML;

      // Buscar divs que contengan palabras clave
      const keywords = ['Departamento', 'Municipio', 'Puesto', 'Mesa', 'Dirección', 'Zona', 'votación'];
      const relevantDivs = [];

      document.querySelectorAll('div').forEach((div, index) => {
        const text = div.textContent || '';
        if (keywords.some(kw => text.includes(kw)) && text.length < 200) {
          relevantDivs.push({
            index,
            text: text.trim(),
            className: div.className,
            id: div.id
          });
        }
      });

      return relevantDivs.slice(0, 50); // Limitar a 50 más relevantes
    });

    console.log('\n📋 DIVS RELEVANTES CON INFORMACIÓN:');
    console.log(JSON.stringify(detallesHTML, null, 2));

    // Esperar para inspección manual
    console.log('\n⏳ Esperando 30 segundos para inspección manual...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n✅ Navegador cerrado');
    }
  }
}

// Ejecutar
testConsulta();
