# Testing - Elector360 Backend

Documentación completa de la suite de tests del backend de Elector360.

## Estructura de Tests

```
tests/
├── setup.js                          # Setup global con MongoDB Memory Server
├── teardown.js                       # Cleanup global
├── helpers/
│   ├── testHelpers.js               # Helpers: crear usuarios, tokens, etc.
│   └── dbHelpers.js                 # Helpers de base de datos
├── integration/                      # Tests de integración (endpoints)
│   ├── auth.test.js                 # Tests de autenticación
│   └── persona.test.js              # Tests de personas
└── unit/                             # Tests unitarios
    ├── services/
    │   └── authService.test.js      # Tests del servicio de auth
    └── models/
        └── Usuario.test.js          # Tests del modelo Usuario
```

## Scripts Disponibles

### Ejecutar todos los tests con cobertura
```bash
npm test
```

### Ejecutar tests en modo watch (desarrollo)
```bash
npm run test:watch
```

### Ejecutar solo tests de integración
```bash
npm run test:integration
```

### Ejecutar solo tests unitarios
```bash
npm run test:unit
```

### Ejecutar tests con salida detallada
```bash
npm run test:verbose
```

## Tecnologías Utilizadas

- **Jest**: Framework de testing principal
- **Supertest**: Testing de endpoints HTTP
- **MongoDB Memory Server**: Base de datos en memoria para tests aislados
- **Dotenv**: Variables de entorno para testing

## Configuración

### Variables de Entorno de Test

El archivo [.env.test](../.env.test) contiene las variables necesarias para testing:

```env
NODE_ENV=test
JWT_SECRET=test_jwt_secret_key_123456
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
PORT=8081
CORS_ORIGIN=http://localhost:5173
```

### Configuración de Jest

Ver [jest.config.js](../jest.config.js) para la configuración completa.

## Tests de Integración

Los tests de integración verifican que los endpoints funcionen correctamente end-to-end.

### Auth Tests ([auth.test.js](integration/auth.test.js))

Cubre:
- ✅ Login (exitoso, credenciales inválidas, usuario inactivo)
- ✅ Registro (solo admin, validaciones)
- ✅ Refresh token (válido, inválido)
- ✅ Obtener usuario actual
- ✅ Cambio de contraseña
- ✅ Logout

### Persona Tests ([persona.test.js](integration/persona.test.js))

Cubre:
- ✅ Listar personas (paginación, filtros)
- ✅ Crear persona (validaciones, duplicados)
- ✅ Obtener persona (por ID, por documento)
- ✅ Actualizar persona
- ✅ Eliminar persona (solo admin)
- ✅ Exportar a CSV

## Tests Unitarios

Los tests unitarios verifican la lógica de negocio de forma aislada.

### AuthService Tests ([authService.test.js](unit/services/authService.test.js))

Cubre:
- ✅ Generación de tokens (access y refresh)
- ✅ Login (validaciones, estados)
- ✅ Registro (validaciones, duplicados)
- ✅ Refresh token (validaciones)
- ✅ Obtener usuario actual
- ✅ Cambio de contraseña

### Usuario Model Tests ([Usuario.test.js](unit/models/Usuario.test.js))

Cubre:
- ✅ Validaciones del schema (campos requeridos, formatos)
- ✅ Hash de contraseñas (pre-save hook)
- ✅ Método comparePassword
- ✅ Método getJWTPayload
- ✅ Comportamiento del campo password (select: false)
- ✅ Timestamps automáticos

## Helpers de Testing

### testHelpers.js

Funciones útiles para crear datos de prueba:

```javascript
const { createTestUser, createTestAdmin, generateAuthToken, createTestPersona } = require('./helpers/testHelpers');

// Crear usuario de prueba
const user = await createTestUser({ email: 'test@test.com' });

// Crear admin de prueba
const admin = await createTestAdmin();

// Generar token de autenticación
const token = generateAuthToken(user);

// Crear persona de prueba
const persona = await createTestPersona(user._id);
```

