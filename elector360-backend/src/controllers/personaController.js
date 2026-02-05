const asyncHandler = require('../utils/asyncHandler');
const personaService = require('../services/personaService');
const Persona = require('../models/Persona');

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
    zona
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
    req.user.rol
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
  const persona = await Persona.findOne({ documento: req.params.documento });

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
  const persona = await personaService.crearPersona(req.body, req.user);

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
    req.user.rol
  );

  res.json({
    success: true,
    message: 'Persona actualizada exitosamente',
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

  const filtros = { departamento, municipio, nombrePuesto };

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
    liderId
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
  const filtros = {};

  // Si es LIDER, solo exporta sus personas
  if (req.user.rol === 'LIDER') {
    filtros.liderId = req.user._id;
  }

  const csv = await personaService.exportarCSV(filtros);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=personas.csv');
  res.send(csv);
});