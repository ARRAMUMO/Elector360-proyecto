# 🚀 Elector360 Backend API - VERSIÓN COMPLETA

Backend REST API para el sistema de gestión electoral Elector360, construido con Node.js, Express y MongoDB.

---

## ✨ Características Principales

### 🔐 Autenticación y Autorización
- ✅ JWT (JSON Web Tokens) sin Firebase
- ✅ Refresh tokens
- ✅ Sistema de roles (ADMIN, LIDER)
- ✅ Rutas protegidas por rol
- ✅ Encriptación de contraseñas con bcrypt

### 👥 Gestión de Personas
- ✅ CRUD completo
- ✅ Búsqueda avanzada
- ✅ Filtros por estado, departamento, municipio
- ✅ Paginación
- ✅ Exportar a CSV
- ✅ Asignación a líderes

### 🔍 Sistema de Consultas RPA
- ✅ Cola de consultas con prioridades automáticas
- ✅ Estados: PENDIENTE, PROCESANDO, COMPLETADO, ERROR
- ✅ Integración preparada para Worker RPA
- ✅ Detección automática de cambios
- ✅ Historial de cambios

### 📊 Estadísticas y Dashboard
- ✅ Estadísticas en tiempo real
- ✅ Métricas por líder
- ✅ Monitor RPA (admin)
- ✅ Historial de consultas
- ✅ Distribución por departamento

### 📦 **NUEVO: Operaciones Masivas**
- ✅ Actualizar toda la base de datos con un click
- ✅ Consultas masivas desde Excel
- ✅ Actualización masiva desde Excel
- ✅ Generación de reportes automáticos
- ✅ Monitor de progreso en tiempo real
- ✅ Plantillas Excel descargables

### 🛡️ Seguridad
- ✅ Helmet (headers de seguridad)
- ✅ Rate limiting
- ✅ CORS configurado
- ✅ Validación de datos (express-validator)
- ✅ Error handling centralizado

---

## 🛠️ Tecnologías

### Core
- **Node.js** v18+
- **Express** v4.18+
- **MongoDB** v6+ (Mongoose ODM)

### Autenticación
- **jsonwebtoken** - JWT tokens
- **bcryptjs** - Encriptación de contraseñas

### Upload y Excel
- **multer** - Upload de archivos
- **exceljs** - Lectura/escritura de Excel

### Validación y Seguridad
- **express-validator** - Validación de datos
- **helmet** - Headers de seguridad
- **cors** - Cross-Origin Resource Sharing
- **express-rate-limit** - Rate limiting

---

## 🚀 Instalación Rápida

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/elector360-backend.git
cd elector360-backend

# Instalar dependencias
npm install

# Configurar .env
cp .env.example .env
# Editar .env con tus configuraciones

# Iniciar
npm run dev
```

---

## 🌐 API Endpoints Completos

### Base URL
```
Development: http://localhost:8080/api/v1
Production: https://api.elector360.com/api/v1
```

---

## 📋 Endpoints Disponibles (41 total)

### 🔐 Autenticación (6 endpoints)

```http
POST   /auth/login                    # Login
POST   /auth/register                 # Registro (admin)
POST   /auth/refresh                  # Refresh token
GET    /auth/me                       # Usuario actual
POST   /auth/logout                   # Logout
PUT    /auth/change-password          # Cambiar contraseña
```

---

### 👥 Personas (7 endpoints)

```http
GET    /personas                      # Listar con filtros
GET    /personas/:id                  # Obtener por ID
GET    /personas/documento/:doc       # Buscar por cédula
POST   /personas                      # Crear persona
PUT    /personas/:id                  # Actualizar
DELETE /personas/:id                  # Eliminar (admin)
GET    /personas/export/csv           # Exportar CSV
```

**Ejemplo - Listar Personas:**
```http
GET /api/v1/personas?page=1&limit=50&search=juan&estadoContacto=CONFIRMADO

Headers:
Authorization: Bearer {token}
```

---

### 🔍 Consultas (4 endpoints)

```http
POST   /consultas/buscar              # Buscar/consultar persona
GET    /consultas/estado/:id          # Estado de consulta
POST   /consultas/confirmar/:id       # Confirmar y agregar
POST   /consultas/rpa/resultado       # Guardar resultado (worker)
```

**Ejemplo - Buscar Persona:**
```http
POST /api/v1/consultas/buscar

Headers:
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "documento": "1234567890"
}

Respuesta:
{
  "success": true,
  "data": {
    "encontrado": true,
    "enBD": true,
    "persona": { ... },
    "mensaje": "Persona encontrada en base de datos"
  }
}
```

---

### 📊 Estadísticas (3 endpoints)

```http
GET    /estadisticas/dashboard        # Stats dashboard
GET    /estadisticas/historial        # Historial consultas
GET    /estadisticas/por-departamento # Stats por depto (admin)
```

**Ejemplo - Dashboard:**
```http
GET /api/v1/estadisticas/dashboard