### dbHelpers.js

Funciones para manejo de base de datos en tests:

```javascript
const { clearDatabase, clearCollection, getCollectionCount } = require('./helpers/dbHelpers');

// Limpiar toda la base de datos
await clearDatabase();

// Limpiar una colección específica
await clearCollection('usuarios');

// Obtener conteo de documentos
const count = await getCollectionCount('personas');
```

## Escribir Nuevos Tests

### Test de Integración (Endpoint)

```javascript
const request = require('supertest');
const express = require('express');
const { createTestUser, generateAuthToken } = require('../helpers/testHelpers');

const app = express();
app.use(express.json());
app.use('/api/v1/endpoint', yourRoutes);

describe('Endpoint Tests', () => {
  let user, token;

  beforeEach(async () => {
    user = await createTestUser();
    token = generateAuthToken(user);
  });

  it('debe hacer algo', async () => {
    const response = await request(app)
      .get('/api/v1/endpoint')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### Test Unitario (Service)

```javascript
const yourService = require('../../../src/services/yourService');
const { createTestUser } = require('../../helpers/testHelpers');

describe('YourService Unit Tests', () => {
  describe('yourMethod', () => {
    it('debe hacer algo', async () => {
      const user = await createTestUser();
      const result = await yourService.yourMethod(user._id);

      expect(result).toBeTruthy();
      expect(result).toHaveProperty('someProperty');
    });
  });
});
```

## Buenas Prácticas

1. **Aislamiento**: Cada test debe ser independiente y no depender del orden de ejecución
2. **Cleanup**: El setup automático limpia la DB después de cada test
3. **Nombres descriptivos**: Los tests deben tener nombres claros que describan qué verifican
4. **Arrange-Act-Assert**: Estructura clara en cada test
   - Arrange: Preparar datos y configuración
   - Act: Ejecutar la acción a testear
   - Assert: Verificar resultados
5. **No hardcodear valores**: Usar helpers para crear datos de prueba
6. **Tests positivos y negativos**: Probar casos exitosos y casos de error

## Cobertura de Código

La cobertura actual del código se puede ver ejecutando:

```bash
npm test
```

Esto generará un reporte en la carpeta `coverage/` con detalles de qué líneas están cubiertas por tests.

### Objetivo de Cobertura

- **Target general**: >80%
- **Archivos críticos**: >90% (authService, authController, middleware/auth)

## Debugging Tests

### Ver salida detallada
```bash
npm run test:verbose
```

### Ejecutar un solo archivo de test
```bash
npx jest tests/integration/auth.test.js
```

### Ejecutar un solo test específico
```bash
npx jest -t "debe hacer login exitoso"
```

### Debugging con Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Problemas Comunes

### Tests que no terminan

Si los tests no terminan, puede ser por conexiones abiertas. El flag `--detectOpenHandles` ayuda a identificarlas.

### Timeouts

Si los tests fallan por timeout, puedes aumentar el límite en [jest.config.js](../jest.config.js):

```javascript
testTimeout: 30000, // 30 segundos
```

### MongoDB Memory Server lento

En la primera ejecución, MongoDB Memory Server descarga los binarios necesarios, lo cual puede tomar tiempo.

## Integración Continua (CI)

Para integrar estos tests en CI/CD, usa:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
```

Los tests son rápidos gracias a MongoDB Memory Server y no requieren servicios externos.

## Próximos Pasos

Tests pendientes por implementar:

- [ ] Tests de integración para Usuarios
- [ ] Tests de integración para Consultas
- [ ] Tests de integración para Estadísticas
- [ ] Tests de integración para Operaciones Masivas
- [ ] Tests unitarios para personaService
- [ ] Tests unitarios para usuarioService
- [ ] Tests unitarios para modelo Persona
- [ ] Tests de middleware (errorHandler, upload, validateRole)

## Recursos

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
