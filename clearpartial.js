import mongoose from "mongoose";
import CheckList from "./src/models/CheckList.js";
import ProgramaCheckList from "./src/models/ProgramaCheckList.js";
import Kilometro from "./src/models/Kilometro.js";

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const r1 = await Kilometro.deleteMany({});
console.log(`Kilómetros: ${r1.deletedCount} documentos eliminados`);

const r2 = await CheckList.deleteMany({});
console.log(`CheckLists: ${r2.deletedCount} documentos eliminados`);

const r3 = await ProgramaCheckList.deleteMany({});
console.log(`ProgramaCheckLists: ${r3.deletedCount} documentos eliminados`);

console.log("\nListo.");
await mongoose.disconnect();
