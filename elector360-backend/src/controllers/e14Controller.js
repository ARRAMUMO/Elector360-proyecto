const asyncHandler = require('../utils/asyncHandler');
const e14Service = require('../services/e14Service');
const ApiError = require('../utils/ApiError');

/**
 * @desc    Guardar resultado de una mesa (crear o actualizar)
 * @route   POST /api/v1/e14/resultados
 * @access  Admin, Coordinador
 */
exports.guardarResultado = asyncHandler(async (req, res) => {
  const resultado = await e14Service.guardarResultado(req.body, req.campanaId);
  res.status(201).json({ success: true, data: resultado });
});

/**
 * @desc    Listar resultados de la campaña
 * @route   GET /api/v1/e14/resultados
 * @access  Todos
 */
exports.listarResultados = asyncHandler(async (req, res) => {
  const { municipio, zona, candidatoNumero } = req.query;
  const resultados = await e14Service.listarResultados(req.campanaId, { municipio, zona, candidatoNumero });
  res.json({ success: true, data: resultados });
});

/**
 * @desc    Actualizar resultado de una mesa
 * @route   PUT /api/v1/e14/resultados/:id
 * @access  Admin, Coordinador
 */
exports.actualizarResultado = asyncHandler(async (req, res) => {
  const resultado = await e14Service.guardarResultado(
    { ...req.body, _id: req.params.id },
    req.campanaId
  );
  res.json({ success: true, data: resultado });
});

/**
 * @desc    Eliminar resultado
 * @route   DELETE /api/v1/e14/resultados/:id
 * @access  Admin
 */
exports.eliminarResultado = asyncHandler(async (req, res) => {
  await e14Service.eliminarResultado(req.params.id, req.campanaId);
  res.json({ success: true, message: 'Resultado eliminado' });
});

/**
 * @desc    Análisis cruzado mesas × seguidores
 * @route   GET /api/v1/e14/analisis
 * @access  Todos
 */
exports.obtenerAnalisis = asyncHandler(async (req, res) => {
  const { municipio, zona, candidatoNumero, limit, offset } = req.query;
  const analisis = await e14Service.obtenerAnalisis(req.campanaId, { municipio, zona, candidatoNumero, limit, offset });
  res.json({ success: true, data: analisis, total: analisis.length });
});

/**
 * @desc    Resumen general (tarjetas)
 * @route   GET /api/v1/e14/resumen
 * @access  Todos
 */
exports.obtenerResumen = asyncHandler(async (req, res) => {
  const resumen = await e14Service.obtenerResumen(req.campanaId);
  res.json({ success: true, data: resumen });
});

/**
 * @desc    Lista los seguidores registrados en la mesa de un resultado
 * @route   GET /api/v1/e14/resultados/:id/seguidores
 * @access  Todos
 */
exports.obtenerSeguidoresMesa = asyncHandler(async (req, res) => {
  const data = await e14Service.obtenerSeguidoresMesa(req.params.id, req.campanaId);
  res.json({ success: true, data });
});

/**
 * @desc    Importar resultados desde un archivo Excel
 * @route   POST /api/v1/e14/importar-excel
 * @access  Admin, Coordinador, Lider
 */
exports.importarExcel = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Se requiere un archivo Excel (.xlsx)');

  const { candidatoNumero, candidatoNombre, partido, fechaEleccion } = req.body;
  const metadatos = { candidatoNumero, candidatoNombre, partido, fechaEleccion };

  const resultado = await e14Service.importarDesdeExcel(req.file.path, metadatos, req.campanaId);
  res.json({ success: true, data: resultado });
});

/**
 * @desc    Verificar cumplimiento de voto cruzando E-14 × Personas por mesa
 * @route   POST /api/v1/e14/verificar-votos
 * @access  Admin, Coordinador, Lider
 */
exports.verificarVotos = asyncHandler(async (req, res) => {
  const resultado = await e14Service.verificarVotosMesas(req.campanaId);
  res.json({ success: true, data: resultado });
});

/**
 * @desc    Verificar cobertura de puestos: Personas vs ResultadoMesa importados
 * @route   GET /api/v1/e14/verificar-puestos
 * @access  Admin, Coordinador
 */
exports.verificarPuestosVotacion = asyncHandler(async (req, res) => {
  const data = await e14Service.verificarPuestosVotacion(req.campanaId);
  res.json({ success: true, data });
});

/**
 * @desc    Vista del líder: sus personas con estadoVoto calculado
 * @route   GET /api/v1/e14/mis-personas
 * @access  Lider, Coordinador, Admin
 */
exports.getMisPersonas = asyncHandler(async (req, res) => {
  const liderId = req.query.liderId || req.user._id;
  const data = await e14Service.obtenerMisPersonas(req.campanaId, liderId);
  res.json({ success: true, data });
});

/**
 * @desc    Exportar informe de verificación (Excel)
 * @route   GET /api/v1/e14/exportar-informe
 * @access  Todos
 */
exports.exportarInforme = asyncHandler(async (req, res) => {
  let liderFiltro = req.user.rol === 'LIDER' ? req.user._id : null;
  // ADMIN/COORDINADOR pueden filtrar por líder específico vía ?liderId=
  if (req.user.rol !== 'LIDER' && req.query.liderId) {
    liderFiltro = req.query.liderId;
  }
  const tipo = req.query.tipo === 'resumen' ? 'resumen' : 'personas';
  const wb = await e14Service.exportarInforme(req.campanaId, liderFiltro, tipo);
  const fecha = new Date().toISOString().slice(0, 10);
  const nombreUsuario = (req.user.perfil?.nombres || req.user.email || 'usuario').split(' ')[0].toLowerCase();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="informe-e14-${tipo}-${fecha}-${nombreUsuario}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

/**
 * @desc    Informe de un líder: mesas con personas, votos y otros líderes
 * @route   GET /api/v1/e14/informe-lider
 * @access  Lider (propio), Coordinador/Admin (con ?liderId=)
 */
exports.getInformeLider = asyncHandler(async (req, res) => {
  const liderId = req.user.rol === 'LIDER' ? req.user._id : req.query.liderId;
  if (!liderId) throw new ApiError(400, 'liderId es requerido');
  const data = await e14Service.obtenerInformeLider(req.campanaId, liderId);
  res.json({ success: true, data });
});

/**
 * @desc    Borrar todos los ResultadoMesa de la campaña
 * @route   DELETE /api/v1/e14/resultados
 * @access  Admin
 */
exports.limpiarResultados = asyncHandler(async (req, res) => {
  if (!req.campanaId) throw new ApiError(400, 'No hay campaña activa');
  const ResultadoMesa = require('../models/ResultadoMesa');
  const { deletedCount } = await ResultadoMesa.deleteMany({ campana: req.campanaId });
  res.json({ success: true, message: `${deletedCount} resultados eliminados` });
});
