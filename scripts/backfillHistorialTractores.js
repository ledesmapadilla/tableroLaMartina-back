// Reconstruye el historial de cambios del alta de tractores para las ediciones
// que se hicieron ANTES de que existiera la bitacora.
//
// De esas ediciones no quedo registro: lo unico que sobrevive es el estado
// actual de cada tractor mas sus timestamps. Entonces se reconstruye
// comparando el listado original de carga con lo que hay hoy en la base:
//
//   - alta          -> fecha createdAt, con los valores del listado original
//   - modificacion  -> fecha updatedAt, un renglon por campo que hoy difiere
//
// Todas las ediciones intermedias caen en la fecha de la ultima modificacion
// (updatedAt), que es la unica que Mongo conserva. Las filas quedan marcadas
// con origen "reconstruido" para distinguirlas de las que registra la app.
//
//   node --env-file .env scripts/backfillHistorialTractores.js           (simulacion)
//   node --env-file .env scripts/backfillHistorialTractores.js --apply   (escribe)
import mongoose from "mongoose";
import Tractor from "../src/models/Tractor.js";
import HistorialTractor from "../src/models/HistorialTractor.js";
import {
  CAMPOS_AUDITADOS,
  formatearValor,
  resumenTractor,
} from "../src/controllers/historialtractor.controller.js";

const APLICAR = process.argv.includes("--apply");

// Copia del listado con el que se cargo la flota (seedTractores.js). Se copia
// en vez de importarse porque ese archivo, al importarlo, borra la coleccion.
const GRUPOS = [
  { gruppo: 1, supervisores: ["jorge rosas"] },
  { gruppo: 2, supervisores: ["mario bustos"] },
  { gruppo: 3, supervisores: ["carlos chumiento"] },
  { gruppo: 4, supervisores: ["brandan alejandro", "alejandro brandan"] },
  { gruppo: 5, supervisores: ["elio rojas"] },
];

const resolverGruppo = (supervisor) => {
  if (!supervisor) return 6;
  const s = supervisor.toLowerCase().trim();
  for (const g of GRUPOS) {
    if (g.supervisores.includes(s)) return g.gruppo;
  }
  return 6;
};

const SEED = [
  { cc: "189",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "197",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "158",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "195",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "102",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "1103", descripcion: "manitou",                    supervisor: "Jorge Rosas" },
  { cc: "110",  descripcion: "tractor",                    supervisor: "Jorge Rosas" },
  { cc: "196",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "184",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "164",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "194",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "103",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "1102", descripcion: "manitou",                    supervisor: "Mario Bustos" },
  { cc: "166",  descripcion: "tractor",                    supervisor: "Mario Bustos" },
  { cc: "155",  descripcion: "tractor",                    supervisor: "Carlos Chumiento" },
  { cc: "185",  descripcion: "tractor",                    supervisor: "Carlos Chumiento" },
  { cc: "161",  descripcion: "tractor",                    supervisor: "brandan alejandro" },
  { cc: "165",  descripcion: "tractor",                    supervisor: "brandan alejandro" },
  { cc: "1104", descripcion: "manitou",                    supervisor: "brandan alejandro" },
  { cc: "193",  descripcion: "tractor",                    supervisor: "Elio Rojas" },
  { cc: "156",  descripcion: "tractor",                    supervisor: "Elio Rojas" },
  { cc: "167",  descripcion: "tractor",                    supervisor: "Elio Rojas" },
  { cc: "104",  descripcion: "Deutz 460",                  supervisor: "BERDINA" },
  { cc: "111",  descripcion: "Massey 251",                 supervisor: "SP" },
  { cc: "150",  descripcion: "VALTRA BF 75",               supervisor: "SP" },
  { cc: "151",  descripcion: "VALTRA BF 75",               supervisor: "BERDINA" },
  { cc: "153",  descripcion: "Valtra 75",                  supervisor: "BERDINA" },
  { cc: "154",  descripcion: "Valtra 75",                  supervisor: "BERDINA" },
  { cc: "157",  descripcion: "Case Farmal 75A DT",         supervisor: "SP" },
  { cc: "159",  descripcion: "JOHN DEERE 5065E TS",        supervisor: "BERDINA" },
  { cc: "160",  descripcion: "JOHN DEERE 5065E TS",        supervisor: "BERDINA" },
  { cc: "163",  descripcion: "Case 55",                    supervisor: "SP" },
  { cc: "170",  descripcion: "JOHN DEERE 5410",            supervisor: "BERDINA" },
  { cc: "171",  descripcion: "JOHN DEERE 5410",            supervisor: "BERDINA" },
  { cc: "174",  descripcion: "JOHN DEERE 5310",            supervisor: "SP" },
  { cc: "179",  descripcion: "JOHN DEERE 5310",            supervisor: "SP" },
  { cc: "183",  descripcion: "Massey Ferguson 2625 dt",    supervisor: "ALBERDI" },
  { cc: "186",  descripcion: "Massey Ferguson 2625",       supervisor: "BERDINA" },
  { cc: "187",  descripcion: "Case Farmal 75A",            supervisor: "BERDINA" },
  { cc: "188",  descripcion: "Case Farmal 75A",            supervisor: "SP" },
  { cc: "191",  descripcion: "John Deere 5065E",           supervisor: "BERDINA" },
  { cc: "192",  descripcion: "John Deere 5065E",           supervisor: "BERDINA" },
  { cc: "198",  descripcion: "CHERRY 58 RC",               supervisor: "SP" },
];

