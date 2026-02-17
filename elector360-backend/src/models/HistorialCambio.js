const mongoose = require('mongoose');

const historialCambioSchema = new mongoose.Schema({
  personaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Persona',
    required: true
  },
  documento: String,
  cambios: [{
    campo: String,
    valorAnterior: mongoose.Schema.Types.Mixed,
    valorNuevo: mongoose.Schema.Types.Mixed,
    fecha: {
      type: Date,
      default: Date.now
    }
  }],
  detectadoPor: {
    type: String,
    enum: ['RPA_AUTOMATICO', 'USUARIO_MANUAL', 'IMPORTACION'],
    default: 'USUARIO_MANUAL'
  },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  campana: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campana'
  },
  notificado: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Índices
historialCambioSchema.index({ personaId: 1 });
historialCambioSchema.index({ createdAt: -1 });

module.exports = mongoose.model('HistorialCambio', historialCambioSchema);