// test-rpa.js - Script para probar y verificar selectores de la Registraduría
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { createCursor } = require('ghost-cursor');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

const DOCUMENTO_PRUEBA = '1083432108'; // El documento de la captura

async function testRPA() {
  let browser = null;

  try {
    console.log('🚀 Iniciando prueba de RPA...\n');

    // Crear carpeta para screenshots
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }

    // Generar User Agent aleatorio (simulación)
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
    // const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

    // Lanzar navegador (headless: false para ver el proceso)
    browser = await puppeteer.launch({
      headless: false, // Ver el navegador
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled', // Ocultar que es automatizado
        `--user-agent=${userAgent}`
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    // Inicializar Ghost Cursor (movimiento humano del mouse)
    const cursor = createCursor(page);
    // await cursor.toggleRandomMove(true);

    // 1. Navegar a la página
    console.log('📄 Navegando a la Registraduría...');
    await page.goto('https://wsp.registraduria.gov.co/censo/consultar/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.screenshot({ path: path.join(screenshotsDir, '01-pagina-inicial.png') });
    console.log('✅ Página cargada\n');

    // 2. Analizar la estructura del formulario
    console.log('🔍 Analizando estructura del formulario...\n');

    const formInfo = await page.evaluate(() => {
      const info = {
        inputs: [],
        selects: [],
        buttons: [],
        captcha: null,
        tables: []
      };

      // Buscar inputs
      document.querySelectorAll('input').forEach(input => {
        info.inputs.push({
          type: input.type,
          name: input.name,
          id: input.id,
          class: input.className,
          placeholder: input.placeholder
        });
      });

      // Buscar selects
      document.querySelectorAll('select').forEach(select => {
        info.selects.push({
          name: select.name,
          id: select.id,
          class: select.className,
          options: Array.from(select.options).map(o => ({ value: o.value, text: o.text }))
        });
      });

      // Buscar botones
      document.querySelectorAll('button, input[type="submit"]').forEach(btn => {
        info.buttons.push({
          type: btn.type,
          text: btn.textContent?.trim(),
          id: btn.id,
          class: btn.className
        });
      });

      // Buscar captcha
      const captchaElement = document.querySelector('[data-sitekey]');
      if (captchaElement) {
        info.captcha = {
          sitekey: captchaElement.getAttribute('data-sitekey'),
          class: captchaElement.className
        };
      }

      // Buscar el iframe del captcha
      const iframe = document.querySelector('iframe[src*="recaptcha"]');
      if (iframe) {
        info.captcha = info.captcha || {};
        info.captcha.iframeSrc = iframe.src;
      }

      return info;
    });

    console.log('📋 INPUTS encontrados:');
    formInfo.inputs.forEach((input, i) => {
      console.log(`   ${i+1}. type="${input.type}" name="${input.name}" id="${input.id}" placeholder="${input.placeholder}"`);
    });

    console.log('\n📋 SELECTS encontrados:');
    formInfo.selects.forEach((select, i) => {
      console.log(`   ${i+1}. name="${select.name}" id="${select.id}"`);
      select.options.forEach(opt => {
        console.log(`      - "${opt.text}" (value: ${opt.value})`);
      });
    });

    console.log('\n📋 BOTONES encontrados:');
    formInfo.buttons.forEach((btn, i) => {
      console.log(`   ${i+1}. text="${btn.text}" id="${btn.id}" class="${btn.class}"`);
    });

    console.log('\n📋 CAPTCHA:');
    if (formInfo.captcha) {
      console.log(`   Sitekey: ${formInfo.captcha.sitekey}`);
      console.log(`   Class: ${formInfo.captcha.class}`);
    } else {
      console.log('   No encontrado directamente');
    }

    // 3. Intentar llenar el formulario
    console.log('\n📝 Intentando llenar el formulario...');

    // Buscar el input de documento (probando varios selectores)
    const documentoSelectors = [
      'input[name="cedula"]',
      'input[name="documento"]',
      'input[name="nuip"]',
      'input[type="text"]',
      'input[type="number"]',
      '#cedula',
      '#documento',
      '#nuip'
    ];

    let documentoInput = null;
    for (const selector of documentoSelectors) {
      documentoInput = await page.$(selector);
      if (documentoInput) {
        console.log(`   ✅ Input de documento encontrado con: ${selector}`);
        break;
      }
    }

    if (documentoInput) {
      // Usar click humano (mueve el mouse y hace click)
      await cursor.click(documentoInput);
      // Escribir con velocidad variable (más humano)
      for (const char of DOCUMENTO_PRUEBA) {
        await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
      }
      console.log(`   ✅ Documento ${DOCUMENTO_PRUEBA} ingresado`);

      await page.screenshot({ path: path.join(screenshotsDir, '02-documento-ingresado.png') });
    } else {
      console.log('   ❌ No se encontró el input de documento');
    }

    // Esperar un momento
    // Mover el mouse aleatoriamente antes de verificar captcha
    await cursor.moveTo({ x: Math.random() * 500 + 100, y: Math.random() * 500 + 100 });
    await cursor.moveTo({ x: Math.random() * 500 + 100, y: Math.random() * 500 + 100 });
    
    await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));

    // 4. Verificar si hay captcha visible
    console.log('\n🔐 Verificando captcha...');

    const captchaInfo = await page.evaluate(() => {
      // Buscar el checkbox del reCAPTCHA
      const recaptchaFrame = document.querySelector('iframe[title*="reCAPTCHA"]');
      const gRecaptcha = document.querySelector('.g-recaptcha');
      const sitekey = document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey');

      return {
        hasFrame: !!recaptchaFrame,
        hasGRecaptcha: !!gRecaptcha,
        sitekey: sitekey
      };
    });

    console.log(`   Frame reCAPTCHA: ${captchaInfo.hasFrame ? 'Sí' : 'No'}`);
    console.log(`   Div g-recaptcha: ${captchaInfo.hasGRecaptcha ? 'Sí' : 'No'}`);
    console.log(`   Sitekey: ${captchaInfo.sitekey || 'No encontrado'}`);

    await page.screenshot({ path: path.join(screenshotsDir, '03-antes-captcha.png') });

    // 5. Información para el usuario
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE SELECTORES RECOMENDADOS:');
    console.log('='.repeat(60));

    // Encontrar el selector correcto del input
    const inputSelector = formInfo.inputs.find(i =>
      i.type === 'text' || i.type === 'number' || i.name?.includes('cedula') || i.name?.includes('documento')
    );

    if (inputSelector) {
      const selector = inputSelector.id ? `#${inputSelector.id}` :
                       inputSelector.name ? `input[name="${inputSelector.name}"]` :
                       'input[type="text"]';
      console.log(`\n   Input documento: ${selector}`);
    }

    // Botón de submit
    const submitBtn = formInfo.buttons.find(b =>
      b.text?.toLowerCase().includes('consultar') || b.type === 'submit'
    );
    if (submitBtn) {
      const selector = submitBtn.id ? `#${submitBtn.id}` :
                       submitBtn.class ? `.${submitBtn.class.split(' ')[0]}` :
                       'button';
      console.log(`   Botón submit: ${selector}`);
    }

    console.log(`   Captcha sitekey: ${captchaInfo.sitekey || 'NECESITA VERIFICAR'}`);

    console.log('\n='.repeat(60));
    console.log('🖼️  Screenshots guardados en: ' + screenshotsDir);
    console.log('='.repeat(60));

    // Mantener el navegador abierto para inspección manual
    console.log('\n⏳ Navegador abierto para inspección manual...');
    console.log('   Presiona Ctrl+C para cerrar\n');

    // Esperar input del usuario
    await new Promise(r => setTimeout(r, 60000)); // 1 minuto

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testRPA();
