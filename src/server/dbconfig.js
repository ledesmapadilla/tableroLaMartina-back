import mongoose from "mongoose";
import "colors";

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
