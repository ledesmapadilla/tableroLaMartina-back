// Cuántas idas y vueltas a la base cuesta guardar un parte. Es la medida que
// importa: cada una son ~100/200 ms contra el cluster, y el número no depende
// de cómo esté la red. Llama al controller directo, con un req/res de mentira.
import mongoose from "mongoose";
import Tarea from "../src/models/Tarea.js";
import Personal from "../src/models/Personal.js";
import CentroCosto from "../src/models/CentroCosto.js";
import ParteDiario from "../src/models/ParteDiario.js";
import "../src/models/Tractor.js";
import { create, update, remove } from "../src/controllers/partes.controller.js";

await mongoose.connect(process.env.MONGODB, { monitorCommands: true });

const comandos = [];
mongoose.connection.getClient().on("commandStarted", (e) => {
  if (!["ismaster", "hello", "ping", "endSessions"].includes(e.commandName)) {
    comandos.push(`${e.commandName} ${e.command[e.commandName]}`);
  }
});

const persona = await Personal.findOne().lean();
const herbicida = await Tarea.findOne({ tarea: "Herbicida" }).lean();
const porHoras = await Tarea.findOne({ unidad: "Horas" }).lean();
const centro = await CentroCosto.findOne({ tractor: { $ne: null } }).lean();
const creados = [];

const llamar = (controlador, body, params = {}) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(cuerpo) {
        resolve({ status: this.statusCode, cuerpo });
      },
    };
    controlador({ body, params, query: {} }, res);
  });

const contar = async (titulo, hacer) => {
  comandos.length = 0;
  const r = await hacer();
  console.log(`${titulo.padEnd(40)} ${String(comandos.length).padStart(2)} consultas`);
  comandos.forEach((c) => console.log(`     ${c}`));
  return r;
};

const cuerpoDe = (establecimiento, tarea, lote, cantidad, cc) => ({
  establecimiento,
  fecha: "2026-09-18",
  persona: String(persona._id),
  cc: cc ? String(cc) : "",
  tarea: String(tarea._id),
  lote,
  cantidad,
  horaIngreso: "08:00",
  horaEgreso: "12:00",
});

let r = await contar("Caspinchango, con CC", () =>
  llamar(create, cuerpoDe("caspinchango", porHoras, "11", 5, centro._id))
);
creados.push(r.cuerpo._id);

r = await contar("San Pablo, herbicida con lote y CC", () =>
  llamar(create, cuerpoDe("san-pablo", herbicida, "ZZ contar", "", centro._id))
);
creados.push(r.cuerpo._id);
const idSanPablo = r.cuerpo._id;

await contar("San Pablo, editar ese parte", () =>
  llamar(update, cuerpoDe("san-pablo", herbicida, "ZZ contar", "", centro._id), { id: idSanPablo })
);

await contar("San Pablo, borrarlo", () => llamar(remove, {}, { id: idSanPablo }));

for (const id of creados) await ParteDiario.deleteOne({ _id: id });
console.log("\npartes de prueba que quedaron:", await ParteDiario.countDocuments({ lote: "ZZ contar" }));
await mongoose.disconnect();
