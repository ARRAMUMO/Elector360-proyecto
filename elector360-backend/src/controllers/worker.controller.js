// src/controllers/worker.controller.js

const rpaWorker = require('../workers/main.worker');
const ConsultaRPA = require('../models/consultaRPA.model');

/**
 * Obtener estadísticas del worker
 */
exports.getStats = async (req, res) => {
  try {
    const stats = rpaWorker.getStats();
    
    if (!stats) {
      return res.status(503).json({
        success: false,
        error: 'Worker no está iniciado'
      });
    }
    
    // Estadísticas adicionales de MongoDB
    const consultaStats = await ConsultaRPA.aggregate([
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const estadosPorTipo = {};
    consultaStats.forEach(item => {
      estadosPorTipo[item._id] = item.count;
    });
    
    res.json({
      success: true,
      data: {
        worker: stats,
        cola: estadosPorTipo
      }
    });
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener estado del circuit breaker
 */
exports.getCircuitBreakerStatus = async (req, res) => {
  try {
    const stats = rpaWorker.getStats();
    
    if (!stats || !stats.circuitBreaker) {
      return res.status(503).json({
        success: false,
        error: 'Worker no está iniciado'
      });
    }
    
    res.json({
      success: true,
      data: stats.circuitBreaker
    });
  } catch (error) {
    console.error('Error obteniendo circuit breaker status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Pausar worker
 */
exports.pauseWorker = async (req, res) => {
  try {
    await rpaWorker.stop();
    
    res.json({
      success: true,
      message: 'Worker pausado exitosamente'
    });
  } catch (error) {
    console.error('Error pausando worker:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Reanudar worker
 */
exports.resumeWorker = async (req, res) => {
  try {
    await rpaWorker.start();
    
    res.json({
      success: true,
      message: 'Worker reanudado exitosamente'
    });
  } catch (error) {
    console.error('Error reanudando worker:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Reintentar consulta fallida
 */
exports.retryConsulta = async (req, res) => {
  try {
    const { consultaId } = req.params;
    
    const consulta = await ConsultaRPA.findById(consultaId);
    
    if (!consulta) {
      return res.status(404).json({
        success: false,
        error: 'Consulta no encontrada'
      });
    }
    
    // Resetear estado
    consulta.estado = 'EN_COLA';
    consulta.error = null;
    consulta.intentos = 0;
    await consulta.save();
    
    res.json({
      success: true,
      message: 'Consulta reencolada',
      data: consulta
    });
  } catch (error) {
    console.error('Error reintentando consulta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Limpiar consultas antiguas
 */
exports.limpiarConsultasAntiguas = async (req, res) => {
  try {
    const { dias = 7 } = req.query;
    
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - parseInt(dias));
    
    const resultado = await ConsultaRPA.deleteMany({
      estado: { $in: ['COMPLETADO', 'ERROR'] },
      completadoEn: { $lt: fechaLimite }
    });
    
    res.json({
      success: true,
      message: `${resultado.deletedCount} consultas eliminadas`,
      data: {
        eliminadas: resultado.deletedCount,
        diasAntiguedad: parseInt(dias)
      }
    });
  } catch (error) {
    console.error('Error limpiando consultas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener logs recientes del worker
 */
exports.getLogs = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const consultas = await ConsultaRPA.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('usuario', 'email perfil.nombres perfil.apellidos')
      .select('documento estado error tiempoEjecucion costo createdAt completadoEn intentos');
    
    res.json({
      success: true,
      data: consultas
    });
  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Health check del worker
 */
exports.healthCheck = async (req, res) => {
  try {
    const stats = rpaWorker.getStats();
    
    const isHealthy = stats && stats.circuitBreaker.state !== 'OPEN';
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      data: {
        workerRunning: !!stats,
        circuitBreakerState: stats?.circuitBreaker?.state || 'unknown',
        activeWorkers: stats?.activeWorkers || 0
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
};