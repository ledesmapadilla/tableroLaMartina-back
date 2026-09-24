// Prueba del horómetro de entrada: la lectura con la que quedó la máquina
// antes de la fecha del parte. Dos partes:
//   1. un CC que no es un equipo del padrón de Tractores: solo cuentan sus
//      partes;
//   2. un CC enlazado a un tractor: la lectura sale de todo el proyecto
//      (parte, service, reparación y carga manual).
// Crea sus propios datos y los borra por _id al final: no toca nada cargado.
import mongoose from "mongoose";
import ParteDiario from "../src/models/ParteDiario.js";
import Personal from "../src/models/Personal.js";
import CentroCosto from "../src/models/CentroCosto.js";
import Tractor from "../src/models/Tractor.js";
import ServiceTractor from "../src/models/ServiceTractor.js";
import TrabajoTractor from "../src/models/TrabajoTractor.js";
import HorometroTractor from "../src/models/HorometroTractor.js";
import { getUltimoHorometro } from "../src/controllers/partes.controller.js";
import { registrarLecturaDeParte } from "../src/controllers/horometrostractor.controller.js";
import { calcularUltimosHorometros } from "../src/controllers/servicestractor.controller.js";

await mongoose.connect(process.env.MONGODB);

const creados = [];
const basura = [];
const salir = async (codigo = 0) => {
  await ParteDiario.deleteMany({ _id: { $in: creados } });
  for (const { modelo, id } of basura) await modelo.deleteOne({ _id: id });
  await mongoose.disconnect();
  process.exit(codigo);
};

// Deja anotado lo que hay que borrar al final.
const temporal = async (modelo, datos) => {
  const doc = await modelo.create(datos);
  basura.push({ modelo, id: doc._id });
  return doc;
};

let fallas = 0;
const chequear = (titulo, obtenido, esperado) => {
  const ok = obtenido === esperado;
  if (!ok) fallas += 1;
  console.log(`${ok ? "OK  " : "MAL "} ${titulo} -> ${obtenido}`);
  if (!ok) console.log(`      esperado ${esperado}`);
};

const persona = await Personal.findOne().lean();
if (!persona) {
  console.log("No hay personal cargado");
  await salir(1);
}

console.log("\n── CC que no es un equipo del padrón: solo sus partes ──");

// Un CC inventado: así la prueba no se cruza con los partes de verdad.
const CC = new mongoose.Types.ObjectId();

const nuevoParte = async (fecha, horomIngreso, horomSalida) => {
  const p = await ParteDiario.create({
    establecimiento: "san-pablo",
    fecha: new Date(`${fecha}T00:00:00.000Z`),
    persona: persona._id,
    cc: CC,
    horomIngreso,
    horomSalida,
  });
  creados.push(p._id);
  return p;
};

// El CC trabajó el 5, el 10 y el 20. Los partes se crean desordenados a
// propósito: lo que manda es la fecha, no el orden de carga.
await nuevoParte("2026-09-10", 1200, 1210);
await nuevoParte("2026-09-05", 1180, 1200);
await nuevoParte("2026-09-20", 1210, 1240);

// Llama al endpoint como lo llama la planilla.
const pedir = async (fecha) => {
  let salida;
  await getUltimoHorometro(
    { params: { cc: String(CC) }, query: fecha ? { fecha } : {} },
    { json: (d) => (salida = d), status: () => ({ json: (d) => (salida = d) }) }
  );
  return salida?.horomSalida;
};

chequear("sin fecha: la última de todas", await pedir(), 1240);
chequear("un día entre medio (12): la del 10", await pedir("2026-09-12"), 1210);
chequear("el día siguiente al primero (6): la del 5", await pedir("2026-09-06"), 1200);
chequear("el mismo día que ya trabajó (10): la de ese día", await pedir("2026-09-10"), 1210);
chequear("antes del primer parte (1): ninguna", await pedir("2026-09-01"), null);
chequear("después del último (25): la del 20", await pedir("2026-09-25"), 1240);
chequear("meses después (2026-11-03): la del 20", await pedir("2026-11-03"), 1240);
chequear("fecha con basura: la última de todas", await pedir("no es fecha"), 1240);

// Un parte sin salida cargada no corta la cadena: se saltea.
await nuevoParte("2026-09-15", 1210, null);
chequear("con un día sin salida (16): la del 10", await pedir("2026-09-16"), 1210);

console.log("\n── CC enlazado a un tractor: la lectura sale de todo el proyecto ──");

