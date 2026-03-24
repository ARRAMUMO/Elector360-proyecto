const ResultadoMesa = require('../models/ResultadoMesa');
const Persona = require('../models/Persona');
const ApiError = require('../utils/ApiError');
const ExcelJS = require('exceljs');
const fs = require('fs');
const mongoose = require('mongoose');

// Filtro que incluye personas de campana principal Y campanas aliadas (campanas[])
const filtroCampana = (campanaId) => ({
  $or: [{ campana: campanaId }, { campanas: campanaId }]
});

/**
 * Genera variantes de un valor numérico con distintos ceros iniciales.
 * Ej: "005" → ["005","5","05"], "00" → ["00","0"]
 * Así el query $in matchea sin importar cómo lo guardó el scraper.
 */
const numVariants = (val) => {
  if (val === null || val === undefined) return [val];
  const s = String(val).trim();
  const n = parseInt(s, 10);
  if (isNaN(n)) return [s];
  const base = String(n);
  return [...new Set([s, base, base.padStart(2, '0'), base.padStart(3, '0')])];
};

/**
 * Guardar o actualizar resultado de una mesa (upsert)
 */
const guardarResultado = async (datos, campanaId) => {
  const { municipio, zona, nombrePuesto, mesa, candidatoNumero, ...resto } = datos;

  if (!campanaId) {
    throw new ApiError(400, 'No hay campaña activa asignada a tu usuario. Contacta al administrador.');
  }

  if (!municipio || !zona || !mesa || !candidatoNumero) {
    throw new ApiError(400, 'municipio, zona, mesa y candidatoNumero son requeridos');
  }

  const filtro = { campana: campanaId, departamento: datos.departamento || '', municipio, zona, nombrePuesto: nombrePuesto || '', mesa, candidatoNumero };
  // eslint-disable-next-line no-unused-vars
  const { _id, __v, ...datosLimpios } = resto;
  const update = { ...datosLimpios, municipio, zona, mesa, candidatoNumero, campana: campanaId };

  const resultado = await ResultadoMesa.findOneAndUpdate(
    filtro,
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  );

  return resultado;
};

/**
 * Listar resultados de la campaña con filtros opcionales
 */
const listarResultados = async (campanaId, filtros = {}) => {
  const query = { campana: campanaId };

  if (filtros.municipio) query.municipio = new RegExp(filtros.municipio, 'i');
  if (filtros.zona) query.zona = new RegExp(filtros.zona, 'i');
  if (filtros.candidatoNumero) query.candidatoNumero = filtros.candidatoNumero;

  const limit = filtros.limit ? parseInt(filtros.limit, 10) : 0;
  const offset = filtros.offset ? parseInt(filtros.offset, 10) : 0;

  let q = ResultadoMesa.find(query).sort({ municipio: 1, zona: 1, mesa: 1 });
  if (offset) q = q.skip(offset);
  if (limit) q = q.limit(limit);

  const resultados = await q;
  return resultados;
};

/**
 * Obtener un resultado por ID
 */
const obtenerPorId = async (id, campanaId) => {
  const resultado = await ResultadoMesa.findOne({ _id: id, campana: campanaId });
  if (!resultado) throw new ApiError(404, 'Resultado no encontrado');
  return resultado;
};

/**
 * Eliminar resultado
 */
const eliminarResultado = async (id, campanaId) => {
  const resultado = await ResultadoMesa.findOneAndDelete({ _id: id, campana: campanaId });
  if (!resultado) throw new ApiError(404, 'Resultado no encontrado');
  return resultado;
};

/**
 * Elimina tildes/diacríticos: "ATLÁNTICO" → "ATLANTICO"
 */
const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Extrae el número de un valor que puede ser "5", "005", "ZONA 5", "Z-005", etc.
 * Retorna el entero como string, o "0" si no hay número válido.
 */
const extractNum = (val) => {
  const s = String(val || '').trim();
  // Intentar parsear directamente (caso más común: "5", "005")
  const direct = parseInt(s, 10);
  if (!isNaN(direct)) return String(direct);
  // Si es texto como "ZONA 5" o "Z-005", extraer el primer número
  const match = s.match(/\d+/);
  return match ? String(parseInt(match[0], 10)) : '0';
};

// Stop words y prefijos de institución para normalización de puesto
const STOP_WORDS_PUESTO = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'en', 'a', 'al', 'un', 'una',
  'con', 'por', 'para', 'su', 'sus', 'mi', 'nos'
]);

const PREFIJOS_INSTITUCION = [
  'institucion educativa distrital', 'institucion educativa', 'institucion distrital',
  'institucion', 'concentracion educativa', 'concentracion', 'centro educativo',
  'centro de educacion', 'colegio distrital', 'colegio', 'normal superior', 'normal',
  'escuela normal', 'escuela', 'liceo', 'tecnico', 'tecnica', 'tecnologico',
  'tecnologica', 'ied', 'i e d', 'ie', 'i e', 'ita', 'i t a', 'it', 'i t',
  'inst', 'col', 'distrital', 'departamental', 'municipal', 'nacional'
];

/**
 * Normaliza el nombre de un puesto de votación para comparar entre Excel y scraper.
 * - Quita tildes, pasa a minúsculas
 * - Elimina prefijo numérico: "03 - COL X" → "col x"
 * - Elimina TODA puntuación (puntos, guiones, paréntesis, etc.)
 * - Elimina prefijos de institución (col, colegio, ied, ie, etc.)
 * - Elimina sufijos (bloque, sede, etc.)
 * - Elimina palabras de 1 carácter (abreviaciones: "s.", "n.", etc.)
 * - Elimina stop words (de, del, la, el, etc.)
 */
