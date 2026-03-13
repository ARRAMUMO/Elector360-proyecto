const mongoose = require('mongoose');

const resultadoMesaSchema = new mongoose.Schema({
  campana: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campana',
    required: true
  },

  // Identificación de mesa (mismos campos que Persona.puesto)
  departamento: { type: String, trim: true },
  municipio: { type: String, trim: true },
  zona: { type: String, trim: true },
  nombrePuesto: { type: String, trim: true },
  mesa: { type: String, trim: true },

  // Candidato rastreado
  candidatoNumero: { type: String, trim: true }, // ej: "102"
  candidatoNombre: { type: String, trim: true },
  partido: { type: String, trim: true },

  // Resultados del E-14
  votosObtenidos: { type: Number, default: 0 },
  votosLista: { type: Number, default: 0 },     // votos solo por la lista
  totalVotantes: { type: Number, default: 0 },   // total votos en urna
  potencialVotacion: { type: Number, default: 0 }, // inscritos formulario E-11

  // Metadata
  fechaEleccion: { type: Date },
  notas: { type: String, trim: true }
}, {
  timestamps: true
});

// Índice único: departamento+municipio+zona+puesto+mesa+candidato por campaña
// - nombrePuesto: distintos puestos en la misma zona pueden tener el mismo número de mesa
// - departamento: distintos municipios con el mismo nombre existen en diferentes departamentos
resultadoMesaSchema.index(
  { campana: 1, departamento: 1, municipio: 1, zona: 1, nombrePuesto: 1, mesa: 1, candidatoNumero: 1 },
  { unique: true }
);
resultadoMesaSchema.index({ campana: 1 });
resultadoMesaSchema.index({ campana: 1, municipio: 1 });

module.exports = mongoose.model('ResultadoMesa', resultadoMesaSchema);
