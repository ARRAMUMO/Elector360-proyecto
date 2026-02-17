// src/pages/Usuarios.jsx

import { useState, useEffect } from 'react';
import api from '../services/api';
import authService from '../services/authService';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';
import { useToast } from '../components/common/Toast';

function Usuarios() {
  const { addToast } = useToast();
  const currentUser = authService.getStoredUser();
  const esAdmin = currentUser?.rol === 'ADMIN';
  const esCoordinador = currentUser?.rol === 'COORDINADOR';
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rol: 'LIDER',
    nombres: '',
    apellidos: '',
    telefono: '',
    campana: ''
  });
  const [modalAlert, setModalAlert] = useState(null);
  const [campanas, setCampanas] = useState([]);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const response = await api.get('/usuarios');
      if (response.data.success) {
        // El backend devuelve { data: { usuarios: [], pagination: {} } }
        const usuariosData = response.data.data?.usuarios || response.data.data;
        setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      } else {
        setUsuarios([]);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      addToast({ type: 'error', message: 'Error al cargar usuarios' });
      setUsuarios([]);
    }
    setLoading(false);
  };

  const cargarCampanas = async () => {
    try {
      const response = await api.get('/campanas');
      if (response.data.success) {
        const data = response.data.data?.campanas || response.data.data;
        setCampanas(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      setCampanas([]);
    }
  };

  const abrirModal = (usuario = null) => {
    if (esAdmin) cargarCampanas();
    if (usuario) {
      setEditingUser(usuario);
      setFormData({
        email: usuario.email,
        password: '',
        rol: usuario.rol,
        nombres: usuario.perfil?.nombres || '',
        apellidos: usuario.perfil?.apellidos || '',
        telefono: usuario.perfil?.telefono || '',
        campana: usuario.campana?._id || usuario.campana || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        rol: 'LIDER',
        nombres: '',
        apellidos: '',
        telefono: '',
        campana: ''
      });
    }
    setShowModal(true);
    setAlert(null);
    setModalAlert(null);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      rol: 'LIDER',
      nombres: '',
      apellidos: '',
      telefono: '',
      campana: ''
    });
    setAlert(null);
    setModalAlert(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setModalAlert(null);

    // Formatear datos para el backend
    const dataToSend = {
      email: formData.email,
      rol: formData.rol,
      perfil: {
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        telefono: formData.telefono || undefined
      }
    };

    // Incluir campaña si se seleccionó (ADMIN asignando campaña)
    if (esAdmin && formData.campana) {
      dataToSend.campana = formData.campana;
    }

    // Solo incluir password si tiene valor
    if (formData.password) {
      dataToSend.password = formData.password;
    }

    try {
      if (editingUser) {
        // Actualizar usuario
        const response = await api.put(`/usuarios/${editingUser._id}`, dataToSend);

        if (response.data.success) {
          const campanaAsignada = formData.campana ? campanas.find(c => c._id === formData.campana) : null;
          const msgCampana = campanaAsignada ? ` | Campaña: ${campanaAsignada.nombre}` : '';
          cerrarModal();
          cargarUsuarios();
          addToast({ type: 'success', message: `Usuario actualizado exitosamente${msgCampana}` });
        } else {
          setModalAlert({ type: 'error', message: response.data.error });
        }
      } else {
        // Crear usuario - password es requerido
        if (!formData.password) {
          setModalAlert({ type: 'error', message: 'La contraseña es requerida' });
          setLoading(false);
          return;
        }

        const response = await api.post('/usuarios', dataToSend);

        if (response.data.success) {
          const campanaAsignada = formData.campana ? campanas.find(c => c._id === formData.campana) : null;
          const msgCampana = campanaAsignada ? ` | Campaña: ${campanaAsignada.nombre}` : '';
          cerrarModal();
          cargarUsuarios();
          addToast({ type: 'success', message: `Usuario creado exitosamente${msgCampana}` });
        } else {
          setModalAlert({ type: 'error', message: response.data.error });
        }
      }
    } catch (error) {
      setModalAlert({
        type: 'error',
        message: error.response?.data?.error || 'Error al guardar usuario'
      });
    }
    setLoading(false);
  };

  const toggleEstado = async (usuario) => {
    if (!confirm(`¿Estás seguro de ${usuario.estado === 'ACTIVO' ? 'desactivar' : 'activar'} este usuario?`)) {
      return;
    }

    try {
      const nuevoEstado = usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      const response = await api.put(`/usuarios/${usuario._id}`, { estado: nuevoEstado });
      
      if (response.data.success) {
        addToast({
          type: 'success',
          message: `Usuario ${nuevoEstado === 'ACTIVO' ? 'activado' : 'desactivado'} exitosamente`
        });
        cargarUsuarios();
      }
    } catch (error) {
      addToast({ type: 'error', message: 'Error al cambiar estado del usuario' });
    }
  };

  const eliminarUsuario = async (usuario) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${usuario.perfil?.nombres}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await api.delete(`/usuarios/${usuario._id}`);
      
      if (response.data.success) {
        addToast({ type: 'success', message: 'Usuario eliminado exitosamente' });
        cargarUsuarios();
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: error.response?.data?.error || 'Error al eliminar usuario'
      });
    }
  };

  if (loading && usuarios.length === 0) {
    return <Spinner message="Cargando usuarios..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-800 to-teal-700 bg-clip-text text-transparent">
            Usuarios
          </h1>
          <p className="text-gray-500 mt-1">
            Gestiona los usuarios del sistema
          </p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          <span className="mr-2">➕</span>
          Nuevo Usuario
        </button>
      </div>

      {/* Lista de Usuarios */}
      {usuarios.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-12 text-center border border-emerald-100">
          <span className="text-6xl mb-4 block">👥</span>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No hay usuarios
          </h3>
          <p className="text-gray-600 mb-4">
            Crea el primer usuario del sistema
          </p>
          <button
            onClick={() => abrirModal()}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            <span className="mr-2">➕</span>
            Crear Usuario
          </button>
        </div>
      ) : (
        <>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-emerald-50 to-teal-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Estado
                    </th>
                    {esAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                        Campana
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Estadísticas
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usuarios.map((usuario) => (
                    <tr key={usuario._id} className="hover:bg-emerald-50/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-emerald-700 font-bold text-sm">
                              {usuario.perfil?.nombres?.charAt(0) || 'U'}
                              {usuario.perfil?.apellidos?.charAt(0) || 'S'}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {usuario.perfil?.nombres || 'Sin nombre'} {usuario.perfil?.apellidos || ''}
                            </div>
                            {usuario.perfil?.telefono && (
                              <div className="text-sm text-gray-500">{usuario.perfil.telefono}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {usuario.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          usuario.rol === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : usuario.rol === 'COORDINADOR'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {usuario.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          usuario.estado === 'ACTIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {usuario.estado}
                        </span>
                      </td>
                      {esAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {usuario.campana?.nombre || '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="text-xs">
                          <div>Personas: {usuario.stats?.personasRegistradas || 0}</div>
                          <div>Consultas: {usuario.stats?.consultasRealizadas || 0}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => abrirModal(usuario)}
                            className="text-emerald-600 hover:text-emerald-900"
                            title="Editar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleEstado(usuario)}
                            className={usuario.estado === 'ACTIVO' ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}
                            title={usuario.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => eliminarUsuario(usuario)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Mobile - Cards */}
          <div className="lg:hidden space-y-4">
            {usuarios.map((usuario) => (
              <div key={usuario._id} className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-emerald-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center flex-1">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-emerald-700 font-bold">
                        {usuario.perfil?.nombres?.charAt(0) || 'U'}
                        {usuario.perfil?.apellidos?.charAt(0) || 'S'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {usuario.perfil?.nombres || 'Sin nombre'} {usuario.perfil?.apellidos || ''}
                      </h3>
                      <p className="text-sm text-gray-600">{usuario.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      usuario.rol === 'ADMIN' ? 'bg-purple-100 text-purple-800' : usuario.rol === 'COORDINADOR' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {usuario.rol}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      usuario.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {usuario.estado}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  {usuario.perfil?.telefono && (
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">📱</span>
                      {usuario.perfil.telefono}
                    </div>
                  )}
                  <div className="flex items-center text-gray-600">
                    <span className="mr-2">👥</span>
                    Personas: {usuario.stats?.personasRegistradas || 0}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="mr-2">🔍</span>
                    Consultas: {usuario.stats?.consultasRealizadas || 0}
                  </div>
                </div>

                <div className="flex space-x-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => abrirModal(usuario)}
                    className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleEstado(usuario)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      usuario.estado === 'ACTIVO'
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {usuario.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => eliminarUsuario(usuario)}
                    className="px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Crear/Editar Usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
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

            {/* Alerta dentro del modal */}
            {modalAlert && (
              <div className={`mb-4 p-4 rounded-lg ${
                modalAlert.type === 'error'
                  ? 'bg-red-100 border border-red-400 text-red-700'
                  : 'bg-green-100 border border-green-400 text-green-700'
              }`}>
                <div className="flex items-center">
                  <span className="text-xl mr-2">{modalAlert.type === 'error' ? '❌' : '✅'}</span>
                  <span className="font-medium">{modalAlert.message}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña {editingUser ? '' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required={!editingUser}
                    minLength="6"
                    placeholder={editingUser ? 'Dejar en blanco para no cambiar' : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol *
                  </label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({...formData, rol: e.target.value})}
                    required
                    disabled={esCoordinador}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="LIDER">Lider</option>
                    {esAdmin && <option value="COORDINADOR">Coordinador</option>}
                    {esAdmin && <option value="ADMIN">Admin</option>}
                  </select>
                </div>

                {/* Selector de campaña (solo ADMIN, visible para COORDINADOR y LIDER) */}
                {esAdmin && formData.rol !== 'ADMIN' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campana {formData.rol === 'COORDINADOR' ? '*' : ''}
                    </label>
                    <select
                      value={formData.campana}
                      onChange={(e) => setFormData({...formData, campana: e.target.value})}
                      required={formData.rol === 'COORDINADOR'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Seleccionar campana...</option>
                      {campanas.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.nombre} ({c.tipo})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombres *
                  </label>
                  <input
                    type="text"
                    value={formData.nombres}
                    onChange={(e) => setFormData({...formData, nombres: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    value={formData.apellidos}
                    onChange={(e) => setFormData({...formData, apellidos: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

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
                  disabled={loading}
                  className="w-full sm:flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-bold text-lg shadow-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </span>
                  ) : editingUser ? '💾 Actualizar Usuario' : '✅ Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;