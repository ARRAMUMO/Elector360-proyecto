# API Reference - Elector360

## Base URL
```
http://localhost:8080/api/v1
```

## Autenticacion

Todas las rutas protegidas requieren un token JWT en el header:
```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### POST /auth/login
Iniciar sesion y obtener tokens.

**Request:**
```json
{
  "email": "admin@elector360.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "697ba4006c721b4ecdce1425",
      "email": "admin@elector360.com",
      "rol": "ADMIN",
      "perfil": {
        "nombres": "Admin",
        "apellidos": "Sistema"
      },
      "estado": "ACTIVO"
    }
  }
}
```

**Errores:**
- 400: Email y contrasena son requeridos
- 401: Credenciales invalidas
- 401: Usuario inactivo

---

### POST /auth/register
Registrar nuevo usuario (Solo Admin).

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request:**
```json
{
  "email": "nuevo@ejemplo.com",
  "password": "password123",
  "rol": "LIDER",
  "perfil": {
    "nombres": "Juan",
    "apellidos": "Perez",
    "telefono": "3001234567"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "_id": "...",
    "email": "nuevo@ejemplo.com",
    "rol": "LIDER",
    "perfil": {
      "nombres": "Juan",
      "apellidos": "Perez",
      "telefono": "3001234567"
    },
    "estado": "ACTIVO"
  }
}
```

**Validaciones:**
- email: Formato valido, unico
- password: Minimo 6 caracteres
- rol: 'ADMIN' o 'LIDER'
- perfil.nombres: Requerido
- perfil.apellidos: Requerido
- perfil.telefono: 10 digitos, comienza con 3

---

### POST /auth/refresh
Renovar access token usando refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### GET /auth/me
Obtener perfil del usuario autenticado.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "email": "admin@elector360.com",
    "rol": "ADMIN",
    "perfil": {
      "nombres": "Admin",
      "apellidos": "Sistema"
    },
    "stats": {
      "personasRegistradas": 5,
      "consultasRealizadas": 10,
      "ultimaConsulta": "2026-01-30T18:37:22.679Z"
    },
    "estado": "ACTIVO"
  }
}
```

---

### PUT /auth/change-password
Cambiar contrasena del usuario autenticado.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "currentPassword": "password123",
  "newPassword": "nuevaPassword456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Contrasena actualizada exitosamente"
}
```

---

## Usuarios Endpoints (Solo Admin)

### GET /usuarios
Listar todos los usuarios.

**Query Parameters:**
- `page`: Numero de pagina (default: 1)
- `limit`: Registros por pagina (default: 50)
- `rol`: Filtrar por rol ('ADMIN', 'LIDER')
- `estado`: Filtrar por estado ('ACTIVO', 'INACTIVO')

**Response (200):**
```json
{
  "success": true,
  "data": {
    "usuarios": [
      {
        "_id": "...",
        "email": "lider@ejemplo.com",
        "rol": "LIDER",
        "perfil": {
          "nombres": "Juan",
          "apellidos": "Perez"
        },
        "stats": {
          "personasRegistradas": 0,
          "consultasRealizadas": 0
        },
        "estado": "ACTIVO"
      }
    ],
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 50,
      "pages": 1
    }
  }
}
```

---

### GET /usuarios/:id
Obtener usuario por ID.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "email": "lider@ejemplo.com",
    "rol": "LIDER",
    "perfil": {
      "nombres": "Juan",
      "apellidos": "Perez"
    }
  }
}
```

---

### PUT /usuarios/:id
Actualizar usuario.

**Request:**
```json
{
  "perfil": {
    "nombres": "Juan Carlos",
    "telefono": "3009876543"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "email": "lider@ejemplo.com",
    "perfil": {
      "nombres": "Juan Carlos",
      "apellidos": "Perez",
      "telefono": "3009876543"
    }
  }
}
```

---

### DELETE /usuarios/:id
Eliminar usuario.

**Response (200):**
```json
{
  "success": true,
  "message": "Usuario eliminado exitosamente"
}
```

---

