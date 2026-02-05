// src/pages/Personas.jsx

import { useState, useEffect } from 'react';
import personaService from '../services/personaService';
import useDebounce from '../hooks/useDebounce';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';

const initialFormData = {
  documento: '',
  nombres: '',
  apellidos: '',
  email: '',
  telefono: '',
  estadoContacto: 'PENDIENTE',
  // Datos de puesto de votación
  departamento: '',
  municipio: '',
  zona: '',
  nombrePuesto: '',
  direccion: '',
  mesa: ''
};

function Personas() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Modal de creación
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [estadoContacto, setEstadoContacto] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [mesa, setMesa] = useState('');

  // Debounce del search
  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    cargarPersonas();
  }, [debouncedSearch, estadoContacto, departamento, mesa, pagination.page]);

  const cargarPersonas = async () => {
    setLoading(true);

    const resultado = await personaService.listar({
      page: pagination.page,
      limit: pagination.limit,
      search: debouncedSearch,
      estadoContacto,
      departamento,
      mesa
    });

    if (resultado.success) {
      setPersonas(resultado.personas || []);
      setPagination(resultado.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      });
    } else {
      setAlert({ type: 'error', message: resultado.error });
      setPersonas([]);
    }

    setLoading(false);
  };

  const handleExportarCSV = async () => {
    const resultado = await personaService.exportarCSV();
    if (resultado.success) {
      setAlert({ type: 'success', message: '✅ CSV descargado exitosamente' });
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  const abrirModal = () => {
    setFormData(initialFormData);
    setShowModal(true);
    setAlert(null);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setFormData(initialFormData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCrearPersona = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Construir objeto con estructura correcta para el backend
    const datosPersona = {
      documento: formData.documento.trim(),
      nombres: formData.nombres.trim(),
      apellidos: formData.apellidos.trim(),
      email: formData.email.trim() || undefined,
      telefono: formData.telefono.trim() || undefined,
      estadoContacto: formData.estadoContacto,
      puesto: {
        departamento: formData.departamento.trim() || undefined,
        municipio: formData.municipio.trim() || undefined,
        zona: formData.zona.trim() || undefined,
        nombrePuesto: formData.nombrePuesto.trim() || undefined,
        direccion: formData.direccion.trim() || undefined,
        mesa: formData.mesa.trim() || undefined
      }
    };

    // Limpiar campos vacíos de puesto
    Object.keys(datosPersona.puesto).forEach(key => {
      if (!datosPersona.puesto[key]) {
        delete datosPersona.puesto[key];
      }
    });

    if (Object.keys(datosPersona.puesto).length === 0) {
      delete datosPersona.puesto;
    }

    const resultado = await personaService.crear(datosPersona);

    if (resultado.success) {
      setAlert({ type: 'success', message: '✅ Persona creada exitosamente' });
      cerrarModal();
      cargarPersonas();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }

    setSaving(false);
  };

  const cambiarPagina = (nuevaPagina) => {
    setPagination({ ...pagination, page: nuevaPagina });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      CONFIRMADO: 'bg-green-100 text-green-800',
      CONTACTADO: 'bg-blue-100 text-blue-800',
      NO_CONTACTADO: 'bg-red-100 text-red-800',
      PENDIENTE: 'bg-yellow-100 text-yellow-800'
    };
    return badges[estado] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            👥 Personas
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona la base de datos de personas
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
          <button
            onClick={abrirModal}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <span className="mr-2">➕</span>
            Nueva Persona
          </button>
          <button
            onClick={handleExportarCSV}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <span className="mr-2">📥</span>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alert && (
        <Alert 
          type={alert.type} 
          message={alert.message} 
          onClose={() => setAlert(null)}
        />
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, documento..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Estado de Contacto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado de Contacto
            </label>
            <select
              value={estadoContacto}
              onChange={(e) => setEstadoContacto(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="CONTACTADO">Contactado</option>
              <option value="NO_CONTACTADO">No Contactado</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departamento
            </label>
            <input
              type="text"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              placeholder="Ej: ATLANTICO"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Mesa de Votación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mesa de Votación
            </label>
            <input
              type="text"
              value={mesa}
              onChange={(e) => setMesa(e.target.value)}
              placeholder="Ej: 13"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Mostrando {personas.length} de {(pagination.total || 0).toLocaleString()} personas
          </p>
        </div>
      </div>

      {/* Tabla / Cards */}
      {loading ? (
        <Spinner message="Cargando personas..." />
      ) : personas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <span className="text-6xl mb-4 block">🔍</span>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No se encontraron personas
          </h3>
          <p className="text-gray-600">
            {search || estadoContacto || departamento 
              ? 'Intenta ajustar los filtros de búsqueda' 
              : 'Aún no hay personas registradas en la base de datos'}
          </p>
        </div>
      ) : (
        <>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Puesto / Mesa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Líder
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {personas.map((persona) => (
                    <tr key={persona._id || persona.documento} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {persona.documento || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {persona.nombres || 'Sin nombre'} {persona.apellidos || ''}
                          </div>
                          {persona.email && (
                            <div className="text-sm text-gray-500">{persona.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {persona.telefono || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {persona.puesto?.nombrePuesto || 'Sin puesto'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {persona.puesto?.municipio || ''} {persona.puesto?.mesa ? `- Mesa ${persona.puesto.mesa}` : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoBadge(persona.estadoContacto)}`}>
                          {persona.estadoContacto || 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {persona.lider?.perfil?.nombres || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Mobile - Cards */}
          <div className="lg:hidden space-y-4">
            {personas.map((persona) => (
              <div key={persona._id || persona.documento} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">
                      {persona.nombres || 'Sin nombre'} {persona.apellidos || ''}
                    </h3>
                    <p className="text-sm text-gray-600">{persona.documento || 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadge(persona.estadoContacto)}`}>
                    {persona.estadoContacto || 'PENDIENTE'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  {persona.telefono && (
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">📱</span>
                      {persona.telefono}
                    </div>
                  )}
                  {persona.email && (
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">📧</span>
                      {persona.email}
                    </div>
                  )}
                  {persona.puesto?.nombrePuesto && (
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">🏫</span>
                      {persona.puesto.nombrePuesto}
                    </div>
                  )}
                  {persona.puesto?.municipio && (
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">📍</span>
                      {persona.puesto.municipio} {persona.puesto?.mesa ? `- Mesa ${persona.puesto.mesa}` : ''}
                    </div>
                  )}
                  {persona.lider?.perfil?.nombres && (
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">👤</span>
                      Líder: {persona.lider.perfil.nombres}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {pagination.pages > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => cambiarPagina(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Página {pagination.page} de {pagination.pages}
                  </span>
                </div>

                <button
                  onClick={() => cambiarPagina(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Crear Persona */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Nueva Persona
              </h2>
              <button
                onClick={cerrarModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCrearPersona} className="space-y-6">
              {/* Datos Personales */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                  Datos Personales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Documento (Cédula) *
                    </label>
                    <input
                      type="text"
                      name="documento"
                      value={formData.documento}
                      onChange={handleInputChange}
                      required
                      maxLength="15"
                      placeholder="Ej: 1234567890"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombres *
                    </label>
                    <input
                      type="text"
                      name="nombres"
                      value={formData.nombres}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej: Juan Carlos"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellidos *
                    </label>
                    <input
                      type="text"
                      name="apellidos"
                      value={formData.apellidos}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej: Pérez García"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Ej: correo@ejemplo.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      placeholder="Ej: 3001234567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado de Contacto
                    </label>
                    <select
                      name="estadoContacto"
                      value={formData.estadoContacto}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="CONTACTADO">Contactado</option>
                      <option value="CONFIRMADO">Confirmado</option>
                      <option value="NO_CONTACTADO">No Contactado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Datos de Puesto de Votación */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                  Puesto de Votación
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento
                    </label>
                    <input
                      type="text"
                      name="departamento"
                      value={formData.departamento}
                      onChange={handleInputChange}
                      placeholder="Ej: ATLANTICO"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Municipio
                    </label>
                    <input
                      type="text"
                      name="municipio"
                      value={formData.municipio}
                      onChange={handleInputChange}
                      placeholder="Ej: BARRANQUILLA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zona
                    </label>
                    <input
                      type="text"
                      name="zona"
                      value={formData.zona}
                      onChange={handleInputChange}
                      placeholder="Ej: URBANA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Puesto
                    </label>
                    <input
                      type="text"
                      name="nombrePuesto"
                      value={formData.nombrePuesto}
                      onChange={handleInputChange}
                      placeholder="Ej: IE MARIA EMMA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleInputChange}
                      placeholder="Ej: CRA 12 No 6-61"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mesa
                    </label>
                    <input
                      type="text"
                      name="mesa"
                      value={formData.mesa}
                      onChange={handleInputChange}
                      placeholder="Ej: 13"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {saving ? 'Guardando...' : 'Crear Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Personas;