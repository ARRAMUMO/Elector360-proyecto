import api from './api';

const e14Service = {
  async guardarResultado(datos) {
    try {
      const res = await api.post('/e14/resultados', datos);
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al guardar resultado' };
    }
  },

  async actualizarResultado(id, datos) {
    try {
      const res = await api.put(`/e14/resultados/${id}`, datos);
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al actualizar resultado' };
    }
  },

  async listarResultados(filtros = {}) {
    try {
      const params = new URLSearchParams();
      if (filtros.municipio) params.append('municipio', filtros.municipio);
      if (filtros.zona) params.append('zona', filtros.zona);
      if (filtros.candidatoNumero) params.append('candidatoNumero', filtros.candidatoNumero);
      const res = await api.get(`/e14/resultados?${params}`);
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al listar resultados' };
    }
  },

  async eliminarResultado(id) {
    try {
      await api.delete(`/e14/resultados/${id}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al eliminar resultado' };
    }
  },

  async limpiarResultados() {
    try {
      const res = await api.delete('/e14/resultados');
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al limpiar resultados' };
    }
  },

  async obtenerAnalisis(filtros = {}) {
    try {
      const params = new URLSearchParams();
      if (filtros.municipio) params.append('municipio', filtros.municipio);
      if (filtros.zona) params.append('zona', filtros.zona);
      if (filtros.candidatoNumero) params.append('candidatoNumero', filtros.candidatoNumero);
      const res = await api.get(`/e14/analisis?${params}`);
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al obtener análisis' };
    }
  },

  async obtenerResumen() {
    try {
      const res = await api.get('/e14/resumen');
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al obtener resumen' };
    }
  },

  async obtenerSeguidoresMesa(resultadoId) {
    try {
      const res = await api.get(`/e14/resultados/${resultadoId}/seguidores`);
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al obtener seguidores' };
    }
  },

  async verificarVotos() {
    try {
      const res = await api.post('/e14/verificar-votos', {}, { timeout: 180000 });
      return { success: true, data: res.data.data };
    } catch (err) {
      const msg = err.response?.data?.error || (err.code === 'ECONNABORTED' ? 'Tiempo de espera agotado' : 'Error al verificar votos');
      return { success: false, error: msg };
    }
  },

  async exportarInforme(liderId = null, tipo = 'personas') {
    try {
      const params = new URLSearchParams();
      if (liderId) params.append('liderId', liderId);
      if (tipo && tipo !== 'personas') params.append('tipo', tipo);
      const qs = params.toString() ? `?${params}` : '';
      const res = await api.get(`/e14/exportar-informe${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const fecha = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `informe-e14-${tipo}-${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al exportar informe' };
    }
  },

  async misPersonas(liderId = null) {
    try {
      const params = liderId ? `?liderId=${liderId}` : '';
      const res = await api.get(`/e14/mis-personas${params}`);
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al obtener personas' };
    }
  },

  async importarExcel(archivo, metadatos) {
    try {
      const form = new FormData();
      form.append('archivo', archivo);
      if (metadatos.candidatoNumero) form.append('candidatoNumero', metadatos.candidatoNumero);
      if (metadatos.candidatoNombre) form.append('candidatoNombre', metadatos.candidatoNombre);
      if (metadatos.partido) form.append('partido', metadatos.partido);
      if (metadatos.fechaEleccion) form.append('fechaEleccion', metadatos.fechaEleccion);
      const res = await api.post('/e14/importar-excel', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000 // 2 minutos para archivos grandes
      });
      return { success: true, data: res.data.data };
    } catch (err) {
      const msg = err.response?.data?.error || (err.code === 'ECONNABORTED' ? 'Tiempo de espera agotado — archivo muy grande' : 'Error al importar Excel');
      return { success: false, error: msg };
    }
  }
};

export default e14Service;
