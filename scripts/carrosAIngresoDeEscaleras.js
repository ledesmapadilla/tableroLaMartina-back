/**
 * Pasa las escaleras que entraron con la página de Carros porta escaleras a
 * filas de "Ingreso" de Escaleras (06/10/2026).
 *
 * La página de Carros porta escaleras se borró: todo se maneja desde
 * Escaleras, y el Ingreso con carro es el ingreso del carro. Cada fila de
 * Escaleras enlazada a un carro (`origen`) pasa a ser un Ingreso (`sinCarro`)
 * con el mismo carro, fecha, quién, cantidad y frente, y se desengancha del
 * carro: así se edita y se borra entera desde Escaleras. Las observaciones del
 * carro pasan a la fila si ella no tiene.
 *
 * Los ingresos de los carros no se borran: quedan en la base como estaban,
 * con su "revisada" y su "plan de mantenimiento", aunque ya no se ven.
 *
 * Uso:
 *   node --env-file .env scripts/carrosAIngresoDeEscaleras.js            (muestra)
 *   node --env-file .env scripts/carrosAIngresoDeEscaleras.js --aplicar  (guarda)
 */
import mongoose from "mongoose";
import IngresoSanPablo from "../src/models/IngresoSanPablo.js";

const aplicar = process.argv.includes("--aplicar");

await mongoose.connect(process.env.MONGODB);

const filas = await IngresoSanPablo.find({ tipo: "escaleras", origen: { $ne: null } }).lean();
console.log(`${filas.length} filas de Escaleras enlazadas a un carro`);

let pasadas = 0;
for (const fila of filas) {
  const carro = await IngresoSanPablo.findById(fila.origen).lean();
  const observaciones = (fila.observaciones || "").trim() || (carro?.observaciones || "").trim();
  console.log(
    `  ${fila._id} · ${fila.cantidadEscaleras} escaleras · ${fila.fechaIngreso?.toISOString().slice(0, 10)}` +
      (observaciones ? ` · "${observaciones}"` : "")
  );
  if (!aplicar) continue;
  await IngresoSanPablo.updateOne(
    { _id: fila._id, origen: fila.origen },
    { $set: { sinCarro: true, origen: null, observaciones } }
  );
  pasadas++;
}

console.log(aplicar ? `Listo: ${pasadas} filas pasadas a Ingreso.` : "Nada guardado: correrlo con --aplicar.");
await mongoose.disconnect();
