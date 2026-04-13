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
- **Aviso de conflicto al importar**: si una persona ya pertenece a un lider activo de la misma campana, se omite y se muestra un reporte detallado en el modal (con nombre del lider actual) sin cerrar automaticamente
- **Reasignacion automatica de personas huerfanas**: si al importar una persona tiene un lider asignado que fue eliminado del sistema, se reasigna automaticamente al lider que realiza la importacion sin necesidad de intervencion manual
- **Deteccion de cedulas duplicadas en el archivo**: si una cedula aparece mas de una vez en el Excel, se reporta como error en cada fila donde aparece indicando los numeros de fila del duplicado; solo se procesa la primera ocurrencia
- **Identificacion del lider en errores de duplicado**: cuando insertMany detecta un conflicto de clave unica, el error ya no dice "posible duplicado" sino que muestra el nombre del lider que ya tiene esa persona
- **Asignar lider al crear**: Admin y Coordinador pueden seleccionar a que lider asignar la nueva persona directamente desde el modal de creacion
- **Filtrar por lider desde Usuarios**: el boton "Ver personas" en la tabla de usuarios navega a /personas con filtro por lider activo y banner informativo
- **Modal con botones siempre visibles**: el modal de nueva persona usa layout flex con footer sticky, los botones Cancelar/Crear Persona son siempre accesibles sin importar el scroll
- **Mover / Compartir entre campanas**: desde el menu de acciones de cada persona, el lider puede moverla a otra campana (cambia campana principal) o compartirla (aparece en ambas campanas simultaneamente)
- **Persistencia de datos personales**: al eliminar un lider o finalizar una campana, las personas NO se borran; se archivan con motivo y fecha. Los datos persisten para reutilizarse en futuras campanas

### Consulta RPA (Automatizacion)
- **Consulta individual** por cedula en la Registraduria Nacional (`https://wsp.registraduria.gov.co/censo/consultar`)
- **Consulta masiva desde Excel** - sube un archivo con cedulas y el sistema las procesa automaticamente
- **Actualizacion masiva** de toda la base de datos
- **3 reintentos automaticos** por consulta antes de marcar como error
- **Circuit breaker** para proteger contra fallos del servicio externo
- **Pool de workers** (hasta 5 navegadores simultaneos) con Puppeteer + 2Captcha
- **Modo manual**: si no hay API key de 2Captcha configurada, el sistema espera a que el usuario resuelva el captcha manualmente y detecta automaticamente cuando aparecen los resultados

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
- **Dashboard** con metricas generales (Total Personas, Actualizadas, Pendientes, Consultas Hoy)

### Dashboard Multi-Campana (Coordinador)
- **Tarjetas de campana**: el Coordinador ve todas sus campanas asignadas con estadisticas en tiempo real (total personas, lideres, confirmadas)
- **Seleccion de campana activa**: al hacer clic en una tarjeta, se carga el contexto completo de esa campana (personas, E-14, mesas, etc.)
- **Auto-seleccion**: si el Coordinador solo tiene una campana asignada, se selecciona automaticamente

### Resultados E-14 (Escrutinio de Mesa)
- **Registro de resultados** por mesa de votacion: votos candidato, votos lista, total urna, inscritos E-11
- **Importacion masiva desde Excel** del formulario E-14 oficial de la Registraduria (bulk upsert, soporta 6.000+ filas)
- **Importacion por cola de PDFs**: carga multiple de archivos PDF del E-14, visor integrado y formulario de captura con avance automatico entre mesas
- **Analisis cruzado** ResultadoMesa x Personas: calcula cuantas personas registradas hay en cada mesa y la efectividad del candidato
- **Verificacion de votos**: cruza todos los resultados E-14 con las personas de la campana y asigna estado de voto (Cumplido / Verificable / No cumplido) en un solo proceso batch
- **Normalizacion inteligente de puestos**: elimina prefijos (I.E., COL, IED, ITA...), sufijos de bloque/sede y maneja truncacion de 30 caracteres del Excel oficial mediante busqueda fuzzy de dos niveles
- **Regla de cumplimiento por mesa**: una persona es CUMPLIDO solo si los votos del candidato en su mesa son >= al total de personas registradas en esa mesa (todos los lideres incluidos). Si comparte mesa con otras personas, se requiere que los votos cubran a todos para ser CUMPLIDO; de lo contrario es VERIFICABLE
- **Vista por Lider** (Admin/Coordinador): selector de lider con tabla de sus personas y estado de voto calculado dinamicamente; boton "Verificar votos" disponible tanto en vista lider como en informe lider
- **Tarjetas de resumen consistentes**: los conteos (Cumplido/Verificable/No cumplido) usan el estadoMesa calculado en tiempo real y el filtro de la tabla aplica el mismo criterio, garantizando que el numero de la tarjeta coincide con el numero de filas al hacer clic
- **Alerta de municipio incorrecto al importar**: si el nombre de un puesto de votacion en el Excel no coincide con el municipio real segun las Personas de la campana (datos de Registraduria), se muestra una advertencia detallada sin bloquear la importacion
- **Verificacion de cobertura de puestos**: endpoint y modal para cruzar puestos unicos de Personas vs ResultadoMesa, mostrando que puestos no tienen resultado importado, cuales resultados no tienen personas y cuales coinciden
- **Exportacion de informes Excel** con selector de tipo:
  - *Personas*: documento, nombres, apellidos, telefono, municipio, zona, puesto, mesa, lider, estado contacto, estado voto, nota
  - *Resumen por mesa*: departamento, municipio, zona, puesto, mesa, votos candidato, votos lista, personas, efectividad %, estado voto
