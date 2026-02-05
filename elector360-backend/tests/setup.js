const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const path = require('path');

// Cargar variables de entorno de test
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });

let mongoServer;

beforeAll(async () => {
  // Crear servidor MongoDB en memoria
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Conectar Mongoose al servidor en memoria
  await mongoose.connect(mongoUri);

  console.log('✅ MongoDB Memory Server started');
});

afterAll(async () => {
  // Cerrar conexión y detener servidor
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log('✅ MongoDB Memory Server stopped');
});

// Limpiar todas las colecciones después de cada test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
