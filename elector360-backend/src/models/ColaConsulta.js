const mongoose = require('mongoose');

const colaConsultaSchema = new mongoose.Schema({
  documento: {
    type: String,
    required: true
  },
  personaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Persona'
  },
  campana: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campana'
  },
  prioridad: {
    type: Number,
    default: 2,
    min: 1,
    max: 3
  },
  estado: {
    type: String,
    enum: ['PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR'],
    default: 'PENDIENTE'
  },
  intentos: {
    type: Number,
    default: 0
  },
  maximoIntentos: {
    type: Number,
    default: 3
  },
  ultimoError: String,
  fechaProcesamiento: Date,
  tiempoEjecucion: Number,
  resultado: mongoose.Schema.Types.Mixed,
  // ⭐ NUEVO: Para circuit breaker
  workerId: String,
  errorConsecutivos: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índices
colaConsultaSchema.index({ estado: 1, prioridad: 1 });
colaConsultaSchema.index({ documento: 1 });
colaConsultaSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ColaConsulta', colaConsultaSchema);