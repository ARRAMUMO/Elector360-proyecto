require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/database');
const errorHandler = require('./src/middleware/errorHandler');
const rpaWorker = require('./src/workers/main.worker');

// Importar rutas
const authRoutes = require('./src/routes/auth.routes');
const personaRoutes = require('./src/routes/persona.routes');
const usuarioRoutes = require('./src/routes/usuario.routes');
const consultaRoutes = require('./src/routes/consulta.routes');
const estadisticasRoutes = require('./src/routes/estadisticas.routes');
const operacionesMasivasRoutes = require('./src/routes/peracionesMasivas.routes');
const campanaRoutes = require('./src/routes/campana.routes');

const workerRoutes = require('./src/routes/worker.routes');
const e14Routes = require('./src/routes/e14.routes');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy (necesario detrás de Nginx/reverse proxy para rate limiting)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Conectar a MongoDB
connectDB();

// Rate limiting general (más permisivo)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Aumentado para polling
  message: { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }
});

// Rate limiter específico para polling de estado (muy permisivo)
const pollingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 120, // 120 requests por minuto (permite polling cada 0.5 segundos)
  message: { success: false, error: 'Demasiadas consultas de estado. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter para consultas RPA (más restrictivo)
const rpaLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // 20 consultas RPA por minuto
  message: { success: false, error: 'Límite de consultas RPA alcanzado. Espera un momento.' }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Aplicar rate limiters específicos antes del general
app.use('/api/v1/consultas/estado', pollingLimiter); // Polling de estado - muy permisivo
app.use('/api/v1/consultas/buscar', rpaLimiter); // Consultas RPA - restrictivo
app.use('/api/v1/consultas', rpaLimiter); // Crear consultas - restrictivo
app.use('/api', limiter); // General

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rutas API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/personas', personaRoutes);
app.use('/api/v1/usuarios', usuarioRoutes);
app.use('/api/v1/consultas', consultaRoutes);
app.use('/api/v1/estadisticas', estadisticasRoutes);
app.use('/api/v1/masivas', operacionesMasivasRoutes);
app.use('/api/v1/campanas', campanaRoutes);
app.use('/api/v1/worker', workerRoutes);
app.use('/api/v1/e14', e14Routes);

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Ruta no encontrada' 
  });
});

// Error handler (debe ser el último middleware)
app.use(errorHandler);

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🚀 ELECTOR360 API                  ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(20)}║
║   Port: ${PORT.toString().padEnd(29)}║
║   URL: http://localhost:${PORT.toString().padEnd(16)}║
║   MongoDB: ${process.env.MONGODB_URI ? '✅ Connected' : '❌ Not configured'.padEnd(22)}║
╚═══════════════════════════════════════╝
  `);

  // Iniciar RPA Worker
if (process.env.ENABLE_RPA_WORKER === 'true') {
  rpaWorker.start()
    .then(() => console.log('✅ RPA Worker iniciado'))
    .catch(error => console.error('❌ Error iniciando RPA Worker:', error));
}
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Cierre graceful: cerrar Chrome antes de que nodemon mate el proceso
async function gracefulShutdown(signal) {
  console.log(`${signal} recibido, cerrando Chrome y servidor...`);
  // Forzar salida si el shutdown tarda más de 8 segundos
  const forceExit = setTimeout(() => {
    console.log('⏰ Timeout de shutdown, forzando salida');
    process.exit(0);
  }, 8000);
  forceExit.unref();

  try {
    server.close();
    await rpaWorker.stop();
  } catch (e) {
    console.error('Error en shutdown:', e.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));