- **Filtro por lider** en el informe: Admin/Coordinador pueden descargar el informe filtrado por un lider especifico
- **Tarjetas de resumen**: total votos candidato, votos en mesas cumplidas, votos en mesas verificables, votos en mesas no cumplidas (con conteo de mesas como subtitulo)
- **Limpiar datos E-14**: borrado completo de resultados de la campana (Admin y Coordinador)

### Sistema de Usuarios
- **Roles**: ADMIN (control total), COORDINADOR (gestion de equipo) y LIDER (gestion de sus personas)
- **Autenticacion JWT** con refresh tokens
- **Panel de administracion** de usuarios con busqueda por nombre o email
- **ADMIN ve todos los usuarios** sin excepcion, independientemente de la campana activa
- **Multi-campana para Coordinador y Lider**: tanto Coordinadores como Lideres pueden ser asignados a multiples campanas; formulario con checkboxes y selector de campana principal; el Dashboard muestra el selector de campana activa para ambos roles
- **Gestion de lideres por coordinador**: cada Coordinador solo ve y gestiona sus propios Lideres (campo coordinadorId); al crear un Lider, queda vinculado automaticamente al Coordinador que lo creo
- **Asignacion de lider a persona**: Admin y Coordinador pueden reasignar el lider de cualquier persona
- **Ver personas de un lider**: boton directo en la tabla de usuarios para navegar a /personas filtrado por ese lider
- **Campanas del endpoint mis-campanas**: accesible para todos los roles autenticados (Lider, Coordinador, Admin)

## Arquitectura

