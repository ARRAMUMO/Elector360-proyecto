const Persona = require('../models/Persona');
const ColaConsulta = require('../models/ColaConsulta');
const ExcelJS = require('exceljs');
const ApiError = require('../utils/ApiError');

class OperacionesMasivasService {
  /**
   * Actualizar TODA la base de datos
   * Encola todas las personas para actualización (batch)
   */
  async actualizarBaseDatosCompleta(campanaId = null) {
    // Obtener personas (filtradas por campaña si aplica)
    const filtro = campanaId ? { campana: campanaId } : {};
    const personas = await Persona.find(filtro).select('documento _id').lean();

    if (personas.length === 0) {
      throw new ApiError(400, 'No hay personas para actualizar');
    }

    const todosDocumentos = personas.map(p => p.documento);
    const docToId = new Map(personas.map(p => [p.documento, p._id]));

    // Batch: verificar cuáles ya están en cola (1 query)
    const yaEnColaItems = await ColaConsulta.find({
      documento: { $in: todosDocumentos },
      estado: { $in: ['PENDIENTE', 'PROCESANDO'] }
    }).select('documento').lean();

    const docsEnCola = new Set(yaEnColaItems.map(i => i.documento));
    const yaEnCola = docsEnCola.size;

    // Filtrar las que necesitan encolarse
    const paraEncolar = todosDocumentos.filter(doc => !docsEnCola.has(doc));

    let encoladas = 0;
    let errores = 0;

    if (paraEncolar.length > 0) {
      const documentosAInsertar = paraEncolar.map(doc => ({
        documento: doc,
        personaId: docToId.get(doc),
        campana: campanaId,
        prioridad: 2, // Media
        estado: 'PENDIENTE'
      }));

      try {
        // Insertar en lotes de 500 para evitar límites de memoria
        const BATCH_SIZE = 500;
        for (let i = 0; i < documentosAInsertar.length; i += BATCH_SIZE) {
          const batch = documentosAInsertar.slice(i, i + BATCH_SIZE);
          const result = await ColaConsulta.insertMany(batch, { ordered: false });
          encoladas += result.length;
        }
      } catch (error) {
        if (error.insertedDocs) {
          encoladas += error.insertedDocs.length;
        }
        errores = paraEncolar.length - encoladas;
        console.error('Error parcial en encolamiento masivo:', error.message);
      }
    }

    return {
      total: personas.length,
      encoladas,
      yaEnCola,
      errores,
      mensaje: `${encoladas} personas encoladas para actualización`
    };
  }

  /**
   * Procesar archivo Excel con cédulas
   * Formato esperado: Primera columna = cédulas
   */
  async procesarArchivoExcel(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) {
      throw new ApiError(400, 'El archivo Excel está vacío');
    }

    const cedulas = [];
    const errores = [];

    // Leer cédulas (saltar header si existe)
    worksheet.eachRow((row, rowNumber) => {
      // Saltar primera fila si parece header
      if (rowNumber === 1) {
        const firstCell = row.getCell(1).value;
        if (typeof firstCell === 'string' && 
            (firstCell.toLowerCase().includes('cedula') || 
             firstCell.toLowerCase().includes('documento'))) {
          return; // Skip header
        }
      }

      const cedula = row.getCell(1).value;

      if (!cedula) {
        return; // Skip empty rows
      }

      // Limpiar y validar cédula
      const cedulaLimpia = cedula.toString().trim().replace(/\D/g, '');

      // Validar formato (5-10 dígitos)
      if (!/^\d{5,10}$/.test(cedulaLimpia)) {
        errores.push({
          fila: rowNumber,
          cedula: cedula.toString(),
          error: 'Cédula inválida (debe tener 5-10 dígitos)'
        });
        return;
      }

      cedulas.push({
        cedula: cedulaLimpia,
        fila: rowNumber
      });
    });

    if (cedulas.length === 0) {
      throw new ApiError(400, 'No se encontraron cédulas válidas en el archivo');
    }