const normalizarPuesto = (nombre) => {
  let s = sinTildes((nombre || '').toLowerCase().trim());

  // Quita prefijo numérico "03 - "
  s = s.replace(/^\d+\s*[-–]\s*/, '');

  // Quita TODA puntuación y caracteres especiales (incluye puntos, guiones, #, etc.)
  s = s.replace(/[^a-z0-9\s]/g, ' ');

  // Normaliza espacios
  s = s.replace(/\s+/g, ' ').trim();

  // Quita prefijos de institución al inicio (orden importa: más largo primero)
  for (const pref of PREFIJOS_INSTITUCION) {
    if (s.startsWith(pref + ' ') || s === pref) {
      s = s.slice(pref.length).trim();
      break;
    }
  }

  // Quita sufijos: "(bloque 1)", "bloque 2", "sede a", "no 1"
  s = s.replace(/\s*\(.*$/, '');
  s = s.replace(/\s+(?:blq|bloque)\s*\d*\s*$/, '');
  s = s.replace(/\s+sede\s+\w+\s*$/, '');
  s = s.replace(/\s+n[uo]?\s*\d+\s*$/, '');

  // Filtra palabras: quita palabras de 1 char y stop words
  s = s.split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS_PUESTO.has(w))
    .join(' ')
    .trim();

  return s;
};

/**
 * Devuelve el set de palabras de un puesto normalizado (para match por intersección)
 */
const palabrasPuesto = (nombre) => new Set(normalizarPuesto(nombre).split(' ').filter(Boolean));

/**
 * Score de similitud entre dos nombres de puesto (0-1).
 * Usa intersección de palabras: palabras compartidas / máximo de ambos conjuntos.
 */
const similitudPuesto = (a, b) => {
  const wa = palabrasPuesto(a);
  const wb = palabrasPuesto(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let comunes = 0;
  for (const w of wa) if (wb.has(w)) comunes++;
  return comunes / Math.max(wa.size, wb.size);
};

/**
 * Normaliza municipio/nombrePuesto/mesa a clave canónica para join en memoria.
 * NOTA: zona se excluye del join porque el scraper de Registraduría no la popula
 * de forma confiable (queda undefined/null). La combinación dep|mun|puesto|mesa
 * es única en la práctica para un municipio dado.
 */
const normKey = (departamento, municipio, _zona, nombrePuesto, mesa) => {
  const dep = sinTildes((departamento || '').toLowerCase().trim());
  const mun = sinTildes((municipio || '').toLowerCase().trim());
  const p = normalizarPuesto(nombrePuesto);
  const m = extractNum(mesa);
  return `${dep}|${mun}|${p}|${m}`;
};

/**
 * Análisis cruzado: ResultadoMesa × Personas
 * 2 queries totales + join en memoria (no depende del número de mesas).
 */
const obtenerAnalisis = async (campanaId, filtros = {}) => {
  const resultados = await listarResultados(campanaId, filtros);
  if (resultados.length === 0) return [];

  // Una sola query para obtener todos los puestos de personas
  const personas = await Persona.find(
    filtroCampana(campanaId),
    { 'puesto.departamento': 1, 'puesto.municipio': 1, 'puesto.zona': 1, 'puesto.nombrePuesto': 1, 'puesto.mesa': 1, estadoContacto: 1 }
  ).lean();

  // Construir mapa: clave-mesa → { total, confirmados }
  const countMap = new Map();
  for (const p of personas) {
    const key = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    const e = countMap.get(key) || { total: 0, confirmados: 0 };
    e.total++;
    if (p.estadoContacto === 'CONFIRMADO') e.confirmados++;
    countMap.set(key, e);
  }

  return resultados.map(r => {
    const key = normKey(r.departamento, r.municipio, r.zona, r.nombrePuesto, r.mesa);
    const { total: totalSeguidores = 0, confirmados = 0 } = countMap.get(key) || {};
    const votosTotal = (r.votosObtenidos || 0) + (r.votosLista || 0);
    const efectividad = totalSeguidores > 0
      ? Math.round((votosTotal / totalSeguidores) * 100)
      : null;
    const votosObt = r.votosObtenidos || 0;
    const estadoMesa = (votosObt === 0 || totalSeguidores === 0)
      ? 'NO_CUMPLIDO'
      : votosObt >= totalSeguidores
        ? 'CUMPLIDO'
        : 'VERIFICABLE';

    return {
      _id: r._id,
      departamento: r.departamento,
      municipio: r.municipio,
      zona: r.zona,
      nombrePuesto: r.nombrePuesto,
      mesa: r.mesa,
      candidatoNumero: r.candidatoNumero,
      candidatoNombre: r.candidatoNombre,
      partido: r.partido,
      votosObtenidos: r.votosObtenidos,
      votosLista: r.votosLista,
      votosTotal,
      totalVotantes: r.totalVotantes,
      potencialVotacion: r.potencialVotacion,
      fechaEleccion: r.fechaEleccion,
      totalSeguidores,
      confirmados,
      efectividad,
      estadoMesa,
      nivelEfectividad: efectividad === null ? 'SIN_DATOS'
        : efectividad >= 70 ? 'ALTO'
        : efectividad >= 40 ? 'MEDIO'
        : 'BAJO'
    };
  });
};

/**
 * Resumen general de la campaña
 * 2 queries totales + join en memoria.
 */
const obtenerResumen = async (campanaId) => {
  const [resultados, personas] = await Promise.all([
    ResultadoMesa.find({ campana: campanaId }).lean(),
    Persona.find(filtroCampana(campanaId), { 'puesto.departamento': 1, 'puesto.municipio': 1, 'puesto.zona': 1, 'puesto.nombrePuesto': 1, 'puesto.mesa': 1 }).lean()
  ]);

  if (resultados.length === 0) {
    return { totalVotosCandidato: 0, totalVotosLista: 0, mesasCubiertas: 0, potencialTotal: 0, totalSeguidores: 0, efectividadPromedio: null };
  }

  const totalVotosCandidato = resultados.reduce((sum, r) => sum + (r.votosObtenidos || 0), 0);
  const totalVotosLista = resultados.reduce((sum, r) => sum + (r.votosLista || 0), 0);
  const potencialTotal = resultados.reduce((sum, r) => sum + (r.potencialVotacion || 0), 0);

  // Conjunto de claves de mesas cubiertas por E-14
  const mesasCubiertasSet = new Set(resultados.map(r => normKey(r.departamento, r.municipio, r.zona, r.nombrePuesto, r.mesa)));

  // Contar personas cuyo puesto está en una mesa cubierta
  let totalSeguidores = 0;
  for (const p of personas) {
    if (mesasCubiertasSet.has(normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa))) {
      totalSeguidores++;
    }
  }

  const efectividadPromedio = totalSeguidores > 0
    ? Math.round((totalVotosCandidato / totalSeguidores) * 100)
    : null;

  return {
    totalVotosCandidato,
    totalVotosLista,
    mesasCubiertas: mesasCubiertasSet.size,
    potencialTotal,
    totalSeguidores,
    efectividadPromedio
  };
};

