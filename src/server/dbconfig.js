import mongoose from "mongoose";
import "colors";

try {
  mongoose.connect(process.env.MONGODB).then(() => {
    console.info(
      `Base de datos ${mongoose.connection.name.green} conectada exitosamente`,
    );
  });
} catch (error) {
  console.error(error);
}

export default mongoose;
