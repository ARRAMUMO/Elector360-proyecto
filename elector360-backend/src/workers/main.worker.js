// src/workers/main.worker.js

const mongoose = require('mongoose');
const WorkerPool = require('./pool/worker-pool');
const ConsultaRPA = require('../models/consultaRPA.model');
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
   */
  async poll() {
    if (!this.isRunning) return;
    
    try {
      // Buscar consultas EN_COLA
      const consultas = await ConsultaRPA.find({
        estado: 'EN_COLA'
      })
      .sort({ prioridad: -1, createdAt: 1 })
      .limit(10);
      
      if (consultas.length > 0) {
        console.log(`📋 ${consultas.length} consultas pendientes en cola`);
        
        // Procesar cada consulta
        for (const consulta of consultas) {
          // Marcar como PROCESANDO
          consulta.estado = 'PROCESANDO';
          consulta.intentos = (consulta.intentos || 0) + 1;
          await consulta.save();
          
          // Agregar al pool (no await para procesar en paralelo)
          this.pool.processJob({
            consultaId: consulta._id,
            documento: consulta.documento
          }).catch(error => {
            console.error(`Error procesando consulta ${consulta._id}:`, error);
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error en poll:', error);
    }
    
    // Programar siguiente poll
    this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
  }

  /**
   * Manejar job completado
   */
  async handleJobCompleted(job, result, duration) {
    try {
      const consulta = await ConsultaRPA.findById(job.consultaId);
      if (!consulta) return;
      
      if (result.success) {
        // Guardar o actualizar persona
        const persona = await this.guardarPersona(result.datos, consulta.usuario);
        
        // Actualizar consulta
        consulta.estado = 'COMPLETADO';
        consulta.datosPersona = result.datos;
        consulta.persona = persona._id;
        consulta.completadoEn = new Date();
        consulta.tiempoEjecucion = duration;
        consulta.costo = 0.003; // Costo estimado por consulta
        await consulta.save();
        
        console.log(`✅ Consulta ${job.consultaId} completada en ${duration}ms`);
        
      } else {
        // Marcar como error
        consulta.estado = 'ERROR';
        consulta.error = result.error;
        consulta.completadoEn = new Date();
        consulta.tiempoEjecucion = duration;
        await consulta.save();
        
        console.log(`❌ Consulta ${job.consultaId} falló: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error guardando resultado:', error);
    }
  }

  /**
   * Manejar job fallido
   */
  async handleJobFailed(job, error, duration) {
    try {
      const consulta = await ConsultaRPA.findById(job.consultaId);
      if (!consulta) return;
      
      // Si supera el máximo de intentos, marcar como ERROR
      if (consulta.intentos >= config.retries.maxAttempts) {
        consulta.estado = 'ERROR';
        consulta.error = `Máximo de intentos alcanzado: ${error.message}`;
        consulta.completadoEn = new Date();
      } else {
        // Volver a EN_COLA para reintentar
        consulta.estado = 'EN_COLA';
        consulta.error = error.message;
      }
      
      consulta.tiempoEjecucion = duration;
      await consulta.save();
      
      console.log(`⚠️ Consulta ${job.consultaId} falló (intento ${consulta.intentos}/${config.retries.maxAttempts})`);
      
    } catch (error) {
      console.error('Error manejando job fallido:', error);
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