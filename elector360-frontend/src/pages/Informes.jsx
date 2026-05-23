import { useState, useEffect } from 'react';
import api from '../services/api';
import campanaService from '../services/campanaService';

const ESTADO_CONTACTO_LABEL = {
  CONFIRMADO: 'Confirmado',
  CONTACTADO: 'Contactado',
  PENDIENTE: 'Pendiente',
  NO_CONTACTADO: 'No contactado'
};

const ESTADO_VOTO_LABEL = {
  CUMPLIDO: 'Votó',
  PENDIENTE: 'Pendiente',
  NO_VOTO: 'No votó'
};

const CONTACTO_COLORES = {
  CONFIRMADO: 'bg-green-100 text-green-700',
  CONTACTADO: 'bg-blue-100 text-blue-700',
  PENDIENTE: 'bg-yellow-100 text-yellow-700',
  NO_CONTACTADO: 'bg-gray-100 text-gray-600'
};

const VOTO_COLORES = {
  CUMPLIDO: 'bg-emerald-100 text-emerald-700',
  PENDIENTE: 'bg-yellow-100 text-yellow-700',
  NO_VOTO: 'bg-red-100 text-red-700'
};

function EstadoBadge({ valor, mapa, colores }) {
  if (!valor) return <span className="text-gray-400 text-xs">—</span>;
  const label = mapa[valor] || valor;
  const color = colores[valor] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function Informes() {
  const [campanas, setCampanas] = useState([]);
  const [campanaId, setCampanaId] = useState('');
  const [coordinadores, setCoordinadores] = useState([]);
  const [coordinadorId, setCoordinadorId] = useState('');
  const [informe, setInforme] = useState(null);

  const [loadingCampanas, setLoadingCampanas] = useState(true);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [exportando, setExportando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [liderFiltro, setLiderFiltro] = useState('');
  const [expandidos, setExpandidos] = useState({});

  // Cargar campañas al montar
  useEffect(() => {
    campanaService.listar().then(res => {
      if (res.success) {
        // listarCampanas devuelve { campanas: [...], total } dentro de data
        const lista = res.data?.campanas || res.data || [];
        setCampanas(Array.isArray(lista) ? lista : []);
      }
      setLoadingCampanas(false);
    });
  }, []);

  // Cuando cambia la campaña, recargar coordinadores
  useEffect(() => {
    if (!campanaId) {
      setCoordinadores([]);
      setCoordinadorId('');
      setInforme(null);
      return;
    }
    setCoordinadorId('');
    setInforme(null);
    setError(null);
    setLoadingCoords(true);
    api.get('/informes/coordinadores', { params: { campanaId } })
      .then(res => setCoordinadores(res.data.data || []))
      .catch(err => setError(err.response?.data?.error || 'Error cargando coordinadores'))
      .finally(() => setLoadingCoords(false));
  }, [campanaId]);

  const cargarInforme = async () => {
    if (!coordinadorId || !campanaId) return;
    setLoading(true);
    setError(null);
    setInforme(null);
    setBusqueda('');
    setLiderFiltro('');
    setExpandidos({});
    try {
      const res = await api.get(`/informes/coordinador/${coordinadorId}`, { params: { campanaId } });
      setInforme(res.data.data);
      const exp = {};
      res.data.data.lideres.forEach(g => { exp[g.lider._id] = true; });
      setExpandidos(exp);
    } catch (err) {
      setError(err.response?.data?.error || 'Error cargando informe');
    } finally {
      setLoading(false);
    }
  };

  const toggleLider = (id) => setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  const expandirTodos = () => {
    const exp = {};
    informe?.lideres.forEach(g => { exp[g.lider._id] = true; });
    setExpandidos(exp);
  };
  const colapsarTodos = () => setExpandidos({});

  const lideresVisibles = (informe?.lideres || []).filter(grupo => {
    if (liderFiltro && grupo.lider._id !== liderFiltro) return false;
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return grupo.personas.some(p =>
      p.documento?.includes(term) ||
      p.nombres?.toLowerCase().includes(term) ||
      p.apellidos?.toLowerCase().includes(term) ||
      p.puesto?.municipio?.toLowerCase().includes(term)
    );
  });

  const exportarExcel = async () => {
    if (!informe || !coordinadorId || !campanaId) return;
    setExportando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/informes/coordinador/${coordinadorId}/excel?campanaId=${campanaId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Error al generar el archivo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe-${informe.coordinador.nombre.replace(/\s+/g, '-')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al exportar el informe Excel');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Informes por Coordinador</h1>
        <p className="text-sm text-gray-500 mt-1">Selecciona una campaña y un coordinador para ver todas sus personas agrupadas por líder</p>
      </div>

      {/* Selectores */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">

          {/* Campaña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              1. Campaña
            </label>
            {loadingCampanas ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={campanaId}
                onChange={e => setCampanaId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">-- Selecciona una campaña --</option>
                {campanas.map(c => (
                  <option key={c._id} value={c._id}>{c.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* Coordinador */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              2. Coordinador
            </label>
            {loadingCoords ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={coordinadorId}
                onChange={e => setCoordinadorId(e.target.value)}
                disabled={!campanaId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {!campanaId ? '-- Primero selecciona campaña --' : coordinadores.length === 0 ? 'Sin coordinadores en esta campaña' : '-- Selecciona un coordinador --'}
                </option>
                {coordinadores.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.nombre} ({c.totalLideres} {c.totalLideres === 1 ? 'líder' : 'líderes'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Botón */}
          <div>
            <button
              onClick={cargarInforme}
              disabled={!coordinadorId || !campanaId || loading}
              className="w-full px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Cargando...' : 'Ver Informe'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {/* Resultado */}
      {informe && (
        <>
          {/* Resumen */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-emerald-800">{informe.coordinador.nombre}</h2>
                <p className="text-sm text-emerald-600">{informe.coordinador.email}</p>
              </div>
              <div className="flex gap-4 text-center">
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-700">{informe.totales.lideres}</p>
                  <p className="text-xs text-gray-500">Líderes</p>
                </div>
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-700">{informe.totales.personas}</p>
                  <p className="text-xs text-gray-500">Personas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de herramientas */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por nombre, documento o municipio..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <select
              value={liderFiltro}
              onChange={e => setLiderFiltro(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Todos los líderes</option>
              {informe.lideres.map(g => (
                <option key={g.lider._id} value={g.lider._id}>
                  {g.lider.nombre} ({g.lider.totalPersonas})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={expandirTodos} className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Expandir</button>
              <button onClick={colapsarTodos} className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Colapsar</button>
              <button
                onClick={exportarExcel}
                disabled={exportando}
                className="px-4 py-2 text-xs bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50"
              >
                {exportando ? 'Generando...' : '⬇ Excel'}
              </button>
            </div>
          </div>

          {informe.totales.personas === 0 ? (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-10 text-center text-gray-400">
              Este coordinador no tiene personas registradas en esta campaña.
            </div>
          ) : (
            <div className="space-y-4">
              {lideresVisibles.map(grupo => {
                const term = busqueda.toLowerCase();
                const personasDelGrupo = busqueda
                  ? grupo.personas.filter(p =>
                      p.documento?.includes(term) ||
                      p.nombres?.toLowerCase().includes(term) ||
                      p.apellidos?.toLowerCase().includes(term) ||
                      p.puesto?.municipio?.toLowerCase().includes(term)
                    )
                  : grupo.personas;

                if (busqueda && personasDelGrupo.length === 0) return null;

                return (
                  <div key={grupo.lider._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleLider(grupo.lider._id)}
                      className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{expandidos[grupo.lider._id] ? '▾' : '▸'}</span>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900">{grupo.lider.nombre}</p>
                          <p className="text-xs text-gray-500">{grupo.lider.email}</p>
                        </div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                        {personasDelGrupo.length} personas
                      </span>
                    </button>

                    {expandidos[grupo.lider._id] && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Documento</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Nombre</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Municipio</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Puesto</th>
                              <th className="text-center px-4 py-2 font-medium text-gray-600 text-xs">Mesa</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Contacto</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Voto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {personasDelGrupo.map(p => (
                              <tr key={p._id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-mono text-xs text-gray-700">{p.documento}</td>
                                <td className="px-4 py-2 text-gray-900">
                                  {[p.nombres, p.apellidos].filter(Boolean).join(' ') || <span className="text-gray-400 italic text-xs">Sin nombre</span>}
                                </td>
                                <td className="px-4 py-2 text-gray-600 text-xs">{p.puesto?.municipio || '—'}</td>
                                <td className="px-4 py-2 text-gray-600 text-xs max-w-[160px] truncate" title={p.puesto?.nombrePuesto}>
                                  {p.puesto?.nombrePuesto || '—'}
                                </td>
                                <td className="px-4 py-2 text-center text-gray-600 text-xs">{p.puesto?.mesa || '—'}</td>
                                <td className="px-4 py-2">
                                  <EstadoBadge valor={p.estadoContacto} mapa={ESTADO_CONTACTO_LABEL} colores={CONTACTO_COLORES} />
                                </td>
                                <td className="px-4 py-2">
                                  <EstadoBadge valor={p.estadoVoto} mapa={ESTADO_VOTO_LABEL} colores={VOTO_COLORES} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Informes;
