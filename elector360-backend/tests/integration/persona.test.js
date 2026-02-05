const request = require('supertest');
const express = require('express');
const personaRoutes = require('../../src/routes/persona.routes');
const { createTestUser, createTestAdmin, generateAuthToken, createTestPersona, createMultiplePersonas } = require('../helpers/testHelpers');
const Persona = require('../../src/models/Persona');

// Crear app Express para testing
const app = express();
app.use(express.json());
app.use('/api/v1/personas', personaRoutes);

// Middleware de error handler simple para tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message
  });
});

describe('Persona Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;

  beforeEach(async () => {
    user = await createTestUser({ email: 'user@test.com' });
    admin = await createTestAdmin({ email: 'admin@test.com' });
    userToken = generateAuthToken(user);
    adminToken = generateAuthToken(admin);
  });

  describe('GET /api/v1/personas', () => {
    it('debe listar personas con paginación', async () => {
      // Crear varias personas
      await createMultiplePersonas(user._id, 5);

      const response = await request(app)
        .get('/api/v1/personas')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('personas');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.personas.length).toBe(5);
    });

    it('debe filtrar personas por estado de contacto', async () => {
      await createTestPersona(user._id, { estadoContacto: 'CONFIRMADO' });
      await createTestPersona(user._id, { documento: '9876543210', estadoContacto: 'PENDIENTE' });

      const response = await request(app)
        .get('/api/v1/personas')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ estadoContacto: 'CONFIRMADO' });

      expect(response.status).toBe(200);
      expect(response.body.data.personas.length).toBeGreaterThan(0);
      expect(response.body.data.personas[0].estadoContacto).toBe('CONFIRMADO');
    });

    it('debe rechazar sin autenticación', async () => {
      const response = await request(app)
        .get('/api/v1/personas');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/personas', () => {
    it('debe crear una nueva persona', async () => {
      const personaData = {
        documento: '1234567890',
        nombres: 'Juan',
        apellidos: 'Pérez',
        fechaNacimiento: '1990-01-15',
        lugarNacimiento: {
          departamento: 'CUNDINAMARCA',
          municipio: 'BOGOTÁ'
        },
        puesto: {
          departamento: 'CUNDINAMARCA',
          municipio: 'BOGOTÁ',
          zona: 'ZONA 1',
          nombrePuesto: 'ESCUELA CENTRAL',
          direccion: 'Calle 10 #5-25',
          mesa: '001'
        },
        telefono: '3101234567',
        estadoContacto: 'PENDIENTE'
      };

      const response = await request(app)
        .post('/api/v1/personas')
        .set('Authorization', `Bearer ${userToken}`)
        .send(personaData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documento).toBe('1234567890');
      expect(response.body.data.nombres).toBe('Juan');

      // Verificar que se guardó en DB
      const persona = await Persona.findOne({ documento: '1234567890' });
      expect(persona).toBeTruthy();
      expect(persona.lider.id.toString()).toBe(user._id.toString());
    });

    it('debe rechazar persona con documento duplicado', async () => {
      await createTestPersona(user._id, { documento: '1234567890' });

      const personaData = {
        documento: '1234567890',
        nombres: 'Otro',
        apellidos: 'Usuario',
        fechaNacimiento: '1990-01-15',
        lugarNacimiento: {
          departamento: 'CUNDINAMARCA',
          municipio: 'BOGOTÁ'
        },
        puesto: {
          departamento: 'CUNDINAMARCA',
          municipio: 'BOGOTÁ',
          zona: 'ZONA 1',
          nombrePuesto: 'ESCUELA CENTRAL',
          direccion: 'Calle 10 #5-25',
          mesa: '001'
        },
        telefono: '3101234567',
        estadoContacto: 'PENDIENTE'
      };

      const response = await request(app)
        .post('/api/v1/personas')
        .set('Authorization', `Bearer ${userToken}`)
        .send(personaData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('ya existe');
    });

    it('debe validar campos requeridos', async () => {
      const response = await request(app)
        .post('/api/v1/personas')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('debe rechazar sin autenticación', async () => {
      const response = await request(app)
        .post('/api/v1/personas')
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/personas/:id', () => {
    it('debe obtener una persona por ID', async () => {
      const persona = await createTestPersona(user._id);

      const response = await request(app)
        .get(`/api/v1/personas/${persona._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(persona._id.toString());
      expect(response.body.data.documento).toBe(persona.documento);
    });

    it('debe retornar 404 si la persona no existe', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/v1/personas/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });

    it('debe rechazar ID inválido', async () => {
      const response = await request(app)
        .get('/api/v1/personas/invalid_id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/personas/documento/:documento', () => {
    it('debe obtener una persona por documento', async () => {
      const persona = await createTestPersona(user._id, { documento: '9876543210' });

      const response = await request(app)
        .get('/api/v1/personas/documento/9876543210')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documento).toBe('9876543210');
    });

    it('debe retornar 404 si el documento no existe', async () => {
      const response = await request(app)
        .get('/api/v1/personas/documento/9999999999')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/personas/:id', () => {
    it('debe actualizar una persona', async () => {
      const persona = await createTestPersona(user._id);

      const updateData = {
        nombres: 'Nombre Actualizado',
        apellidos: 'Apellido Actualizado',
        telefono: '3009876543',
        estadoContacto: 'CONFIRMADO'
      };

      const response = await request(app)
        .put(`/api/v1/personas/${persona._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.nombres).toBe('Nombre Actualizado');
      expect(response.body.data.telefono).toBe('3009876543');
      expect(response.body.data.estadoContacto).toBe('CONFIRMADO');

      // Verificar en DB
      const personaActualizada = await Persona.findById(persona._id);
      expect(personaActualizada.nombres).toBe('Nombre Actualizado');
    });

    it('debe retornar 404 si la persona no existe', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .put(`/api/v1/personas/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nombres: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/personas/:id', () => {
    it('debe eliminar una persona (solo admin)', async () => {
      const persona = await createTestPersona(user._id);

      const response = await request(app)
        .delete(`/api/v1/personas/${persona._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verificar que se eliminó
      const personaEliminada = await Persona.findById(persona._id);
      expect(personaEliminada).toBeNull();
    });

    it('debe rechazar eliminación si no es admin', async () => {
      const persona = await createTestPersona(user._id);

      const response = await request(app)
        .delete(`/api/v1/personas/${persona._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);

      // Verificar que NO se eliminó
      const personaExiste = await Persona.findById(persona._id);
      expect(personaExiste).toBeTruthy();
    });

    it('debe retornar 404 si la persona no existe', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/v1/personas/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/personas/export/csv', () => {
    it('debe exportar personas a CSV', async () => {
      await createMultiplePersonas(user._id, 3);

      const response = await request(app)
        .get('/api/v1/personas/export/csv')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });
});
