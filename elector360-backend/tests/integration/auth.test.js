const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth.routes');
const { createTestUser, createTestAdmin, generateAuthToken } = require('../helpers/testHelpers');
const Usuario = require('../../src/models/Usuario');

// Crear app Express para testing
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

// Middleware de error handler simple para tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message
  });
});

describe('Auth Integration Tests', () => {
  describe('POST /api/v1/auth/login', () => {
    it('debe hacer login exitoso con credenciales válidas', async () => {
      // Crear usuario de prueba
      await createTestUser({
        email: 'test@test.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe('test@test.com');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('debe rechazar login con email inválido', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'noexiste@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Credenciales inválidas');
    });

    it('debe rechazar login con contraseña incorrecta', async () => {
      await createTestUser({
        email: 'test@test.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Credenciales inválidas');
    });

    it('debe rechazar login de usuario inactivo', async () => {
      await createTestUser({
        email: 'inactive@test.com',
        password: 'password123',
        estado: 'INACTIVO'
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Usuario inactivo');
    });

    it('debe validar campos requeridos', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('debe registrar un nuevo usuario (solo admin)', async () => {
      const admin = await createTestAdmin();
      const token = generateAuthToken(admin);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          rol: 'LIDER',
          perfil: {
            nombres: 'Nuevo',
            apellidos: 'Usuario',
            telefono: '3001234567'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newuser@test.com');
      expect(response.body.data).not.toHaveProperty('password');

      // Verificar que el usuario fue creado en la DB
      const usuario = await Usuario.findOne({ email: 'newuser@test.com' });
      expect(usuario).toBeTruthy();
      expect(usuario.rol).toBe('LIDER');
    });

    it('debe rechazar registro sin autenticación', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          rol: 'LIDER',
          perfil: {
            nombres: 'Nuevo',
            apellidos: 'Usuario'
          }
        });

      expect(response.status).toBe(401);
    });

    it('debe rechazar registro si no es admin', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          rol: 'LIDER',
          perfil: {
            nombres: 'Nuevo',
            apellidos: 'Usuario'
          }
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('permisos');
    });

    it('debe rechazar registro con email duplicado', async () => {
      const admin = await createTestAdmin();
      const token = generateAuthToken(admin);

      // Crear usuario existente
      await createTestUser({ email: 'existing@test.com' });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'existing@test.com',
          password: 'password123',
          rol: 'LIDER',
          perfil: {
            nombres: 'Nuevo',
            apellidos: 'Usuario'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('ya está registrado');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('debe renovar el access token con refresh token válido', async () => {
      const user = await createTestUser();
      const authService = require('../../src/services/authService');
      const payload = user.getJWTPayload();
      const refreshToken = authService.generateRefreshToken(payload);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('debe rechazar refresh token inválido', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid_token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('debe rechazar sin refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('debe obtener el usuario autenticado', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(user.email);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('debe rechazar sin token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('debe rechazar con token inválido', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/auth/change-password', () => {
    it('debe cambiar la contraseña exitosamente', async () => {
      const user = await createTestUser({
        email: 'changepass@test.com',
        password: 'oldpassword123'
      });
      const token = generateAuthToken(user);

      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verificar que la nueva contraseña funciona
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'changepass@test.com',
          password: 'newpassword123'
        });

      expect(loginResponse.status).toBe(200);
    });

    it('debe rechazar con contraseña actual incorrecta', async () => {
      const user = await createTestUser({
        email: 'changepass@test.com',
        password: 'oldpassword123'
      });
      const token = generateAuthToken(user);

      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Contraseña actual incorrecta');
    });

    it('debe rechazar sin autenticación', async () => {
      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('debe hacer logout exitoso', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('debe rechazar logout sin autenticación', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
    });
  });
});