### PATCH /usuarios/:id/toggle-estado
Activar/Desactivar usuario.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "estado": "INACTIVO"
  }
}
```

---

## Personas Endpoints

### GET /personas
Listar personas del usuario.

**Query Parameters:**
- `page`: Numero de pagina
- `limit`: Registros por pagina
- `estadoContacto`: 'PENDIENTE', 'CONTACTADO', 'NO_CONTACTADO'
- `buscar`: Busqueda por nombre o documento

**Response (200):**
```json
{
  "success": true,
  "data": {
    "personas": [
      {
        "_id": "...",
        "documento": "1234567890",
        "nombres": "Maria",
        "apellidos": "Garcia",
        "telefono": "3001234567",
        "datosElectorales": {
          "departamento": "ATLANTICO",
          "municipio": "BARRANQUILLA",
          "puestoVotacion": "IE MODELO",
          "mesa": "5"
        },
        "estadoContacto": "PENDIENTE",
        "fuenteDatos": "RPA"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 50,
      "pages": 2
    }
  }
}
```

---

### POST /personas
Crear nueva persona.

**Request:**
```json
{
  "documento": "1234567890",
  "nombres": "Maria",
  "apellidos": "Garcia",
  "telefono": "3001234567",
  "direccion": "Calle 123 #45-67"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "documento": "1234567890",
    "nombres": "Maria",
    "apellidos": "Garcia",
    "estadoContacto": "PENDIENTE",
    "fuenteDatos": "MANUAL"
  }
}
```

---

### GET /personas/buscar
Buscar persona por documento.

**Query Parameters:**
- `documento`: Numero de documento

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "documento": "1234567890",
    "nombres": "Maria",
    "apellidos": "Garcia"
  }
}
```

---

## Consultas RPA Endpoints

### POST /consultas
Crear nueva consulta RPA.

**Request:**
```json
{
  "documento": "1083432108",
  "prioridad": 2
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "documento": "1083432108",
    "estado": "EN_COLA",
    "prioridad": 2,
    "intentos": 0
  }
}
```

**Estados posibles:**
- `EN_COLA`: Esperando ser procesada
- `PROCESANDO`: En proceso
- `COMPLETADO`: Finalizada exitosamente
- `ERROR`: Fallo despues de reintentos

---

### GET /consultas
Listar consultas del usuario.

**Query Parameters:**
- `estado`: Filtrar por estado
- `page`: Pagina
- `limit`: Limite

**Response (200):**
```json
{
  "success": true,
  "data": {
    "consultas": [
      {
        "_id": "...",
        "documento": "1083432108",
        "estado": "COMPLETADO",
        "datosPersona": {
          "departamento": "ATLANTICO",
          "municipio": "POLONUEVO",
          "puestoVotacion": "IE MARIA EMMA",
          "direccion": "CRA 12 No 6-61",
          "mesa": "13"
        },
        "tiempoEjecucion": 35000,
        "completadoEn": "2026-01-30T18:37:22.679Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

---

### GET /consultas/:id
Obtener estado de una consulta.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "documento": "1083432108",
    "estado": "COMPLETADO",
    "datosPersona": {
      "departamento": "ATLANTICO",
      "municipio": "POLONUEVO",
      "puestoVotacion": "IE MARIA EMMA",
      "direccion": "CRA 12 No 6-61",
      "mesa": "13"
    }
  }
}
```

---

## Worker Endpoints (Solo Admin)

### GET /worker/stats
Estadisticas del worker RPA.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalProcessed": 150,
    "successful": 145,
    "failed": 5,
    "inQueue": 3,
    "activeWorkers": 2,
    "uptime": 3600000,
    "averageTime": 35000,
    "successRate": "96.67%",
    "circuitBreaker": "CLOSED"
  }
}
```

---

### GET /worker/health
Health check del worker.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "isRunning": true,
    "poolSize": 2,
    "queueSize": 3
  }
}
```

---

### GET /worker/circuit-breaker
Estado del circuit breaker.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "state": "CLOSED",
    "failures": 0,
    "successes": 10,
    "lastFailure": null
  }
}
```

---

### POST /worker/pause
Pausar el worker.

**Response (200):**
```json
{
  "success": true,
  "message": "Worker pausado"
}
```

---

### POST /worker/resume
Reanudar el worker.

**Response (200):**
```json
{
  "success": true,
  "message": "Worker reanudado"
}
```

---

### POST /worker/retry/:consultaId
Reintentar una consulta fallida.

**Response (200):**
```json
{
  "success": true,
  "message": "Consulta agregada a la cola para reintento"
}
```

---

## Codigos de Error

| Codigo | Descripcion |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Error de validacion |
| 401 | Unauthorized - No autenticado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Registro duplicado |
| 429 | Too Many Requests - Rate limit |
| 500 | Internal Server Error |

---

## Formato de Errores

```json
{
  "success": false,
  "error": "Mensaje descriptivo del error",
  "stack": "Stack trace (solo en desarrollo)"
}
```
