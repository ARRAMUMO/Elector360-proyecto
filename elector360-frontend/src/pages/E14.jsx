import { useState, useEffect, useRef } from 'react';
import e14Service from '../services/e14Service';
import authService from '../services/authService';
import api from '../services/api';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';

// ─── Utilidades ────────────────────────────────────────────────────────────

const formVacio = {
  departamento: '',
  municipio: '',
  zona: '',
  nombrePuesto: '',
  mesa: '',
  candidatoNumero: '',
  candidatoNombre: '',
  partido: '',
  votosObtenidos: '',
  votosLista: '',
  totalVotantes: '',
  potencialVotacion: '',
  fechaEleccion: '',
  notas: ''
};

const estadoMesaColor = {
  CUMPLIDO:    'bg-green-100 text-green-800',
  VERIFICABLE: 'bg-yellow-100 text-yellow-800',
  NO_CUMPLIDO: 'bg-orange-100 text-orange-800',
};

const estadoMesaLabel = {
  CUMPLIDO:    'Cumplido',
  VERIFICABLE: 'Verificable',
  NO_CUMPLIDO: 'No cumplido',
};

/**
 * Extrae zona, puesto y mesa del nombre/ruta del archivo PDF.
 * Soporta la estructura de la Registraduría:
 *   zona 33/col barranquilla codeba/mesa 4 codeba.pdf
 */
function parsearArchivo(file) {
  const ruta = file.webkitRelativePath || file.name;
  const partes = ruta.split('/');

  let zona = '', nombrePuesto = '', mesa = '';

  // Zona: buscar "zona XX" en cualquier parte de la ruta
  const mZona = ruta.match(/zona[\s_-](\d+)/i);
  if (mZona) zona = mZona[1];

  // Puesto: carpeta inmediatamente antes del archivo
  if (partes.length >= 2) {
    nombrePuesto = partes[partes.length - 2]
      .replace(/[-_]/g, ' ')
      .toUpperCase()
      .trim();
  }

  // Mesa: buscar "mesa X" en el nombre del archivo
  const mMesa = file.name.match(/mesa[\s_-](\d+)/i);
  if (mMesa) mesa = mMesa[1];

  return { zona, nombrePuesto, mesa };
}

// ─── Vista Líder ────────────────────────────────────────────────────────────

