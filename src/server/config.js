import express from "express";
import cors from "cors";
import morgan from "morgan";
import { dirname } from "path";
import { fileURLToPath } from "url";
import "./dbConfig.js";
import "colors";

export default class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.middleware();
  }

  middleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(morgan("dev"));

    const __dirname = dirname(fileURLToPath(import.meta.url));

    console.log(__dirname + "/../../public");

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
