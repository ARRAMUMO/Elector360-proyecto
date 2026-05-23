const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Usuario = require('../models/Usuario');
const Persona = require('../models/Persona');
const ExcelJS = require('exceljs');
const { ROLES } = require('../config/constants');

// Colores corporativos (mismo estilo que E-14)
const COLOR_HEADER   = 'FF1E3A5F'; // azul oscuro
const COLOR_LIDER    = 'FF2E7D32'; // verde oscuro
const COLOR_LIDER_FG = 'FFFFFFFF';
const COLOR_ALT      = 'FFF5F5F5'; // gris claro filas alternas

const ESTADO_CONTACTO = { CONFIRMADO: 'Confirmado', CONTACTADO: 'Contactado', PENDIENTE: 'Pendiente', NO_CONTACTADO: 'No contactado' };
const ESTADO_VOTO     = { CUMPLIDO: 'Votó', PENDIENTE: 'Pendiente', NO_VOTO: 'No votó' };

/**
 * Obtiene datos del coordinador + sus líderes + personas.
 * Reutilizado por informeCoordinador y exportarExcel.
 */
async function obtenerDatosInforme(coordinadorId, campanaId) {
  const coordinador = await Usuario.findOne({ _id: coordinadorId, rol: ROLES.COORDINADOR })
    .select('perfil email campana campanas');
  if (!coordinador) throw new ApiError(404, 'Coordinador no encontrado');

  const lideres = await Usuario.find({ coordinadorId, rol: ROLES.LIDER, estado: 'ACTIVO' })
    .select('perfil email stats');

  const liderIds = lideres.map(l => l._id);

  const filtroPersonas = { 'lider.id': { $in: liderIds }, confirmado: true };
  if (campanaId) filtroPersonas.campana = campanaId;

  const todasPersonas = await Persona.find(filtroPersonas)
    .select('documento nombres apellidos puesto lider estadoContacto estadoVoto telefono')
    .sort({ 'lider.nombre': 1, apellidos: 1 });

  const lideresMap = {};
  for (const l of lideres) {
    lideresMap[l._id.toString()] = {
      lider: { _id: l._id, nombre: `${l.perfil.nombres} ${l.perfil.apellidos}`, email: l.email, totalPersonas: 0 },
      personas: []
    };
  }
  for (const p of todasPersonas) {
    const lid = p.lider?.id?.toString();
    if (lid && lideresMap[lid]) {
      lideresMap[lid].personas.push(p);
      lideresMap[lid].lider.totalPersonas++;
    }
  }

  return {
    coordinador: { _id: coordinador._id, nombre: `${coordinador.perfil.nombres} ${coordinador.perfil.apellidos}`, email: coordinador.email },
    lideres: Object.values(lideresMap).sort((a, b) => a.lider.nombre.localeCompare(b.lider.nombre)),
    totales: { lideres: lideres.length, personas: todasPersonas.length }
  };
}

/**
 * @desc    Listar coordinadores disponibles
 * @route   GET /api/v1/informes/coordinadores
 * @access  ADMIN
 */
exports.listarCoordinadores = asyncHandler(async (req, res) => {
  const campanaId = req.query.campanaId || req.campanaId;
  const filtro = { rol: ROLES.COORDINADOR, estado: 'ACTIVO' };
  if (campanaId) {
    filtro.$or = [{ campana: campanaId }, { campanas: campanaId }];
  }

  const coordinadores = await Usuario.find(filtro)
    .select('perfil email campana campanas')
    .sort({ 'perfil.apellidos': 1 });

  const resultado = await Promise.all(coordinadores.map(async (coord) => {
    const totalLideres = await Usuario.countDocuments({ rol: ROLES.LIDER, coordinadorId: coord._id, estado: 'ACTIVO' });
    return { _id: coord._id, nombre: `${coord.perfil.nombres} ${coord.perfil.apellidos}`, email: coord.email, totalLideres };
  }));

  res.json({ success: true, data: resultado });
});

/**
 * @desc    Informe JSON de personas por coordinador
 * @route   GET /api/v1/informes/coordinador/:coordinadorId
 * @access  ADMIN
 */
