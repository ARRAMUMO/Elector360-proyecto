// src/workers/utils/helpers.js

/**
 * Delay aleatorio para simular comportamiento humano
 */
const randomDelay = (min, max) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Escribir texto como humano (caracter por caracter con delays)
 */
const typeHuman = async (page, selector, text, config) => {
  await page.waitForSelector(selector, { timeout: 30000 });
  await page.click(selector);
  
  for (const char of text) {
    await page.type(selector, char, {
      delay: Math.random() * (config.delays.maxTyping - config.delays.minTyping) + config.delays.minTyping
    });
  }
  
  await randomDelay(config.delays.minAction, config.delays.maxAction);
};

/**
 * Click con delay aleatorio
 */
const clickHuman = async (page, selector, config) => {
  await page.waitForSelector(selector, { timeout: 30000 });
  await randomDelay(config.delays.minAction, config.delays.maxAction);
  await page.click(selector);
  await randomDelay(config.delays.minAction, config.delays.maxAction);
};

/**
 * Scroll aleatorio para parecer humano
 */
const randomScroll = async (page) => {
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 300);
  });
  await randomDelay(500, 1500);
};

/**
 * Tomar screenshot para debugging
 */
const takeScreenshot = async (page, name) => {
  try {
    const timestamp = Date.now();
    await page.screenshot({ 
      path: `screenshots/${name}_${timestamp}.png`,
      fullPage: true 
    });
  } catch (error) {
    console.error('Error taking screenshot:', error);
  }
};

/**
 * Limpiar texto extraído
 */
const cleanText = (text) => {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
};

/**
 * Parsear fecha
 */
const parseDate = (dateStr) => {
  try {
    // Formato esperado: "DD/MM/YYYY" o similar
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Retry con exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries, baseDelay) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Intento ${i + 1} falló, reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = {
  randomDelay,
  typeHuman,
  clickHuman,
  randomScroll,
  takeScreenshot,
  cleanText,
  parseDate,
  retryWithBackoff
};