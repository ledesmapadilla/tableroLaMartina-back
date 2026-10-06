/**
 * Arranca el padrón de clientes de Producción (04/10/2026) con los dos de
 * siempre: Citrusvil y Sauce Guacho.
 *
 * No pisa nada: si un cliente ya está en el padrón lo deja como está, así que
 * se puede correr las veces que haga falta. Al final lista los clientes que
 * aparecen en partes o precios y no están en el padrón: esos datos no se van a
 * poder volver a guardar hasta que el cliente se dé de alta (o se corrija).
 *
 * Uso: node --env-file .env scripts/crearPadronClientes.js
 */
import mongoose from "mongoose";
import Cliente from "../src/models/Cliente.js";
import ParteDiario from "../src/models/ParteDiario.js";
import VariableTarea from "../src/models/VariableTarea.js";
import { claveCliente } from "../src/controllers/clientes.controller.js";

const INICIALES = ["Citrusvil", "Sauce Guacho"];

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

for (const nombre of INICIALES) {
  const clave = claveCliente(nombre);
  const res = await Cliente.updateOne({ clave }, { $setOnInsert: { nombre, clave, activo: true } }, { upsert: true });
  console.log(res.upsertedCount ? `Alta: ${nombre}` : `Ya estaba: ${nombre}`);
}

const enPadron = new Set((await Cliente.find().select("clave").lean()).map((c) => c.clave));
const usados = [
  ...(await ParteDiario.distinct("cliente")).map((c) => ["partes", c]),
  ...(await VariableTarea.distinct("cliente")).map((c) => ["precios", c]),
];
const faltan = usados.filter(([, c]) => (c || "").trim() && !enPadron.has(claveCliente(c)));
if (faltan.length === 0) {
  console.log("Todos los clientes de partes y precios están en el padrón.");
} else {
  console.log("En uso pero fuera del padrón:");
  for (const [donde, c] of faltan) console.log(`  - "${c}" (en ${donde})`);
}

await mongoose.disconnect();
