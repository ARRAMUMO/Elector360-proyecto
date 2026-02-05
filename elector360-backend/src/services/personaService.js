const Persona = require('../models/Persona');
const ApiError = require('../utils/ApiError');

class PersonaService {
  /**
   * Listar personas con filtros y paginación
   */
  async listarPersonas(filtros, opciones) {
    const {
      page = 1,
      limit = 50,
      search,
      estadoContacto,
      estadoRPA,
      departamento,
      municipio,
      mesa,
      nombrePuesto,
      zona,
      liderId
    } = { ...filtros, ...opciones };

    // Construir query
    const query = {};

    // Filtro por líder (si es LIDER, solo ve sus personas)
    if (liderId) {
      query['lider.id'] = liderId;
      query.confirmado = true;
    }

    // Búsqueda por texto
    if (search) {
      query.$or = [
        { searchIndex: new RegExp(search, 'i') },
        { documento: new RegExp(search, 'i') },
        { telefono: new RegExp(search, 'i') }
      ];
    }

    // Filtros adicionales
    if (estadoContacto) query.estadoContacto = estadoContacto;
    if (estadoRPA) query.estadoRPA = estadoRPA;
    if (departamento) query['puesto.departamento'] = new RegExp(departamento, 'i');
    if (municipio) query['puesto.municipio'] = new RegExp(municipio, 'i');
    if (mesa) query['puesto.mesa'] = mesa;
    if (nombrePuesto) query['puesto.nombrePuesto'] = new RegExp(nombrePuesto, 'i');
    if (zona) query['puesto.zona'] = new RegExp(zona, 'i');

    // Ejecutar query con paginación
    const [personas, total] = await Promise.all([
      Persona.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-searchIndex'),
      
      Persona.countDocuments(query)
    ]);

    return {
      personas,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtener persona por ID
   */
  async obtenerPorId(id, usuarioId, rol) {
    const persona = await Persona.findById(id);

    if (!persona) {
      throw new ApiError(404, 'Persona no encontrada');
    }

    // Si es LIDER, verificar que sea su persona
    if (rol === 'LIDER' && persona.lider?.id?.toString() !== usuarioId.toString()) {
      throw new ApiError(403, 'No tienes permiso para ver esta persona');
    }

    return persona;
  }

  /**
   * Crear persona manualmente
   */
  async crearPersona(datosPersona, usuario) {
    // Verificar si ya existe
    const existente = await Persona.findOne({ documento: datosPersona.documento });

    if (existente) {
      throw new ApiError(400, 'Ya existe una persona con esta cédula');
    }

    // Asignar líder
    const persona = new Persona({
      ...datosPersona,
      lider: {
        id: usuario._id,
        nombre: `${usuario.perfil.nombres} ${usuario.perfil.apellidos}`,
        email: usuario.email
      },
      confirmado: true,
      origen: 'MANUAL'
    });

    await persona.save();

    // Actualizar stats del usuario
    const consultaService = require('./consultaService');
    await consultaService.actualizarStatsUsuario(usuario._id);

    return persona;
  }

  /**
   * Actualizar persona
   */
  async actualizarPersona(id, datosActualizacion, usuarioId, rol) {
    const persona = await Persona.findById(id);

    if (!persona) {
      throw new ApiError(404, 'Persona no encontrada');
    }

    // Si es LIDER, verificar que sea su persona
    if (rol === 'LIDER' && persona.lider?.id?.toString() !== usuarioId.toString()) {
      throw new ApiError(403, 'No tienes permiso para actualizar esta persona');
    }

    // Campos que se pueden actualizar (LIDER y ADMIN)
    const camposPermitidos = [
      'telefono',
      'email',
      'estadoContacto',
      'notas',
      'nombres',
      'apellidos',
      'puesto',
      'lugarNacimiento'
    ];

    // Actualizar solo campos permitidos
    camposPermitidos.forEach(campo => {
      if (datosActualizacion[campo] !== undefined) {
        persona[campo] = datosActualizacion[campo];
      }
    });

    await persona.save();

    return persona;
  }

  /**
   * Eliminar persona (solo ADMIN)
   */
  async eliminarPersona(id) {
    const persona = await Persona.findById(id);

    if (!persona) {
      throw new ApiError(404, 'Persona no encontrada');
    }

    await persona.deleteOne();

    // Actualizar stats del líder si tiene
    if (persona.lider?.id) {
      const consultaService = require('./consultaService');
      await consultaService.actualizarStatsUsuario(persona.lider.id);
    }

    return { message: 'Persona eliminada exitosamente' };
  }

  /**
   * Obtener personas por líder
   */
  async obtenerPorLider(liderId, opciones) {
    return this.listarPersonas({ liderId }, opciones);
  }

  /**
   * Obtener lista de mesas de votación con estadísticas
   */
  async obtenerMesasVotacion(filtros = {}) {
    const { liderId, departamento, municipio, nombrePuesto } = filtros;

    const matchStage = { 'puesto.mesa': { $exists: true, $ne: null, $ne: '' } };

    if (liderId) {
      matchStage['lider.id'] = liderId;
      matchStage.confirmado = true;
    }
    if (departamento) matchStage['puesto.departamento'] = new RegExp(departamento, 'i');
    if (municipio) matchStage['puesto.municipio'] = new RegExp(municipio, 'i');
    if (nombrePuesto) matchStage['puesto.nombrePuesto'] = new RegExp(nombrePuesto, 'i');

    const mesas = await Persona.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            departamento: '$puesto.departamento',
            municipio: '$puesto.municipio',
            nombrePuesto: '$puesto.nombrePuesto',
            direccion: '$puesto.direccion',
            mesa: '$puesto.mesa'
          },
          totalPersonas: { $sum: 1 },
          confirmados: {
            $sum: { $cond: [{ $eq: ['$estadoContacto', 'CONFIRMADO'] }, 1, 0] }
          },
          pendientes: {
            $sum: { $cond: [{ $eq: ['$estadoContacto', 'PENDIENTE'] }, 1, 0] }
          },
          noContactados: {
            $sum: { $cond: [{ $eq: ['$estadoContacto', 'NO_CONTACTADO'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          departamento: '$_id.departamento',
          municipio: '$_id.municipio',
          nombrePuesto: '$_id.nombrePuesto',
          direccion: '$_id.direccion',
          mesa: '$_id.mesa',
          totalPersonas: 1,
          confirmados: 1,
          pendientes: 1,
          noContactados: 1
        }
      },
      { $sort: { departamento: 1, municipio: 1, nombrePuesto: 1, mesa: 1 } }
    ]);

    return mesas;
  }

  /**
   * Obtener personas por mesa específica
   */
  async obtenerPersonasPorMesa(datosMesa, liderId = null) {
    const { departamento, municipio, nombrePuesto, mesa } = datosMesa;

    const query = {};

    if (departamento) query['puesto.departamento'] = new RegExp(departamento, 'i');
    if (municipio) query['puesto.municipio'] = new RegExp(municipio, 'i');
    if (nombrePuesto) query['puesto.nombrePuesto'] = new RegExp(nombrePuesto, 'i');
    if (mesa) query['puesto.mesa'] = mesa;

    if (liderId) {
      query['lider.id'] = liderId;
      query.confirmado = true;
    }

    const personas = await Persona.find(query)
      .sort({ apellidos: 1, nombres: 1 })
      .select('-searchIndex');

    return personas;
  }

  /**
   * Exportar personas a CSV (datos básicos)
   */
  async exportarCSV(filtros) {
    const { personas } = await this.listarPersonas(filtros, { limit: 10000 });

    const csv = [
      // Header
      'Documento,Nombres,Apellidos,Telefono,Email,Departamento,Municipio,Mesa,Estado Contacto',
      // Datos
      ...personas.map(p => 
        `${p.documento},"${p.nombres}","${p.apellidos}",${p.telefono || ''},${p.email || ''},${p.puesto?.departamento || ''},${p.puesto?.municipio || ''},${p.puesto?.mesa || ''},${p.estadoContacto}`
      )
    ].join('\n');

    return csv;
  }
}

module.exports = new PersonaService();