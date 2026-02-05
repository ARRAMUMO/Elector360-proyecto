# Elector360 Backend

Sistema de gestion electoral con consultas automatizadas RPA a la Registraduria Nacional de Colombia.

## Tabla de Contenidos

- [Descripcion](#descripcion)
- [Caracteristicas](#caracteristicas)
- [Requisitos](#requisitos)
- [Instalacion](#instalacion)
- [Configuracion](#configuracion)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [RPA Worker](#rpa-worker)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Testing](#testing)

---

## Descripcion

Elector360 es una plataforma para gestion de informacion electoral que permite:
- Consultar automaticamente datos electorales de ciudadanos en la Registraduria
- Gestionar personas y sus datos de votacion
- Administrar usuarios con diferentes roles (ADMIN, LIDER)
- Procesar consultas masivas mediante RPA

## Caracteristicas

- **Autenticacion JWT** con refresh tokens
- **Roles de usuario**: ADMIN y LIDER
- **RPA automatizado** para consultas a la Registraduria
- **Resolucion automatica de CAPTCHA** mediante 2Captcha
- **Circuit Breaker** para manejo de fallos
- **Pool de workers** para consultas paralelas
- **Rate limiting** para proteccion de API
- **Operaciones masivas** con importacion Excel

---

## Requisitos

- Node.js >= 18.x
- MongoDB >= 6.x (o MongoDB Atlas)
- Cuenta en [2Captcha](https://2captcha.com) para resolver CAPTCHAs
- Chrome/Chromium (instalado automaticamente por Puppeteer)

---

## Instalacion

```bash
# Clonar repositorio
git clone <url-del-repositorio>
cd elector360-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar seed para crear usuario admin
node seed.js

# Iniciar servidor
npm run dev
```

---

## Configuracion

Crear archivo `.env` en la raiz del proyecto:

```env
# Server
NODE_ENV=development
PORT=8080

# MongoDB
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/Elector360-Bd

# JWT
JWT_SECRET=tu_clave_secreta_muy_larga_y_segura
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Admin (para seed.js)
ADMIN_EMAIL=admin@elector360.com
ADMIN_PASSWORD=password123

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# RPA Worker
ENABLE_RPA_WORKER=true
CAPTCHA_API_KEY=tu_api_key_de_2captcha
```

### Variables Importantes

| Variable | Descripcion | Requerido |
|----------|-------------|-----------|
| `MONGODB_URI` | URI de conexion a MongoDB | Si |
| `JWT_SECRET` | Clave secreta para tokens JWT | Si |
| `CAPTCHA_API_KEY` | API Key de 2Captcha | Si (para RPA) |
| `ENABLE_RPA_WORKER` | Activar worker automatico | No |

---

## Uso

### Iniciar en desarrollo
```bash
npm run dev
```

### Iniciar en produccion
```bash
npm start
```

### Ejecutar tests
```bash
npm test
```

### Probar RPA manualmente
```bash
node test-rpa-completo.js
```

---

## API Endpoints

### Base URL
```
http://localhost:8080/api/v1
```

### Autenticacion

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | Iniciar sesion | No |
| POST | `/auth/register` | Registrar usuario | Admin |
| POST | `/auth/refresh` | Renovar token | No |
| GET | `/auth/me` | Obtener perfil actual | Si |
| POST | `/auth/logout` | Cerrar sesion | Si |
| PUT | `/auth/change-password` | Cambiar contrasena | Si |

#### Login
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elector360.com","password":"password123"}'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "_id": "...",
      "email": "admin@elector360.com",
      "rol": "ADMIN",
      "perfil": {
        "nombres": "Admin",
        "apellidos": "Sistema"
      }
    }
  }
}
```

#### Registrar Usuario (Solo Admin)
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "email": "lider@ejemplo.com",
    "password": "password123",
    "rol": "LIDER",
    "perfil": {
      "nombres": "Juan",
      "apellidos": "Perez",
      "telefono": "3001234567"
    }
  }'
```

---

### Usuarios (Solo Admin)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/usuarios` | Listar usuarios |
| POST | `/usuarios` | Crear usuario |
| GET | `/usuarios/:id` | Obtener usuario |
| PUT | `/usuarios/:id` | Actualizar usuario |
| DELETE | `/usuarios/:id` | Eliminar usuario |
| PATCH | `/usuarios/:id/toggle-estado` | Activar/Desactivar |
| GET | `/usuarios/:id/estadisticas` | Estadisticas del usuario |

---

### Personas

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/personas` | Listar personas | Si |
| POST | `/personas` | Crear persona | Si |
| GET | `/personas/:id` | Obtener persona | Si |
| PUT | `/personas/:id` | Actualizar persona | Si |
| DELETE | `/personas/:id` | Eliminar persona | Admin |
| GET | `/personas/buscar` | Buscar por documento | Si |

#### Crear Persona
```bash
curl -X POST http://localhost:8080/api/v1/personas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "documento": "1234567890",
    "nombres": "Maria",
    "apellidos": "Garcia",
    "telefono": "3009876543",
    "direccion": "Calle 123 #45-67"
  }'
```

---

### Consultas RPA

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/consultas/buscar` | Buscar persona y encolar RPA | Si |
| GET | `/consultas/estado/:id` | Estado de consulta | Si |
| POST | `/consultas/confirmar/:personaId` | Confirmar persona | Si |
| GET | `/consultas/historial` | Historial de consultas | Si |

#### Buscar Persona (Principal)
```bash
curl -X POST http://localhost:8080/api/v1/consultas/buscar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"documento": "1083432108"}'
```

**Respuesta (persona existe pero desactualizada):**
```json
{
  "success": true,
  "data": {
    "encontrado": true,
    "enBD": true,
    "desactualizado": true,
    "persona": {
      "_id": "...",
      "documento": "1083432108",
      "nombres": "Juan",
      "apellidos": "Perez",
      "puesto": {
        "departamento": "ATLANTICO",
        "municipio": "POLONUEVO",
        "nombrePuesto": "IE MARIA EMMA",
        "direccion": "CRA 12 No 6-61",
        "mesa": "13"
      },
      "estadoRPA": "NUEVO"
    },
    "enCola": true,
    "consultaId": "697e08a4da13e077b53ff1e7",
    "estado": "EN_COLA",
    "mensaje": "Persona encontrada pero desactualizada. Consultando actualizaciones..."
  }
}
```

**Respuesta (persona no existe):**
```json
{
  "success": true,
  "data": {
    "encontrado": false,
    "enCola": true,
    "estado": "EN_COLA",
    "consultaId": "697e08a4da13e077b53ff1e7",
    "mensaje": "Persona no encontrada. Consultando en Registraduria..."
  }
}
```

#### Consultar Estado (para polling)
```bash
curl http://localhost:8080/api/v1/consultas/estado/697e08a4da13e077b53ff1e7 \
  -H "Authorization: Bearer <token>"
```

**Respuesta (completado):**
```json
{
  "success": true,
  "data": {
    "_id": "697e08a4da13e077b53ff1e7",
    "estado": "COMPLETADO",
    "documento": "1083432108",
    "tiempoEjecucion": 28540,
    "persona": {
      "documento": "1083432108",
      "puesto": {
        "departamento": "ATLANTICO",
        "municipio": "POLONUEVO",
        "nombrePuesto": "IE MARIA EMMA",
        "direccion": "CRA 12 No 6-61",
        "mesa": "13"
      },
      "estadoRPA": "ACTUALIZADO",
      "fechaUltimaConsulta": "2026-01-31T13:53:03.715Z"
    },
    "mensaje": "Consulta completada exitosamente"
  }
}
```

---

### Operaciones Masivas

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/masivas/importar` | Importar Excel | Admin |
| GET | `/masivas/exportar` | Exportar a Excel | Admin |
| POST | `/masivas/consulta-lote` | Consulta por lote | Admin |

---

### Estadisticas

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/estadisticas/dashboard` | Dashboard general | Si |
| GET | `/estadisticas/consultas` | Stats de consultas | Admin |
| GET | `/estadisticas/usuarios` | Stats de usuarios | Admin |

---

### Worker (Solo Admin)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/worker/stats` | Estadisticas del worker |
| GET | `/worker/health` | Health check del worker |
| GET | `/worker/circuit-breaker` | Estado del circuit breaker |
| POST | `/worker/pause` | Pausar worker |
| POST | `/worker/resume` | Reanudar worker |
| POST | `/worker/retry/:id` | Reintentar consulta |
| DELETE | `/worker/clean` | Limpiar consultas antiguas |

---

## RPA Worker

El sistema incluye un worker RPA que consulta automaticamente la Registraduria Nacional.

### Arquitectura

```
+------------------+     +------------------+     +------------------+
|   API Request    |---->|   Cola MongoDB   |---->|   Worker Pool    |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                                                +------------------+
                                                |  Puppeteer +     |
                                                |  2Captcha        |
                                                +------------------+
                                                          |
                                                          v
                                                +------------------+
                                                |  Registraduria   |
                                                |  Nacional        |
                                                +------------------+
```

### Componentes

1. **Main Worker** (`src/workers/main.worker.js`)
   - Coordina el procesamiento de consultas
   - Polling cada 5 segundos a la cola

2. **Worker Pool** (`src/workers/pool/worker-pool.js`)
   - Pool de 1-5 workers concurrentes
   - Balanceo de carga automatico

3. **Circuit Breaker** (`src/workers/utils/circuit-breaker.js`)
   - Proteccion contra fallos en cascada
   - Se abre despues de 5 fallos consecutivos

4. **Registraduria Scraper** (`src/workers/scrapers/registraduria.scraper.js`)
   - Automatizacion con Puppeteer
   - Plugin stealth para evitar deteccion
   - Resolucion automatica de CAPTCHA

### Configuracion del Worker

```javascript
// src/workers/config/worker.config.js
module.exports = {
  puppeteer: {
    headless: true,
    timeout: 60000
  },
  captcha: {
    apiKey: process.env.CAPTCHA_API_KEY,
    timeout: 120000
  },
  pool: {
    minWorkers: 1,
    maxWorkers: 5,
    maxConcurrent: 3
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 300000  // 5 minutos
  }
};
```

### Estados de Consulta

| Estado | Descripcion |
|--------|-------------|
| `EN_COLA` | Pendiente de procesar |
| `PROCESANDO` | En proceso |
| `COMPLETADO` | Finalizado exitosamente |
| `ERROR` | Fallo despues de reintentos |

### Flujo de Consulta

1. Usuario busca persona via `POST /consultas/buscar`
2. Si persona existe pero desactualizada:
   - Devuelve datos existentes + `consultaId`
   - Encola consulta RPA automaticamente
3. Si persona no existe:
   - Encola consulta RPA
   - Devuelve `consultaId` para polling
4. Frontend hace polling a `GET /consultas/estado/:consultaId`
5. Worker procesa la consulta:
   - Puppeteer navega a Registraduria
   - 2Captcha resuelve el CAPTCHA (~30 seg)
   - Extrae datos de la tabla
6. Worker actualiza estado a `COMPLETADO`
7. Frontend obtiene persona actualizada

### Flujo Frontend (Polling)

```javascript
// 1. Buscar persona
const response = await api.post('/consultas/buscar', { documento });

// 2. Si hay consultaId, hacer polling
if (response.data.consultaId) {
  // Mostrar datos existentes inmediatamente (si hay)
  if (response.data.persona) {
    mostrarDatos(response.data.persona);
    mostrarIndicador("Actualizando...");
  }

  // Polling cada 3 segundos
  const interval = setInterval(async () => {
    const estado = await api.get(`/consultas/estado/${response.data.consultaId}`);

    if (estado.data.estado === 'COMPLETADO') {
      clearInterval(interval);
      mostrarDatos(estado.data.persona);  // Datos actualizados
    } else if (estado.data.estado === 'ERROR') {
      clearInterval(interval);
      mostrarError(estado.data.error);
    }
  }, 3000);
}
```

### Datos Extraidos

El scraper extrae los siguientes datos de la Registraduria:

```json
{
  "documento": "1083432108",
  "datosElectorales": {
    "departamento": "ATLANTICO",
    "municipio": "POLONUEVO",
    "puestoVotacion": "IE MARIA EMMA",
    "direccion": "CRA 12 No 6-61",
    "mesa": "13"
  }
}
```

Estos datos se mapean al modelo Persona en el campo `puesto`:

```json
{
  "puesto": {
    "departamento": "ATLANTICO",
    "municipio": "POLONUEVO",
    "nombrePuesto": "IE MARIA EMMA",
    "direccion": "CRA 12 No 6-61",
    "mesa": "13"
  },
  "estadoRPA": "ACTUALIZADO",
  "fechaUltimaConsulta": "2026-01-31T13:53:03.715Z"
}
```

### Tiempo de Ejecucion

- Tiempo promedio: **30-60 segundos**
- Incluye resolucion de CAPTCHA via 2Captcha
- Costo aproximado: $0.003 USD por consulta

---

## Estructura del Proyecto

```
elector360-backend/
|-- server.js                 # Punto de entrada
|-- seed.js                   # Script para crear admin
|-- package.json
|-- .env                      # Variables de entorno
|
|-- src/
|   |-- config/
|   |   |-- database.js       # Conexion MongoDB
|   |   +-- constants.js      # Constantes (roles, estados)
|   |
|   |-- controllers/
|   |   |-- authController.js
|   |   |-- usuarioController.js
|   |   |-- personaController.js
|   |   |-- consultaController.js
|   |   |-- estadisticasController.js
|   |   |-- operacionesMasivasController.js
|   |   +-- worker.controller.js
|   |
|   |-- middleware/
|   |   |-- auth.js           # JWT verification
|   |   |-- validateRole.js   # Role-based access
|   |   |-- errorHandler.js   # Error handling
|   |   +-- upload.js         # File upload (multer)
|   |
|   |-- models/
|   |   |-- Usuario.js
|   |   |-- Persona.js
|   |   |-- ColaConsulta.js
|   |   |-- consultaRPA.model.js
|   |   +-- HistorialCambio.js
|   |
|   |-- routes/
|   |   |-- auth.routes.js
|   |   |-- usuario.routes.js
|   |   |-- persona.routes.js
|   |   |-- consulta.routes.js
|   |   |-- estadisticas.routes.js
|   |   |-- peracionesMasivas.routes.js
|   |   +-- worker.routes.js
|   |
|   |-- services/
|   |   |-- authService.js
|   |   |-- usuarioService.js
|   |   |-- personaService.js
|   |   |-- consultaService.js
|   |   +-- operacionesMasivasService.js
|   |
|   |-- validators/
|   |   |-- authValidator.js
|   |   |-- personaValidator.js
|   |   +-- validate.js
|   |
|   |-- utils/
|   |   |-- asyncHandler.js
|   |   +-- ApiError.js
|   |
|   +-- workers/
|       |-- main.worker.js        # Worker principal
|       |-- config/
|       |   +-- worker.config.js  # Configuracion
|       |-- pool/
|       |   +-- worker-pool.js    # Pool de workers
|       |-- scrapers/
|       |   +-- registraduria.scraper.js  # Scraper
|       |-- services/
|       |   +-- captcha.service.js  # 2Captcha
|       +-- utils/
|           |-- helpers.js        # Utilidades
|           +-- circuit-breaker.js
|
|-- tests/
|   |-- unit/
|   +-- integration/
|
+-- screenshots/              # Screenshots de debugging
```

---

## Testing

### Ejecutar todos los tests
```bash
npm test
```

### Tests unitarios
```bash
npm run test:unit
```

### Tests de integracion
```bash
npm run test:integration
```

### Probar RPA manualmente
```bash
# Analizar selectores de la pagina
node test-rpa.js

# Prueba completa con extraccion de datos
node test-rpa-completo.js
```

---

## Modelos de Datos

### Usuario
```javascript
{
  email: String (unico),
  password: String (hasheado),
  rol: 'ADMIN' | 'LIDER',
  perfil: {
    nombres: String,
    apellidos: String,
    telefono: String
  },
  stats: {
    personasRegistradas: Number,
    consultasRealizadas: Number,
    ultimaConsulta: Date
  },
  estado: 'ACTIVO' | 'INACTIVO'
}
```

### Persona
```javascript
{
  documento: String (unico),
  nombres: String,
  apellidos: String,
  telefono: String,
  email: String,

  // Datos electorales (de Registraduria)
  puesto: {
    departamento: String,
    municipio: String,
    nombrePuesto: String,
    direccion: String,
    mesa: String
  },

  // Estado RPA
  estadoRPA: 'NUEVO' | 'ACTUALIZADO' | 'ERROR_CONSULTA' | 'PENDIENTE_CONSULTA',
  fechaUltimaConsulta: Date,
  fechaSiguienteConsulta: Date,
  intentosConsulta: Number,

  // Relacion con lider
  lider: {
    id: ObjectId (ref: Usuario),
    nombre: String,
    email: String
  },
  confirmado: Boolean,

  // Contacto
  estadoContacto: 'PENDIENTE' | 'CONTACTADO' | 'NO_CONTACTADO',
  notas: String,

  // Metadata
  origen: 'MANUAL' | 'RPA_REGISTRADURIA' | 'IMPORTACION'
}
```

### ConsultaRPA
```javascript
{
  documento: String,
  usuario: ObjectId (ref: Usuario),
  persona: ObjectId (ref: Persona),
  estado: 'EN_COLA' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR',
  prioridad: 1-3,
  intentos: Number,
  datosPersona: Mixed,
  error: String,
  tiempoEjecucion: Number,
  costo: Number
}
```

---

## Manejo de Errores

Todos los errores siguen el formato:

```json
{
  "success": false,
  "error": "Mensaje descriptivo del error",
  "stack": "Stack trace (solo en desarrollo)"
}
```

### Codigos HTTP

| Codigo | Descripcion |
|--------|-------------|
| 200 | Exito |
| 201 | Creado |
| 400 | Error de validacion |
| 401 | No autenticado |
| 403 | No autorizado |
| 404 | No encontrado |
| 429 | Rate limit excedido |
| 500 | Error del servidor |

---

## Seguridad

- Passwords hasheados con bcrypt (10 rounds)
- JWT con expiracion configurable
- Rate limiting en endpoints API
- Helmet para headers de seguridad
- CORS configurado
- Validacion de inputs con express-validator

---

## Credenciales de Prueba

### Admin por defecto
```
Email: admin@elector360.com
Password: password123
```

### Usuarios de prueba creados
```
Email: lider1@elector360.com
Password: lider123456

Email: lider2@elector360.com
Password: lider123456
```

---

## Licencia

MIT License

---

## Autor

Elector360 Team
