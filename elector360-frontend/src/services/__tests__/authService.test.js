import { describe, it, expect, vi, beforeEach } from 'vitest';
import authService from '../authService';
import api from '../api';

// Mock del módulo api
vi.mock('../api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem.mockReturnValue(null);
    localStorage.setItem.mockClear();
    localStorage.removeItem.mockClear();
  });

  describe('login', () => {
    it('debe hacer login exitoso y guardar tokens en localStorage', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-456',
            user: {
              _id: 'user-id',
              email: 'admin@elector360.com',
              rol: 'ADMIN',
              perfil: { nombres: 'Admin', apellidos: 'Sistema' }
            }
          }
        }
      };

      api.post.mockResolvedValue(mockResponse);

      const result = await authService.login('admin@elector360.com', 'password123');

      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@elector360.com',
        password: 'password123'
      });
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'access-token-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-456');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.data.data.user));
      expect(result.success).toBe(true);
      expect(result.user.email).toBe('admin@elector360.com');
    });

    it('debe retornar error cuando las credenciales son inválidas', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Credenciales inválidas'
        }
      };

      api.post.mockResolvedValue(mockResponse);

      const result = await authService.login('wrong@email.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credenciales inválidas');
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('debe manejar errores de red correctamente', async () => {
      api.post.mockRejectedValue({
        response: {
          data: { error: 'Error de conexión al servidor' }
        }
      });

      const result = await authService.login('admin@elector360.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error de conexión al servidor');
    });

    it('debe manejar errores sin respuesta del servidor', async () => {
      api.post.mockRejectedValue(new Error('Network Error'));

      const result = await authService.login('admin@elector360.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error de conexión');
    });
  });

  describe('logout', () => {
    it('debe cerrar sesión y limpiar localStorage', async () => {
      api.post.mockResolvedValue({ data: { success: true } });

      await authService.logout();

      expect(api.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('debe limpiar localStorage aunque falle la llamada al API', async () => {
      api.post.mockRejectedValue(new Error('Network Error'));

      await authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('getCurrentUser', () => {
    it('debe obtener el usuario actual exitosamente', async () => {
      const mockUser = {
        _id: 'user-id',
        email: 'admin@elector360.com',
        rol: 'ADMIN'
      };

      api.get.mockResolvedValue({
        data: {
          success: true,
          data: mockUser
        }
      });

      const result = await authService.getCurrentUser();

      expect(api.get).toHaveBeenCalledWith('/auth/me');
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });

    it('debe retornar error cuando falla la obtención del usuario', async () => {
      api.get.mockResolvedValue({
        data: { success: false }
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No se pudo obtener el usuario');
    });

    it('debe manejar errores de red', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Token inválido' } }
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token inválido');
    });
  });

  describe('changePassword', () => {
    it('debe cambiar la contraseña exitosamente', async () => {
      api.post.mockResolvedValue({
        data: { success: true }
      });

      const result = await authService.changePassword('oldPassword', 'newPassword');

      expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword'
      });
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('debe retornar error cuando la contraseña actual es incorrecta', async () => {
      api.post.mockResolvedValue({
        data: {
          success: false,
          error: 'Contraseña actual incorrecta'
        }
      });

      const result = await authService.changePassword('wrongPassword', 'newPassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contraseña actual incorrecta');
    });

    it('debe manejar errores de red', async () => {
      api.post.mockRejectedValue({
        response: { data: { error: 'Error del servidor' } }
      });

      const result = await authService.changePassword('oldPassword', 'newPassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error del servidor');
    });
  });

  describe('isAuthenticated', () => {
    it('debe retornar true cuando existe token', () => {
      localStorage.getItem.mockReturnValue('valid-token');

      const result = authService.isAuthenticated();

      expect(localStorage.getItem).toHaveBeenCalledWith('token');
      expect(result).toBe(true);
    });

    it('debe retornar false cuando no existe token', () => {
      localStorage.getItem.mockReturnValue(null);

      const result = authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getStoredUser', () => {
    it('debe retornar el usuario parseado de localStorage', () => {
      const mockUser = { _id: 'user-id', email: 'admin@elector360.com' };
      localStorage.getItem.mockReturnValue(JSON.stringify(mockUser));

      const result = authService.getStoredUser();

      expect(localStorage.getItem).toHaveBeenCalledWith('user');
      expect(result).toEqual(mockUser);
    });

    it('debe retornar null cuando no hay usuario guardado', () => {
      localStorage.getItem.mockReturnValue(null);

      const result = authService.getStoredUser();

      expect(result).toBeNull();
    });

    it('debe retornar null cuando el JSON es inválido', () => {
      localStorage.getItem.mockReturnValue('invalid-json');

      const result = authService.getStoredUser();

      expect(result).toBeNull();
    });
  });
});
