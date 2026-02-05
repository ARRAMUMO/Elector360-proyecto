# Crear Persona Manualmente

Tanto **Administradores** como **Líderes** pueden crear personas de forma manual en el sistema.

## Endpoint

```
POST /api/v1/personas
```

**Requiere autenticación**: Sí (Token JWT)
**Roles permitidos**: ADMIN, LIDER

## Funcionamiento

Cuando creas una persona manualmente:
- ✅ Se asigna automáticamente al líder/admin que la crea
- ✅ Se marca como `confirmado: true`
- ✅ Se marca como `origen: MANUAL`
- ✅ Se actualizan las estadísticas del usuario
- ✅ Se valida que no exista otra persona con la misma cédula

## Campos del Request

### Campos Requeridos

| Campo | Tipo | Descripción | Validación |
|-------|------|-------------|------------|
| `documento` | String | Cédula de la persona | 7-10 dígitos numéricos |

### Campos Opcionales

| Campo | Tipo | Descripción | Validación |
|-------|------|-------------|------------|
| `nombres` | String | Nombres de la persona | Texto no vacío |
| `apellidos` | String | Apellidos de la persona | Texto no vacío |
| `telefono` | String | Teléfono celular | 10 dígitos, inicia con 3 |
| `email` | String | Correo electrónico | Email válido |
| `fechaNacimiento` | Date | Fecha de nacimiento | Formato ISO 8601 |
| `lugarNacimiento` | Object | Lugar de nacimiento | Ver estructura abajo |
| `puesto` | Object | Información del puesto de votación | Ver estructura abajo |
| `estadoContacto` | String | Estado del contacto | PENDIENTE, CONFIRMADO, NO_CONTACTADO |
| `notas` | String | Notas adicionales | Texto libre |

### Estructura de `lugarNacimiento`

```json
{
  "departamento": "CUNDINAMARCA",
  "municipio": "BOGOTÁ"
}
```

### Estructura de `puesto`

```json
{
  "departamento": "CUNDINAMARCA",
  "municipio": "BOGOTÁ",
  "zona": "ZONA 1",
  "nombrePuesto": "ESCUELA CENTRAL",
  "direccion": "Calle 10 #5-25",
  "mesa": "001"
}
```

## Ejemplos de Uso

### Ejemplo 1: Crear persona con datos mínimos

```bash
curl -X POST http://localhost:8080/api/v1/personas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "documento": "1234567890"
  }'
```

### Ejemplo 2: Crear persona con datos completos

```bash
curl -X POST http://localhost:8080/api/v1/personas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "documento": "1234567890",
    "nombres": "Juan Carlos",
    "apellidos": "Rodríguez Pérez",
    "fechaNacimiento": "1990-05-15",
    "telefono": "3101234567",
    "email": "juan.rodriguez@example.com",
    "lugarNacimiento": {
      "departamento": "CUNDINAMARCA",
      "municipio": "BOGOTÁ"
    },
    "puesto": {
      "departamento": "CUNDINAMARCA",
      "municipio": "BOGOTÁ",
      "zona": "ZONA 1",
      "nombrePuesto": "ESCUELA CENTRAL",
      "direccion": "Calle 10 #5-25",
      "mesa": "001"
    },
    "estadoContacto": "PENDIENTE",
    "notas": "Contactado por teléfono el 15/01/2026"
  }'
```

### Ejemplo 3: Usando JavaScript (Fetch)

```javascript
const crearPersona = async () => {
  const token = localStorage.getItem('token'); // Tu token JWT

  const personaData = {
    documento: '1234567890',
    nombres: 'María',
    apellidos: 'González',
    telefono: '3209876543',
    email: 'maria.gonzalez@example.com',
    estadoContacto: 'PENDIENTE'
  };

  const response = await fetch('http://localhost:8080/api/v1/personas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(personaData)
  });

  const result = await response.json();

  if (result.success) {
    console.log('Persona creada:', result.data);
  } else {
    console.error('Error:', result.message);
  }
};
```

