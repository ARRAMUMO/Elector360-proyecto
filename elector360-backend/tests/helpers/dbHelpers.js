const mongoose = require('mongoose');

/**
 * Limpiar toda la base de datos
 */
async function clearDatabase() {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Limpiar una colección específica
 */
async function clearCollection(collectionName) {
  if (mongoose.connection.collections[collectionName]) {
    await mongoose.connection.collections[collectionName].deleteMany({});
  }
}

/**
 * Obtener conteo de documentos en una colección
 */
async function getCollectionCount(collectionName) {
  if (mongoose.connection.collections[collectionName]) {
    return await mongoose.connection.collections[collectionName].countDocuments();
  }
  return 0;
}

/**
 * Verificar si una colección existe
 */
function collectionExists(collectionName) {
  return !!mongoose.connection.collections[collectionName];
}

module.exports = {
  clearDatabase,
  clearCollection,
  getCollectionCount,
  collectionExists
};
