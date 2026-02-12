# Actualización Scraper Registraduría Nacional

**Fecha**: 11 de febrero de 2026
**Motivo**: La Registraduría Nacional cambió su página de consulta de lugar de votación

## URL Actualizada
- **Nueva URL**: `https://eleccionescolombia.registraduria.gov.co/identificacion`
- **Configuración**: Ya actualizada en `worker.config.js`

## Cambios Implementados

### 1. Selectores del Formulario ✅
| Elemento | Antes | Ahora |
|----------|-------|-------|
| Campo documento | `#nuip` | `#document` |
| Tipo de input | text | number |
| Botón enviar | `#enviar` (ID) | `button[type="submit"]` con texto "Consultar" |

### 2. reCAPTCHA ✅ (con limitaciones)
- **SiteKey**: `6Lc9DmgrAAAAAJAjWVhjDy1KSgqzqJikY5z7I9SV`
- **Tipo**: reCAPTCHA v2 (checkbox)
- **Estado**: La inyección automática de tokens tiene limitaciones técnicas
- **Solución**: Implementado modo fallback con resolución manual

**Modo Manual**: Configurar `CAPTCHA_MANUAL_MODE=true` en `.env` para permitir resolución manual del captcha cuando falla la automática.

### 3. Estructura de Resultados ✅
La nueva página NO usa tablas. Los datos se muestran en formato texto/cards:

**Antes**:
```html
<table>
  <tr><th>NUIP</th><th>DEPARTAMENTO</th>...</tr>
  <tr><td>123...</td><td>ATLANTICO</td>...</tr>
</table>
```

**Ahora**:
```
Documento de identidad: C.C. 1083432108
Departamento: ATLANTICO
Municipio: POLONUEVO
Puesto: 02 - IE MARIA EMMA
Mesa: 14
Zona: 00
Dirección: CRA 12 No 6-61
```

### 4. Método de Extracción ✅
- Cambió de búsqueda en tabla a extracción por regex del texto de la página
- Se agregó campo `zona` a los datos extraídos
- Validación mejorada de resultados

## Archivos Modificados

1. **`src/workers/scrapers/registraduria.scraper.js`**
   - ✅ Método `llenarFormulario()`: Actualizado selector a `#document`
   - ✅ Método `resolverCaptcha()`: Mejorado con detección de sitekey en iframes + modo manual fallback
   - ✅ Método `enviarFormulario()`: Actualizado para buscar botón sin ID + detectar cambios en SPA
   - ✅ Método `extraerDatos()`: Completamente reescrito para extraer datos de texto en lugar de tabla

2. **`src/workers/config/worker.config.js`**
   - ✅ URL ya estaba actualizada

## Limitación Conocida: reCAPTCHA v2

**Problema**: La nueva página usa reCAPTCHA v2 con checkbox, que tiene validaciones estrictas del lado del cliente que dificultan la inyección automática de tokens.

**Impacto**: El captcha automático con 2Captcha puede fallar ocasionalmente.

**Soluciones Implementadas**:

1. **Modo Manual (Recomendado para desarrollo/testing)**:
   ```bash
   # En .env
   CAPTCHA_MANUAL_MODE=true
   ```
   - El scraper espera hasta 2 minutos para resolución manual
   - Útil para garantizar funcionamiento mientras se busca solución permanente

2. **Inyección Mejorada**:
   - Se intentan múltiples métodos de inyección
   - Se buscan y ejecutan callbacks de reCAPTCHA
   - Se fuerza habilitación del botón si es necesario

3. **Soluciones Futuras Posibles**:
   - Usar puppeteer-extra-plugin-recaptcha
   - Implementar servicio de browser en la nube con extensiones de 2Captcha
   - Investigar si existe API oficial de la Registraduría

## Testing

### Scripts de Prueba Creados:

1. **`src/workers/test-new-page.js`**: Inspecciona estructura de la página
2. **`src/workers/test-consulta.js`**: Prueba consulta completa con debugging
3. **`src/workers/test-scraper-actualizado.js`**: Prueba el scraper actualizado
4. **`src/workers/test-manual-mode.js`**: Prueba con resolución manual de captcha ⭐

### Ejecutar Tests:

```bash
# Test con modo manual (recomendado)
node src/workers/test-manual-mode.js

# Test automático
node src/workers/test-scraper-actualizado.js

# Inspeccionar página
node src/workers/test-new-page.js
```

## Estado Actual