Headers:
Authorization: Bearer {token}

Respuesta:
{
  "success": true,
  "data": {
    "totalPersonas": 1234,
    "personasActualizadas": 956,
    "personasPendientes": 278,
    "consultasHoy": 45,
    "porcentajeActualizadas": 77,
    "statsRPA": {
      "enCola": 23,
      "procesadasHoy": 142,
      "costoHoy": "0.43"
    }
  }
}
```

---

### 👤 Usuarios - Solo Admin (6 endpoints)

```http
GET    /usuarios                      # Listar usuarios
GET    /usuarios/:id                  # Obtener usuario
POST   /usuarios                      # Crear usuario
PUT    /usuarios/:id                  # Actualizar
DELETE /usuarios/:id                  # Eliminar
PATCH  /usuarios/:id/toggle-estado   # Activar/desactivar
GET    /usuarios/:id/estadisticas     # Stats del usuario
```

---

### 📦 **NUEVO: Operaciones Masivas - Solo Admin (7 endpoints)**

#### 1. Actualizar Toda la Base de Datos

```http
POST /api/v1/masivas/actualizar-todo

Headers:
Authorization: Bearer {token}

Respuesta:
{
  "success": true,
  "message": "Actualización masiva iniciada",
  "data": {
    "total": 1500,
    "encoladas": 1450,
    "yaEnCola": 50,
    "errores": 0,
    "mensaje": "1450 personas encoladas para actualización"
  }
}
```

**⚠️ Importante:** Esta operación puede tomar horas dependiendo del tamaño de la BD.

---

#### 2. Consultar desde Excel

```http
POST /api/v1/masivas/consultar-excel

Headers:
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
file: archivo.xlsx (FormData)

Formato del Excel:
┌─────────────┐
│ Cédula      │
├─────────────┤
│ 1234567890  │
│ 9876543210  │
│ 5555555555  │
└─────────────┘

Respuesta:
{
  "success": true,
  "message": "Archivo procesado exitosamente",
  "data": {
    "total": 100,
    "encontradasEnBD": 45,
    "encoladas": 50,
    "yaEnCola": 3,
    "errores": 2,
    "detalles": {
      "encontradas": [
        {
          "fila": 2,
          "cedula": "1234567890",
          "nombre": "Juan Pérez",
          "lider": "María García"
        }
      ],
      "encoladas": [
        {
          "fila": 3,
          "cedula": "9876543210"
        }
      ]
    }
  }
}
```

**Flujo:**
1. Busca cada cédula en BD local
2. Si existe → retorna datos
3. Si no existe → encola para RPA
4. Retorna resumen completo

---

#### 3. Actualizar desde Excel

```http
POST /api/v1/masivas/actualizar-excel

Headers:
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
file: actualizacion.xlsx (FormData)

Formato del Excel:
┌────────────┬────────────┬─────────────────┬─────────────────┬────────────────┐
│ Cédula     │ Teléfono   │ Email           │ Estado Contacto │ Notas          │
├────────────┼────────────┼─────────────────┼─────────────────┼────────────────┤
│ 1234567890 │ 3001234567 │ juan@email.com  │ CONFIRMADO      │ Contactado OK  │
│ 9876543210 │ 3009876543 │ maria@email.com │ PENDIENTE       │ Llamar mañana  │
└────────────┴────────────┴─────────────────┴─────────────────┴────────────────┘

Respuesta:
{
  "success": true,
  "message": "Actualización masiva completada",
  "data": {
    "total": 50,
    "actualizadas": 45,
    "noEncontradas": 3,
    "errores": 2
  }
}
```

---

#### 4. Generar Reporte de Resultados

```http
POST /api/v1/masivas/generar-reporte

Headers:
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "resultados": {
    // Objeto completo retornado por consultar-excel
  }
}

Respuesta:
Archivo Excel descargable con:
- Hoja de resumen
- Detalles de encontradas
- Detalles de encoladas
- Detalles de errores
```

---

#### 5. Estado de Procesamiento Masivo

```http
GET /api/v1/masivas/estado

Headers:
Authorization: Bearer {token}

Respuesta:
{
  "success": true,
  "data": {
    "total": 1500,
    "pendientes": 200,
    "procesando": 10,
    "completadas": 1250,
    "errores": 40,
    "procesadas": 1290,
    "progreso": 86,
    "enProceso": true
  }
}
```

**Uso:** Hacer polling cada 10 segundos para mostrar barra de progreso.

---

#### 6. Limpiar Cola Antigua

```http
DELETE /api/v1/masivas/limpiar-cola?dias=7

Headers:
Authorization: Bearer {token}

