/**
 * Separa el "Apellido, Nombre" del personal en apellido y nombre (02/11/2026).
 * Desde ahora el alta los pide por separado y arma el "Apellido, Nombre" de
 * siempre; esto completa los que ya estaban.
 *
 * - Con una coma: lo de antes es el apellido y lo de después el nombre. El
 *   texto queda igual.
 * - Los que estaban sin coma, según el usuario: Morales, Rosas y Chumientos
 *   estaban al revés (nombre primero) y a Nieva le faltaba la coma.
 * - Motor Generador y Uso interno quedan como están, sin apellido ni nombre.
 *   Lo mismo cualquier otro que no entre en estas reglas: se lista y no se toca.
 *
 * Solo cambia la colección personals: los partes y el resto la referencian por
 * _id y leen el nombre de acá.
 *
 * Uso: node --env-file .env scripts/separarApellidoNombre.js [--aplicar]
 * Sin --aplicar solo muestra lo que haría.
 */
import mongoose from "mongoose";

const aplicar = process.argv.includes("--aplicar");

// Escrito tal cual está hoy → [apellido, nombre].
const A_MANO = {
  "Daniel Morales": ["Morales", "Daniel"],
  "Jorge Rosas": ["Rosas", "Jorge"],
  "Exequiel Chumientos": ["Chumientos", "Exequiel"],
  "Nieva Lucas": ["Nieva", "Lucas"],
};
const SE_DEJAN = ["Motor Generador", "Uso interno"];

await mongoose.connect(process.env.MONGODB);
const col = mongoose.connection.db.collection("personals");
const personas = await col.find({}).sort({ apellidoNombre: 1 }).toArray();

const cambios = [];
const sinTocar = [];
for (const p of personas) {
  const actual = String(p.apellidoNombre || "").trim();
  let par = null;
  if (p.usoInterno || SE_DEJAN.includes(actual)) par = null;
  else if (A_MANO[actual]) par = A_MANO[actual];
  else if ((actual.match(/,/g) || []).length === 1) par = actual.split(",").map((s) => s.trim());

  if (!par || !par[0] || !par[1]) {
    sinTocar.push(actual);
    continue;
  }
  const [apellido, nombre] = par;
  const apellidoNombre = `${apellido}, ${nombre}`;
  if (p.apellido === apellido && p.nombre === nombre && p.apellidoNombre === apellidoNombre) continue;
  cambios.push({ _id: p._id, antes: actual, apellido, nombre, apellidoNombre });
}

console.log(`Personal: ${personas.length}. Para separar: ${cambios.length}. Sin tocar: ${sinTocar.length}.\n`);
for (const c of cambios) {
  const marca = c.antes !== c.apellidoNombre ? `   (antes: "${c.antes}")` : "";
  console.log(`  apellido "${c.apellido}"  ·  nombre "${c.nombre}"${marca}`);
}
console.log("\nSin tocar:", sinTocar.map((s) => `"${s}"`).join(", ") || "ninguno");

if (!aplicar) {
  console.log("\nNo se cambió nada. Para hacerlo: --aplicar");
} else {
  for (const c of cambios) {
    await col.updateOne(
      { _id: c._id },
      { $set: { apellido: c.apellido, nombre: c.nombre, apellidoNombre: c.apellidoNombre, updatedAt: new Date() } }
    );
  }
  console.log(`\nListo: ${cambios.length} actualizados.`);
}
await mongoose.disconnect();
