// src/services/operacionesMasivasService.js

import api from './api';

const operacionesMasivasService = {
  /**
   * Actualizar todas las personas (encolar para RPA)
   * @returns {Promise}
   */
  async actualizarTodo() {
    try {
      const response = await api.post('/masivas/actualizar-todo');

      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar actualización masiva'
      };
    }
  },

  /**
   * Consultar desde archivo Excel
   * @param {File} file - Archivo Excel
   * @returns {Promise}
   */
  async consultarDesdeExcel(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/masivas/consultar-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        success: response.data.success,
        resultados: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al procesar archivo Excel'
      };
    }
  },

  /**
   * Actualizar desde archivo Excel
   * @param {File} file - Archivo Excel con actualizaciones
   * @returns {Promise}
   */
  async actualizarDesdeExcel(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/masivas/actualizar-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        success: response.data.success,
        resultados: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al procesar actualizaciones'
      };
    }
  },

  /**
   * Generar reporte Excel de resultados
   * @param {Object} resultados - Resultados a incluir en el reporte
   * @returns {Promise}
   */
  async generarReporte(resultados) {
    try {
      const response = await api.post('/masivas/generar-reporte', 
        { resultados },
        { responseType: 'blob' }
      );

      // Crear link de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Error al generar reporte'
      };
    }
  },

  /**
   * Obtener estado del procesamiento masivo
   * @returns {Promise}
   */
  async obtenerEstado() {
    try {
      const response = await api.get('/masivas/estado');

      if (response.data.success) {
        return {
          success: true,
          estado: response.data.data
        };
      }

      return {
        success: false,
        error: 'Error al obtener estado'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        estado: {
          enProceso: false,
          pendientes: 0,
          completadas: 0,
          errores: 0,
          progreso: 0
        }
      };
    }
  },

  /**
   * Limpiar cola de consultas antiguas
   * @param {number} dias - Días de antigüedad (default: 7)
   * @returns {Promise}
   */
  async limpiarCola(dias = 7) {
    try {
      const response = await api.delete(`/masivas/limpiar-cola?dias=${dias}`);

      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al limpiar cola'
      };
    }
  },

  /**
   * Obtener resultados completados con datos de votación
   * @returns {Promise}
   */
  async obtenerResultados() {
    try {
      const response = await api.get('/masivas/resultados');

      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al obtener resultados'
      };
    }
  },

  /**
   * Descargar reporte Excel con datos de votación
   * @returns {Promise}
   */
  async descargarReporteResultados() {
    try {
      const response = await api.get('/masivas/reporte-resultados', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte-resultados-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Error al descargar reporte de resultados'
      };
    }
  },

  /**
   * Reintentar una consulta específica con error
   * @param {string} id - ID de la consulta
   * @returns {Promise}
   */
  async reintentarConsulta(id) {
    try {
      const response = await api.put(`/masivas/errores/${id}/reintentar`);
      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al reintentar consulta'
      };
    }
  },

  /**
   * Eliminar una consulta específica con error
   * @param {string} id - ID de la consulta
   * @returns {Promise}
   */
  async eliminarConsulta(id) {
    try {
      const response = await api.delete(`/masivas/errores/${id}`);
      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al eliminar consulta'
      };
    }
  },

  /**
   * Reintentar todas las consultas con error
   * @returns {Promise}
   */
  async reintentarTodosErrores() {
    try {
      const response = await api.put('/masivas/errores/reintentar-todos');
      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al reintentar consultas'
      };
    }
  },

  /**
   * Eliminar todas las consultas con error
   * @returns {Promise}
   */
  async eliminarTodosErrores() {
    try {
      const response = await api.delete('/masivas/errores/todos');
      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al eliminar errores'
      };
    }
  },

  /**
   * Descargar plantilla Excel
   * @returns {Promise}
   */
  async descargarPlantilla() {
    try {
      const response = await api.get('/masivas/plantilla', {
        responseType: 'blob'
      });

      // Crear link de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla-elector360.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Error al descargar plantilla'
      };
    }
  },

  /**
   * Polling del estado de operaciones masivas
   * @param {Function} onUpdate - Callback de actualización
   * @param {number} maxIntentos - Máximo de intentos (default: 180)
   * @returns {Promise}
   */
  async pollEstado(onUpdate = null, maxIntentos = 180) {
    let intentos = 0;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        intentos++;

        try {
          const resultado = await this.obtenerEstado();

          if (resultado.success) {
            const estado = resultado.estado;

            if (onUpdate) {
              onUpdate(estado);
            }

            // Si ya no está en proceso, terminar
            if (!estado.enProceso || estado.pendientes === 0) {
              clearInterval(interval);
              resolve(estado);
            }

            // Timeout
            if (intentos >= maxIntentos) {
              clearInterval(interval);
              reject(new Error('Timeout: Proceso masivo tomó demasiado tiempo'));
            }
          } else {
            clearInterval(interval);
            reject(new Error(resultado.error));
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, 3000); // Cada 3 segundos
    });
  }
};

export default operacionesMasivasService;