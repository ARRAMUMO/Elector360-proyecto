const asyncHandler = require('../utils/asyncHandler');
const personaService = require('../services/personaService');
const Persona = require('../models/Persona');
const ApiError = require('../utils/ApiError');
const path = require('path');
const fs = require('fs').promises;

/**
 * @desc    Listar personas
 * @route   GET /api/v1/personas
 * @access  Private
 */
exports.listarPersonas = asyncHandler(async (req, res) => {
  const { page, limit, search, estadoContacto, estadoRPA, departamento, municipio, mesa, nombrePuesto, zona } = req.query;

  const filtros = {
    search,
    estadoContacto,
    estadoRPA,
    departamento,
    municipio,
    mesa,
    nombrePuesto,
    zona,
    campanaFilter: req.campanaFilter
  };

  // Si es LIDER, solo ve sus personas
  if (req.user.rol === 'LIDER') {
    filtros.liderId = req.user._id;
  }

  const resultado = await personaService.listarPersonas(filtros, { page, limit });

  res.json({
    success: true,
    data: resultado
  });
});

/**
 * @desc    Obtener persona por ID
 * @route   GET /api/v1/personas/:id
 * @access  Private
 */
exports.obtenerPersona = asyncHandler(async (req, res) => {
  const persona = await personaService.obtenerPorId(
    req.params.id,
    req.user._id,
    req.user.rol,
    req.campanaId
  );

  res.json({
    success: true,
    data: persona
  });
});

/**
 * @desc    Obtener persona por documento
 * @route   GET /api/v1/personas/documento/:documento
 * @access  Private
 */
exports.obtenerPorDocumento = asyncHandler(async (req, res) => {
  const query = { documento: req.params.documento, ...req.campanaFilter };
  const persona = await Persona.findOne(query);

  if (!persona) {
    return res.json({
      success: true,
      data: null,
      message: 'Persona no encontrada'
    });
  }

  // Si es LIDER, verificar que sea su persona
  if (req.user.rol === 'LIDER' && persona.lider?.id?.toString() !== req.user._id.toString()) {
    return res.json({
      success: true,
      data: null,
      message: 'Persona no encontrada'
    });
  }

  res.json({
    success: true,
    data: persona
  });
});

/**
 * @desc    Crear persona
 * @route   POST /api/v1/personas
 * @access  Private
 */
exports.crearPersona = asyncHandler(async (req, res) => {
  const persona = await personaService.crearPersona(req.body, req.user, req.campanaId);

  res.status(201).json({
    success: true,
    message: 'Persona creada exitosamente',
    data: persona
  });
});

/**
 * @desc    Actualizar persona
 * @route   PUT /api/v1/personas/:id
 * @access  Private
 */
exports.actualizarPersona = asyncHandler(async (req, res) => {
  const persona = await personaService.actualizarPersona(
    req.params.id,
    req.body,
    req.user._id,
    req.user.rol,
    req.campanaId
  );

  res.json({
    success: true,
    message: 'Persona actualizada exitosamente',
    data: persona
  });
});

/**
 * @desc    Asignar o reasignar líder a una persona
 * @route   PUT /api/v1/personas/:id/asignar-lider
 * @access  Private (Coordinador/Admin)
 */
exports.asignarLider = asyncHandler(async (req, res) => {
  const { liderId } = req.body;

  if (!liderId) {
    throw new ApiError(400, 'Falta el campo liderId');
  }

  const Usuario = require('../models/Usuario');
  const nuevoLider = await Usuario.findById(liderId);
  if (!nuevoLider) {
    throw new ApiError(404, 'Usuario líder no encontrado');
  }

  const persona = await Persona.findById(req.params.id);
  if (!persona) {
    throw new ApiError(404, 'Persona no encontrada');
  }
  if (req.campanaId && persona.campana?.toString() !== req.campanaId.toString()) {
    throw new ApiError(403, 'Persona fuera del scope de campaña');
  }

  const consultaServiceInstance = require('../services/consultaService');
  const liderAnteriorId = persona.lider?.id;

  persona.lider = {
    id: nuevoLider._id,
    nombre: `${nuevoLider.perfil.nombres} ${nuevoLider.perfil.apellidos}`,
    email: nuevoLider.email
  };
  persona.confirmado = true;
  await persona.save();

  if (liderAnteriorId && liderAnteriorId.toString() !== liderId.toString()) {
    await consultaServiceInstance.actualizarStatsUsuario(liderAnteriorId);
  }
  await consultaServiceInstance.actualizarStatsUsuario(nuevoLider._id);

  res.json({
    success: true,
    message: 'Líder asignado exitosamente',
    data: persona
  });
});

