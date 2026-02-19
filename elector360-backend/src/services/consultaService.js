const Persona = require('../models/Persona');
const ConsultaRPA = require('../models/consultaRPA.model');
const ApiError = require('../utils/ApiError');

class ConsultaService {
  /**
   * Consultar persona por cedula
   * Prioridad automatica:
   * - ALTA (1): No existe en BD
   * - MEDIA (2): Existe pero desactualizada (>6 meses)
   * - BAJA (3): Consulta manual reciente
   */
  async consultarPorDocumento(documento, usuarioId, campanaId = null) {
    // 1. Buscar en BD local (dentro de la campaña)
    const filtroPersona = { documento };
    if (campanaId) filtroPersona.campana = campanaId;
    const personaExistente = await Persona.findOne(filtroPersona);

    // 1b. Buscar datos de votación globalmente (sin filtro de campaña)
    // Los datos de votación son los mismos para una cédula sin importar la campaña
    let datosVotacionGlobal = null;
    if (!personaExistente && campanaId) {
      const personaOtraCampana = await Persona.findOne({
        documento,
        'puesto.departamento': { $exists: true, $ne: null }
      });
      if (personaOtraCampana && personaOtraCampana.puesto) {
        datosVotacionGlobal = personaOtraCampana.puesto;
      }
    }

    if (personaExistente) {
      // Si la persona de esta campaña no tiene datos de votación, copiarlos de otra campaña
      if (!personaExistente.puesto?.departamento && !datosVotacionGlobal && campanaId) {
        const personaConPuesto = await Persona.findOne({
          documento,
          _id: { $ne: personaExistente._id },
          'puesto.departamento': { $exists: true, $ne: null }
        });
        if (personaConPuesto?.puesto) {
          personaExistente.puesto = personaConPuesto.puesto;
          personaExistente.estadoRPA = personaConPuesto.estadoRPA;
          personaExistente.fechaUltimaConsulta = personaConPuesto.fechaUltimaConsulta;
          await personaExistente.save();
        }
      }

      // Verificar si necesita actualizacion
      const necesitaActualizacion = this.necesitaActualizacion(personaExistente);

      if (necesitaActualizacion) {
        // Verificar si ya hay una consulta en proceso (global, no solo de esta campaña)
        const consultaExistente = await ConsultaRPA.findOne({
          documento,
          estado: { $in: ['EN_COLA', 'PROCESANDO'] }
        });

        if (consultaExistente) {
          return {
            encontrado: true,
            enBD: true,
            desactualizado: true,
            persona: personaExistente,
            enCola: true,
            consultaId: consultaExistente._id,
            estado: consultaExistente.estado,
            mensaje: 'Consulta ya en proceso. Espera un momento...'
          };
        }

        // Encolar con PRIORIDAD MEDIA (2)
        const consulta = await this.encolarConsulta(documento, usuarioId, 2, personaExistente._id, campanaId);

        return {
          encontrado: true,
          enBD: true,
          desactualizado: true,
          persona: personaExistente,
          enCola: true,
          consultaId: consulta._id,
          estado: consulta.estado,
          mensaje: 'Persona encontrada pero desactualizada. Consultando actualizaciones...'
        };
      }

      // Esta actualizado
      return {
        encontrado: true,
        enBD: true,
        desactualizado: false,
        persona: personaExistente,
        mensaje: 'Persona encontrada en base de datos'
      };
    }

    // 2. No existe en esta campaña, verificar si ya esta en cola (global)
    const enCola = await ConsultaRPA.findOne({
      documento,
      estado: { $in: ['EN_COLA', 'PROCESANDO'] }
    });

    if (enCola) {
      const resultado = {
        encontrado: false,
        enCola: true,
        estado: enCola.estado,
        consultaId: enCola._id,
        mensaje: 'Consulta en proceso. Espera un momento...'
      };
      // Incluir datos de votación de otra campaña si existen
      if (datosVotacionGlobal) {
        resultado.datosVotacion = datosVotacionGlobal;
        resultado.mensaje = 'Consulta en proceso. Mostrando datos de votacion existentes...';
      }
      return resultado;
    }

    // 3. No existe ni en BD ni en cola
    // Si hay datos de votación de otra campaña, no necesita RPA
    if (datosVotacionGlobal) {
      return {
        encontrado: false,
        enBD: false,
        datosVotacion: datosVotacionGlobal,
        mensaje: 'Persona no registrada en esta campana. Datos de votacion disponibles.'
      };
    }

    // Encolar con PRIORIDAD ALTA (1)
    const nuevaConsulta = await this.encolarConsulta(documento, usuarioId, 1, null, campanaId);

    return {
      encontrado: false,
      enCola: true,
      estado: 'EN_COLA',
      consultaId: nuevaConsulta._id,
      mensaje: 'Persona no encontrada. Consultando en Registraduria...'
    };
  }

