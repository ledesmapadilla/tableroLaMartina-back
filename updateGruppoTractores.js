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

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const tractores = await Tractor.find();
let actualizados = 0;

for (const t of tractores) {
  const gruppo = resolverGruppo(t.supervisor);
  await Tractor.findByIdAndUpdate(t._id, { gruppo });
  console.log(`  CC ${t.cc} — ${t.supervisor || "(sin supervisor)"} → Grupo ${gruppo === 6 ? "Sin dueño" : gruppo}`);
  actualizados++;
}

console.log(`\nListo: ${actualizados} tractores actualizados.`);
await mongoose.disconnect();
