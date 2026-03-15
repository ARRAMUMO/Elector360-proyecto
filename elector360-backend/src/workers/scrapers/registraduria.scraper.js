// src/workers/scrapers/registraduria.scraper.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../config/worker.config');
const captchaResolver = require('../services/captcha-resolver.service');
const helpers = require('../utils/helpers');
// ghost-cursor y user-agents se cargan lazy para no bloquear el arranque del servidor

// Aplicar plugin stealth
puppeteer.use(StealthPlugin());

class RegistraduriaScrap {
  constructor() {
    this.browser = null;
    this.page = null;
    this.cursor = null;
    this._chromePid = null; // PID del proceso Chrome de Puppeteer
  }

  /**
   * Limpiar lock files del perfil de Chrome antes de lanzar.
   * Mata procesos Chrome huérfanos y elimina los lock files.
   */
  _limpiarLockFiles() {
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    const profileDir = config.puppeteer.userDataDir;
    if (!profileDir) return;

    const profileName = path.basename(profileDir);
    const exeName = config.puppeteer.executablePath
      ? path.basename(config.puppeteer.executablePath)
      : 'chrome.exe';

    // Siempre matar cualquier Chrome usando este perfil (por PID si lo tenemos, sino por nombre de perfil).
    // Esto limpia tanto procesos huérfanos de sesiones anteriores como el proceso actual.
    if (this._chromePid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /PID ${this._chromePid} /T 2>nul`, { stdio: 'ignore', timeout: 3000 });
        } else {
          execSync(`kill -9 ${this._chromePid} 2>/dev/null || true`, { stdio: 'ignore', timeout: 3000 });
        }
        console.log(`🔒 Chrome (PID ${this._chromePid}) terminado antes de reiniciar`);
      } catch (_) { /* ya cerrado */ }
      this._chromePid = null;
    } else {
      // Sin PID guardado: buscar por perfil (captura procesos huérfanos de sesiones anteriores)
      try {
        if (process.platform === 'win32') {
          execSync(
            `wmic process where "name='${exeName}' and commandline like '%${profileName}%'" delete`,
            { stdio: 'ignore', timeout: 5000 }
          );
        } else {
          execSync(`pkill -f "${exeName.replace('.exe', '')}.*${profileName}" 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
        }
      } catch (_) { /* no hay procesos bloqueando, ok */ }
    }

    // Eliminar lock files que Chrome no haya limpiado (por cierre forzado)
    const lockFileNames = ['SingletonLock', 'lockfile', 'DevToolsActivePort', 'SingletonSocket', 'SingletonCookie'];
    for (const nombre of lockFileNames) {
      try { fs.unlinkSync(path.join(profileDir, nombre)); } catch (_) { /* no existe, ok */ }
    }
  }

  /**
   * Inicializar navegador con anti-detección
   */
  async init() {
    try {
      await this._intentarInit();
    } catch (error) {
      console.error(`❌ Error iniciando Chrome: ${error.message}. Requiere intervención manual.`);
      this.browser = null;
      this.page = null;
      throw error;
    }
  }

  async _intentarInit() {
    try {
      this._limpiarLockFiles();

      const { createCursor } = require('ghost-cursor');
      const UserAgent = require('user-agents');

      const userAgent = new UserAgent().toString();
      const launchOptions = {
        ...config.puppeteer,
        args: [
          ...(config.puppeteer.args || []),
          `--user-agent=${userAgent}`,
          '--disable-blink-features=AutomationControlled'
        ]
      };

      // Configuración de Proxy
      if (process.env.PROXY_SERVER) {
        console.log(`🌐 Usando proxy: ${process.env.PROXY_SERVER}`);
        launchOptions.args.push(`--proxy-server=${process.env.PROXY_SERVER}`);
      }

      this.browser = await puppeteer.launch(launchOptions);
      this._chromePid = this.browser.process()?.pid ?? null;
      console.log(`🌐 Chrome iniciado${this._chromePid ? ` (PID ${this._chromePid})` : ' (PID no disponible)'}`);
      this.page = await this.browser.newPage();

      // Autenticación de Proxy (si es requerida)
      if (process.env.PROXY_SERVER && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        await this.page.authenticate({
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD
        });
      }

      this.cursor = createCursor(this.page);
      this.page.setDefaultTimeout(config.puppeteer.timeout);

      // Anti-detección: eliminar señales de automation
      await this.page.evaluateOnNewDocument(() => {
        // Ocultar webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Chrome runtime real
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: { isInstalled: false }
        };

        // Plugins reales (Chrome normal tiene al menos 3)
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' }
          ]
        });

        // Idiomas reales
        Object.defineProperty(navigator, 'languages', {
          get: () => ['es-CO', 'es', 'en-US', 'en']
        });

        // Permissions normales (no automation)
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      console.log('✅ Navegador inicializado (anti-detección activa)');
    } catch (error) {
      console.error('❌ Error inicializando navegador:', error);
      throw error;
    }
  }

  /**
   * Verificar que el navegador y la página estén activos, si no recrear
   */
  async ensureBrowserReady() {
    try {
      // Verificar si el browser sigue conectado
      if (!this.browser || !this.browser.connected) {
        console.log('🔄 Navegador desconectado, reiniciando...');
        await this.init();
        return;
      }

      // Verificar si la página sigue activa intentando una operación simple
      await this.page.evaluate(() => true);
    } catch (error) {
      console.log('🔄 Página no responde, recreando navegador...');
      this.cursor = null;
      await this.close(); // mata Chrome por PID y limpia browser/page/_chromePid
      await this.init();
    }
  }

  /**
   * Consultar persona en Registraduría
   * @param {string} documento - Número de documento
   * @param {boolean} isBatch - Si es consulta masiva (true) o individual (false)
   */
  async consultarPersona(documento, isBatch = false) {
    try {
      console.log(`🔍 Consultando documento: ${documento} (${isBatch ? 'BATCH' : 'INDIVIDUAL'})`);

      // 0. Verificar que el navegador/página sigan activos, si no recrear
      await this.ensureBrowserReady();

      // 1. Navegar a la página
      await this.page.goto(config.urls.registraduria, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await helpers.randomDelay(2000, 4000);

      // 2. Llenar formulario
      await this.llenarFormulario(documento);

      // Mover el mouse y esperar para simular comportamiento humano
      await this.cursor.moveTo({ x: Math.random() * 500 + 100, y: Math.random() * 500 + 100 });
      await helpers.randomDelay(1000, 2000);

      // 3. Resolver captcha (con modo apropiado)
      const captchaSolved = await this.resolverCaptcha(isBatch);
      if (!captchaSolved) {
        throw new Error('No se pudo resolver el captcha');
      }

      // 3b. Click en botón Consultar si la página no auto-envió el formulario
      await this._intentarSubmit();

      // Screenshot de diagnóstico para ver estado post-submit
      try {
        await helpers.takeScreenshot(this.page, `debug_post_submit_${documento}`);
      } catch (e) { /* ignorar */ }

      // 4. Esperar a que los datos aparezcan
      await this.esperarResultados();

      // 5. Extraer resultados
      const datos = await this.extraerDatos();

      console.log('✅ Consulta exitosa');
      return {
        success: true,
        datos
      };

    } catch (error) {
      console.error('❌ Error en consulta:', error.message);

      // Tomar screenshot para debugging (solo si la página sigue activa)
      try {
        if (this.page && this.browser && this.browser.connected) {
          await helpers.takeScreenshot(this.page, `error_${documento}`);
        }
      } catch (screenshotErr) {
        // Ignorar error de screenshot
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Llenar formulario de consulta
   */
  async llenarFormulario(documento) {
    try {
      // Selectores candidatos para el campo de documento
      const selectoresCandidatos = [
        'input[name="nuip"]',
        'input[name="cedula"]',
        'input[name="documento"]',
        'input[name="identificacion"]',
        'input[name="numero"]',
        '#nuip',
        '#cedula',
        '#documento',
        '#document',
        'input[placeholder*="número"]',
        'input[placeholder*="cedula"]',
        'input[placeholder*="cédula"]',
        'input[placeholder*="identificacion"]',
        'input[placeholder*="puntos"]',
        'input[type="number"]',
        'input[type="text"]'
      ];

      let documentoSelector = null;
      for (const sel of selectoresCandidatos) {
        try {
          const existe = await this.page.$(sel);
          if (existe) { documentoSelector = sel; break; }
        } catch (_) {}
      }

      // Último recurso: buscar cualquier input visible en el formulario
      if (!documentoSelector) {
        documentoSelector = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const visible = inputs.find(el =>
            el.offsetParent !== null &&
            !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(el.type)
          );
          if (!visible) return null;
          if (visible.id) return `#${visible.id}`;
          if (visible.name) return `input[name="${visible.name}"]`;
          return null;
        });
      }

      if (!documentoSelector) {
        throw new Error('No se encontró el campo de documento en la página');
      }

      console.log(`📝 Usando selector: ${documentoSelector}`);

      await this.page.waitForSelector(documentoSelector, { timeout: 10000 });
      await this.cursor.click(documentoSelector);
      await helpers.typeHuman(this.page, documentoSelector, documento, config);

      // Verificar que el valor quedó escrito; si no, usar setter nativo (para Angular/React)
      const valorActual = await this.page.evaluate((sel) =>
        document.querySelector(sel)?.value || '', documentoSelector
      );
      if (valorActual !== documento) {
        console.log(`⚠️  typeHuman no escribió el valor (obtenido: "${valorActual}"), usando setter nativo...`);
        await this.page.evaluate((sel, val) => {
          const input = document.querySelector(sel);
          if (!input) return;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(input, val);
          input.dispatchEvent(new Event('input',  { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur',   { bubbles: true }));
        }, documentoSelector, documento);
        console.log('✅ Valor forzado via setter nativo');
      }

      // Seleccionar "lugar de votación actual" en el dropdown si existe
      await this._seleccionarEleccion();

      // Scroll aleatorio para parecer humano
      await helpers.randomScroll(this.page);

      console.log('✅ Formulario llenado');
    } catch (error) {
      throw new Error(`Error llenando formulario: ${error.message}`);
    }
  }

  /**
   * Seleccionar opción en el dropdown "Seleccione la elección" si existe
   */
  async _seleccionarEleccion() {
    try {
      const selectEl = await this.page.$('select');
      if (!selectEl) return; // No hay dropdown, continuar

      // Obtener las opciones disponibles
      const opciones = await this.page.evaluate(() => {
        const sel = document.querySelector('select');
        if (!sel) return [];
        return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() }));
      });

      if (opciones.length === 0) return;

      // Preferir "lugar de votación actual" o la primera opción con valor
      const opcionActual = opciones.find(o =>
        /actual|congreso|2026/i.test(o.text) && o.value
      ) || opciones.find(o => o.value) || opciones[0];

      if (opcionActual && opcionActual.value) {
        await this.page.select('select', opcionActual.value);
        console.log(`📋 Elección seleccionada: ${opcionActual.text}`);
        await helpers.randomDelay(500, 1000);
      }
    } catch (e) {
      // Ignorar errores en el dropdown — no es crítico
    }
  }

  /**
   * Resolver captcha con el servicio apropiado
   * @param {boolean} isBatch - Si es consulta masiva
   */
  async resolverCaptcha(isBatch = false) {
    try {
      // 1. Buscar el sitekey del reCAPTCHA
      const siteKey = await this.page.evaluate(() => {
        let key = null;

        const element = document.querySelector('[data-sitekey]');
        if (element) {
          key = element.getAttribute('data-sitekey');
        }

        if (!key) {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            const src = iframe.src || '';
            const match = src.match(/[?&]k=([^&]+)/);
            if (match) {
              key = match[1];
              break;
            }
          }
        }

        return key;
      });

      if (!siteKey) {
        console.log('⚠️ No se encontró captcha, continuando...');
        return true;
      }

      console.log(`🔐 Resolviendo captcha con siteKey: ${siteKey}`);

      // Paso 0: Intentar click natural en el checkbox "I'm not a robot" (sin costo de 2captcha)
      const clickPassed = await this._clickRecaptchaCheckbox();
      if (clickPassed) {
        console.log('✅ reCAPTCHA aprobado con click natural');
        return true;
      }
      console.log('🔄 Click natural no fue suficiente, usando 2captcha...');

      // Si no hay API key configurada, pasar DIRECTO a modo manual sin esperar 2captcha
      if (!config.captcha.apiKey && !config.isProduction) {
        console.log('⚠️  Sin CAPTCHA_API_KEY — pasando directamente a modo manual');
        return await this._esperarCaptchaManual();
      }

      // 2. Resolver con el servicio apropiado
      const pageUrl = this.page.url();
      const solution = await captchaResolver.solveRecaptcha(siteKey, pageUrl, isBatch);

      // Si solution es null, significa modo manual (solo en desarrollo)
      if (solution === null) {
        return await this._esperarCaptchaManual();
      }

      // 3. Inyectar solución automática
      const injectionResult = await this._inyectarTokenCaptcha(solution);

      console.log('📝 Resultado de inyección:', JSON.stringify(injectionResult));

      // Esperar a que el captcha se procese
      await helpers.randomDelay(3000, 5000);

      // Verificar si el captcha realmente se marcó
      const captchaMarked = await this._verificarCaptchaResuelto();

      if (captchaMarked) {
        console.log('✅ Captcha resuelto y verificado');
        return true;
      }

      // Captcha no marcado: recargar y reintentar una vez más
      console.log('🔄 Captcha no verificado, recargando página para reintentar...');
      const documentoActual = await this.page.evaluate(() => document.querySelector('#document')?.value || '');
      await this.page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await helpers.randomDelay(2000, 3000);
      await this.llenarFormulario(documentoActual);
      const solution2 = await captchaResolver.solveRecaptcha(siteKey, pageUrl, isBatch);
      if (solution2) {
        await this._inyectarTokenCaptcha(solution2);
        await helpers.randomDelay(2000, 3000);
        const marked2 = await this._verificarCaptchaResuelto();
        if (marked2) {
          console.log('✅ Captcha resuelto en segundo intento');
          return true;
        }
      }

      // Si no se marcó y estamos en desarrollo, fallback manual
      if (!injectionResult.callbackExecuted && !config.isProduction) {
        console.log('🔄 Fallback a modo manual (desarrollo)...');
        return await this._esperarCaptchaManual(120000);
      }

      // En producción sin callback: intentar click directo al botón Consultar
      if (!injectionResult.callbackExecuted && config.isProduction) {
        console.log('🔄 Callback no ejecutado, intentando click directo al botón...');
        try {
          const clicked = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => {
              const txt = b.textContent.trim();
              return txt === 'Consultar' || txt === 'CONSULTAR';
            });
            if (btn) { btn.click(); return true; }
            return false;
          });
          if (clicked) {
            console.log('✅ Click directo ejecutado');
            await helpers.randomDelay(2000, 3000);
            return true;
          }
        } catch (clickErr) {
          console.log('❌ Click directo falló:', clickErr.message);
        }
        return false;
      }

      console.log('✅ Captcha resuelto (con advertencias)');
      return true;

    } catch (error) {
      console.error('❌ Error resolviendo captcha:', error);

      // En desarrollo, intentar fallback manual
      if (!config.isProduction && !isBatch) {
        console.log('🔄 Fallback a modo manual (desarrollo)...');
        return await this._esperarCaptchaManual(300000);
      }

      // En producción, fallar limpiamente para que el circuit breaker maneje el retry
      return false;
    }
  }

  /**
   * Esperar resolución manual del captcha (solo desarrollo)
   */
  async _esperarCaptchaManual(timeout = 300000) {
    if (config.isProduction) {
      console.log('❌ Modo manual no disponible en producción');
      return false;
    }

    console.log('👆 MODO MANUAL: Resuelve el captcha y haz clic en CONSULTAR');
    console.log(`⏳ Esperando resultado en pantalla (${timeout / 1000}s máx)...`);

    try {
      // Esperar a que aparezca el resultado (tabla con DEPARTAMENTO/MUNICIPIO)
      // O un mensaje de error ("no encontrado", "no existe", etc.)
      await this.page.waitForFunction(
        () => {
          const body = document.body.innerText.toLowerCase();
          const tieneResultado =
            (body.includes('departamento') && body.includes('municipio') && body.includes('mesa')) ||
            body.includes('nuip');
          const tieneError =
            /no se encontr|no existe|no aparece|no censado|no fue encontrado/i.test(body);
          return tieneResultado || tieneError;
        },
        { timeout }
      );
      console.log('✅ Resultado detectado tras resolución manual');
      return true;
    } catch (e) {
      console.log('❌ Timeout esperando resultado manual');
      return false;
    }
  }

  /**
   * Inyectar token de captcha en la página
   */
  async _inyectarTokenCaptcha(token) {
    return await this.page.evaluate((token) => {
      try {
        const results = { success: true, callbackExecuted: false, methods: [] };

        // Paso 1: Inyectar en todos los textareas y disparar eventos DOM
        document.querySelectorAll('[name="g-recaptcha-response"], #g-recaptcha-response').forEach(el => {
          el.innerHTML = token;
          el.value = token;
          el.style.display = 'block';
          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
          try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
        });
        results.methods.push('textarea_set');

        // Paso 2: Intentar callback desde atributo data-callback del div reCAPTCHA
        const sitekeyEl = document.querySelector('[data-sitekey]');
        if (sitekeyEl) {
          const callbackName = sitekeyEl.getAttribute('data-callback');
          if (callbackName && typeof window[callbackName] === 'function') {
            try {
              window[callbackName](token);
              results.callbackExecuted = true;
              results.methods.push('data-callback:' + callbackName);
            } catch (e) {}
          }
        }

        // Paso 3: Buscar en ___grecaptcha_cfg.clients (soporta estructura 1 y 2 niveles)
        if (!results.callbackExecuted && window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
          const clients = window.___grecaptcha_cfg.clients;

          Object.keys(clients).forEach(clientId => {
            if (results.callbackExecuted) return;
            const client = clients[clientId];
            if (!client) return;

            // Estructura 1 nivel: clients[0].callback
            if (client.textarea) client.textarea.value = token;
            if (typeof client.callback === 'function') {
              try { client.callback(token); results.callbackExecuted = true; results.methods.push('client_direct'); } catch (e) {}
            } else if (typeof client.callback === 'string' && window[client.callback]) {
              try { window[client.callback](token); results.callbackExecuted = true; results.methods.push('client_direct_string'); } catch (e) {}
            }

            // Estructura 2 niveles: clients[0][numericKey].callback
            if (!results.callbackExecuted) {
              Object.keys(client).forEach(key => {
                if (results.callbackExecuted || isNaN(key)) return;
                const widget = client[key];
                if (!widget || typeof widget !== 'object') return;

                if (widget.textarea) widget.textarea.value = token;
                if (typeof widget.callback === 'function') {
                  try { widget.callback(token); results.callbackExecuted = true; results.methods.push('widget_callback'); } catch (e) {}
                } else if (typeof widget.callback === 'string' && window[widget.callback]) {
                  try { window[widget.callback](token); results.callbackExecuted = true; results.methods.push('widget_callback_string'); } catch (e) {}
                }
              });
            }
          });
        }

        // Paso 4: Override grecaptcha.getResponse como último recurso
        if (typeof grecaptcha !== 'undefined') {
          try { grecaptcha.getResponse = function() { return token; }; results.methods.push('getResponse_override'); } catch (e) {}
        }

        return results;
      } catch (error) {
        return { success: false, callbackExecuted: false, error: error.message };
      }
    }, token);
  }

  /**
   * Intentar hacer click en el checkbox "I'm not a robot" dentro del iframe de reCAPTCHA.
   * Si el navegador pasa el análisis de riesgo de Google, se aprueba sin image challenge.
   * Retorna true si el checkbox quedó marcado (verde) después del click.
   */
  async _clickRecaptchaCheckbox() {
    try {
      // Esperar a que el iframe del checkbox de reCAPTCHA esté disponible
      await helpers.randomDelay(1000, 2000);

      // Buscar el iframe anchor del reCAPTCHA
      const anchorFrame = this.page.frames().find(f =>
        f.url().includes('recaptcha') && f.url().includes('anchor')
      );
      if (!anchorFrame) {
        console.log('⚠️ Iframe de reCAPTCHA no encontrado');
        return false;
      }

      // Click en el checkbox con movimiento natural del cursor (simula humano)
      const checkboxHandle = await anchorFrame.$('.recaptcha-checkbox-border');
      if (!checkboxHandle) return false;

      const box = await checkboxHandle.boundingBox();
      if (!box) return false;

      // Usar cursor ghost para click más realista
      await this.cursor.moveTo({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await helpers.randomDelay(300, 700);
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      console.log('🖱️ Click en checkbox reCAPTCHA ejecutado');

      // Esperar hasta 6 segundos para ver si se resolvió automáticamente
      await helpers.randomDelay(4000, 6000);

      // Verificar si el checkbox quedó marcado (aria-checked = true)
      const checked = await anchorFrame.evaluate(() => {
        const anchor = document.querySelector('#recaptcha-anchor');
        return anchor?.getAttribute('aria-checked') === 'true';
      }).catch(() => false);

      if (checked) {
        console.log('✅ Checkbox marcado automáticamente por Google');
        return true;
      }

      console.log('⚠️ Google requiere image challenge (no aprobó automáticamente)');
      return false;

    } catch (e) {
      console.log('⚠️ Error en click reCAPTCHA:', e.message);
      return false;
    }
  }

  /**
   * Hacer click en el botón Consultar si está habilitado (fallback cuando no hay auto-submit)
   */
  async _intentarSubmit() {
    try {
      await helpers.randomDelay(1000, 2000);

      // Usar Puppeteer para hacer un click real (dispara eventos React/Vue correctamente)
      const btnHandle = await this.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => {
          const txt = b.textContent.trim();
          return (txt === 'Consultar' || txt === 'CONSULTAR') && !b.disabled;
        });
      });

      if (btnHandle && (await btnHandle.asElement())) {
        await btnHandle.click(); // Click real de Puppeteer con eventos mouse
        const txt = await this.page.evaluate(btn => btn?.textContent?.trim(), btnHandle);
        console.log(`🖱️ Click real en botón "${txt}" ejecutado`);
        await btnHandle.dispose();
        return;
      }

      // Fallback: submit directo del formulario
      const submitted = await this.page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return true; }
        return false;
      });
      if (submitted) console.log('🖱️ Submit de formulario ejecutado (fallback)');
    } catch (e) {
      // La página puede haber navegado ya (auto-submit), ignorar
    }
  }

  /**
   * Verificar si el captcha fue resuelto (botón habilitado)
   * Si la página está navegando (form auto-enviado), se toma como éxito
   */
  async _verificarCaptchaResuelto() {
    try {
      return await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitButton = buttons.find(btn => {
          const txt = btn.textContent.trim();
          return txt === 'Consultar' || txt === 'CONSULTAR';
        });
        return submitButton ? !submitButton.disabled : false;
      });
    } catch (e) {
      if (e.message.includes('detach') || e.message.includes('navigation') || e.message.includes('context')) {
        console.log('📡 Página navegando: captcha aceptado y formulario enviado automáticamente');
        return true;
      }
      return false;
    }
  }

  /**
   * Esperar a que los resultados aparezcan en la página.
   * Maneja tanto páginas AJAX (sin navegación) como formularios con navegación completa.
   */
  async esperarResultados() {
    try {
      console.log('⏳ Esperando resultados...');

      // Si hubo navegación completa (form POST), esperar a que la nueva página cargue
      try {
        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log('📡 Navegación de formulario completada');
        await helpers.randomDelay(1000, 2000);
      } catch (navErr) {
        // No hubo navegación (AJAX) o ya completó antes de llegar aquí → continuar
      }

      // Esperar a que el contenido de resultados aparezca en el DOM
      await this.page.waitForFunction(
        () => {
          const bodyText = document.body.innerText.toLowerCase();
          const tieneResultados =
            (bodyText.includes('departamento') && bodyText.includes('municipio')) ||
            (bodyText.includes('puesto') && bodyText.includes('mesa')) ||
            bodyText.includes('nuip') ||
            bodyText.includes('c.c.') ||
            bodyText.includes('lugar de votación') ||
            bodyText.includes('puesto de votación') ||
            bodyText.includes('mesa de votación');
          const tieneError =
            bodyText.includes('no encontrado') ||
            bodyText.includes('no existe') ||
            bodyText.includes('no aparece') ||
            bodyText.includes('no censado') ||
            bodyText.includes('no fue encontrado') ||
            bodyText.includes('no está registrado') ||
            bodyText.includes('no se encontró');
          return tieneResultados || tieneError;
        },
        { timeout: 30000 }
      );

      await helpers.randomDelay(1000, 2000);
      console.log('✅ Resultados cargados');
    } catch (error) {
      try { await helpers.takeScreenshot(this.page, 'debug_sin_resultados'); } catch (e) {}
      // Log del texto de la página para diagnóstico
      try {
        const pageText = await this.page.evaluate(() => document.body.innerText.substring(0, 500));
        const pageUrl = this.page.url();
        console.log(`⚠️ Timeout esperando resultados. URL: ${pageUrl}`);
        console.log(`📄 Texto página (500 chars): ${pageText}`);
      } catch (e) { /* ignorar */ }
      console.log('⚠️ Intentando extraer de todas formas...');
    }
  }

  /**
   * Extraer datos de la página de resultados
   */
  async extraerDatos() {
    try {
      // Esperar un poco para que la página cargue completamente
      await helpers.randomDelay(3000, 5000);

      // Debug: ver el contenido de la página
      const pageContent = await this.page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
          bodyText: bodyText.substring(0, 800),
          hasTable: !!document.querySelector('table'),
          hasNoEncontrado: /no se encontr|no existe|no encontrado/i.test(bodyText),
          hasDepartamento: /departamento/i.test(bodyText),
          hasMunicipio: /municipio/i.test(bodyText),
          hasPuesto: /puesto/i.test(bodyText),
          hasMesa: /\bmesa\b/i.test(bodyText)
        };
      });

      console.log('🔍 Debug página:', JSON.stringify(pageContent, null, 2));

      // Verificar si hay mensaje de "no encontrado"
      if (pageContent.hasNoEncontrado) {
        throw new Error('Documento no encontrado en el censo electoral');
      }

      // Verificar si hay información de votación
      if (!pageContent.hasDepartamento && !pageContent.hasMunicipio) {
        await helpers.takeScreenshot(this.page, 'debug_no_resultados');
        throw new Error('No se encontraron resultados en la página');
      }

      // Extraer datos de la página de Registraduría
      // Primero capturar TODO el texto visible para debug
      const rawText = await this.page.evaluate(() => document.body.innerText);
      console.log('📄 Texto de página (primeros 500 chars):', rawText.substring(0, 500));

      const datos = await this.page.evaluate(() => {
        let documento = '';
        let departamento = '';
        let municipio = '';
        let puesto = '';
        let direccion = '';
        let mesa = '';
        let zona = '';

        // ── Método 1: tabla HTML (nueva página wsp.registraduria.gov.co) ──────
        // Estructura: <th>NUIP</th><th>DEPARTAMENTO</th><th>MUNICIPIO</th>
        //             <th>PUESTO</th><th>DIRECCIÓN</th><th>MESA</th>
        const table = document.querySelector('table');
        if (table) {
          const headers = Array.from(table.querySelectorAll('th')).map(th =>
            th.textContent.trim().toUpperCase()
          );
          // Obtener solo las celdas TD de la primera fila de datos
          const dataRow = table.querySelector('tbody tr') || table.querySelector('tr:nth-child(2)');
          const cells = dataRow
            ? Array.from(dataRow.querySelectorAll('td')).map(td => td.textContent.trim())
            : Array.from(table.querySelectorAll('td')).map(td => td.textContent.trim());

          const idx = (name) => headers.findIndex(h => h.includes(name));

          const iNuip        = idx('NUIP');
          const iDepto       = idx('DEPART');
          const iMun         = idx('MUNIC');
          const iPuesto      = idx('PUESTO');
          const iDir         = idx('DIRECC');
          const iMesa        = idx('MESA');
          const iZona        = idx('ZONA');

          if (iNuip  >= 0 && cells[iNuip])   documento    = cells[iNuip];
          if (iDepto >= 0 && cells[iDepto])   departamento = cells[iDepto];
          if (iMun   >= 0 && cells[iMun])     municipio    = cells[iMun];
          if (iPuesto >= 0 && cells[iPuesto]) puesto       = cells[iPuesto];
          if (iDir   >= 0 && cells[iDir])     direccion    = cells[iDir];
          if (iMesa  >= 0 && cells[iMesa])    mesa         = cells[iMesa];
          if (iZona  >= 0 && cells[iZona])    zona         = cells[iZona];
        }

        // ── Método 2: fallback por líneas (página antigua / cambios futuros) ──
        if (!departamento && !municipio) {
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

          // C.C. número
          const ccMatch = bodyText.match(/C\.C\.\s*(\d+)/);
          if (ccMatch) documento = ccMatch[1];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const next = (lines[i + 1] || '').trim();

            if (/^Puesto$/i.test(line) && next && !/^(Mesa|Zona|Departamento|Municipio|Dirección)$/i.test(next))
              puesto = next;
            if (/^Mesa$/i.test(line) && /^\d+/.test(next))
              mesa = next;
            if (/^Zona$/i.test(line) && next && !/^(Departamento|Municipio|Dirección|Puesto|Mesa)$/i.test(next))
              zona = next;
            if (/^Departamento$/i.test(line) && next && !/^(Municipio|Dirección|Puesto|Mesa|Zona)$/i.test(next))
              departamento = next;
            if (/^Municipio$/i.test(line) && next && !/^(Departamento|Dirección|Puesto|Mesa|Zona)$/i.test(next))
              municipio = next;
            if (/^Direcci[oó]n$/i.test(line) && next && !/^(Departamento|Municipio|Puesto|Mesa|Zona|Consultar)$/i.test(next))
              direccion = next;

            if (line.includes('Puesto') && line.includes('Mesa') && line.includes('Zona')) {
              const vals = next.split(/\t+|\s{3,}/);
              if (vals[0] && !puesto)  puesto = vals[0].trim();
              if (vals[1] && !mesa)    mesa   = vals[1].trim();
              if (vals[2] && !zona)    zona   = vals[2].trim();
            }
            if (line.includes('Departamento') && line.includes('Municipio') && line.includes('Direcci')) {
              const vals = next.split(/\t+|\s{3,}/);
              if (vals[0] && !departamento) departamento = vals[0].trim();
              if (vals[1] && !municipio)    municipio    = vals[1].trim();
              if (vals[2] && !direccion)    direccion    = vals[2].trim();
            }
          }
        }

        return {
          documento: documento || '',
          datosElectorales: {
            departamento: departamento || '',
            municipio:    municipio    || '',
            puestoVotacion: puesto    || '',
            direccion:    direccion   || '',
            mesa:         mesa        || '',
            zona:         zona        || ''
          }
        };
      });

      // Validar que al menos se haya extraído información básica
      if (!datos.datosElectorales.departamento && !datos.datosElectorales.municipio) {
        await helpers.takeScreenshot(this.page, 'debug_extraccion_fallida');
        throw new Error('No se pudieron extraer los datos de la página');
      }

      // La página no muestra nombres, solo datos electorales
      datos.nombres = '';
      datos.apellidos = '';

      console.log('✅ Datos extraídos:', JSON.stringify(datos.datosElectorales));
      return datos;

    } catch (error) {
      throw new Error(`Error extrayendo datos: ${error.message}`);
    }
  }

  /**
   * Cerrar navegador — mata el proceso Chrome por PID para garantizar
   * que el proceso muera aunque browser.close() falle o cuelgue.
   */
  async close() {
    const pid = this._chromePid;
    this.browser = null;
    this.page = null;
    this._chromePid = null;

    if (!pid) return;

    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        execSync(`taskkill /F /PID ${pid} /T 2>nul`, { stdio: 'ignore', timeout: 3000 });
      } else {
        execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: 'ignore', timeout: 3000 });
      }
      console.log(`✅ Proceso Chrome (PID ${pid}) terminado`);
    } catch (_) { /* ya cerrado */ }
  }
}

module.exports = RegistraduriaScrap;