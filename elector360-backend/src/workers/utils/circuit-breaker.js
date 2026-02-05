// src/workers/utils/circuit-breaker.js

const EventEmitter = require('events');

/**
 * Circuit Breaker para proteger el sistema de fallos en cascada
 * 
 * Estados:
 * - CLOSED: Normal, permite requests
 * - OPEN: Demasiados errores, rechaza requests
 * - HALF_OPEN: Probando si el servicio se recuperó
 */
class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000;
    this.resetTimeout = options.resetTimeout || 300000;
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0
    };
  }

  /**
   * Ejecutar función con circuit breaker
   */
  async execute(fn) {
    this.stats.totalRequests++;
    
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedRequests++;
        this.emit('rejected');
        throw new Error('Circuit breaker is OPEN');
      }
      
      // Intentar medio abierto
      this.state = 'HALF_OPEN';
      this.emit('half-open');
    }
    
    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Ejecutar con timeout
   */
  async executeWithTimeout(fn) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Circuit breaker timeout')), this.timeout)
      )
    ]);
  }

  /**
   * Manejar éxito
   */
  onSuccess() {
    this.failureCount = 0;
    this.stats.successfulRequests++;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        this.emit('closed');
        console.log('✅ Circuit Breaker: CLOSED (recuperado)');
      }
    }
  }

  /**
   * Manejar fallo
   */
  onFailure() {
    this.failureCount++;
    this.stats.failedRequests++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.successCount = 0;
      this.emit('open');
      console.log('❌ Circuit Breaker: OPEN (fallo en half-open)');
    }
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.emit('open');
      console.log(`❌ Circuit Breaker: OPEN (${this.failureCount} fallos consecutivos)`);
    }
  }

  /**
   * Resetear manualmente
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.emit('reset');
    console.log('🔄 Circuit Breaker: RESET manual');
  }

  /**
   * Obtener estado actual
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      stats: this.stats
    };
  }

  /**
   * Verificar si está disponible
   */
  isAvailable() {
    return this.state !== 'OPEN' || Date.now() >= this.nextAttempt;
  }
}

module.exports = CircuitBreaker;