  /**
   * Determinar si una persona necesita actualizacion
   * Criterios:
   * - No tiene fechaUltimaConsulta
   * - estadoRPA es 'NUEVO'
   * - Mas de 6 meses desde ultima consulta
   */
  necesitaActualizacion(persona) {
    // Si nunca se ha consultado
    if (!persona.fechaUltimaConsulta) {
      return true;
    }

    // Si el estado es NUEVO (nunca consultado en Registraduria)
    if (persona.estadoRPA === 'NUEVO') {
      return true;
    }

    // Si han pasado mas de 6 meses
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

    return persona.fechaUltimaConsulta < seisMesesAtras;
  }

  /**
   * Encolar consulta RPA
   * Prioridades:
   * 1 = ALTA (no existe en BD)
   * 2 = MEDIA (existe pero desactualizada)
   * 3 = BAJA (actualizacion programada)
   */
  async encolarConsulta(documento, usuarioId, prioridad = 2, personaId = null, campanaId = null) {
    const consulta = new ConsultaRPA({
      documento,
      usuario: usuarioId,
      persona: personaId,
      campana: campanaId,
      prioridad,
      estado: 'EN_COLA',
      intentos: 0
    });

    await consulta.save();

    console.log(`📋 Consulta encolada: ${documento} (prioridad: ${prioridad}, id: ${consulta._id})`);

    return consulta;
  }

  /**
   * Obtener estado de una consulta
   */
  async obtenerEstadoConsulta(consultaId) {
    const consulta = await ConsultaRPA.findById(consultaId);

    if (!consulta) {
      throw new ApiError(404, 'Consulta no encontrada');
    }

    const response = {
      _id: consulta._id,
      estado: consulta.estado,
      intentos: consulta.intentos,
      documento: consulta.documento,
      prioridad: consulta.prioridad,
      tiempoEjecucion: consulta.tiempoEjecucion
    };

    if (consulta.estado === 'COMPLETADO') {
      // Buscar la persona actualizada
      const persona = await Persona.findOne({ documento: consulta.documento });
      response.persona = persona;
      response.datosPersona = consulta.datosPersona;
      response.mensaje = 'Consulta completada exitosamente';
    } else if (consulta.estado === 'ERROR') {
      response.error = consulta.error;
      response.mensaje = consulta.error || 'Error en la consulta';
    } else if (consulta.estado === 'PROCESANDO') {
      response.mensaje = 'Consultando en Registraduria...';
    } else {
      response.mensaje = 'Consulta en cola, esperando procesamiento...';
    }

    return response;
  }

