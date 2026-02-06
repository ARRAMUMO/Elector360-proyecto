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
   * Importar personas desde Excel con datos completos
   */
  async importarDesdeExcel(filePath, usuario) {
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
        nombrePuesto: (row.getCell(8).value || '').toString().trim() || undefined,
        direccion: (row.getCell(9).value || '').toString().trim() || undefined,
        mesa: (row.getCell(10).value || '').toString().trim() || undefined,
        estadoContacto: (row.getCell(11).value || '').toString().trim().toUpperCase() || undefined
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

    // Batch: buscar existentes
    const documentos = filas.map(f => f.documento);
    const existentes = await Persona.find({
      documento: { $in: documentos }
    }).select('documento').lean();

    const existentesSet = new Set(existentes.map(e => e.documento));

    const liderData = {
      id: usuario._id,
      nombre: `${usuario.perfil.nombres} ${usuario.perfil.apellidos}`,
      email: usuario.email
    };

    // Separar nuevas de existentes
    const nuevas = [];
    const actualizaciones = [];

    filas.forEach(f => {
      const puestoData = {};
      if (f.departamento) puestoData.departamento = f.departamento;
      if (f.municipio) puestoData.municipio = f.municipio;
      if (f.nombrePuesto) puestoData.nombrePuesto = f.nombrePuesto;
      if (f.direccion) puestoData.direccion = f.direccion;
      if (f.mesa) puestoData.mesa = f.mesa;

      if (existentesSet.has(f.documento)) {
        // Actualizar existente
        const updateFields = {};
        if (f.nombres) updateFields.nombres = f.nombres;
        if (f.apellidos) updateFields.apellidos = f.apellidos;
        if (f.telefono) updateFields.telefono = f.telefono;
        if (f.email) updateFields.email = f.email;
        if (f.estadoContacto) updateFields.estadoContacto = f.estadoContacto;
        if (Object.keys(puestoData).length > 0) updateFields.puesto = puestoData;

        if (Object.keys(updateFields).length > 0) {
          actualizaciones.push({
            updateOne: {
              filter: { documento: f.documento },
              update: { $set: updateFields }
            }
          });
        }
      } else {
        // Crear nueva
        nuevas.push({
          documento: f.documento,
          nombres: f.nombres || '',
          apellidos: f.apellidos || '',
          telefono: f.telefono,
          email: f.email,
          puesto: Object.keys(puestoData).length > 0 ? puestoData : undefined,
          estadoContacto: f.estadoContacto || 'PENDIENTE',
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

    // Actualizar existentes en batch
    if (actualizaciones.length > 0) {
      const resultado = await Persona.bulkWrite(actualizaciones);
      actualizadas = resultado.modifiedCount;
    }

    // Actualizar stats
    const consultaService = require('./consultaService');
    await consultaService.actualizarStatsUsuario(usuario._id);

    return {
      total: filas.length,
      creadas,
      actualizadas,
      errores: errores.length,
      detallesErrores: errores
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
      { header: 'Puesto de Votación', key: 'puesto', width: 25 },
      { header: 'Dirección', key: 'direccion', width: 30 },
      { header: 'Mesa', key: 'mesa', width: 8 },
      { header: 'Estado Contacto', key: 'estadoContacto', width: 18 }
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
      puesto: 'I.E. EJEMPLO',
      direccion: 'CRA 1 # 2-3',
      mesa: '5',
      estadoContacto: 'PENDIENTE'
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
    wsInst.addRow(['Columna H: Puesto de Votación (opcional)']);
    wsInst.addRow(['Columna I: Dirección (opcional)']);
    wsInst.addRow(['Columna J: Mesa (opcional)']);
    wsInst.addRow(['Columna K: Estado Contacto (PENDIENTE, CONTACTADO, CONFIRMADO, NO_CONTACTADO)']);
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