/**
 * Lista los seguidores (Personas) registrados en una mesa específica de un ResultadoMesa
 */
const obtenerSeguidoresMesa = async (resultadoId, campanaId) => {
  const resultado = await ResultadoMesa.findOne({ _id: resultadoId, campana: campanaId });
  if (!resultado) throw new ApiError(404, 'Resultado no encontrado');

  const personas = await Persona.find({
    campana: campanaId,
    'puesto.municipio': new RegExp(`^${resultado.municipio.trim()}$`, 'i'),
    'puesto.zona': { $in: numVariants(resultado.zona) },
    'puesto.mesa': { $in: numVariants(resultado.mesa) }
  })
    .select('nombres apellidos documento estadoContacto estadoVoto notaVoto puesto lider')
    .sort({ apellidos: 1, nombres: 1 });

  return {
    mesa: {
      municipio: resultado.municipio,
      zona: resultado.zona,
      mesa: resultado.mesa,
      nombrePuesto: resultado.nombrePuesto,
      votosObtenidos: resultado.votosObtenidos,
      votosLista: resultado.votosLista,
      potencialVotacion: resultado.potencialVotacion
    },
    personas
  };
};

/**
 * Importar resultados desde un archivo Excel (.xlsx) con la estructura:
 * - Fila 1: "Candidato: <nombre>"
 * - Fila 2: "Partido: <partido>"
 * - Fila con headers: Departamento | Municipio | Zona/Localidad | Puesto | Mesa | ... | Votos
 * - Filas de datos a continuación
 *
 * metadatos: { candidatoNumero, candidatoNombre (opcional), partido (opcional), fechaEleccion (opcional) }
 */
const importarDesdeExcel = async (filePath, metadatos, campanaId) => {
  if (!campanaId) throw new ApiError(400, 'No hay campaña activa');
  if (!metadatos.candidatoNumero) throw new ApiError(400, 'candidatoNumero es requerido');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'El Excel no contiene hojas de cálculo');

  // Helper: extrae texto de una celda manejando richText, fórmulas y valores simples
  const cellText = (cell) => {
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(r => r.text || '').join('').trim();
      if (v.result !== undefined) return String(v.result ?? '').trim(); // fórmula
      if (v.text) return String(v.text).trim();
    }
    return String(v).trim();
  };

  // --- Extraer candidato/partido de las primeras filas si no se proveyeron ---
  let candidatoNombreExcel = metadatos.candidatoNombre || '';
  let partidoExcel = metadatos.partido || '';

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum > 4) return;
    // Buscar en todas las celdas de la fila, no solo en la columna A
    row.eachCell({ includeEmpty: false }, (cell) => {
      const a = cellText(cell);
      if (/^candidato[:\s]/i.test(a) && !candidatoNombreExcel) {
        candidatoNombreExcel = a.replace(/^candidato[:\s]*/i, '').trim();
      }
      if (/^partido[:\s]/i.test(a) && !partidoExcel) {
        partidoExcel = a.replace(/^partido[:\s]*/i, '').trim();
      }
    });
  });

  // --- Detectar fila de headers (contiene "municipio" y "mesa") ---
  let headerRow = null;
  let colMap = {}; // { departamento, municipio, zona, puesto, mesa, votos }

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (headerRow) return;
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      vals.push({ col: colNum, val: sinTildes(cellText(cell).toLowerCase()) });
    });
    const hayMunicipio = vals.some(v => v.val.includes('municipio'));
    const hayMesa = vals.some(v => v.val === 'mesa' || v.val.startsWith('mesa'));
    if (hayMunicipio && hayMesa) {
      headerRow = rowNum;
      vals.forEach(({ col, val }) => {
        if (!val) return;
        const v = sinTildes(val);
        if (v.includes('departamento')) colMap.departamento = col;
        else if (v.includes('municipio')) colMap.municipio = col;
        else if (v.includes('zona') || v.includes('localidad')) colMap.zona = col;
        else if (v.startsWith('puesto') || v.includes('nombre puesto') || v.includes('lugar de votacion') || v.includes('centro de votacion') || v.includes('sede') || v.includes('nombre del puesto')) colMap.puesto = col;
        else if (v === 'mesa' || v.startsWith('mesa')) colMap.mesa = col;
        else if (v.includes('voto')) colMap.votos = col;
      });
    }
  });

  if (!headerRow) throw new ApiError(400, 'No se encontró la fila de encabezados en el Excel (requiere columnas Municipio y Mesa)');
  if (!colMap.municipio || !colMap.mesa) throw new ApiError(400, 'El Excel debe tener columnas Municipio y Mesa');

  // --- Procesar filas de datos ---
  const resultados = [];
  const errores = [];

  // Fill-down: el Excel agrupa filas por municipio dejando celdas vacías
  // en las filas siguientes del mismo grupo → se hereda el último valor.
  let lastDepartamento = '';
  let lastMunicipio = '';

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum <= headerRow) return;

    const getVal = (col) => col ? cellText(row.getCell(col)) : '';
    const getNum = (col) => {
      if (!col) return 0;
      const cell = row.getCell(col);
      const v = cell.value;
      if (v === null || v === undefined) return 0;
      // Fórmula
      if (typeof v === 'object' && v.result !== undefined) {
        const n = Number(v.result);
        return isNaN(n) ? 0 : n;
      }
      const n = Number(typeof v === 'object' ? cellText(cell) : v);
      return isNaN(n) ? 0 : n;
    };

    // Aplicar fill-down para departamento y municipio
    const dpto = getVal(colMap.departamento) || lastDepartamento;
    const municipio = getVal(colMap.municipio) || lastMunicipio;
    if (dpto) lastDepartamento = dpto;
    if (municipio) lastMunicipio = municipio;

    const mesa = getVal(colMap.mesa);
    if (!municipio || !mesa) return; // fila de totales o vacía

    resultados.push({
      campana: campanaId,
      departamento: dpto,
      municipio,
      zona: getVal(colMap.zona),
      nombrePuesto: getVal(colMap.puesto),
      mesa,
      candidatoNumero: String(metadatos.candidatoNumero),
      candidatoNombre: candidatoNombreExcel,
      partido: partidoExcel,
      votosObtenidos: getNum(colMap.votos),
      fechaEleccion: metadatos.fechaEleccion ? new Date(metadatos.fechaEleccion) : undefined
    });
  });

  if (resultados.length === 0) throw new ApiError(400, 'El Excel no contiene filas de datos');

  // --- Detectar advertencias de municipio incorrecto ---
  // Cruza los nombrePuesto del Excel contra la colección Personas (datos de Registraduría)
  // para alertar cuando el municipio del Excel no coincide con el municipio real.
  const advertencias = [];
  try {
    const nombresUnicos = [...new Set(resultados.filter(r => r.nombrePuesto).map(r => r.nombrePuesto.toUpperCase().trim()))];
    if (nombresUnicos.length > 0) {
      const personasPuestos = await Persona.aggregate([
        { $addFields: { _puestoUpper: { $toUpper: { $trim: { input: '$puesto.nombrePuesto' } } } } },
        { $match: { _puestoUpper: { $in: nombresUnicos } } },
        { $group: { _id: '$_puestoUpper', municipioReal: { $first: '$puesto.municipio' } } }
      ]);

      const municipioMap = {}; // puestoUpper → municipio original de DB
      for (const p of personasPuestos) {
        if (p._id) municipioMap[p._id] = p.municipioReal || '';
      }

      const advertenciasMap = {};
      for (const r of resultados) {
        if (!r.nombrePuesto) continue;
        const keyPuesto = r.nombrePuesto.toUpperCase().trim();
        const municipioRealOrig = municipioMap[keyPuesto];
        if (!municipioRealOrig) continue;
        const municipioRealUp = municipioRealOrig.toUpperCase().trim();
        const municipioExcelUp = (r.municipio || '').toUpperCase().trim();
        if (municipioRealUp && municipioRealUp !== municipioExcelUp) {
          const wKey = `${keyPuesto}|${municipioExcelUp}|${municipioRealUp}`;
          if (!advertenciasMap[wKey]) {
            advertenciasMap[wKey] = {
              nombrePuesto: r.nombrePuesto,
              municipioExcel: r.municipio,
              municipioReal: municipioRealOrig,
              mesas: 0
            };
          }
          advertenciasMap[wKey].mesas++;
        }
      }
      advertencias.push(...Object.values(advertenciasMap));
    }
  } catch (_) { /* no bloquear la importación por errores de verificación */ }

  // --- Bulk upsert (una sola operación para miles de filas) ---
  const ops = resultados.map(datos => ({
    updateOne: {
      filter: {
        campana: datos.campana,
        departamento: datos.departamento || '',
        municipio: datos.municipio,
        zona: datos.zona,
        nombrePuesto: datos.nombrePuesto || '',
        mesa: datos.mesa,
        candidatoNumero: datos.candidatoNumero
      },
      update: { $set: datos },
      upsert: true
    }
  }));

  let importados = 0;
  try {
    const bulkResult = await ResultadoMesa.bulkWrite(ops, { ordered: false });
    importados = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0) + (bulkResult.matchedCount || 0);
  } catch (e) {
    // bulkWrite con ordered:false puede fallar parcialmente
    if (e.result) {
      importados = (e.result.nUpserted || 0) + (e.result.nModified || 0);
      errores.push(`${e.result.nErrors || '?'} errores en bulk: ${e.message}`);
    } else {
      throw new ApiError(500, `Error al guardar en base de datos: ${e.message}`);
    }
  }

  // Eliminar archivo temporal
  try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }

  return { importados, errores, total: resultados.length, candidatoNombre: candidatoNombreExcel, partido: partidoExcel, advertencias };
};

