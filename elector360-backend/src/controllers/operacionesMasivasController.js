const asyncHandler = require('../utils/asyncHandler');
const operacionesMasivasService = require('../services/operacionesMasivasService');
const ApiError = require('../utils/ApiError');
const path = require('path');
const fs = require('fs').promises;

/**
 * @desc    Actualizar toda la base de datos
 * @route   POST /api/v1/masivas/actualizar-todo
 * @access  Private (Admin only)
 */
exports.actualizarBaseDatosCompleta = asyncHandler(async (req, res) => {
  const resultado = await operacionesMasivasService.actualizarBaseDatosCompleta(req.campanaId);

  res.json({
    success: true,
    message: 'Actualización masiva iniciada',
    data: resultado
  });
});

/**
 * @desc    Consultar desde archivo Excel
 * @route   POST /api/v1/masivas/consultar-excel
 * @access  Private (Admin only)
 */
exports.consultarDesdeExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No se ha subido ningún archivo');
  }

  // Validar que sea Excel
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    // Eliminar archivo
    await fs.unlink(req.file.path);
    throw new ApiError(400, 'El archivo debe ser Excel (.xlsx o .xls)');
  }

  try {
    // Procesar archivo
    const resultados = await operacionesMasivasService.consultarDesdeExcel(req.file.path, req.campanaId);

    // Eliminar archivo temporal
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      message: 'Archivo procesado exitosamente',
      data: resultados
    });
  } catch (error) {
    // Eliminar archivo en caso de error
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }
});

/**
 * @desc    Actualizar desde archivo Excel
 * @route   POST /api/v1/masivas/actualizar-excel
 * @access  Private (Admin only)
 */
exports.actualizarDesdeExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No se ha subido ningún archivo');
  }

  // Validar que sea Excel
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    await fs.unlink(req.file.path);
    throw new ApiError(400, 'El archivo debe ser Excel (.xlsx o .xls)');
  }

  try {
    // Procesar archivo
    const resultados = await operacionesMasivasService.actualizarDesdeExcel(
      req.file.path,
      req.user._id,
      req.campanaId
    );

    // Eliminar archivo temporal
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      message: 'Actualización masiva completada',
      data: resultados
    });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }
});

/**
 * @desc    Descargar reporte de resultados
 * @route   POST /api/v1/masivas/generar-reporte
 * @access  Private (Admin only)
 */
