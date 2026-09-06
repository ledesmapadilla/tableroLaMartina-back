/**
 * Carga inicial del personal de Producción, tomada de la planilla de tareas.
 *
 * Los nombres vienen sin DNI ni legajo, que no son obligatorios: quedan vacíos
 * y se completan después desde la pantalla.
 *
 * Es idempotente: los nombres que ya están en el listado se saltean.
 *
 * Uso: npm run cargar-personal
 */
import mongoose from "mongoose";
import Personal from "../src/models/Personal.js";

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const nombres = [
  "ALVAREZ, JONATAN IVAN",
  "BARRAZA, FRANCO",
  "BUSTOS, MAXIMILIANO",
  "CISNERO, LUIS",
  "CISNEROS, LUIS",
  "DIAZ, JOSE VITALINO",
  "DIAZ, VITALINO",
  "GONZALES, HUGO",
  "IÑIGO, NICOLAS",
  "JUAREZ, MARCELO",
  "LUNA, JUAN ANDRES",
  "MARCIAL, LUIS MARIO",
  "MARQUEZ, PEDRO RENE",
  "NIEVA, JORGE",
  "OLEA, JUAN",
  "OLEA, MIGUEL",
  "ORQUERA, MIGUEL",
  "PACHECO, FACUNDO",
  "PERALTA, OSCAR",
  "RODRIGUEZ, CRISTIAN",
  "RODRIGUEZ, CRISTIAN EXEQUIEL",
  "RUIZ, GABRIEL",
  "SANDOBAL, FELIPE JAVIER",
  "SANDOVAL, JAVIER",
  "SOSA, VICTOR DANIEL",
  "VALDEZ, OSCAR",
  "VILLALBA, GUSTAVO",
];

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB");

const ahora = new Date();
let creados = 0;
let salteados = 0;

for (const apellidoNombre of nombres) {
  const existe = await Personal.findOne({
    apellidoNombre: new RegExp(`^${escapar(apellidoNombre)}$`, "i"),
  });

  if (existe) {
    salteados++;
    console.log(`  · ${apellidoNombre} ya estaba en el listado`);
    continue;
  }

  await Personal.collection.insertOne({
    apellidoNombre,
    dni: "",
    legajo: "",
    createdAt: ahora,
    updatedAt: ahora,
  });
  creados++;
  console.log(`  ✓ ${apellidoNombre}`);
}

console.log(`\nListo: ${creados} personas creadas, ${salteados} ya existían.`);

await mongoose.disconnect();
