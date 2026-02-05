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

const workerRoutes = require('./src/routes/worker.routes');

const app = express();
const PORT = process.env.PORT || 8080;

// Conectar a MongoDB
connectDB();

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
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
app.use('/api', limiter);

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
// Registrar rutas
app.use('/api/v1/worker', workerRoutes);

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

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated');
  });
});

// Manejar cierre graceful
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando...');
  await rpaWorker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido, cerrando...');
  await rpaWorker.stop();
  process.exit(0);
});