exports.generarReporte = asyncHandler(async (req, res) => {
  const { resultados } = req.body;

  if (!resultados) {
    throw new ApiError(400, 'Se requieren los resultados para generar el reporte');
  }

  // Generar Excel
  const workbook = await operacionesMasivasService.generarReporteExcel(resultados);

  // Configurar headers para descarga
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=reporte_${Date.now()}.xlsx`
  );

  // Enviar archivo
  await workbook.xlsx.write(res);
  res.end();
});

/**
 * @desc    Obtener estado de procesamiento masivo
 * @route   GET /api/v1/masivas/estado
 * @access  Private (Admin only)
 */
exports.obtenerEstado = asyncHandler(async (req, res) => {
  const estado = await operacionesMasivasService.obtenerEstadoProcesamientoMasivo(req.campanaFilter);

  res.json({
    success: true,
    data: estado
  });
});

/**
 * @desc    Obtener resultados completados con datos de votación
 * @route   GET /api/v1/masivas/resultados
 * @access  Private (Admin only)
 */
exports.obtenerResultados = asyncHandler(async (req, res) => {
  const resultados = await operacionesMasivasService.obtenerResultadosCompletados(req.campanaFilter);

  res.json({
    success: true,
    data: resultados
  });
});

/**
 * @desc    Descargar reporte Excel con datos de votación
 * @route   GET /api/v1/masivas/reporte-resultados
 * @access  Private (Admin only)
 */
exports.descargarReporteResultados = asyncHandler(async (req, res) => {
  const workbook = await operacionesMasivasService.generarReporteResultadosRPA();

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=reporte_resultados_${Date.now()}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * @desc    Reintentar una consulta específica con error
 * @route   PUT /api/v1/masivas/errores/:id/reintentar
 * @access  Private (Admin only)
 */
exports.reintentarConsulta = asyncHandler(async (req, res) => {
  const resultado = await operacionesMasivasService.reintentarConsulta(req.params.id);

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Eliminar una consulta específica con error
 * @route   DELETE /api/v1/masivas/errores/:id
 * @access  Private (Admin only)
 */
exports.eliminarConsulta = asyncHandler(async (req, res) => {
  const resultado = await operacionesMasivasService.eliminarConsulta(req.params.id);

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Reintentar todas las consultas con error
 * @route   PUT /api/v1/masivas/errores/reintentar-todos
 * @access  Private (Admin only)
 */
exports.reintentarTodosErrores = asyncHandler(async (req, res) => {
  const resultado = await operacionesMasivasService.reintentarTodosErrores();

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Eliminar todas las consultas con error
 * @route   DELETE /api/v1/masivas/errores/todos
 * @access  Private (Admin only)
 */
exports.eliminarTodosErrores = asyncHandler(async (req, res) => {
  const resultado = await operacionesMasivasService.eliminarTodosErrores();

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Limpiar cola de consultas antiguas
 * @route   DELETE /api/v1/masivas/limpiar-cola
 * @access  Private (Admin only)
 */
exports.limpiarCola = asyncHandler(async (req, res) => {
  const { dias = 7 } = req.query;

  const resultado = await operacionesMasivasService.limpiarCola(Number(dias));

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Descargar plantilla Excel
 * @route   GET /api/v1/masivas/plantilla
 * @access  Private (Admin only)
 */
exports.descargarPlantilla = asyncHandler(async (req, res) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  
  // Plantilla para consultas
  const wsConsulta = workbook.addWorksheet('Consultas');
  wsConsulta.columns = [
    { header: 'Cédula', key: 'cedula', width: 15 }
  ];
  
  // Agregar ejemplos
  wsConsulta.addRow({ cedula: '1234567890' });
  wsConsulta.addRow({ cedula: '9876543210' });
  
  // Estilos
  wsConsulta.getRow(1).font = { bold: true };
  wsConsulta.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  wsConsulta.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Plantilla para actualización
  const wsActualizacion = workbook.addWorksheet('Actualizacion');
  wsActualizacion.columns = [
    { header: 'Cédula', key: 'cedula', width: 15 },
    { header: 'Teléfono', key: 'telefono', width: 15 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Estado Contacto', key: 'estadoContacto', width: 20 },
    { header: 'Notas', key: 'notas', width: 40 }
  ];
  
  // Agregar ejemplos
  wsActualizacion.addRow({
    cedula: '1234567890',
    telefono: '3001234567',
    email: 'ejemplo@email.com',
    estadoContacto: 'CONFIRMADO',
    notas: 'Ejemplo de notas'
  });
  
  // Estilos
  wsActualizacion.getRow(1).font = { bold: true };
  wsActualizacion.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  wsActualizacion.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Instrucciones
  const wsInstrucciones = workbook.addWorksheet('Instrucciones');
  wsInstrucciones.getColumn(1).width = 80;
  
  wsInstrucciones.addRow(['INSTRUCCIONES DE USO']);
  wsInstrucciones.addRow([]);
  wsInstrucciones.addRow(['Hoja "Consultas":']);
  wsInstrucciones.addRow(['- Coloca una cédula por fila en la columna A']);
  wsInstrucciones.addRow(['- Las cédulas deben tener entre 7 y 10 dígitos']);
  wsInstrucciones.addRow(['- El sistema buscará en la BD y consultará en Registraduría las que no existan']);
  wsInstrucciones.addRow([]);
  wsInstrucciones.addRow(['Hoja "Actualización":']);
  wsInstrucciones.addRow(['- Columna A: Cédula (requerida)']);
  wsInstrucciones.addRow(['- Columna B: Teléfono (opcional)']);
  wsInstrucciones.addRow(['- Columna C: Email (opcional)']);
  wsInstrucciones.addRow(['- Columna D: Estado Contacto (CONFIRMADO, PENDIENTE, NO_CONTACTADO)']);
  wsInstrucciones.addRow(['- Columna E: Notas (opcional)']);
  wsInstrucciones.addRow([]);
  wsInstrucciones.addRow(['IMPORTANTE:']);
  wsInstrucciones.addRow(['- No elimines la fila de encabezados']);
  wsInstrucciones.addRow(['- Guarda el archivo como .xlsx']);
  
  wsInstrucciones.getCell('A1').font = { bold: true, size: 14 };

  // Enviar archivo
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=plantilla_elector360.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});