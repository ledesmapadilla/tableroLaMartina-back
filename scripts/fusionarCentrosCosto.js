/**
 * Fusiona los centros de costo de Compras con los del Tablero.
 *
 * Los dos sistemas venían llevando el mismo padrón de La Martina por separado:
 * 170 en Compras, 103 en el Tablero, con 87 códigos en común. Al unificar los
 * proyectos queda uno solo de 186, con los campos de los dos.
 *
 * Quién aporta qué en los que estaban en los dos:
 *   - Compras  → grupo, marca, observaciones
 *   - Tablero  → equipo, descripcion, tractor
 * Es lo que cada sistema mantiene, así que nadie pierde su dato.
 *
 * En los 7 códigos donde los dos se contradicen (152, 155, 156, 186, 550, 551,
 * 552) manda el Tablero, que es el que se usa todos los días en Producción.
 * Como cada uno aporta campos distintos, el criterio no cambia la mezcla: se
 * deja anotado en el informe para poder revisarlo.
 *
 * Los códigos del Tablero que no son un CC real (NODRIZA 1, HERBICIDA S/CC y
 * los demás) entran al padrón tal como están.
 *
 * No borra nada: escribe sobre la colección del Tablero, que es la que queda.
 * Es idempotente, así que se puede correr de nuevo sin duplicar.
 *
 * Uso: npm run fusionar-cc [--dry-run]
 */
import mongoose from "mongoose";

const SIMULACRO = process.argv.includes("--dry-run");

// Los códigos donde Compras y el Tablero describen equipos distintos. Se
// listan para que salgan en el informe, no para tratarlos aparte.
const CONTRADICEN = ["152", "155", "156", "186", "550", "551", "552"];

const norm = (v) => String(v || "").trim().toUpperCase();
const limpio = (v) => String(v || "").trim();

const uriTablero = process.env.MONGODB;
if (!uriTablero?.includes("dbTableroControl")) {
  console.error("El MONGODB de este .env no apunta a dbTableroControl. Aborto.");
  process.exit(1);
}
const uriCompras = uriTablero.replace("dbTableroControl", "dbComprasLaMartina");

const tablero = await mongoose.createConnection(uriTablero).asPromise();
const compras = await mongoose.createConnection(uriCompras).asPromise();
console.log(`Conectado${SIMULACRO ? " (SIMULACRO: no escribe nada)" : ""}\n`);

const colTablero = tablero.db.collection("centrocostos");
const deCompras = await compras.db.collection("centrocostos").find().toArray();
const delTablero = await colTablero.find().toArray();

const mapCompras = new Map(deCompras.map((d) => [norm(d.cc), d]));
const porCodigo = new Map(delTablero.map((d) => [norm(d.cc), d]));

const aActualizar = [];
const aCrear = [];

// 1) Los que ya están en el Tablero: se les suma lo que aporta Compras.
for (const [codigo, doc] of porCodigo) {
  const c = mapCompras.get(codigo);
  if (!c) continue;

  const cambios = {};
  if (limpio(c.grupo) && limpio(c.grupo) !== limpio(doc.grupo)) cambios.grupo = limpio(c.grupo);
  if (limpio(c.marca) && limpio(c.marca) !== limpio(doc.marca)) cambios.marca = limpio(c.marca);
  if (limpio(c.observaciones) && limpio(c.observaciones) !== limpio(doc.observaciones)) {
    cambios.observaciones = limpio(c.observaciones);
  }
  if (Object.keys(cambios).length) aActualizar.push({ codigo, _id: doc._id, cambios });
}

// 2) Los que solo estaban en Compras: se crean con sus campos.
for (const [codigo, c] of mapCompras) {
  if (porCodigo.has(codigo)) continue;
  aCrear.push({
    cc: limpio(c.cc),
    grupo: limpio(c.grupo),
    marca: limpio(c.marca),
    observaciones: limpio(c.observaciones),
    equipo: "",
    descripcion: "",
    tractor: null,
    createdAt: c.createdAt || new Date(),
    updatedAt: new Date(),
  });
}

console.log("--- Lo que va a pasar ---");
console.log(`  Ya estaban en el Tablero, se completan:  ${String(aActualizar.length).padStart(4)}`);
console.log(`  Vienen de Compras, se crean:            ${String(aCrear.length).padStart(4)}`);
console.log(`  Quedan como están:                      ${String(delTablero.length - aActualizar.length).padStart(4)}`);
console.log(`  Padrón final:                           ${String(delTablero.length + aCrear.length).padStart(4)}`);

const contradicen = aActualizar.filter((a) => CONTRADICEN.includes(a.codigo));
if (contradicen.length) {
  console.log("\n--- Los que se contradecían: gana el Tablero ---");
  for (const a of contradicen) {
    const t = porCodigo.get(a.codigo);
    console.log(
      `  ${a.codigo.padEnd(6)} queda: ${(t.equipo || "-")} / ${(t.descripcion || "-")}` +
        `   (Compras decía: ${mapCompras.get(a.codigo).grupo} / ${mapCompras.get(a.codigo).marca || "-"})`
    );
  }
}

if (SIMULACRO) {
  console.log("\nSimulacro: no se escribió nada.");
} else {
  for (const a of aActualizar) {
    await colTablero.updateOne({ _id: a._id }, { $set: { ...a.cambios, updatedAt: new Date() } });
  }
  if (aCrear.length) await colTablero.insertMany(aCrear);
  console.log(`\nListo. Padrón unificado: ${await colTablero.countDocuments()} centros de costo.`);
}

await tablero.close();
await compras.close();