  /**
   * Guardar resultado de consulta RPA
   * Llamado por el Worker cuando termina
   */
  async guardarResultadoRPA(documento, datosRegistraduria) {
    // El RPA es global: actualizar TODAS las personas con este documento (en todas las campañas)
    const personas = await Persona.find({ documento });
    let personaPrincipal = null;
    let esNueva = false;

    const puestoData = {
      departamento: datosRegistraduria.datosElectorales?.departamento,
      municipio: datosRegistraduria.datosElectorales?.municipio,
      nombrePuesto: datosRegistraduria.datosElectorales?.puestoVotacion,
      direccion: datosRegistraduria.datosElectorales?.direccion,
      mesa: datosRegistraduria.datosElectorales?.mesa
    };

    if (personas.length > 0) {
      for (const persona of personas) {
        const cambios = this.detectarCambios(persona, datosRegistraduria);
        persona.puesto = puestoData;
        persona.estadoRPA = 'ACTUALIZADO';
        persona.fechaUltimaConsulta = new Date();
        persona.fechaSiguienteConsulta = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
        persona.intentosConsulta = 0;

        if (cambios.length > 0) {
          await this.guardarHistorialCambios(persona._id, documento, cambios, persona.campana);
        }
        await persona.save();
      }
      personaPrincipal = personas[0];
    } else {
      // No existe en ninguna campaña. Obtener la campaña de la consulta que la originó.
      // Buscar sin filtrar por estado para evitar timing issues (el estado puede cambiar antes de guardar)
      const consultaOrigen = await ConsultaRPA.findOne({ documento }).sort({ createdAt: -1 });

      esNueva = true;
      personaPrincipal = new Persona({
        documento,
        campana: consultaOrigen?.campana || null,
        puesto: puestoData,
        estadoRPA: 'ACTUALIZADO',
        fechaUltimaConsulta: new Date(),
        fechaSiguienteConsulta: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        origen: 'RPA_REGISTRADURIA',
        confirmado: false,
        intentosConsulta: 0
      });
      await personaPrincipal.save();
    }

    // Actualizar estado de la consulta en ConsultaRPA
    await ConsultaRPA.updateMany(
      { documento, estado: { $in: ['EN_COLA', 'PROCESANDO'] } },
      {
        estado: 'COMPLETADO',
        completadoEn: new Date(),
        persona: personaPrincipal._id,
        datosPersona: datosRegistraduria
      }
    );

    return { persona: personaPrincipal, esNueva };
  }

  /**
   * Detectar cambios entre datos actuales y nuevos
   */
  detectarCambios(personaActual, datosNuevos) {
    const cambios = [];
    const nuevoPuesto = datosNuevos.datosElectorales || {};

    // Comparar departamento
    if (personaActual.puesto?.departamento !== nuevoPuesto.departamento) {
      cambios.push({
        campo: 'puesto.departamento',
        valorAnterior: personaActual.puesto?.departamento,
        valorNuevo: nuevoPuesto.departamento
      });
    }

    // Comparar municipio
    if (personaActual.puesto?.municipio !== nuevoPuesto.municipio) {
      cambios.push({
        campo: 'puesto.municipio',
        valorAnterior: personaActual.puesto?.municipio,
        valorNuevo: nuevoPuesto.municipio
      });
    }

    // Comparar puesto
    if (personaActual.puesto?.nombrePuesto !== nuevoPuesto.puestoVotacion) {
      cambios.push({
        campo: 'puesto.nombrePuesto',
        valorAnterior: personaActual.puesto?.nombrePuesto,
        valorNuevo: nuevoPuesto.puestoVotacion
      });
    }

    // Comparar mesa
    if (personaActual.puesto?.mesa !== nuevoPuesto.mesa) {
      cambios.push({
        campo: 'puesto.mesa',
        valorAnterior: personaActual.puesto?.mesa,
        valorNuevo: nuevoPuesto.mesa
      });
    }

    return cambios;
  }

  /**
   * Guardar historial de cambios
   */
  async guardarHistorialCambios(personaId, documento, cambios, campanaId = null) {
    const HistorialCambio = require('../models/HistorialCambio');

    const historial = new HistorialCambio({
      personaId,
      documento,
      cambios,
      campana: campanaId,
      detectadoPor: 'RPA_AUTOMATICO',
      notificado: false
    });

    await historial.save();
  }

