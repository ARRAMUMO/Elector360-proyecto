# Elector360 Frontend

Interfaz de usuario para el sistema de gestión electoral Elector360. Aplicación SPA construida con React, Vite y Tailwind CSS.

## Tecnologías

- **React** 19 con Hooks
- **Vite** 7 como bundler
- **Tailwind CSS** 4 para estilos
- **React Router** v7 para navegación
- **Axios** para comunicación con API
- **Vitest** + Testing Library para tests

## Instalación

```bash
npm install
```

## Configuración

Crear archivo `.env` en la raíz:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

## Ejecución

```bash
# Desarrollo con hot-reload
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

La aplicación estará disponible en: http://localhost:5173

## Testing

```bash
npm test                    # Modo watch
npm run test:run            # Ejecutar una vez
npm run test:coverage       # Con cobertura
```

## Estructura del Proyecto

```
src/
├── components/             # Componentes reutilizables
│   ├── Alert.jsx           # Alertas y notificaciones
│   ├── Navbar.jsx          # Barra de navegación
│   ├── Sidebar.jsx         # Menú lateral
│   └── ProtectedRoute.jsx  # Rutas protegidas
│
├── context/
│   └── AuthContext.jsx     # Context de autenticación
│
├── hooks/
│   └── useDebounce.js      # Hook para debounce
│
├── pages/                  # Páginas de la aplicación
│   ├── Login.jsx           # Inicio de sesión
│   ├── Dashboard.jsx       # Panel principal
│   ├── Consulta.jsx        # Consulta de votantes
│   ├── Personas.jsx        # Gestión de personas
│   ├── Usuarios.jsx        # Administración de usuarios
│   └── WorkerAdmin.jsx     # Control del RPA Worker
│
├── services/               # Servicios de API
│   ├── api.js              # Configuración de Axios
│   ├── authService.js      # Servicio de autenticación
│   ├── personaService.js   # Servicio de personas
│   ├── consultaService.js  # Servicio de consultas RPA
│   └── usuarioService.js   # Servicio de usuarios
│
├── App.jsx                 # Componente principal
├── main.jsx                # Punto de entrada
└── index.css               # Estilos globales
```

## Páginas Principales

### Login (`/login`)
- Formulario de inicio de sesión
- Validación de credenciales
- Redirección automática post-login

### Dashboard (`/`)
- Estadísticas generales
- Resumen de actividad
- Accesos rápidos

### Consulta (`/consulta`)
- Búsqueda por número de cédula
- Consulta automática a Registraduría vía RPA
- Visualización de datos electorales
- Modal para agregar persona a base de datos
- Barra de progreso durante consulta

### Personas (`/personas`)
- Lista de personas con filtros
- Filtros por departamento, mesa, estado
- Paginación
- Formulario de creación/edición
- Vista de puesto de votación

### Usuarios (`/usuarios`) - Solo ADMIN
- Gestión de usuarios del sistema
- Crear, editar, activar/desactivar usuarios
- Asignación de roles

### Worker Admin (`/worker`) - Solo ADMIN
- Estadísticas del RPA Worker
- Control de pausa/reanudación
- Visualización de logs
- Estado del circuit breaker

## Servicios de API

### authService
```javascript
import authService from './services/authService';

// Login
const response = await authService.login(email, password);

// Obtener perfil
const profile = await authService.getMe();

// Logout
await authService.logout();
```

### personaService
```javascript
import personaService from './services/personaService';

// Listar con filtros
const response = await personaService.listar({
  page: 1,
  limit: 20,
  search: 'Juan',
  departamento: 'ATLANTICO',
  mesa: '5'
});

// Crear persona
await personaService.crear({
  documento: '12345678',
  nombres: 'Juan',
  apellidos: 'Pérez',
  puesto: {
    departamento: 'ATLANTICO',
    municipio: 'BARRANQUILLA',
    mesa: '5'
  }
});

// Obtener mesas de votación
const mesas = await personaService.obtenerMesas({
  departamento: 'ATLANTICO'
});
```

### consultaService
```javascript
import consultaService from './services/consultaService';

// Buscar persona (inicia RPA si es necesario)
const response = await consultaService.buscarPersona('12345678');

// Verificar estado de consulta RPA (polling)
const estado = await consultaService.obtenerEstado(consultaId);

// Confirmar y agregar persona
await consultaService.confirmarPersona(personaId, {
  nombres: 'Juan Carlos',
  apellidos: 'Pérez Gómez',
  telefono: '3001234567'
});
```

## Flujo de Consulta RPA

1. Usuario ingresa número de cédula
2. Sistema busca en base de datos local
3. Si no existe o está desactualizada:
   - Se muestra indicador de carga
   - Se inicia polling al backend
   - Backend consulta Registraduría vía RPA
4. Al completarse:
   - Se muestran datos electorales
   - Usuario puede agregar a su base

```jsx
// Ejemplo de implementación de polling
const [polling, setPolling] = useState(false);
const [progreso, setProgreso] = useState(0);

const iniciarPolling = async (consultaId) => {
  setPolling(true);

  const intervalo = setInterval(async () => {
    const estado = await consultaService.obtenerEstado(consultaId);

    if (estado.consulta.estado === 'COMPLETADO') {
      clearInterval(intervalo);
      setPolling(false);
      setResultado(estado.consulta.persona);
    }
  }, 3000);
};
```

## Context de Autenticación

```jsx
import { useAuth } from './context/AuthContext';

function MiComponente() {
  const { user, isAuthenticated, isAdmin, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <h1>Hola, {user.perfil.nombres}</h1>
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

## Rutas Protegidas

```jsx
// Ruta que requiere autenticación
<Route
  path="/personas"
  element={
    <ProtectedRoute>
      <Personas />
    </ProtectedRoute>
  }
/>

// Ruta que requiere rol ADMIN
<Route
  path="/usuarios"
  element={
    <ProtectedRoute requireAdmin>
      <Usuarios />
    </ProtectedRoute>
  }
/>
```

## Estilos con Tailwind

El proyecto usa Tailwind CSS 4. Los componentes usan clases de utilidad:

```jsx
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
  Consultar
</button>
```

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL base de la API | `http://localhost:8080/api/v1` |

## Build de Producción

```bash
# Crear build
npm run build

# El resultado estará en /dist
```

Los archivos de `/dist` pueden ser servidos por cualquier servidor estático (Nginx, Apache, Vercel, Netlify, etc.)

## Linting

```bash
npm run lint
```

## Licencia

MIT License
