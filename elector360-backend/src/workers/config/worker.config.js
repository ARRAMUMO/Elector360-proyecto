// src/workers/config/worker.config.js

const path = require('path');
const isProduction = process.env.NODE_ENV === 'production';

// Directorio persistente de Chrome (guarda cookies/historial para que reCAPTCHA
// reconozca el navegador como "real" y dé el checkbox simple en vez de imágenes)
const chromeProfileDir = process.env.CHROME_PROFILE_DIR ||
  path.join(__dirname, '..', '..', '..', 'chrome-profile');

module.exports = {
  // Configuración de Puppeteer
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: isProduction ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // Anti-detección: no deshabilitar GPU ni aceleración (parece más humano)
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-features=IsolateOrigins,site-per-process',
      '--flag-switches-begin',
      '--flag-switches-end',
      ...(isProduction
        ? ['--window-size=1920,1080', '--disable-gpu']
        : ['--start-maximized']),
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ],
    defaultViewport: isProduction ? { width: 1920, height: 1080 } : null,
    // Perfil persistente: guarda cookies, localStorage, historial
    userDataDir: chromeProfileDir,
    timeout: 120000
  },

  isProduction,

  // Configuración de 2Captcha
  captcha: {
    apiKey: process.env.CAPTCHA_API_KEY || '',
    timeout: 120000,
    pollingInterval: 5000
  },

  // URLs
  urls: {
    registraduria: 'https://eleccionescolombia.registraduria.gov.co/identificacion'
  },

  // Configuración de reintentos
  retries: {
    maxAttempts: 3,
    backoff: 5000,
    timeout: 180000
  },

  // Pool de workers
  pool: {
    minWorkers: 1,
    maxWorkers: 5,
    maxConcurrent: 5
  },

  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 300000,
    resetTimeout: 600000
  },

  // Delays aleatorios (para parecer humano)
  delays: {
    minTyping: 100,
    maxTyping: 300,
    minAction: 1000,
    maxAction: 3000,
    beforeSubmit: 2000
  }
};
