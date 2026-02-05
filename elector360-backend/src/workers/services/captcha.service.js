// src/workers/services/captcha.service.js

const axios = require('axios');
const config = require('../config/worker.config');

class CaptchaService {
  constructor() {
    this.apiKey = config.captcha.apiKey;
    this.baseUrl = 'https://2captcha.com';
  }

  /**
   * Resolver reCAPTCHA v2
   */
  async solveRecaptchaV2(siteKey, pageUrl) {
    if (!this.apiKey) {
      throw new Error('2Captcha API key no configurada');
    }

    try {
      // 1. Enviar el captcha
      const captchaId = await this.submitCaptcha(siteKey, pageUrl);
      
      // 2. Esperar y obtener solución
      const solution = await this.getCaptchaSolution(captchaId);
      
      return solution;
    } catch (error) {
      console.error('Error resolviendo captcha:', error);
      throw error;
    }
  }

  /**
   * Enviar captcha a 2Captcha
   */
  async submitCaptcha(siteKey, pageUrl) {
    const url = `${this.baseUrl}/in.php`;
    
    const params = {
      key: this.apiKey,
      method: 'userrecaptcha',
      googlekey: siteKey,
      pageurl: pageUrl,
      json: 1
    };

    const response = await axios.get(url, { params });
    
    if (response.data.status === 0) {
      throw new Error(`2Captcha error: ${response.data.request}`);
    }

    return response.data.request; // Retorna el ID del captcha
  }

  /**
   * Obtener solución del captcha (con polling)
   */
  async getCaptchaSolution(captchaId) {
    const url = `${this.baseUrl}/res.php`;
    const maxAttempts = config.captcha.timeout / config.captcha.pollingInterval;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.delay(config.captcha.pollingInterval);
      
      const params = {
        key: this.apiKey,
        action: 'get',
        id: captchaId,
        json: 1
      };

      const response = await axios.get(url, { params });
      
      if (response.data.status === 1) {
        // Captcha resuelto
        return response.data.request;
      }
      
      if (response.data.request === 'CAPCHA_NOT_READY') {
        // Aún procesando, continuar esperando
        continue;
      }
      
      // Error
      throw new Error(`2Captcha error: ${response.data.request}`);
    }
    
    throw new Error('Timeout esperando solución de captcha');
  }

  /**
   * Obtener balance de 2Captcha
   */
  async getBalance() {
    const url = `${this.baseUrl}/res.php`;
    
    const params = {
      key: this.apiKey,
      action: 'getbalance',
      json: 1
    };

    const response = await axios.get(url, { params });
    
    if (response.data.status === 1) {
      return parseFloat(response.data.request);
    }
    
    throw new Error('Error obteniendo balance');
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new CaptchaService();