const VOTO_CONFIG = {
  CUMPLIDO:    { label: 'Cumplido',    bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  VERIFICABLE: { label: 'Verificable', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  NO_CUMPLIDO: { label: 'No cumplido', bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
};

function VistaLider({ liderId, onExportar, descargando }) {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('TODOS');
  const [verificando, setVerificando] = useState(false);
  const [toastLocal, setToastLocal] = useState(null);

  const cargar = () => {
    setLoading(true);
    e14Service.misPersonas(liderId || null).then(res => {
      if (res.success) setDatos(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { cargar(); }, [liderId]);

  const handleVerificar = async () => {
    setVerificando(true);
    const res = await e14Service.verificarVotos();
    setVerificando(false);
    if (res.success) {
      cargar();
      const d = res.data;
      setToastLocal(`Verificación completada · ${d.personasActualizadas} personas actualizadas`);
      setTimeout(() => setToastLocal(null), 4000);
    } else {
      setToastLocal(`Error: ${res.error}`);
      setTimeout(() => setToastLocal(null), 4000);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!datos) return <div className="text-center py-20 text-gray-500">Error al cargar datos</div>;

  const { resumen, personas } = datos;
  const filtradas = filtro === 'TODOS' ? personas : personas.filter(p => p.estadoVoto === filtro);

  return (
    <div className="space-y-6">
      {toastLocal && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 text-sm text-gray-800">
          {toastLocal}
        </div>
      )}

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'TODOS',       label: 'Total',       valor: resumen.total,       color: 'border-blue-300 bg-blue-50',    text: 'text-blue-700'   },
          { key: 'CUMPLIDO',    label: 'Cumplido',    valor: resumen.cumplido,    color: 'border-green-300 bg-green-50',  text: 'text-green-700'  },
          { key: 'VERIFICABLE', label: 'Verificable', valor: resumen.verificable, color: 'border-yellow-300 bg-yellow-50',text: 'text-yellow-700' },
          { key: 'NO_CUMPLIDO', label: 'No cumplido', valor: resumen.noCumplido,  color: 'border-orange-300 bg-orange-50',text: 'text-orange-700' },
        ].map(c => (
          <button key={c.key} onClick={() => setFiltro(c.key)}
            className={`border-2 rounded-xl p-4 text-left transition-all ${c.color} ${filtro === c.key ? 'ring-2 ring-offset-1 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className={`text-3xl font-black mt-1 ${c.text}`}>{c.valor}</p>
          </button>
        ))}
      </div>

      {/* Botones + contador */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">{filtradas.length} personas {filtro !== 'TODOS' ? `· ${VOTO_CONFIG[filtro]?.label}` : ''}</p>
        <div className="flex gap-2">
          <button onClick={handleVerificar} disabled={verificando}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            {verificando ? '⏳ Verificando...' : '✓ Verificar votos'}
          </button>
          <button onClick={onExportar} disabled={descargando}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            {descargando ? '⏳ Generando...' : '⬇ Informe Excel'}
          </button>
        </div>
      </div>

      {/* Tabla personas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Persona</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado voto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin personas en este estado</td></tr>
            )}
            {filtradas.map(p => {
              const cfg = VOTO_CONFIG[p.estadoVoto] || VOTO_CONFIG.NO_CUMPLIDO;
              return (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.nombres} {p.apellidos}</div>
                    <div className="text-xs text-gray-400">{p.documento}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div>{p.puesto?.nombrePuesto || '—'}</div>
                    <div className="text-gray-400">{p.puesto?.municipio} · Mesa {p.puesto?.mesa}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div>{p.telefono || '—'}</div>
                    <div className={`mt-0.5 text-xs font-medium ${p.estadoContacto === 'CONFIRMADO' ? 'text-green-600' : 'text-gray-400'}`}>
                      {p.estadoContacto?.replace('_', ' ') || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Vista Informe Líder (agrupado por mesa) ────────────────────────────────

function VistaInformeLider({ liderId, campanaResumen, campanaAnalisis, onExportar, descargando, filtroInicial = 'TODOS' }) {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState(filtroInicial);
  const [expandida, setExpandida] = useState(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (!liderId) return;
    setLoading(true);
    setExpandida(null);
    setFiltro(filtroInicial);
    e14Service.informeLider(liderId).then(res => {
      if (res.success) setDatos(res.data);
      setLoading(false);
    });
  }, [liderId]);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!datos) return <div className="text-center py-10 text-gray-400 text-sm">Error al cargar datos</div>;

  const { mesas, resumen } = datos;
  // Regla: si una mesa tiene varias personas, es CUMPLIDO solo si votos >= total mesa.
  // Los conteos de las tarjetas y el filtro de la tabla usan estadoMesa (calculado en tiempo real),
  // no estadoVoto de DB (que puede ser de una verificación anterior).
  const mesasFiltradas = filtro === 'TODOS' ? mesas : mesas.filter(m => m.estadoMesa === filtro);

  // Conteos por mesa (consistente con el filtro de la tabla)
  const pCumplido    = mesas.filter(m => m.estadoMesa === 'CUMPLIDO').reduce((s, m) => s + m.personasDelLider, 0);
  const pVerificable = mesas.filter(m => m.estadoMesa === 'VERIFICABLE').reduce((s, m) => s + m.personasDelLider, 0);
  const pNoCumplido  = mesas.filter(m => m.estadoMesa === 'NO_CUMPLIDO').reduce((s, m) => s + m.personasDelLider, 0);

  const estadoCfg = {
    CUMPLIDO:    { label: 'Cumplido',    bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500',  border: 'border-green-300'  },
    VERIFICABLE: { label: 'Verificable', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500', border: 'border-yellow-300' },
    NO_CUMPLIDO: { label: 'No cumplido', bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', border: 'border-orange-300' },
  };

  // Totales de campaña para el banner
  const cTotal = campanaResumen?.totalVotosCandidato ?? 0;
  const cCumplido = campanaAnalisis ? campanaAnalisis.filter(a => a.estadoMesa === 'CUMPLIDO').reduce((s, a) => s + (a.votosObtenidos || 0), 0) : 0;
  const cVerificable = campanaAnalisis ? campanaAnalisis.filter(a => a.estadoMesa === 'VERIFICABLE').reduce((s, a) => s + (a.votosObtenidos || 0), 0) : 0;
  const cNoCumplido = campanaAnalisis ? campanaAnalisis.filter(a => a.estadoMesa === 'NO_CUMPLIDO').reduce((s, a) => s + (a.votosObtenidos || 0), 0) : 0;

  return (
    <div className="space-y-5">
      {/* Banner totales de campaña */}
      {campanaResumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border-l-4 border-blue-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Total votos candidato</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{cTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">votos obtenidos</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-green-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Votos cumplidos</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{cCumplido.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{campanaAnalisis?.filter(a => a.estadoMesa === 'CUMPLIDO').length || 0} mesas</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-yellow-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Votos verificables</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{cVerificable.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{campanaAnalisis?.filter(a => a.estadoMesa === 'VERIFICABLE').length || 0} mesas</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-orange-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Votos no cumplidos</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{cNoCumplido.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{campanaAnalisis?.filter(a => a.estadoMesa === 'NO_CUMPLIDO').length || 0} mesas</p>
          </div>
        </div>
      )}

      {/* Tarjetas resumen — conteo por persona (igual que producción) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'TODOS',       label: 'Total',       valor: resumen.totalPersonas, sub: `${resumen.totalMesas} mesas`,        color: 'border-blue-300 bg-blue-50',    text: 'text-blue-700'   },
          { key: 'CUMPLIDO',    label: 'Cumplido',    valor: pCumplido,             sub: `${resumen.totalVotos} votos totales`, color: 'border-green-300 bg-green-50',  text: 'text-green-700'  },
          { key: 'VERIFICABLE', label: 'Verificable', valor: pVerificable,          sub: 'votos < personas',                   color: 'border-yellow-300 bg-yellow-50',text: 'text-yellow-700' },
          { key: 'NO_CUMPLIDO', label: 'No cumplido', valor: pNoCumplido,           sub: 'sin votos E-14',                     color: 'border-orange-300 bg-orange-50',text: 'text-orange-700' },
        ].map(c => (
          <button key={c.key} onClick={() => setFiltro(c.key)}
            className={`border-2 rounded-xl p-4 text-left transition-all ${c.color} ${filtro === c.key ? 'ring-2 ring-offset-1 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className={`text-3xl font-black mt-1 ${c.text}`}>{c.valor}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </button>
        ))}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-500">{mesasFiltradas.length} mesa{mesasFiltradas.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setVerificando(true);
              await e14Service.verificarVotos();
              setVerificando(false);
              if (liderId) {
                setLoading(true);
                e14Service.informeLider(liderId).then(res => {
                  if (res.success) setDatos(res.data);
                  setLoading(false);
                });
              }
            }}
            disabled={verificando}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {verificando ? '⏳ Verificando...' : '✓ Verificar votos'}
          </button>
          <button onClick={onExportar} disabled={descargando}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            {descargando ? '⏳ Generando...' : '⬇ Informe Excel'}
          </button>
        </div>
      </div>

      {/* Tabla de mesas */}
      {mesasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
          No hay mesas en este estado
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Puesto / Mesa</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Votos obtenidos</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Registrados (total)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Este líder</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Otros líderes</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mesasFiltradas.map(mesa => {
                const cfg = estadoCfg[mesa.estadoMesa] || estadoCfg.NO_CUMPLIDO;
                const estaExpandida = expandida === mesa.key;
                const faltantes = mesa.totalPersonasMesa - mesa.votosObtenidos;
                return (
                  <>
                    <tr key={mesa.key}
                      onClick={() => setExpandida(estaExpandida ? null : mesa.key)}
                      className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 leading-tight">{mesa.nombrePuesto || '—'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{mesa.municipio} · Mesa {mesa.mesa}{mesa.zona ? ` · Zona ${mesa.zona}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-2xl font-black text-blue-700">{mesa.votosObtenidos}</span>
                        {mesa.votosLista > 0 && <div className="text-xs text-gray-400">+{mesa.votosLista} lista</div>}
                        {faltantes > 0 && (
                          <div className="text-xs font-semibold text-red-500 mt-0.5">faltan {faltantes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-2xl font-black text-gray-700">{mesa.totalPersonasMesa}</span>
                        <div className="text-xs text-gray-400 mt-0.5">deberían votar</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg font-bold text-indigo-600">{mesa.personasDelLider}</span>
                      </td>
                      <td className="px-4 py-3">
                        {mesa.otrosLideres.length === 0 ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {mesa.otrosLideres.slice(0, 3).map((l, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full border border-gray-200">
                                {l.nombre.split(' ')[0]} <span className="font-semibold">{l.count}</span>
                              </span>
                            ))}
                            {mesa.otrosLideres.length > 3 && (
                              <span className="text-xs text-gray-400">+{mesa.otrosLideres.length - 3} más</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                    {estaExpandida && (
                      <tr key={`${mesa.key}-detalle`} className="bg-blue-50">
                        <td colSpan={6} className="px-6 py-4 space-y-4">
                          {/* Personas del líder seleccionado */}
                          <div>
                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
                              Personas de este líder en la mesa ({mesa.personas.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {mesa.personas.map(p => {
                                const vCfg = VOTO_CONFIG[p.estadoVoto] || VOTO_CONFIG.NO_CUMPLIDO;
                                return (
                                  <div key={p._id} className="flex items-center justify-between bg-white rounded-lg border border-blue-100 px-3 py-2 gap-2">
                                    <div className="min-w-0">
                                      <div className="font-medium text-gray-900 text-sm truncate">{p.nombres} {p.apellidos}</div>
                                      <div className="text-xs text-gray-400">{p.documento}</div>
                                    </div>
                                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${vCfg.bg} ${vCfg.text}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${vCfg.dot}`} />
                                      {vCfg.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* Personas de otros líderes en la misma mesa */}
                          {mesa.otrosLideres.filter(l => l.personas?.length > 0).map((l, li) => (
                            <div key={li}>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                {l.nombre.split(' ')[0]} — {l.personas.length} persona{l.personas.length !== 1 ? 's' : ''}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {l.personas.map(p => {
                                  const vCfg = VOTO_CONFIG[p.estadoVoto] || VOTO_CONFIG.NO_CUMPLIDO;
                                  return (
                                    <div key={p._id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2 gap-2 opacity-75">
                                      <div className="min-w-0">
                                        <div className="font-medium text-gray-700 text-sm truncate">{p.nombres} {p.apellidos}</div>
                                        <div className="text-xs text-gray-400">{p.documento}</div>
                                      </div>
                                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${vCfg.bg} ${vCfg.text}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${vCfg.dot}`} />
                                        {vCfg.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function E14() {
  const [user] = useState(() => authService.getStoredUser());
  const esAdmin = user?.rol === 'ADMIN';
  const esAdminOCoord = ['ADMIN', 'COORDINADOR'].includes(user?.rol);
  const esCoord = ['ADMIN', 'COORDINADOR', 'LIDER'].includes(user?.rol);
  const esLider = user?.rol === 'LIDER';

  // Datos de la tabla
  const [analisis, setAnalisis] = useState([]);
  const [resumen, setResumen] = useState({ totalVotosCandidato: 0, totalVotosLista: 0, mesasCubiertas: 0, potencialTotal: 0, totalSeguidores: 0, efectividadPromedio: null });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // ── Modo importación (cola de PDFs) ──
  const [modoImport, setModoImport] = useState(false);
  const [cola, setCola] = useState([]);          // [{file, pdfUrl, meta, form, estado}]
  const [indiceActual, setIndiceActual] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const importInputRef = useRef(null);

  // ── Modo formulario individual ──
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [editandoId, setEditandoId] = useState(null);
  const [guardandoIndividual, setGuardandoIndividual] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfNombre, setPdfNombre] = useState('');
  const pdfInputRef = useRef(null);

  // ── Filtros tabla ──
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');

  // ── Eliminar ──
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // ── Modal seguidores ──
  const [modalSeguidores, setModalSeguidores] = useState(null); // { mesa, personas }
  const [cargandoSeguidores, setCargandoSeguidores] = useState(false);

  // ── Verificar votos ──
  const [verificando, setVerificando] = useState(false);
  const [modalVerificacion, setModalVerificacion] = useState(null);
  const [descargando, setDescargando] = useState(false);

  // ── Verificar puestos de votación ──
  const [verificandoPuestos, setVerificandoPuestos] = useState(false);
  const [modalPuestos, setModalPuestos] = useState(null); // { resumen, sinResultado, sinPersonas, coincidencias }
  const [tabPuestos, setTabPuestos] = useState('sinResultado');

  // ── Vista por líder (coordinador) ──
  const [listaLideres, setListaLideres] = useState([]);
  const [liderSeleccionado, setLiderSeleccionado] = useState('');
  const [descargandoLider, setDescargandoLider] = useState(false);
  const [tipoInforme, setTipoInforme] = useState('personas');
  const [tipoInformeLider, setTipoInformeLider] = useState('personas');
  const [busquedaLider, setBusquedaLider] = useState('');
  const [dropdownLiderAbierto, setDropdownLiderAbierto] = useState(false);
  const liderDropdownRef = useRef(null);

  // ── Modal importar Excel ──
  const [modalExcel, setModalExcel] = useState(false);
  const [excelForm, setExcelForm] = useState({ candidatoNumero: '', candidatoNombre: '', partido: '', fechaEleccion: '' });
  const [excelArchivo, setExcelArchivo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null); // { importados, errores, total }
  const [errorImport, setErrorImport] = useState(null);

  useEffect(() => {
    cargarDatos();
    if (esAdminOCoord) {
      api.get('/usuarios?rol=LIDER&limit=200').then(res => {
        if (res.data.success) setListaLideres(res.data.data.usuarios || []);
      }).catch(() => {});
    }
  }, []);

  // Cerrar dropdown de líder al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (liderDropdownRef.current && !liderDropdownRef.current.contains(e.target)) {
        setDropdownLiderAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [resA, resR] = await Promise.all([
      e14Service.obtenerAnalisis(),
      e14Service.obtenerResumen()
    ]);
    if (resA.success) setAnalisis(resA.data);
    else showToast(`Error al cargar análisis: ${resA.error}`, 'error');
    if (resR.success) setResumen(resR.data);
    else showToast(`Error al cargar resumen: ${resR.error}`, 'error');
    setLoading(false);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── IMPORTACIÓN POR COLA ──────────────────────────────────────────────────

  const handleSeleccionarArchivos = (e) => {
    const archivos = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (archivos.length === 0) return;

    // Revocar URLs anteriores
    cola.forEach(item => URL.revokeObjectURL(item.pdfUrl));

    const items = archivos.map(file => {
      const meta = parsearArchivo(file);
      return {
        file,
        pdfUrl: URL.createObjectURL(file),
        meta,
        form: { ...formVacio, zona: meta.zona, nombrePuesto: meta.nombrePuesto, mesa: meta.mesa },
        estado: 'pendiente' // pendiente | guardado | saltado
      };
    });

    setCola(items);
    setIndiceActual(0);
    setModoImport(true);
  };

  const itemActual = cola[indiceActual] || null;

  const actualizarFormCola = (campo, valor) => {
    setCola(prev => {
      const copia = [...prev];
      copia[indiceActual] = { ...copia[indiceActual], form: { ...copia[indiceActual].form, [campo]: valor } };
      return copia;
    });
  };

  const handleGuardarYSiguiente = async () => {
    if (!itemActual) return;
    const f = itemActual.form;

    if (!f.municipio || !f.zona || !f.mesa || !f.candidatoNumero) {
      showToast('Municipio, zona, mesa y número de candidato son requeridos', 'error');
      return;
    }

    setGuardando(true);
    const datos = {
      ...f,
      votosObtenidos: Number(f.votosObtenidos) || 0,
      votosLista: Number(f.votosLista) || 0,
      totalVotantes: Number(f.totalVotantes) || 0,
      potencialVotacion: Number(f.potencialVotacion) || 0,
      fechaEleccion: f.fechaEleccion || undefined
    };

    const res = await e14Service.guardarResultado(datos);
    setGuardando(false);

    if (res.success) {
      marcarEstado('guardado');
      showToast(`Mesa ${f.mesa} guardada ✓`);
      avanzar();
    } else {
      showToast(res.error, 'error');
    }
  };

  const handleSaltar = () => {
    marcarEstado('saltado');
    avanzar();
  };

  const marcarEstado = (estado) => {
    setCola(prev => {
      const copia = [...prev];
      copia[indiceActual] = { ...copia[indiceActual], estado };
      return copia;
    });
  };

  const avanzar = () => {
    const siguiente = cola.findIndex((item, idx) => idx > indiceActual && item.estado === 'pendiente');
    if (siguiente !== -1) {
      // Propagar municipio, departamento y candidatoNumero al siguiente ítem
      const formActual = cola[indiceActual]?.form;
      if (formActual) {
        setCola(prev => {
          const copia = [...prev];
          copia[siguiente] = {
            ...copia[siguiente],
            form: {
              ...copia[siguiente].form,
              municipio: copia[siguiente].form.municipio || formActual.municipio,
              departamento: copia[siguiente].form.departamento || formActual.departamento,
              candidatoNumero: copia[siguiente].form.candidatoNumero || formActual.candidatoNumero,
              candidatoNombre: copia[siguiente].form.candidatoNombre || formActual.candidatoNombre,
              partido: copia[siguiente].form.partido || formActual.partido,
              fechaEleccion: copia[siguiente].form.fechaEleccion || formActual.fechaEleccion,
            }
          };
          return copia;
        });
      }
      setIndiceActual(siguiente);
    } else {
      // No hay más pendientes
      const guardados = cola.filter(i => i.estado === 'guardado').length;
      showToast(`Importación completada. ${guardados} mesas guardadas.`);
      cerrarImportacion();
      cargarDatos();
    }
  };

  const cerrarImportacion = () => {
    cola.forEach(item => URL.revokeObjectURL(item.pdfUrl));
    setCola([]);
    setIndiceActual(0);
    setModoImport(false);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const guardados = cola.filter(i => i.estado === 'guardado').length;
  const saltados = cola.filter(i => i.estado === 'saltado').length;
  const pendientes = cola.filter(i => i.estado === 'pendiente').length;
  const progresoPorc = cola.length > 0 ? Math.round(((guardados + saltados) / cola.length) * 100) : 0;

  // ── FORMULARIO INDIVIDUAL ─────────────────────────────────────────────────

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditar = (item) => {
    setForm({
      departamento: item.departamento || '',
      municipio: item.municipio || '',
      zona: item.zona || '',
      nombrePuesto: item.nombrePuesto || '',
      mesa: item.mesa || '',
      candidatoNumero: item.candidatoNumero || '',
      candidatoNombre: item.candidatoNombre || '',
      partido: item.partido || '',
      votosObtenidos: item.votosObtenidos ?? '',
      votosLista: item.votosLista ?? '',
      totalVotantes: item.totalVotantes ?? '',
      potencialVotacion: item.potencialVotacion ?? '',
      fechaEleccion: item.fechaEleccion ? item.fechaEleccion.substring(0, 10) : '',
      notas: item.notas || ''
    });
    setEditandoId(item._id);
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGuardarIndividual = async (e) => {
    e.preventDefault();
    if (!form.municipio || !form.zona || !form.mesa || !form.candidatoNumero) {
      showToast('Municipio, zona, mesa y número de candidato son requeridos', 'error');
      return;
    }
    setGuardandoIndividual(true);
    const datos = {
      ...form,
      votosObtenidos: Number(form.votosObtenidos) || 0,
      votosLista: Number(form.votosLista) || 0,
      totalVotantes: Number(form.totalVotantes) || 0,
      potencialVotacion: Number(form.potencialVotacion) || 0,
      fechaEleccion: form.fechaEleccion || undefined
    };
    const res = editandoId
      ? await e14Service.actualizarResultado(editandoId, datos)
      : await e14Service.guardarResultado(datos);
    setGuardandoIndividual(false);
    if (res.success) {
      showToast(editandoId ? 'Resultado actualizado' : 'Resultado guardado');
      setMostrarFormulario(false);
      setForm(formVacio);
      setEditandoId(null);
      cargarDatos();
    } else {
      showToast(res.error, 'error');
    }
  };

  const handleEliminar = async () => {
    if (!confirmEliminar) return;
    setEliminando(true);
    const res = await e14Service.eliminarResultado(confirmEliminar);
    setEliminando(false);
    setConfirmEliminar(null);
    if (res.success) { showToast('Resultado eliminado'); cargarDatos(); }
    else showToast(res.error, 'error');
  };

  const handleImportarExcel = async () => {
    if (!excelArchivo) return;
    if (!excelForm.candidatoNumero.trim()) { setErrorImport('El número del candidato es requerido'); return; }
    setImportando(true);
    setResultadoImport(null);
    setErrorImport(null);
    const res = await e14Service.importarExcel(excelArchivo, excelForm);
    setImportando(false);
    if (res.success) {
      const d = res.data;
      setResultadoImport(d);
      cargarDatos();
      if (!d.advertencias?.length) {
        setModalExcel(false);
        showToast(`${d.importados} mesas importadas correctamente${d.errores?.length ? ` (${d.errores.length} errores)` : ''}`);
      } else {
        showToast(`${d.importados} mesas importadas · ${d.advertencias.length} advertencia${d.advertencias.length > 1 ? 's' : ''} de municipio`, 'warning');
      }
    } else {
      setErrorImport(res.error);
    }
  };

  const handleVerSeguidores = async (item) => {
    setCargandoSeguidores(true);
    setModalSeguidores({ mesa: item, personas: [] });
    const res = await e14Service.obtenerSeguidoresMesa(item._id);
    setCargandoSeguidores(false);
    if (res.success) {
      setModalSeguidores({ mesa: res.data.mesa, personas: res.data.personas });
    } else {
      setModalSeguidores(null);
      showToast(res.error, 'error');
    }
  };

  const handleVerificarVotos = async () => {
    setVerificando(true);
    const res = await e14Service.verificarVotos();
    setVerificando(false);
    if (res.success) {
      setModalVerificacion(res.data);
      cargarDatos();
    } else {
      showToast(res.error, 'error');
    }
  };

  const handleVerificarPuestos = async () => {
    setVerificandoPuestos(true);
    const res = await e14Service.verificarPuestosVotacion();
    setVerificandoPuestos(false);
    if (res.success) {
      setModalPuestos(res.data);
      setTabPuestos('sinResultado');
    } else {
      showToast(res.error, 'error');
    }
  };

  // ── TABLA ─────────────────────────────────────────────────────────────────

  const analisisFiltrado = analisis.filter(item => {
    if (filtroMunicipio && !item.municipio?.toLowerCase().includes(filtroMunicipio.toLowerCase())) return false;
    if (filtroNivel && item.estadoMesa !== filtroNivel) return false;
    return true;
  });

  const totalVotosCandidato = analisisFiltrado.reduce((s, i) => s + (i.votosObtenidos || 0), 0);
  const totalVotosLista = analisisFiltrado.reduce((s, i) => s + (i.votosLista || 0), 0);

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resultados E-14</h1>
          <p className="text-sm text-gray-500 mt-1">Formulario de escrutinio de mesa — Cámara · Marzo 2026</p>
        </div>
        {!modoImport && (
          <div className="flex gap-2 flex-wrap">
            {esAdminOCoord && <>
              {/* Importar Excel */}
              <button
                onClick={() => { setModalExcel(true); setResultadoImport(null); setErrorImport(null); setExcelArchivo(null); setExcelForm({ candidatoNumero: '', candidatoNombre: '', partido: '', fechaEleccion: '' }); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                📊 Importar Excel
              </button>
              {/* Importar múltiples PDFs */}
              <label className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                📂 Importar PDFs
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleSeleccionarArchivos}
                />
              </label>
              <button
                onClick={() => { setForm(formVacio); setEditandoId(null); setMostrarFormulario(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                + Registrar mesa
              </button>
              {/* Verificar cumplimiento de votos */}
              <button
                onClick={handleVerificarVotos}
                disabled={verificando}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {verificando ? '⏳ Verificando...' : '✓ Verificar votos'}
              </button>
              {/* Verificar cobertura de puestos */}
              <button
                onClick={handleVerificarPuestos}
                disabled={verificandoPuestos}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {verificandoPuestos ? '⏳ Verificando...' : '🗳 Verificar puestos'}
              </button>
            </>}
            {/* Descargar informe Excel — disponible para todos los roles */}
            <div className="flex items-center gap-1">
              {esAdminOCoord && (
                <select
                  value={tipoInforme}
                  onChange={e => setTipoInforme(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="personas">Personas</option>
                  <option value="resumen">Resumen por mesa</option>
                </select>
              )}
              <button
                onClick={async () => {
                  setDescargando(true);
                  const res = await e14Service.exportarInforme(null, esAdminOCoord ? tipoInforme : 'personas');
                  if (!res.success) showToast(res.error, 'error');
                  setDescargando(false);
                }}
                disabled={descargando}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {descargando ? '⏳ Generando...' : '⬇ Informe Excel'}
              </button>
            </div>
            {/* Limpiar — admin y coordinador */}
            {esAdminOCoord && (
              <button
                onClick={async () => {
                  if (!window.confirm('¿Eliminar TODOS los resultados E-14 de tu campaña? Esta acción no se puede deshacer.')) return;
                  const res = await e14Service.limpiarResultados();
                  if (res.success) { showToast('Datos E-14 eliminados', 'success'); cargarDatos(); }
                  else showToast(res.error, 'error');
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                🗑 Limpiar E-14
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vista dedicada para LIDER */}
      {esLider && (
        <VistaLider
          onExportar={async () => {
            setDescargando(true);
            const res = await e14Service.exportarInforme();
            if (!res.success) showToast(res.error, 'error');
            setDescargando(false);
          }}
          descargando={descargando}
        />
      )}

      {/* Análisis por mesa para LIDER — muestra con quién comparte votos */}
      {esLider && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="text-yellow-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <h2 className="text-base font-semibold text-gray-800">¿Con quién comparto votos?</h2>
            <span className="ml-1 text-xs bg-yellow-100 text-yellow-800 font-semibold px-2 py-0.5 rounded-full">Verificables</span>
          </div>
          <div className="p-5">
            <VistaInformeLider
              liderId={user?._id}
              filtroInicial="VERIFICABLE"
              onExportar={async () => {
                setDescargando(true);
                const res = await e14Service.exportarInforme(user?._id, 'resumen');
                if (!res.success) showToast(res.error, 'error');
                setDescargando(false);
              }}
              descargando={descargando}
            />
          </div>
        </div>
      )}

      {/* Vista por Líder — solo coordinador/admin */}
      {esAdminOCoord && !modoImport && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center flex-wrap gap-3">
            <h2 className="text-base font-semibold text-gray-800">Vista por Líder</h2>
            {/* Combobox con búsqueda de líder */}
            <div className="relative min-w-56" ref={liderDropdownRef}>
              <div
                className="flex items-center border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden"
              >
                <svg className="w-4 h-4 text-gray-400 ml-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar líder..."
                  value={dropdownLiderAbierto
                    ? busquedaLider
                    : liderSeleccionado
                      ? (() => { const l = listaLideres.find(x => x._id === liderSeleccionado); return l ? `${l.perfil?.nombres} ${l.perfil?.apellidos}` : ''; })()
                      : ''}
                  onChange={e => { setBusquedaLider(e.target.value); setDropdownLiderAbierto(true); }}
                  onFocus={() => { setBusquedaLider(''); setDropdownLiderAbierto(true); }}
                  className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent"
                />
                {liderSeleccionado && (
                  <button
                    onClick={() => { setLiderSeleccionado(''); setBusquedaLider(''); setDropdownLiderAbierto(false); }}
                    className="px-2 text-gray-400 hover:text-gray-600"
                    title="Limpiar"
                  >✕</button>
                )}
              </div>
              {dropdownLiderAbierto && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {listaLideres
                    .filter(l => {
                      const nombre = `${l.perfil?.nombres || ''} ${l.perfil?.apellidos || ''}`.toLowerCase();
                      return nombre.includes(busquedaLider.toLowerCase());
                    })
                    .map(l => (
                      <button
                        key={l._id}
                        onMouseDown={() => {
                          setLiderSeleccionado(l._id);
                          setBusquedaLider('');
                          setDropdownLiderAbierto(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${liderSeleccionado === l._id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'}`}
                      >
                        {l.perfil?.nombres} {l.perfil?.apellidos}
                      </button>
                    ))
                  }
                  {listaLideres.filter(l => {
                    const nombre = `${l.perfil?.nombres || ''} ${l.perfil?.apellidos || ''}`.toLowerCase();
                    return nombre.includes(busquedaLider.toLowerCase());
                  }).length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
                  )}
                </div>
              )}
            </div>
            {liderSeleccionado && (
              <div className="flex items-center gap-1">
                <select
                  value={tipoInformeLider}
                  onChange={e => setTipoInformeLider(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="personas">Personas</option>
                  <option value="resumen">Resumen por mesa</option>
                </select>
                <button
                  onClick={async () => {
                    setDescargandoLider(true);
                    const res = await e14Service.exportarInforme(liderSeleccionado, tipoInformeLider);
                    if (!res.success) showToast(res.error, 'error');
                    setDescargandoLider(false);
                  }}
                  disabled={descargandoLider}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                >
                  {descargandoLider ? '⏳ Generando...' : '⬇ Informe de este líder'}
                </button>
              </div>
            )}
          </div>
          {liderSeleccionado ? (
            <div className="p-5">
              <VistaInformeLider
                liderId={liderSeleccionado}
                onExportar={async () => {
                  setDescargandoLider(true);
                  const res = await e14Service.exportarInforme(liderSeleccionado, tipoInformeLider);
                  if (!res.success) showToast(res.error, 'error');
                  setDescargandoLider(false);
                }}
                descargando={descargandoLider}
              />
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              Selecciona un líder para ver sus mesas, personas y estado de votos
            </div>
          )}
        </div>
      )}

      {/* Tarjetas de resumen — solo para ADMIN/COORDINADOR y sin líder seleccionado */}
      {!esLider && !modoImport && !liderSeleccionado && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total votos candidato */}
          <div className="bg-white rounded-xl border-l-4 border-blue-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Total votos candidato</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{(resumen.totalVotosCandidato || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">votos obtenidos</p>
          </div>
          {/* Cumplido */}
          <div className="bg-white rounded-xl border-l-4 border-green-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Votos cumplidos</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{analisis.filter(a => a.estadoMesa === 'CUMPLIDO').reduce((s, a) => s + (a.votosObtenidos || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{analisis.filter(a => a.estadoMesa === 'CUMPLIDO').length} mesas</p>
          </div>
          {/* Verificable */}
          <div className="bg-white rounded-xl border-l-4 border-yellow-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Votos verificables</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{analisis.filter(a => a.estadoMesa === 'VERIFICABLE').reduce((s, a) => s + (a.votosObtenidos || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{analisis.filter(a => a.estadoMesa === 'VERIFICABLE').length} mesas</p>
          </div>
          {/* No cumplido */}
          <div className="bg-white rounded-xl border-l-4 border-orange-500 border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Votos no cumplidos</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{analisis.filter(a => a.estadoMesa === 'NO_CUMPLIDO').reduce((s, a) => s + (a.votosObtenidos || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{analisis.filter(a => a.estadoMesa === 'NO_CUMPLIDO').length} mesas</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODO IMPORTACIÓN EN COLA
      ════════════════════════════════════════════════════════════════ */}
      {modoImport && itemActual && (
        <div className="bg-white border border-green-200 rounded-xl shadow-sm overflow-hidden">

          {/* Barra de progreso */}
          <div className="bg-green-50 px-6 py-3 border-b border-green-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-green-900 text-sm">
                  Importando PDFs — {indiceActual + 1} de {cola.length}
                </span>
                <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  {guardados} guardadas · {saltados} saltadas · {pendientes} pendientes
                </span>
              </div>
              <button onClick={cerrarImportacion} className="text-gray-400 hover:text-gray-600 text-sm">
                Cancelar importación
              </button>
            </div>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progresoPorc}%` }}
              />
            </div>
          </div>

          {/* Layout visor + formulario */}
          <div className="flex flex-col lg:flex-row gap-0">

            {/* Visor PDF */}
            <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 truncate max-w-xs" title={itemActual.file.name}>
                  📄 {itemActual.file.name}
                </span>
                <span className="text-xs text-gray-400">{(itemActual.file.size / 1024).toFixed(0)} KB</span>
              </div>
              <iframe
                src={itemActual.pdfUrl}
                className="w-full rounded-lg border border-gray-200 bg-white"
                style={{ height: '580px' }}
                title={itemActual.file.name}
              />
            </div>

            {/* Formulario compacto (campos pre-llenados + votos a rellenar) */}
            <div className="lg:w-1/2 p-6 flex flex-col">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                Extraído del nombre de archivo
              </p>

              {/* Campos pre-llenados (editables si hace falta) */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Zona</label>
                  <input
                    type="text" value={itemActual.form.zona}
                    onChange={e => actualizarFormCola('zona', e.target.value)}
                    placeholder="33"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Mesa</label>
                  <input
                    type="text" value={itemActual.form.mesa}
                    onChange={e => actualizarFormCola('mesa', e.target.value)}
                    placeholder="004"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Municipio *</label>
                  <input
                    type="text" value={itemActual.form.municipio}
                    onChange={e => actualizarFormCola('municipio', e.target.value)}
                    placeholder="BARRANQUILLA"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del puesto</label>
                  <input
                    type="text" value={itemActual.form.nombrePuesto}
                    onChange={e => actualizarFormCola('nombrePuesto', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
                  <input
                    type="text" value={itemActual.form.departamento}
                    onChange={e => actualizarFormCola('departamento', e.target.value)}
                    placeholder="ATLÁNTICO"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <hr className="my-3 border-gray-200" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Datos a ingresar del acta
              </p>

              <div className="grid grid-cols-2 gap-3 flex-1">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Candidato # *</label>
                  <input
                    type="text" value={itemActual.form.candidatoNumero}
                    onChange={e => actualizarFormCola('candidatoNumero', e.target.value)}
                    placeholder="102"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre candidato</label>
                  <input
                    type="text" value={itemActual.form.candidatoNombre}
                    onChange={e => actualizarFormCola('candidatoNombre', e.target.value)}
                    placeholder="Nombre"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Votos candidato</label>
                  <input
                    type="number" value={itemActual.form.votosObtenidos}
                    onChange={e => actualizarFormCola('votosObtenidos', e.target.value)}
                    placeholder="0" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Votos por lista</label>
                  <input
                    type="number" value={itemActual.form.votosLista}
                    onChange={e => actualizarFormCola('votosLista', e.target.value)}
                    placeholder="0" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total urna</label>
                  <input
                    type="number" value={itemActual.form.totalVotantes}
                    onChange={e => actualizarFormCola('totalVotantes', e.target.value)}
                    placeholder="0" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Inscritos E-11</label>
                  <input
                    type="number" value={itemActual.form.potencialVotacion}
                    onChange={e => actualizarFormCola('potencialVotacion', e.target.value)}
                    placeholder="0" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha elección</label>
                  <input
                    type="date" value={itemActual.form.fechaEleccion}
                    onChange={e => actualizarFormCola('fechaEleccion', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleGuardarYSiguiente}
                  disabled={guardando}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors"
                >
                  {guardando ? 'Guardando...' : pendientes > 1 ? 'Guardar y siguiente →' : 'Guardar y finalizar'}
                </button>
                <button
                  onClick={handleSaltar}
                  disabled={guardando}
                  className="px-4 py-2.5 border border-gray-300 text-gray-500 hover:bg-gray-50 rounded-lg text-sm transition-colors"
                >
                  Saltar
                </button>
              </div>
            </div>
          </div>

          {/* Cola de archivos */}
          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2">Cola de archivos:</p>
            <div className="flex flex-wrap gap-2">
              {cola.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => item.estado === 'pendiente' && setIndiceActual(idx)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    idx === indiceActual
                      ? 'bg-green-600 text-white border-green-600'
                      : item.estado === 'guardado'
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : item.estado === 'saltado'
                      ? 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                  }`}
                  title={item.file.name}
                >
                  {item.estado === 'guardado' ? '✓ ' : item.estado === 'saltado' ? '— ' : ''}
                  Mesa {item.meta.mesa || (idx + 1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODO FORMULARIO INDIVIDUAL
      ════════════════════════════════════════════════════════════════ */}
      {esAdminOCoord && mostrarFormulario && !modoImport && (
        <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-6 py-3 border-b border-blue-200 flex items-center justify-between">
            <h2 className="font-semibold text-blue-900">
              {editandoId ? 'Editar resultado' : 'Registrar resultado de mesa'}
            </h2>
            <button onClick={() => setMostrarFormulario(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="flex flex-col lg:flex-row gap-0">
            {/* Visor PDF */}
            <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <label className="cursor-pointer bg-white border border-gray-300 hover:border-blue-400 text-gray-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2 transition-colors">
                  📄 {pdfNombre ? 'Cambiar PDF' : 'Abrir E-14 (PDF)'}
                  <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden"
                    onChange={e => {
                      const f = e.target.files[0];
                      if (!f) return;
                      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                      setPdfUrl(URL.createObjectURL(f));
                      setPdfNombre(f.name);
                      // Pre-llenar desde nombre de archivo
                      const meta = parsearArchivo(f);
                      setForm(prev => ({
                        ...prev,
                        zona: prev.zona || meta.zona,
                        nombrePuesto: prev.nombrePuesto || meta.nombrePuesto,
                        mesa: prev.mesa || meta.mesa
                      }));
                    }}
                  />
                </label>
                {pdfNombre && <span className="text-xs text-gray-500 truncate max-w-xs">{pdfNombre}</span>}
              </div>
              {pdfUrl ? (
                <iframe src={pdfUrl} className="w-full rounded-lg border border-gray-200" style={{ height: '600px' }} title="E-14 PDF" />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border-2 border-dashed border-gray-300 text-gray-400">
                  <span className="text-5xl mb-3">📋</span>
                  <p className="text-sm">Abre el PDF del E-14 para verlo aquí</p>
                  <p className="text-xs mt-1">El archivo no se sube al servidor</p>
                </div>
              )}
            </div>

            {/* Formulario */}
            <div className="lg:w-1/2 p-6">
              <form onSubmit={handleGuardarIndividual} className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ubicación de la mesa</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Departamento</label>
                      <input type="text" name="departamento" value={form.departamento} onChange={handleInputChange}
                        placeholder="Ej: ATLÁNTICO"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Municipio *</label>
                      <input type="text" name="municipio" value={form.municipio} onChange={handleInputChange}
                        placeholder="Ej: BARRANQUILLA" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Zona *</label>
                      <input type="text" name="zona" value={form.zona} onChange={handleInputChange}
                        placeholder="Ej: 33" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Mesa *</label>
                      <input type="text" name="mesa" value={form.mesa} onChange={handleInputChange}
                        placeholder="Ej: 004" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del puesto</label>
                      <input type="text" name="nombrePuesto" value={form.nombrePuesto} onChange={handleInputChange}
                        placeholder="Ej: COL.BARRANQUILLA CODEBA"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Candidato</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Número candidato *</label>
                      <input type="text" name="candidatoNumero" value={form.candidatoNumero} onChange={handleInputChange}
                        placeholder="Ej: 102" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nombre candidato</label>
                      <input type="text" name="candidatoNombre" value={form.candidatoNombre} onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Partido</label>
                      <input type="text" name="partido" value={form.partido} onChange={handleInputChange}
                        placeholder="Ej: PARTIDO DE LA U"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Votos (del E-14)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Votos candidato</label>
                      <input type="number" name="votosObtenidos" value={form.votosObtenidos} onChange={handleInputChange}
                        placeholder="0" min="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Votos por lista</label>
                      <input type="number" name="votosLista" value={form.votosLista} onChange={handleInputChange}
                        placeholder="0" min="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Total votos en urna</label>
                      <input type="number" name="totalVotantes" value={form.totalVotantes} onChange={handleInputChange}
                        placeholder="0" min="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Inscritos E-11</label>
                      <input type="number" name="potencialVotacion" value={form.potencialVotacion} onChange={handleInputChange}
                        placeholder="0" min="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Fecha elección</label>
                      <input type="date" name="fechaEleccion" value={form.fechaEleccion} onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
                      <input type="text" name="notas" value={form.notas} onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={guardandoIndividual}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                    {guardandoIndividual ? 'Guardando...' : editandoId ? 'Actualizar' : 'Guardar resultado'}
                  </button>
                  <button type="button"
                    onClick={() => { setMostrarFormulario(false); setForm(formVacio); setEditandoId(null); }}
                    className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TABLA DE ANÁLISIS CRUZADO — solo ADMIN/COORDINADOR
      ════════════════════════════════════════════════════════════════ */}
      {!esLider && !modoImport && !liderSeleccionado && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Análisis cruzado — Mesas × Personas</h2>
                {analisis.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {analisisFiltrado.length === analisis.length
                      ? `${analisis.length} mesas`
                      : `${analisisFiltrado.length} de ${analisis.length} mesas`}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Filtrar municipio..." value={filtroMunicipio}
                  onChange={e => setFiltroMunicipio(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
                <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todos los estados</option>
                  <option value="CUMPLIDO">Cumplido</option>
                  <option value="VERIFICABLE">Verificable</option>
                  <option value="NO_CUMPLIDO">No cumplido</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : analisisFiltrado.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🗳️</p>
              <p className="font-medium text-gray-500">No hay resultados E-14 registrados</p>
              {esCoord && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  <label className="cursor-pointer text-green-600 hover:underline text-sm">
                    📂 Importar PDFs
                    <input type="file" accept=".pdf" multiple className="hidden" onChange={handleSeleccionarArchivos} />
                  </label>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => { setForm(formVacio); setMostrarFormulario(true); }} className="text-blue-600 hover:underline text-sm">
                    + Registrar manualmente
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Puesto / Mesa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidato</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase">V. Candidato</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-indigo-600 uppercase">V. Lista</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Potencial</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Personas</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado voto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analisisFiltrado.map(item => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.nombrePuesto || '—'}</div>
                        <div className="text-gray-500 text-xs">{item.municipio} · Zona {item.zona} · Mesa {item.mesa}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">
                          <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 font-bold rounded px-1.5 py-0.5 text-xs mr-1">
                            #{item.candidatoNumero}
                          </span>
                          {item.candidatoNombre || '—'}
                        </div>
                        <div className="text-gray-400 text-xs">{item.partido || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-bold text-blue-700 text-base">{item.votosObtenidos ?? 0}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-bold text-indigo-600 text-base">{item.votosLista ?? 0}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">{item.potencialVotacion || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-medium text-gray-800">{item.totalSeguidores}</div>
                        {item.confirmados > 0 && <div className="text-xs text-green-600">{item.confirmados} confirmados</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${estadoMesaColor[item.estadoMesa] || estadoMesaColor.NO_CUMPLIDO}`}>
                          {estadoMesaLabel[item.estadoMesa] || 'No cumplido'}
                        </span>
                        {item.efectividad !== null && (
                          <div className="text-xs mt-0.5 text-gray-400">{item.efectividad}%</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleVerSeguidores(item)} className="text-green-600 hover:text-green-800 text-xs font-medium">Ver</button>
                          {esAdminOCoord && <button onClick={() => handleEditar(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>}
                          {esAdmin && (
                            <button onClick={() => setConfirmEliminar(item._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {analisisFiltrado.length > 1 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-4 py-2 text-xs font-semibold text-gray-600" colSpan={2}>
                        Total ({analisisFiltrado.length} mesas)
                      </td>
                      <td className="px-4 py-2 text-center font-bold text-blue-700">{totalVotosCandidato}</td>
                      <td className="px-4 py-2 text-center font-bold text-indigo-600">{totalVotosLista}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal importar Excel */}
      {modalExcel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Importar resultados desde Excel</h3>
              <button onClick={() => setModalExcel(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">&times;</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Archivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archivo Excel (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => setExcelArchivo(e.target.files[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100"
                />
                {excelArchivo && <p className="text-xs text-gray-500 mt-1">{excelArchivo.name}</p>}
              </div>

              {/* Número de candidato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número del candidato <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={excelForm.candidatoNumero}
                  onChange={e => setExcelForm(f => ({ ...f, candidatoNumero: e.target.value }))}
                  placeholder="Ej: 102"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">El nombre y partido del candidato se leerán automáticamente del Excel</p>
              </div>

              {/* Fecha elección (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de elección (opcional)</label>
                <input
                  type="date"
                  value={excelForm.fechaEleccion}
                  onChange={e => setExcelForm(f => ({ ...f, fechaEleccion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Error de importación */}
              {errorImport && (
                <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-sm">
                  <p className="font-semibold text-red-700 flex items-center gap-1.5">
                    <span>✗</span> Error al importar
                  </p>
                  <p className="text-red-600 mt-0.5 text-xs">{errorImport}</p>
                </div>
              )}

              {/* Resultado exitoso */}
              {resultadoImport && (
                <div className={`rounded-lg p-3 text-sm ${resultadoImport.errores.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <p className="font-semibold text-green-800 flex items-center gap-1.5">
                    <span>✓</span> {resultadoImport.importados} de {resultadoImport.total} mesas importadas correctamente
                  </p>
                  {resultadoImport.candidatoNombre && (
                    <p className="text-xs text-gray-600 mt-1">Candidato detectado: <strong>{resultadoImport.candidatoNombre}</strong></p>
                  )}
                  {resultadoImport.partido && (
                    <p className="text-xs text-gray-500">Partido: {resultadoImport.partido}</p>
                  )}
                  {resultadoImport.errores.length > 0 && (
                    <ul className="mt-2 text-yellow-700 text-xs list-disc list-inside max-h-24 overflow-y-auto">
                      {resultadoImport.errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Advertencias de municipio incorrecto */}
              {resultadoImport?.advertencias?.length > 0 && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-300 text-sm">
                  <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                    <span>⚠</span> {resultadoImport.advertencias.length} puesto{resultadoImport.advertencias.length > 1 ? 's' : ''} con municipio diferente al registrado
                  </p>
                  <p className="text-amber-700 text-xs mt-1 mb-2">
                    El municipio en el Excel no coincide con el municipio real en el sistema. Verifica los datos:
                  </p>
                  <ul className="text-xs space-y-1.5 max-h-40 overflow-y-auto">
                    {resultadoImport.advertencias.map((a, i) => (
                      <li key={i} className="border-b border-amber-200 pb-1.5 last:border-0 last:pb-0">
                        <span className="font-semibold text-amber-900">{a.nombrePuesto}</span>
                        <span className="block text-amber-700 mt-0.5">
                          Excel: <strong>{a.municipioExcel}</strong>
                          <span className="mx-1.5 text-amber-400">→</span>
                          Sistema: <strong>{a.municipioReal}</strong>
                          <span className="ml-1.5 text-amber-500">({a.mesas} mesa{a.mesas > 1 ? 's' : ''})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleImportarExcel}
                disabled={importando || !excelArchivo}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {importando ? 'Importando...' : 'Importar'}
              </button>
              <button
                onClick={() => setModalExcel(false)}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg text-sm transition-colors"
              >
                {resultadoImport ? 'Cerrar' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal verificar puestos de votación */}
      {modalPuestos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Verificación de puestos de votación</h3>
                <p className="text-sm text-gray-500 mt-0.5">Cobertura entre Personas registradas y resultados E-14 importados</p>
              </div>
              <button onClick={() => setModalPuestos(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">&times;</button>
            </div>

            {/* Tarjetas resumen */}
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-gray-100 flex-shrink-0">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{modalPuestos.resumen.totalPuestosPersonas}</p>
                <p className="text-xs text-blue-600 mt-0.5">Puestos en Personas</p>
              </div>
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{modalPuestos.resumen.totalPuestosResultados}</p>
                <p className="text-xs text-purple-600 mt-0.5">Puestos importados</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{modalPuestos.resumen.puestosCoinciden}</p>
                <p className="text-xs text-green-600 mt-0.5">Coinciden</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{modalPuestos.resumen.puestosSinResultado}</p>
                <p className="text-xs text-red-600 mt-0.5">Sin resultado</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-3 flex gap-1 border-b border-gray-200 flex-shrink-0">
              {[
                { key: 'sinResultado', label: `Sin resultado (${modalPuestos.resumen.puestosSinResultado})`, color: 'text-red-600 border-red-500' },
                { key: 'sinPersonas',  label: `Sin personas (${modalPuestos.resumen.puestosSinPersonas})`,  color: 'text-orange-600 border-orange-500' },
                { key: 'coinciden',    label: `Coinciden (${modalPuestos.resumen.puestosCoinciden})`,       color: 'text-green-600 border-green-500' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTabPuestos(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tabPuestos === t.key ? t.color : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tabla */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {tabPuestos === 'sinResultado' && (
                modalPuestos.sinResultado.length === 0
                  ? <p className="text-center py-10 text-gray-400 text-sm">Todos los puestos tienen resultados importados</p>
                  : <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                          <th className="pb-2 font-medium">Municipio</th>
                          <th className="pb-2 font-medium">Puesto de votación</th>
                          <th className="pb-2 font-medium text-right">Personas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalPuestos.sinResultado.map((p, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-red-50">
                            <td className="py-2 text-gray-600 pr-3 whitespace-nowrap">{p.municipio}</td>
                            <td className="py-2 text-gray-900 font-medium">{p.nombrePuesto || <span className="text-gray-400 italic">Sin nombre</span>}</td>
                            <td className="py-2 text-right font-semibold text-red-700">{p.personas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}
              {tabPuestos === 'sinPersonas' && (
                modalPuestos.sinPersonas.length === 0
                  ? <p className="text-center py-10 text-gray-400 text-sm">Todos los resultados importados tienen personas asociadas</p>
                  : <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                          <th className="pb-2 font-medium">Municipio</th>
                          <th className="pb-2 font-medium">Puesto de votación</th>
                          <th className="pb-2 font-medium text-right">Mesas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalPuestos.sinPersonas.map((p, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-orange-50">
                            <td className="py-2 text-gray-600 pr-3 whitespace-nowrap">{p.municipio}</td>
                            <td className="py-2 text-gray-900 font-medium">{p.nombrePuesto || <span className="text-gray-400 italic">Sin nombre</span>}</td>
                            <td className="py-2 text-right font-semibold text-orange-700">{p.mesas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}
              {tabPuestos === 'coinciden' && (
                modalPuestos.coincidencias.length === 0
                  ? <p className="text-center py-10 text-gray-400 text-sm">No hay coincidencias</p>
                  : <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                          <th className="pb-2 font-medium">Municipio</th>
                          <th className="pb-2 font-medium">Puesto de votación</th>
                          <th className="pb-2 font-medium text-right">Personas</th>
                          <th className="pb-2 font-medium text-right">Mesas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalPuestos.coincidencias.map((p, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-green-50">
                            <td className="py-2 text-gray-600 pr-3 whitespace-nowrap">{p.municipio}</td>
                            <td className="py-2 text-gray-900 font-medium">{p.nombrePuesto || <span className="text-gray-400 italic">Sin nombre</span>}</td>
                            <td className="py-2 text-right font-semibold text-blue-700">{p.personas}</td>
                            <td className="py-2 text-right font-semibold text-green-700">{p.mesas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setModalPuestos(null)}
                className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal seguidores de mesa */}
      {modalSeguidores && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Personas en mesa {modalSeguidores.mesa.mesa}
                </h3>
                <p className="text-sm text-gray-500">
                  {modalSeguidores.mesa.municipio} · Zona {modalSeguidores.mesa.zona} · {modalSeguidores.mesa.nombrePuesto || ''}
                </p>
              </div>
              <button onClick={() => setModalSeguidores(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">&times;</button>
            </div>

            {/* Resumen rápido */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-6 text-sm flex-shrink-0">
              <span><span className="font-semibold text-blue-700">{modalSeguidores.mesa.votosObtenidos ?? 0}</span> votos candidato</span>
              <span><span className="font-semibold text-indigo-600">{modalSeguidores.mesa.votosLista ?? 0}</span> votos lista</span>
              <span><span className="font-semibold text-gray-700">{modalSeguidores.mesa.potencialVotacion ?? '—'}</span> potencial</span>
              <span><span className="font-semibold text-green-700">{cargandoSeguidores ? '...' : modalSeguidores.personas.length}</span> personas</span>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              {cargandoSeguidores ? (
                <div className="flex items-center justify-center py-16 text-gray-400">Cargando personas...</div>
              ) : modalSeguidores.personas.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-gray-400">No hay personas registradas en esta mesa</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cédula</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Contacto</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-purple-600 uppercase">Voto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Líder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {modalSeguidores.personas.map((p, idx) => {
                      const estadoColors = {
                        CONFIRMADO: 'bg-green-100 text-green-800',
                        CONTACTADO: 'bg-blue-100 text-blue-800',
                        NO_CONTACTADO: 'bg-red-100 text-red-800',
                        PENDIENTE: 'bg-yellow-100 text-yellow-800'
                      };
                      const estadoLabels = {
                        CONFIRMADO: 'Confirmado',
                        CONTACTADO: 'Contactado',
                        NO_CONTACTADO: 'No contactado',
                        PENDIENTE: 'Pendiente'
                      };
                      const votoColors = {
                        CUMPLIDO:    'bg-green-100 text-green-800',
                        VERIFICABLE: 'bg-yellow-100 text-yellow-800',
                        NO_CUMPLIDO: 'bg-orange-100 text-orange-800',
                      };
                      const votoLabels = {
                        CUMPLIDO:    'Cumplido',
                        VERIFICABLE: 'Verificable',
                        NO_CUMPLIDO: 'No cumplido',
                      };
                      return (
                        <tr key={p._id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">{p.apellidos} {p.nombres}</td>
                          <td className="px-4 py-2 text-gray-600">{p.documento}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[p.estadoContacto] || 'bg-gray-100 text-gray-700'}`}>
                              {estadoLabels[p.estadoContacto] || p.estadoContacto || 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${votoColors[p.estadoVoto] || votoColors.NO_CUMPLIDO}`}
                              title={p.notaVoto || ''}
                            >
                              {votoLabels[p.estadoVoto] || 'No cumplido'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{p.lider?.nombre || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button onClick={() => setModalSeguidores(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal resultado verificación de votos */}
      {modalVerificacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Verificación de votos completada</h3>
              <button onClick={() => setModalVerificacion(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Mesas procesadas</p>
                  <p className="text-2xl font-bold text-gray-800">{modalVerificacion.totalMesas}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Personas actualizadas</p>
                  <p className="text-2xl font-bold text-gray-800">{modalVerificacion.personasActualizadas}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-green-800">Voto cumplido</span>
                    <span className="text-xs text-green-600">— votos ≥ personas</span>
                  </div>
                  <span className="font-bold text-green-700 text-lg">{modalVerificacion.resumen.cumplido} mesas</span>
                </div>
                <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-yellow-800">Verificable</span>
                    <span className="text-xs text-yellow-600">— votos &lt; personas</span>
                  </div>
                  <span className="font-bold text-yellow-700 text-lg">{modalVerificacion.resumen.verificable} mesas</span>
                </div>
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-red-800">No cumplido</span>
                    <span className="text-xs text-red-600">— sin votos del candidato</span>
                  </div>
                  <span className="font-bold text-red-700 text-lg">{modalVerificacion.resumen.noCumplido} mesas</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">El estado de voto de cada persona fue actualizado. Puedes verlo en la sección Personas.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200">
              <button onClick={() => setModalVerificacion(null)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Eliminar resultado</h3>
            <p className="text-gray-600 text-sm mb-6">¿Estás seguro que deseas eliminar este resultado? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={handleEliminar} disabled={eliminando}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button onClick={() => setConfirmEliminar(null)}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
