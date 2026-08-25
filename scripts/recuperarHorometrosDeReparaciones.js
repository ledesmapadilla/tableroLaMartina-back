// Repone en el historial las lecturas de horometro tomadas al cargar
// reparaciones antes de que crear() las materializara.
//
// Cada trabajo guarda su horometro, pero el historial de preventivo solo lista
// services y registros de HorometroTractor: de todas las lecturas de un tractor
// solo se veia la ultima, y las anteriores quedaban tapadas. El script las pasa
// a HorometroTractor con origen "reparacion" (no pisan a las cargas manuales).
//
// De paso completa el campo origen de los registros ya materializados, que se
// habian guardado antes de que el campo existiera y contaban como manuales.
//
//   node --env-file .env scripts/recuperarHorometrosDeReparaciones.js           (simulacion)
//   node --env-file .env scripts/recuperarHorometrosDeReparaciones.js --apply   (escribe)
import mongoose from "mongoose";
import Tractor from "../src/models/Tractor.js";
import TrabajoTractor from "../src/models/TrabajoTractor.js";
import HorometroTractor from "../src/models/HorometroTractor.js";
import { parsearHorometro } from "../src/controllers/horometrostractor.controller.js";

const APLICAR = process.argv.includes("--apply");
const soloFecha = (f) => String(f?.toISOString?.().split("T")[0] ?? f ?? "");

const uri = process.env.MONGODB;
if (!uri) {
  console.error("Falta la variable de entorno MONGODB");
  process.exit(1);
}

await mongoose.connect(uri, { autoIndex: false });
console.info(`Base: ${mongoose.connection.name}\n`);

// --- 1. Backfill del campo origen en lo ya materializado -------------------
// Los registros creados por el fix anterior llevan la fuente en observaciones.
const sinOrigen = await HorometroTractor.find({
  $or: [{ origen: { $exists: false } }, { origen: null }, { origen: "" }],
});
const aReetiquetar = sinOrigen
  .map((h) => {
    const obs = String(h.observaciones || "");
    const m = obs.match(/^Lectura anterior \((visita|reparación|reparacion|service)\)/i);
    if (!m) return null;
    const origen = m[1].toLowerCase().startsWith("repara") ? "reparacion" : m[1].toLowerCase();
    return { _id: h._id, cc: h.cc, horometro: h.horometro, fecha: soloFecha(h.fecha), origen };
  })
  .filter(Boolean);

console.info(`Registros a reetiquetar con su origen real: ${aReetiquetar.length}`);
for (const r of aReetiquetar) {
  console.info(`  CC ${r.cc}: ${r.horometro} hs (${r.fecha}) -> origen "${r.origen}"`);
}
console.info("");

// --- 2. Lecturas de reparaciones que faltan en el historial ----------------
const trabajos = await TrabajoTractor.find({ horometro: { $exists: true, $ne: "" } })
  .populate("tractor", "cc")
  .sort({ fecha: 1, createdAt: 1 });

const existentes = await HorometroTractor.find();
const clave = (tractorId, horometro, fecha) => `${tractorId}|${horometro}|${fecha}`;
const yaEnHistorial = new Set(
  existentes.map((h) => clave(String(h.tractor), h.horometro, soloFecha(h.fecha)))
);

const aReponer = [];
const descartados = [];

for (const t of trabajos) {
  const horometro = parsearHorometro(t.horometro);
  if (horometro === null) {
    descartados.push(`CC ${t.tractor?.cc ?? "?"}: horometro no numerico ("${t.horometro}")`);
    continue;
  }
  if (!t.tractor?._id) {
    descartados.push(`trabajo ${t._id}: sin tractor asociado`);
    continue;
  }

  const fecha = soloFecha(t.fecha);
  const k = clave(String(t.tractor._id), horometro, fecha);
  if (yaEnHistorial.has(k)) continue; // ya esta (o es un duplicado dentro del lote)
  yaEnHistorial.add(k);

  const detalle = String(t.reparacion || t.descripcion || "").trim();
  aReponer.push({
    tractor: t.tractor._id,
    cc: t.tractor.cc,
    fecha,
    horometro,
    observaciones: detalle
      ? `Reparación: ${detalle.slice(0, 100)}`
      : "Lectura tomada en reparación",
  });
}

console.info(`Trabajos con horometro: ${trabajos.length}`);
console.info(`Lecturas a reponer en el historial: ${aReponer.length}\n`);

if (aReponer.length) {
  console.info("CC".padEnd(10) + "HOROMETRO".padEnd(14) + "FECHA".padEnd(13) + "DETALLE");
  console.info("-".repeat(90));
  for (const r of aReponer) {
    console.info(
      String(r.cc).padEnd(10) +
        `${r.horometro} hs`.padEnd(14) +
        String(r.fecha).padEnd(13) +
        r.observaciones
    );
  }
  console.info("");
}

if (descartados.length) {
  console.info(`Descartados (${descartados.length}):`);
  for (const d of descartados) console.info(`  ${d}`);
  console.info("");
}

if (!APLICAR) {
  console.info("SIMULACION: no se escribio nada. Repetir con --apply para guardar.");
} else {
  for (const r of aReetiquetar) {
    await HorometroTractor.updateOne({ _id: r._id }, { $set: { origen: r.origen } });
  }
  console.info(`Reetiquetados ${aReetiquetar.length} registros.`);

  if (aReponer.length) {
    const insertados = await HorometroTractor.insertMany(
      aReponer.map((r) => ({ ...r, origen: "reparacion" }))
    );
    console.info(`Repuestas ${insertados.length} lecturas de reparacion.`);
  } else {
    console.info("No habia lecturas para reponer.");
  }
}

await mongoose.disconnect();
