/**
 * Copia los precios de un establecimiento a otro.
 *
 * San Pablo arranca con la misma lista de valores que Caspinchango; desde ahí
 * cada campo sigue su camino, porque los precios son por establecimiento.
 *
 * Copia el precio con su vigencia y su fecha de carga, así el historial del
 * destino queda igual al del origen.
 *
 * Es idempotente: no copia la carga que el destino ya tenga (misma tarea,
 * cliente y vigencia), así que se puede correr de nuevo sin duplicar nada.
 *
 * Uso: npm run copiar-variables [origen] [destino]
 * Sin argumentos: de caspinchango a san-pablo.
 */
import mongoose from "mongoose";
import VariableTarea from "../src/models/VariableTarea.js";
import { CLAVES } from "../src/models/Establecimiento.js";

const origen = process.argv[2] || "caspinchango";
const destino = process.argv[3] || "san-pablo";

for (const [rol, clave] of [["origen", origen], ["destino", destino]]) {
  if (!CLAVES.includes(clave)) {
    console.error(`El ${rol} "${clave}" no es un establecimiento. Son: ${CLAVES.join(", ")}`);
    process.exit(1);
  }
}
if (origen === destino) {
  console.error("El origen y el destino son el mismo.");
  process.exit(1);
}

// Qué hace única a una carga dentro de un establecimiento.
const huella = (v) =>
  [String(v.tarea), (v.cliente || "").trim().toLowerCase(), v.vigenciaDesde?.toISOString()].join("|");

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB\n");

const aCopiar = await VariableTarea.find({ establecimiento: origen }).lean();
const yaEstan = new Set(
  (await VariableTarea.find({ establecimiento: destino }).lean()).map(huella)
);

const nuevos = aCopiar.filter((v) => !yaEstan.has(huella(v))).map((v) => {
  // Sin _id ni timestamps: son documentos nuevos del destino.
  const { _id, createdAt, updatedAt, __v, ...resto } = v;
  return { ...resto, establecimiento: destino };
});

console.log(`Precios en ${origen}: ${aCopiar.length}`);
console.log(`Ya estaban en ${destino}: ${aCopiar.length - nuevos.length}`);

if (nuevos.length === 0) {
  console.log("\nNo hay nada que copiar.");
} else {
  await VariableTarea.insertMany(nuevos);
  console.log(`\nCopiados a ${destino}: ${nuevos.length}`);
}

console.log(`Total en ${destino}: ${await VariableTarea.countDocuments({ establecimiento: destino })}`);

await mongoose.disconnect();
