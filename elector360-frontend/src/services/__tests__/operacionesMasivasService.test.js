import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import operacionesMasivasService from '../operacionesMasivasService';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

describe('operacionesMasivasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('actualizarTodo', () => {
    it('debe iniciar actualización masiva exitosamente', async () => {
      const mockData = {
        encoladas: 150,
        mensaje: 'Se encolaron 150 consultas'
      };

      api.post.mockResolvedValue({
        data: { success: true, data: mockData }
      });

      const result = await operacionesMasivasService.actualizarTodo();

      expect(api.post).toHaveBeenCalledWith('/operaciones-masivas/actualizar-todo');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('debe manejar error de permisos', async () => {
      api.post.mockRejectedValue({
        response: { data: { error: 'Solo administradores pueden ejecutar esta acción' } }
      });

      const result = await operacionesMasivasService.actualizarTodo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Solo administradores pueden ejecutar esta acción');
    });

    it('debe manejar error de conexión', async () => {
      api.post.mockRejectedValue(new Error('Network Error'));

      const result = await operacionesMasivasService.actualizarTodo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al iniciar actualización masiva');
    });
  });

  describe('consultarDesdeExcel', () => {
    it('debe procesar archivo Excel exitosamente', async () => {
      const mockFile = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResultados = {
        procesadas: 100,
        exitosas: 95,
        errores: 5
      };

      api.post.mockResolvedValue({
        data: { success: true, data: mockResultados }
      });

      const result = await operacionesMasivasService.consultarDesdeExcel(mockFile);

      expect(api.post).toHaveBeenCalledWith(
        '/operaciones-masivas/consultar-excel',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      expect(result.success).toBe(true);
      expect(result.resultados).toEqual(mockResultados);
    });

    it('debe manejar error de formato de archivo', async () => {
      const mockFile = new File([''], 'test.txt', { type: 'text/plain' });

      api.post.mockRejectedValue({
        response: { data: { error: 'Formato de archivo no soportado' } }
      });

      const result = await operacionesMasivasService.consultarDesdeExcel(mockFile);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Formato de archivo no soportado');
    });
  });

  describe('actualizarDesdeExcel', () => {
    it('debe actualizar desde Excel exitosamente', async () => {
      const mockFile = new File([''], 'actualizaciones.xlsx');
      const mockResultados = {
        actualizadas: 80,
        errores: 2
      };

      api.post.mockResolvedValue({
        data: { success: true, data: mockResultados }
      });

      const result = await operacionesMasivasService.actualizarDesdeExcel(mockFile);

      expect(api.post).toHaveBeenCalledWith(
        '/operaciones-masivas/actualizar-excel',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      expect(result.success).toBe(true);
      expect(result.resultados).toEqual(mockResultados);
    });

    it('debe manejar error de procesamiento', async () => {
      const mockFile = new File([''], 'test.xlsx');

      api.post.mockRejectedValue({
        response: { data: { error: 'Error al procesar el archivo' } }
      });

      const result = await operacionesMasivasService.actualizarDesdeExcel(mockFile);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar el archivo');
    });
  });

  describe('generarReporte', () => {
    it('debe generar y descargar reporte exitosamente', async () => {
      const mockBlob = new Blob(['excel data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResultados = { datos: [{ id: 1 }, { id: 2 }] };

      api.post.mockResolvedValue({ data: mockBlob });

      const mockLink = {
        href: '',
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn()
      };
      document.createElement = vi.fn().mockReturnValue(mockLink);
      document.body.appendChild = vi.fn();

      const result = await operacionesMasivasService.generarReporte(mockResultados);

      expect(api.post).toHaveBeenCalledWith(
        '/operaciones-masivas/generar-reporte',
        { resultados: mockResultados },
        { responseType: 'blob' }
      );
      expect(result.success).toBe(true);
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('debe manejar error en generación de reporte', async () => {
      api.post.mockRejectedValue(new Error('Error'));

      const result = await operacionesMasivasService.generarReporte({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al generar reporte');
    });
  });

  describe('obtenerEstado', () => {
    it('debe obtener estado de procesamiento exitosamente', async () => {
      const mockEstado = {
        enProceso: true,
        pendientes: 50,
        completadas: 30,
        errores: 5,
        progreso: 40
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockEstado }
      });

      const result = await operacionesMasivasService.obtenerEstado();

      expect(api.get).toHaveBeenCalledWith('/operaciones-masivas/estado');
      expect(result.success).toBe(true);
      expect(result.estado).toEqual(mockEstado);
    });

    it('debe retornar estado por defecto cuando falla', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Error del servidor' } }
      });

      const result = await operacionesMasivasService.obtenerEstado();

      expect(result.success).toBe(false);
      expect(result.estado).toEqual({
        enProceso: false,
        pendientes: 0,
        completadas: 0,
        errores: 0,
        progreso: 0
      });
    });

    it('debe manejar respuesta sin success', async () => {
      api.get.mockResolvedValue({
        data: { success: false }
      });

      const result = await operacionesMasivasService.obtenerEstado();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al obtener estado');
    });
  });

  describe('limpiarCola', () => {
    it('debe limpiar cola con días por defecto', async () => {
      const mockData = { eliminadas: 25 };

      api.delete.mockResolvedValue({
        data: { success: true, data: mockData }
      });

      const result = await operacionesMasivasService.limpiarCola();

      expect(api.delete).toHaveBeenCalledWith('/operaciones-masivas/limpiar-cola?dias=7');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('debe limpiar cola con días personalizados', async () => {
      api.delete.mockResolvedValue({
        data: { success: true, data: { eliminadas: 50 } }
      });

      await operacionesMasivasService.limpiarCola(30);

      expect(api.delete).toHaveBeenCalledWith('/operaciones-masivas/limpiar-cola?dias=30');
    });

    it('debe manejar error de permisos', async () => {
      api.delete.mockRejectedValue({
        response: { data: { error: 'No autorizado' } }
      });

      const result = await operacionesMasivasService.limpiarCola();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No autorizado');
    });
  });

  describe('descargarPlantilla', () => {
    it('debe descargar plantilla exitosamente', async () => {
      const mockBlob = new Blob(['excel template']);

      api.get.mockResolvedValue({ data: mockBlob });

      const mockLink = {
        href: '',
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn()
      };
      document.createElement = vi.fn().mockReturnValue(mockLink);
      document.body.appendChild = vi.fn();

      const result = await operacionesMasivasService.descargarPlantilla();

      expect(api.get).toHaveBeenCalledWith('/operaciones-masivas/plantilla', { responseType: 'blob' });
      expect(result.success).toBe(true);
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'plantilla-elector360.xlsx');
    });

    it('debe manejar error de descarga', async () => {
      api.get.mockRejectedValue(new Error('Error'));

      const result = await operacionesMasivasService.descargarPlantilla();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al descargar plantilla');
    });
  });

  describe('pollEstado', () => {
    it('debe llamar a obtenerEstado en el polling', async () => {
      // Mock que termina inmediatamente
      api.get.mockResolvedValueOnce({
        data: { success: true, data: { enProceso: false, pendientes: 0, completadas: 80, progreso: 100 } }
      });

      const onUpdate = vi.fn();
      const pollPromise = operacionesMasivasService.pollEstado(onUpdate, 10);

      await vi.advanceTimersByTimeAsync(10000);

      const result = await pollPromise;

      expect(api.get).toHaveBeenCalledWith('/operaciones-masivas/estado');
      expect(result.enProceso).toBe(false);
      expect(result.progreso).toBe(100);
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('debe terminar cuando pendientes llega a 0', async () => {
      api.get.mockResolvedValueOnce({
        data: { success: true, data: { enProceso: true, pendientes: 0, completadas: 80, progreso: 100 } }
      });

      const pollPromise = operacionesMasivasService.pollEstado(null, 10);

      await vi.advanceTimersByTimeAsync(10000);

      const result = await pollPromise;

      expect(result.pendientes).toBe(0);
    });

    it('debe ejecutar callback onUpdate cuando se proporciona', async () => {
      const mockEstado = { enProceso: false, pendientes: 0, completadas: 100, progreso: 100 };
      api.get.mockResolvedValueOnce({
        data: { success: true, data: mockEstado }
      });

      const onUpdate = vi.fn();
      const pollPromise = operacionesMasivasService.pollEstado(onUpdate, 10);

      await vi.advanceTimersByTimeAsync(10000);

      await pollPromise;

      expect(onUpdate).toHaveBeenCalledWith(mockEstado);
    });
  });
});
