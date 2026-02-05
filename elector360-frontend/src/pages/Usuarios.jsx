// src/pages/Usuarios.jsx

import { useState, useEffect } from 'react';
import api from '../services/api';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';

function Usuarios() {
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
    telefono: ''
  });

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const response = await api.get('/usuarios');
      if (response.data.success) {
        // CRITICAL: Asegurarse de que sea un array
        const usuariosData = response.data.data;
        setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      } else {
        setUsuarios([]);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setAlert({ type: 'error', message: 'Error al cargar usuarios' });
      setUsuarios([]);
    }
    setLoading(false);
  };

  const abrirModal = (usuario = null) => {
    if (usuario) {
      setEditingUser(usuario);
      setFormData({
        email: usuario.email,
        password: '',
        rol: usuario.rol,
        nombres: usuario.perfil?.nombres || '',
        apellidos: usuario.perfil?.apellidos || '',
        telefono: usuario.perfil?.telefono || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        rol: 'LIDER',
        nombres: '',
        apellidos: '',
        telefono: ''
      });
    }
    setShowModal(true);
    setAlert(null);
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
      telefono: ''
    });
    setAlert(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        // Actualizar usuario
        const dataToSend = { ...formData };
        if (!dataToSend.password) {
          delete dataToSend.password;
        }

        const response = await api.put(`/usuarios/${editingUser._id}`, dataToSend);
        
        if (response.data.success) {
          setAlert({ type: 'success', message: '✅ Usuario actualizado exitosamente' });
          cerrarModal();
          cargarUsuarios();
        } else {
          setAlert({ type: 'error', message: response.data.error });
        }
      } else {
        // Crear usuario
        const response = await api.post('/usuarios', formData);
        
        if (response.data.success) {
          setAlert({ type: 'success', message: '✅ Usuario creado exitosamente' });
          cerrarModal();
          cargarUsuarios();
        } else {
          setAlert({ type: 'error', message: response.data.error });
        }
      }
    } catch (error) {
      setAlert({ 
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
        setAlert({ 
          type: 'success', 
          message: `✅ Usuario ${nuevoEstado === 'ACTIVO' ? 'activado' : 'desactivado'} exitosamente` 
        });
        cargarUsuarios();
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error al cambiar estado del usuario' });
    }
  };

  const eliminarUsuario = async (usuario) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${usuario.perfil?.nombres}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await api.delete(`/usuarios/${usuario._id}`);
      
      if (response.data.success) {
        setAlert({ type: 'success', message: '✅ Usuario eliminado exitosamente' });
        cargarUsuarios();
      }
    } catch (error) {
      setAlert({ 
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            ⚙️ Usuarios
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona los usuarios del sistema
          </p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <span className="mr-2">➕</span>
          Nuevo Usuario
        </button>
      </div>

      {/* Alertas */}
      {alert && (
        <Alert 
          type={alert.type} 
          message={alert.message} 
          onClose={() => setAlert(null)}
        />
      )}

      {/* Lista de Usuarios */}
      {usuarios.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <span className="text-6xl mb-4 block">👥</span>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No hay usuarios
          </h3>
          <p className="text-gray-600 mb-4">
            Crea el primer usuario del sistema
          </p>
          <button
            onClick={() => abrirModal()}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <span className="mr-2">➕</span>
            Crear Usuario
          </button>
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
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estadísticas
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usuarios.map((usuario) => (
                    <tr key={usuario._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-primary-700 font-bold text-sm">
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
                            className="text-primary-600 hover:text-primary-900"
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
              <div key={usuario._id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center flex-1">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-primary-700 font-bold">
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
                      usuario.rol === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
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

                <div className="flex space-x-2">
                  <button
                    onClick={() => abrirModal(usuario)}
                    className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleEstado(usuario)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                      usuario.estado === 'ACTIVO'
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {usuario.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => eliminarUsuario(usuario)}
                    className="px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="LIDER">Líder</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear'}
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