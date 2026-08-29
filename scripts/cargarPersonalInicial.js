/**
 * Carga inicial del personal de Producción, tomada de la planilla de tareas.
 *
 * Los nombres vienen sin DNI: se insertan directo con el driver, salteando la
 * validación de Mongoose, porque en la app el DNI es obligatorio. Al editar
 * cualquiera de estas personas desde la pantalla habrá que completarlo.
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

  // insertOne del driver: no pasa por el required del schema.
  await Personal.collection.insertOne({
    apellidoNombre,
    dni: "",
    createdAt: ahora,
    updatedAt: ahora,
  });
  creados++;
  console.log(`  ✓ ${apellidoNombre}`);
}

console.log(`\nListo: ${creados} personas creadas, ${salteados} ya existían.`);

await mongoose.disconnect();
