import dns from "node:dns";
import mongoose from "mongoose";
import "colors";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (e) {
  console.warn("No se pudieron configurar servidores DNS personalizados:", e.message);
}

mongoose
  .connect(process.env.MONGODB, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.info(
      `Base de datos ${mongoose.connection.name.green} conectada exitosamente`,
    );
  })
  .catch((error) => {
    console.error(`Error al conectar con MongoDB:`.red, error.message);
  });

export default mongoose;