// Estado con el que quedo cada tractor recien cargado: el encargado general
// todavia no existia como campo, asi que arranca vacio.
const ORIGINALES = new Map(
  SEED.map((d) => [
    String(d.cc).trim(),
    { ...d, encargadoGral: "", gruppo: resolverGruppo(d.supervisor) },
  ])
);

const fechaCorta = (f) => (f ? new Date(f).toISOString().split("T")[0] : "-");

const uri = process.env.MONGODB;
if (!uri) {
  console.error("Falta MONGODB en el entorno. Usar: node --env-file .env scripts/backfillHistorialTractores.js");
  process.exit(1);
}

await mongoose.connect(uri);
console.log(`Conectado a MongoDB - modo ${APLICAR ? "APLICAR" : "SIMULACION"}\n`);

const tractores = await Tractor.find().sort({ cc: 1 }).lean();
const filas = [];
let saltados = 0;
let sinListado = 0;

for (const t of tractores) {
  const yaTiene = await HistorialTractor.countDocuments({ tractor: t._id });
  if (yaTiene > 0) {
    saltados++;
    continue;
  }

  const original = ORIGINALES.get(String(t.cc).trim());
  // Los que no estan en el listado original se dieron de alta despues, desde
  // la pantalla. De esos no hay valores previos: solo se asienta el alta.
  const inicial = original || { ...t };
  if (!original) sinListado++;

  filas.push({
    tractor: t._id,
    cc: inicial.cc || t.cc,
    accion: "alta",
    campo: "",
    campoLabel: "Alta de tractor",
    valorAnterior: "",
    valorNuevo: resumenTractor(inicial),
    fecha: t.createdAt || new Date(),
    origen: "reconstruido",
    observaciones: original
      ? "Carga inicial del listado de tractores"
      : "Alta posterior - valores reconstruidos del estado actual",
  });

  if (!original) continue;

  for (const { campo, label } of CAMPOS_AUDITADOS) {
    const antes = formatearValor(campo, inicial[campo]);
    const ahora = formatearValor(campo, t[campo]);
    if (antes === ahora) continue;

    filas.push({
      tractor: t._id,
      cc: inicial.cc || t.cc,
      accion: "modificacion",
      campo,
      campoLabel: label,
      valorAnterior: antes,
      valorNuevo: ahora,
      fecha: t.updatedAt || t.createdAt || new Date(),
      origen: "reconstruido",
      observaciones: "Cambio reconstruido - fecha de la ultima modificacion del tractor",
    });
  }
}

const altas = filas.filter((f) => f.accion === "alta").length;
const cambios = filas.length - altas;

console.log(`Tractores en la base:        ${tractores.length}`);
console.log(`Ya tenian historial:         ${saltados}`);
console.log(`Fuera del listado original:  ${sinListado}`);
console.log(`Altas a registrar:           ${altas}`);
console.log(`Cambios a registrar:         ${cambios}\n`);

filas
  .filter((f) => f.accion === "modificacion")
  .forEach((f) =>
    console.log(
      `  CC ${f.cc} - ${f.campoLabel}: "${f.valorAnterior || "-"}" -> "${f.valorNuevo || "-"}" (${fechaCorta(f.fecha)})`
    )
  );

if (!APLICAR) {
  console.log("\nSimulacion: no se escribio nada. Volver a correr con --apply para guardar.");
} else if (filas.length === 0) {
  console.log("\nNo hay nada para escribir.");
} else {
  await HistorialTractor.insertMany(filas);
  console.log(`\nListo: ${filas.length} registros de historial insertados.`);
}

await mongoose.disconnect();
