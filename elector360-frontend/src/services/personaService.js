// src/services/personaService.js

import api from './api';

const personaService = {
  /**
   * Listar personas con filtros y paginación
   * @param {Object} filtros - { page, limit, search, estadoContacto, departamento }
   * @returns {Promise}
   */
  async listar(filtros = {}) {
    try {
      const params = new URLSearchParams();

      if (filtros.page) params.append('page', filtros.page);
      if (filtros.limit) params.append('limit', filtros.limit);
      if (filtros.search) params.append('search', filtros.search);
      if (filtros.estadoContacto) params.append('estadoContacto', filtros.estadoContacto);
      if (filtros.departamento) params.append('departamento', filtros.departamento);
      if (filtros.municipio) params.append('municipio', filtros.municipio);
      if (filtros.mesa) params.append('mesa', filtros.mesa);
      if (filtros.nombrePuesto) params.append('nombrePuesto', filtros.nombrePuesto);
      if (filtros.zona) params.append('zona', filtros.zona);

      const response = await api.get(`/personas?${params.toString()}`);

      if (response.data.success) {
        return {
          success: true,
          personas: response.data.data.personas,
          pagination: response.data.data.pagination
        };
      }

      return {
        success: false,
        error: 'Error al cargar personas'
      };
    } catch (error) {
      console.error('Error en listar personas:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        personas: [],
        pagination: { total: 0, pages: 0, page: 1, limit: 20 }
      };
    }
  },

  /**
   * Obtener persona por ID
   * @param {string} id - ID de la persona
   * @returns {Promise}
   */
  async obtenerPorId(id) {
    try {
      const response = await api.get(`/personas/${id}`);

      if (response.data.success) {
        return {
          success: true,
          persona: response.data.data
        };
      }

      return {
        success: false,
        error: 'Persona no encontrada'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al obtener persona'
      };
    }
  },

  /**
   * Buscar persona por documento
   * @param {string} documento - Número de cédula
   * @returns {Promise}
   */
  async buscarPorDocumento(documento) {
    try {
      const response = await api.get(`/personas/documento/${documento}`);

      if (response.data.success) {
        return {
          success: true,
          persona: response.data.data
        };
      }

      return {
        success: false,
        error: 'Persona no encontrada'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Persona no encontrada'
      };
    }
  },

  /**
   * Crear nueva persona
   * @param {Object} datosPersona - Datos de la persona
   * @returns {Promise}
   */
  async crear(datosPersona) {
    try {
      const response = await api.post('/personas', datosPersona);

      return {
        success: response.data.success,
        persona: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al crear persona'
      };
    }
  },

  /**
   * Actualizar persona
   * @param {string} id - ID de la persona
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise}
   */
  async actualizar(id, datos) {
    try {
      const response = await api.put(`/personas/${id}`, datos);

      return {
        success: response.data.success,
        persona: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al actualizar persona'
      };
    }
  },

  /**
   * Eliminar persona (solo Admin)
   * @param {string} id - ID de la persona
   * @returns {Promise}
   */
  async eliminar(id) {
    try {
      const response = await api.delete(`/personas/${id}`);

      return {
        success: response.data.success,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al eliminar persona'
      };
    }
  },

  /**
   * Exportar personas a CSV
   * @returns {Promise}
   */
  async exportarCSV() {
    try {
      const response = await api.get('/personas/export/csv', {
        responseType: 'blob'
      });

      // Crear link de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `personas-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Error al exportar CSV'
      };
    }
  },

  /**
   * Obtener mesas de votación con estadísticas
   * @param {Object} filtros - { departamento, municipio, nombrePuesto }
   * @returns {Promise}
   */
  async obtenerMesas(filtros = {}) {
    try {
      const params = new URLSearchParams();

      if (filtros.departamento) params.append('departamento', filtros.departamento);
      if (filtros.municipio) params.append('municipio', filtros.municipio);
      if (filtros.nombrePuesto) params.append('nombrePuesto', filtros.nombrePuesto);

      const response = await api.get(`/personas/mesas?${params.toString()}`);

      if (response.data.success) {
        return {
          success: true,
          mesas: response.data.data,
          total: response.data.total
        };
      }

      return {
        success: false,
        error: 'Error al cargar mesas de votación'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        mesas: []
      };
    }
  },

  /**
   * Obtener personas de una mesa específica
   * @param {Object} datosMesa - { departamento, municipio, nombrePuesto, mesa }
   * @returns {Promise}
   */
  async obtenerPersonasPorMesa(datosMesa) {
    try {
      const params = new URLSearchParams();

      if (datosMesa.departamento) params.append('departamento', datosMesa.departamento);
      if (datosMesa.municipio) params.append('municipio', datosMesa.municipio);
      if (datosMesa.nombrePuesto) params.append('nombrePuesto', datosMesa.nombrePuesto);
      if (datosMesa.mesa) params.append('mesa', datosMesa.mesa);

      const response = await api.get(`/personas/mesas/detalle?${params.toString()}`);

      if (response.data.success) {
        return {
          success: true,
          personas: response.data.data,
          total: response.data.total
        };
      }

      return {
        success: false,
        error: 'Error al cargar personas de la mesa'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        personas: []
      };
    }
  }
};

export default personaService;