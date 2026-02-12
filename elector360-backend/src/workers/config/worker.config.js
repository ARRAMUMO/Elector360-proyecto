// src/workers/config/worker.config.js

module.exports = {
  // Configuración de Puppeteer
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: false, // Navegador visible para fallback manual
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--start-maximized',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    defaultViewport: null, // Usa el tamaño de la ventana (maximizada)
    timeout: 120000 // 2 minutos
  },

  // Configuración de 2Captcha
  captcha: {
    apiKey: process.env.CAPTCHA_API_KEY || '',
    timeout: 120000, // 2 minutos
    pollingInterval: 5000 // 5 segundos
  },

  // URLs
  urls: {
    registraduria: 'https://eleccionescolombia.registraduria.gov.co/identificacion'
  },

  // Configuración de reintentos
  retries: {
    maxAttempts: 3,
    backoff: 5000, // 5 segundos entre reintentos
    timeout: 180000 // 3 minutos total
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
    timeout: 300000, // 5 minutos (para captcha manual)
    resetTimeout: 600000 // 10 minutos
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