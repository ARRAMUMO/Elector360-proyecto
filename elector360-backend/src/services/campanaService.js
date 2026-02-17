const Campana = require('../models/Campana');
const Usuario = require('../models/Usuario');
const Persona = require('../models/Persona');
const ApiError = require('../utils/ApiError');

class CampanaService {
  async listarCampanas(opciones = {}) {
    const { page = 1, limit = 50, search, estado } = opciones;
    const query = {};

    if (search) {
      query.$or = [
        { nombre: new RegExp(search, 'i') },
        { 'candidato.nombres': new RegExp(search, 'i') },
        { 'candidato.apellidos': new RegExp(search, 'i') }
      ];
    }
    if (estado) query.estado = estado;

    const [campanas, total] = await Promise.all([
      Campana.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      Campana.countDocuments(query)
    ]);

    // Agregar conteos por campaña
    const campanasConStats = await Promise.all(
      campanas.map(async (c) => {
        const [totalPersonas, totalUsuarios] = await Promise.all([
          Persona.countDocuments({ campana: c._id }),
          Usuario.countDocuments({ campana: c._id })
        ]);
        return { ...c.toObject(), totalPersonas, totalUsuarios };
      })
    );

    return {
      campanas: campanasConStats,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    };
  }

  async obtenerPorId(id) {
    const campana = await Campana.findById(id);
    if (!campana) {
      throw new ApiError(404, 'Campaña no encontrada');
    }
    return campana;
  }

  async crearCampana(datos) {
    const campana = await Campana.create(datos);
    return campana;
  }

  async actualizarCampana(id, datos) {
    const campana = await Campana.findById(id);
    if (!campana) {
      throw new ApiError(404, 'Campaña no encontrada');
    }

    const camposPermitidos = ['nombre', 'descripcion', 'tipo', 'candidato', 'estado'];
    camposPermitidos.forEach(campo => {
      if (datos[campo] !== undefined) {
        campana[campo] = datos[campo];
      }
    });

    await campana.save();
    return campana;
  }

  async eliminarCampana(id) {
    const campana = await Campana.findById(id);
    if (!campana) {
      throw new ApiError(404, 'Campaña no encontrada');
    }

    // No eliminar, solo marcar como finalizada
    campana.estado = 'FINALIZADA';
    await campana.save();

    return { message: 'Campaña finalizada exitosamente' };
  }

  async obtenerEstadisticas(campanaId) {
    const campana = await Campana.findById(campanaId);
    if (!campana) {
      throw new ApiError(404, 'Campaña no encontrada');
    }

    const filtro = { campana: campanaId };

    const [totalPersonas, totalUsuarios, confirmadas, pendientes, noContactadas, coordinadores, lideres] = await Promise.all([
      Persona.countDocuments(filtro),
      Usuario.countDocuments({ campana: campanaId }),
      Persona.countDocuments({ ...filtro, estadoContacto: 'CONFIRMADO' }),
      Persona.countDocuments({ ...filtro, estadoContacto: 'PENDIENTE' }),
      Persona.countDocuments({ ...filtro, estadoContacto: 'NO_CONTACTADO' }),
      Usuario.countDocuments({ campana: campanaId, rol: 'COORDINADOR' }),
      Usuario.countDocuments({ campana: campanaId, rol: 'LIDER' })
    ]);

    return {
      campana,
      totalPersonas,
      totalUsuarios,
      coordinadores,
      lideres,
      confirmadas,
      pendientes,
      noContactadas
    };
  }
}

module.exports = new CampanaService();
