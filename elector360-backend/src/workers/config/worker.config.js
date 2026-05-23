// src/workers/config/worker.config.js

const path = require('path');
const isProduction = process.env.NODE_ENV === 'production';

// Directorio persistente de Chromium (guarda cookies/historial para que reCAPTCHA
// reconozca el navegador como "real" y dé el checkbox simple en vez de imágenes)
const chromeProfileDir = process.env.CHROME_PROFILE_DIR ||
  path.join(__dirname, '..', '..', '..', 'chrome-profile');

// Resolver executablePath: variable de entorno tiene prioridad.
// Si no está definida, usar puppeteer.executablePath() que apunta al Chromium
// instalado con `npx puppeteer browsers install chrome`.
// puppeteer-extra usa puppeteer-core internamente y NO auto-detecta el path,
// por eso hay que pasarlo explícito siempre.
let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '';
if (!executablePath) {
  try {
    executablePath = require('puppeteer').executablePath();
  } catch (_) {
    // fallback: ruta conocida del cache de puppeteer en Windows
    const os = require('os');
    const fs = require('fs');
    const candidate = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome', 'win64-144.0.7559.96', 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(candidate)) executablePath = candidate;
  }
}

module.exports = {
  // Configuración de Puppeteer
  puppeteer: {
    executablePath,
    headless: isProduction ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',

      // ── Anti-detección ────────────────────────────────────────────────────
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-default-apps',

      // Resolución y ventana realistas
      '--window-size=1366,768',

      // Locale colombiano (reduce fingerprint anómalo)
      '--lang=es-CO',
      '--accept-lang=es-CO,es,en-US,en',
    ],
    defaultViewport: isProduction ? { width: 1920, height: 1080 } : null,
    // Perfil persistente: guarda cookies, historial → reCAPTCHA nos trata como usuario real
    userDataDir: chromeProfileDir,
    timeout: 120000,
    // Ignorar errores de certificados de páginas internas del gobierno
    ignoreHTTPSErrors: true,
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