exports.informeCoordinador = asyncHandler(async (req, res) => {
  const campanaId = req.query.campanaId || req.campanaId || null;
  const datos = await obtenerDatosInforme(req.params.coordinadorId, campanaId);
  res.json({ success: true, data: datos });
});

/**
 * @desc    Exportar informe Excel de personas por coordinador
 * @route   GET /api/v1/informes/coordinador/:coordinadorId/excel
 * @access  ADMIN
 */
exports.exportarExcel = asyncHandler(async (req, res) => {
  const campanaId = req.query.campanaId || req.campanaId || null;
  const { coordinadorId } = req.params;
  const datos = await obtenerDatosInforme(coordinadorId, campanaId);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Elector360';
  wb.created = new Date();

  // ── Hoja 1: Personas (lista plana, mismo estilo que E-14) ─────────────────
  const wsPersonas = wb.addWorksheet('Personas');
  wsPersonas.columns = [
    { header: 'Coordinador',     key: 'coordinador', width: 28 },
    { header: 'Líder',           key: 'lider',       width: 28 },
    { header: 'Nombres',         key: 'nombres',     width: 20 },
    { header: 'Apellidos',       key: 'apellidos',   width: 22 },
    { header: 'Teléfono',        key: 'telefono',    width: 14 },
    { header: 'Municipio',       key: 'municipio',   width: 18 },
    { header: 'Zona',            key: 'zona',        width: 8  },
    { header: 'Puesto',          key: 'puesto',      width: 32 },
    { header: 'Mesa',            key: 'mesa',        width: 8  },
    { header: 'Estado contacto', key: 'contacto',    width: 16 },
    { header: 'Estado voto',     key: 'voto',        width: 14 },
  ];
  estilarEncabezado(wsPersonas, COLOR_HEADER);

  const COLORES_VOTO = { CUMPLIDO: 'FF81C784', NO_VOTO: 'FFE57373', PENDIENTE: 'FFFFF176' };

  let filaIdx = 2;
  for (const grupo of datos.lideres) {
    for (const p of grupo.personas) {
      const fila = wsPersonas.addRow({
        coordinador: datos.coordinador.nombre,
        lider:       grupo.lider.nombre,
        nombres:     p.nombres   || '',
        apellidos:   p.apellidos || '',
        telefono:    p.telefono  || '',
        municipio:   p.puesto?.municipio    || '',
        zona:        p.puesto?.zona         || '',
        puesto:      p.puesto?.nombrePuesto || '',
        mesa:        p.puesto?.mesa         || '',
        contacto:    ESTADO_CONTACTO[p.estadoContacto] || p.estadoContacto || '',
        voto:        ESTADO_VOTO[p.estadoVoto]         || p.estadoVoto     || '',
      });

      // Filas alternas
      if (filaIdx % 2 === 0) {
        fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ALT } };
      }

      // Color celda Estado voto
      const colorVoto = COLORES_VOTO[p.estadoVoto];
      if (colorVoto) {
        fila.getCell('voto').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorVoto } };
        fila.getCell('voto').font = { bold: true };
      }
      filaIdx++;
    }
  }

  wsPersonas.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Hoja 2: Resumen por líder ──────────────────────────────────────────────
  const wsResumen = wb.addWorksheet('Resumen');
  wsResumen.columns = [
    { header: 'Coordinador',    key: 'coordinador', width: 28 },
    { header: 'Líder',          key: 'lider',       width: 30 },
    { header: 'Email',          key: 'email',       width: 30 },
    { header: 'Total Personas', key: 'total',       width: 16 },
  ];
  estilarEncabezado(wsResumen, COLOR_HEADER);

  for (const grupo of datos.lideres) {
    wsResumen.addRow({
      coordinador: datos.coordinador.nombre,
      lider: grupo.lider.nombre,
      email: grupo.lider.email,
      total: grupo.lider.totalPersonas
    });
  }
  const filaTotales = wsResumen.addRow({ coordinador: 'TOTAL', lider: '', email: '', total: datos.totales.personas });
  filaTotales.font = { bold: true };
  filaTotales.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
  wsResumen.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Enviar archivo ──────────────────────────────────────────────────────────
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = datos.coordinador.nombre.replace(/\s+/g, '-').toLowerCase();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="informe-${nombre}-${fecha}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

function estilarEncabezado(ws, colorArgb) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 20;
}