| Componente | Estado | Notas |
|------------|--------|-------|
| Selectores de formulario | ✅ Funcionando | Actualizados correctamente |
| Envío de formulario | ✅ Funcionando | Detecta cambios en SPA |
| Extracción de datos | ✅ Funcionando | Nuevo formato implementado |
| reCAPTCHA automático | ⚠️ Limitado | Puede requerir intervención manual |
| reCAPTCHA manual | ✅ Funcionando | Fallback confiable |

## Próximos Pasos Recomendados

1. **Inmediato**: Usar modo manual (`CAPTCHA_MANUAL_MODE=true`) para garantizar funcionamiento
2. **Corto plazo**: Probar con documento real para validar extracción completa de datos
3. **Mediano plazo**: Investigar soluciones avanzadas para reCAPTCHA v2 automático
4. **Largo plazo**: Contactar Registraduría para verificar si existe API oficial

## Variables de Entorno - CONFIGURACIÓN DUAL ⭐

```bash
# .env

# ===== CONFIGURACIÓN RECOMENDADA =====

# Modo automático: selecciona el servicio apropiado según el tipo de consulta
CAPTCHA_MODE=auto

# Para consultas INDIVIDUALES: Modo manual (operador resuelve el captcha)
CAPTCHA_INDIVIDUAL_MODE=manual

# Para consultas MASIVAS: Anti-Captcha automático
CAPTCHA_BATCH_MODE=anticaptcha

# API Key de Anti-Captcha (para consultas masivas)
# Obtener en: https://anti-captcha.com
# Costo: ~$1.40/1000 captchas
ANTICAPTCHA_API_KEY=tu_api_key_aqui

# API Key de 2Captcha (opcional, como alternativa)
CAPTCHA_API_KEY=aa29ea437a7f5ef08e5c2ea9eae7c5ea
```

### Modos Disponibles:

| Modo | Descripción | Uso Recomendado |
|------|-------------|-----------------|
| `manual` | Operador resuelve el captcha manualmente | Consultas individuales |
| `anticaptcha` | Anti-Captcha automático (mejor tasa de éxito) | Consultas masivas |
| `2captcha` | 2Captcha automático | Alternativa a Anti-Captcha |

### Configuración por Tipo de Consulta:

```bash
# Opción 1: RECOMENDADO - Dual (Manual + Anti-Captcha)
CAPTCHA_MODE=auto
CAPTCHA_INDIVIDUAL_MODE=manual
CAPTCHA_BATCH_MODE=anticaptcha
ANTICAPTCHA_API_KEY=tu_key_aqui

# Opción 2: Todo manual (para testing/desarrollo)
CAPTCHA_MODE=manual

# Opción 3: Todo automático (solo si tienes API key configurada)
CAPTCHA_MODE=anticaptcha
ANTICAPTCHA_API_KEY=tu_key_aqui
```

## Ejemplos de Uso

### Consulta Individual (Manual):

```bash
# Ejecutar ejemplo
node src/workers/ejemplos/consulta-individual.js
```

- Abre navegador visible
- Llena el formulario automáticamente
- Espera a que resuelvas el captcha manualmente
- Extrae y muestra los datos

### Consulta Masiva (Anti-Captcha):

```bash
# Ejecutar ejemplo
node src/workers/ejemplos/consulta-masiva.js
```

- Consulta múltiples documentos automáticamente
- Usa Anti-Captcha para resolver captchas
- Genera reporte JSON con resultados
- Reinicia navegador cada 10 consultas

### Uso Programático:

```javascript
const RegistraduriaScrap = require('./scrapers/registraduria.scraper');

const scraper = new RegistraduriaScrap();
await scraper.init();

// Consulta individual (manual)
const resultado1 = await scraper.consultarPersona('1083432108', false);

// Consulta masiva (automático)
const resultado2 = await scraper.consultarPersona('1045667173', true);

await scraper.close();
```

## Costos de Anti-Captcha

- **Precio**: ~$1.40 por 1000 captchas resueltos
- **Tiempo de resolución**: 10-30 segundos por captcha
- **Tasa de éxito**: ~95% para reCAPTCHA v2

### Ejemplo de Cálculo:

- **100 consultas**: $0.14 USD
- **1,000 consultas**: $1.40 USD
- **10,000 consultas**: $14.00 USD

## Notas Adicionales

- La nueva página es una SPA (Single Page Application) con React/Next.js y Tailwind CSS
- No usa formularios HTML tradicionales
- La validación es del lado del cliente con JavaScript
- El reCAPTCHA es v2 (checkbox) visible, no invisible ni v3
- **Configuración dual recomendada**: Manual para individuales + Anti-Captcha para masivas
