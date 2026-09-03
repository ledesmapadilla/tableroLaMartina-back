/**
 * Copia los tractores ya dados de alta al listado de CC de Producción.
 *
 * Es idempotente: los CC que ya existen se saltean, así se puede volver a
 * correr sin duplicar nada. Las altas nuevas de tractores se replican solas
 * desde tractores.controller.js — esto es solo para los que ya estaban.
 *
 * Uso: npm run copiar-tractores-cc
 */
import mongoose from "mongoose";
import Tractor from "../src/models/Tractor.js";
import CentroCosto from "../src/models/CentroCosto.js";

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const tractores = await Tractor.find().sort({ cc: 1 }).lean();
console.log(`Tractores en la base: ${tractores.length}`);

let creados = 0;
let salteados = 0;

for (const t of tractores) {
  const cc = (t.cc || "").trim();
  if (!cc) continue;

  const existe = await CentroCosto.findOne({
    cc: new RegExp(`^${escapar(cc)}$`, "i"),
  });

  if (existe) {
    // Puede venir de una corrida anterior, cuando el CC no guardaba el enlace.
    if (!existe.tractor) {
      existe.tractor = t._id;
      await existe.save();
      console.log(`  ↻ CC ${cc} ya estaba: se completó el enlace al tractor`);
    } else {
      console.log(`  · CC ${cc} ya estaba en el listado`);
    }
    salteados++;
    continue;
  }

  await CentroCosto.create({
    cc,
    equipo: "Tractor",
    descripcion: t.descripcion || "",
    tractor: t._id,
  });
  creados++;
  console.log(`  ✓ CC ${cc} — ${t.descripcion || "sin descripción"}`);
}

console.log(`\nListo: ${creados} CC creados, ${salteados} ya existían.`);

await mongoose.disconnect();