### Ejemplo 4: Usando Axios (React/Vue)

```javascript
import axios from 'axios';

const crearPersona = async (personaData) => {
  try {
    const response = await axios.post(
      'http://localhost:8080/api/v1/personas',
      personaData,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Persona creada:', response.data.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data?.message);
    throw error;
  }
};

// Uso
const nuevaPersona = {
  documento: '1234567890',
  nombres: 'Pedro',
  apellidos: 'Martínez',
  telefono: '3157894561',
  email: 'pedro.martinez@example.com'
};

crearPersona(nuevaPersona);
```

## Respuestas

### Éxito (201 Created)

```json
{
  "success": true,
  "message": "Persona creada exitosamente",
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "documento": "1234567890",
    "nombres": "Juan Carlos",
    "apellidos": "Rodríguez Pérez",
    "telefono": "3101234567",
    "email": "juan.rodriguez@example.com",
    "estadoContacto": "PENDIENTE",
    "lider": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "nombre": "Admin Test",
      "email": "admin@elector360.com"
    },
    "confirmado": true,
    "origen": "MANUAL",
    "estadoRPA": "NUEVO",
    "createdAt": "2026-01-30T12:00:00.000Z",
    "updatedAt": "2026-01-30T12:00:00.000Z"
  }
}
```

### Error: Cédula duplicada (400 Bad Request)

```json
{
  "success": false,
  "message": "Ya existe una persona con esta cédula"
}
```

### Error: Validación (400 Bad Request)

```json
{
  "success": false,
  "message": "Error de validación",
  "errors": [
    {
      "field": "documento",
      "message": "La cédula debe tener entre 7 y 10 dígitos"
    },
    {
      "field": "telefono",
      "message": "Teléfono debe tener 10 dígitos y comenzar con 3"
    }
  ]
}
```

### Error: No autenticado (401 Unauthorized)

```json
{
  "success": false,
  "message": "No estás autenticado"
}
```

## Diferencias entre ADMIN y LIDER

| Acción | ADMIN | LIDER |
|--------|-------|-------|
| Crear persona manualmente | ✅ | ✅ |
| Ver personas creadas por otros | ✅ | ❌ |
| Actualizar personas de otros | ✅ | ❌ |
| Eliminar personas | ✅ | ❌ |
| Ver todas las estadísticas | ✅ | ❌ (solo las suyas) |

**Nota importante**: Cuando un LIDER crea una persona, solo él podrá verla y editarla. Los ADMIN pueden ver y editar todas las personas del sistema.

## Flujo Completo

1. **Login** → Obtener token JWT
2. **Crear Persona** → POST /api/v1/personas
3. **Ver mis personas** → GET /api/v1/personas
4. **Actualizar persona** → PUT /api/v1/personas/:id
5. **Exportar a CSV** → GET /api/v1/personas/export/csv

## Validaciones Automáticas

El sistema valida automáticamente:
- ✅ Formato de cédula (7-10 dígitos)
- ✅ Formato de teléfono (10 dígitos, inicia con 3)
- ✅ Formato de email válido
- ✅ Cédula no duplicada
- ✅ Usuario autenticado

## Testing

Puedes probar la creación de personas usando:

```bash
# 1. Login para obtener token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@elector360.com",
    "password": "password123"
  }'

# 2. Guardar el accessToken de la respuesta

# 3. Crear persona
curl -X POST http://localhost:8080/api/v1/personas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "documento": "1234567890",
    "nombres": "Test",
    "apellidos": "Usuario",
    "telefono": "3001234567"
  }'
```

## Herramientas Recomendadas

- **Postman**: Para testing manual de la API
- **Thunder Client** (VS Code): Extensión para testing de APIs
- **curl**: Para testing desde terminal
- **Insomnia**: Cliente REST alternativo

## Soporte

Si encuentras problemas:
1. Verifica que el servidor esté corriendo: `npm start`
2. Verifica que tengas un token válido
3. Revisa los logs del servidor para errores
4. Verifica que los datos cumplan las validaciones
