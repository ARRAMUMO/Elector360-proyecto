import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import consultaService from '../consultaService';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('consultaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buscarPersona', () => {
    it('debe buscar persona por documento exitosamente', async () => {
      const mockData = {
        consultaId: 'consulta-123',
        estado: 'EN_COLA',
        mensaje: 'Consulta encolada'
      };

      api.post.mockResolvedValue({
        data: { success: true, data: mockData }
      });

      const result = await consultaService.buscarPersona('1083432108');

      expect(api.post).toHaveBeenCalledWith('/consultas/buscar', { documento: '1083432108' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('debe retornar persona existente si ya está en BD', async () => {
      const mockPersona = {
        _id: 'persona-123',
        documento: '1083432108',
        nombres: 'Juan',
        apellidos: 'Pérez',
        datosElectorales: {
          departamento: 'ATLANTICO',
          municipio: 'POLONUEVO'
        }
      };

      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { existe: true, persona: mockPersona }
        }
      });

      const result = await consultaService.buscarPersona('1083432108');

      expect(result.success).toBe(true);
      expect(result.data.existe).toBe(true);
      expect(result.data.persona).toEqual(mockPersona);
    });

    it('debe manejar error de documento inválido', async () => {
      api.post.mockRejectedValue({
        response: { data: { error: 'Documento inválido' } }
      });

      const result = await consultaService.buscarPersona('123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Documento inválido');
    });

    it('debe manejar error de conexión', async () => {
      api.post.mockRejectedValue(new Error('Network Error'));

      const result = await consultaService.buscarPersona('1083432108');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error en la búsqueda');
    });
  });

  describe('obtenerEstado', () => {
    it('debe obtener estado de consulta EN_COLA', async () => {
      const mockConsulta = {
        _id: 'consulta-123',
        documento: '1083432108',
        estado: 'EN_COLA',
        prioridad: 2
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockConsulta }
      });

      const result = await consultaService.obtenerEstado('consulta-123');

      expect(api.get).toHaveBeenCalledWith('/consultas/estado/consulta-123');
      expect(result.success).toBe(true);
      expect(result.consulta).toEqual(mockConsulta);
    });

    it('debe obtener estado de consulta PROCESANDO', async () => {
      const mockConsulta = {
        _id: 'consulta-123',
        documento: '1083432108',
        estado: 'PROCESANDO',
        intentos: 1
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockConsulta }
      });

      const result = await consultaService.obtenerEstado('consulta-123');

      expect(result.consulta.estado).toBe('PROCESANDO');
    });

    it('debe obtener estado de consulta COMPLETADO con datos electorales', async () => {
      const mockConsulta = {
        _id: 'consulta-123',
        documento: '1083432108',
        estado: 'COMPLETADO',
        datosPersona: {
          departamento: 'ATLANTICO',
          municipio: 'POLONUEVO',
          puestoVotacion: 'IE MARIA EMMA',
          direccion: 'CRA 12 No 6-61',
          mesa: '13'
        }
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockConsulta }
      });

      const result = await consultaService.obtenerEstado('consulta-123');

      expect(result.consulta.estado).toBe('COMPLETADO');
      expect(result.consulta.datosPersona.departamento).toBe('ATLANTICO');
    });

    it('debe obtener estado de consulta ERROR', async () => {
      const mockConsulta = {
        _id: 'consulta-123',
        documento: '1083432108',
        estado: 'ERROR',
        error: 'No se encontró información electoral'
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockConsulta }
      });

      const result = await consultaService.obtenerEstado('consulta-123');

      expect(result.consulta.estado).toBe('ERROR');
      expect(result.consulta.error).toBe('No se encontró información electoral');
    });

    it('debe manejar error de consulta no encontrada', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Consulta no encontrada' } }
      });

      const result = await consultaService.obtenerEstado('consulta-999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Consulta no encontrada');
    });
  });

  describe('confirmarPersona', () => {
    it('debe confirmar persona exitosamente', async () => {
      const mockPersona = {
        _id: 'persona-123',
        documento: '1083432108',
        nombres: 'Juan',
        apellidos: 'Pérez',
        telefono: '3001234567'
      };

      api.post.mockResolvedValue({
        data: { success: true, data: mockPersona }
      });

      const result = await consultaService.confirmarPersona('persona-123', {
        telefono: '3001234567',
        email: 'juan@email.com'
      });

      expect(api.post).toHaveBeenCalledWith('/consultas/confirmar/persona-123', {
        telefono: '3001234567',
        email: 'juan@email.com'
      });
      expect(result.success).toBe(true);
      expect(result.persona).toEqual(mockPersona);
    });

    it('debe confirmar persona sin datos adicionales', async () => {
      const mockPersona = { _id: 'persona-123' };

      api.post.mockResolvedValue({
        data: { success: true, data: mockPersona }
      });

      const result = await consultaService.confirmarPersona('persona-123');

      expect(api.post).toHaveBeenCalledWith('/consultas/confirmar/persona-123', {});
      expect(result.success).toBe(true);
    });

    it('debe manejar error de persona ya existente', async () => {
      api.post.mockRejectedValue({
        response: { data: { error: 'La persona ya está registrada' } }
      });

      const result = await consultaService.confirmarPersona('persona-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('La persona ya está registrada');
    });
  });

  describe('pollEstado', () => {
    it('debe hacer polling hasta que la consulta esté COMPLETADO', async () => {
      const onUpdate = vi.fn();

      // Mock que termina inmediatamente con COMPLETADO
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { _id: '123', estado: 'COMPLETADO', datosPersona: { departamento: 'ATLANTICO' } }
        }
      });

      const pollPromise = consultaService.pollEstado('123', onUpdate, 10);

      await vi.advanceTimersByTimeAsync(3000);

      const result = await pollPromise;

      expect(result.estado).toBe('COMPLETADO');
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('debe detenerse cuando la consulta tiene ERROR', async () => {
      api.get.mockResolvedValueOnce({
        data: { success: true, data: { _id: '123', estado: 'ERROR', error: 'CAPTCHA falló' } }
      });

      const pollPromise = consultaService.pollEstado('123', null, 10);

      await vi.advanceTimersByTimeAsync(3000);

      const result = await pollPromise;

      expect(result.estado).toBe('ERROR');
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('debe llamar al callback onUpdate con los datos de la consulta', async () => {
      const onUpdate = vi.fn();
      const mockConsulta = { _id: '123', estado: 'COMPLETADO', documento: '1234567890' };

      api.get.mockResolvedValueOnce({
        data: { success: true, data: mockConsulta }
      });

      const pollPromise = consultaService.pollEstado('123', onUpdate, 10);

      await vi.advanceTimersByTimeAsync(3000);

      await pollPromise;

      expect(onUpdate).toHaveBeenCalledWith(mockConsulta);
    });

    it('debe llamar a la API con el consultaId correcto', async () => {
      api.get.mockResolvedValueOnce({
        data: { success: true, data: { _id: '456', estado: 'COMPLETADO' } }
      });

      const pollPromise = consultaService.pollEstado('456', null, 10);

      await vi.advanceTimersByTimeAsync(3000);

      await pollPromise;

      expect(api.get).toHaveBeenCalledWith('/consultas/estado/456');
    });
  });
});
