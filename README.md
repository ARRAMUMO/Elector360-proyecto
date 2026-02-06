# Elector360

Sistema integral de gestion electoral para el seguimiento, administracion y consulta de votantes colombianos. Permite consultar informacion electoral a traves de la Registraduria Nacional mediante automatizacion RPA, gestionar bases de datos de personas, realizar operaciones masivas con Excel y organizar votantes por mesa de votacion.

## Caracteristicas Principales

### Gestion de Personas
- **CRUD completo** de votantes con datos electorales (documento, nombres, puesto, mesa, etc.)
- **Importacion masiva desde Excel** con datos completos (cedula, nombres, telefono, email, puesto de votacion, mesa)
- **Plantilla de importacion** descargable con instrucciones
- **Exportacion** a Excel y CSV
- **Estado RPA visible** en tabla principal (Actualizado, Pendiente, Error, Sin consultar)
- **Cambio rapido de estado** de contacto (Pendiente, Contactado, Confirmado, No Contactado)

### Consulta RPA (Automatizacion)
- **Consulta individual** por cedula en la Registraduria Nacional
- **Consulta masiva desde Excel** - sube un archivo con cedulas y el sistema las procesa automaticamente
- **Actualizacion masiva** de toda la base de datos
- **3 reintentos automaticos** por consulta antes de marcar como error
- **Circuit breaker** para proteger contra fallos del servicio externo
- **Pool de workers** (hasta 5 navegadores simultaneos) con Puppeteer + 2Captcha

### Operaciones Masivas
- **Carga de Excel** con cedulas para consulta o actualizacion
- **Monitoreo en tiempo real** con progreso, velocidad (consultas/min) y ETA
- **Resultados con datos de votacion** - tabla con departamento, municipio, puesto, mesa
- **Reporte Excel descargable** con datos electorales completos
- **Gestion de errores** - reintentar o eliminar errores individuales o masivamente
- **Mensajes amigables** para errores tecnicos del RPA

### Organizacion Electoral
- **Vista por mesas de votacion** con estadisticas
- **Filtros avanzados** por departamento, municipio, puesto, mesa, zona
- **Dashboard** con metricas generales

### Sistema de Usuarios
- **Roles**: ADMIN (control total) y LIDER (gestion de sus personas)
- **Autenticacion JWT** con refresh tokens
- **Panel de administracion** de usuarios

## Arquitectura

```
Elector360-proyecto/
├── elector360-backend/        # API REST - Node.js + Express
│   └── src/
│       ├── config/            # Constantes y configuracion
│       ├── controllers/       # Controladores de la API
│       ├── middleware/        # Auth, validacion, upload
│       ├── models/            # Modelos MongoDB (Persona, Usuario, ColaConsulta)
│       ├── routes/            # Definicion de rutas
│       ├── services/          # Logica de negocio
│       ├── utils/             # Utilidades (ApiError, asyncHandler)
│       ├── validators/        # Validadores de request
│       └── workers/           # RPA Worker
│           ├── config/        # Configuracion del worker
│           ├── pool/          # Pool de workers Puppeteer
│           ├── scrapers/      # Scraper de Registraduria
│           └── utils/         # Circuit breaker
│
├── elector360-frontend/       # SPA - React + Vite
│   └── src/
│       ├── components/        # Componentes reutilizables
│       │   ├── common/        # Alert, Spinner, etc.
│       │   └── layout/        # AppLayout, Sidebar
│       ├── context/           # AuthContext
│       ├── pages/             # Paginas de la aplicacion
│       └── services/          # Servicios API (Axios)
│
├── LICENSE                    # Licencia propietaria
├── POLITICA_DATOS.md          # Politica de tratamiento de datos personales
├── TERMINOS_USO.md            # Terminos y condiciones de uso
└── AVISO_LEGAL.md             # Aviso legal y disclaimer
```

## Tecnologias

### Backend
- **Runtime**: Node.js v18+
- **Framework**: Express.js v4
- **Base de Datos**: MongoDB con Mongoose ODM
- **Autenticacion**: JWT (JSON Web Tokens) con refresh tokens
- **RPA**: Puppeteer + Puppeteer Stealth Plugin
- **Captcha**: 2Captcha API para reCAPTCHA v2
- **Excel**: ExcelJS para importacion/exportacion
- **Upload**: Multer para carga de archivos
- **Validacion**: express-validator
- **Seguridad**: helmet, cors, express-rate-limit

### Frontend
- **Framework**: React 19 + Vite 7
- **Estilos**: Tailwind CSS 4
- **Routing**: React Router v7
- **HTTP Client**: Axios con interceptores (retry 429, auth tokens)
- **Estado**: React Context + useState/useEffect

## Requisitos Previos

- Node.js v18 o superior
- MongoDB (Atlas o instancia local)
- Cuenta en 2Captcha para resolver captchas
- Chrome/Chromium (Puppeteer lo descarga automaticamente)

## Instalacion

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/elector360-proyecto.git
cd elector360-proyecto
```

### 2. Backend

```bash
cd elector360-backend
npm install
```

Crear archivo `.env`:

```env
# Servidor
PORT=8080
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/elector360

# JWT
JWT_SECRET=tu_secret_muy_seguro_aqui
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=otro_secret_para_refresh
JWT_REFRESH_EXPIRE=30d

