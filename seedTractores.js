import mongoose from "mongoose";
import Tractor from "./src/models/Tractor.js";

const GRUPOS = [
  { gruppo: 1, supervisores: ["jorge rosas"] },
  { gruppo: 2, supervisores: ["mario bustos"] },
  { gruppo: 3, supervisores: ["carlos chumiento"] },
  { gruppo: 4, supervisores: ["brandan alejandro", "alejandro brandan"] },
  { gruppo: 5, supervisores: ["elio rojas"] },
];

function resolverGruppo(supervisor) {
  if (!supervisor) return 6;
  const s = supervisor.toLowerCase().trim();
  for (const g of GRUPOS) {
    if (g.supervisores.includes(s)) return g.gruppo;
  }
  return 6;
}

const datos = [
  { cc: "189",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "197",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "158",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "195",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "102",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "1103", descripcion: "manitou",                    supervisor: "Jorge Rosas" },
  { cc: "110",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "196",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "184",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "164",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "194",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "103",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "1102", descripcion: "manitou",                    supervisor: "Mario Bustos" },
  { cc: "166",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "155",  descripcion: "tractor",                    supervisor: "Carlos Chumiento" },
  { cc: "185",  descripcion: "tractor",                    supervisor: "Carlos Chumiento" },
  { cc: "161",  descripcion: "tractor",                    supervisor: "brandan alejandro" },
  { cc: "165",  descripcion: "tractor",                    supervisor: "brandan alejandro" },
  { cc: "1104", descripcion: "manitou",                    supervisor: "brandan alejandro" },
  { cc: "193",  descripcion: "tractor",                    supervisor: "Elio Rojas" },
  { cc: "156",  descripcion: "tractor",                    supervisor: "Elio Rojas" },
  { cc: "167",  descripcion: "tractor",                    supervisor: "Elio Rojas" },
  { cc: "104",  descripcion: "Deutz 460",                  supervisor: "BERDINA" },
  { cc: "111",  descripcion: "Massey 251",                 supervisor: "SP" },
  { cc: "150",  descripcion: "VALTRA BF 75",               supervisor: "SP" },
  { cc: "151",  descripcion: "VALTRA BF 75",               supervisor: "BERDINA" },
  { cc: "153",  descripcion: "Valtra 75",                  supervisor: "BERDINA" },
  { cc: "154",  descripcion: "Valtra 75",                  supervisor: "BERDINA" },
  { cc: "157",  descripcion: "Case Farmal 75A DT",         supervisor: "SP" },
  { cc: "159",  descripcion: "JOHN DEERE 5065E TS",        supervisor: "BERDINA" },
  { cc: "160",  descripcion: "JOHN DEERE 5065E TS",        supervisor: "BERDINA" },
  { cc: "163",  descripcion: "Case 55",                    supervisor: "SP" },
  { cc: "170",  descripcion: "JOHN DEERE 5410",            supervisor: "BERDINA" },
  { cc: "171",  descripcion: "JOHN DEERE 5410",            supervisor: "BERDINA" },
  { cc: "174",  descripcion: "JOHN DEERE 5310",            supervisor: "SP" },
  { cc: "179",  descripcion: "JOHN DEERE 5310",            supervisor: "SP" },
  { cc: "183",  descripcion: "Massey Ferguson 2625 dt",    supervisor: "ALBERDI" },
  { cc: "186",  descripcion: "Massey Ferguson 2625",       supervisor: "BERDINA" },
  { cc: "187",  descripcion: "Case Farmal 75A",            supervisor: "BERDINA" },
  { cc: "188",  descripcion: "Case Farmal 75A",            supervisor: "SP" },
  { cc: "191",  descripcion: "John Deere 5065E",           supervisor: "BERDINA" },
  { cc: "192",  descripcion: "John Deere 5065E",           supervisor: "BERDINA" },
  { cc: "198",  descripcion: "CHERRY 58 RC",               supervisor: "SP" },
];

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

await Tractor.deleteMany({});
console.log("Colección limpiada");

const docs = datos.map(d => ({ ...d, gruppo: resolverGruppo(d.supervisor) }));
await Tractor.insertMany(docs);

console.log(`\nListo: ${docs.length} tractores insertados.`);
docs.forEach(d => console.log(`  ✓ CC ${d.cc} — ${d.supervisor} → Grupo ${d.gruppo === 6 ? "Sin dueño" : d.gruppo}`));

await mongoose.disconnect();
