// test-worker.js

require('dotenv').config();
const mongoose = require('mongoose');
const rpaWorker = require('./src/workers/main.worker');

async function test() {
  try {
    // Conectar DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');
    
    // Iniciar worker
    await rpaWorker.start();
    
    // Esperar 60 segundos y mostrar stats
    setTimeout(() => {
      const stats = rpaWorker.getStats();
      console.log('📊 Estadísticas:', JSON.stringify(stats, null, 2));
    }, 60000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();