/**
 * Verifica el cumplimiento de voto cruzando ResultadoMesa × Personas.
 * Lógica por mesa:
 *   V = votosObtenidos del candidato en esa mesa
 *   N = personas registradas en esa mesa
 *   V >= N  → CUMPLIDO  (superávit si V > N)
 *   0 < V < N → VERIFICABLE
 *   V == 0  → NO_CUMPLIDO
 *   Sin E-14 → SIN_DATOS (reset inicial)
 */
/**
 * Verifica el cumplimiento de voto cruzando ResultadoMesa × Personas.
 * 2 queries de lectura + 1 bulkWrite. No N+1 queries.
 */
const verificarVotosMesas = async (campanaId) => {
  if (!campanaId) throw new ApiError(400, 'No hay campaña activa');

  const [resultados, todasPersonas] = await Promise.all([
    ResultadoMesa.find({ campana: campanaId }).lean(),
    Persona.find(filtroCampana(campanaId), { _id: 1, 'puesto.departamento': 1, 'puesto.municipio': 1, 'puesto.zona': 1, 'puesto.nombrePuesto': 1, 'puesto.mesa': 1 }).lean()
  ]);

  // Resetear todas las personas a NO_CUMPLIDO (sin E-14 = no cumplido)
  await Persona.updateMany(filtroCampana(campanaId), { $set: { estadoVoto: 'NO_CUMPLIDO', notaVoto: 'No hay votos' } });

  if (resultados.length === 0) {
    return { totalMesas: 0, mesasConPersonas: 0, personasActualizadas: 0, resumen: { cumplido: 0, verificable: 0, noCumplido: 0, sinDatos: 0 } };
  }

  // Construir mapa exacto, fuzzy-15 y mapa de similitud por palabras
  const personaMap = new Map();   // normKey → [ids]
  const personaMap15 = new Map(); // key15 → { ids, exactKeys }
  // Para similitud: mun|mesa → [{ normPuesto, ids }]
  const personaMapMunMesa = new Map();

  for (const p of todasPersonas) {
    const key = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    const arr = personaMap.get(key) || [];
    arr.push(p._id);
    personaMap.set(key, arr);

    // Clave fuzzy: mismos dep|mun|mesa pero puesto truncado a 15 chars
    const dep = sinTildes((p.puesto?.departamento || '').toLowerCase().trim());
    const mun = sinTildes((p.puesto?.municipio || '').toLowerCase().trim());
    const normP = normalizarPuesto(p.puesto?.nombrePuesto);
    const p15 = normP.slice(0, 15);
    const m = extractNum(p.puesto?.mesa);
    const key15 = `${dep}|${mun}|${p15}|${m}`;
    if (!personaMap15.has(key15)) personaMap15.set(key15, { ids: [], exactKeys: new Set() });
    const e15 = personaMap15.get(key15);
    e15.ids.push(p._id);
    e15.exactKeys.add(key);

    // Mapa por mun|mesa para fallback por similitud de palabras
    const munMesaKey = `${mun}|${m}`;
    if (!personaMapMunMesa.has(munMesaKey)) personaMapMunMesa.set(munMesaKey, []);
    personaMapMunMesa.get(munMesaKey).push({ normPuesto: normP, ids: arr });
  }

  let mesasConPersonas = 0;
  let personasActualizadas = 0;
  const resumen = { cumplido: 0, verificable: 0, noCumplido: 0 };
  const bulkOps = [];

  for (const r of resultados) {
    const key = normKey(r.departamento, r.municipio, r.zona, r.nombrePuesto, r.mesa);
    let ids = personaMap.get(key) || [];

    // Fallback 1: fuzzy-15 (maneja truncación Excel 30 chars)
    if (ids.length === 0) {
      const dep = sinTildes((r.departamento || '').toLowerCase().trim());
      const mun = sinTildes((r.municipio || '').toLowerCase().trim());
      const p15 = normalizarPuesto(r.nombrePuesto).slice(0, 15);
      const m = extractNum(r.mesa);
      const key15 = `${dep}|${mun}|${p15}|${m}`;
      const e15 = personaMap15.get(key15);
      if (e15 && e15.exactKeys.size === 1) ids = e15.ids;
    }

    // Fallback 2: similitud de palabras (maneja abreviaciones: "S." vs "SANTA", "I.E." vs "COLEGIO")
    if (ids.length === 0) {
      const mun = sinTildes((r.municipio || '').toLowerCase().trim());
      const m = extractNum(r.mesa);
      const munMesaKey = `${mun}|${m}`;
      const candidatos = personaMapMunMesa.get(munMesaKey) || [];
      let mejorScore = 0;
      let mejorIds = [];
      for (const c of candidatos) {
        const score = similitudPuesto(r.nombrePuesto, c.normPuesto);
        if (score > mejorScore) { mejorScore = score; mejorIds = c.ids; }
      }
      // Umbral: al menos 60% de palabras en común
      if (mejorScore >= 0.6) ids = mejorIds;
    }

    const N = ids.length;
    if (N === 0) continue;

    const V = r.votosObtenidos || 0;
    let estadoVoto, notaVoto;
    if (V === 0) {
      estadoVoto = 'NO_CUMPLIDO';
      notaVoto = `Sin votos del candidato en esta mesa (${N} personas registradas)`;
    } else if (V >= N) {
      estadoVoto = 'CUMPLIDO';
      notaVoto = V > N
        ? `Superávit: ${V} votos para ${N} personas registradas`
        : `Voto cumplido: ${V} votos exactos para ${N} personas`;
    } else {
      estadoVoto = 'VERIFICABLE';
      notaVoto = `${V} de ${N} personas registradas votaron`;
    }

    bulkOps.push({
      updateMany: {
        filter: { _id: { $in: ids } },
        update: { $set: { estadoVoto, notaVoto } }
      }
    });
    mesasConPersonas++;
    personasActualizadas += N;
    resumen[estadoVoto === 'CUMPLIDO' ? 'cumplido' : estadoVoto === 'VERIFICABLE' ? 'verificable' : 'noCumplido']++;
  }

  if (bulkOps.length > 0) {
    await Persona.bulkWrite(bulkOps, { ordered: false });
  }

  return { totalMesas: resultados.length, mesasConPersonas, personasActualizadas, resumen };
};

