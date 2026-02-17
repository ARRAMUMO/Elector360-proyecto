// src/services/campanaService.js

import api from './api';

const campanaService = {
  async listar(params = {}) {
    try {
      const response = await api.get('/campanas', { params });
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al listar campanas' };
    }
  },

  async obtenerPorId(id) {
    try {
      const response = await api.get(`/campanas/${id}`);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al obtener campana' };
    }
  },

  async crear(datos) {
    try {
      const response = await api.post('/campanas', datos);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al crear campana' };
    }
  },

  async actualizar(id, datos) {
    try {
      const response = await api.put(`/campanas/${id}`, datos);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al actualizar campana' };
    }
  },

  async eliminar(id) {
    try {
      const response = await api.delete(`/campanas/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al eliminar campana' };
    }
  },

  async obtenerEstadisticas(id) {
    try {
      const response = await api.get(`/campanas/${id}/estadisticas`);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al obtener estadisticas' };
    }
  }
};

export default campanaService;
