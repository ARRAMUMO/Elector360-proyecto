// src/services/dashboardService.js

import api from './api';

const dashboardService = {
  /**
   * Obtener estadísticas generales del dashboard
   * @returns {Promise}
   */
  async obtenerEstadisticas() {
    try {
      const response = await api.get('/estadisticas');

      if (response.data.success) {
        return {
          success: true,
          estadisticas: response.data.data
        };
      }

      return {
        success: false,
        error: 'Error al cargar estadísticas'
      };
    } catch (error) {
      console.error('Error en estadísticas:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        estadisticas: {
          totalPersonas: 0,
          personasActualizadas: 0,
          porcentajeActualizadas: 0,
          personasPendientes: 0,
          consultasHoy: 0,
          statsRPA: {
            enCola: 0,
            procesadasHoy: 0,
            erroresHoy: 0,
            costoHoy: 0
          }
        }
      };
    }
  },

  /**
   * Obtener historial de consultas
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Promise}
   */
  async obtenerHistorial(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.page) params.append('page', filtros.page);
      if (filtros.limit) params.append('limit', filtros.limit);
      if (filtros.estado) params.append('estado', filtros.estado);

      const response = await api.get(`/estadisticas/historial?${params.toString()}`);

      if (response.data.success) {
        return {
          success: true,
          historial: response.data.data.consultas,
          pagination: response.data.data.pagination
        };
      }

      return {
        success: false,
        error: 'Error al cargar historial'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al cargar historial',
        historial: [],
        pagination: { total: 0, pages: 0, page: 1, limit: 20 }
      };
    }
  },

  /**
   * Obtener estadísticas por departamento (solo Admin)
   * @returns {Promise}
   */
  async obtenerPorDepartamento() {
    try {
      const response = await api.get('/estadisticas/departamentos');

      if (response.data.success) {
        return {
          success: true,
          departamentos: response.data.data
        };
      }

      return {
        success: false,
        error: 'Error al cargar estadísticas por departamento'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        departamentos: []
      };
    }
  }
};

export default dashboardService;