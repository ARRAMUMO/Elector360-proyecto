# RPA Worker - Documentacion Tecnica

Sistema de automatizacion para consultas a la Registraduria Nacional de Colombia.

## Indice

- [Arquitectura](#arquitectura)
- [Componentes](#componentes)
- [Configuracion](#configuracion)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Circuit Breaker](#circuit-breaker)
- [Resolucion de Captcha](#resolucion-de-captcha)
- [Debugging](#debugging)
- [Problemas Comunes](#problemas-comunes)

---

## Arquitectura

```
                                    +------------------+
                                    |   API Request    |
                                    +--------+---------+
                                             |
                                             v
+-------------------+              +------------------+
|   Usuario crea    |------------->|  ConsultaRPA     |
|   consulta        |              |  (MongoDB)       |
+-------------------+              +--------+---------+
                                            |
                                            | estado: EN_COLA
                                            v
                               +------------------------+
                               |    Main Worker         |
                               |    (Polling 5 seg)     |
                               +------------------------+
                                            |
                                            v
                               +------------------------+
                               |    Worker Pool         |
                               |    (1-5 workers)       |
                               +------------------------+
                                            |
                                            v
                               +------------------------+
                               |    Circuit Breaker     |
                               +------------------------+
                                            |
                                            v
                               +------------------------+
                               |  Registraduria Scraper |
                               +------------------------+
                                            |
                                            v
                               +------------------------+
                               |    Puppeteer +         |
                               |    Stealth Plugin      |
                               +------------------------+
                                            |
                                            v
                               +------------------------+
                               |    2Captcha Service    |
                               +------------------------+
                                            |
                                            v
                               +------------------------+
                               | wsp.registraduria.gov  |
                               +------------------------+
```

---

## Componentes

### 1. Main Worker (`src/workers/main.worker.js`)

Coordinador principal del sistema RPA.

**Responsabilidades:**
- Iniciar y detener el sistema
- Polling a la cola de consultas
- Manejar eventos del pool
- Guardar resultados en MongoDB

**Metodos principales:**
```javascript
// Iniciar worker
await rpaWorker.start();

// Detener worker
await rpaWorker.stop();

// Obtener estadisticas
const stats = rpaWorker.getStats();
```

### 2. Worker Pool (`src/workers/pool/worker-pool.js`)

Pool de instancias de Puppeteer para procesamiento paralelo.

**Caracteristicas:**
- Minimo 1 worker, maximo 5
- Concurrencia maxima: 3
- Auto-escalado segun demanda
- Reinicio automatico de workers con errores

**Eventos emitidos:**
- `worker-added`: Nuevo worker agregado
- `worker-removed`: Worker eliminado
- `job-queued`: Job agregado a cola
- `job-started`: Job iniciado
- `job-completed`: Job completado
- `job-failed`: Job fallido
- `circuit-breaker-open`: CB abierto
- `circuit-breaker-closed`: CB cerrado

### 3. Circuit Breaker (`src/workers/utils/circuit-breaker.js`)

Proteccion contra fallos en cascada.

**Estados:**
- `CLOSED`: Normal, acepta requests
- `OPEN`: Rechaza requests temporalmente
- `HALF-OPEN`: Probando recuperacion

**Configuracion:**
```javascript
{
  failureThreshold: 5,    // Fallos para abrir
  successThreshold: 2,    // Exitos para cerrar
  timeout: 60000,         // Timeout por operacion
  resetTimeout: 300000    // Tiempo en OPEN (5 min)
}
```

### 4. Registraduria Scraper (`src/workers/scrapers/registraduria.scraper.js`)

Automatizacion de la pagina de consulta.

**Proceso:**
1. Navegar a `wsp.registraduria.gov.co/censo/consultar/`
2. Llenar campo NUIP
3. Resolver captcha con 2Captcha
4. Click en CONSULTAR
5. Extraer datos de la tabla

**Selectores utilizados:**
```javascript
{
  inputDocumento: '#nuip',
  botonSubmit: '#enviar',
  captcha: '.g-recaptcha[data-sitekey]'
}
```

### 5. Captcha Service (`src/workers/services/captcha.service.js`)

Integracion con 2Captcha para resolver reCAPTCHA v2.

**Flujo:**
1. Obtener sitekey de la pagina
2. Enviar a 2Captcha API
3. Poll hasta obtener solucion
4. Inyectar token en la pagina

**Tiempo estimado:** 20-45 segundos

---

## Configuracion

### worker.config.js

```javascript
module.exports = {
  // Puppeteer
  puppeteer: {
    headless: true,           // false para debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ],
    timeout: 60000
  },

  // 2Captcha
  captcha: {
    apiKey: process.env.CAPTCHA_API_KEY,
    timeout: 120000,          // 2 minutos max
    pollingInterval: 5000     // Check cada 5 seg
  },

  // URLs
  urls: {
    registraduria: 'https://wsp.registraduria.gov.co/censo/consultar/'
  },

  // Reintentos
  retries: {
    maxAttempts: 3,
    backoff: 5000,
    timeout: 180000
  },

  // Pool
  pool: {
    minWorkers: 1,
    maxWorkers: 5,
    maxConcurrent: 3
  },

  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    resetTimeout: 300000
  },

  // Delays (anti-deteccion)
  delays: {
    minTyping: 100,
    maxTyping: 300,
    minAction: 1000,
    maxAction: 3000,
    beforeSubmit: 2000
  }
};
```

---

## Flujo de Trabajo

### 1. Crear Consulta (API)

```javascript
POST /api/v1/consultas
{
  "documento": "1083432108",
  "prioridad": 2  // 1=baja, 2=normal, 3=alta
}
```

### 2. Guardar en Cola

```javascript
// consultaRPA.model.js
{
  documento: "1083432108",
  usuario: ObjectId,
  estado: "EN_COLA",
  prioridad: 2,
  intentos: 0
}
```

### 3. Worker Detecta Consulta

```javascript
// Polling cada 5 segundos
const consultas = await ConsultaRPA.find({
  estado: 'EN_COLA'
})
.sort({ prioridad: -1, createdAt: 1 })
.limit(10);
```

### 4. Procesar Consulta

```javascript
// Cambiar estado
consulta.estado = 'PROCESANDO';
consulta.intentos++;
await consulta.save();

// Ejecutar scraper
const resultado = await scraper.consultarPersona(documento);
```

### 5. Guardar Resultado

**Exito:**
```javascript
consulta.estado = 'COMPLETADO';
consulta.datosPersona = resultado.datos;
consulta.completadoEn = new Date();
consulta.tiempoEjecucion = duration;
```

**Error:**
```javascript
if (consulta.intentos >= maxAttempts) {
  consulta.estado = 'ERROR';
  consulta.error = error.message;
} else {
  consulta.estado = 'EN_COLA';  // Reintentar
}
```

---

## Circuit Breaker

### Diagrama de Estados

```
     +--------+
     | CLOSED |<----------------+
     +----+---+                 |
          |                     |
          | 5 fallos            | 2 exitos
          | consecutivos        |
          v                     |
     +--------+           +-----------+
     |  OPEN  |---------->| HALF-OPEN |
     +--------+           +-----------+
          ^    5 min timeout
          |
          +--- Si falla en HALF-OPEN
```

### Uso

```javascript
// El circuit breaker envuelve las operaciones
const resultado = await circuitBreaker.execute(async () => {
  return await scraper.consultarPersona(documento);
});
```

---

## Resolucion de Captcha

### Requisitos

1. Cuenta en 2Captcha: https://2captcha.com
2. Saldo disponible (aprox $0.003 USD por captcha)
3. API Key configurada en .env

### Proceso

```javascript
// 1. Obtener sitekey de la pagina
const siteKey = await page.evaluate(() => {
  return document.querySelector('[data-sitekey]')
    .getAttribute('data-sitekey');
});
// siteKey: "6LcthjAgAAAAAFIQLxy52074zanHv47cIvmIHglH"

// 2. Enviar a 2Captcha
const captchaId = await submitCaptcha(siteKey, pageUrl);

// 3. Esperar solucion (20-45 seg)
const solution = await getCaptchaSolution(captchaId);

// 4. Inyectar en la pagina
await page.evaluate((token) => {
  document.getElementById('g-recaptcha-response').innerHTML = token;
}, solution);
```

---

## Debugging

### Modo Visual

Para ver el navegador durante la ejecucion:

```javascript
// worker.config.js
puppeteer: {
  headless: false,  // Cambiar a false
  // ...
}
```

### Screenshots

El scraper toma screenshots automaticos en errores:

```
screenshots/
  error_1083432108_1706750400000.png
  debug_no_tabla_1706750401000.png
```

### Logs

```javascript
// Salida del worker
[nodemon] starting `node server.js`
✅ Navegador inicializado
🔍 Consultando documento: 1083432108
✅ Formulario llenado
🔐 Resolviendo captcha con siteKey: 6LcthjAgAAAAA...
✅ Captcha resuelto
✅ Formulario enviado
🔍 Debug pagina: {"hasTable":true,"hasInfoVotacion":true}
✅ Datos extraidos: {"departamento":"ATLANTICO",...}
✅ Consulta exitosa
```

### Script de Prueba

```bash
# Prueba completa del RPA
node test-rpa-completo.js

# Analizar selectores
node test-rpa.js
```

---

## Problemas Comunes

### 1. "No se pudo resolver el captcha"

**Causas:**
- API Key invalida o sin saldo
- Timeout (>2 minutos)
- Sitekey cambio

**Solucion:**
- Verificar saldo en 2captcha.com
- Verificar API Key en .env
- Ejecutar test-rpa.js para obtener nuevo sitekey

### 2. "No se encontro la tabla de resultados"

**Causas:**
- Captcha no se resolvio correctamente
- Documento no existe en censo
- Pagina cambio estructura

**Solucion:**
- Revisar screenshots en carpeta screenshots/
- Verificar que el documento existe manualmente
- Actualizar selectores si la pagina cambio

### 3. "Circuit Breaker is OPEN"

**Causas:**
- 5 fallos consecutivos
- Pagina de Registraduria caida
- Problemas de red

**Solucion:**
- Esperar 5 minutos (reset automatico)
- Verificar pagina manualmente
- Revisar logs para identificar error

### 4. "Timeout waiting for selector"

**Causas:**
- Pagina muy lenta
- Selector incorrecto
- Elemento no existe

**Solucion:**
- Aumentar timeout en config
- Verificar selectores con test-rpa.js
- Revisar estructura actual de la pagina

### 5. Browser crashes

**Causas:**
- Memoria insuficiente
- Demasiados workers

**Solucion:**
```javascript
// Reducir workers
pool: {
  minWorkers: 1,
  maxWorkers: 2,
  maxConcurrent: 1
}
```

---

## Metricas

### Estadisticas Disponibles

```javascript
{
  totalProcessed: 150,      // Total procesadas
  successful: 145,          // Exitosas
  failed: 5,                // Fallidas
  inQueue: 3,               // En cola
  activeWorkers: 2,         // Workers activos
  uptime: 3600000,          // Tiempo activo (ms)
  averageTime: 35000,       // Tiempo promedio (ms)
  successRate: "96.67%",    // Tasa de exito
  circuitBreaker: "CLOSED"  // Estado CB
}
```

### Endpoint de Estadisticas

```bash
curl http://localhost:8080/api/v1/worker/stats \
  -H "Authorization: Bearer <admin_token>"
```

---

## Costos Estimados

### 2Captcha

- Precio: ~$2.99 USD por 1000 captchas
- Por consulta: ~$0.003 USD
- 1000 consultas: ~$3 USD

### Tiempo de Ejecucion

- Sin captcha cacheado: 30-60 segundos
- Con captcha: 40-90 segundos
- Promedio: ~45 segundos

### Capacidad

Con configuracion por defecto (3 workers concurrentes):
- ~4 consultas/minuto
- ~240 consultas/hora
- ~5,760 consultas/dia