  /**
   * Confirmar y agregar persona a la base del lider
   */
  async confirmarYAgregarPersona(personaId, usuario, datosAdicionales = {}, campanaId = null) {
    const persona = await Persona.findById(personaId);

    if (!persona) {
      throw new ApiError(404, 'Persona no encontrada');
    }

    // Verificar scope de campaña
    // Personas RPA sin campaña (campana: null) pueden ser confirmadas por cualquier campaña
    if (campanaId && persona.campana && persona.campana.toString() !== campanaId.toString()) {
      throw new ApiError(403, 'No puedes confirmar personas de otra campaña');
    }
    // Si el stub RPA no tiene campaña, asignar la campaña del usuario
    if (campanaId && !persona.campana) {
      persona.campana = campanaId;
    }

    // Verificar si ya fue confirmada por otro lider
    if (persona.confirmado && persona.lider?.id?.toString() !== usuario._id.toString()) {
      throw new ApiError(400, 'Esta persona ya pertenece a otro lider');
    }

    // Asignar lider
    persona.lider = {
      id: usuario._id,
      nombre: `${usuario.perfil.nombres} ${usuario.perfil.apellidos}`,
      email: usuario.email
    };

    // Datos adicionales
    if (datosAdicionales.nombres) persona.nombres = datosAdicionales.nombres;
    if (datosAdicionales.apellidos) persona.apellidos = datosAdicionales.apellidos;
    if (datosAdicionales.telefono) persona.telefono = datosAdicionales.telefono;
    if (datosAdicionales.email) persona.email = datosAdicionales.email;
    if (datosAdicionales.estadoContacto) persona.estadoContacto = datosAdicionales.estadoContacto;
    if (datosAdicionales.notas) persona.notas = datosAdicionales.notas;

    // Actualizar datos de puesto de votación
    if (datosAdicionales.puesto) {
      persona.puesto = {
        ...persona.puesto,
        ...datosAdicionales.puesto
      };
    }

    persona.confirmado = true;

    await persona.save();

    // Actualizar stats del usuario
    await this.actualizarStatsUsuario(usuario._id);

    return persona;
  }

  /**
   * Reclamar persona para el usuario actual (fuerza reasignación aunque tenga otro líder)
   */
  async reclamarPersona(personaId, usuario, datosAdicionales = {}, campanaId = null) {
    const persona = await Persona.findById(personaId);

    if (!persona) {
      throw new ApiError(404, 'Persona no encontrada');
    }

    if (campanaId && persona.campana && persona.campana.toString() !== campanaId.toString()) {
      throw new ApiError(403, 'No puedes reclamar personas de otra campaña');
    }
    if (campanaId && !persona.campana) {
      persona.campana = campanaId;
    }

    const liderAnteriorId = persona.lider?.id;

    persona.lider = {
      id: usuario._id,
      nombre: `${usuario.perfil.nombres} ${usuario.perfil.apellidos}`,
      email: usuario.email
    };

    if (datosAdicionales.nombres) persona.nombres = datosAdicionales.nombres;
    if (datosAdicionales.apellidos) persona.apellidos = datosAdicionales.apellidos;
    if (datosAdicionales.telefono) persona.telefono = datosAdicionales.telefono;
    if (datosAdicionales.email) persona.email = datosAdicionales.email;
    if (datosAdicionales.estadoContacto) persona.estadoContacto = datosAdicionales.estadoContacto;
    if (datosAdicionales.notas) persona.notas = datosAdicionales.notas;
    if (datosAdicionales.puesto) {
      persona.puesto = { ...persona.puesto, ...datosAdicionales.puesto };
    }

    persona.confirmado = true;
    await persona.save();

    if (liderAnteriorId && liderAnteriorId.toString() !== usuario._id.toString()) {
      await this.actualizarStatsUsuario(liderAnteriorId);
    }
    await this.actualizarStatsUsuario(usuario._id);

    return persona;
  }

