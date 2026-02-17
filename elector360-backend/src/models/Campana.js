const mongoose = require('mongoose');

const campanaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true
  },
  descripcion: String,
  tipo: {
    type: String,
    enum: ['ALCALDIA', 'CONCEJO', 'GOBERNACION', 'ASAMBLEA', 'CAMARA', 'SENADO', 'OTRO'],
    default: 'OTRO'
  },
  candidato: {
    nombres: String,
    apellidos: String,
    partido: String
  },
  estado: {
    type: String,
    enum: ['ACTIVA', 'INACTIVA', 'FINALIZADA'],
    default: 'ACTIVA'
  }
}, {
  timestamps: true
});

campanaSchema.index({ estado: 1 });

module.exports = mongoose.model('Campana', campanaSchema);
