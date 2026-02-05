const authService = require('../../../src/services/authService');
const Usuario = require('../../../src/models/Usuario');
const jwt = require('jsonwebtoken');
const { createTestUser } = require('../../helpers/testHelpers');

describe('AuthService Unit Tests', () => {
  describe('generateToken', () => {
    it('debe generar un token JWT válido', () => {
      const payload = { id: '123', email: 'test@test.com', rol: 'LIDER' };
      const token = authService.generateToken(payload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Verificar que el token puede ser decodificado
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.rol).toBe(payload.rol);
    });
  });

  describe('generateRefreshToken', () => {
    it('debe generar un refresh token válido', () => {
      const payload = { id: '123', email: 'test@test.com', rol: 'LIDER' };
      const refreshToken = authService.generateRefreshToken(payload);

      expect(refreshToken).toBeTruthy();
      expect(typeof refreshToken).toBe('string');

      // Verificar que el token puede ser decodificado
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.rol).toBe(payload.rol);
    });
  });

  describe('login', () => {
    it('debe hacer login exitoso con credenciales válidas', async () => {
      const user = await createTestUser({
        email: 'test@test.com',
        password: 'password123'
      });

      const result = await authService.login('test@test.com', 'password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@test.com');
      expect(result.user.password).toBeUndefined();

      // Verificar que el último login se actualizó
      const userUpdated = await Usuario.findById(user._id);
      expect(userUpdated.ultimoLogin).toBeTruthy();
    });

    it('debe rechazar login con email inválido', async () => {
      await expect(
        authService.login('noexiste@test.com', 'password123')
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debe rechazar login con contraseña incorrecta', async () => {
      await createTestUser({
        email: 'test@test.com',
        password: 'password123'
      });

      await expect(
        authService.login('test@test.com', 'wrongpassword')
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debe rechazar login de usuario inactivo', async () => {
      await createTestUser({
        email: 'inactive@test.com',
        password: 'password123',
        estado: 'INACTIVO'
      });

      await expect(
        authService.login('inactive@test.com', 'password123')
      ).rejects.toThrow('Usuario inactivo');
    });
  });

  describe('register', () => {
    it('debe registrar un nuevo usuario exitosamente', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'password123',
        rol: 'LIDER',
        perfil: {
          nombres: 'Nuevo',
          apellidos: 'Usuario',
          telefono: '3001234567'
        }
      };

      const usuario = await authService.register(userData);

      expect(usuario).toBeTruthy();
      expect(usuario.email).toBe('newuser@test.com');
      expect(usuario.rol).toBe('LIDER');
      expect(usuario.password).toBeUndefined();

      // Verificar que se guardó en la DB
      const userInDb = await Usuario.findById(usuario._id).select('+password');
      expect(userInDb).toBeTruthy();
      expect(userInDb.password).toBeTruthy();
      expect(userInDb.password).not.toBe('password123'); // Debe estar hasheado
    });

    it('debe rechazar registro con email duplicado', async () => {
      await createTestUser({ email: 'existing@test.com' });

      const userData = {
        email: 'existing@test.com',
        password: 'password123',
        rol: 'LIDER',
        perfil: {
          nombres: 'Nuevo',
          apellidos: 'Usuario'
        }
      };

      await expect(authService.register(userData)).rejects.toThrow('ya está registrado');
    });
  });

  describe('refreshToken', () => {
    it('debe renovar el access token con refresh token válido', async () => {
      const user = await createTestUser();
      const payload = user.getJWTPayload();
      const refreshToken = authService.generateRefreshToken(payload);

      const result = await authService.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(typeof result.accessToken).toBe('string');

      // Verificar que el nuevo token es válido
      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET);
      expect(decoded.id).toBe(user._id.toString());
    });

    it('debe rechazar refresh token inválido', async () => {
      await expect(
        authService.refreshToken('invalid_token')
      ).rejects.toThrow('Token inválido o expirado');
    });

    it('debe rechazar refresh token de usuario inactivo', async () => {
      const user = await createTestUser({ estado: 'ACTIVO' });
      const payload = user.getJWTPayload();
      const refreshToken = authService.generateRefreshToken(payload);

      // Cambiar estado a inactivo
      user.estado = 'INACTIVO';
      await user.save();

      await expect(
        authService.refreshToken(refreshToken)
      ).rejects.toThrow('Token inválido');
    });
  });

  describe('getCurrentUser', () => {
    it('debe obtener el usuario actual', async () => {
      const user = await createTestUser();

      const currentUser = await authService.getCurrentUser(user._id);

      expect(currentUser).toBeTruthy();
      expect(currentUser._id.toString()).toBe(user._id.toString());
      expect(currentUser.email).toBe(user.email);
    });

    it('debe retornar error si el usuario no existe', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await expect(
        authService.getCurrentUser(fakeId)
      ).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('changePassword', () => {
    it('debe cambiar la contraseña exitosamente', async () => {
      const user = await createTestUser({
        email: 'changepass@test.com',
        password: 'oldpassword123'
      });

      const result = await authService.changePassword(
        user._id,
        'oldpassword123',
        'newpassword123'
      );

      expect(result).toHaveProperty('message');
      expect(result.message).toContain('exitosamente');

      // Verificar que la nueva contraseña funciona
      const loginResult = await authService.login('changepass@test.com', 'newpassword123');
      expect(loginResult).toHaveProperty('accessToken');

      // Verificar que la vieja contraseña ya no funciona
      await expect(
        authService.login('changepass@test.com', 'oldpassword123')
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debe rechazar con contraseña actual incorrecta', async () => {
      const user = await createTestUser({
        email: 'changepass@test.com',
        password: 'oldpassword123'
      });

      await expect(
        authService.changePassword(user._id, 'wrongpassword', 'newpassword123')
      ).rejects.toThrow('Contraseña actual incorrecta');
    });

    it('debe rechazar si el usuario no existe', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await expect(
        authService.changePassword(fakeId, 'oldpassword', 'newpassword')
      ).rejects.toThrow('Usuario no encontrado');
    });
  });
});
