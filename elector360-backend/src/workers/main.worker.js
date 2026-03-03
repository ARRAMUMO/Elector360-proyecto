// src/workers/main.worker.js

const mongoose = require('mongoose');
const WorkerPool = require('./pool/worker-pool');
const ConsultaRPA = require('../models/consultaRPA.model');
const ColaConsulta = require('../models/ColaConsulta');
const Persona = require('../models/Persona');
const config = require('./config/worker.config');

class RPAWorker {
  constructor() {
    this.pool = null;
    this.isRunning = false;
    this.pollInterval = 5000; // 5 segundos
    this.pollTimer = null;
  }

  /**
   * Iniciar worker
   */
  async start() {
    try {
      console.log('🚀 Iniciando RPA Worker...');

      // Conectar a MongoDB si no está conectado
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado');
      }

      // Recuperar consultas que quedaron en PROCESANDO de sesiones anteriores
      await this.recuperarConsultasBloqueadas();

      // Inicializar pool
      this.pool = new WorkerPool();
      await this.pool.init();

      // Configurar event listeners
      this.setupEventListeners();

      // Iniciar polling
      this.isRunning = true;
      this.startPolling();

      console.log('✅ RPA Worker iniciado');

    } catch (error) {
      console.error('❌ Error iniciando worker:', error);
      throw error;
    }
  }

  /**
   * Recuperar consultas que quedaron en PROCESANDO al reiniciar el servidor.
   * Sin esto, esas consultas nunca serían reprocesadas.
   */
  async recuperarConsultasBloqueadas() {
    try {
      const [rpaCount, colaCount] = await Promise.all([
        ConsultaRPA.countDocuments({ estado: 'PROCESANDO' }),
        ColaConsulta.countDocuments({ estado: 'PROCESANDO' })
      ]);

      if (rpaCount > 0) {
        await ConsultaRPA.updateMany({ estado: 'PROCESANDO' }, { $set: { estado: 'EN_COLA' } });
        console.log(`♻️ ${rpaCount} ConsultaRPA recuperadas (PROCESANDO → EN_COLA)`);
      }
      if (colaCount > 0) {
        await ColaConsulta.updateMany({ estado: 'PROCESANDO' }, { $set: { estado: 'PENDIENTE' } });
        console.log(`♻️ ${colaCount} ColaConsulta recuperadas (PROCESANDO → PENDIENTE)`);
      }
    } catch (err) {
      console.warn('⚠️ Error recuperando consultas bloqueadas:', err.message);
    }
  }

  /**
   * Configurar listeners de eventos
   */
  setupEventListeners() {
    this.pool.on('job-completed', async ({ job, result, duration }) => {
      await this.handleJobCompleted(job, result, duration);
    });
    
    this.pool.on('job-failed', async ({ job, error, duration }) => {
      await this.handleJobFailed(job, error, duration);
    });
    
    this.pool.on('circuit-breaker-open', () => {
      console.log('⏸️ Pausando polling (Circuit Breaker abierto)');
      this.pausePolling();
    });
    
    this.pool.on('circuit-breaker-closed', () => {
      console.log('▶️ Reanudando polling (Circuit Breaker cerrado)');
      this.resumePolling();
    });
  }

  /**
   * Iniciar polling de la cola
   */
  startPolling() {
    console.log('🔄 Iniciando polling de cola...');
    this.poll();
  }

  /**
   * Pausar polling
   */
  pausePolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Reanudar polling
   */
  resumePolling() {
    if (!this.pollTimer && this.isRunning) {
      this.poll();
    }
  }

  /**
   * Poll de consultas pendientes
   * Prioridad: ConsultaRPA (individuales) > ColaConsulta (masivas)
   * Solo toma lo que el pool puede manejar realmente
   */
  async poll() {
    if (!this.isRunning) return;

    try {
      const maxConcurrent = config.pool?.maxConcurrent || 5;

      // Calcular slots REALMENTE disponibles en el pool
      const activeJobs = this.pool.activeJobs || 0;
      const queuedJobs = this.pool.queue?.length || 0;
      const slotsReales = Math.max(0, maxConcurrent - activeJobs - queuedJobs);

      if (slotsReales === 0) {
        // Pool lleno, no tomar más trabajo
        this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
        return;
      }

      let procesadas = 0;

      // 1. Primero: ConsultaRPA (consultas individuales con mayor prioridad)
      const consultasRPA = await ConsultaRPA.find({
        estado: 'EN_COLA'
      })
      .sort({ prioridad: -1, createdAt: 1 })
      .limit(slotsReales);

      if (consultasRPA.length > 0) {
        console.log(`📋 ${consultasRPA.length} consultas individuales en ConsultaRPA`);

        const idsRPA = consultasRPA.map(c => c._id);
        await ConsultaRPA.updateMany(
          { _id: { $in: idsRPA } },
          { $set: { estado: 'PROCESANDO' }, $inc: { intentos: 1 } }
        );

        for (const consulta of consultasRPA) {
          this.pool.processJob({
            consultaId: consulta._id,
            documento: consulta.documento,
            source: 'ConsultaRPA'
          }).catch(async error => {
            console.error(`Error procesando ConsultaRPA ${consulta._id}:`, error.message);
            // Si el job fue rechazado antes de ejecutarse (circuit breaker, etc.),
            // resetear a EN_COLA para que el siguiente poll lo reintente
            try {
              await ConsultaRPA.findByIdAndUpdate(consulta._id,
                { $set: { estado: 'EN_COLA' } });
            } catch (e) { /* ignorar */ }
          });
          procesadas++;
        }
      }

      // 2. Si hay espacio, procesar ColaConsulta (operaciones masivas)
      const slotsDisponibles = slotsReales - procesadas;
      if (slotsDisponibles > 0) {
        const consultasCola = await ColaConsulta.find({
          estado: 'PENDIENTE'
        })
        .sort({ prioridad: -1, createdAt: 1 })
        .limit(slotsDisponibles);

        if (consultasCola.length > 0) {
          console.log(`📋 ${consultasCola.length} consultas masivas en ColaConsulta`);

          const idsCola = consultasCola.map(c => c._id);
          await ColaConsulta.updateMany(
            { _id: { $in: idsCola } },
            { $set: { estado: 'PROCESANDO' }, $inc: { intentos: 1 } }
          );

          for (const consulta of consultasCola) {
            this.pool.processJob({
              consultaId: consulta._id,
              documento: consulta.documento,
              source: 'ColaConsulta'
            }).catch(async error => {
              console.error(`Error procesando ColaConsulta ${consulta._id}:`, error.message);
              try {
                await ColaConsulta.findByIdAndUpdate(consulta._id,
                  { $set: { estado: 'PENDIENTE' } });
              } catch (e) { /* ignorar */ }
            });
            procesadas++;
          }
        }
      }

      if (procesadas > 0) {
        console.log(`🔄 ${procesadas} consultas enviadas al pool (${activeJobs} activas, ${slotsReales} slots)`);
      }

    } catch (error) {
      console.error('❌ Error en poll:', error);
    }

    // Programar siguiente poll
    this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
  }

  /**
   * Manejar job completado
   * Soporta tanto ConsultaRPA como ColaConsulta
   */
  async handleJobCompleted(job, result, duration) {
    try {
      const source = job.source || 'ConsultaRPA';
      const Model = source === 'ColaConsulta' ? ColaConsulta : ConsultaRPA;

      const consulta = await Model.findById(job.consultaId);
      if (!consulta) {
        console.warn(`⚠️ Consulta ${job.consultaId} no encontrada en ${source}`);
        return;
      }

      if (result.success) {
        // Guardar o actualizar persona
        const persona = await this.guardarPersona(result.datos, consulta.usuario || consulta.personaId);

        // Actualizar consulta según el modelo
        consulta.estado = 'COMPLETADO';
        consulta.tiempoEjecucion = duration;

        if (source === 'ConsultaRPA') {
          consulta.datosPersona = result.datos;
          consulta.persona = persona._id;
          consulta.completadoEn = new Date();
          consulta.costo = 0.003;
        } else {
          // ColaConsulta
          consulta.resultado = result.datos;
          consulta.fechaProcesamiento = new Date();
        }

        await consulta.save();
        console.log(`✅ [${source}] Consulta ${job.consultaId} completada en ${duration}ms`);

      } else {
        // Marcar como error
        consulta.estado = 'ERROR';
        consulta.tiempoEjecucion = duration;

        if (source === 'ConsultaRPA') {
          consulta.error = result.error;
          consulta.completadoEn = new Date();
        } else {
          consulta.ultimoError = result.error;
          consulta.fechaProcesamiento = new Date();
        }

        await consulta.save();
        console.log(`❌ [${source}] Consulta ${job.consultaId} falló: ${result.error}`);
      }

    } catch (error) {
      console.error('Error guardando resultado:', error);
    }
  }

  /**
   * Determinar si un error es permanente (no tiene sentido reintentar)
   */
  isErrorPermanente(errorMsg) {
    const erroresPermanentes = [
      'no encontrado',
      'no existe',
      'no censado',
      'no aparece',
      'censo electoral'
    ];
    const msgLower = (errorMsg || '').toLowerCase();
    return erroresPermanentes.some(e => msgLower.includes(e));
  }

  /**
   * Manejar job fallido
   * Soporta tanto ConsultaRPA como ColaConsulta
   */
  async handleJobFailed(job, error, duration) {
    try {
      const source = job.source || 'ConsultaRPA';
      const Model = source === 'ColaConsulta' ? ColaConsulta : ConsultaRPA;
      const maxAttempts = config.retries?.maxAttempts || 3;

      const consulta = await Model.findById(job.consultaId);
      if (!consulta) {
        console.warn(`⚠️ Consulta ${job.consultaId} no encontrada en ${source}`);
        return;
      }

      const errorMsg = error.message || String(error);
      const esPermanente = this.isErrorPermanente(errorMsg);

      // Error permanente (ej: no censado) o máximo de intentos → marcar como ERROR final
      const maxIntentosConsulta = consulta.maximoIntentos || maxAttempts;
      if (esPermanente || consulta.intentos >= maxIntentosConsulta) {
        consulta.estado = 'ERROR';
        consulta.tiempoEjecucion = duration;

        const razon = esPermanente ? errorMsg : `Máximo de intentos alcanzado: ${errorMsg}`;

        if (source === 'ConsultaRPA') {
          consulta.error = razon;
          consulta.completadoEn = new Date();
        } else {
          consulta.ultimoError = razon;
          consulta.fechaProcesamiento = new Date();
        }

        if (esPermanente) {
          console.log(`⛔ [${source}] ${job.consultaId} - Error permanente: ${errorMsg}`);
        }
      } else {
        // Volver a cola para reintentar
        consulta.estado = source === 'ColaConsulta' ? 'PENDIENTE' : 'EN_COLA';

        if (source === 'ConsultaRPA') {
          consulta.error = errorMsg;
        } else {
          consulta.ultimoError = errorMsg;
        }
      }

      consulta.tiempoEjecucion = duration;
      await consulta.save();

      console.log(`⚠️ [${source}] Consulta ${job.consultaId} falló (intento ${consulta.intentos}/${maxIntentosConsulta})`);

    } catch (err) {
      console.error('Error manejando job fallido:', err);
    }
  }

  /**
   * Guardar o actualizar persona
   */
  async guardarPersona(datos, usuarioId) {
    try {
      // Buscar si ya existe
      let persona = await Persona.findOne({ documento: datos.documento });

      // Mapear datos electorales al formato del modelo Persona
      const puestoData = {
        departamento: datos.datosElectorales?.departamento,
        municipio: datos.datosElectorales?.municipio,
        nombrePuesto: datos.datosElectorales?.puestoVotacion,
        direccion: datos.datosElectorales?.direccion,
        mesa: datos.datosElectorales?.mesa
      };

      if (persona) {
        // Actualizar datos existentes
        if (datos.nombres) persona.nombres = datos.nombres;
        if (datos.apellidos) persona.apellidos = datos.apellidos;
        persona.puesto = puestoData;
        persona.estadoRPA = 'ACTUALIZADO';
        persona.fechaUltimaConsulta = new Date();
        persona.fechaSiguienteConsulta = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
        persona.intentosConsulta = 0;
        persona.origen = 'RPA_REGISTRADURIA';

      } else {
        // Crear nueva persona
        persona = new Persona({
          documento: datos.documento,
          nombres: datos.nombres || '',
          apellidos: datos.apellidos || '',
          puesto: puestoData,
          estadoRPA: 'ACTUALIZADO',
          fechaUltimaConsulta: new Date(),
          fechaSiguienteConsulta: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          origen: 'RPA_REGISTRADURIA',
          confirmado: false,
          intentosConsulta: 0
        });
      }

      await persona.save();
      console.log(`✅ Persona ${datos.documento} guardada/actualizada`);
      return persona;

    } catch (error) {
      console.error('Error guardando persona:', error);
      throw error;
    }
  }

  /**
   * Detener worker
   */
  async stop() {
    console.log('🛑 Deteniendo RPA Worker...');
    
    this.isRunning = false;
    this.pausePolling();
    
    if (this.pool) {
      await this.pool.shutdown();
    }
    
    console.log('✅ RPA Worker detenido');
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    if (!this.pool) return null;
    return this.pool.getStats();
  }
}

// Singleton
let workerInstance = null;

module.exports = {
  start: async () => {
    if (!workerInstance) {
      workerInstance = new RPAWorker();
    }
    await workerInstance.start();
    return workerInstance;
  },
  
  stop: async () => {
    if (workerInstance) {
      await workerInstance.stop();
      workerInstance = null;
    }
  },
  
  getStats: () => {
    return workerInstance ? workerInstance.getStats() : null;
  }
};