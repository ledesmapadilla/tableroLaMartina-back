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
    this.app.use(express.json());
    this.app.use(morgan("dev"));

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
    this.app.listen(this.port, () =>
      console.info(
        `EL SERVIDOR SE ESTA EJECUTANDO EN: http://localhost:${this.port}`.blue,
      ),
    );
  }
}
