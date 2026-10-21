// Copia a Manitous › General los pesos de las tareas cargados en la Manitou
// 1103 (21/10/2026), y de General a las otras Manitou, como la réplica.
// El usuario los cargó primero en la 1103, cuando el peso era solo de cada
// máquina; ahora se cargan en General y cada Manitou los puede cambiar.
//
//   node --env-file=.env scripts/pesosDesde1103.js            (solo muestra)
//   node --env-file=.env scripts/pesosDesde1103.js --aplicar  (graba)
import mongoose from "mongoose";
import ChequeoSanPablo from "../src/models/ChequeoSanPablo.js";

const COSECHA = 2027;
const aplicar = process.argv.includes("--aplicar");

await mongoose.connect(process.env.MONGODB);

const de1103 = await ChequeoSanPablo.find({ cosecha: COSECHA, seccion: "manitou-1103", origen: { $ne: null } })
  .select("sistema item peso origen")
  .lean();
const conPeso = de1103.filter((f) => f.peso !== null && f.peso !== undefined);
console.log(`1103: ${de1103.length} tareas, ${conPeso.length} con peso`);

const porSistema = {};
for (const f of conPeso) (porSistema[f.sistema] ??= []).push(f);
for (const [sistema, filas] of Object.entries(porSistema)) {
  const suma = filas.reduce((t, f) => t + f.peso, 0);
  console.log(`  ${sistema}: suma ${suma}%`);
  for (const f of filas) console.log(`    ${f.peso}%  ${f.item}`);
}

// General: el peso de su copia en la 1103 (null si allá no tiene).
const generales = await ChequeoSanPablo.find({ cosecha: COSECHA, seccion: "manitous-general" }).select("_id peso").lean();
const pesoDe = new Map(de1103.map((f) => [String(f.origen), f.peso ?? null]));
const cambiosGeneral = generales
  .filter((g) => pesoDe.has(String(g._id)) && (g.peso ?? null) !== pesoDe.get(String(g._id)))
  .map((g) => ({ _id: g._id, peso: pesoDe.get(String(g._id)) }));
console.log(`General: ${cambiosGeneral.length} de ${generales.length} filas cambian`);

// Las copias de todas las Manitou (la 1103 incluida) quedan con el de General
// y sin peso propio: lo de la 1103 ya es lo de General.
const copias = await ChequeoSanPablo.find({ cosecha: COSECHA, origen: { $in: generales.map((g) => g._id) } })
  .select("_id seccion origen peso pesoPropio")
  .lean();
const propios = copias.filter((c) => c.pesoPropio);
console.log(`Copias: ${copias.length}, con peso propio: ${propios.length}`);
const cambiosCopias = copias
  .filter((c) => !c.pesoPropio)
  .map((c) => ({ _id: c._id, peso: pesoDe.get(String(c.origen)) ?? null, antes: c.peso ?? null, seccion: c.seccion }))
  .filter((c) => c.peso !== c.antes);
const porSeccion = {};
for (const c of cambiosCopias) porSeccion[c.seccion] = (porSeccion[c.seccion] || 0) + 1;
console.log("Copias que cambian, por Manitou:", porSeccion);

if (aplicar) {
  const ops = [
    ...cambiosGeneral.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { peso: c.peso } } } })),
    ...cambiosCopias.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { peso: c.peso } } } })),
  ];
  if (ops.length) {
    const r = await ChequeoSanPablo.bulkWrite(ops);
    console.log(`Grabado: ${r.modifiedCount} filas`);
  } else console.log("Nada para grabar");
} else console.log("(solo mostrado; con --aplicar se graba)");

await mongoose.disconnect();
