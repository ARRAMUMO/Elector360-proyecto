const Usuario = require('../../../src/models/Usuario');
const { createTestUser } = require('../../helpers/testHelpers');

describe('Usuario Model Unit Tests', () => {
  describe('Schema Validation', () => {
    it('debe crear un usuario válido con todos los campos requeridos', async () => {
      const usuarioData = {
        email: 'test@test.com',
        password: 'password123',
        rol: 'LIDER',
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez',
          telefono: '3001234567'
        }
      };

      const usuario = await Usuario.create(usuarioData);

      expect(usuario._id).toBeTruthy();
      expect(usuario.email).toBe('test@test.com');
      expect(usuario.rol).toBe('LIDER');
      expect(usuario.perfil.nombres).toBe('Juan');
      expect(usuario.estado).toBe('ACTIVO'); // Default value
      expect(usuario.stats.personasRegistradas).toBe(0); // Default value
    });

    it('debe rechazar usuario sin email', async () => {
      const usuarioData = {
        password: 'password123',
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez'
        }
      };

      await expect(Usuario.create(usuarioData)).rejects.toThrow();
    });

    it('debe rechazar usuario sin password', async () => {
      const usuarioData = {
        email: 'test@test.com',
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez'
        }
      };

      await expect(Usuario.create(usuarioData)).rejects.toThrow();
    });

    it('debe rechazar usuario sin perfil.nombres', async () => {
      const usuarioData = {
        email: 'test@test.com',
        password: 'password123',
        perfil: {
          apellidos: 'Pérez'
        }
      };

      await expect(Usuario.create(usuarioData)).rejects.toThrow();
    });

    it('debe rechazar usuario sin perfil.apellidos', async () => {
      const usuarioData = {
        email: 'test@test.com',
        password: 'password123',
        perfil: {
          nombres: 'Juan'
        }
      };

      await expect(Usuario.create(usuarioData)).rejects.toThrow();
    });

    it('debe rechazar email inválido', async () => {
      const usuarioData = {
        email: 'invalidemail',
        password: 'password123',
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez'
        }
      };

      await expect(Usuario.create(usuarioData)).rejects.toThrow();
    });

    it('debe rechazar password con menos de 6 caracteres', async () => {
      const usuarioData = {
        email: 'test@test.com',
        password: '12345',
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez'
        }
      };

      await expect(Usuario.create(usuarioData)).rejects.toThrow();
    });

    it('debe rechazar teléfono inválido', async () => {
      const usuarioData = {
        email: 'test@test.com',
        password: 'password123',
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez',
          telefono: '1234567' // No empieza con 3 o no tiene 10 dígitos
        }
      };

      await expect(Usuario.create(usuarioData)).rejects.toThrow();
    });

    it('debe convertir email a minúsculas', async () => {
      const usuario = await createTestUser({
        email: 'TEST@TEST.COM'
      });

      expect(usuario.email).toBe('test@test.com');
    });

    it('debe rechazar email duplicado', async () => {
      await createTestUser({ email: 'duplicate@test.com' });

      await expect(
        createTestUser({ email: 'duplicate@test.com' })
      ).rejects.toThrow();
    });

    it('debe aceptar roles válidos (ADMIN, LIDER)', async () => {
      const admin = await createTestUser({
        email: 'admin@test.com',
        rol: 'ADMIN'
      });

      const lider = await createTestUser({
        email: 'lider@test.com',
        rol: 'LIDER'
      });

      expect(admin.rol).toBe('ADMIN');
      expect(lider.rol).toBe('LIDER');
    });

    it('debe usar LIDER como rol por defecto', async () => {
      const usuarioData = {
        email: 'test@test.com',
        password: 'password123',
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez'
        }
      };

      const usuario = await Usuario.create(usuarioData);

      expect(usuario.rol).toBe('LIDER');
    });
  });

  describe('Password Hashing (pre-save hook)', () => {
    it('debe hashear el password antes de guardar', async () => {
      const password = 'password123';
      const usuario = await Usuario.create({
        email: 'test@test.com',
        password: password,
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez'
        }
      });

      // Obtener usuario con password
      const userWithPassword = await Usuario.findById(usuario._id).select('+password');

      // El password hasheado no debe ser igual al password original
      expect(userWithPassword.password).not.toBe(password);
      expect(userWithPassword.password).toMatch(/^\$2[aby]\$\d+\$/); // Formato bcrypt
    });

    it('no debe hashear el password si no fue modificado', async () => {
      const usuario = await createTestUser({
        email: 'test@test.com',
        password: 'password123'
      });

      const userWithPassword = await Usuario.findById(usuario._id).select('+password');
      const hashedPassword = userWithPassword.password;

      // Actualizar otro campo
      usuario.perfil.nombres = 'Nuevo Nombre';
      await usuario.save();

      const userUpdated = await Usuario.findById(usuario._id).select('+password');

      // El password debe seguir siendo el mismo
      expect(userUpdated.password).toBe(hashedPassword);
    });
  });

  describe('comparePassword method', () => {
    it('debe retornar true con password correcto', async () => {
      const password = 'password123';
      const usuario = await Usuario.create({
        email: 'test@test.com',
        password: password,
        perfil: {
          nombres: 'Juan',
          apellidos: 'Pérez'
        }
      });

      const userWithPassword = await Usuario.findById(usuario._id).select('+password');
      const isMatch = await userWithPassword.comparePassword(password);

      expect(isMatch).toBe(true);
    });

    it('debe retornar false con password incorrecto', async () => {
      const usuario = await createTestUser({
        email: 'test@test.com',
        password: 'password123'
      });

      const userWithPassword = await Usuario.findById(usuario._id).select('+password');
      const isMatch = await userWithPassword.comparePassword('wrongpassword');

      expect(isMatch).toBe(false);
    });
  });

  describe('getJWTPayload method', () => {
    it('debe retornar el payload correcto para JWT', async () => {
      const usuario = await createTestUser({
        email: 'test@test.com',
        rol: 'LIDER'
      });

      const payload = usuario.getJWTPayload();

      expect(payload).toHaveProperty('id');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('rol');
      expect(payload.id).toBe(usuario._id.toString());
      expect(payload.email).toBe('test@test.com');
      expect(payload.rol).toBe('LIDER');
      expect(payload).not.toHaveProperty('password');
    });
  });

  describe('Password field select behavior', () => {
    it('no debe devolver password por defecto', async () => {
      const usuario = await createTestUser();

      // Buscar usuario sin especificar el campo password
      const userFound = await Usuario.findById(usuario._id);

      expect(userFound.password).toBeUndefined();
    });

    it('debe devolver password cuando se especifica explícitamente', async () => {
      const usuario = await createTestUser();

      // Buscar usuario con password
      const userWithPassword = await Usuario.findById(usuario._id).select('+password');

      expect(userWithPassword.password).toBeTruthy();
    });
  });

  describe('Timestamps', () => {
    it('debe tener createdAt y updatedAt', async () => {
      const usuario = await createTestUser();

      expect(usuario.createdAt).toBeTruthy();
      expect(usuario.updatedAt).toBeTruthy();
      expect(usuario.createdAt).toBeInstanceOf(Date);
      expect(usuario.updatedAt).toBeInstanceOf(Date);
    });

    it('debe actualizar updatedAt al modificar el usuario', async () => {
      const usuario = await createTestUser();
      const originalUpdatedAt = usuario.updatedAt;

      // Esperar un momento para que haya diferencia en el timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      usuario.perfil.nombres = 'Nuevo Nombre';
      await usuario.save();

      expect(usuario.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