    return {
      cedulas,
      errores,
      total: cedulas.length
    };
  }

  /**
   * Consultar múltiples cédulas desde Excel
   * 1. Lee Excel
   * 2. Verifica cuáles existen en BD (batch)
   * 3. Encola las que no existen para RPA (batch)
   */
  async consultarDesdeExcel(filePath, campanaId = null) {
    // Leer y validar archivo
    const { cedulas, errores: erroresLectura } = await this.procesarArchivoExcel(filePath);

    // Mapa cedula → fila para referencia rápida
    const cedulaMap = new Map(cedulas.map(c => [c.cedula, c.fila]));
    const todasLasCedulas = cedulas.map(c => c.cedula);

    const resultados = {
      total: cedulas.length,
      encontradasEnBD: 0,
      encoladas: 0,
      yaEnCola: 0,
      errores: erroresLectura.length,
      detalles: {
        encontradas: [],
        encoladas: [],
        yaEnCola: [],
        errores: [...erroresLectura]
      }
    };

    try {
      // 1. Batch: buscar todas las personas existentes en BD (1 query, scoped por campaña)
      const filtroPersonas = { documento: { $in: todasLasCedulas } };
      if (campanaId) filtroPersonas.campana = campanaId;
      const personasExistentes = await Persona.find(filtroPersonas)
        .select('documento nombres apellidos lider').lean();

      const docsEnBD = new Set();
      for (const persona of personasExistentes) {
        docsEnBD.add(persona.documento);
        resultados.encontradasEnBD++;
        resultados.detalles.encontradas.push({
          fila: cedulaMap.get(persona.documento),
          cedula: persona.documento,
          nombre: `${persona.nombres} ${persona.apellidos}`,
          lider: persona.lider?.nombre || 'Sin asignar'
        });
      }

      // 2. Cédulas que no están en BD
      const cedulasNoEnBD = todasLasCedulas.filter(c => !docsEnBD.has(c));

      if (cedulasNoEnBD.length > 0) {
        // 3. Batch: verificar cuáles ya están en cola (1 query)
        const yaEnColaItems = await ColaConsulta.find({
          documento: { $in: cedulasNoEnBD },
          estado: { $in: ['PENDIENTE', 'PROCESANDO'] }
        }).select('documento estado').lean();

        const docsEnCola = new Set();
        for (const item of yaEnColaItems) {
          docsEnCola.add(item.documento);
          resultados.yaEnCola++;
          resultados.detalles.yaEnCola.push({
            fila: cedulaMap.get(item.documento),
            cedula: item.documento,
            estado: item.estado
          });
        }

        // 4. Batch: encolar todas las que faltan (1 insertMany)
        const paraEncolar = cedulasNoEnBD.filter(c => !docsEnCola.has(c));

        if (paraEncolar.length > 0) {
          const documentosAInsertar = paraEncolar.map(cedula => ({
            documento: cedula,
            campana: campanaId,
            prioridad: 1, // ALTA (consulta manual)
            estado: 'PENDIENTE'
          }));

          await ColaConsulta.insertMany(documentosAInsertar, { ordered: false });

          for (const cedula of paraEncolar) {
            resultados.encoladas++;
            resultados.detalles.encoladas.push({
              fila: cedulaMap.get(cedula),
              cedula
            });
          }
        }
      }
    } catch (error) {
      console.error('Error en consulta masiva batch:', error);
      // Si insertMany falla parcialmente, contar errores
      if (error.writeErrors) {
        resultados.errores += error.writeErrors.length;
        resultados.encoladas = (resultados.encoladas || 0) - error.writeErrors.length;
      } else {
        throw error;
      }
    }

    return resultados;
  }

  /**
   * Actualizar personas desde Excel
   * Formato: cedula, telefono, email, estadoContacto, notas
   */
  async actualizarDesdeExcel(filePath, usuarioId, campanaId = null) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new ApiError(400, 'El archivo Excel está vacío');
    }

    // 1. Recolectar filas de forma síncrona (eachRow es síncrono)
    const filas = [];
    let isFirstRow = true;

    worksheet.eachRow((row, rowNumber) => {
      if (isFirstRow) {
        isFirstRow = false;
        return;
      }

      const cedula = row.getCell(1).value?.toString().trim();
      const telefono = row.getCell(2).value?.toString().trim();
      const email = row.getCell(3).value?.toString().trim();
      const estadoContacto = row.getCell(4).value?.toString().trim();
      const notas = row.getCell(5).value?.toString().trim();

      filas.push({ rowNumber, cedula, telefono, email, estadoContacto, notas });
    });

    const resultados = {
      total: filas.length,
      actualizadas: 0,
      noEncontradas: 0,
      errores: 0,
      detalles: {
        actualizadas: [],
        noEncontradas: [],
        errores: []
      }
    };

    // Separar filas con y sin cédula
    const filasValidas = [];
    for (const fila of filas) {
      if (!fila.cedula) {
        resultados.errores++;
        resultados.detalles.errores.push({ fila: fila.rowNumber, error: 'Cédula vacía' });
      } else {
        filasValidas.push(fila);
      }
    }

    if (filasValidas.length === 0) return resultados;

    // 2. Batch: buscar todas las personas existentes (1 query, scoped por campaña)
    const cedulasBuscar = filasValidas.map(f => f.cedula);
    const filtroPersonas = { documento: { $in: cedulasBuscar } };
    if (campanaId) filtroPersonas.campana = campanaId;
    const personasExistentes = await Persona.find(filtroPersonas)
      .select('documento nombres apellidos telefono email estadoContacto notas');

    const personaMap = new Map(personasExistentes.map(p => [p.documento, p]));

    // 3. Procesar actualizaciones
    const bulkOps = [];
    for (const fila of filasValidas) {
      const persona = personaMap.get(fila.cedula);

      if (!persona) {
        resultados.noEncontradas++;
        resultados.detalles.noEncontradas.push({ fila: fila.rowNumber, cedula: fila.cedula });
        continue;
      }

      const updateFields = {};
      if (fila.telefono) updateFields.telefono = fila.telefono;
      if (fila.email) updateFields.email = fila.email;
      if (fila.estadoContacto) updateFields.estadoContacto = fila.estadoContacto;
      if (fila.notas) updateFields.notas = fila.notas;

      if (Object.keys(updateFields).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: persona._id },
            update: { $set: updateFields }
          }
        });
        resultados.actualizadas++;
        resultados.detalles.actualizadas.push({
          fila: fila.rowNumber,
          cedula: fila.cedula,
          nombre: `${persona.nombres} ${persona.apellidos}`
        });
      }
    }

    // 4. Batch: ejecutar todas las actualizaciones (1 bulkWrite)
    if (bulkOps.length > 0) {
      try {
        await Persona.bulkWrite(bulkOps, { ordered: false });
      } catch (error) {
        console.error('Error parcial en actualización masiva:', error.message);
        if (error.result) {
          const fallidas = bulkOps.length - (error.result.nModified || 0);
          resultados.errores += fallidas;
          resultados.actualizadas -= fallidas;
        }
      }
    }

    return resultados;
  }

  /**
   * Generar reporte de resultados en Excel
   */
  async generarReporteExcel(resultados) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Resultados');

    // Configurar columnas
    worksheet.columns = [
      { header: 'Estado', key: 'estado', width: 20 },
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Fila Original', key: 'fila', width: 15 },
      { header: 'Observaciones', key: 'observaciones', width: 40 }
    ];

    // Agregar encontradas en BD
    if (resultados.detalles?.encontradas) {
      resultados.detalles.encontradas.forEach(item => {
        worksheet.addRow({
          estado: 'ENCONTRADA',
          cedula: item.cedula,
          nombre: item.nombre,
          fila: item.fila,
          observaciones: `Líder: ${item.lider}`
        });
      });
    }

    // Agregar encoladas
    if (resultados.detalles?.encoladas) {
      resultados.detalles.encoladas.forEach(item => {
        worksheet.addRow({
          estado: 'ENCOLADA PARA CONSULTA',
          cedula: item.cedula,
          nombre: '-',
          fila: item.fila,
          observaciones: 'Se consultará en Registraduría'
        });
      });
    }

    // Agregar ya en cola
    if (resultados.detalles?.yaEnCola) {
      resultados.detalles.yaEnCola.forEach(item => {
        worksheet.addRow({
          estado: 'YA EN COLA',
          cedula: item.cedula,
          nombre: '-',
          fila: item.fila,
          observaciones: `Estado: ${item.estado}`
        });
      });
    }

    // Agregar errores
    if (resultados.detalles?.errores) {
      resultados.detalles.errores.forEach(item => {
        worksheet.addRow({
          estado: 'ERROR',
          cedula: item.cedula || '-',
          nombre: '-',
          fila: item.fila,
          observaciones: item.error
        });
      });
    }

    // Estilos para header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Agregar resumen al inicio
    worksheet.insertRow(1, ['RESUMEN DE PROCESAMIENTO']);
    worksheet.insertRow(2, ['Total procesadas:', resultados.total]);
    worksheet.insertRow(3, ['Encontradas en BD:', resultados.encontradasEnBD || 0]);
    worksheet.insertRow(4, ['Encoladas para consulta:', resultados.encoladas || 0]);
    worksheet.insertRow(5, ['Ya en cola:', resultados.yaEnCola || 0]);
    worksheet.insertRow(6, ['Errores:', resultados.errores || 0]);
    worksheet.insertRow(7, []); // Espacio

    // Merge cells para título
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    return workbook;
  }

  /**
   * Obtener estado de procesamiento masivo
   */
  async obtenerEstadoProcesamientoMasivo(campanaFilter = {}) {
    const [total, pendientes, procesando, completadas, errores, erroresRecientes] = await Promise.all([
      ColaConsulta.countDocuments(campanaFilter),
      ColaConsulta.countDocuments({ ...campanaFilter, estado: 'PENDIENTE' }),
      ColaConsulta.countDocuments({ ...campanaFilter, estado: 'PROCESANDO' }),
      ColaConsulta.countDocuments({ ...campanaFilter, estado: 'COMPLETADO' }),
      ColaConsulta.countDocuments({ ...campanaFilter, estado: 'ERROR' }),
      ColaConsulta.find({ ...campanaFilter, estado: 'ERROR' })
        .sort({ updatedAt: -1 })
        .limit(50)
        .select('documento ultimoError intentos maximoIntentos updatedAt')
        .lean()
    ]);

    // Calcular progreso
    const procesadas = completadas + errores;
    const progreso = total > 0 ? Math.round((procesadas / total) * 100) : 0;

    return {
      total,
      pendientes,
      procesando,
      completadas,
      errores,
      procesadas,
      progreso,
      enProceso: pendientes > 0 || procesando > 0,
      erroresRecientes: erroresRecientes.map(e => ({
        _id: e._id,
        documento: e.documento,
        error: e.ultimoError,
        intentos: e.intentos || 0,
        maximoIntentos: e.maximoIntentos || 3,
        fecha: e.updatedAt
      }))
    };
  }

  /**
   * Limpiar cola de consultas (solo completadas y errores antiguos)
   */
  /**
   * Obtener resultados completados (con datos de votación)
   */
  async obtenerResultadosCompletados(campanaFilter = {}) {
    // Obtener consultas completadas y con error (más recientes primero)
    const consultas = await ColaConsulta.find({
      ...campanaFilter,
      estado: { $in: ['COMPLETADO', 'ERROR'] }
    })
    .sort({ updatedAt: -1 })
    .lean();

    // Deduplicar por documento: solo la más reciente de cada cédula
    const vistos = new Set();
    const consultasUnicas = [];
    for (const c of consultas) {
      if (!vistos.has(c.documento)) {
        vistos.add(c.documento);
        consultasUnicas.push(c);
      }
    }

    // Para las completadas, también buscar datos de Persona
    const documentosCompletados = consultasUnicas
      .filter(c => c.estado === 'COMPLETADO')
      .map(c => c.documento);

    const personasMap = {};
    if (documentosCompletados.length > 0) {
      const personas = await Persona.find({
        documento: { $in: documentosCompletados }
      }).select('documento nombres apellidos puesto').lean();

      personas.forEach(p => {
        personasMap[p.documento] = p;
      });
    }

    return consultasUnicas.map(c => {
      const persona = personasMap[c.documento];
      const resultado = c.resultado || {};
      const datosElectorales = resultado.datosElectorales || {};

      return {
        documento: c.documento,
        estado: c.estado,
        nombres: resultado.nombres || persona?.nombres || '',
        apellidos: resultado.apellidos || persona?.apellidos || '',
        departamento: datosElectorales.departamento || persona?.puesto?.departamento || '',
        municipio: datosElectorales.municipio || persona?.puesto?.municipio || '',
        puesto: datosElectorales.puestoVotacion || persona?.puesto?.nombrePuesto || '',
        direccion: datosElectorales.direccion || persona?.puesto?.direccion || '',
        mesa: datosElectorales.mesa || persona?.puesto?.mesa || '',
        error: c.ultimoError || null,
        fecha: c.updatedAt
      };
    });
  }

  /**
   * Generar reporte Excel con datos de votación (resultados RPA)
   */
  async generarReporteResultadosRPA() {
    const resultados = await this.obtenerResultadosCompletados();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Resultados RPA');

    // Configurar columnas
    worksheet.columns = [
      { header: 'Cédula', key: 'documento', width: 15 },
      { header: 'Nombres', key: 'nombres', width: 20 },
      { header: 'Apellidos', key: 'apellidos', width: 20 },
      { header: 'Departamento', key: 'departamento', width: 18 },
      { header: 'Municipio', key: 'municipio', width: 18 },
      { header: 'Puesto de Votación', key: 'puesto', width: 30 },
      { header: 'Dirección', key: 'direccion', width: 30 },
      { header: 'Mesa', key: 'mesa', width: 8 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Error', key: 'error', width: 30 }
    ];

    // Agregar filas
    resultados.forEach(r => {
      worksheet.addRow({
        documento: r.documento,
        nombres: r.nombres,
        apellidos: r.apellidos,
        departamento: r.departamento,
        municipio: r.municipio,
        puesto: r.puesto,
        direccion: r.direccion,
        mesa: r.mesa,
        estado: r.estado,
        error: r.error || ''
      });
    });

    // Estilos header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // Color por estado en las filas de datos
    for (let i = 2; i <= resultados.length + 1; i++) {
      const estado = worksheet.getCell(`I${i}`).value;
      if (estado === 'ERROR') {
        worksheet.getCell(`I${i}`).font = { color: { argb: 'FFFF0000' } };
      } else if (estado === 'COMPLETADO') {
        worksheet.getCell(`I${i}`).font = { color: { argb: 'FF008000' } };
      }
    }

    // Resumen al inicio
    const completadas = resultados.filter(r => r.estado === 'COMPLETADO').length;
    const errores = resultados.filter(r => r.estado === 'ERROR').length;

    worksheet.insertRow(1, ['REPORTE DE RESULTADOS RPA']);
    worksheet.insertRow(2, ['Total:', resultados.length, '', 'Completadas:', completadas, '', 'Errores:', errores]);
    worksheet.insertRow(3, []);

    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    return workbook;
  }

  /**
   * Reintentar una consulta específica con error
   */
  async reintentarConsulta(id) {
    const consulta = await ColaConsulta.findById(id);
    if (!consulta) {
      throw new ApiError(404, 'Consulta no encontrada');
    }
    if (consulta.estado !== 'ERROR') {
      throw new ApiError(400, 'Solo se pueden reintentar consultas con error');
    }

    consulta.estado = 'PENDIENTE';
    consulta.intentos = 0;
    consulta.ultimoError = null;
    await consulta.save();

    return { mensaje: `Consulta ${consulta.documento} reencolada` };
  }

  /**
   * Eliminar una consulta específica con error
   */
  async eliminarConsulta(id) {
    const consulta = await ColaConsulta.findById(id);
    if (!consulta) {
      throw new ApiError(404, 'Consulta no encontrada');
    }
    if (consulta.estado !== 'ERROR') {
      throw new ApiError(400, 'Solo se pueden eliminar consultas con error');
    }

    await ColaConsulta.findByIdAndDelete(id);
    return { mensaje: `Consulta ${consulta.documento} eliminada` };
  }

  /**
   * Reintentar todas las consultas con error
   */
  async reintentarTodosErrores() {
    const resultado = await ColaConsulta.updateMany(
      { estado: 'ERROR' },
      { $set: { estado: 'PENDIENTE', intentos: 0, ultimoError: null } }
    );

    return {
      reintentadas: resultado.modifiedCount,
      mensaje: `${resultado.modifiedCount} consultas reencoladas`
    };
  }

  /**
   * Eliminar todas las consultas con error
   */
  async eliminarTodosErrores() {
    const resultado = await ColaConsulta.deleteMany({ estado: 'ERROR' });

    return {
      eliminadas: resultado.deletedCount,
      mensaje: `${resultado.deletedCount} errores eliminados`
    };
  }

  async limpiarCola(diasAntiguedad = 7) {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

    const resultado = await ColaConsulta.deleteMany({
      estado: { $in: ['COMPLETADO', 'ERROR'] },
      updatedAt: { $lt: fechaLimite }
    });

    return {
      eliminadas: resultado.deletedCount,
      mensaje: `${resultado.deletedCount} consultas antiguas eliminadas`
    };
  }
}

module.exports = new OperacionesMasivasService();