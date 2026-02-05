# Elector360

Sistema de gestión electoral para el seguimiento y administración de votantes. Permite consultar información electoral de ciudadanos colombianos a través de la Registraduría Nacional, gestionar bases de datos de personas y realizar seguimiento por mesa de votación.

## Características Principales

- **Consulta de Votantes**: Búsqueda automática en la Registraduría Nacional mediante RPA (Robotic Process Automation)
- **Gestión de Personas**: CRUD completo de votantes con datos electorales
- **Organización por Mesas**: Visualización y filtrado por puesto y mesa de votación
- **Sistema de Usuarios**: Roles ADMIN y LIDER con permisos diferenciados
- **Panel de Administración**: Control del worker RPA, estadísticas y logs
- **Exportación de Datos**: Descarga de información en formato CSV

## Arquitectura

```
Elector360-proyecto/
├── elector360-backend/     # API REST con Node.js + Express
│   ├── src/
│   │   ├── controllers/    # Controladores de la API
│   │   ├── models/         # Modelos de MongoDB
│   │   ├── routes/         # Definición de rutas
│   │   ├── services/       # Lógica de negocio
│   │   ├── workers/        # RPA Worker con Puppeteer
│   │   ├── middleware/     # Autenticación y validación
│   │   └── validators/     # Validadores de request
│   └── tests/              # Tests unitarios e integración
│
└── elector360-frontend/    # SPA con React + Vite
    └── src/
        ├── components/     # Componentes reutilizables
        ├── pages/          # Páginas de la aplicación
        ├── services/       # Servicios API
        └── context/        # Context de autenticación
```

## Tecnologías

### Backend
- **Runtime**: Node.js v18+
- **Framework**: Express.js v4
- **Base de Datos**: MongoDB Atlas con Mongoose ODM
- **Autenticación**: JWT (JSON Web Tokens)
- **RPA**: Puppeteer + Puppeteer Stealth
- **Captcha**: 2Captcha API
- **Validación**: express-validator
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React 19 + Vite 7
- **Estilos**: Tailwind CSS 4
- **Routing**: React Router v7
- **HTTP Client**: Axios
- **Testing**: Vitest + Testing Library

## Requisitos Previos

- Node.js v18 o superior
- MongoDB Atlas (o instancia local)
- Cuenta en 2Captcha para resolver captchas
- Chrome/Chromium para Puppeteer

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/elector360-proyecto.git
cd elector360-proyecto
```

### 2. Configurar Backend

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

# 2Captcha
CAPTCHA_API_KEY=tu_api_key_de_2captcha

# Worker RPA
WORKER_POOL_SIZE=1
WORKER_POLL_INTERVAL=5000
```

### 3. Configurar Frontend

```bash
cd elector360-frontend
npm install
```

Crear archivo `.env`:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

## Ejecución

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

### Producción

Backend:
```bash
cd elector360-backend
npm start
```

Frontend:
```bash
cd elector360-frontend
npm run build
npm run preview
```

## Testing

### Backend
```bash
cd elector360-backend
npm test              # Todos los tests
npm run test:unit     # Solo unitarios
npm run test:integration  # Solo integración
```

### Frontend
```bash
cd elector360-frontend
npm test              # Tests en modo watch
npm run test:run      # Ejecutar una vez
npm run test:coverage # Con cobertura
```

## API Endpoints

La documentación completa de la API está disponible en:
- [README del Backend](./elector360-backend/README.md)
- [Colección de Postman](./elector360-backend/postman/Elector360.postman_collection.json)

### Resumen de Endpoints

| Módulo | Método | Endpoint | Descripción |
|--------|--------|----------|-------------|
| Auth | POST | `/api/v1/auth/login` | Iniciar sesión |
| Auth | POST | `/api/v1/auth/register` | Registrar usuario (Admin) |
| Auth | GET | `/api/v1/auth/me` | Obtener perfil actual |
| Personas | GET | `/api/v1/personas` | Listar personas |
| Personas | POST | `/api/v1/personas` | Crear persona |
| Personas | GET | `/api/v1/personas/mesas` | Obtener mesas de votación |
| Consultas | POST | `/api/v1/consultas/buscar` | Buscar persona (RPA) |
| Consultas | GET | `/api/v1/consultas/estado/:id` | Estado de consulta |
| Usuarios | GET | `/api/v1/usuarios` | Listar usuarios (Admin) |
| Worker | GET | `/api/v1/worker/stats` | Estadísticas RPA (Admin) |

## Roles de Usuario

### ADMIN
- Gestión completa de usuarios
- Control del worker RPA
- Acceso a estadísticas globales
- Eliminación de registros

### LIDER
- Consulta de votantes
- Gestión de su base de personas
- Exportación de datos
- Visualización por mesas

## Flujo de Consulta RPA

1. Usuario busca por cédula
2. Sistema verifica en base de datos local
3. Si no existe o está desactualizada, se encola consulta RPA
4. Worker procesa la cola con prioridades
5. Puppeteer navega a la Registraduría
6. 2Captcha resuelve el reCAPTCHA
7. Se extraen los datos electorales
8. Se actualiza la base de datos
9. Frontend recibe actualización via polling

## Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo [LICENSE](LICENSE) para más detalles.

## Soporte

Para reportar bugs o solicitar features, abrir un issue en el repositorio.
