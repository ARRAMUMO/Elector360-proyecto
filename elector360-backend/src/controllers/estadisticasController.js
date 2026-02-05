const asyncHandler = require('../utils/asyncHandler');
const Persona = require('../models/Persona');
const ColaConsulta = require('../models/ColaConsulta');
const HistorialCambio = require('../models/HistorialCambio');
const Usuario = require('../models/Usuario');

/**
 * @desc    Obtener estadísticas del dashboard
 * @route   GET /api/v1/estadisticas/dashboard
 * @access  Private
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const usuario = req.user;
  const esAdmin = usuario.rol === 'ADMIN';

  // Estadísticas base
  const filtro = esAdmin ? {} : { 'lider.id': usuario._id, confirmado: true };

  const [
    totalPersonas,
    personasActualizadas,
    personasPendientes,
    consultasHoy,
    cambiosRecientes,
    actividadReciente
  ] = await Promise.all([
    // Total personas
    Persona.countDocuments(filtro),

    // Personas actualizadas (últimos 6 meses)
    Persona.countDocuments({
      ...filtro,
      fechaUltimaConsulta: { 
        $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) 
      }
    }),

    // Personas pendientes de actualización
    Persona.countDocuments({
      ...filtro,
      $or: [
        { fechaUltimaConsulta: null },
        { 
          fechaUltimaConsulta: { 
            $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) 
          }
        }
      ]
    }),

    // Consultas hoy
    ColaConsulta.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }),

    // Cambios recientes (solo para ADMIN)
    esAdmin 
      ? HistorialCambio.find()
          .populate('personaId', 'documento nombres apellidos')
          .sort({ createdAt: -1 })
          .limit(5)
      : [],

    // Actividad reciente (últimas consultas)
    ColaConsulta.find({ estado: 'COMPLETADO' })
      .sort({ fechaProcesamiento: -1 })
      .limit(10)
      .select('documento estado fechaProcesamiento')
  ]);

  // Estadísticas RPA (solo ADMIN)
  let statsRPA = null;
  if (esAdmin) {
    const [enCola, procesandoHoy, erroresHoy] = await Promise.all([
      ColaConsulta.countDocuments({ estado: 'PENDIENTE' }),
      ColaConsulta.countDocuments({
        estado: 'COMPLETADO',
        fechaProcesamiento: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }),
      ColaConsulta.countDocuments({
        estado: 'ERROR',
        updatedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      })
    ]);

    // Calcular costo aproximado (simulado)
    const costoHoy = procesandoHoy * 0.003; // $0.003 por captcha

    statsRPA = {
      enCola,
      procesadasHoy: procesandoHoy,
      erroresHoy,
      costoHoy: costoHoy.toFixed(2),
      consultasEnProceso: await ColaConsulta.countDocuments({ estado: 'PROCESANDO' })
    };
  }

  res.json({
    success: true,
    data: {
      totalPersonas,
      personasActualizadas,
      personasPendientes,
      consultasHoy,
      porcentajeActualizadas: totalPersonas > 0 
        ? Math.round((personasActualizadas / totalPersonas) * 100) 
        : 0,
      cambiosRecientes,
      actividadReciente,
      statsRPA
    }
  });
});

/**
 * @desc    Obtener historial de consultas (para Dashboard)
 * @route   GET /api/v1/estadisticas/historial
 * @access  Private
 */
exports.getHistorialConsultas = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, estado } = req.query;

  const filtro = {};
  if (estado) {
    filtro.estado = estado;
  }

  const [consultas, total] = await Promise.all([
    ColaConsulta.find(filtro)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('documento estado prioridad intentos createdAt fechaProcesamiento'),
    
    ColaConsulta.countDocuments(filtro)
  ]);

  res.json({
    success: true,
    data: {
      consultas,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total
    }
  });
});

/**
 * @desc    Obtener estadísticas por departamento (solo ADMIN)
 * @route   GET /api/v1/estadisticas/por-departamento
 * @access  Private (ADMIN)
 */
exports.getEstadisticasPorDepartamento = asyncHandler(async (req, res) => {
  const stats = await Persona.aggregate([
    { 
      $match: { confirmado: true } 
    },
    {
      $group: {
        _id: '$puesto.departamento',
        total: { $sum: 1 },
        confirmados: {
          $sum: { $cond: [{ $eq: ['$estadoContacto', 'CONFIRMADO'] }, 1, 0] }
        },
        pendientes: {
          $sum: { $cond: [{ $eq: ['$estadoContacto', 'PENDIENTE'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  res.json({
    success: true,
    data: stats
  });
});