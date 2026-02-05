const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

class AuthService {
  /**
   * Generar JWT token
   */
  generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  }

  /**
   * Generar Refresh Token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });
  }

  /**
   * Login de usuario
   */
  async login(email, password) {
    // Buscar usuario (incluir password)
    const usuario = await Usuario.findOne({ email }).select('+password');

    if (!usuario) {
      throw new ApiError(401, 'Credenciales inválidas');
    }

    // Verificar password
    const isPasswordValid = await usuario.comparePassword(password);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Credenciales inválidas');
    }

    // Verificar que esté activo
    if (usuario.estado === 'INACTIVO') {
      throw new ApiError(401, 'Usuario inactivo. Contacta al administrador');
    }

    // Actualizar último login
    usuario.ultimoLogin = new Date();
    await usuario.save();

    // Generar tokens
    const payload = usuario.getJWTPayload();
    const accessToken = this.generateToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Remover password del objeto
    usuario.password = undefined;

    return {
      accessToken,
      refreshToken,
      user: usuario
    };
  }

  /**
   * Registro de usuario (solo ADMIN puede registrar)
   */
  async register(userData) {
    // Verificar si el email ya existe
    const existente = await Usuario.findOne({ email: userData.email });

    if (existente) {
      throw new ApiError(400, 'El email ya está registrado');
    }

    // Crear usuario
    const usuario = await Usuario.create(userData);

    // Remover password
    usuario.password = undefined;

    return usuario;
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken) {
    try {
      // Verificar refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      // Buscar usuario
      const usuario = await Usuario.findById(decoded.id);

      if (!usuario || usuario.estado === 'INACTIVO') {
        throw new ApiError(401, 'Token inválido');
      }

      // Generar nuevo access token
      const payload = usuario.getJWTPayload();
      const newAccessToken = this.generateToken(payload);

      return {
        accessToken: newAccessToken
      };
    } catch (error) {
      throw new ApiError(401, 'Token inválido o expirado');
    }
  }

  /**
   * Obtener usuario actual
   */
  async getCurrentUser(userId) {
    const usuario = await Usuario.findById(userId);

    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    return usuario;
  }

  /**
   * Cambiar password
   */
  async changePassword(userId, currentPassword, newPassword) {
    const usuario = await Usuario.findById(userId).select('+password');

    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    // Verificar password actual
    const isValid = await usuario.comparePassword(currentPassword);

    if (!isValid) {
      throw new ApiError(401, 'Contraseña actual incorrecta');
    }

    // Actualizar password
    usuario.password = newPassword;
    await usuario.save();

    return { message: 'Contraseña actualizada exitosamente' };
  }
}

module.exports = new AuthService();