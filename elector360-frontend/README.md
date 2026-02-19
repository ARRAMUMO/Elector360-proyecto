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
│   ├── Toast.jsx           # Notificaciones tipo toast
│   ├── Navbar.jsx          # Barra de navegación
│   ├── Sidebar.jsx         # Menú lateral
│   └── ProtectedRoute.jsx  # Rutas protegidas
│
├── context/
│   ├── AuthContext.jsx     # Context de autenticación
│   └── ToastContext.jsx    # Context de notificaciones toast
│
├── hooks/
│   ├── useDebounce.js      # Hook para debounce
│   └── useToast.js         # Hook para notificaciones toast
│
├── pages/                  # Páginas de la aplicación
│   ├── Login.jsx           # Inicio de sesión
│   ├── Dashboard.jsx       # Panel principal
│   ├── Consulta.jsx        # Consulta de votantes con flujos de asignación
│   ├── Personas.jsx        # Gestión de personas (reclamar, reasignar, importar)
│   ├── Usuarios.jsx        # Administración de usuarios
│   ├── Campanas.jsx        # Gestión de campañas (ADMIN)
│   └── WorkerAdmin.jsx     # Control del RPA Worker
│
├── services/               # Servicios de API
│   ├── api.js              # Configuración de Axios (con retry 429)
│   ├── authService.js      # Servicio de autenticación
│   ├── personaService.js   # Servicio de personas + asignarLider
│   ├── consultaService.js  # Consultas RPA + confirmar/reclamar/registrarNueva
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
- Barra de progreso durante consulta
- **Tres flujos de asignación según el estado de la persona:**
  - **Agregar a Mi Base** (verde): persona sin líder asignado en esta campaña
  - **Agregar a mi lista** (naranja): persona asignada a otro líder → reclamar
  - **Agregar a mi lista** (azul): persona en otra campaña → crear registro en la campaña actual
- Errores del modal mostrados dentro del modal (no detrás de él)

### Personas (`/personas`)
- Lista de personas con filtros (departamento, mesa, estado, búsqueda)
- Paginación
- Formulario de creación/edición
- Menú de acciones por persona:
  - **Reclamar y Completar**: para personas sin líder (no confirmadas), permite completar datos y asignárselas
  - **Reasignar Líder**: visible para COORDINADOR y ADMIN, abre selector de líder
  - Editar, eliminar
- **Importar Excel**: disponible para todos los roles (LIDER, COORDINADOR, ADMIN)
- Exportar CSV / Excel
- Notificaciones toast para acciones

### Usuarios (`/usuarios`) - Solo ADMIN
- Gestión de usuarios del sistema
- Crear, editar, activar/desactivar usuarios
- Asignación de roles (ADMIN, COORDINADOR, LIDER)
- Asignación de campaña

### Campañas (`/campanas`) - Solo ADMIN
- Crear y gestionar campañas electorales
- Asignar coordinadores a campañas

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

// Confirmar y agregar persona (sin líder previo)
await consultaService.confirmarPersona(personaId, {
  nombres: 'Juan Carlos',
  apellidos: 'Pérez Gómez',
  telefono: '3001234567'
});

// Reclamar persona de otro líder (fuerza reasignación)
await consultaService.reclamarPersona(personaId, {
  nombres: 'Juan Carlos',
  telefono: '3001234567'
});

// Registrar persona nueva en esta campaña (viene de otra campaña)
await consultaService.registrarNuevaPersona('12345678', {
  nombres: 'Juan Carlos',
  apellidos: 'Pérez Gómez',
  puesto: { departamento: 'ATLANTICO', municipio: 'BARRANQUILLA', mesa: '5' }
});
```

### personaService (métodos adicionales)
```javascript
import personaService from './services/personaService';

// Reasignar líder de una persona (COORDINADOR/ADMIN)
await personaService.asignarLider(personaId, liderId);
```

## Flujo de Consulta RPA

1. Usuario ingresa número de cédula
2. Sistema busca en base de datos local (por campaña)
3. Según el resultado, se muestran diferentes opciones:
   - **Persona sin líder en esta campaña** → botón verde "Agregar a Mi Base"
   - **Persona de otro líder en esta campaña** → botón naranja "Agregar a mi lista" (reclamar)
   - **Persona de otra campaña (no en la actual)** → botón azul "Agregar a mi lista" (registrar nueva)
   - **Mi persona** → solo visualización con indicador "Mi Lista"
4. Si no existe en la Registraduría o datos desactualizados:
   - Se muestra indicador de carga
   - Se inicia polling al backend
   - Backend consulta Registraduría vía RPA
5. Al completarse:
   - Se muestran datos electorales actualizados
   - Aparecen los botones de acción según el caso

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

## Sistema de Notificaciones Toast

```jsx
import { useToast } from './hooks/useToast';

function MiComponente() {
  const { addToast } = useToast();

  const handleAccion = async () => {
    const result = await personaService.actualizar(id, datos);
    if (result.success) {
      addToast('Persona actualizada correctamente', 'success');
    } else {
      addToast(result.error, 'error');
    }
  };
}
```

## Context de Autenticación

```jsx
import { useAuth } from './context/AuthContext';

function MiComponente() {
  const { user, isAuthenticated, isAdmin, login, logout } = useAuth();
  // user.rol puede ser 'ADMIN', 'COORDINADOR' o 'LIDER'

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  const esAdmin = user?.rol === 'ADMIN';
  const esCoordi = user?.rol === 'COORDINADOR';

  return (
    <div>
      <h1>Hola, {user.perfil.nombres}</h1>
      {esAdmin && <AdminPanel />}
      {(esAdmin || esCoordi) && <ReasignarLider />}
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
