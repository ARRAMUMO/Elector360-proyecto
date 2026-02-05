const mongoose = require('mongoose');

const consultaRPASchema = new mongoose.Schema({
  documento: {
    type: String,
    required: [true, 'El documento es requerido'],
    trim: true
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  persona: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Persona'
  },
  estado: {
    type: String,
    enum: ['EN_COLA', 'PROCESANDO', 'COMPLETADO', 'ERROR'],
    default: 'EN_COLA'
  },
  prioridad: {
    type: Number,
    default: 2,
    min: 1,
    max: 3
  },
  intentos: {
    type: Number,
    default: 0
  },
  datosPersona: {
    type: mongoose.Schema.Types.Mixed
  },
  error: String,
  completadoEn: Date,
  tiempoEjecucion: Number,
  costo: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índices
consultaRPASchema.index({ estado: 1, prioridad: -1, createdAt: 1 });
consultaRPASchema.index({ documento: 1 });
consultaRPASchema.index({ usuario: 1 });

module.exports = mongoose.model('ConsultaRPA', consultaRPASchema);