```
Elector360-proyecto/
├── elector360-backend/        # API REST - Node.js + Express
│   └── src/
│       ├── config/            # Constantes y configuracion
│       ├── controllers/       # Controladores de la API
│       ├── middleware/        # Auth, validacion, upload, campaignScope
│       ├── models/            # Modelos MongoDB (Persona, Usuario, ColaConsulta, ResultadoMesa, Campana)
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
│       │   ├── common/        # Alert, Spinner, Toast, etc.
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
| POST | `/api/v1/personas/importar` | Importar desde Excel (Admin/Coordinador) |
| GET | `/api/v1/personas/plantilla-importacion` | Descargar plantilla |
| GET | `/api/v1/personas/mesas` | Mesas de votacion |
| GET | `/api/v1/personas/mesas/detalle` | Personas por mesa |
| GET | `/api/v1/personas/export/csv` | Exportar CSV |
| GET | `/api/v1/personas/export/excel` | Exportar Excel |
| PUT | `/api/v1/personas/:id/asignar-lider` | Reasignar lider (Admin/Coordinador) |
| PUT | `/api/v1/personas/:id/campana` | Mover o compartir persona a otra campana |

### Campanas

| Metodo | Endpoint | Descripcion | Acceso |
|--------|----------|-------------|--------|
| GET | `/api/v1/campanas` | Listar campanas | Admin |
| POST | `/api/v1/campanas` | Crear campana | Admin |
| GET | `/api/v1/campanas/:id` | Obtener campana | Admin |
| PUT | `/api/v1/campanas/:id` | Actualizar campana | Admin |
| DELETE | `/api/v1/campanas/:id` | Eliminar campana | Admin |
| GET | `/api/v1/campanas/:id/estadisticas` | Estadisticas de campana | Admin |
| GET | `/api/v1/campanas/mis-campanas` | Campanas del usuario con stats | Todos los roles |

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

### Resultados E-14

| Metodo | Endpoint | Descripcion | Acceso |
|--------|----------|-------------|--------|
| POST | `/api/v1/e14/resultados` | Crear/actualizar resultado de mesa (upsert) | Admin, Coordinador |
| GET | `/api/v1/e14/resultados` | Listar resultados con filtros (municipio, zona, candidato) | Todos |
| PUT | `/api/v1/e14/resultados/:id` | Actualizar resultado por ID | Admin, Coordinador |
| DELETE | `/api/v1/e14/resultados/:id` | Eliminar resultado por ID | Admin |
| DELETE | `/api/v1/e14/resultados` | Eliminar todos los resultados de la campana | Admin, Coordinador |
| GET | `/api/v1/e14/analisis` | Analisis cruzado mesas x personas | Todos |
| GET | `/api/v1/e14/resumen` | Tarjetas resumen general | Todos |
| GET | `/api/v1/e14/resultados/:id/seguidores` | Personas registradas en una mesa | Todos |
| POST | `/api/v1/e14/importar-excel` | Importar resultados desde Excel (.xlsx) | Admin, Coordinador, Lider |
| POST | `/api/v1/e14/verificar-votos` | Verificar cumplimiento cruzando E-14 x Personas | Admin, Coordinador, Lider |
| GET | `/api/v1/e14/mis-personas` | Personas del lider con estadoVoto calculado | Todos |
| GET | `/api/v1/e14/exportar-informe` | Descargar informe Excel (`?tipo=personas\|resumen&liderId=`) | Todos |
| GET | `/api/v1/e14/verificar-puestos` | Cobertura de puestos: Personas vs ResultadoMesa | Admin, Coordinador |

### Usuarios (Admin/Coordinador)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/usuarios` | Listar usuarios (`?search=nombre`) |
| POST | `/api/v1/usuarios` | Crear usuario |
| GET | `/api/v1/usuarios/:id` | Obtener usuario por ID |
| PUT | `/api/v1/usuarios/:id` | Actualizar usuario |
| DELETE | `/api/v1/usuarios/:id` | Eliminar usuario |
| PATCH | `/api/v1/usuarios/:id/toggle-estado` | Activar/desactivar usuario |
| GET | `/api/v1/usuarios/:id/estadisticas` | Estadisticas del usuario |

## Roles de Usuario

### ADMIN
- Gestion completa de usuarios y campanas (ve TODOS los usuarios sin excepcion)
- Importacion masiva de personas desde Excel
- Control del worker RPA y operaciones masivas
- Gestion de errores (reintentar/eliminar)
- Acceso a estadisticas globales
- Eliminacion de cualquier registro
- Asignacion de multiples campanas a Coordinadores
- Modulo E-14: acceso total (importar, verificar, limpiar, exportar, vista por lider)

### COORDINADOR
- Gestion de usuarios de su campana (crear, editar, desactivar lideres)
- Puede ser asignado a multiples campanas; gestiona cada una de forma independiente desde el Dashboard
- Eliminacion de personas
- Modulo E-14: importar Excel/PDFs, verificar votos, limpiar resultados, exportar informes
- Vista por Lider: ver personas de cualquier lider con estado de voto y descargar informe filtrado
- No tiene acceso al worker RPA ni operaciones masivas

### LIDER
- Consulta y gestion de sus propias personas
- Cambio de estado de contacto
- Exportacion de datos (Excel/CSV)
- Modulo E-14: vista de sus personas con estado de voto, descarga de informe propio
- Importacion de resultados E-14 desde Excel o PDFs
- Mover o compartir personas entre sus campanas asignadas
- Puede pertenecer a multiples campanas y cambiar la campana activa desde el Dashboard

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
6. Navegar a wsp.registraduria.gov.co/censo/consultar
          │
7. Llenar formulario NUIP/cedula
          │
8. Resolver reCAPTCHA v2 (2Captcha API o modo manual)
          │
9. Extraer datos electorales (depto, municipio, puesto, mesa)
          │
10. Actualizar Persona en base de datos
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
