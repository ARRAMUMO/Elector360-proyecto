# Configuración de Captcha - Guía Rápida

## Estrategia Dual: Manual + Anti-Captcha ⭐

La mejor configuración combina **modo manual para consultas individuales** y **Anti-Captcha para consultas masivas**.

## Paso 1: Obtener API Key de Anti-Captcha

1. Ir a [anti-captcha.com](https://anti-captcha.com)
2. Crear cuenta
3. Comprar créditos (mínimo $5 USD)
4. Copiar tu API key del dashboard

## Paso 2: Configurar `.env`

```bash
# Copiar el archivo de ejemplo
cp .env.example .env
```

Editar `.env` y configurar:

```bash
# Modo automático (selecciona según tipo de consulta)
CAPTCHA_MODE=auto

# Consultas individuales: Manual
CAPTCHA_INDIVIDUAL_MODE=manual

# Consultas masivas: Anti-Captcha
CAPTCHA_BATCH_MODE=anticaptcha

# Tu API key de Anti-Captcha
ANTICAPTCHA_API_KEY=TU_API_KEY_AQUI
```

## Paso 3: Probar Configuración

### Prueba 1: Consulta Individual (Manual)

```bash
node src/workers/ejemplos/consulta-individual.js
```

**Esperado**:
- ✅ Se abre navegador visible
- ✅ Formulario se llena automáticamente
- ⏳ Espera a que resuelvas el captcha manualmente
- ✅ Extrae y muestra los datos

### Prueba 2: Consulta Masiva (Automática)

```bash
node src/workers/ejemplos/consulta-masiva.js
```

**Esperado**:
- ✅ Muestra balance de Anti-Captcha
- ✅ Consulta múltiples documentos automáticamente
- ✅ Resuelve captchas automáticamente
- ✅ Genera archivo JSON con resultados

## Configuraciones Alternativas

### Solo Manual (Sin API key)

```bash
CAPTCHA_MODE=manual
```

**Uso**: Todas las consultas requieren resolución manual del captcha.

### Solo Anti-Captcha (Todo automático)

```bash
CAPTCHA_MODE=anticaptcha
ANTICAPTCHA_API_KEY=tu_key_aqui
```

**Uso**: Todas las consultas (individuales y masivas) usan Anti-Captcha.

### Solo 2Captcha

```bash
CAPTCHA_MODE=2captcha
CAPTCHA_API_KEY=tu_key_aqui
```

**Nota**: 2Captcha tiene menor tasa de éxito en esta página. Anti-Captcha es más confiable.

## Uso en Código

### Consulta Individual

```javascript
const scraper = new RegistraduriaScrap();
await scraper.init();

// Parámetro 'false' = Consulta individual (usará modo manual)
const resultado = await scraper.consultarPersona('1083432108', false);

await scraper.close();
```

### Consulta Masiva

```javascript
const scraper = new RegistraduriaScrap();
await scraper.init();

const documentos = ['123456', '789012', '345678'];

for (const doc of documentos) {
  // Parámetro 'true' = Consulta masiva (usará Anti-Captcha)
  const resultado = await scraper.consultarPersona(doc, true);

  if (resultado.success) {
    console.log('Datos:', resultado.datos);
  }
}

await scraper.close();
```

## Verificar Balance de Anti-Captcha

```javascript
const captchaResolver = require('./services/captcha-resolver.service');

const balance = await captchaResolver.getBalance();
console.log(`Balance: $${balance.balance}`);
```

## Costos Aproximados

| Volumen | Costo (Anti-Captcha) |
|---------|----------------------|
| 100 consultas | $0.14 USD |
| 500 consultas | $0.70 USD |
| 1,000 consultas | $1.40 USD |
| 5,000 consultas | $7.00 USD |
| 10,000 consultas | $14.00 USD |

## Solución de Problemas

### Error: "Anti-Captcha API key no configurada"

**Solución**: Verificar que `ANTICAPTCHA_API_KEY` esté en `.env`

### Error: "Insufficient funds"

**Solución**: Recargar balance en anti-captcha.com

### Captcha manual no aparece

**Solución**:
1. Verificar que el navegador esté en modo visible (`headless: false`)
2. Verificar que `CAPTCHA_INDIVIDUAL_MODE=manual`

### Anti-Captcha muy lento (>60s)

**Posibles causas**:
- Balance muy bajo (prioridad baja en cola)
- Hora pico de uso del servicio
- Recarga balance o espera unos minutos

## Recomendación Final

**Para producción**, usa la configuración dual:

```bash
CAPTCHA_MODE=auto
CAPTCHA_INDIVIDUAL_MODE=manual
CAPTCHA_BATCH_MODE=anticaptcha
ANTICAPTCHA_API_KEY=tu_key_aqui
```

**Ventajas**:
- ✅ Consultas individuales: rápidas y sin costo (manual)
- ✅ Consultas masivas: automáticas y confiables (Anti-Captcha)
- ✅ Flexibilidad según necesidad
- ✅ Costos optimizados

## Soporte

Para más información ver [CAMBIOS_REGISTRADURIA.md](CAMBIOS_REGISTRADURIA.md)
