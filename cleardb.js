import mongoose from "mongoose";
import Camioneta from "./src/models/Camioneta.js";
import Tractor from "./src/models/Tractor.js";
import Reparacion from "./src/models/Reparacion.js";
import CheckList from "./src/models/CheckList.js";
import ProgramaCheckList from "./src/models/ProgramaCheckList.js";
import Kilometro from "./src/models/Kilometro.js";
import Service from "./src/models/Service.js";

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const colecciones = [
  { nombre: "Camionetas",        model: Camioneta },
  { nombre: "Tractores",         model: Tractor },
  { nombre: "Reparaciones",      model: Reparacion },
  { nombre: "CheckLists",        model: CheckList },
  { nombre: "ProgramaCheckLists",model: ProgramaCheckList },
  { nombre: "Kilómetros",        model: Kilometro },
  { nombre: "Services",          model: Service },
];

for (const col of colecciones) {
  const result = await col.model.deleteMany({});
  console.log(`  ${col.nombre}: ${result.deletedCount} documentos eliminados`);
}

console.log("\nBase de datos limpia.");
await mongoose.disconnect();
