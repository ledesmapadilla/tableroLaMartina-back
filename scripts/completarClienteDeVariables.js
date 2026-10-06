/**
 * Pone cliente a los precios de Variables que no lo tienen.
 *
 * Del 17/09 al 04/10/2026 el precio no distinguía cliente. Al volver a
 * separarlos por cliente (04/10/2026), los precios que había pasan a ser de
 * Citrusvil, el cliente que viene puesto en cada parte.
 *
 * Solo toca los que están vacíos: los que ya tienen un cliente no se pisan,
 * así que se puede correr las veces que haga falta.
 *
 * Uso: node --env-file .env scripts/completarClienteDeVariables.js [cliente]
 * Sin argumento usa "Citrusvil".
 */
import mongoose from "mongoose";
import VariableTarea from "../src/models/VariableTarea.js";

const cliente = (process.argv[2] || "Citrusvil").trim();

if (!cliente) {
  console.error("Hay que indicar un cliente.");
  process.exit(1);
}

// "Sin cliente" es vacío, null o sin el campo: los tres conviven según cuándo
// se cargó el precio.
const SIN_CLIENTE = {
  $or: [{ cliente: "" }, { cliente: null }, { cliente: { $exists: false } }],
};

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const aCompletar = await VariableTarea.countDocuments(SIN_CLIENTE);
const total = await VariableTarea.countDocuments();

if (aCompletar === 0) {
  console.log(`No hay precios sin cliente (${total} en total). No se tocó nada.`);
} else {
  const res = await VariableTarea.updateMany(SIN_CLIENTE, { $set: { cliente } });
  console.log(`Listo: ${res.modifiedCount} de ${total} precios quedaron con cliente "${cliente}".`);
}

await mongoose.disconnect();
