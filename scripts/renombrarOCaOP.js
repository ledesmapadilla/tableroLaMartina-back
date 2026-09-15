/**
 * Renombra "orden de compra" (OC) a "orden de pago" (OP) en los datos ya
 * cargados. El código ya habla de OP: esto alinea lo que está guardado.
 *
 * Toca tres cosas, y solo por reemplazo de texto:
 *   - `berdinapedidos` y `sanpablopedidos`: el estado de ítem "Para hacer OC"
 *     pasa a "Para hacer OP" (también dentro de `historial`), el número de
 *     orden del ítem (`oc`) pasa de "OC-B-001" a "OP-B-001" y las notas del
 *     historial dicen "OP generada".
 *   - `ocs`: `nro_oc_display` pasa de "OC-SP-001" a "OP-SP-001".
 *
 * No renombra la colección `ocs` ni los campos `oc` / `nro_oc` /
 * `nro_oc_display`: son el nombre interno de siempre y moverlos obligaría a
 * copiar la colección entera.
 *
 * No borra ni crea documentos: solo reescribe esos campos. Es idempotente,
 * porque busca los valores viejos, que después de correrlo ya no están.
 *
 * Uso: npm run renombrar-op [--dry-run]
 */
import mongoose from "mongoose";

const SIMULACRO = process.argv.includes("--dry-run");

const ESTADO_VIEJO = "Para hacer OC";
const ESTADO_NUEVO = "Para hacer OP";

// "OC-B-001" → "OP-B-001". Anclado al principio para no tocar texto suelto.
const nroNuevo = (v) => (typeof v === "string" ? v.replace(/^OC-/, "OP-") : v);

// Las notas del historial arrastran el número y la frase "OC generada".
const notaNueva = (v) =>
  typeof v === "string" ? v.replace(/\bOC generada\b/g, "OP generada").replace(/\bOC-/g, "OP-") : v;

const uri = process.env.MONGODB;
if (!uri?.includes("dbTableroControl")) {
  console.error("El MONGODB de este .env no apunta a dbTableroControl. Aborto.");
  process.exit(1);
}

const conn = await mongoose.createConnection(uri).asPromise();
console.log(`Conectado${SIMULACRO ? " (SIMULACRO: no escribe nada)" : ""}\n`);

let estados = 0;
let numeros = 0;
let notas = 0;
let pedidosTocados = 0;

for (const nombre of ["berdinapedidos", "sanpablopedidos"]) {
  const col = conn.db.collection(nombre);
  const pedidos = await col
    .find({
      $or: [
        { "items.estado": ESTADO_VIEJO },
        { "items.historial.estado": ESTADO_VIEJO },
        { "items.oc": /^OC-/ },
        { "items.historial.nota": /OC generada|OC-/ },
      ],
    })
    .toArray();

  const ops = [];
  for (const pedido of pedidos) {
    let cambio = false;

    for (const item of pedido.items || []) {
      if (item.estado === ESTADO_VIEJO) {
        item.estado = ESTADO_NUEVO;
        estados++;
        cambio = true;
      }
      const oc = nroNuevo(item.oc);
      if (oc !== item.oc) {
        item.oc = oc;
        numeros++;
        cambio = true;
      }
      for (const h of item.historial || []) {
        if (h.estado === ESTADO_VIEJO) {
          h.estado = ESTADO_NUEVO;
          estados++;
          cambio = true;
        }
        const nota = notaNueva(h.nota);
        if (nota !== h.nota) {
          h.nota = nota;
          notas++;
          cambio = true;
        }
      }
    }

    if (cambio) {
      pedidosTocados++;
      ops.push({ updateOne: { filter: { _id: pedido._id }, update: { $set: { items: pedido.items } } } });
    }
  }

  console.log(`${nombre.padEnd(18)} ${String(ops.length).padStart(4)} pedidos a actualizar`);
  if (!SIMULACRO && ops.length) await col.bulkWrite(ops);
}

// Las órdenes en sí: solo el número que se muestra.
const ocs = conn.db.collection("ocs");
const aRenumerar = await ocs.find({ nro_oc_display: /^OC-/ }).toArray();
console.log(`${"ocs".padEnd(18)} ${String(aRenumerar.length).padStart(4)} órdenes a renumerar`);
if (!SIMULACRO && aRenumerar.length) {
  await ocs.bulkWrite(
    aRenumerar.map((o) => ({
      updateOne: { filter: { _id: o._id }, update: { $set: { nro_oc_display: nroNuevo(o.nro_oc_display) } } },
    }))
  );
}

console.log("");
console.log(`estados "${ESTADO_VIEJO}" → "${ESTADO_NUEVO}": ${estados}`);
console.log(`números OC- → OP- en ítems:            ${numeros}`);
console.log(`notas de historial reescritas:         ${notas}`);
console.log(`pedidos tocados:                       ${pedidosTocados}`);
console.log(`órdenes renumeradas:                   ${aRenumerar.length}`);
if (SIMULACRO) console.log("\nSimulacro: no se escribió nada.");

await conn.close();
