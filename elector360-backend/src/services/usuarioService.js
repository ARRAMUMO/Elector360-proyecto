const Usuario = require('../models/Usuario');
const Persona = require('../models/Persona');
const ApiError = require('../utils/ApiError');

class UsuarioService {
  /**
   * Listar usuarios
   */
  async listarUsuarios(opciones = {}) {
    const { page = 1, limit = 50, search, rol, estado, campanaFilter } = opciones;

    const query = { ...campanaFilter };

    if (search) {
      query.$or = [
        { email: new RegExp(search, 'i') },
        { 'perfil.nombres': new RegExp(search, 'i') },
        { 'perfil.apellidos': new RegExp(search, 'i') }
      ];
    }

    if (rol) query.rol = rol;
    if (estado) query.estado = estado;

    const [usuarios, total] = await Promise.all([
      Usuario.find(query)
        .select('-password')
        .populate('campana', 'nombre estado tipo')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit),
      
      Usuario.countDocuments(query)
    ]);

    return {
      usuarios,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtener usuario por ID
   */
  async obtenerPorId(id) {
    const usuario = await Usuario.findById(id).select('-password');

    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    return usuario;
  }

  /**
   * Crear usuario
   */
  async crearUsuario(datosUsuario, creadorRol = 'ADMIN', creadorCampanaId = null) {
    // COORDINADOR solo puede crear LIDER y fuerza su campaña
    if (creadorRol === 'COORDINADOR') {
      if (datosUsuario.rol && datosUsuario.rol !== 'LIDER') {
        throw new ApiError(403, 'Solo puedes crear usuarios con rol LIDER');
      }
      datosUsuario.rol = 'LIDER';
      datosUsuario.campana = creadorCampanaId;
    }

    // Verificar si el email ya existe
    const existente = await Usuario.findOne({ email: datosUsuario.email });

    if (existente) {
      throw new ApiError(400, 'El email ya está registrado');
    }

    const usuario = await Usuario.create(datosUsuario);

    // Remover password
    usuario.password = undefined;

    return usuario;
  }

  /**
   * Actualizar usuario
   */
  async actualizarUsuario(id, datosActualizacion) {
    const usuario = await Usuario.findById(id);

    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    // Campos que se pueden actualizar
    const camposPermitidos = [
      'perfil',
      'rol',
      'estado',
      'campana'
    ];

    camposPermitidos.forEach(campo => {
      if (datosActualizacion[campo] !== undefined) {
        usuario[campo] = datosActualizacion[campo];
      }
    });

    // Email solo si no existe
    if (datosActualizacion.email && datosActualizacion.email !== usuario.email) {
      const existente = await Usuario.findOne({ email: datosActualizacion.email });
      if (existente) {
        throw new ApiError(400, 'El email ya está registrado');
      }
      usuario.email = datosActualizacion.email;
    }

    await usuario.save();

    usuario.password = undefined;
    return usuario;
  }

  /**
   * Eliminar usuario
   */
  async eliminarUsuario(id) {
    const usuario = await Usuario.findById(id);

    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    // Verificar que no sea el último admin
    if (usuario.rol === 'ADMIN') {
      const totalAdmins = await Usuario.countDocuments({ rol: 'ADMIN' });
      if (totalAdmins === 1) {
        throw new ApiError(400, 'No puedes eliminar el último administrador');
      }
    }

    // Eliminar o reasignar personas
    await Persona.deleteMany({ 'lider.id': id });

    await usuario.deleteOne();

    return { message: 'Usuario eliminado exitosamente' };
  }

  /**
   * Cambiar estado (activar/desactivar)
   */
  async cambiarEstado(id, solicitanteRol = 'ADMIN', solicitanteCampanaId = null) {
    const usuario = await Usuario.findById(id);

    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    // COORDINADOR solo puede cambiar estado de usuarios de su campaña
    if (solicitanteRol === 'COORDINADOR') {
      if (!usuario.campana || usuario.campana.toString() !== solicitanteCampanaId?.toString()) {
        throw new ApiError(403, 'No tienes permiso para modificar este usuario');
      }
    }

    usuario.estado = usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    await usuario.save();

    return usuario;
  }

  /**
   * Obtener estadísticas de un usuario
   */
  async obtenerEstadisticas(id) {
    const usuario = await Usuario.findById(id);

    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    const [totalPersonas, confirmadas, pendientes, noContactadas] = await Promise.all([
      Persona.countDocuments({ 'lider.id': id }),
      Persona.countDocuments({ 'lider.id': id, estadoContacto: 'CONFIRMADO' }),
      Persona.countDocuments({ 'lider.id': id, estadoContacto: 'PENDIENTE' }),
      Persona.countDocuments({ 'lider.id': id, estadoContacto: 'NO_CONTACTADO' })
    ]);

    return {
      totalPersonas,
      confirmadas,
      pendientes,
      noContactadas,
      consultasRealizadas: usuario.stats.consultasRealizadas
    };
  }
}

module.exports = new UsuarioService();