// Tractor y CC propios de la prueba. El número no existe en el padrón, así que
// ninguna visita ni reparación de verdad se le cruza.
const tractor = await temporal(Tractor, { cc: "ZZ99", descripcion: "Prueba horómetro", gruppo: 8 });
const centro = await temporal(CentroCosto, {
  cc: "ZZ99",
  equipo: "Tractor",
  descripcion: "Prueba horómetro",
  tractor: tractor._id,
});

const parteDelTractor = async (fecha, horomIngreso, horomSalida) => {
  const p = await ParteDiario.create({
    establecimiento: "san-pablo",
    fecha: new Date(`${fecha}T00:00:00.000Z`),
    persona: persona._id,
    cc: centro._id,
    horomIngreso,
    horomSalida,
  });
  creados.push(p._id);
  return p;
};

const pedirDelTractor = async (fecha) => {
  let salida;
  await getUltimoHorometro(
    { params: { cc: String(centro._id) }, query: fecha ? { fecha } : {} },
    { json: (d) => (salida = d), status: () => ({ json: (d) => (salida = d) }) }
  );
  return salida;
};

// El 5 trabajó y dejó el horómetro en 500.
await parteDelTractor("2026-09-05", 480, 500);
let r = await pedirDelTractor("2026-09-08");
chequear("solo el parte (8): la salida del 5", r?.horometro, 500);
chequear("  y dice de dónde salió", r?.fuente, "parte");

// El 6 entró al taller y ahí le tomaron 530: esa es la que vale ahora.
await temporal(TrabajoTractor, {
  tractor: tractor._id,
  fecha: new Date("2026-09-06T00:00:00.000Z"),
  reparacion: "Prueba",
  horometro: "530",
});
r = await pedirDelTractor("2026-09-08");
chequear("después de la reparación (8): 530", r?.horometro, 530);
chequear("  y la fuente es la reparación", r?.fuente, "reparacion");

// La lectura del taller es posterior al 5: un parte de ese día no la ve.
r = await pedirDelTractor("2026-09-05");
chequear("un parte del 5 no ve la lectura del 6", r?.horometro, 500);

// El service del 7 la vuelve a mover.
await temporal(ServiceTractor, {
  tractor: tractor._id,
  cc: "ZZ99",
  fecha: new Date("2026-09-07T00:00:00.000Z"),
  horometro: 545,
});
r = await pedirDelTractor("2026-09-08");
chequear("después del service (8): 545", r?.horometro, 545);
chequear("  y la fuente es el service", r?.fuente, "service");

// Una carga manual del historial también entra.
await temporal(HorometroTractor, {
  tractor: tractor._id,
  cc: "ZZ99",
  fecha: new Date("2026-09-08T00:00:00.000Z"),
  horometro: 560,
  origen: "manual",
});
r = await pedirDelTractor("2026-09-09");
chequear("después de la carga manual (9): 560", r?.horometro, 560);

// Y el parte siguiente vuelve a ser la lectura más nueva.
await parteDelTractor("2026-09-09", 560, 575);
r = await pedirDelTractor("2026-09-10");
chequear("el parte del 9 manda el 10: 575", r?.horometro, 575);
chequear("  y la fuente vuelve a ser el parte", r?.fuente, "parte");

console.log("\n── La lectura del parte llega al historial de Mantenimiento ──");

// Al guardar un parte, la lectura se materializa para el preventivo. Un parte
// con solo la entrada cargada también deja la suya (22/09/2026).
const soloEntrada = await parteDelTractor("2026-09-11", 590, null);
await registrarLecturaDeParte(soloEntrada, { nuevo: true });
const materializada = await HorometroTractor.findOne({ parte: soloEntrada._id }).lean();
if (materializada) basura.push({ modelo: HorometroTractor, id: materializada._id });
chequear("parte con solo la entrada: deja la lectura", materializada?.horometro, 590);
chequear("  con origen produccion", materializada?.origen, "produccion");
r = await pedirDelTractor("2026-09-12");
chequear("y el próximo parte la arrastra (12): 590", r?.horometro, 590);

// Y es la que la tabla de preventivo muestra para ese CC.
const mapa = await calcularUltimosHorometros();
chequear("el preventivo ve la lectura del parte", mapa["ZZ99"]?.horometro, 590);
chequear("  y la marca como de certificaciones", mapa["ZZ99"]?.origen, "produccion");

console.log(fallas ? `\n${fallas} casos fallaron` : "\nTodos los casos pasaron");
await salir(fallas ? 1 : 0);