/**
 * Vista del líder: sus personas con estadoVoto calculado dinámicamente.
 * Devuelve resumen + lista ordenada por estadoVoto.
 */
const obtenerMisPersonas = async (campanaId, liderId) => {
  if (!campanaId) throw new ApiError(400, 'No hay campaña activa');

  const [resultados, todasPersonas, misPersonas] = await Promise.all([
    ResultadoMesa.find({ campana: campanaId }).lean(),
    Persona.find(filtroCampana(campanaId), {
      'puesto.departamento': 1, 'puesto.municipio': 1,
      'puesto.zona': 1, 'puesto.nombrePuesto': 1, 'puesto.mesa': 1
    }).lean(),
    Persona.find({ ...filtroCampana(campanaId), 'lider.id': liderId })
      .select('nombres apellidos documento telefono estadoContacto puesto estadoVoto')
      .sort({ apellidos: 1, nombres: 1 })
      .lean()
  ]);

  // Helper para clave fuzzy 15-char (maneja truncación Excel)
  const key15 = (dep, mun, nombrePuesto, mesa) => {
    const d = sinTildes((dep || '').toLowerCase().trim());
    const mn = sinTildes((mun || '').toLowerCase().trim());
    const p = normalizarPuesto(nombrePuesto).slice(0, 15);
    const m = extractNum(mesa);
    return `${d}|${mn}|${p}|${m}`;
  };

  // Mapa votos: exacto + fuzzy (ResultadoMesa → votos)
  const votosMap = new Map();
  const votosMap15 = new Map(); // fuzzy: key15 → { votos, count }
  for (const r of resultados) {
    const k = normKey(r.departamento, r.municipio, r.zona, r.nombrePuesto, r.mesa);
    votosMap.set(k, r.votosObtenidos || 0);
    const k15 = key15(r.departamento, r.municipio, r.nombrePuesto, r.mesa);
    if (!votosMap15.has(k15)) votosMap15.set(k15, { votos: r.votosObtenidos || 0, count: 1 });
    else votosMap15.get(k15).count++;
  }

  // Mapa total personas por mesa (todas, no solo del lider)
  const countMap = new Map();
  for (const p of todasPersonas) {
    const k = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    countMap.set(k, (countMap.get(k) || 0) + 1);
  }

  const resumen = { total: 0, cumplido: 0, verificable: 0, noCumplido: 0 };

  const personas = misPersonas.map(p => {
    const k = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    let tieneE14 = votosMap.has(k);
    let votos = votosMap.get(k) ?? 0;

    // Fallback fuzzy si no hay match exacto
    if (!tieneE14) {
      const k15v = key15(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.nombrePuesto, p.puesto?.mesa);
      const e15 = votosMap15.get(k15v);
      if (e15 && e15.count === 1) { tieneE14 = true; votos = e15.votos; }
    }

    const key = k;
    const totalEnMesa = countMap.get(key) || 1;
    let estadoVoto;
    if (!tieneE14 || votos === 0) estadoVoto = 'NO_CUMPLIDO';
    else if (votos >= totalEnMesa) estadoVoto = 'CUMPLIDO';
    else estadoVoto = 'VERIFICABLE';

    resumen.total++;
    if (estadoVoto === 'CUMPLIDO') resumen.cumplido++;
    else if (estadoVoto === 'VERIFICABLE') resumen.verificable++;
    else resumen.noCumplido++;

    return { ...p, estadoVoto };
  });

  return { resumen, personas };
};

