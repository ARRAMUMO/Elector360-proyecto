import { describe, it, expect, vi, beforeEach } from 'vitest';
import personaService from '../personaService';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('personaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listar', () => {
    it('debe listar personas exitosamente', async () => {
      const mockPersonas = [
        { _id: '1', documento: '123456789', nombres: 'Juan', apellidos: 'Pérez' },
        { _id: '2', documento: '987654321', nombres: 'María', apellidos: 'García' }
      ];
      const mockPagination = { total: 2, pages: 1, page: 1, limit: 20 };

      api.get.mockResolvedValue({
        data: {
          success: true,
          data: { personas: mockPersonas, pagination: mockPagination }
        }
      });

      const result = await personaService.listar();

      expect(api.get).toHaveBeenCalledWith('/personas?');
      expect(result.success).toBe(true);
      expect(result.personas).toEqual(mockPersonas);
      expect(result.pagination).toEqual(mockPagination);
    });

    it('debe aplicar filtros correctamente', async () => {
      api.get.mockResolvedValue({
        data: {
          success: true,
          data: { personas: [], pagination: { total: 0, pages: 0, page: 1, limit: 20 } }
        }
      });

      await personaService.listar({
        page: 2,
        limit: 10,
        search: 'Juan',
        estadoContacto: 'PENDIENTE',
        departamento: 'ATLANTICO'
      });

      expect(api.get).toHaveBeenCalledWith(
        '/personas?page=2&limit=10&search=Juan&estadoContacto=PENDIENTE&departamento=ATLANTICO'
      );
    });

    it('debe manejar errores de red', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Error de conexión' } }
      });

      const result = await personaService.listar();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error de conexión');
      expect(result.personas).toEqual([]);
    });
  });

  describe('obtenerPorId', () => {
    it('debe obtener persona por ID exitosamente', async () => {
      const mockPersona = {
        _id: '123',
        documento: '1234567890',
        nombres: 'Juan',
        apellidos: 'Pérez'
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockPersona }
      });

      const result = await personaService.obtenerPorId('123');

      expect(api.get).toHaveBeenCalledWith('/personas/123');
      expect(result.success).toBe(true);
      expect(result.persona).toEqual(mockPersona);
    });

    it('debe retornar error cuando no existe la persona', async () => {
      api.get.mockResolvedValue({
        data: { success: false }
      });

      const result = await personaService.obtenerPorId('999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persona no encontrada');
    });
  });

  describe('buscarPorDocumento', () => {
    it('debe buscar persona por documento exitosamente', async () => {
      const mockPersona = {
        _id: '123',
        documento: '1234567890',
        nombres: 'Juan'
      };

      api.get.mockResolvedValue({
        data: { success: true, data: mockPersona }
      });

      const result = await personaService.buscarPorDocumento('1234567890');

      expect(api.get).toHaveBeenCalledWith('/personas/documento/1234567890');
      expect(result.success).toBe(true);
      expect(result.persona).toEqual(mockPersona);
    });

    it('debe retornar error cuando no encuentra la persona', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Documento no registrado' } }
      });

      const result = await personaService.buscarPorDocumento('0000000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Documento no registrado');
    });
  });

  describe('crear', () => {
    it('debe crear persona exitosamente', async () => {
      const nuevaPersona = {
        documento: '1234567890',
        nombres: 'Juan',
        apellidos: 'Pérez',
        telefono: '3001234567',
        direccion: 'Calle 123'
      };

      const mockResponse = {
        _id: '123',
        ...nuevaPersona
      };

      api.post.mockResolvedValue({
        data: { success: true, data: mockResponse }
      });

      const result = await personaService.crear(nuevaPersona);

      expect(api.post).toHaveBeenCalledWith('/personas', nuevaPersona);
      expect(result.success).toBe(true);
      expect(result.persona).toEqual(mockResponse);
      expect(result.error).toBeNull();
    });

    it('debe manejar error de documento duplicado', async () => {
      api.post.mockRejectedValue({
        response: { data: { error: 'El documento ya está registrado' } }
      });

      const result = await personaService.crear({ documento: '1234567890' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('El documento ya está registrado');
    });
  });

  describe('actualizar', () => {
    it('debe actualizar persona exitosamente', async () => {
      const datosActualizar = { telefono: '3009999999' };
      const mockPersonaActualizada = {
        _id: '123',
        documento: '1234567890',
        nombres: 'Juan',
        telefono: '3009999999'
      };

      api.put.mockResolvedValue({
        data: { success: true, data: mockPersonaActualizada }
      });

      const result = await personaService.actualizar('123', datosActualizar);

      expect(api.put).toHaveBeenCalledWith('/personas/123', datosActualizar);
      expect(result.success).toBe(true);
      expect(result.persona).toEqual(mockPersonaActualizada);
    });

    it('debe manejar error de persona no encontrada', async () => {
      api.put.mockRejectedValue({
        response: { data: { error: 'Persona no encontrada' } }
      });

      const result = await personaService.actualizar('999', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persona no encontrada');
    });
  });

  describe('eliminar', () => {
    it('debe eliminar persona exitosamente', async () => {
      api.delete.mockResolvedValue({
        data: { success: true }
      });

      const result = await personaService.eliminar('123');

      expect(api.delete).toHaveBeenCalledWith('/personas/123');
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('debe manejar error de permisos insuficientes', async () => {
      api.delete.mockRejectedValue({
        response: { data: { error: 'No tiene permisos para eliminar' } }
      });

      const result = await personaService.eliminar('123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No tiene permisos para eliminar');
    });
  });

  describe('exportarCSV', () => {
    it('debe exportar CSV exitosamente', async () => {
      const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });

      api.get.mockResolvedValue({ data: mockBlob });

      // Mock DOM elements
      const mockLink = {
        href: '',
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn()
      };
      document.createElement = vi.fn().mockReturnValue(mockLink);
      document.body.appendChild = vi.fn();

      const result = await personaService.exportarCSV();

      expect(api.get).toHaveBeenCalledWith('/personas/export/csv', { responseType: 'blob' });
      expect(result.success).toBe(true);
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('debe manejar error en exportación', async () => {
      api.get.mockRejectedValue(new Error('Error de red'));

      const result = await personaService.exportarCSV();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al exportar CSV');
    });
  });
});
