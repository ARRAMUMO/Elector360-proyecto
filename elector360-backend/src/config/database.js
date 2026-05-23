const dns = require('dns');
const mongoose = require('mongoose');

// El DNS local no resuelve registros SRV de MongoDB Atlas; forzar Google DNS
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Opciones recomendadas (mongoose 6+)
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;