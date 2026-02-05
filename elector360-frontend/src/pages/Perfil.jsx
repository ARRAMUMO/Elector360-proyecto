// src/pages/Perfil.jsx

import { useState, useEffect } from 'react';
import authService from '../services/authService';
import Alert from '../components/common/Alert';

function Perfil() {
  const [user, setUser] = useState(authService.getStoredUser());
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    cargarPerfil();
  }, []);

  const cargarPerfil = async () => {
    const resultado = await authService.getCurrentUser();
    if (resultado.success) {
      setUser(resultado.user);
      localStorage.setItem('user', JSON.stringify(resultado.user));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setAlert({ type: 'error', message: 'Las contraseñas no coinciden' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setAlert({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    setLoading(true);

    const resultado = await authService.changePassword(
      passwordData.currentPassword,
      passwordData.newPassword
    );

    if (resultado.success) {
      setAlert({ type: 'success', message: '✅ Contraseña cambiada exitosamente' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordModal(false);
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }

    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          👤 Mi Perfil
        </h1>
        <p className="text-gray-600 mt-1">
          Gestiona tu información personal
        </p>
      </div>

      {/* Alertas */}
      {alert && (
        <Alert 
          type={alert.type} 
          message={alert.message} 
          onClose={() => setAlert(null)}
        />
      )}

      {/* Información Personal */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 mb-6">
          <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-bold text-3xl">
              {user?.perfil?.nombres?.charAt(0) || 'U'}{user?.perfil?.apellidos?.charAt(0) || 'S'}
            </span>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900">
              {user?.perfil?.nombres || 'Usuario'} {user?.perfil?.apellidos || ''}
            </h2>
            <p className="text-gray-600">{user?.email || 'N/A'}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user?.rol === 'ADMIN' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {user?.rol || 'USUARIO'}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {user?.estado || 'ACTIVO'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
            <p className="text-base text-gray-900">{user?.email || 'N/A'}</p>
          </div>

          {user?.perfil?.telefono && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Teléfono</h3>
              <p className="text-base text-gray-900">{user.perfil.telefono}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Fecha de registro</h3>
            <p className="text-base text-gray-900">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-CO') : 'N/A'}
            </p>
          </div>

          {user?.ultimoLogin && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Último acceso</h3>
              <p className="text-base text-gray-900">
                {new Date(user.ultimoLogin).toLocaleString('es-CO')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📊 Mis Estadísticas
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-700">Personas Registradas</p>
            <p className="text-2xl font-bold text-blue-900">
              {user?.stats?.personasRegistradas || 0}
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-sm text-green-700">Consultas Realizadas</p>
            <p className="text-2xl font-bold text-green-900">
              {user?.stats?.consultasRealizadas || 0}
            </p>
          </div>

          {user?.stats?.ultimaConsulta && (
            <div className="bg-purple-50 rounded-lg p-4 text-center sm:col-span-1 col-span-2">
              <p className="text-sm text-purple-700">Última Consulta</p>
              <p className="text-base font-bold text-purple-900">
                {new Date(user.stats.ultimaConsulta).toLocaleDateString('es-CO')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Seguridad */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          🔐 Seguridad
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <h3 className="font-medium text-gray-900">Contraseña</h3>
              <p className="text-sm text-gray-500">Cambiar tu contraseña</p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              Cambiar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Cambiar Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Cambiar Contraseña
              </h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setAlert(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  required
                  minLength="6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  required
                  minLength="6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setAlert(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Perfil;