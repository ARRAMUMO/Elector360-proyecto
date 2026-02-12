// src/workers/services/captcha-resolver.service.js

const captcha2Service = require('./captcha.service'); // 2Captcha
const antiCaptchaService = require('./anticaptcha.service');

/**
 * Servicio unificado para resolver captchas
 * Selecciona automáticamente el servicio apropiado según la configuración
 */
class CaptchaResolverService {
  constructor() {
    // Configuración desde variables de entorno
    this.mode = process.env.CAPTCHA_MODE || 'auto'; // auto, manual, 2captcha, anticaptcha
    this.batchMode = process.env.CAPTCHA_BATCH_MODE || 'anticaptcha'; // Servicio para consultas masivas
    this.individualMode = process.env.CAPTCHA_INDIVIDUAL_MODE || 'manual'; // Servicio para consultas individuales
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

    console.log(`🎯 Modo de captcha: ${service} (${isBatch ? 'BATCH' : 'INDIVIDUAL'})`);

    switch (service) {
      case 'manual':
        // Modo manual - retornar null para que el scraper espere resolución manual
        return null;

      case 'anticaptcha':
        return await antiCaptchaService.solveRecaptchaV2(siteKey, pageUrl);

      case '2captcha':
        return await captcha2Service.solveRecaptchaV2(siteKey, pageUrl);

      default:
        throw new Error(`Modo de captcha no reconocido: ${service}`);
    }
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
