// Script para inspeccionar la nueva página de la Registraduría
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function inspectPage() {
  let browser;
  try {
    console.log('🚀 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: false, // Ver el navegador
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    console.log('📄 Navegando a la página...');
    await page.goto('https://eleccionescolombia.registraduria.gov.co/identificacion', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n📋 INSPECCIÓN DE LA PÁGINA:\n');

    // 1. Buscar campo de documento
    const campoDocumento = await page.evaluate(() => {
      // Buscar input para documento
      const inputs = document.querySelectorAll('input');
      const info = [];

      inputs.forEach((input, i) => {
        const type = input.type;
        const id = input.id;
        const name = input.name;
        const placeholder = input.placeholder;
        const className = input.className;

        if (type === 'text' || type === 'number' || placeholder?.toLowerCase().includes('cédula') || placeholder?.toLowerCase().includes('documento')) {
          info.push({ index: i, type, id, name, placeholder, className });
        }
      });

      return info;
    });

    console.log('1️⃣ CAMPOS DE ENTRADA (posibles campos de documento):');
    console.log(JSON.stringify(campoDocumento, null, 2));

    // 2. Buscar botón de consultar
    const botones = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const info = [];

      buttons.forEach((btn, i) => {
        info.push({
          index: i,
          id: btn.id,
          className: btn.className,
          text: btn.textContent?.trim(),
          type: btn.type
        });
      });

      return info;
    });

    console.log('\n2️⃣ BOTONES:');
    console.log(JSON.stringify(botones, null, 2));

    // 3. Buscar reCAPTCHA
    const captchaInfo = await page.evaluate(() => {
      const recaptcha = document.querySelector('[data-sitekey]');
      const iframes = document.querySelectorAll('iframe');

      return {
        hasSiteKey: !!recaptcha,
        siteKey: recaptcha?.getAttribute('data-sitekey'),
        recaptchaClass: recaptcha?.className,
        recaptchaId: recaptcha?.id,
        iframeCount: iframes.length,
        iframes: Array.from(iframes).map(iframe => ({
          src: iframe.src,
          title: iframe.title
        }))
      };
    });

    console.log('\n3️⃣ INFORMACIÓN DE reCAPTCHA:');
    console.log(JSON.stringify(captchaInfo, null, 2));

    // 4. Estructura general del formulario
    const estructura = await page.evaluate(() => {
      return {
        forms: document.querySelectorAll('form').length,
        bodyClasses: document.body.className,
        title: document.title,
        h1: document.querySelector('h1')?.textContent,
        mainText: document.body.innerText.substring(0, 500)
      };
    });

    console.log('\n4️⃣ ESTRUCTURA GENERAL:');
    console.log(JSON.stringify(estructura, null, 2));

    // 5. Tomar screenshot
    await page.screenshot({ path: 'inspeccion-pagina.png', fullPage: true });
    console.log('\n📸 Screenshot guardado como: inspeccion-pagina.png');

    // Esperar 30 segundos para inspección manual
    console.log('\n⏳ Esperando 30 segundos para inspección manual...');
    console.log('💡 Puedes inspeccionar la página manualmente antes de que se cierre.');
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
inspectPage();
