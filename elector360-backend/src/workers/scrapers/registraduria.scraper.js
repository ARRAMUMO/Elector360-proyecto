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
  }

  /**
   * Limpiar lock files del perfil de Chrome antes de lanzar.
   * Evita el error "The browser is already running for [profile]".
   */
  _limpiarLockFiles() {
    const fs = require('fs');
    const path = require('path');
    const profileDir = config.puppeteer.userDataDir;
    if (!profileDir) return;
    for (const nombre of ['SingletonLock', 'lockfile', 'DevToolsActivePort']) {
      try { fs.unlinkSync(path.join(profileDir, nombre)); } catch (e) { /* no existe, ok */ }
    }
  }

  /**
   * Inicializar navegador con anti-detección
   */
  async init() {
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
      // Cerrar browser viejo si existe
      try {
        if (this.browser) await this.browser.close();
      } catch (e) { /* ignorar */ }
      this.browser = null;
      this.page = null;
      this.cursor = null;
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
      // Selector del campo de documento (actualizado para nueva página)
      const documentoSelector = '#document';

      // Esperar a que el campo esté disponible
      await this.page.waitForSelector(documentoSelector, { timeout: 10000 });

      // Limpiar el campo por si tiene valor
      await this.cursor.click(documentoSelector);
      await helpers.typeHuman(this.page, documentoSelector, documento, config);

      // Scroll aleatorio para parecer humano
      await helpers.randomScroll(this.page);

      console.log('✅ Formulario llenado');
    } catch (error) {
      throw new Error(`Error llenando formulario: ${error.message}`);
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

    console.log('👆 MODO MANUAL: Resuelve el captcha manualmente en el navegador');
    console.log(`⏳ Esperando (${timeout / 1000}s máx)...`);

    try {
      await this.page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const submitButton = buttons.find(btn => {
            const txt = btn.textContent.trim();
            return txt === 'Consultar' || txt === 'CONSULTAR';
          });
          return submitButton && !submitButton.disabled;
        },
        { timeout }
      );
      console.log('✅ Captcha resuelto manualmente');
      return true;
    } catch (e) {
      console.log('❌ Timeout esperando resolución manual');
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
      const clicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        // Buscar botón cuyo texto sea exactamente "Consultar" (sin incluir variantes como "Consultar ubicación")
        const btn = buttons.find(b => {
          const txt = b.textContent.trim();
          return (txt === 'Consultar' || txt === 'CONSULTAR') && !b.disabled;
        });
        if (btn) { btn.click(); return btn.textContent.trim(); }
        return false;
      });
      if (clicked) console.log(`🖱️ Click en botón "${clicked}" ejecutado`);
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
          const bodyText = document.body.innerText;
          const tieneResultados =
            (bodyText.includes('Departamento') && bodyText.includes('Municipio')) ||
            (bodyText.includes('Puesto') && bodyText.includes('Mesa')) ||
            bodyText.includes('C.C.');
          const tieneError =
            bodyText.includes('no encontrado') ||
            bodyText.includes('no existe') ||
            bodyText.includes('no aparece') ||
            bodyText.includes('no censado');
          return tieneResultados || tieneError;
        },
        { timeout: 30000 }
      );

      await helpers.randomDelay(1000, 2000);
      console.log('✅ Resultados cargados');
    } catch (error) {
      try { await helpers.takeScreenshot(this.page, 'debug_sin_resultados'); } catch (e) {}
      console.log('⚠️ Timeout esperando resultados, intentando extraer de todas formas...');
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
          hasNoEncontrado: bodyText.includes('No se encontró') ||
                           bodyText.includes('no existe') ||
                           bodyText.includes('no encontrado'),
          hasDepartamento: bodyText.includes('Departamento'),
          hasMunicipio: bodyText.includes('Municipio'),
          hasPuesto: bodyText.includes('Puesto'),
          hasMesa: bodyText.includes('Mesa')
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
        const bodyText = document.body.innerText;

        let documento = '';
        let departamento = '';
        let municipio = '';
        let puesto = '';
        let direccion = '';
        let mesa = '';
        let zona = '';

        // Buscar C.C. número
        const ccMatch = bodyText.match(/C\.C\.\s*(\d+)/);
        if (ccMatch) documento = ccMatch[1];

        // Método 1: Extraer de elementos HTML directamente (más confiable)
        // Buscar todos los textos en el DOM de forma estructurada
        const allElements = document.querySelectorAll('p, span, div, td, th, h1, h2, h3, h4, h5, h6, label, strong, b');
        const textos = [];
        allElements.forEach(el => {
          const text = el.textContent.trim();
          if (text.length > 0 && text.length < 200) {
            textos.push(text);
          }
        });

        // Método 2: Buscar por líneas de texto
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const nextLine = (lines[i + 1] || '').trim();

          // "Puesto" como etiqueta, valor en siguiente línea
          if (/^Puesto$/i.test(line) || line === 'Puesto') {
            if (nextLine && !/^(Mesa|Zona|Departamento|Municipio|Dirección)$/i.test(nextLine)) {
              puesto = nextLine;
            }
          }

          // "Mesa" como etiqueta
          if (/^Mesa$/i.test(line) || line === 'Mesa') {
            if (nextLine && /^\d+/.test(nextLine)) {
              mesa = nextLine;
            }
          }

          // "Zona" como etiqueta
          if (/^Zona$/i.test(line) || line === 'Zona') {
            if (nextLine && !/^(Departamento|Municipio|Dirección|Puesto|Mesa)$/i.test(nextLine)) {
              zona = nextLine;
            }
          }

          // "Departamento" como etiqueta
          if (/^Departamento$/i.test(line) || line === 'Departamento') {
            if (nextLine && !/^(Municipio|Dirección|Puesto|Mesa|Zona)$/i.test(nextLine)) {
              departamento = nextLine;
            }
          }

          // "Municipio" como etiqueta
          if (/^Municipio$/i.test(line) || line === 'Municipio') {
            if (nextLine && !/^(Departamento|Dirección|Puesto|Mesa|Zona)$/i.test(nextLine)) {
              municipio = nextLine;
            }
          }

          // "Dirección" como etiqueta
          if (/^Direcci[oó]n$/i.test(line) || line === 'Dirección') {
            if (nextLine && !/^(Departamento|Municipio|Puesto|Mesa|Zona|Consultar)$/i.test(nextLine)) {
              direccion = nextLine;
            }
          }

          // Formato en línea: "Puesto Mesa Zona" en una línea, valores en la siguiente
          if (line.includes('Puesto') && line.includes('Mesa') && line.includes('Zona')) {
            const vals = nextLine.split(/\t+|\s{3,}/);
            if (vals.length >= 1 && !puesto) puesto = vals[0].trim();
            if (vals.length >= 2 && !mesa) mesa = vals[1].trim();
            if (vals.length >= 3 && !zona) zona = vals[2].trim();
          }

          if (line.includes('Departamento') && line.includes('Municipio') && line.includes('Direcci')) {
            const vals = nextLine.split(/\t+|\s{3,}/);
            if (vals.length >= 1 && !departamento) departamento = vals[0].trim();
            if (vals.length >= 2 && !municipio) municipio = vals[1].trim();
            if (vals.length >= 3 && !direccion) direccion = vals[2].trim();
          }
        }

        return {
          documento: documento || '',
          datosElectorales: {
            departamento: departamento || '',
            municipio: municipio || '',
            puestoVotacion: puesto || '',
            direccion: direccion || '',
            mesa: mesa || '',
            zona: zona || ''
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
   * Cerrar navegador
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log('✅ Navegador cerrado');
      }
    } catch (error) {
      console.error('❌ Error cerrando navegador:', error);
    }
  }
}

module.exports = RegistraduriaScrap;