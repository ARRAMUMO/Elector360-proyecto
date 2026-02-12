// Script para investigar el callback del reCAPTCHA
require('dotenv').config();

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function investigarCallback() {
  let browser;
  try {
    console.log('🔍 Investigando configuración de reCAPTCHA...\n');

    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.goto('https://eleccionescolombia.registraduria.gov.co/identificacion', {
      waitUntil: 'networkidle2'
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Investigar configuración completa de grecaptcha
    const captchaInfo = await page.evaluate(() => {
      const info = {
        hasGrecaptcha: typeof grecaptcha !== 'undefined',
        hasCfg: typeof window.___grecaptcha_cfg !== 'undefined',
        clients: {},
        dataCallbacks: [],
        iframeInfo: []
      };

      // Buscar elementos con data-callback
      document.querySelectorAll('[data-callback]').forEach(el => {
        info.dataCallbacks.push({
          callback: el.getAttribute('data-callback'),
          sitekey: el.getAttribute('data-sitekey'),
          element: el.tagName
        });
      });

      // Información de iframes
      document.querySelectorAll('iframe').forEach(iframe => {
        const src = iframe.src || '';
        if (src.includes('recaptcha')) {
          info.iframeInfo.push({
            src: src.substring(0, 200),
            title: iframe.title
          });
        }
      });

      // Investigar configuración interna de grecaptcha
      if (window.___grecaptcha_cfg) {
        const cfg = window.___grecaptcha_cfg;

        if (cfg.clients) {
          Object.keys(cfg.clients).forEach(clientId => {
            const client = cfg.clients[clientId];
            info.clients[clientId] = {};

            if (client) {
              Object.keys(client).forEach(key => {
                const widget = client[key];
                if (widget && typeof widget === 'object') {
                  info.clients[clientId][key] = {
                    hasCallback: !!widget.callback,
                    callbackType: typeof widget.callback,
                    callbackName: typeof widget.callback === 'string' ? widget.callback : null,
                    hasTextarea: !!widget.textarea,
                    sitekey: widget.sitekey || null,
                    action: widget.action || null
                  };
                }
              });
            }
          });
        }

        // Buscar funciones callback en window
        if (cfg.clients) {
          Object.keys(cfg.clients).forEach(clientId => {
            const client = cfg.clients[clientId];
            if (client) {
              Object.keys(client).forEach(key => {
                const widget = client[key];
                if (widget && widget.callback && typeof widget.callback === 'string') {
                  const callbackName = widget.callback;
                  info.clients[clientId][key].callbackExists = typeof window[callbackName] !== 'undefined';
                  info.clients[clientId][key].callbackType = typeof window[callbackName];
                }
              });
            }
          });
        }
      }

      // Buscar callbacks globales comunes
      info.globalCallbacks = {
        onCaptchaSuccess: typeof window.onCaptchaSuccess !== 'undefined',
        captchaCallback: typeof window.captchaCallback !== 'undefined',
        verifyCaptcha: typeof window.verifyCaptcha !== 'undefined',
        recaptchaCallback: typeof window.recaptchaCallback !== 'undefined'
      };

      return info;
    });

    console.log('📊 INFORMACIÓN DE reCAPTCHA:\n');
    console.log(JSON.stringify(captchaInfo, null, 2));

    // Mantener abierto para inspección
    console.log('\n⏳ Manteniendo navegador abierto 30 segundos para inspección...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

investigarCallback();
