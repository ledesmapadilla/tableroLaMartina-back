import mongoose from "mongoose";
import Colectivo from "./src/models/Colectivo.js";

// Listado colectivos La Martina (PDF). Las columnas "Vehiculo" y
// "Observaciones" del listado no se cargan.
const SUPERVISOR = "Humberto Alderete";

const datos = [
  { cc: "263", patente: "FYF 939" },
  { cc: "256", patente: "EQB 118" },
  { cc: "273", patente: "HIG 882" },
  { cc: "275", patente: "JCU 415" },
  { cc: "280", patente: "ISM 637" },
  { cc: "278", patente: "IYD 469" },
  { cc: "257", patente: "EPM 608" },
  { cc: "271", patente: "HLJ 889" },
  { cc: "264", patente: "EIW 252" },
  { cc: "281", patente: "ITS 353" },
  { cc: "282", patente: "FVT 300" },
  { cc: "276", patente: "JCU 419" },
  { cc: "272", patente: "HFF 720" },
  { cc: "268", patente: "EWE 315" },
  { cc: "279", patente: "IUG 113" },
  { cc: "250", patente: "EQA 367" },
  { cc: "258", patente: "EOO 472" },
  { cc: "252", patente: "EJO 008" },
  { cc: "277", patente: "IWB 242" },
  { cc: "254", patente: "EQB 127" },
  { cc: "266", patente: "FBN 948" },
  { cc: "260", patente: "EIY 007" },
  { cc: "267", patente: "FHD 974" },
  { cc: "259", patente: "EOO 471" },
  { cc: "283", patente: "FWN 856" },
];

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

await Colectivo.deleteMany({});
console.log("Colección limpiada");

const docs = datos.map((d) => ({ ...d, supervisor: SUPERVISOR }));
await Colectivo.insertMany(docs);

console.log(`\nListo: ${docs.length} colectivos insertados.`);
docs.forEach((d) => console.log(`  ✓ CC ${d.cc} — ${d.patente} — ${d.supervisor}`));

await mongoose.disconnect();
