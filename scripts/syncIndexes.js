// Crea/actualiza los indices de todos los modelos.
// Necesario porque en produccion la conexion usa autoIndex: false para no
// pagar el costo de createIndexes en cada arranque en frio del serverless.
//
//   node --env-file .env scripts/syncIndexes.js
import mongoose from "mongoose";

// Importar el barril de rutas registra todos los modelos via los controllers.
import "../src/routes/index.routes.js";

const uri = process.env.MONGODB;
if (!uri) {
  console.error("Falta la variable de entorno MONGODB");
  process.exit(1);
}

await mongoose.connect(uri, { autoIndex: false });

for (const nombre of mongoose.modelNames()) {
  const modelo = mongoose.model(nombre);
  const resultado = await modelo.syncIndexes();
  console.info(`${nombre}: ${resultado.length ? resultado.join(", ") : "sin cambios"}`);
}

await mongoose.disconnect();
console.info("Indices sincronizados");