  /**
   * Registrar nueva persona en esta campaña (cuando viene de otra campaña o es nueva)
   */
  async registrarNuevaPersona(documento, usuario, datosAdicionales = {}, campanaId = null) {
    // Verificar que no exista ya en esta campaña
    const filtro = { documento };
    if (campanaId) filtro.campana = campanaId;
    const existente = await Persona.findOne(filtro);

    if (existente) {
      throw new ApiError(409, 'Esta persona ya existe en esta campaña');
    }

    // Obtener datos de votación de cualquier campaña
    const personaGlobal = await Persona.findOne({
      documento,
      'puesto.departamento': { $exists: true, $ne: null }
    });

    const nuevaPersona = new Persona({
      documento,
      ...(campanaId && { campana: campanaId }),
      nombres: datosAdicionales.nombres || undefined,
      apellidos: datosAdicionales.apellidos || undefined,
      telefono: datosAdicionales.telefono || undefined,
      email: datosAdicionales.email || undefined,
      notas: datosAdicionales.notas || undefined,
      lider: {
        id: usuario._id,
        nombre: `${usuario.perfil.nombres} ${usuario.perfil.apellidos}`,
        email: usuario.email
      },
      confirmado: true,
      puesto: datosAdicionales.puesto || personaGlobal?.puesto || {},
      estadoRPA: personaGlobal ? 'ACTUALIZADO' : 'NUEVO',
      origen: 'MANUAL'
    });

    try {
      await nuevaPersona.save();
    } catch (saveErr) {
      if (saveErr.code === 11000) {
        throw new ApiError(409, 'Esta persona ya fue registrada en esta campaña');
      }
      throw saveErr;
    }

    await this.actualizarStatsUsuario(usuario._id);

    return nuevaPersona;
  }

  /**
   * Actualizar estadisticas del usuario
   */
  async actualizarStatsUsuario(usuarioId) {
    const Usuario = require('../models/Usuario');

    const count = await Persona.countDocuments({
      'lider.id': usuarioId,
      confirmado: true
    });

    await Usuario.updateOne(
      { _id: usuarioId },
      {
        'stats.personasRegistradas': count,
        'stats.ultimaConsulta': new Date(),
        $inc: { 'stats.consultasRealizadas': 1 }
      }
    );
  }

  /**
   * Obtener historial de consultas del usuario
   */
  async obtenerHistorialUsuario(usuarioId, options = {}) {
    const { page = 1, limit = 20, estado } = options;

    const query = { usuario: usuarioId };
    if (estado) {
      query.estado = estado;
    }

    const consultas = await ConsultaRPA.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('persona', 'documento nombres apellidos puesto');

    const total = await ConsultaRPA.countDocuments(query);

    return {
      consultas,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Marcar consulta como error
   * (Llamado por el Worker cuando falla)
   */
  async marcarConsultaComoError(consultaId, mensajeError) {
    const consulta = await ConsultaRPA.findById(consultaId);

    if (!consulta) {
      throw new ApiError(404, 'Consulta no encontrada');
    }

    consulta.estado = 'ERROR';
    consulta.error = mensajeError;
    consulta.intentos += 1;
    consulta.completadoEn = new Date();

    await consulta.save();

    // Si es una persona existente, marcar como error
    if (consulta.persona) {
      await Persona.updateOne(
        { _id: consulta.persona },
        {
          estadoRPA: 'ERROR_CONSULTA',
          intentosConsulta: consulta.intentos
        }
      );
    }

    return consulta;
  }

  /**
   * Seleccionar personas para actualizacion automatica
   * (Llamado por el Scheduler)
   */
  async seleccionarParaActualizacionAutomatica(usuarioId, limite = 100) {
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

    // Buscar personas desactualizadas
    const personas = await Persona.find({
      estadoRPA: { $nin: ['ERROR_CONSULTA'] },
      $or: [
        { fechaUltimaConsulta: null },
        { fechaUltimaConsulta: { $lt: seisMesesAtras } },
        { estadoRPA: 'NUEVO' }
      ]
    })
      .limit(limite)
      .select('documento _id');

    // Encolar con prioridad BAJA (3)
    const consultas = [];
    for (const persona of personas) {
      // Verificar si ya esta en cola
      const yaEnCola = await ConsultaRPA.findOne({
        documento: persona.documento,
        estado: { $in: ['EN_COLA', 'PROCESANDO'] }
      });

      if (!yaEnCola) {
        const consulta = await this.encolarConsulta(persona.documento, usuarioId, 3, persona._id);
        consultas.push(consulta);
      }
    }

    return consultas;
  }
}

module.exports = new ConsultaService();
