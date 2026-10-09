/**
 * Copia Manitous › General a cada Manitou (09/10/2026): desde ahora General
 * es la plantilla, y cada ítem y repuesto de ahí tiene su copia en cada
 * Manitou, de la 1100 a la 1104 (ver catalogos/manitous.js).
 *
 * Usa la misma réplica que la pantalla, así que no duplica: se puede correr
 * las veces que haga falta. Además pasa a la Manitou lo que se había mandado
 * a cotizar desde General: cada presupuesto va a la copia del repuesto en la
 * Manitou de su C.C.
 *
 * El OK y los problemas que tenga General no se copian: quedan guardados
 * en General, que ya no los muestra.
 *
 * Uso: node --env-file .env scripts/copiarManitouGeneral.js [--aplicar]
 * Sin --aplicar solo cuenta lo que haría.
 */
import mongoose from "mongoose";
import ChequeoSanPablo from "../src/models/ChequeoSanPablo.js";
import PresupuestoReparacion from "../src/models/PresupuestoReparacion.js";
import { replicar } from "../src/controllers/chequeossanpablo.controller.js";
import { SECCION_GENERAL, UNIDADES_MANITOU, seccionDeUnidad } from "../src/catalogos/manitous.js";

const aplicar = process.argv.includes("--aplicar");

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const generales = await ChequeoSanPablo.find({ seccion: SECCION_GENERAL }).sort({ createdAt: 1 });
const repuestos = generales.reduce((n, f) => n + f.repuestos.length, 0);
const yaCopiadas = await ChequeoSanPablo.countDocuments({ origen: { $in: generales.map((f) => f._id) } });
console.log(`General: ${generales.length} ítems y ${repuestos} repuestos; copias que ya existen: ${yaCopiadas}`);
console.log(`Van a quedar ${generales.length * UNIDADES_MANITOU.length} filas en las ${UNIDADES_MANITOU.length} Manitou`);

const presupuestos = await PresupuestoReparacion.find({ chequeo: { $in: generales.map((f) => f._id) } });
console.log(`Presupuestos mandados desde General: ${presupuestos.length}`);

if (!aplicar) {
  console.log("\nNo se cambió nada. Para hacerlo: --aplicar");
  await mongoose.disconnect();
  process.exit(0);
}

// En orden de carga, así las copias quedan en el mismo orden que General.
for (const general of generales) await replicar(general);
console.log("Ítems y repuestos copiados");

let movidos = 0;
for (const p of presupuestos) {
  if (!UNIDADES_MANITOU.includes(p.cc)) {
    console.log(`  Presupuesto ${p.nro}: el C.C. ${p.cc} no es de una Manitou, queda como está`);
    continue;
  }
  const copia = await ChequeoSanPablo.findOne({ origen: p.chequeo, seccion: seccionDeUnidad(p.cc) });
  const repuesto = copia?.repuestos.find((r) => String(r.origen) === String(p.repuesto));
  if (!repuesto) {
    console.log(`  Presupuesto ${p.nro}: no se encontró la copia del repuesto, queda como está`);
    continue;
  }
  p.chequeo = copia._id;
  p.repuesto = repuesto._id;
  await p.save();
  movidos++;
}
console.log(`Presupuestos pasados a su Manitou: ${movidos} de ${presupuestos.length}`);

await mongoose.disconnect();
