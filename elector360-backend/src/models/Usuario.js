const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const usuarioSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // No devolver password por defecto
  },
  rol: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.LIDER
  },
  campana: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campana',
    default: null
  },
  perfil: {
    nombres: {
      type: String,
      required: [true, 'Los nombres son requeridos'],
      trim: true
    },
    apellidos: {
      type: String,
      required: [true, 'Los apellidos son requeridos'],
      trim: true
    },
    telefono: {
      type: String,
      match: [/^3\d{9}$/, 'Teléfono debe tener 10 dígitos y comenzar con 3']
    },
    foto: String
  },
  stats: {
    personasRegistradas: {
      type: Number,
      default: 0
    },
    ultimaConsulta: Date,
    consultasRealizadas: {
      type: Number,
      default: 0
    }
  },
  estado: {
    type: String,
    enum: ['ACTIVO', 'INACTIVO'],
    default: 'ACTIVO'
  },
  ultimoLogin: Date
}, {
  timestamps: true
});

// Índices
usuarioSchema.index({ email: 1 });
usuarioSchema.index({ rol: 1 });
usuarioSchema.index({ campana: 1 });

// Encriptar password antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar passwords
usuarioSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para obtener JWT payload
usuarioSchema.methods.getJWTPayload = function() {
  return {
    id: this._id,
    email: this.email,
    rol: this.rol,
    campana: this.campana
  };
};

module.exports = mongoose.model('Usuario', usuarioSchema);