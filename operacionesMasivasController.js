const operacionesMasivasService = require('../services/operacionesMasivasService');
const ExcelJS = require('exceljs');

/**
 * Iniciar actualización masiva de toda la BD
 */
exports.actualizarTodo = async (req, res) => {
  try {
    const result = await operacionesMasivasService.actualizarBaseDatosCompleta();
    res.json({
      success: true,
      message: 'Actualización masiva iniciada',
      data: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Consultar personas desde archivo Excel
 */
exports.consultarExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }

    const result = await operacionesMasivasService.consultarDesdeExcel(req.file.path);
    
    res.json({
      success: true,
      message: 'Archivo procesado exitosamente',
      data: result
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Actualizar personas desde archivo Excel
 */
exports.actualizarExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }

    const result = await operacionesMasivasService.actualizarDesdeExcel(req.file.path, req.user._id);
    
    res.json({
      success: true,
      message: 'Actualización masiva completada',
      data: result
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Obtener estado del procesamiento
 */
exports.obtenerEstado = async (req, res) => {
  try {
    const estado = await operacionesMasivasService.obtenerEstadoProcesamientoMasivo();
    res.json({ success: true, data: estado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generar reporte Excel de resultados (recibe JSON, devuelve archivo)
 */
exports.generarReporte = async (req, res) => {
  try {
    const { resultados } = req.body;
    if (!resultados) {
      return res.status(400).json({ success: false, message: 'Se requieren los resultados para generar el reporte' });
    }

    const workbook = await operacionesMasivasService.generarReporteExcel(resultados);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_resultados.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Descargar plantilla de Excel
 */
exports.descargarPlantilla = async (req, res) => {
  try {
    // Crear un workbook simple como plantilla
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Consultas');
    sheet.addRow(['Cédula']);
    sheet.addRow(['1234567890']);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_elector360.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};