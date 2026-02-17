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
  const esCoordinador = usuario.rol === 'COORDINADOR';

  // Estadísticas base con scope de campaña
  let filtro;
  if (esAdmin) {
    filtro = { ...req.campanaFilter };
  } else if (esCoordinador) {
    filtro = { ...req.campanaFilter };
  } else {
    filtro = { 'lider.id': usuario._id, confirmado: true, ...req.campanaFilter };
  }

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
      ...req.campanaFilter,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }),

    // Cambios recientes (solo para ADMIN/COORDINADOR)
    (esAdmin || esCoordinador)
      ? HistorialCambio.find(req.campanaFilter)
          .populate('personaId', 'documento nombres apellidos')
          .sort({ createdAt: -1 })
          .limit(5)
      : [],

    // Actividad reciente (últimas consultas)
    ColaConsulta.find({ estado: 'COMPLETADO', ...req.campanaFilter })
      .sort({ fechaProcesamiento: -1 })
      .limit(10)
      .select('documento estado fechaProcesamiento')
  ]);

  // Estadísticas RPA (ADMIN y COORDINADOR)
  let statsRPA = null;
  if (esAdmin || esCoordinador) {
    const [enCola, procesandoHoy, erroresHoy] = await Promise.all([
      ColaConsulta.countDocuments({ estado: 'PENDIENTE', ...req.campanaFilter }),
      ColaConsulta.countDocuments({
        estado: 'COMPLETADO',
        ...req.campanaFilter,
        fechaProcesamiento: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }),
      ColaConsulta.countDocuments({
        estado: 'ERROR',
        ...req.campanaFilter,
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
      consultasEnProceso: await ColaConsulta.countDocuments({ estado: 'PROCESANDO', ...req.campanaFilter })
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

  const filtro = { ...req.campanaFilter };
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
  const matchFilter = { confirmado: true, ...req.campanaFilter };
  // Convertir campana string a ObjectId para aggregate
  if (matchFilter.campana && typeof matchFilter.campana === 'string') {
    const mongoose = require('mongoose');
    matchFilter.campana = new mongoose.Types.ObjectId(matchFilter.campana);
  }
  const stats = await Persona.aggregate([
    {
      $match: matchFilter
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