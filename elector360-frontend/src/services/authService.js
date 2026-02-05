// src/services/authService.js

import api from './api';

const authService = {
  /**
   * Login - Iniciar sesión
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });

      if (response.data.success) {
        const { accessToken, refreshToken, user } = response.data.data;

        // Guardar en localStorage
        localStorage.setItem('token', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        return {
          success: true,
          user
        };
      }

      return {
        success: false,
        error: response.data.error || 'Error al iniciar sesión'
      };
    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión'
      };
    }
  },

  /**
   * Logout - Cerrar sesión
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      // Limpiar localStorage siempre
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  /**
   * Obtener usuario actual
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');

      if (response.data.success) {
        const user = response.data.data;
        localStorage.setItem('user', JSON.stringify(user));
        
        return {
          success: true,
          user
        };
      }

      return {
        success: false,
        error: 'No se pudo obtener el usuario'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión'
      };
    }
  },

  /**
   * Cambiar contraseña
   * @param {string} currentPassword 
   * @param {string} newPassword 
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });

      return {
        success: response.data.success,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al cambiar contraseña'
      };
    }
  },

  /**
   * Verificar si el usuario está autenticado
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = localStorage.getItem('token');
    return !!token;
  },

  /**
   * Obtener usuario guardado en localStorage
   * @returns {object|null}
   */
  getStoredUser() {
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }
};

export default authService;