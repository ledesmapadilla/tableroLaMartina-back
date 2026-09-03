/**
 * SOLO LECTURA. No escribe nada.
 *
 * Arma la línea de tiempo de horómetros de cada tractor juntando las cinco
 * fuentes y lista las lecturas que rompen la regla: toda lectura debe ser
 * mayor o igual a la última anterior a su fecha.
 */
import mongoose from "mongoose";
import Tractor from "../src/models/Tractor.js";
import Visita from "../src/models/Visita.js";
import ServiceTractor from "../src/models/ServiceTractor.js";
import TrabajoTractor from "../src/models/TrabajoTractor.js";
import HorometroTractor from "../src/models/HorometroTractor.js";
import ParteDiario from "../src/models/ParteDiario.js";
import CentroCosto from "../src/models/CentroCosto.js";

const num = (valor) => {
  if (valor === null || valor === undefined) return null;
  const str = String(valor).trim();
  if (!str || str.toUpperCase() === "S/H") return null;
  const m = str.match(/[\d]+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", "."));
  return isNaN(n) ? null : n;
};

const dia = (f) => {
  if (!f) return "";
  if (typeof f === "string") return f.split("T")[0];
  return new Date(f).toISOString().split("T")[0];
};

const limpiarCC = (cc) => String(cc || "").replace(/^cc\s*/i, "").trim();

await mongoose.connect(process.env.MONGODB);

const tractores = await Tractor.find().lean();
const porCC = new Map(tractores.map((t) => [limpiarCC(t.cc), t]));

// cc limpio -> lecturas
const lecturas = new Map();
const agregar = (cc, fecha, valor, fuente, id) => {
  const clean = limpiarCC(cc);
  if (!clean || !porCC.has(clean)) return;
  const n = num(valor);
  if (n === null) return;
  if (!lecturas.has(clean)) lecturas.set(clean, []);
  lecturas.get(clean).push({ fecha: dia(fecha), horometro: n, fuente, id: String(id) });
};

// 1. Visitas (el campo puede traer varios CC: "CC 12: 3400, CC 15: 890")
for (const v of await Visita.find({ horometro: { $exists: true, $ne: "" } }).lean()) {
  const h = String(v.horometro).trim();
  const ccStr = String(v.cc || "").trim();
  if (h.includes(":") || ccStr.includes(",")) {
    for (const m of h.matchAll(/(?:CC\s*)?([0-9a-zA-Z\-_]+)\s*:\s*([^,;]+)/gi)) {
      agregar(m[1], v.fecha, m[2], "visita", v._id);
    }
  } else {
    agregar(ccStr, v.fecha, h, "visita", v._id);
  }
}

// 2. Services
for (const s of await ServiceTractor.find().populate("tractor", "cc").lean()) {
  agregar(s.tractor?.cc || s.cc, s.fecha, s.horometro, "service", s._id);
}

// 3. Trabajos / reparaciones
for (const t of await TrabajoTractor.find({ horometro: { $exists: true, $ne: "" } })
  .populate("tractor", "cc")
  .lean()) {
  agregar(t.tractor?.cc || t.cc, t.fecha, t.horometro, "reparacion", t._id);
}

// 4. Cargas manuales / materializadas
for (const h of await HorometroTractor.find().populate("tractor", "cc").lean()) {
  agregar(h.cc || h.tractor?.cc, h.fecha, h.horometro, `horom:${h.origen || "manual"}`, h._id);
}

// 5. Partes diarios (solo los CC enlazados a un tractor)
for (const p of await ParteDiario.find({
  $or: [{ horomIngreso: { $ne: null } }, { horomSalida: { $ne: null } }],
})
  .populate({ path: "cc", model: CentroCosto, populate: { path: "tractor", model: Tractor, select: "cc" } })
  .lean()) {
  const cc = p.cc?.tractor?.cc;
  if (!cc) continue;
  agregar(cc, p.fecha, p.horomIngreso, "parte:ing", p._id);
  agregar(cc, p.fecha, p.horomSalida, "parte:sal", p._id);
}

// ── Detección de violaciones ──
let totalLecturas = 0;
let totalViolaciones = 0;
const conProblemas = [];

for (const [cc, arr] of [...lecturas.entries()].sort((a, b) => a[0].localeCompare(b[0], "es", { numeric: true }))) {
  arr.sort((a, b) => (a.fecha === b.fecha ? a.horometro - b.horometro : a.fecha.localeCompare(b.fecha)));
  totalLecturas += arr.length;

  let maxPrevio = null;
  let maxInfo = null;
  const malas = [];

  for (const l of arr) {
    if (maxPrevio !== null && l.horometro < maxPrevio) {
      malas.push({ ...l, esperadoMin: maxPrevio, desde: maxInfo });
    } else {
      maxPrevio = l.horometro;
      maxInfo = l;
    }
  }

  if (malas.length) {
    totalViolaciones += malas.length;
    conProblemas.push({ cc, total: arr.length, malas, ultimo: maxPrevio });
  }
}

console.log(`\nTractores con lecturas:  ${lecturas.size}`);
console.log(`Lecturas totales:        ${totalLecturas}`);
console.log(`CC con problemas:        ${conProblemas.length}`);
console.log(`Lecturas que violan:     ${totalViolaciones}\n`);

for (const p of conProblemas) {
  console.log(`── CC ${p.cc}  (${p.malas.length} de ${p.total} lecturas, último válido ${p.ultimo})`);
  for (const m of p.malas) {
    const salto = m.esperadoMin - m.horometro;
    // Un salto que se explica por un dígito de menos suele ser tipeo.
    const pista =
      m.horometro > 0 && Math.abs(m.esperadoMin / m.horometro - 10) < 1.5
        ? "  <- parece un dígito faltante"
        : m.horometro < 50
        ? "  <- parece horómetro nuevo (empieza de cero)"
        : "";
    console.log(
      `   ${m.fecha}  ${String(m.horometro).padStart(8)}  (esperado >= ${m.esperadoMin}, faltan ${salto.toFixed(1)})  [${m.fuente}]${pista}`
    );
  }
  console.log("");
}

await mongoose.disconnect();
