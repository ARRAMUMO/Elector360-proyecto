const mongoose = require('mongoose');
const { ESTADO_CONTACTO, ESTADO_RPA } = require('../config/constants');

const personaSchema = new mongoose.Schema({
  documento: {
    type: String,
    required: [true, 'La cédula es requerida'],
    unique: true,
    trim: true,
    match: [/^\d{7,10}$/, 'Cédula debe tener entre 7 y 10 dígitos']
  },
  nombres: {
    type: String,
    trim: true
  },
  apellidos: {
    type: String,
    trim: true
  },
  fechaNacimiento: Date,
  
  // Lugar de nacimiento
  lugarNacimiento: {
    departamento: String,
    municipio: String
  },

  // Puesto de votación (de Registraduría)
  puesto: {
    departamento: String,
    municipio: String,
    zona: String,
    nombrePuesto: String,
    direccion: String,
    mesa: String
  },

  // Contacto (agregado por líder)
  telefono: {
    type: String,
    match: [/^3\d{9}$/, 'Teléfono debe tener 10 dígitos y comenzar con 3']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  estadoContacto: {
    type: String,
    enum: Object.values(ESTADO_CONTACTO),
    default: ESTADO_CONTACTO.NO_CONTACTADO
  },

  // Relación con líder (se asigna al guardar por primera vez)
  lider: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    nombre: String,
    email: String
  },

  // Estado RPA
  estadoRPA: {
    type: String,
    enum: Object.values(ESTADO_RPA),
    default: ESTADO_RPA.NUEVO
  },
  prioridad: {
    type: Number,
    default: 2,
    min: 1,
    max: 3
  },
  fechaUltimaConsulta: Date,
  fechaSiguienteConsulta: Date,
  intentosConsulta: {
    type: Number,
    default: 0
  },

  // Metadata
  origen: {
    type: String,
    enum: ['MANUAL', 'RPA_REGISTRADURIA', 'IMPORTACION'],
    default: 'RPA_REGISTRADURIA'
  },
  notas: String,
  
  // ⭐ NUEVO: Flag para saber si ya fue confirmado/guardado por un líder
  confirmado: {
    type: Boolean,
    default: false
  },

  // Índice de búsqueda
  searchIndex: String
}, {
  timestamps: true
});

// Índices
personaSchema.index({ documento: 1 }, { unique: true });
personaSchema.index({ 'lider.id': 1 });
personaSchema.index({ estadoRPA: 1 });
personaSchema.index({ estadoContacto: 1 });
personaSchema.index({ confirmado: 1 });
personaSchema.index({ searchIndex: 'text' });

// Crear índice de búsqueda antes de guardar
personaSchema.pre('save', function(next) {
  if (this.nombres && this.apellidos) {
    this.searchIndex = `${this.nombres} ${this.apellidos} ${this.documento}`.toLowerCase();
  } else {
    this.searchIndex = this.documento.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Persona', personaSchema);