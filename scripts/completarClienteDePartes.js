/**
 * Completa el cliente de los partes que no lo tienen.
 *
 * El cliente pasó a ser obligatorio (05/09/2026): define con qué precio de
 * Variables se certifica cada tarea, y los precios se cargan por cliente. Los
 * partes anteriores a ese cambio se guardaron sin cliente y no se pueden
 * valorizar ni volver a editar hasta completarlo.
 *
 * Solo toca los que están vacíos: los que ya tienen un cliente escrito no se
 * pisan, así que se puede correr las veces que haga falta.
 *
 * Uso: npm run completar-cliente-partes [cliente]
 * Sin argumento usa "Citrusvil".
 */
import mongoose from "mongoose";
import ParteDiario from "../src/models/ParteDiario.js";

const cliente = (process.argv[2] || "Citrusvil").trim();

if (!cliente) {
  console.error("Hay que indicar un cliente.");
  process.exit(1);
}

// Un parte "sin cliente" es el que lo tiene vacío, en null, o no tiene el
// campo: los tres casos conviven según cuándo se cargó.
const SIN_CLIENTE = {
  $or: [{ cliente: "" }, { cliente: null }, { cliente: { $exists: false } }],
};

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const aCompletar = await ParteDiario.countDocuments(SIN_CLIENTE);
const total = await ParteDiario.countDocuments();

if (aCompletar === 0) {
  console.log(`No hay partes sin cliente (${total} en total). No se tocó nada.`);
} else {
  const res = await ParteDiario.updateMany(SIN_CLIENTE, { $set: { cliente } });
  console.log(`Listo: ${res.modifiedCount} de ${total} partes quedaron con cliente "${cliente}".`);
}

await mongoose.disconnect();