Query Params:
- dias: Número de días de antigüedad (default: 7)

Respuesta:
{
  "success": true,
  "data": {
    "eliminadas": 350,
    "mensaje": "350 consultas antiguas eliminadas"
  }
}
```

---

#### 7. Descargar Plantilla Excel

```http
GET /api/v1/masivas/plantilla

Headers:
Authorization: Bearer {token}

Respuesta:
Archivo Excel con 3 hojas:
1. "Consultas" - Formato para consultas masivas
2. "Actualización" - Formato para actualizar personas
3. "Instrucciones" - Guía de uso completa
```

---

## 💻 Ejemplos de Código Frontend

### Ejemplo 1: Botón "Actualizar Toda la BD"

```javascript
// React Component
import { useState } from 'react';
import axios from 'axios';

function ActualizarTodoBD() {
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const handleActualizar = async () => {
    if (!confirm('¿Actualizar TODA la base de datos? Esto puede tomar horas.')) {
      return;
    }

    try {
      setLoading(true);

      // 1. Iniciar actualización
      const response = await axios.post('/api/v1/masivas/actualizar-todo', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`${response.data.data.encoladas} personas encoladas`);

      // 2. Polling del progreso cada 10 segundos
      const interval = setInterval(async () => {
        const estadoRes = await axios.get('/api/v1/masivas/estado', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const { progreso, enProceso } = estadoRes.data.data;
        setProgreso(progreso);

        if (!enProceso) {
          clearInterval(interval);
          setLoading(false);
          alert('¡Actualización completada!');
        }
      }, 10000);

    } catch (error) {
      console.error(error);
      alert('Error al iniciar actualización');
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Actualización Masiva</h3>
      <p>Actualizar todas las personas de la base de datos</p>
      
      <button 
        onClick={handleActualizar}
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? 'Procesando...' : 'Actualizar Toda la BD'}
      </button>

      {loading && (
        <div className="progress-bar">
          <div style={{ width: `${progreso}%` }}>{progreso}%</div>
        </div>
      )}
    </div>
  );
}

export default ActualizarTodoBD;
```

---

### Ejemplo 2: Upload de Excel para Consultas Masivas

```javascript
// React Component
import { useState } from 'react';
import axios from 'axios';

function ConsultasMasivas() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    // Validar que sea Excel
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Selecciona un archivo primero');
      return;
    }

    try {
      setLoading(true);

      // Crear FormData
      const formData = new FormData();
      formData.append('file', file);

      // Upload
      const response = await axios.post('/api/v1/masivas/consultar-excel', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setResultados(response.data.data);
      alert('Archivo procesado exitosamente');

    } catch (error) {
      console.error(error);
      alert('Error al procesar archivo: ' + error.response?.data?.error);
    } finally {
      setLoading(false);
    }
  };

  const descargarReporte = async () => {
    try {
      const response = await axios.post(
        '/api/v1/masivas/generar-reporte',
        { resultados },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Descargar archivo
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (error) {
      console.error(error);
      alert('Error al generar reporte');
    }
  };

  const descargarPlantilla = async () => {
    try {
      const response = await axios.get('/api/v1/masivas/plantilla', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_elector360.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (error) {
      console.error(error);
      alert('Error al descargar plantilla');
    }
  };

  return (
    <div className="card">
      <h3>Consultas Masivas desde Excel</h3>

      {/* Botón descargar plantilla */}
      <button onClick={descargarPlantilla} className="btn btn-secondary">
        📥 Descargar Plantilla Excel
      </button>

      {/* Upload */}
      <div className="upload-area">
        <input 
          type="file" 
          accept=".xlsx,.xls"
          onChange={handleFileChange}
        />
        
        {file && <p>Archivo: {file.name}</p>}

        <button 
          onClick={handleUpload}
          disabled={!file || loading}
          className="btn btn-primary"
        >
          {loading ? 'Procesando...' : 'Procesar Excel'}
        </button>
      </div>

      {/* Resultados */}
      {resultados && (
        <div className="resultados">
          <h4>Resultados</h4>
          <ul>
            <li>Total procesadas: {resultados.total}</li>
            <li>✅ Encontradas en BD: {resultados.encontradasEnBD}</li>
            <li>🔄 Encoladas para consulta: {resultados.encoladas}</li>
            <li>⏳ Ya en cola: {resultados.yaEnCola}</li>
            <li>❌ Errores: {resultados.errores}</li>
          </ul>

          <button onClick={descargarReporte} className="btn btn-success">
            📊 Descargar Reporte Detallado
          </button>
        </div>
      )}
    </div>
  );
}

export default ConsultasMasivas;
```

---

### Ejemplo 3: Monitor de Progreso en Tiempo Real

```javascript
// React Component con polling
import { useState, useEffect } from 'react';
import axios from 'axios';

function MonitorProgreso() {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar inicial
    cargarEstado();

    // Polling cada 10 segundos
    const interval = setInterval(cargarEstado, 10000);

    return () => clearInterval(interval);
  }, []);

  const cargarEstado = async () => {
    try {
      const response = await axios.get('/api/v1/masivas/estado', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEstado(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="monitor-card">
      <h3>Monitor de Procesamiento RPA</h3>

      {/* Barra de progreso */}
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ width: `${estado.progreso}%` }}
        >
          {estado.progreso}%
        </div>
      </div>

      {/* Métricas */}
      <div className="metricas-grid">
        <div className="metrica">
          <span className="label">Total</span>
          <span className="value">{estado.total}</span>
        </div>
        <div className="metrica">
          <span className="label">⏳ Pendientes</span>
          <span className="value">{estado.pendientes}</span>
        </div>
        <div className="metrica">
          <span className="label">🔄 Procesando</span>
          <span className="value">{estado.procesando}</span>
        </div>
        <div className="metrica">
          <span className="label">✅ Completadas</span>
          <span className="value">{estado.completadas}</span>
        </div>
        <div className="metrica">
          <span className="label">❌ Errores</span>
          <span className="value">{estado.errores}</span>
        </div>
      </div>

      {/* Estado */}
      <div className="estado-badge">
        {estado.enProceso ? (
          <span className="badge badge-warning">⏳ Procesando...</span>
        ) : (
          <span className="badge badge-success">✅ Completado</span>
        )}
      </div>
    </div>
  );
}

export default MonitorProgreso;
```

---

## 🎯 Flujos Completos de Uso

### Flujo 1: Actualización Completa de BD

```
1. Admin hace click en "Actualizar Toda la BD"
   ↓
2. Confirma la acción (modal)
   ↓
3. POST /masivas/actualizar-todo
   ↓
4. Backend encola todas las personas
   ↓
5. Frontend inicia polling cada 10s
   GET /masivas/estado
   ↓
6. Muestra barra de progreso
   ↓
7. Worker RPA procesa cola
   ↓
8. Cuando progreso = 100%, muestra "Completado"
```

---

### Flujo 2: Consultas Masivas desde Excel

```
1. Admin descarga plantilla
   GET /masivas/plantilla
   ↓
2. Admin llena Excel con cédulas
   ↓
3. Admin sube Excel
   POST /masivas/consultar-excel (FormData)
   ↓
4. Backend procesa archivo:
   - Lee cédulas
   - Busca en BD
   - Encola las que no existen
   ↓
5. Retorna resultados
   ↓
6. Admin descarga reporte detallado
   POST /masivas/generar-reporte
   ↓
7. Worker RPA procesa cédulas encoladas
   ↓
8. Admin puede consultar estado
   GET /masivas/estado
```

---

## 📊 Estimaciones de Tiempos

### Actualización Masiva

| Personas | Tiempo Estimado | Workers Recomendados |
|----------|----------------|---------------------|
| 1,000    | 30 min         | 5                   |
| 5,000    | 2.5 horas      | 10                  |
| 10,000   | 5 horas        | 20                  |
| 50,000   | 1 día          | 20                  |
| 100,000  | 2 días         | 20                  |

**Nota:** Con 20 workers paralelos, se procesan ~50 cédulas/min (3000/hora).

---

## 🛡️ Validaciones y Límites

### Upload de Archivos

- **Tamaño máximo:** 10MB
- **Formatos aceptados:** .xlsx, .xls
- **Validación:** Solo admin puede subir archivos

### Formato de Cédulas

- **Longitud:** 7-10 dígitos
- **Caracteres:** Solo números
- **Validación:** Se limpian espacios y caracteres especiales

### Rate Limiting

- **Operaciones masivas:** Sin rate limit (solo admin)
- **Endpoints normales:** 100 requests / 15 minutos

---

## 🔧 Configuración Adicional

### Variables de Entorno

Agregar al `.env`:

```env
# Uploads
MAX_FILE_SIZE=10485760  # 10MB en bytes
UPLOAD_DIR=./uploads
```

### Carpeta de Uploads

```bash
# Crear carpeta (se crea automáticamente)
mkdir uploads

# Agregar a .gitignore
echo "uploads/" >> .gitignore
echo "*.xlsx" >> .gitignore
echo "*.xls" >> .gitignore
```

---

## 📦 Dependencias Completas

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

---

## 🚀 Deploy

### Configuración Adicional para Producción

```javascript
// server.js
// Agregar después de helmet()

// Aumentar límite para uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

---

## 📞 Soporte

**Nuevas Funcionalidades:**
- Operaciones masivas: masivas@elector360.com
- Consultas técnicas: soporte@elector360.com

---

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE)

---

**Backend Completo con Operaciones Masivas - Versión 2.0** 🚀