/**
 * @desc    Eliminar persona
 * @route   DELETE /api/v1/personas/:id
 * @access  Private (Admin only)
 */
exports.eliminarPersona = asyncHandler(async (req, res) => {
  const resultado = await personaService.eliminarPersona(req.params.id);

  res.json({
    success: true,
    message: resultado.message
  });
});

/**
 * @desc    Obtener mesas de votación con estadísticas
 * @route   GET /api/v1/personas/mesas
 * @access  Private
 */
exports.obtenerMesas = asyncHandler(async (req, res) => {
  const { departamento, municipio, nombrePuesto } = req.query;

  const filtros = { departamento, municipio, nombrePuesto, campanaFilter: req.campanaFilter };

  // Si es LIDER, solo ve sus mesas
  if (req.user.rol === 'LIDER') {
    filtros.liderId = req.user._id;
  }

  const mesas = await personaService.obtenerMesasVotacion(filtros);

  res.json({
    success: true,
    data: mesas,
    total: mesas.length
  });
});

/**
 * @desc    Obtener personas por mesa específica
 * @route   GET /api/v1/personas/mesas/detalle
 * @access  Private
 */
exports.obtenerPersonasPorMesa = asyncHandler(async (req, res) => {
  const { departamento, municipio, nombrePuesto, mesa } = req.query;

  const liderId = req.user.rol === 'LIDER' ? req.user._id : null;

  const personas = await personaService.obtenerPersonasPorMesa(
    { departamento, municipio, nombrePuesto, mesa },
    liderId,
    req.campanaFilter
  );

  res.json({
    success: true,
    data: personas,
    total: personas.length
  });
});

/**
 * @desc    Exportar personas a CSV
 * @route   GET /api/v1/personas/export/csv
 * @access  Private
 */
exports.exportarCSV = asyncHandler(async (req, res) => {
  const filtros = { ...req.campanaFilter };

  // Si es LIDER, solo exporta sus personas
  if (req.user.rol === 'LIDER') {
    filtros.liderId = req.user._id;
  }

  const csv = await personaService.exportarCSV(filtros);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=personas.csv');
  res.send(csv);
});

/**
 * @desc    Exportar personas a Excel
 * @route   GET /api/v1/personas/export/excel
 * @access  Private
 */
exports.exportarExcel = asyncHandler(async (req, res) => {
  const filtros = { ...req.campanaFilter };

  if (req.user.rol === 'LIDER') {
    filtros.liderId = req.user._id;
  }

  const workbook = await personaService.exportarExcel(filtros);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=personas-${Date.now()}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * @desc    Importar personas desde Excel con datos completos
 * @route   POST /api/v1/personas/importar
 * @access  Private (Admin only)
 */
exports.importarDesdeExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No se ha subido ningún archivo');
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    await fs.unlink(req.file.path);
    throw new ApiError(400, 'El archivo debe ser Excel (.xlsx o .xls)');
  }

  try {
    const resultado = await personaService.importarDesdeExcel(req.file.path, req.user, req.campanaId);
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      message: `Importación completada: ${resultado.creadas} creadas, ${resultado.actualizadas} actualizadas`,
      data: resultado
    });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }
});

/**
 * @desc    Descargar plantilla para importar personas
 * @route   GET /api/v1/personas/plantilla-importacion
 * @access  Private (Admin only)
 */
exports.descargarPlantillaImportacion = asyncHandler(async (req, res) => {
  const workbook = await personaService.generarPlantillaImportacion();

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=plantilla_importar_personas.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});