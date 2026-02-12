// src/workers/services/captcha-resolver.service.js

const captcha2Service = require('./captcha.service'); // 2Captcha
const antiCaptchaService = require('./anticaptcha.service');

/**
 * Servicio unificado para resolver captchas
 * Selecciona automáticamente el servicio apropiado según la configuración
 */
class CaptchaResolverService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';

    // Configuración desde variables de entorno
    this.mode = process.env.CAPTCHA_MODE || 'auto'; // auto, manual, 2captcha, anticaptcha
    this.batchMode = process.env.CAPTCHA_BATCH_MODE || '2captcha'; // Servicio para consultas masivas
    this.individualMode = process.env.CAPTCHA_INDIVIDUAL_MODE || (this.isProduction ? '2captcha' : 'manual');

    // En producción, nunca permitir modo manual
    if (this.isProduction) {
      if (this.batchMode === 'manual') this.batchMode = '2captcha';
      if (this.individualMode === 'manual') this.individualMode = '2captcha';
      console.log('🏭 Producción: captcha forzado a modo automático');
    }

    this.maxRetries = 2; // Reintentos para servicios automáticos
  }

  /**
   * Resolver captcha según el contexto
   * @param {string} siteKey - Site key del reCAPTCHA
   * @param {string} pageUrl - URL de la página
   * @param {boolean} isBatch - Si es consulta masiva o individual
   */
  async solveRecaptcha(siteKey, pageUrl, isBatch = false) {
    // Determinar qué servicio usar
    let service = this.mode;

    if (this.mode === 'auto') {
      service = isBatch ? this.batchMode : this.individualMode;
    }

    // En producción, nunca modo manual
    if (this.isProduction && service === 'manual') {
      service = '2captcha';
    }

    console.log(`🎯 Modo de captcha: ${service} (${isBatch ? 'BATCH' : 'INDIVIDUAL'}, ${this.isProduction ? 'PROD' : 'DEV'})`);

    switch (service) {
      case 'manual':
        // Modo manual - retornar null para que el scraper espere resolución manual
        return null;

      case 'anticaptcha':
        return await this._solveWithRetry(() => antiCaptchaService.solveRecaptchaV2(siteKey, pageUrl), 'anticaptcha');

      case '2captcha':
        return await this._solveWithRetry(() => captcha2Service.solveRecaptchaV2(siteKey, pageUrl), '2captcha');

      default:
        throw new Error(`Modo de captcha no reconocido: ${service}`);
    }
  }

  /**
   * Ejecutar solver con reintentos automáticos
   */
  async _solveWithRetry(solverFn, serviceName) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Intento ${attempt}/${this.maxRetries} con ${serviceName}...`);
        const result = await solverFn();
        return result;
      } catch (error) {
        lastError = error;
        console.error(`❌ Intento ${attempt} falló (${serviceName}): ${error.message}`);
        if (attempt < this.maxRetries) {
          const delay = attempt * 5000; // Backoff: 5s, 10s
          console.log(`⏳ Esperando ${delay / 1000}s antes de reintentar...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Obtener balance del servicio activo
   */
  async getBalance(service = null) {
    const activeService = service || this.batchMode;

    try {
      switch (activeService) {
        case 'anticaptcha':
          const antiBalance = await antiCaptchaService.getBalance();
          return { service: 'Anti-Captcha', balance: antiBalance };

        case '2captcha':
          const captchaBalance = await captcha2Service.getBalance();
          return { service: '2Captcha', balance: captchaBalance };

        default:
          return { service: 'Manual', balance: 'N/A' };
      }
    } catch (error) {
      console.error(`Error obteniendo balance de ${activeService}:`, error.message);
      return { service: activeService, balance: 'Error', error: error.message };
    }
  }

  /**
   * Verificar configuración
   */
  getConfig() {
    return {
      mode: this.mode,
      batchMode: this.batchMode,
      individualMode: this.individualMode,
      hasAntiCaptchaKey: !!process.env.ANTICAPTCHA_API_KEY,
      has2CaptchaKey: !!process.env.CAPTCHA_API_KEY
    };
  }
}

module.exports = new CaptchaResolverService();
