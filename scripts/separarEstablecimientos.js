/**
 * Marca como Caspinchango todo lo que se cargó antes de separar los campos.
 *
 * Producción arrancó con un solo establecimiento, así que los partes, períodos,
 * descuentos, correcciones y precios que ya están son todos de Caspinchango.
 * Este script les pone el campo y rehace los índices únicos, que pasaron a
 * incluir el establecimiento.
 *
 * Sin esto, el índice viejo de períodos —único por (año, mes)— impide que San
 * Pablo tenga el mismo mes que Caspinchango.
 *
 * Es idempotente: solo toca los documentos que todavía no tienen el campo.
 *
 * Uso: npm run separar-establecimientos
 */
import mongoose from "mongoose";
import { POR_DEFECTO } from "../src/models/Establecimiento.js";
import ParteDiario from "../src/models/ParteDiario.js";
import PeriodoCertificado from "../src/models/PeriodoCertificado.js";
import DescuentoPersonal from "../src/models/DescuentoPersonal.js";
import CambioCertificacion from "../src/models/CambioCertificacion.js";
import VariableTarea from "../src/models/VariableTarea.js";

const MODELOS = [
  ["Partes", ParteDiario],
  ["Períodos", PeriodoCertificado],
  ["Descuentos", DescuentoPersonal],
  ["Correcciones", CambioCertificacion],
  ["Precios", VariableTarea],
];

// Los índices que cambiaron de forma. Mongo no reescribe un índice existente:
// hay que borrar el viejo para que se cree el nuevo con el establecimiento.
const INDICES_VIEJOS = [
  [PeriodoCertificado, "anio_1_mes_1"],
  [DescuentoPersonal, "anio_1_mes_1_persona_1"],
  [CambioCertificacion, "anio_1_mes_1_persona_1_tarea_-1_createdAt_-1"],
  [CambioCertificacion, "anio_1_mes_1_persona_1_tarea_1_createdAt_-1"],
  [VariableTarea, "tarea_1_cliente_1_vigenciaDesde_-1"],
  [ParteDiario, "fecha_1_persona_1"],
];

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB\n");

console.log(`Marcando como "${POR_DEFECTO}" lo que no tiene establecimiento:`);
for (const [nombre, Modelo] of MODELOS) {
  const total = await Modelo.countDocuments();
  const res = await Modelo.updateMany(
    { establecimiento: { $exists: false } },
    { $set: { establecimiento: POR_DEFECTO } }
  );
  console.log(`  ${nombre.padEnd(14)} ${String(res.modifiedCount).padStart(4)} de ${total}`);
}

console.log("\nBorrando los índices viejos:");
for (const [Modelo, nombre] of INDICES_VIEJOS) {
  try {
    await Modelo.collection.dropIndex(nombre);
    console.log(`  borrado   ${nombre}`);
  } catch (e) {
    // 27 = IndexNotFound: ya se había borrado en una corrida anterior.
    if (e.code === 27) console.log(`  no estaba ${nombre}`);
    else throw e;
  }
}

console.log("\nCreando los índices nuevos:");
for (const [nombre, Modelo] of MODELOS) {
  await Modelo.syncIndexes();
  console.log(`  ${nombre}`);
}

console.log("\nListo.");
await mongoose.disconnect();
