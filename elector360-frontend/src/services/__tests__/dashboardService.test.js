import { describe, it, expect, vi, beforeEach } from 'vitest';
import dashboardService from '../dashboardService';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('dashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('obtenerEstadisticas', () => {
    it('debe obtener estadísticas generales exitosamente', async () => {
      const mockEstadisticas = {
        totalPersonas: 150,
        personasActualizadas: 120,
        porcentajeActualizadas: 80,
        personasPendientes: 30,
        consultasHoy: 25,
        statsRPA: {
          enCola: 5,
          procesadasHoy: 20,
          erroresHoy: 2,
          costoHoy: 0.50
        }
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockEstadisticas }
      });

      const result = await dashboardService.obtenerEstadisticas();

      expect(api.get).toHaveBeenCalledWith('/estadisticas');
      expect(result.success).toBe(true);
      expect(result.estadisticas).toEqual(mockEstadisticas);
    });

    it('debe retornar valores por defecto cuando falla la API', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Error del servidor' } }
      });

      const result = await dashboardService.obtenerEstadisticas();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error del servidor');
      expect(result.estadisticas).toEqual({
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
      });
    });

    it('debe manejar respuesta sin success', async () => {
      api.get.mockResolvedValue({
        data: { success: false }
      });

      const result = await dashboardService.obtenerEstadisticas();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al cargar estadísticas');
    });

    it('debe manejar error de conexión', async () => {
      api.get.mockRejectedValue(new Error('Network Error'));

      const result = await dashboardService.obtenerEstadisticas();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error de conexión');
    });
  });

  describe('obtenerHistorial', () => {
    it('debe obtener historial de consultas exitosamente', async () => {
      const mockHistorial = [
        { _id: '1', documento: '123456789', estado: 'COMPLETADO', createdAt: '2024-01-15' },
        { _id: '2', documento: '987654321', estado: 'EN_COLA', createdAt: '2024-01-15' }
      ];
      const mockPagination = { total: 50, pages: 3, page: 1, limit: 20 };

      api.get.mockResolvedValue({
        data: {
          success: true,
          data: { consultas: mockHistorial, pagination: mockPagination }
        }
      });

      const result = await dashboardService.obtenerHistorial();

      expect(api.get).toHaveBeenCalledWith('/estadisticas/historial?');
      expect(result.success).toBe(true);
      expect(result.historial).toEqual(mockHistorial);
      expect(result.pagination).toEqual(mockPagination);
    });

    it('debe aplicar filtros correctamente', async () => {
      api.get.mockResolvedValue({
        data: {
          success: true,
          data: { consultas: [], pagination: { total: 0, pages: 0, page: 1, limit: 20 } }
        }
      });

      await dashboardService.obtenerHistorial({
        page: 2,
        limit: 10,
        estado: 'COMPLETADO'
      });

      expect(api.get).toHaveBeenCalledWith('/estadisticas/historial?page=2&limit=10&estado=COMPLETADO');
    });

    it('debe retornar valores por defecto cuando falla', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Error del servidor' } }
      });

      const result = await dashboardService.obtenerHistorial();

      expect(result.success).toBe(false);
      expect(result.historial).toEqual([]);
      expect(result.pagination).toEqual({ total: 0, pages: 0, page: 1, limit: 20 });
    });

    it('debe manejar respuesta sin success', async () => {
      api.get.mockResolvedValue({
        data: { success: false }
      });

      const result = await dashboardService.obtenerHistorial();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al cargar historial');
    });
  });

  describe('obtenerPorDepartamento', () => {
    it('debe obtener estadísticas por departamento exitosamente', async () => {
      const mockDepartamentos = [
        { departamento: 'ATLANTICO', total: 50, actualizadas: 40 },
        { departamento: 'BOLIVAR', total: 30, actualizadas: 25 },
        { departamento: 'MAGDALENA', total: 20, actualizadas: 15 }
      ];

      api.get.mockResolvedValue({
        data: { success: true, data: mockDepartamentos }
      });

      const result = await dashboardService.obtenerPorDepartamento();

      expect(api.get).toHaveBeenCalledWith('/estadisticas/departamentos');
      expect(result.success).toBe(true);
      expect(result.departamentos).toEqual(mockDepartamentos);
    });

    it('debe retornar array vacío cuando falla', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'No autorizado' } }
      });

      const result = await dashboardService.obtenerPorDepartamento();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No autorizado');
      expect(result.departamentos).toEqual([]);
    });

    it('debe manejar respuesta sin success', async () => {
      api.get.mockResolvedValue({
        data: { success: false }
      });

      const result = await dashboardService.obtenerPorDepartamento();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al cargar estadísticas por departamento');
    });

    it('debe manejar error de conexión', async () => {
      api.get.mockRejectedValue(new Error('Network Error'));

      const result = await dashboardService.obtenerPorDepartamento();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error de conexión');
      expect(result.departamentos).toEqual([]);
    });
  });
});
