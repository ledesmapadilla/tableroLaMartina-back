/**
 * Pone de acuerdo el equipo y el grupo de cada CC del padrón (16/09/2026).
 *
 * Desde ahora el grupo de Compras sale del equipo (src/catalogos/equipos.js).
 * Este script deja la base como si siempre hubiera sido así:
 *
 *   1. Los equipos que el usuario corrigió a mano (CORRECCIONES).
 *   2. Los CC sin equipo cuyo grupo dice cuál es, siempre que ese equipo no sea
 *      de Flota: ponerle "Tractor" o "Colectivo" a un CC crearía la unidad en
 *      su pantalla, y eso se hace desde el alta de CC, eligiendo el grupo.
 *   3. El grupo de todo CC con equipo, sacado del catálogo.
 *
 * Lo que no puede resolver solo lo lista al final para revisarlo.
 *
 * Toca solo `equipo` y `grupo`, de a un CC por su _id. Es idempotente.
 *
 * Uso: npm run equipo-grupo-cc [-- --dry-run]
 */
import mongoose from "mongoose";
import CentroCosto from "../src/models/CentroCosto.js";
import { esEquipo, grupoDeEquipo, flotaDeEquipo } from "../src/catalogos/equipos.js";

const SIMULACRO = process.argv.includes("--dry-run");

// Decididos con el usuario el 16/09/2026.
const CORRECCIONES = {
  // Figuraban como Herbicida en el grupo Chancho: son chanchos.
  550: "Chancho",
  551: "Chancho",
  552: "Chancho",
  // Figuraba como Herbicida en el grupo Tractores: es un tractor. Como va a
  // Tractores, queda para hacerlo desde el alta de CC (pide el grupo).
  152: "Tractor",
  // Figuraban como Tractor en el grupo Manitou: pasan a su propio equipo, que
  // también va a Tractores (no cambia nada en Flota).
  1101: "Manitou",
  1102: "Manitou",
  1103: "Manitou",
  1104: "Manitou",
};

// Grupos de Compras que alcanzan para saber el equipo de un CC que no lo tiene.
const EQUIPO_POR_GRUPO = {
  Abonadora: "Abonadora",
  Chancho: "Chancho",
  Desmalezadora: "Desmalezadora",
  Herbicida: "Herbicida",
  Nodriza: "Nodriza",
};

await mongoose.connect(process.env.MONGODB);
console.log(SIMULACRO ? "SIMULACRO: no se escribe nada\n" : "");

const centros = await CentroCosto.find().sort({ cc: 1 });
const cambios = [];
const aRevisar = [];

for (const c of centros) {
  const antes = { equipo: c.equipo || "", grupo: c.grupo || "" };
  let equipo = antes.equipo.trim();

  if (CORRECCIONES[c.cc]) {
    equipo = CORRECCIONES[c.cc];
  } else if (!equipo && EQUIPO_POR_GRUPO[antes.grupo.trim()]) {
    equipo = EQUIPO_POR_GRUPO[antes.grupo.trim()];
  }

  if (!esEquipo(equipo)) {
    aRevisar.push(`${c.cc}  (equipo "${antes.equipo}", grupo "${antes.grupo}")`);
    continue;
  }
  // Un CC que pasaría a ser de Flota sin serlo todavía se hace desde el alta.
  if (flotaDeEquipo(equipo) && !flotaDeEquipo(antes.equipo) && !c.tractor) {
    aRevisar.push(`${c.cc}  (pasaría a ${flotaDeEquipo(equipo)}: hacerlo desde el alta de CC)`);
    continue;
  }

  const despues = { equipo, grupo: grupoDeEquipo(equipo) };
  if (despues.equipo === antes.equipo && despues.grupo === antes.grupo) continue;
  cambios.push({ c, antes, despues });
}

for (const { c, antes, despues } of cambios) {
  console.log(
    `${String(c.cc).padEnd(18)} ${`${antes.equipo || "—"} / ${antes.grupo || "—"}`.padEnd(32)} → ${despues.equipo} / ${despues.grupo}`
  );
  if (!SIMULACRO) await CentroCosto.updateOne({ _id: c._id }, { $set: despues });
}

console.log(`\n${cambios.length} CC ${SIMULACRO ? "a cambiar" : "cambiados"} de ${centros.length}.`);
if (aRevisar.length) {
  console.log(`\nA revisar (${aRevisar.length}):`);
  for (const linea of aRevisar) console.log(`  ${linea}`);
}

await mongoose.disconnect();
