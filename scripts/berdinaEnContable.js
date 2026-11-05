/**
 * Cambia Caspinchango (y lo parecido: abreviado, mal escrito, con acentos)
 * por Berdina en las tablas de Contable ya guardadas (05/11/2026). Las que se
 * arman desde ahora ya lo hacen solas al guardar (contable.controller.js).
 *
 * Sin --aplicar solo muestra lo que cambiaría. Toca únicamente los textos que
 * cambian, fila por fila y por _id.
 *
 *   npm run berdina-contable             # ver
 *   npm run berdina-contable -- --aplicar
 */
import mongoose from "mongoose";
import FilaContable, { CAMPOS_FILA } from "../src/models/FilaContable.js";
import { conBerdina } from "../src/catalogos/nombreBerdina.js";

const aplicar = process.argv.includes("--aplicar");
const TEXTOS = CAMPOS_FILA.filter((c) => !["fecha", "cantidad", "precioUnitario", "subtotal"].includes(c));

await mongoose.connect(process.env.MONGODB);
const filas = await FilaContable.find({}).lean();

const cambios = [];
const vistos = new Map();
for (const f of filas) {
  const set = {};
  for (const campo of TEXTOS) {
    const antes = f[campo];
    if (typeof antes !== "string") continue;
    const despues = conBerdina(antes);
    if (despues !== antes) {
      set[campo] = despues;
      vistos.set(`${campo}: ${antes}`, despues);
    }
  }
  if (Object.keys(set).length) cambios.push({ updateOne: { filter: { _id: f._id }, update: { $set: set } } });
}

for (const [antes, despues] of vistos) console.log(`${antes}  →  ${despues}`);
console.log(`\n${cambios.length} de ${filas.length} filas cambian.`);

if (aplicar && cambios.length) {
  const r = await FilaContable.bulkWrite(cambios);
  console.log(`Aplicado: ${r.modifiedCount} filas modificadas.`);
} else if (!aplicar) {
  console.log("No se aplicó nada (falta --aplicar).");
}

await mongoose.disconnect();
