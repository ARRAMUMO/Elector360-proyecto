const Persona = require('../models/Persona');
const ColaConsulta = require('../models/ColaConsulta');
const ExcelJS = require('exceljs');
const ApiError = require('../utils/ApiError');

class OperacionesMasivasService {
  /**
   * Actualizar TODA la base de datos
   * Encola todas las personas para actualización
   */
  async actualizarBaseDatosCompleta() {
    // Obtener todas las personas
    const personas = await Persona.find().select('documento _id estadoRPA');

    if (personas.length === 0) {
      throw new ApiError(400, 'No hay personas para actualizar');
    }

    // Estadísticas
    let encoladas = 0;
    let yaEnCola = 0;
    let errores = 0;

    // Encolar cada persona con prioridad MEDIA (2)
    for (const persona of personas) {
      try {
        // Verificar si ya está en cola
        const enCola = await ColaConsulta.findOne({
          documento: persona.documento,
          estado: { $in: ['PENDIENTE', 'PROCESANDO'] }
        });

        if (enCola) {
          yaEnCola++;
          continue;
        }

        // Encolar
        await ColaConsulta.create({
          documento: persona.documento,
          personaId: persona._id,
          prioridad: 2, // Media
          estado: 'PENDIENTE'
        });

        encoladas++;
      } catch (error) {
        console.error(`Error encolando ${persona.documento}:`, error);
        errores++;
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

      // Validar formato (7-10 dígitos)
      if (!/^\d{7,10}$/.test(cedulaLimpia)) {
        errores.push({
          fila: rowNumber,
          cedula: cedula.toString(),
          error: 'Cédula inválida (debe tener 7-10 dígitos)'
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
   * 2. Verifica cuáles existen en BD
   * 3. Encola las que no existen para RPA
   */
  async consultarDesdeExcel(filePath) {
    // Leer y validar archivo
    const { cedulas, errores: erroresLectura } = await this.procesarArchivoExcel(filePath);

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
        errores: erroresLectura
      }
    };

    // Procesar cada cédula
    for (const item of cedulas) {
      try {
        // 1. Buscar en BD
        const persona = await Persona.findOne({ documento: item.cedula });

        if (persona) {
          // Existe en BD
          resultados.encontradasEnBD++;
          resultados.detalles.encontradas.push({
            fila: item.fila,
            cedula: item.cedula,
            nombre: `${persona.nombres} ${persona.apellidos}`,
            lider: persona.lider?.nombre || 'Sin asignar'
          });
          continue;
        }

        // 2. No existe, verificar si ya está en cola
        const enCola = await ColaConsulta.findOne({
          documento: item.cedula,
          estado: { $in: ['PENDIENTE', 'PROCESANDO'] }
        });

        if (enCola) {
          resultados.yaEnCola++;
          resultados.detalles.yaEnCola.push({
            fila: item.fila,
            cedula: item.cedula,
            estado: enCola.estado
          });
          continue;
        }

        // 3. No existe ni en BD ni en cola, encolar
        await ColaConsulta.create({
          documento: item.cedula,
          prioridad: 1, // ALTA (consulta manual)
          estado: 'PENDIENTE'
        });

        resultados.encoladas++;
        resultados.detalles.encoladas.push({
          fila: item.fila,
          cedula: item.cedula
        });

      } catch (error) {
        console.error(`Error procesando cédula ${item.cedula}:`, error);
        resultados.errores++;
        resultados.detalles.errores.push({
          fila: item.fila,
          cedula: item.cedula,
          error: error.message
        });
      }
    }

    return resultados;
  }

  /**
   * Actualizar personas desde Excel
   * Formato: cedula, telefono, email, estadoContacto, notas
   */
  async actualizarDesdeExcel(filePath, usuarioId) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) {
      throw new ApiError(400, 'El archivo Excel está vacío');
    }

    const resultados = {
      total: 0,
      actualizadas: 0,
      noEncontradas: 0,
      errores: 0,
      detalles: {
        actualizadas: [],
        noEncontradas: [],
        errores: []
      }
    };

    // Leer datos (saltar header)
    let isFirstRow = true;

    worksheet.eachRow(async (row, rowNumber) => {
      if (isFirstRow) {
        isFirstRow = false;
        return; // Skip header
      }

      resultados.total++;

      try {
        const cedula = row.getCell(1).value?.toString().trim();
        const telefono = row.getCell(2).value?.toString().trim();
        const email = row.getCell(3).value?.toString().trim();
        const estadoContacto = row.getCell(4).value?.toString().trim();
        const notas = row.getCell(5).value?.toString().trim();

        if (!cedula) {
          resultados.errores++;
          resultados.detalles.errores.push({
            fila: rowNumber,
            error: 'Cédula vacía'
          });
          return;
        }

        // Buscar persona
        const persona = await Persona.findOne({ documento: cedula });

        if (!persona) {
          resultados.noEncontradas++;
          resultados.detalles.noEncontradas.push({
            fila: rowNumber,
            cedula
          });
          return;
        }

        // Actualizar campos
        if (telefono) persona.telefono = telefono;
        if (email) persona.email = email;
        if (estadoContacto) persona.estadoContacto = estadoContacto;
        if (notas) persona.notas = notas;

        await persona.save();

        resultados.actualizadas++;
        resultados.detalles.actualizadas.push({
          fila: rowNumber,
          cedula,
          nombre: `${persona.nombres} ${persona.apellidos}`
        });

      } catch (error) {
        console.error(`Error fila ${rowNumber}:`, error);
        resultados.errores++;
        resultados.detalles.errores.push({
          fila: rowNumber,
          error: error.message
        });
      }
    });

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
  async obtenerEstadoProcesamientoMasivo() {
    const [total, pendientes, procesando, completadas, errores] = await Promise.all([
      ColaConsulta.countDocuments(),
      ColaConsulta.countDocuments({ estado: 'PENDIENTE' }),
      ColaConsulta.countDocuments({ estado: 'PROCESANDO' }),
      ColaConsulta.countDocuments({ estado: 'COMPLETADO' }),
      ColaConsulta.countDocuments({ estado: 'ERROR' })
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
      enProceso: pendientes > 0 || procesando > 0
    };
  }

  /**
   * Limpiar cola de consultas (solo completadas y errores antiguos)
   */
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