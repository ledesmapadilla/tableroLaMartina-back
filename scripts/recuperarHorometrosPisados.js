// Recupera las lecturas de horometro que quedaron tapadas por las cargas
// manuales (+Horom.) hechas antes de que create() persistiera la lectura previa.
//
// Las lecturas nunca se borraron: siguen en visitas / services / reparaciones,
// pero dejaron de ser "la ultima" y el historial solo lista services y cargas
// manuales. El script las materializa como registros de HorometroTractor para
// que vuelvan a aparecer en el historial junto a la carga que las tapo.
//
//   node --env-file .env scripts/recuperarHorometrosPisados.js           (simulacion)
//   node --env-file .env scripts/recuperarHorometrosPisados.js --apply   (escribe)
import mongoose from "mongoose";
import Tractor from "../src/models/Tractor.js";
import HorometroTractor from "../src/models/HorometroTractor.js";
import { calcularUltimosHorometros } from "../src/controllers/servicestractor.controller.js";

const APLICAR = process.argv.includes("--apply");
// Los services ya tienen fila propia en el historial; materializarlos como
// lectura duplicaria el evento. Solo se recuperan visitas y reparaciones.
const ORIGENES_A_RECUPERAR = ["visita", "reparacion"];
const ORIGEN_LABEL = { visita: "visita", reparacion: "reparación" };

const soloFecha = (f) => String(f?.toISOString?.().split("T")[0] ?? f ?? "");

const uri = process.env.MONGODB;
if (!uri) {
  console.error("Falta la variable de entorno MONGODB");
  process.exit(1);
}

await mongoose.connect(uri, { autoIndex: false });
console.info(`Base: ${mongoose.connection.name}\n`);

// Horometro vigente ANTES de cualquier carga manual: es el valor que la
// pantalla mostraba como "Horometro actual" y que la carga manual tapo.
const previos = await calcularUltimosHorometros({ incluirManuales: false });

const tractores = await Tractor.find().sort({ cc: 1 });
const manuales = await HorometroTractor.find();

const manualesPorTractor = new Map();
for (const h of manuales) {
  const key = String(h.tractor);
  if (!manualesPorTractor.has(key)) manualesPorTractor.set(key, []);
  manualesPorTractor.get(key).push(h);
}

const aRecuperar = [];
const sinAccion = [];

for (const t of tractores) {
  const propias = manualesPorTractor.get(String(t._id)) || [];
  if (propias.length === 0) continue; // nunca se uso +Horom.: no se piso nada

  const cleanCC = String(t.cc || "").replace(/^cc\s*/i, "").trim();
  const previa = previos[t.cc] || previos[cleanCC];

  if (previa && !ORIGENES_A_RECUPERAR.includes(previa.origen)) {
    sinAccion.push({ cc: t.cc, motivo: `la lectura previa (${previa.horometro} hs) ya figura como ${previa.origen}` });
    continue;
  }

  if (!previa || typeof previa.horometro !== "number" || !previa.fecha) {
    sinAccion.push({ cc: t.cc, motivo: "sin lectura previa en visitas/services/reparaciones" });
    continue;
  }

  const yaEsta = propias.some(
    (h) => h.horometro === previa.horometro && soloFecha(h.fecha) === previa.fecha
  );
  if (yaEsta) {
    sinAccion.push({ cc: t.cc, motivo: "la lectura previa ya figura en el historial" });
    continue;
  }

  aRecuperar.push({
    tractor: t._id,
    cc: t.cc,
    fecha: previa.fecha,
    horometro: previa.horometro,
    origen: previa.origen,
    tapadaPor: propias
      .map((h) => `${h.horometro} hs (${soloFecha(h.fecha)})`)
      .join(", "),
  });
}

console.info(`Tractores con carga manual: ${manualesPorTractor.size}`);
console.info(`Lecturas recuperables: ${aRecuperar.length}\n`);

if (aRecuperar.length) {
  console.info(
    "CC".padEnd(10) + "RECUPERA".padEnd(14) + "FECHA".padEnd(13) + "ORIGEN".padEnd(12) + "TAPADA POR"
  );
  console.info("-".repeat(95));
  for (const r of aRecuperar) {
    console.info(
      String(r.cc).padEnd(10) +
        `${r.horometro} hs`.padEnd(14) +
        String(r.fecha).padEnd(13) +
        String(r.origen).padEnd(12) +
        r.tapadaPor
    );
  }
  console.info("");
}

if (sinAccion.length) {
  console.info(`Sin accion (${sinAccion.length}):`);
  for (const s of sinAccion) console.info(`  CC ${s.cc}: ${s.motivo}`);
  console.info("");
}

if (!APLICAR) {
  console.info("SIMULACION: no se escribio nada. Repetir con --apply para guardar.");
} else if (aRecuperar.length) {
  const insertados = await HorometroTractor.insertMany(
    aRecuperar.map((r) => ({
      tractor: r.tractor,
      cc: r.cc,
      fecha: r.fecha,
      horometro: r.horometro,
      observaciones: `Lectura anterior (${ORIGEN_LABEL[r.origen] || r.origen}) — recuperada`,
    }))
  );
  console.info(`Guardados ${insertados.length} registros de horometro.`);
} else {
  console.info("Nada para guardar.");
}

await mongoose.disconnect();
