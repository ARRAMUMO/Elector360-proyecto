// src/workers/scrapers/registraduria.scraper.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../config/worker.config');
const captchaService = require('../services/captcha.service');
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
   * Consultar persona en Registraduría
   */
  async consultarPersona(documento) {
    try {
      console.log(`🔍 Consultando documento: ${documento}`);
      
      // 1. Navegar a la página
      await this.page.goto(config.urls.registraduria, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      await helpers.randomDelay(2000, 4000);
      
      // 2. Llenar formulario
      await this.llenarFormulario(documento);
      
      // 3. Resolver captcha
      const captchaSolved = await this.resolverCaptcha();
      if (!captchaSolved) {
        throw new Error('No se pudo resolver el captcha');
      }
      
      // 4. Enviar formulario
      await this.enviarFormulario();
      
      // 5. Esperar y extraer resultados
      const datos = await this.extraerDatos();
      
      console.log('✅ Consulta exitosa');
      return {
        success: true,
        datos
      };
      
    } catch (error) {
      console.error('❌ Error en consulta:', error.message);
      
      // Tomar screenshot para debugging
      if (this.page) {
        await helpers.takeScreenshot(this.page, `error_${documento}`);
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
      // Selector del campo NUIP (número de identificación)
      const documentoSelector = '#nuip';

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
   * Resolver captcha con 2Captcha
   */
  async resolverCaptcha() {
    try {
      // 1. Buscar el sitekey del reCAPTCHA
      const siteKey = await this.page.evaluate(() => {
        const element = document.querySelector('[data-sitekey]');
        return element ? element.getAttribute('data-sitekey') : null;
      });
      
      if (!siteKey) {
        console.log('⚠️ No se encontró captcha, continuando...');
        return true;
      }
      
      console.log(`🔐 Resolviendo captcha con siteKey: ${siteKey}`);
      
      // 2. Resolver con 2Captcha
      const pageUrl = this.page.url();
      const solution = await captchaService.solveRecaptchaV2(siteKey, pageUrl);
      
      // 3. Inyectar solución
      await this.page.evaluate((token) => {
        document.getElementById('g-recaptcha-response').innerHTML = token;
        if (typeof grecaptcha !== 'undefined') {
          grecaptcha.enterprise?.execute?.();
        }
      }, solution);
      
      await helpers.randomDelay(1000, 2000);
      
      console.log('✅ Captcha resuelto');
      return true;
      
    } catch (error) {
      console.error('❌ Error resolviendo captcha:', error);
      return false;
    }
  }

  /**
   * Enviar formulario
   */
  async enviarFormulario() {
    try {
      // Botón CONSULTAR
      const submitSelector = '#enviar';

      await helpers.randomDelay(config.delays.beforeSubmit, config.delays.beforeSubmit + 1000);

      // Esperar a que el botón esté disponible
      await this.page.waitForSelector(submitSelector, { timeout: 10000 });

      // Click en el botón
      await helpers.clickHuman(this.page, submitSelector, config);

      // Esperar a que aparezca la tabla de resultados
      await Promise.race([
        this.page.waitForSelector('table', { timeout: 30000 }),
        this.page.waitForSelector('.alert-danger', { timeout: 30000 }),
        this.page.waitForFunction(() => {
          return document.body.innerText.includes('INFORMACIÓN DEL LUGAR DE VOTACIÓN') ||
                 document.body.innerText.includes('No se encontró');
        }, { timeout: 30000 })
      ]);

      console.log('✅ Formulario enviado');
    } catch (error) {
      throw new Error(`Error enviando formulario: ${error.message}`);
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
        return {
          bodyText: document.body.innerText.substring(0, 500),
          hasTable: !!document.querySelector('table'),
          tableCount: document.querySelectorAll('table').length,
          hasInfoVotacion: document.body.innerText.includes('INFORMACIÓN DEL LUGAR DE VOTACIÓN'),
          hasNoEncontrado: document.body.innerText.includes('No se encontró') ||
                           document.body.innerText.includes('no existe')
        };
      });

      console.log('🔍 Debug página:', JSON.stringify(pageContent, null, 2));

      // Verificar si hay mensaje de "no encontrado"
      if (pageContent.hasNoEncontrado) {
        throw new Error('Documento no encontrado en el censo electoral');
      }

      // Verificar si hay tabla con información
      if (!pageContent.hasTable || !pageContent.hasInfoVotacion) {
        // Tomar screenshot para debugging
        await helpers.takeScreenshot(this.page, 'debug_no_tabla');
        throw new Error('No se encontró la tabla de resultados');
      }

      // Extraer datos de la tabla de resultados
      // Estructura: NUIP | DEPARTAMENTO | MUNICIPIO | PUESTO | DIRECCIÓN | MESA
      const datos = await this.page.evaluate(() => {
        // Buscar la tabla que contiene "INFORMACIÓN DEL LUGAR DE VOTACIÓN"
        const tablas = document.querySelectorAll('table');

        for (const tabla of tablas) {
          const filas = tabla.querySelectorAll('tr');
          if (filas.length < 2) continue;

          // Verificar si es la tabla correcta (tiene header con NUIP, DEPARTAMENTO, etc)
          const header = filas[0]?.textContent || '';
          if (!header.includes('NUIP') && !header.includes('DEPARTAMENTO')) continue;

          const filaDatos = filas[1]; // Primera fila de datos
          const celdas = filaDatos.querySelectorAll('td');

          if (celdas.length >= 6) {
            return {
              documento: celdas[0]?.textContent?.trim() || '',
              datosElectorales: {
                departamento: celdas[1]?.textContent?.trim() || '',
                municipio: celdas[2]?.textContent?.trim() || '',
                puestoVotacion: celdas[3]?.textContent?.trim() || '',
                direccion: celdas[4]?.textContent?.trim() || '',
                mesa: celdas[5]?.textContent?.trim() || ''
              }
            };
          }
        }

        return null;
      });

      if (!datos) {
        await helpers.takeScreenshot(this.page, 'debug_no_datos');
        throw new Error('No se pudieron extraer los datos de la tabla');
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