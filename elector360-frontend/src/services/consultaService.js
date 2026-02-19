// src/services/consultaService.js

import api from './api';

const consultaService = {
  /**
   * Buscar persona por documento (consulta RPA si no existe)
   * @param {string} documento - Número de cédula
   * @returns {Promise}
   */
  async buscarPersona(documento) {
    try {
      const response = await api.post('/consultas/buscar', { documento });

      return {
        success: response.data.success,
        data: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error en la búsqueda'
      };
    }
  },

  /**
   * Obtener estado de una consulta RPA
   * @param {string} consultaId - ID de la consulta
   * @param {number} retryCount - Contador de reintentos interno
   * @returns {Promise}
   */
  async obtenerEstado(consultaId, retryCount = 0) {
    try {
      const response = await api.get(`/consultas/estado/${consultaId}`);

      return {
        success: response.data.success,
        consulta: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      // Si es error 429 (rate limit), reintentar con backoff
      if (error.response?.status === 429 && retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.obtenerEstado(consultaId, retryCount + 1);
      }

      return {
        success: false,
        error: error.response?.status === 429
          ? 'Demasiadas solicitudes. Espera un momento...'
          : error.response?.data?.error || 'Error al obtener estado'
      };
    }
  },

  /**
   * Confirmar persona y agregar a la base de datos
   * @param {string} personaId - ID de la persona
   * @param {Object} datosAdicionales - Datos adicionales (teléfono, email, etc.)
   * @returns {Promise}
   */
  async confirmarPersona(personaId, datosAdicionales = {}) {
    try {
      const response = await api.post(`/consultas/confirmar/${personaId}`, datosAdicionales);

      return {
        success: response.data.success,
        persona: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al confirmar persona'
      };
    }
  },

  /**
   * Reclamar persona (fuerza reasignación aunque tenga otro líder)
   * @param {string} personaId - ID de la persona
   * @param {Object} datosAdicionales - Datos adicionales opcionales
   * @returns {Promise}
   */
  async reclamarPersona(personaId, datosAdicionales = {}) {
    try {
      const response = await api.post(`/consultas/reclamar/${personaId}`, datosAdicionales);

      return {
        success: response.data.success,
        persona: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al reclamar persona'
      };
    }
  },

  /**
   * Registrar persona nueva en esta campaña (cuando no existe aquí pero sí en otra)
   * @param {string} documento - Número de cédula
   * @param {Object} datosAdicionales - Datos del formulario
   * @returns {Promise}
   */
  async registrarNuevaPersona(documento, datosAdicionales = {}) {
    try {
      const response = await api.post('/consultas/registrar-nueva', {
        documento,
        ...datosAdicionales
      });

      return {
        success: response.data.success,
        persona: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al registrar persona en esta campaña'
      };
    }
  },

  /**
   * Crear nueva consulta RPA para obtener datos electorales
   * @param {string} documento - Número de cédula
   * @param {number} prioridad - Prioridad de la consulta (1-5, default: 2)
   * @returns {Promise}
   */
  async crearConsultaRPA(documento, prioridad = 2) {
    try {
      const response = await api.post('/consultas', {
        documento,
        prioridad
      });

      return {
        success: response.data.success,
        consulta: response.data.data,
        error: response.data.success ? null : response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al crear consulta RPA'
      };
    }
  },

  /**
   * Polling automático del estado de una consulta
   * @param {string} consultaId - ID de la consulta
   * @param {Function} onUpdate - Callback que se ejecuta en cada actualización
   * @param {number} maxIntentos - Máximo de intentos (default: 60)
   * @returns {Promise}
   */
  async pollEstado(consultaId, onUpdate = null, maxIntentos = 60) {
    let intentos = 0;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        intentos++;

        try {
          const resultado = await this.obtenerEstado(consultaId);

          if (resultado.success) {
            const consulta = resultado.consulta;

            // Llamar callback de actualización si existe
            if (onUpdate) {
              onUpdate(consulta);
            }

            // Si completó o tuvo error, terminar polling
            if (consulta.estado === 'COMPLETADO' || consulta.estado === 'ERROR') {
              clearInterval(interval);
              resolve(consulta);
            }

            // Si llegó al máximo de intentos
            if (intentos >= maxIntentos) {
              clearInterval(interval);
              reject(new Error('Timeout: La consulta tomó demasiado tiempo'));
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

export default consultaService;