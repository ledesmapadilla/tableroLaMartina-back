import mongoose from "mongoose";
import "colors";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(process.env.MONGODB, opts).then((m) => {
      console.info(
        `Base de datos ${m.connection.name?.green || "MongoDB"} conectada exitosamente`,
      );
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Iniciar intento de conexión de inmediato
if (process.env.MONGODB) {
  connectDB().catch((err) => {
    console.error("Error al conectar con MongoDB:".red, err.message);
  });
}

export default mongoose;
