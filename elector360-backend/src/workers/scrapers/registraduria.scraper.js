// src/workers/scrapers/registraduria.scraper.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../config/worker.config');
const captchaResolver = require('../services/captcha-resolver.service');
const helpers = require('../utils/helpers');

// Aplicar plugin stealth
puppeteer.use(StealthPlugin());

class RegistraduriaScrap {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Inicializar navegador
   */
  async init() {
    try {
      this.browser = await puppeteer.launch(config.puppeteer);
      this.page = await this.browser.newPage();

      // Configurar timeout
      this.page.setDefaultTimeout(config.puppeteer.timeout);

      // NO bloquear recursos - el captcha los necesita para funcionar correctamente

      console.log('✅ Navegador inicializado');
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

      // 3. Resolver captcha (con modo apropiado)
      const captchaSolved = await this.resolverCaptcha(isBatch);
      if (!captchaSolved) {
        throw new Error('No se pudo resolver el captcha');
      }

      // 4. Esperar a que los datos aparezcan (la página los muestra automáticamente tras resolver captcha)
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
      await this.page.click(documentoSelector, { clickCount: 3 });

      // Escribir el documento de forma humana
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
      // 1. Buscar el sitekey del reCAPTCHA (nueva página usa iframe)
      const siteKey = await this.page.evaluate(() => {
        // Intentar múltiples métodos para encontrar el sitekey
        let key = null;

        // Método 1: Buscar en elemento con data-sitekey
        const element = document.querySelector('[data-sitekey]');
        if (element) {
          key = element.getAttribute('data-sitekey');
        }

        // Método 2: Buscar en iframes de reCAPTCHA
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

      // 2. Resolver con el servicio apropiado (auto-selecciona según isBatch)
      const pageUrl = this.page.url();
      const solution = await captchaResolver.solveRecaptcha(siteKey, pageUrl, isBatch);

      // Si solution es null, significa modo manual
      if (solution === null) {
        console.log('👆 MODO MANUAL: Resuelve el captcha manualmente en el navegador');
        console.log('⏳ Esperando...');

        // Esperar hasta que el botón se habilite (captcha resuelto manualmente)
        await this.page.waitForFunction(
          () => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
            return submitButton && !submitButton.disabled;
          },
          { timeout: 300000 } // 5 minutos
        );

        console.log('✅ Captcha resuelto manualmente');
        return true;
      }

      // 3. Inyectar solución automática usando método avanzado
      const injectionResult = await this.page.evaluate((token) => {
        try {
          // Paso 1: Inyectar en textareas
          document.querySelectorAll('[name="g-recaptcha-response"]').forEach(el => {
            el.innerHTML = token;
            el.value = token;
          });

          const responseEl = document.getElementById('g-recaptcha-response');
          if (responseEl) {
            responseEl.innerHTML = token;
            responseEl.value = token;
          }

          // Paso 2: Encontrar el widget y su callback
          let callbackExecuted = false;
          if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
            const clients = window.___grecaptcha_cfg.clients;

            Object.keys(clients).forEach(clientId => {
              const client = clients[clientId];
              if (!client) return;

              // Buscar todos los widgets del cliente
              Object.keys(client).forEach(key => {
                if (isNaN(key)) return;

                const widget = client[key];
                if (!widget) return;

                // Inyectar token en el widget
                if (widget.textarea) {
                  widget.textarea.value = token;
                }

                // Ejecutar callback del widget
                const callback = widget.callback;
                if (callback && typeof callback === 'function') {
                  try {
                    callback(token);
                    callbackExecuted = true;
                  } catch (e) {
                    console.error('Error en callback:', e);
                  }
                }

                // Ejecutar callback por nombre si existe
                if (widget.callback && typeof widget.callback === 'string') {
                  try {
                    if (window[widget.callback]) {
                      window[widget.callback](token);
                      callbackExecuted = true;
                    }
                  } catch (e) {
                    console.error('Error en callback por nombre:', e);
                  }
                }
              });
            });
          }

          // Paso 3: Override de grecaptcha.getResponse
          if (typeof grecaptcha !== 'undefined') {
            grecaptcha.getResponse = function() { return token; };
          }

          return { success: true, callbackExecuted };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, solution);

      console.log('📝 Resultado de inyección:', JSON.stringify(injectionResult));

      // Esperar a que el captcha se procese
      await helpers.randomDelay(3000, 5000);

      // Verificar si el captcha realmente se marcó
      const captchaMarked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
        return submitButton ? !submitButton.disabled : false;
      });

      if (captchaMarked) {
        console.log('✅ Captcha resuelto y verificado');
        return true;
      }

      // Si no se marcó, hacer fallback a modo manual
      if (!injectionResult.callbackExecuted) {
        console.log('🔄 Fallback a modo manual...');
        console.log('👆 Resuelve el captcha manualmente en el navegador');

        // Esperar hasta que el botón se habilite (captcha resuelto manualmente)
        try {
          await this.page.waitForFunction(
            () => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
              return submitButton && !submitButton.disabled;
            },
            { timeout: 120000 } // 2 minutos para resolución manual
          );

          console.log('✅ Captcha resuelto manualmente');
          return true;
        } catch (waitError) {
          console.log('❌ Timeout esperando resolución manual del captcha');
          return false;
        }
      }

      console.log('✅ Captcha resuelto (con advertencias)');
      return true;

    } catch (error) {
      console.error('❌ Error resolviendo captcha:', error);

      // Fallback a modo manual si hay error y NO es batch
      if (!isBatch) {
        console.log('🔄 Fallback a modo manual...');
        try {
          console.log('👆 Resuelve el captcha manualmente en el navegador');
          await this.page.waitForFunction(
            () => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const submitButton = buttons.find(btn => btn.textContent.includes('Consultar'));
              return submitButton && !submitButton.disabled;
            },
            { timeout: 300000 } // 5 minutos
          );
          console.log('✅ Captcha resuelto manualmente después de error');
          return true;
        } catch (e) {
          console.error('❌ Timeout en modo manual:', e.message);
          return false;
        }
      }

      return false;
    }
  }

  /**
   * Esperar a que los resultados aparezcan en la página
   * La página de la Registraduría muestra los datos automáticamente tras resolver el captcha
   */
  async esperarResultados() {
    try {
      console.log('⏳ Esperando resultados...');

      await this.page.waitForFunction(
        () => {
          const bodyText = document.body.innerText;
          // Los resultados muestran estos campos cuando cargaron
          const tieneResultados =
            (bodyText.includes('Departamento') && bodyText.includes('Municipio')) ||
            (bodyText.includes('Puesto') && bodyText.includes('Mesa')) ||
            bodyText.includes('C.C.');

          // Mensajes de error de la página
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
      await helpers.takeScreenshot(this.page, 'debug_sin_resultados');
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