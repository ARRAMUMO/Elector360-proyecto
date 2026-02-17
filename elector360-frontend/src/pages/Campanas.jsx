// src/pages/Campanas.jsx

import { useState, useEffect } from 'react';
import campanaService from '../services/campanaService';
import api from '../services/api';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';
import { useToast } from '../components/common/Toast';

const TIPOS_CAMPANA = [
  { value: 'ALCALDIA', label: 'Alcaldia' },
  { value: 'CONCEJO', label: 'Concejo' },
  { value: 'GOBERNACION', label: 'Gobernacion' },
  { value: 'ASAMBLEA', label: 'Asamblea' },
  { value: 'CAMARA', label: 'Camara' },
  { value: 'SENADO', label: 'Senado' },
  { value: 'OTRO', label: 'Otro' }
];

const ESTADOS_CAMPANA = [
  { value: 'ACTIVA', label: 'Activa', color: 'bg-green-100 text-green-800' },
  { value: 'INACTIVA', label: 'Inactiva', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'FINALIZADA', label: 'Finalizada', color: 'bg-gray-100 text-gray-800' }
];

function Campanas() {
  const { addToast } = useToast();
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCampana, setEditingCampana] = useState(null);
  const [modalAlert, setModalAlert] = useState(null);
  const [coordinadores, setCoordinadores] = useState([]);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'OTRO',
    estado: 'ACTIVA',
    candidatoNombres: '',
    candidatoApellidos: '',
    candidatoPartido: '',
    coordinadorId: ''
  });

  useEffect(() => {
    cargarCampanas();
  }, []);

  const cargarCampanas = async () => {
    setLoading(true);
    const resultado = await campanaService.listar();
    if (resultado.success) {
      const campanasData = resultado.data?.campanas || resultado.data;
      setCampanas(Array.isArray(campanasData) ? campanasData : []);
    } else {
      addToast({ type: 'error', message: resultado.error });
      setCampanas([]);
    }
    setLoading(false);
  };

  const cargarCoordinadores = async () => {
    try {
      const response = await api.get('/usuarios', { params: { rol: 'COORDINADOR' } });
      if (response.data.success) {
        const usuarios = response.data.data?.usuarios || response.data.data;
        setCoordinadores(Array.isArray(usuarios) ? usuarios : []);
      }
    } catch (error) {
      setCoordinadores([]);
    }
  };

  const abrirModal = (campana = null) => {
    if (campana) {
      setEditingCampana(campana);
      setFormData({
        nombre: campana.nombre || '',
        descripcion: campana.descripcion || '',
        tipo: campana.tipo || 'OTRO',
        estado: campana.estado || 'ACTIVA',
        candidatoNombres: campana.candidato?.nombres || '',
        candidatoApellidos: campana.candidato?.apellidos || '',
        candidatoPartido: campana.candidato?.partido || '',
        coordinadorId: ''
      });
    } else {
      setEditingCampana(null);
      setFormData({
        nombre: '',
        descripcion: '',
        tipo: 'OTRO',
        estado: 'ACTIVA',
        candidatoNombres: '',
        candidatoApellidos: '',
        candidatoPartido: '',
        coordinadorId: ''
      });
    }
    cargarCoordinadores();
    setShowModal(true);
    setModalAlert(null);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditingCampana(null);
    setModalAlert(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalAlert(null);

    const datos = {
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      tipo: formData.tipo,
      estado: formData.estado,
      candidato: {
        nombres: formData.candidatoNombres,
        apellidos: formData.candidatoApellidos,
        partido: formData.candidatoPartido
      }
    };

    let resultado;
    if (editingCampana) {
      resultado = await campanaService.actualizar(editingCampana._id, datos);
    } else {
      resultado = await campanaService.crear(datos);
    }

    if (resultado.success) {
      // Si se selecciono coordinador, asignarle la campana
      if (!editingCampana && formData.coordinadorId && resultado.data?._id) {
        try {
          await api.put(`/usuarios/${formData.coordinadorId}`, {
            campana: resultado.data._id
          });
        } catch (err) {
          // No bloquear si falla la asignacion
        }
      }

      cerrarModal();
      cargarCampanas();
      addToast({
        type: 'success',
        message: editingCampana ? 'Campana actualizada exitosamente' : 'Campana creada exitosamente'
      });
    } else {
      setModalAlert({ type: 'error', message: resultado.error });
    }
  };

  const eliminarCampana = async (campana) => {
    if (!confirm(`Estas seguro de eliminar la campana "${campana.nombre}"? Esta accion no se puede deshacer.`)) {
      return;
    }

    const resultado = await campanaService.eliminar(campana._id);
    if (resultado.success) {
      addToast({ type: 'success', message: 'Campana eliminada exitosamente' });
      cargarCampanas();
    } else {
      addToast({ type: 'error', message: resultado.error });
    }
  };

  const getEstadoColor = (estado) => {
    const found = ESTADOS_CAMPANA.find(e => e.value === estado);
    return found?.color || 'bg-gray-100 text-gray-800';
  };

  if (loading && campanas.length === 0) {
    return <Spinner message="Cargando campanas..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-800 to-teal-700 bg-clip-text text-transparent">
            Campanas
          </h1>
          <p className="text-gray-500 mt-1">
            Gestiona las campanas electorales
          </p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="mt-4 sm:mt-0 inline-flex items-center px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-bold text-base shadow-lg shadow-emerald-200"
        >
          <span className="mr-2 text-xl">+</span>
          Nueva Campana
        </button>
      </div>

      {/* Lista */}
      {campanas.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-12 text-center border border-emerald-100">
          <span className="text-6xl mb-4 block">🏛️</span>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No hay campanas
          </h3>
          <p className="text-gray-600 mb-4">
            Crea la primera campana electoral
          </p>
          <button
            onClick={() => abrirModal()}
            className="inline-flex items-center px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-bold shadow-lg shadow-emerald-200"
          >
            <span className="mr-2 text-xl">+</span>
            Crear Campana
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {campanas.map((campana) => (
            <div key={campana._id} className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{campana.nombre}</h3>
                  {campana.descripcion && (
                    <p className="text-sm text-gray-500 mt-1">{campana.descripcion}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(campana.estado)}`}>
                    {campana.estado}
                  </span>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {campana.tipo}
                  </span>
                </div>
              </div>

              {campana.candidato?.nombres && (
                <div className="mb-4 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-100/50">
                  <p className="text-xs text-gray-500 mb-1">Candidato</p>
                  <p className="text-sm font-medium text-gray-900">
                    {campana.candidato.nombres} {campana.candidato.apellidos}
                  </p>
                  {campana.candidato.partido && (
                    <p className="text-xs text-emerald-600">{campana.candidato.partido}</p>
                  )}
                </div>
              )}

              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => abrirModal(campana)}
                  className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminarCampana(campana)}
                  className="px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCampana ? 'Editar Campana' : 'Nueva Campana'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalAlert && (
              <div className={`mb-4 p-4 rounded-lg ${
                modalAlert.type === 'error'
                  ? 'bg-red-100 border border-red-400 text-red-700'
                  : 'bg-green-100 border border-green-400 text-green-700'
              }`}>
                <span className="font-medium">{modalAlert.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    required
                    placeholder="Ej: Campana Alcaldia 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {TIPOS_CAMPANA.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {ESTADOS_CAMPANA.map(e => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datos del candidato */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Candidato</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                    <input
                      type="text"
                      value={formData.candidatoNombres}
                      onChange={(e) => setFormData({...formData, candidatoNombres: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                    <input
                      type="text"
                      value={formData.candidatoApellidos}
                      onChange={(e) => setFormData({...formData, candidatoApellidos: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partido</label>
                    <input
                      type="text"
                      value={formData.candidatoPartido}
                      onChange={(e) => setFormData({...formData, candidatoPartido: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Asignar coordinador (solo al crear) */}
              {!editingCampana && coordinadores.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Asignar Coordinador (opcional)</h3>
                  <select
                    value={formData.coordinadorId}
                    onChange={(e) => setFormData({...formData, coordinadorId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Sin coordinador</option>
                    {coordinadores.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.perfil?.nombres} {c.perfil?.apellidos} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-emerald-50/50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-lg shadow-lg"
                >
                  {editingCampana ? 'Actualizar Campana' : 'Crear Campana'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Campanas;
