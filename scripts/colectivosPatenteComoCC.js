/**
 * Colectivos: el CC pasa a ser la patente (15/09/2026).
 *
 * Hasta acá cada colectivo tenía un número interno en `cc` (250–283) y la
 * patente aparte, y ese número no existía en el padrón de CC: Compras había
 * cargado los colectivos con la patente como código. El usuario decidió que el
 * CC es la patente y que el número se borra.
 *
 * Para cada colectivo:
 *   - busca en el padrón el CC que es su patente (sin distinguir espacios);
 *   - `cc` pasa a ser ese código y se borra `patente`;
 *   - sus services y kilómetros, que guardan una copia del cc, pasan al código
 *     nuevo;
 *   - el CC del padrón queda con equipo "Colectivo" (y con la descripción del
 *     colectivo, si no tenía).
 *
 * Si algún colectivo no tiene su patente en el padrón no escribe nada: se
 * resuelve en MANUAL y se vuelve a correr. Todo va por _id del colectivo o del
 * CC. Es idempotente: un colectivo ya migrado (sin `patente`) se saltea.
 *
 * Uso: npm run colectivos-patente [--dry-run]
 */
import mongoose from "mongoose";

const SIMULACRO = process.argv.includes("--dry-run");

// Patente cargada en el colectivo → código del CC en el padrón, para los que no
// coinciden solos (errores de tipeo). Lo decidió el usuario el 15/09/2026:
// valen las del padrón.
const MANUAL = {
  "FYF 939": "FFY 939",
  "FVT 300": "FTV300",
  "FWN 856": "FWN",
};

const sinEspacios = (v) => String(v || "").replace(/\s+/g, "").toUpperCase();

const uri = process.env.MONGODB;
if (!uri?.includes("dbTableroControl")) {
  console.error("El MONGODB de este .env no apunta a dbTableroControl. Aborto.");
  process.exit(1);
}

const conn = await mongoose.createConnection(uri).asPromise();
const db = conn.db;
console.log(`Conectado${SIMULACRO ? " (SIMULACRO: no escribe nada)" : ""}\n`);

const colectivos = await db.collection("colectivos").find().toArray();
const centros = await db.collection("centrocostos").find().toArray();
const porCodigo = new Map(centros.map((c) => [sinEspacios(c.cc), c]));

const plan = [];
const faltan = [];
let yaMigrados = 0;

for (const col of colectivos) {
  if (!("patente" in col)) {
    yaMigrados++;
    continue;
  }
  const patente = String(col.patente || "").trim().toUpperCase();
  const centro = porCodigo.get(sinEspacios(MANUAL[patente] || patente));
  if (centro) plan.push({ col, centro });
  else faltan.push(col);
}

// Dos colectivos no pueden quedar con el mismo CC.
const repetidos = plan.filter((p, i) => plan.findIndex((q) => q.centro._id.equals(p.centro._id)) !== i);

console.log("--- Colectivos → CC del padrón ---");
for (const { col, centro } of plan) {
  const aviso = sinEspacios(col.patente) === sinEspacios(centro.cc) ? "" : "  (por MANUAL)";
  console.log(`  ${String(col.cc).padEnd(5)} ${String(col.patente).padEnd(10)} → ${centro.cc}${aviso}`);
}
if (yaMigrados) console.log(`\n  Ya migrados antes: ${yaMigrados}`);

const usados = new Set(plan.map((p) => String(p.centro._id)));
const sueltos = centros.filter((c) => c.grupo === "Colectivos" && !usados.has(String(c._id)) && c.equipo !== "Colectivo");
if (sueltos.length) {
  console.log("\n--- CC del grupo Colectivos sin colectivo en Flota (no se tocan) ---");
  for (const c of sueltos) console.log(`  ${c.cc}`);
}

if (faltan.length || repetidos.length) {
  if (faltan.length) {
    console.log("\n--- Sin CC en el padrón: resolver en MANUAL ---");
    for (const col of faltan) console.log(`  ${String(col.cc).padEnd(5)} ${col.patente}`);
  }
  if (repetidos.length) {
    console.log("\n--- Dos colectivos con el mismo CC: revisar ---");
    for (const { col, centro } of repetidos) console.log(`  ${col.patente} → ${centro.cc}`);
  }
  console.log("\nNo se escribió nada.");
  await conn.close();
  process.exit(SIMULACRO ? 0 : 1);
}

if (SIMULACRO) {
  console.log("\nSimulacro: no se escribió nada.");
} else {
  for (const { col, centro } of plan) {
    await db.collection("colectivos").updateOne(
      { _id: col._id },
      { $set: { cc: centro.cc, updatedAt: new Date() }, $unset: { patente: "" } }
    );
    await db.collection("servicecolectivos").updateMany({ colectivo: col._id }, { $set: { cc: centro.cc } });
    await db.collection("kilometrocolectivos").updateMany({ colectivo: col._id }, { $set: { cc: centro.cc } });
    const cambios = { equipo: "Colectivo", updatedAt: new Date() };
    if (!centro.descripcion && col.descripcion) cambios.descripcion = col.descripcion;
    await db.collection("centrocostos").updateOne({ _id: centro._id }, { $set: cambios });
  }
  console.log(`\nListo: ${plan.length} colectivos con la patente como CC.`);
}

await conn.close();
