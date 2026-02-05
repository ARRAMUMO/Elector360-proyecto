// src/workers/pool/worker-pool.js

const EventEmitter = require('events');
const RegistraduriaScrap = require('../scrapers/registraduria.scraper');
const CircuitBreaker = require('../utils/circuit-breaker');
const config = require('../config/worker.config');

class WorkerPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.minWorkers = options.minWorkers || config.pool.minWorkers;
    this.maxWorkers = options.maxWorkers || config.pool.maxWorkers;
    this.maxConcurrent = options.maxConcurrent || config.pool.maxConcurrent;
    
    this.workers = [];
    this.queue = [];
    this.activeJobs = 0;
    this.isShuttingDown = false;
    
    // Circuit breaker
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    
    // Estadísticas
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      inQueue: 0,
      activeWorkers: 0,
      startTime: Date.now()
    };
    
    // Escuchar eventos del circuit breaker
    this.setupCircuitBreakerListeners();
  }

  /**
   * Configurar listeners del circuit breaker
   */
  setupCircuitBreakerListeners() {
    this.circuitBreaker.on('open', () => {
      console.log('⚠️ Circuit Breaker ABIERTO - Pausando workers');
      this.emit('circuit-breaker-open');
    });
    
    this.circuitBreaker.on('closed', () => {
      console.log('✅ Circuit Breaker CERRADO - Reanudando workers');
      this.emit('circuit-breaker-closed');
    });
    
    this.circuitBreaker.on('half-open', () => {
      console.log('🔄 Circuit Breaker MEDIO ABIERTO - Probando recuperación');
      this.emit('circuit-breaker-half-open');
    });
  }

  /**
   * Inicializar pool con workers mínimos
   */
  async init() {
    console.log(`🚀 Inicializando pool con ${this.minWorkers} workers...`);
    
    for (let i = 0; i < this.minWorkers; i++) {
      await this.addWorker();
    }
    
    console.log(`✅ Pool inicializado con ${this.workers.length} workers`);
  }

  /**
   * Agregar un worker al pool
   */
  async addWorker() {
    if (this.workers.length >= this.maxWorkers) {
      console.log('⚠️ Máximo de workers alcanzado');
      return null;
    }
    
    try {
      const worker = new RegistraduriaScrap();
      await worker.init();
      
      const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.workers.push({
        id: workerId,
        instance: worker,
        busy: false,
        jobsProcessed: 0,
        errors: 0,
        createdAt: Date.now()
      });
      
      this.stats.activeWorkers = this.workers.length;
      
      console.log(`✅ Worker ${workerId} agregado (Total: ${this.workers.length})`);
      this.emit('worker-added', workerId);
      
      return workerId;
    } catch (error) {
      console.error('❌ Error agregando worker:', error);
      return null;
    }
  }

  /**
   * Remover un worker del pool
   */
  async removeWorker(workerId) {
    const index = this.workers.findIndex(w => w.id === workerId);
    if (index === -1) return;
    
    const worker = this.workers[index];
    
    if (worker.busy) {
      console.log(`⚠️ Worker ${workerId} está ocupado, esperando...`);
      return;
    }
    
    try {
      await worker.instance.close();
      this.workers.splice(index, 1);
      this.stats.activeWorkers = this.workers.length;
      
      console.log(`✅ Worker ${workerId} removido (Total: ${this.workers.length})`);
      this.emit('worker-removed', workerId);
    } catch (error) {
      console.error(`❌ Error removiendo worker ${workerId}:`, error);
    }
  }

  /**
   * Procesar job
   */
  async processJob(job) {
    return new Promise((resolve, reject) => {
      // Verificar circuit breaker
      if (!this.circuitBreaker.isAvailable()) {
        reject(new Error('Circuit breaker is OPEN'));
        return;
      }
      
      // Agregar a la cola
      this.queue.push({
        job,
        resolve,
        reject,
        addedAt: Date.now()
      });
      
      this.stats.inQueue = this.queue.length;
      this.emit('job-queued', job);
      
      // Intentar procesar inmediatamente
      this.processQueue();
    });
  }

  /**
   * Procesar cola de jobs
   */
  async processQueue() {
    // Si está cerrando, no procesar más
    if (this.isShuttingDown) return;
    
    // Si no hay jobs, no hacer nada
    if (this.queue.length === 0) return;
    
    // Si ya hay demasiados jobs activos, esperar
    if (this.activeJobs >= this.maxConcurrent) return;
    
    // Buscar worker disponible
    const availableWorker = this.workers.find(w => !w.busy);
    
    if (!availableWorker) {
      // Intentar agregar worker si hay capacidad
      if (this.workers.length < this.maxWorkers) {
        await this.addWorker();
        // Reintentar procesar
        this.processQueue();
      }
      return;
    }
    
    // Tomar el primer job de la cola
    const queueItem = this.queue.shift();
    this.stats.inQueue = this.queue.length;
    
    // Marcar worker como ocupado
    availableWorker.busy = true;
    this.activeJobs++;
    
    // Ejecutar job
    this.executeJob(availableWorker, queueItem);
    
    // Continuar procesando la cola
    setImmediate(() => this.processQueue());
  }

  /**
   * Ejecutar job en worker
   */
  async executeJob(worker, queueItem) {
    const { job, resolve, reject } = queueItem;
    const startTime = Date.now();
    
    try {
      console.log(`▶️ Ejecutando job: ${job.documento} en ${worker.id}`);
      this.emit('job-started', { workerId: worker.id, job });
      
      // Ejecutar con circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        return await worker.instance.consultarPersona(job.documento);
      });
      
      const duration = Date.now() - startTime;
      
      // Actualizar estadísticas
      worker.jobsProcessed++;
      this.stats.totalProcessed++;
      
      if (result.success) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
        worker.errors++;
      }
      
      console.log(`✅ Job completado: ${job.documento} en ${duration}ms`);
      this.emit('job-completed', { workerId: worker.id, job, result, duration });
      
      resolve(result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      worker.errors++;
      this.stats.failed++;
      this.stats.totalProcessed++;
      
      console.error(`❌ Job falló: ${job.documento} - ${error.message}`);
      this.emit('job-failed', { workerId: worker.id, job, error, duration });
      
      reject(error);
      
      // Si el worker tiene demasiados errores, reiniciarlo
      if (worker.errors >= 3) {
        console.log(`⚠️ Worker ${worker.id} con demasiados errores, reiniciando...`);
        this.restartWorker(worker.id);
      }
      
    } finally {
      // Liberar worker
      worker.busy = false;
      this.activeJobs--;
      
      // Continuar procesando
      this.processQueue();
    }
  }

  /**
   * Reiniciar worker
   */
  async restartWorker(workerId) {
    try {
      await this.removeWorker(workerId);
      await this.addWorker();
    } catch (error) {
      console.error(`❌ Error reiniciando worker ${workerId}:`, error);
    }
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const averageTime = this.stats.totalProcessed > 0 
      ? uptime / this.stats.totalProcessed 
      : 0;
    
    return {
      ...this.stats,
      uptime,
      averageTime,
      successRate: this.stats.totalProcessed > 0 
        ? (this.stats.successful / this.stats.totalProcessed * 100).toFixed(2) + '%'
        : '0%',
      circuitBreaker: this.circuitBreaker.getState()
    };
  }

  /**
   * Cerrar pool
   */
  async shutdown() {
    console.log('🛑 Cerrando pool de workers...');
    this.isShuttingDown = true;
    
    // Esperar a que terminen los jobs activos
    while (this.activeJobs > 0) {
      console.log(`⏳ Esperando ${this.activeJobs} jobs activos...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Cerrar todos los workers
    for (const worker of this.workers) {
      await worker.instance.close();
    }
    
    this.workers = [];
    this.stats.activeWorkers = 0;
    
    console.log('✅ Pool cerrado');
    this.emit('shutdown');
  }
}

module.exports = WorkerPool;