/**
 * Genera un Excel con dos hojas:
 *   1. "Resumen por Mesa" — ResultadoMesa × personas cruzadas
 *   2. "Personas" — cada persona con su estadoVoto
 */
/**
 * tipo: 'personas' (default) | 'resumen'
 */
const exportarInforme = async (campanaId, liderFiltro = null, tipo = 'personas') => {
  if (!campanaId) throw new ApiError(400, 'No hay campaña activa');

  const personasQuery = { ...filtroCampana(campanaId) };
  if (liderFiltro) personasQuery['lider.id'] = liderFiltro;

  const [resultados, personas] = await Promise.all([
    ResultadoMesa.find({ campana: campanaId }).lean(),
    Persona.find(personasQuery)
      .select('nombres apellidos documento telefono estadoContacto estadoVoto notaVoto puesto lider')
      .lean()
  ]);

  // Mapa de conteos por mesa
  const countMap = new Map();
  for (const p of personas) {
    const key = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    const e = countMap.get(key) || { total: 0 };
    e.total++;
    countMap.set(key, e);
  }

  // Mapa de votos por mesa
  const votosMap = new Map();
  for (const r of resultados) {
    const key = normKey(r.departamento, r.municipio, r.zona, r.nombrePuesto, r.mesa);
    votosMap.set(key, r.votosObtenidos || 0);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Elector360';
  wb.created = new Date();

  const estadoVotoLabels = { CUMPLIDO: 'Cumplido', VERIFICABLE: 'Verificable', NO_CUMPLIDO: 'No cumplido', SIN_DATOS: 'Sin datos' };
  const estadoVotoColors = { CUMPLIDO: 'FF22C55E', VERIFICABLE: 'FFEAB308', NO_CUMPLIDO: 'FFEF4444', SIN_DATOS: 'FF9CA3AF' };

  // ── Hoja: Resumen por Mesa ─────────────────────────────────────────────
  if (tipo === 'resumen') {
    const ws1 = wb.addWorksheet('Resumen por Mesa');
    ws1.columns = [
      { header: 'Departamento',    key: 'departamento',   width: 16 },
      { header: 'Municipio',       key: 'municipio',      width: 18 },
      { header: 'Zona',            key: 'zona',           width: 8  },
      { header: 'Puesto',          key: 'nombrePuesto',   width: 30 },
      { header: 'Mesa',            key: 'mesa',           width: 12 },
      { header: 'Votos candidato', key: 'votosObtenidos', width: 16 },
      { header: 'Votos lista',     key: 'votosLista',     width: 12 },
      { header: 'Personas',        key: 'personas',       width: 12 },
      { header: 'Efectividad %',   key: 'efectividad',    width: 14 },
      { header: 'Estado voto',     key: 'estadoVoto',     width: 16 }
    ];
    ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const r of resultados) {
      const key = normKey(r.departamento, r.municipio, r.zona, r.nombrePuesto, r.mesa);
      const personas_count = (countMap.get(key) || {}).total || 0;
      const votos = r.votosObtenidos || 0;
      const efectividad = personas_count > 0 ? Math.round((votos / personas_count) * 100) : null;
      let estadoVoto;
      if (votos === 0 || personas_count === 0) estadoVoto = 'NO_CUMPLIDO';
      else if (votos >= personas_count) estadoVoto = 'CUMPLIDO';
      else estadoVoto = 'VERIFICABLE';
      const row = ws1.addRow({
        departamento: r.departamento || '',
        municipio: r.municipio || '',
        zona: r.zona || '',
        nombrePuesto: r.nombrePuesto || '',
        mesa: r.mesa || '',
        votosObtenidos: votos,
        votosLista: r.votosLista || 0,
        personas: personas_count,
        efectividad: efectividad !== null ? efectividad : '',
        estadoVoto: estadoVotoLabels[estadoVoto] || estadoVoto
      });
      const color = estadoVotoColors[estadoVoto];
      if (color) {
        row.getCell('estadoVoto').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        row.getCell('estadoVoto').font = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
    }
    return wb;
  }

  // ── Hoja: Personas ─────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Personas');
  ws2.columns = [
    { header: 'Documento',       key: 'documento',      width: 14 },
    { header: 'Nombres',         key: 'nombres',        width: 20 },
    { header: 'Apellidos',       key: 'apellidos',      width: 20 },
    { header: 'Teléfono',        key: 'telefono',       width: 14 },
    { header: 'Municipio',       key: 'municipio',      width: 18 },
    { header: 'Zona',            key: 'zona',           width: 8  },
    { header: 'Puesto',          key: 'puesto',         width: 30 },
    { header: 'Mesa',            key: 'mesa',           width: 10 },
    { header: 'Lider',           key: 'lider',          width: 22 },
    { header: 'Estado contacto', key: 'estadoContacto', width: 16 },
    { header: 'Estado voto',     key: 'estadoVoto',     width: 16 },
    { header: 'Nota voto',       key: 'notaVoto',       width: 40 }
  ];
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const contactoLabels = { CONFIRMADO: 'Confirmado', CONTACTADO: 'Contactado', NO_CONTACTADO: 'No contactado', PENDIENTE: 'Pendiente' };

  for (const p of personas) {
    const mesaKey = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    const tieneE14 = votosMap.has(mesaKey);
    const votos = votosMap.get(mesaKey) ?? 0;
    const totalEnMesa = (countMap.get(mesaKey) || {}).total || 1;
    let ev;
    if (!tieneE14 || votos === 0) {
      ev = 'NO_CUMPLIDO';
    } else if (votos >= totalEnMesa) {
      ev = 'CUMPLIDO';
    } else {
      ev = 'VERIFICABLE';
    }
    const notaVoto = !tieneE14
      ? 'No hay votos'
      : votos === 0
        ? 'Sin votos del candidato en esta mesa'
        : votos >= totalEnMesa
          ? `${votos} votos para ${totalEnMesa} personas registradas`
          : `${votos} de ${totalEnMesa} personas registradas votaron`;

    const row = ws2.addRow({
      documento: p.documento || '',
      nombres: p.nombres || '',
      apellidos: p.apellidos || '',
      telefono: p.telefono || '',
      municipio: p.puesto?.municipio || '',
      zona: p.puesto?.zona || '',
      puesto: p.puesto?.nombrePuesto || '',
      mesa: p.puesto?.mesa || '',
      lider: p.lider?.nombre || p.lider?.perfil?.nombres || '',
      estadoContacto: contactoLabels[p.estadoContacto] || p.estadoContacto || '',
      estadoVoto: estadoVotoLabels[ev] || ev,
      notaVoto
    });
    const color = estadoVotoColors[ev];
    if (color) {
      row.getCell('estadoVoto').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      row.getCell('estadoVoto').font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
  }

  return wb;
};

/**
 * Informe de un líder específico: mesas donde tiene personas,
 * votos obtenidos en cada mesa, total de personas en esa mesa,
 * y qué otros líderes comparten la mesa.
 */
const obtenerInformeLider = async (campanaId, liderId) => {
  if (!campanaId) throw new ApiError(400, 'No hay campaña activa');
  if (!liderId) throw new ApiError(400, 'liderId es requerido');

  // 1. Personas del líder
  const personasLider = await Persona.find(
    { ...filtroCampana(campanaId), 'lider.id': liderId },
    { nombres: 1, apellidos: 1, documento: 1, telefono: 1, estadoContacto: 1, estadoVoto: 1, puesto: 1 }
  ).lean();

  if (personasLider.length === 0) {
    return { mesas: [], resumen: { totalMesas: 0, totalPersonas: 0, totalVotos: 0, mesasCumplidas: 0, mesasVerificables: 0, mesasNoCumplidas: 0 } };
  }

  // 2. Agrupar personas del líder por mesa
  const mesasMap = new Map();
  for (const p of personasLider) {
    const key = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    if (!mesasMap.has(key)) {
      mesasMap.set(key, {
        key,
        departamento: p.puesto?.departamento || '',
        municipio: p.puesto?.municipio || '',
        zona: p.puesto?.zona || '',
        nombrePuesto: p.puesto?.nombrePuesto || '',
        mesa: p.puesto?.mesa || '',
        personas: []
      });
    }
    mesasMap.get(key).personas.push(p);
  }

  // 3. Votos E-14 — mapa exacto + fuzzy-15 (mismo criterio que informePorLider)
  const resultados = await ResultadoMesa.find({ campana: campanaId }).lean();
  const votosMap = new Map();
  const votosMap15 = new Map(); // clave fuzzy: dep|mun|puesto15chars|mesa
  for (const r of resultados) {
    const key = normKey(r.departamento, r.municipio, r.zona, r.nombrePuesto, r.mesa);
    votosMap.set(key, r);
    const dep = sinTildes((r.departamento || '').toLowerCase().trim());
    const mun = sinTildes((r.municipio || '').toLowerCase().trim());
    const p15 = normalizarPuesto(r.nombrePuesto).slice(0, 15);
    const m   = extractNum(r.mesa);
    const k15 = `${dep}|${mun}|${p15}|${m}`;
    if (!votosMap15.has(k15)) votosMap15.set(k15, { resultado: r, count: 1 });
    else votosMap15.get(k15).count++;
  }

  // Helper para obtener resultado con fallback fuzzy
  const getResultado = (mesaData) => {
    const key = normKey(mesaData.departamento, mesaData.municipio, mesaData.zona, mesaData.nombrePuesto, mesaData.mesa);
    if (votosMap.has(key)) return votosMap.get(key);
    const dep = sinTildes((mesaData.departamento || '').toLowerCase().trim());
    const mun = sinTildes((mesaData.municipio || '').toLowerCase().trim());
    const p15 = normalizarPuesto(mesaData.nombrePuesto).slice(0, 15);
    const m   = extractNum(mesaData.mesa);
    const k15 = `${dep}|${mun}|${p15}|${m}`;
    const e15 = votosMap15.get(k15);
    if (e15 && e15.count === 1) return e15.resultado;
    return null;
  };

  // 4. Todas las personas de la campaña para encontrar otros líderes en las mismas mesas
  const todasPersonas = await Persona.find(
    filtroCampana(campanaId),
    { nombres: 1, apellidos: 1, documento: 1, estadoVoto: 1, 'puesto.departamento': 1, 'puesto.municipio': 1, 'puesto.zona': 1, 'puesto.nombrePuesto': 1, 'puesto.mesa': 1, 'lider.id': 1, 'lider.nombre': 1 }
  ).lean();

  const liderIdStr = String(liderId);
  const otrosLideresMap = new Map(); // mesaKey → Map(liderIdStr → { nombre, count, personas[] })
  for (const p of todasPersonas) {
    if (String(p.lider?.id) === liderIdStr) continue;
    const key = normKey(p.puesto?.departamento, p.puesto?.municipio, p.puesto?.zona, p.puesto?.nombrePuesto, p.puesto?.mesa);
    if (!mesasMap.has(key)) continue;
    if (!otrosLideresMap.has(key)) otrosLideresMap.set(key, new Map());
    const liderMap = otrosLideresMap.get(key);
    const lid = String(p.lider?.id || 'sin-lider');
    const nombre = p.lider?.nombre || 'Sin líder';
    if (!liderMap.has(lid)) liderMap.set(lid, { nombre, count: 0, personas: [] });
    const entry = liderMap.get(lid);
    entry.count++;
    entry.personas.push({ _id: p._id, nombres: p.nombres, apellidos: p.apellidos, documento: p.documento, estadoVoto: p.estadoVoto || 'NO_CUMPLIDO' });
  }

  // 5. Construir resultado
  const mesas = [];
  for (const [key, mesaData] of mesasMap) {
    const resultado = getResultado(mesaData);
    const otrosLideresEntry = otrosLideresMap.get(key);
    const otrosLideres = otrosLideresEntry
      ? Array.from(otrosLideresEntry.values()).sort((a, b) => b.count - a.count)
      : [];
    const totalOtros = otrosLideres.reduce((s, l) => s + l.count, 0);
    const votosObtenidos = resultado?.votosObtenidos || 0;
    const N = mesaData.personas.length;
    const totalMesa = N + totalOtros;

    // estadoMesa se calcula contra el TOTAL de la mesa (todos los líderes),
    // no solo las personas de este líder. Ej: 1 voto de 3 registrados = VERIFICABLE.
    let estadoMesa;
    if (!resultado || votosObtenidos === 0) estadoMesa = 'NO_CUMPLIDO';
    else if (votosObtenidos >= totalMesa) estadoMesa = 'CUMPLIDO';
    else estadoMesa = 'VERIFICABLE';

    mesas.push({
      key,
      departamento: mesaData.departamento,
      municipio: mesaData.municipio,
      zona: mesaData.zona,
      nombrePuesto: mesaData.nombrePuesto,
      mesa: mesaData.mesa,
      votosObtenidos,
      votosLista: resultado?.votosLista || 0,
      potencialVotacion: resultado?.potencialVotacion || 0,
      personasDelLider: N,
      totalPersonasMesa: totalMesa,
      otrosLideres,
      estadoMesa,
      personas: mesaData.personas
    });
  }

  const estadoOrder = { NO_CUMPLIDO: 0, VERIFICABLE: 1, CUMPLIDO: 2 };
  mesas.sort((a, b) => (estadoOrder[a.estadoMesa] - estadoOrder[b.estadoMesa]) || (a.municipio || '').localeCompare(b.municipio || ''));

  const resumen = {
    totalMesas: mesas.length,
    totalPersonas: personasLider.length,
    totalVotos: mesas.reduce((s, m) => s + m.votosObtenidos, 0),
    mesasCumplidas: mesas.filter(m => m.estadoMesa === 'CUMPLIDO').length,
    mesasVerificables: mesas.filter(m => m.estadoMesa === 'VERIFICABLE').length,
    mesasNoCumplidas: mesas.filter(m => m.estadoMesa === 'NO_CUMPLIDO').length,
  };

  return { mesas, resumen };
};

/**
 * Verifica la cobertura de puestos de votación:
 * cruza puestos únicos en Personas vs puestos únicos en ResultadoMesa.
 * Retorna qué puestos tienen personas pero sin resultados importados,
 * qué puestos tienen resultados pero sin personas, y cuáles coinciden.
 */
const verificarPuestosVotacion = async (campanaId) => {
  if (!campanaId) throw new ApiError(400, 'No hay campaña activa');

  const [resultadosMesas, todasPersonas] = await Promise.all([
    ResultadoMesa.find({ campana: campanaId }, {
      municipio: 1, zona: 1, nombrePuesto: 1
    }).lean(),
    Persona.find(filtroCampana(campanaId), {
      'puesto.municipio': 1, 'puesto.zona': 1, 'puesto.nombrePuesto': 1
    }).lean()
  ]);

  // Agrupar puestos de Personas: normKey → datos
  const mapPersonas = new Map();
  for (const p of todasPersonas) {
    const mun = sinTildes((p.puesto?.municipio || '').toLowerCase().trim());
    const pNorm = normalizarPuesto(p.puesto?.nombrePuesto);
    const key = `${mun}|${pNorm}`;
    if (!mapPersonas.has(key)) {
      mapPersonas.set(key, {
        municipio: p.puesto?.municipio || '',
        zona: p.puesto?.zona || '',
        nombrePuesto: p.puesto?.nombrePuesto || '',
        personas: 0
      });
    }
    mapPersonas.get(key).personas++;
  }

  // Agrupar puestos de ResultadoMesa: normKey → datos
  const mapResultados = new Map();
  for (const r of resultadosMesas) {
    const mun = sinTildes((r.municipio || '').toLowerCase().trim());
    const pNorm = normalizarPuesto(r.nombrePuesto);
    const key = `${mun}|${pNorm}`;
    if (!mapResultados.has(key)) {
      mapResultados.set(key, {
        municipio: r.municipio || '',
        zona: r.zona || '',
        nombrePuesto: r.nombrePuesto || '',
        mesas: 0
      });
    }
    mapResultados.get(key).mesas++;
  }

  const coincidencias = [];
  const sinResultado = [];
  const sinPersonas = [];

  for (const [key, pDat] of mapPersonas) {
    if (mapResultados.has(key)) {
      const rDat = mapResultados.get(key);
      coincidencias.push({
        municipio: pDat.municipio,
        zona: pDat.zona,
        nombrePuesto: pDat.nombrePuesto,
        personas: pDat.personas,
        mesas: rDat.mesas
      });
    } else {
      sinResultado.push({
        municipio: pDat.municipio,
        zona: pDat.zona,
        nombrePuesto: pDat.nombrePuesto,
        personas: pDat.personas
      });
    }
  }

  for (const [key, rDat] of mapResultados) {
    if (!mapPersonas.has(key)) {
      sinPersonas.push({
        municipio: rDat.municipio,
        zona: rDat.zona,
        nombrePuesto: rDat.nombrePuesto,
        mesas: rDat.mesas
      });
    }
  }

  sinResultado.sort((a, b) => b.personas - a.personas);
  sinPersonas.sort((a, b) => b.mesas - a.mesas);
  coincidencias.sort((a, b) => b.personas - a.personas);

  return {
    resumen: {
      totalPuestosPersonas: mapPersonas.size,
      totalPuestosResultados: mapResultados.size,
      puestosCoinciden: coincidencias.length,
      puestosSinResultado: sinResultado.length,
      puestosSinPersonas: sinPersonas.length
    },
    sinResultado,
    sinPersonas,
    coincidencias
  };
};

module.exports = {
  guardarResultado,
  listarResultados,
  obtenerPorId,
  eliminarResultado,
  obtenerAnalisis,
  obtenerResumen,
  obtenerSeguidoresMesa,
  importarDesdeExcel,
  verificarVotosMesas,
  obtenerMisPersonas,
  exportarInforme,
  obtenerInformeLider,
  verificarPuestosVotacion
};
