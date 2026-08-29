/**
 * Copia las camionetas ya dadas de alta al listado de CC de Producción.
 *
 * La camioneta se identifica por su patente, así que esa es la que queda como
 * CC, con la marca y el modelo como descripción.
 *
 * Es idempotente: los CC que ya existen se saltean, así se puede volver a
 * correr sin duplicar nada. Las altas nuevas se replican solas desde
 * camionetas.controller.js — esto es solo para las que ya estaban.
 *
 * Uso: npm run copiar-camionetas-cc
 */
import mongoose from "mongoose";
import Camioneta from "../src/models/Camioneta.js";
import CentroCosto from "../src/models/CentroCosto.js";

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const camionetas = await Camioneta.find().sort({ patente: 1 }).lean();
console.log(`Camionetas en la base: ${camionetas.length}`);

let creados = 0;
let salteados = 0;

for (const c of camionetas) {
  const cc = (c.patente || "").trim();
  if (!cc) continue;

  const existe = await CentroCosto.findOne({
    cc: new RegExp(`^${escapar(cc)}$`, "i"),
  });

  if (existe) {
    salteados++;
    console.log(`  · CC ${cc} ya estaba en el listado`);
    continue;
  }

  const descripcion = [c.marca, c.modelo].filter(Boolean).join(" ").trim();
  await CentroCosto.create({ cc, equipo: "Camioneta", descripcion });
  creados++;
  console.log(`  ✓ CC ${cc} — ${descripcion || "sin descripción"}`);
}

console.log(`\nListo: ${creados} CC creados, ${salteados} ya existían.`);

await mongoose.disconnect();