# 2Captcha
CAPTCHA_API_KEY=tu_api_key_de_2captcha

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=1000
```

### 3. Frontend

```bash
cd elector360-frontend
npm install
```

Crear archivo `.env`:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

## Ejecucion

### Desarrollo

Terminal 1 - Backend:
```bash
cd elector360-backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd elector360-frontend
npm run dev
```

- Backend: http://localhost:8080
- Frontend: http://localhost:5173

### Produccion

Backend:
```bash
cd elector360-backend
npm start
```

Frontend:
```bash
cd elector360-frontend
npm run build
```

## API Endpoints

### Autenticacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Iniciar sesion |
| POST | `/api/v1/auth/register` | Registrar usuario (Admin) |
| POST | `/api/v1/auth/refresh-token` | Renovar token |
| GET | `/api/v1/auth/me` | Perfil actual |

### Personas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/personas` | Listar con filtros y paginacion |
| POST | `/api/v1/personas` | Crear persona |
| GET | `/api/v1/personas/:id` | Obtener por ID |
| PUT | `/api/v1/personas/:id` | Actualizar persona |
| DELETE | `/api/v1/personas/:id` | Eliminar (Admin) |
| GET | `/api/v1/personas/documento/:doc` | Buscar por cedula |
| POST | `/api/v1/personas/importar` | Importar desde Excel (Admin) |
| GET | `/api/v1/personas/plantilla-importacion` | Descargar plantilla (Admin) |
| GET | `/api/v1/personas/mesas` | Mesas de votacion |
| GET | `/api/v1/personas/mesas/detalle` | Personas por mesa |
| GET | `/api/v1/personas/export/csv` | Exportar CSV |
| GET | `/api/v1/personas/export/excel` | Exportar Excel |

### Operaciones Masivas (Admin)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/masivas/consultar-excel` | Consultar cedulas desde Excel |
| POST | `/api/v1/masivas/actualizar-excel` | Actualizar desde Excel |
| POST | `/api/v1/masivas/actualizar-todo` | Actualizar toda la BD |
| GET | `/api/v1/masivas/estado` | Estado del procesamiento |
| GET | `/api/v1/masivas/resultados` | Resultados con datos de votacion |
| GET | `/api/v1/masivas/reporte-resultados` | Descargar reporte Excel |
| PUT | `/api/v1/masivas/errores/:id/reintentar` | Reintentar error especifico |
| DELETE | `/api/v1/masivas/errores/:id` | Eliminar error especifico |
| PUT | `/api/v1/masivas/errores/reintentar-todos` | Reintentar todos los errores |
| DELETE | `/api/v1/masivas/errores/todos` | Eliminar todos los errores |
| DELETE | `/api/v1/masivas/limpiar-cola` | Limpiar cola antigua |
| GET | `/api/v1/masivas/plantilla` | Descargar plantilla |

### Consultas Individuales

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/consultas/buscar` | Consultar persona en Registraduria |
| GET | `/api/v1/consultas/estado/:id` | Estado de una consulta |

### Usuarios (Admin)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/usuarios` | Listar usuarios |
| PUT | `/api/v1/usuarios/:id` | Actualizar usuario |
| DELETE | `/api/v1/usuarios/:id` | Eliminar usuario |

## Roles de Usuario

### ADMIN
- Gestion completa de usuarios
- Importacion masiva de personas desde Excel
- Control del worker RPA y operaciones masivas
- Gestion de errores (reintentar/eliminar)
- Acceso a estadisticas globales
- Eliminacion de registros

### LIDER
- Consulta de votantes (solo los asignados)
- Gestion de su base de personas
- Cambio de estado de contacto
- Exportacion de datos (Excel/CSV)
- Visualizacion por mesas de votacion

## Flujo de Consulta RPA

```
1. Cedula ingresada (individual o Excel masivo)
          │
2. Verificar en base de datos local
          │
3. Si no existe o desactualizada → Encolar en ColaConsulta
          │
4. Worker poll cada 5 segundos → Toma tareas PENDIENTES
          │
5. Pool de workers (hasta 5 Puppeteer simultaneos)
          │
6. Navegar a Registraduria Nacional
          │
7. Resolver reCAPTCHA v2 con 2Captcha
          │
8. Extraer datos electorales (depto, municipio, puesto, mesa)
          │
9. Actualizar Persona en base de datos
          │
     ┌────┴────┐
  Exito      Error
     │          │
COMPLETADO   ¿Intentos < 3?
                │        │
               Si        No
                │         │
           PENDIENTE    ERROR
           (reintenta)  (final)
```

## Documentacion Legal

Este proyecto incluye la siguiente documentacion legal:

- [Politica de Tratamiento de Datos Personales](POLITICA_DATOS.md) - Cumplimiento Ley 1581 de 2012
- [Terminos y Condiciones de Uso](TERMINOS_USO.md)
- [Aviso Legal](AVISO_LEGAL.md)

## Licencia

Software propietario. Todos los derechos reservados.
Copyright (c) 2026 Arcenis Munoz.

Ver archivo [LICENSE](LICENSE) para los terminos completos.

## Contacto

Arcenis Munoz - arramumo@gmail.com
