import express from "express";
import cors from "cors";
import morgan from "morgan";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./dbconfig.js";
import "colors";

export default class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.middleware();
  }

  middleware() {
    this.app.use(cors());
    // 4 MB y no los 100 kB de fábrica (05/11/2026): la tabla de Contable llega
    // entera, con todas las filas del Excel del mes. Vercel corta en 4,5 MB.
    this.app.use(express.json({ limit: "4mb" }));
    // morgan escribe una linea por request; en serverless eso es I/O de log
    // en el camino critico de cada invocacion.
    if (process.env.NODE_ENV !== "production") {
      this.app.use(morgan("dev"));
    }

    this.app.use(async (req, res, next) => {
      try {
        await connectDB();
        next();
      } catch (error) {
        console.error("Error conectando a la base de datos:", error.message);
        res.status(500).json({ error: "Error conectando a la base de datos: " + error.message });
      }
    });

    const __dirname = dirname(fileURLToPath(import.meta.url));

    this.app.use(express.static(__dirname + "/../../public"));
  }

  listen() {
    // En Vercel el runtime invoca el handler exportado: abrir un listener
    // propio solo agrega trabajo al arranque en frio.
    if (process.env.VERCEL) return;

    this.app.listen(this.port, () =>
      console.info(
        `EL SERVIDOR SE ESTA EJECUTANDO EN: http://localhost:${this.port}`.blue,
      ),
    );
  }
}
