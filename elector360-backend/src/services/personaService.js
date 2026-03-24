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
      liderId,
      campanaFilter
    } = { ...filtros, ...opciones };

    // Construir query con scope de campaña (excluir archivadas)
    const query = { ...campanaFilter, archivado: { $ne: true } };

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
  async obtenerPorId(id, usuarioId, rol, campanaId = null) {
    const persona = await Persona.findById(id);

    if (!persona) {
      throw new ApiError(404, 'Persona no encontrada');
    }

    // Verificar scope de campaña
    if (campanaId && persona.campana?.toString() !== campanaId.toString()) {
      throw new ApiError(403, 'No tienes permiso para ver esta persona');
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
  async crearPersona(datosPersona, usuario, campanaId = null) {
    // Verificar si ya existe en esta campaña
    const filtro = { documento: datosPersona.documento };
    if (campanaId) filtro.campana = campanaId;
    const existente = await Persona.findOne(filtro);

    if (existente) {
      throw new ApiError(400, 'Ya existe una persona con esta cédula en esta campaña');
    }

    // Asignar líder y campaña
    const persona = new Persona({
      ...datosPersona,
      campana: campanaId,
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
  async actualizarPersona(id, datosActualizacion, usuarioId, rol, campanaId = null) {
    const persona = await Persona.findById(id);

    if (!persona) {
      throw new ApiError(404, 'Persona no encontrada');
    }

    // Verificar scope de campaña
    if (campanaId && persona.campana?.toString() !== campanaId.toString()) {
      throw new ApiError(403, 'No tienes permiso para actualizar esta persona');
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
   * Mover o compartir persona a otra campaña
   * accion: 'MOVER' | 'COMPARTIR'
   */
  async cambiarCampana(id, campanaDestino, accion, usuarioId, rol) {
    const Usuario = require('../models/Usuario');
    const persona = await Persona.findById(id);
    if (!persona) throw new ApiError(404, 'Persona no encontrada');

    // LIDER solo puede operar sobre sus propias personas
    if (rol === 'LIDER' && persona.lider?.id?.toString() !== usuarioId.toString()) {
      throw new ApiError(403, 'No tienes permiso para modificar esta persona');
    }

    const destId = campanaDestino.toString();
    const liderId = persona.lider?.id;

    if (accion === 'MOVER') {
      // Quitar de campanas[] si estaba, cambiar campaña principal
      persona.campanas = (persona.campanas || []).filter(c => c.toString() !== destId);
      persona.campana = campanaDestino;
      // Actualizar campana principal del LIDER también
      if (liderId) {
        await Usuario.findByIdAndUpdate(liderId, {
          $set: { campana: campanaDestino },
          $addToSet: { campanas: campanaDestino }
        });
      }
    } else if (accion === 'COMPARTIR') {
      // Agregar a campanas[] si no está ya (ni es la principal)
      const yaEnPrincipal = persona.campana?.toString() === destId;
      const yaEnAliadas = (persona.campanas || []).some(c => c.toString() === destId);
      if (!yaEnPrincipal && !yaEnAliadas) {
        persona.campanas = [...(persona.campanas || []), campanaDestino];
      }
      // Agregar campaña destino a las campañas accesibles del LIDER
      if (liderId) {
        await Usuario.findByIdAndUpdate(liderId, {
          $addToSet: { campanas: campanaDestino }
        });
      }
    } else {
      throw new ApiError(400, 'Acción debe ser MOVER o COMPARTIR');
    }

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
    const { liderId, departamento, municipio, nombrePuesto, campanaFilter } = filtros;

    const matchStage = { ...campanaFilter, archivado: { $ne: true }, 'puesto.mesa': { $exists: true, $ne: '' } };

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
  async obtenerPersonasPorMesa(datosMesa, liderId = null, campanaFilter = {}) {
    const { departamento, municipio, nombrePuesto, mesa } = datosMesa;

    const query = { ...campanaFilter, archivado: { $ne: true } };

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
   * Importar personas desde Excel con datos completos
   */
  async importarDesdeExcel(filePath, usuario, campanaId = null) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new ApiError(400, 'El archivo no contiene hojas de trabajo');
    }

    // Recolectar filas (eachRow es síncrono)
    const filas = [];
    const errores = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const cedula = row.getCell(1).value;
      if (!cedula) return;

      const cedulaLimpia = cedula.toString().trim().replace(/\D/g, '');

      if (!/^\d{5,10}$/.test(cedulaLimpia)) {
        errores.push({
          fila: rowNumber,
          cedula: cedula.toString(),
          error: 'Cédula inválida (debe tener 5-10 dígitos)'
        });
        return;
      }

      filas.push({
        fila: rowNumber,
        documento: cedulaLimpia,
        nombres: (row.getCell(2).value || '').toString().trim(),
        apellidos: (row.getCell(3).value || '').toString().trim(),
        telefono: (row.getCell(4).value || '').toString().trim().replace(/\D/g, '') || undefined,
        email: (row.getCell(5).value || '').toString().trim() || undefined,
        departamento: (row.getCell(6).value || '').toString().trim() || undefined,
        municipio: (row.getCell(7).value || '').toString().trim() || undefined,
        zona: (row.getCell(8).value || '').toString().trim() || undefined,
        nombrePuesto: (row.getCell(9).value || '').toString().trim() || undefined,
        direccion: (row.getCell(10).value || '').toString().trim() || undefined,
        mesa: (row.getCell(11).value || '').toString().trim() || undefined,
        estadoContacto: (row.getCell(12).value || '').toString().trim().toUpperCase() || undefined,
        tipo: (row.getCell(13).value || '').toString().trim().toUpperCase() || undefined
      });
    });

    if (filas.length === 0) {
      throw new ApiError(400, 'No se encontraron datos válidos en el archivo');
    }

    // Validar estadoContacto
    const estadosValidos = ['PENDIENTE', 'CONTACTADO', 'CONFIRMADO', 'NO_CONTACTADO'];
    filas.forEach(f => {
      if (f.estadoContacto && !estadosValidos.includes(f.estadoContacto)) {
        f.estadoContacto = 'PENDIENTE';
      }
    });

    // Validar teléfonos
    filas.forEach(f => {
      if (f.telefono && !/^3\d{9}$/.test(f.telefono)) {
        errores.push({
          fila: f.fila,
          cedula: f.documento,
          error: `Teléfono inválido: ${f.telefono} (debe ser 10 dígitos empezando por 3)`
        });
        f.telefono = undefined;
      }
    });

    const documentos = filas.map(f => f.documento);

    // 1. Búsqueda global: verificar si el documento ya existe en la BD (en cualquier campaña)
    //    Esto evita duplicados absolutos e identifica personas ya registradas.
    const existentesGlobal = await Persona.find({ documento: { $in: documentos } })
      .select('documento lider nombres apellidos campana')
      .lean();
    const existentesGlobalMap = {};
    existentesGlobal.forEach(e => { existentesGlobalMap[e.documento] = e; });

    // 2. Búsqueda en la misma campaña: detectar conflictos de líder dentro de esta campaña
    const filtroMismaCampana = { documento: { $in: documentos } };
    if (campanaId) filtroMismaCampana.campana = campanaId;
    const existentesCampana = await Persona.find(filtroMismaCampana)
      .select('documento lider nombres apellidos')
      .lean();
    const existentesCampanaMap = {};
    existentesCampana.forEach(e => { existentesCampanaMap[e.documento] = e; });
    const existentesCampanaSet = new Set(existentesCampana.map(e => e.documento));

    const liderData = {
      id: usuario._id,
      nombre: `${usuario.perfil.nombres} ${usuario.perfil.apellidos}`,
      email: usuario.email
    };

    // Separar nuevas de existentes
    const nuevas = [];
    const actualizaciones = [];
    const alianzas = []; // Vínculos de alianza: $addToSet campanas[]
    const enOtroLider = []; // Conflicto: existe bajo otro líder

    filas.forEach(f => {
      const puestoData = {};
      if (f.departamento) puestoData.departamento = f.departamento;
      if (f.municipio) puestoData.municipio = f.municipio;
      if (f.zona) puestoData.zona = f.zona;
      if (f.nombrePuesto) puestoData.nombrePuesto = f.nombrePuesto;
      if (f.direccion) puestoData.direccion = f.direccion;
      if (f.mesa) puestoData.mesa = f.mesa;

      if (existentesCampanaSet.has(f.documento)) {
        // Existe en ESTA campaña
        const existente = existentesCampanaMap[f.documento];
        const liderActualId = existente.lider?.id?.toString();
        const liderImportId = String(usuario._id);

        // Conflicto: existe en esta campaña bajo otro líder → omitir y avisar
        if (liderActualId && liderActualId !== liderImportId) {
          enOtroLider.push({
            fila: f.fila,
            cedula: f.documento,
            nombres: `${existente.nombres || f.nombres || ''} ${existente.apellidos || f.apellidos || ''}`.trim(),
            liderActual: existente.lider?.nombre || 'Desconocido'
          });
          return; // No tocar
        }

        // Mismo líder en esta campaña → actualizar datos
        const updateFields = {};
        if (f.nombres) updateFields.nombres = f.nombres;
        if (f.apellidos) updateFields.apellidos = f.apellidos;
        if (f.telefono) updateFields.telefono = f.telefono;
        if (f.email) updateFields.email = f.email;
        if (f.estadoContacto) updateFields.estadoContacto = f.estadoContacto;
        if (f.tipo && ['C', 'V'].includes(f.tipo)) updateFields.tipo = f.tipo;
        if (Object.keys(puestoData).length > 0) updateFields.puesto = puestoData;

        if (Object.keys(updateFields).length > 0) {
          const updateFilter = { documento: f.documento };
          if (campanaId) updateFilter.campana = campanaId;
          actualizaciones.push({
            updateOne: {
              filter: updateFilter,
              update: { $set: updateFields }
            }
          });
        }
      } else {
        // No existe en esta campaña — verificar si existe en otra (posible alianza)
        const globalExistente = existentesGlobalMap[f.documento];
        if (globalExistente) {
          const liderGlobalId = globalExistente.lider?.id?.toString();
          const liderImportId = String(usuario._id);
          const puedeAlianza = usuario.rol === 'ADMIN' || usuario.rol === 'COORDINADOR';

          if (liderGlobalId && liderGlobalId !== liderImportId) {
            // Pertenece a otro líder en otra campaña → omitir y avisar siempre
            enOtroLider.push({
              fila: f.fila,
              cedula: f.documento,
              nombres: `${globalExistente.nombres || f.nombres || ''} ${globalExistente.apellidos || f.apellidos || ''}`.trim(),
              liderActual: globalExistente.lider?.nombre || 'Desconocido'
            });
            return;
          }

          if (!puedeAlianza) {
            // LIDER no puede vincular personas de otras campañas
            enOtroLider.push({
              fila: f.fila,
              cedula: f.documento,
              nombres: `${globalExistente.nombres || f.nombres || ''} ${globalExistente.apellidos || f.apellidos || ''}`.trim(),
              liderActual: 'ya existe en otra campaña (solo COORDINADOR/ADMIN puede crear alianzas)'
            });
            return;
          }

          // ADMIN o COORDINADOR, mismo líder, persona en otra campaña → ALIANZA
          // Vincular esta campaña al registro existente sin crear un duplicado
          if (campanaId) {
            alianzas.push({
              updateOne: {
                filter: { _id: globalExistente._id },
                update: { $addToSet: { campanas: campanaId } }
              }
            });
          }
          return; // Vinculada vía alianza, no crear nueva
        }

        // No existe en ningún lado → crear nueva
        nuevas.push({
          documento: f.documento,
          nombres: f.nombres || '',
          apellidos: f.apellidos || '',
          telefono: f.telefono,
          email: f.email,
          puesto: Object.keys(puestoData).length > 0 ? puestoData : undefined,
          estadoContacto: f.estadoContacto || 'PENDIENTE',
          tipo: (f.tipo && ['C', 'V'].includes(f.tipo)) ? f.tipo : undefined,
          campana: campanaId,
          lider: liderData,
          confirmado: true,
          origen: 'IMPORTACION'
        });
      }
    });

    let creadas = 0;
    let actualizadas = 0;

    // Insertar nuevas en batch
    if (nuevas.length > 0) {
      const resultado = await Persona.insertMany(nuevas, { ordered: false }).catch(err => {
        // Manejar errores de duplicados parciales
        if (err.insertedDocs) {
          creadas = err.insertedDocs.length;
          err.writeErrors?.forEach(we => {
            errores.push({
              fila: filas.find(f => f.documento === nuevas[we.index]?.documento)?.fila,
              cedula: nuevas[we.index]?.documento,
              error: 'Error al insertar (posible duplicado)'
            });
          });
          return err.insertedDocs;
        }
        throw err;
      });
      if (Array.isArray(resultado)) {
        creadas = resultado.length;
      }
    }

    // Actualizar datos de existentes en batch
    if (actualizaciones.length > 0) {
      const resultado = await Persona.bulkWrite(actualizaciones);
      actualizadas = resultado.modifiedCount;
    }

    // Vincular alianzas en batch ($addToSet campanas[])
    let alianzadas = 0;
    if (alianzas.length > 0) {
      const resultado = await Persona.bulkWrite(alianzas);
      alianzadas = resultado.modifiedCount;
    }

    // Actualizar stats
    const consultaService = require('./consultaService');
    await consultaService.actualizarStatsUsuario(usuario._id);

    return {
      total: filas.length,
      creadas,
      actualizadas,
      alianzadas,
      errores: errores.length,
      detallesErrores: errores,
      enOtroLider: enOtroLider.length,
      detallesOtroLider: enOtroLider
    };
  }

  /**
   * Generar plantilla Excel para importación de personas
   */
  async generarPlantillaImportacion() {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    const ws = workbook.addWorksheet('Importar Personas');
    ws.columns = [
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Nombres', key: 'nombres', width: 20 },
      { header: 'Apellidos', key: 'apellidos', width: 20 },
      { header: 'Teléfono', key: 'telefono', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Departamento', key: 'departamento', width: 18 },
      { header: 'Municipio', key: 'municipio', width: 18 },
      { header: 'Zona', key: 'zona', width: 10 },
      { header: 'Puesto de Votación', key: 'puesto', width: 25 },
      { header: 'Dirección', key: 'direccion', width: 30 },
      { header: 'Mesa', key: 'mesa', width: 8 },
      { header: 'Estado Contacto', key: 'estadoContacto', width: 18 },
      { header: 'Tipo', key: 'tipo', width: 10 }
    ];

    // Ejemplo
    ws.addRow({
      cedula: '1234567890',
      nombres: 'JUAN',
      apellidos: 'PEREZ GARCIA',
      telefono: '3001234567',
      email: 'juan@email.com',
      departamento: 'ATLANTICO',
      municipio: 'BARRANQUILLA',
      zona: '5',
      puesto: 'I.E. EJEMPLO',
      direccion: 'CRA 1 # 2-3',
      mesa: '5',
      estadoContacto: 'PENDIENTE',
      tipo: 'V'
    });

    // Estilos
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // Instrucciones
    const wsInst = workbook.addWorksheet('Instrucciones');
    wsInst.getColumn(1).width = 80;
    wsInst.addRow(['INSTRUCCIONES PARA IMPORTAR PERSONAS']);
    wsInst.addRow([]);
    wsInst.addRow(['Columna A: Cédula (requerida, 5-10 dígitos)']);
    wsInst.addRow(['Columna B: Nombres (opcional)']);
    wsInst.addRow(['Columna C: Apellidos (opcional)']);
    wsInst.addRow(['Columna D: Teléfono (opcional, 10 dígitos empezando por 3)']);
    wsInst.addRow(['Columna E: Email (opcional)']);
    wsInst.addRow(['Columna F: Departamento (opcional)']);
    wsInst.addRow(['Columna G: Municipio (opcional)']);
    wsInst.addRow(['Columna H: Zona (opcional, número de zona)']);
    wsInst.addRow(['Columna I: Puesto de Votación (opcional)']);
    wsInst.addRow(['Columna J: Dirección (opcional)']);
    wsInst.addRow(['Columna K: Mesa (opcional)']);
    wsInst.addRow(['Columna L: Estado Contacto (PENDIENTE, CONTACTADO, CONFIRMADO, NO_CONTACTADO)']);
    wsInst.addRow(['Columna M: Tipo (C = Compra, V = Voluntario — dejar vacío si no aplica)']);
    wsInst.addRow([]);
    wsInst.addRow(['NOTAS:']);
    wsInst.addRow(['- Si la cédula ya existe, se actualizarán los datos']);
    wsInst.addRow(['- No elimines la fila de encabezados']);
    wsInst.addRow(['- Guarda el archivo como .xlsx']);
    wsInst.getCell('A1').font = { bold: true, size: 14 };

    return workbook;
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

  /**
   * Exportar personas a Excel con formato
   */
  async exportarExcel(filtros) {
    const ExcelJS = require('exceljs');
    const { personas } = await this.listarPersonas(filtros, { limit: 10000 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elector360';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Personas');

    worksheet.columns = [
      { header: 'Documento',       key: 'documento',       width: 15 },
      { header: 'Nombres',         key: 'nombres',         width: 22 },
      { header: 'Apellidos',       key: 'apellidos',       width: 22 },
      { header: 'Teléfono',        key: 'telefono',        width: 15 },
      { header: 'Email',           key: 'email',           width: 28 },
      { header: 'Departamento',    key: 'departamento',    width: 18 },
      { header: 'Municipio',       key: 'municipio',       width: 18 },
      { header: 'Puesto',          key: 'puesto',          width: 25 },
      { header: 'Mesa',            key: 'mesa',            width: 8  },
      { header: 'Estado Contacto', key: 'estadoContacto',  width: 18 },
      { header: 'Notas',           key: 'notas',           width: 35 }
    ];

    // Estilo del header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    const statusColors = {
      CONFIRMADO:    'FF27AE60',
      CONTACTADO:    'FF2980B9',
      PENDIENTE:     'FFF39C12',
      NO_CONTACTADO: 'FFE74C3C'
    };

    personas.forEach(p => {
      const row = worksheet.addRow({
        documento:      p.documento,
        nombres:        p.nombres || '',
        apellidos:      p.apellidos || '',
        telefono:       p.telefono || '',
        email:          p.email || '',
        departamento:   p.puesto?.departamento || '',
        municipio:      p.puesto?.municipio || '',
        puesto:         p.puesto?.nombrePuesto || '',
        mesa:           p.puesto?.mesa || '',
        estadoContacto: p.estadoContacto || '',
        notas:          p.notas || ''
      });

      const color = statusColors[p.estadoContacto];
      if (color) {
        row.getCell('estadoContacto').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        };
        row.getCell('estadoContacto').font = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
    });

    return workbook;
  }
}

module.exports = new PersonaService();