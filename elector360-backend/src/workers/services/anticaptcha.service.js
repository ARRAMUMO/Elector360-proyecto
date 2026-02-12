// src/workers/services/anticaptcha.service.js

const axios = require('axios');

class AntiCaptchaService {
  constructor() {
    this.apiKey = process.env.ANTICAPTCHA_API_KEY || '';
    this.baseUrl = 'https://api.anti-captcha.com';
  }

  /**
   * Resolver reCAPTCHA v2
   */
  async solveRecaptchaV2(siteKey, pageUrl) {
    if (!this.apiKey) {
      throw new Error('Anti-Captcha API key no configurada');
    }

    try {
      console.log('🔐 Enviando captcha a Anti-Captcha...');

      // 1. Crear tarea
      const taskId = await this.createTask(siteKey, pageUrl);
      console.log(`📝 Tarea creada: ${taskId}`);

      // 2. Esperar y obtener resultado
      const solution = await this.getTaskResult(taskId);
      console.log('✅ Captcha resuelto por Anti-Captcha');

      return solution;
    } catch (error) {
      console.error('❌ Error con Anti-Captcha:', error.message);
      throw error;
    }
  }

  /**
   * Crear tarea en Anti-Captcha
   */
  async createTask(siteKey, pageUrl) {
    const url = `${this.baseUrl}/createTask`;

    const payload = {
      clientKey: this.apiKey,
      task: {
        type: 'RecaptchaV2TaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey
      }
    };

    const response = await axios.post(url, payload);

    if (response.data.errorId > 0) {
      throw new Error(`Anti-Captcha error: ${response.data.errorDescription || response.data.errorCode}`);
    }

    return response.data.taskId;
  }

  /**
   * Obtener resultado de la tarea (con polling)
   */
  async getTaskResult(taskId) {
    const url = `${this.baseUrl}/getTaskResult`;
    const maxAttempts = 60; // 60 intentos
    const pollingInterval = 3000; // 3 segundos

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.delay(pollingInterval);

      const payload = {
        clientKey: this.apiKey,
        taskId: taskId
      };

      const response = await axios.post(url, payload);

      if (response.data.errorId > 0) {
        throw new Error(`Anti-Captcha error: ${response.data.errorDescription || response.data.errorCode}`);
      }

      const status = response.data.status;

      if (status === 'ready') {
        // Tarea completada
        return response.data.solution.gRecaptchaResponse;
      }

      if (status === 'processing') {
        // Aún procesando
        if (attempt % 5 === 0) {
          console.log(`⏳ Esperando respuesta... (${attempt * pollingInterval / 1000}s)`);
        }
        continue;
      }

      // Estado desconocido
      throw new Error(`Estado inesperado: ${status}`);
    }

    throw new Error('Timeout esperando solución de Anti-Captcha');
  }

  /**
   * Obtener balance de Anti-Captcha
   */
  async getBalance() {
    const url = `${this.baseUrl}/getBalance`;

    const payload = {
      clientKey: this.apiKey
    };

    const response = await axios.post(url, payload);

    if (response.data.errorId > 0) {
      throw new Error(`Anti-Captcha error: ${response.data.errorDescription}`);
    }

    return response.data.balance;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AntiCaptchaService();
