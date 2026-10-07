// Prueba del parte de varios lotes en el mismo día (07/10/2026). Crea sus
// propios datos y los borra por _id al final: no toca nada de lo cargado.
import mongoose from "mongoose";
import ParteDiario from "../src/models/ParteDiario.js";
import Lote from "../src/models/Lote.js";
import Tarea from "../src/models/Tarea.js";
import Personal from "../src/models/Personal.js";
import { recalcularLote, cierresDeLotes } from "../src/services/repartoLotes.service.js";

await mongoose.connect(process.env.MONGODB);

const creados = { partes: [], lotes: [] };
const salir = async (codigo = 0) => {
  await ParteDiario.deleteMany({ pagoDe: { $in: creados.partes } });
  await ParteDiario.deleteMany({ _id: { $in: creados.partes } });
  await Lote.deleteMany({ _id: { $in: creados.lotes } });
  await mongoose.disconnect();
  process.exit(codigo);
};

let fallas = 0;
const chequear = (titulo, obtenido, esperado) => {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas += 1;
  console.log(`${ok ? "OK  " : "MAL "} ${titulo}`);
  if (!ok) console.log(`      esperado ${JSON.stringify(esperado)} / obtenido ${JSON.stringify(obtenido)}`);
};

const ESTAB = "san-pablo";
const tarea = await Tarea.findOne({ tarea: "Fertilización" }).lean();
const persona = await Personal.findOne().lean();
if (!tarea || !persona) {
  console.log("Falta la tarea Fertilización o el personal");
  await salir(1);
}

const nuevoLote = async (nombre, plantas) => {
  const l = await Lote.create({ establecimiento: ESTAB, nombre, plantas });
  creados.lotes.push(l._id);
  return l;
};
// A tiene el doble de plantas que B: en un día compartido se lleva el doble
// de horas.
const A = await nuevoLote("ZZ varios A", 1000);
const B = await nuevoLote("ZZ varios B", 500);
const C = await nuevoLote("ZZ varios C", null);

const nuevoParte = async (fecha, totalHoras, datos) => {
  const p = await ParteDiario.create({
    establecimiento: ESTAB,
    fecha: new Date(fecha),
    persona: persona._id,
    tarea: tarea._id,
    totalHoras,
    ...datos,
  });
  creados.partes.push(p._id);
  return p;
};
const varios = (...nombres) => ({
  lote: nombres.join(", "),
  lotes: nombres.map((lote) => ({ lote, terminado: false, cantidad: null })),
});

const rehacer = (lote, fecha) =>
  recalcularLote({ establecimiento: ESTAB, tarea: tarea._id, lote, fecha });
const leer = (id) => ParteDiario.findById(id).select("cantidad repartido lotes terminado").lean();
const terminarEnVarios = (parte, indice, terminado) =>
  ParteDiario.updateOne({ _id: parte._id }, { [`lotes.${indice}.terminado`]: terminado, terminado });

// El 10/09 hizo A y B en 9 h; el 11/09 terminó A en 3 h.
const p1 = await nuevoParte("2026-09-10", 9, varios(A.nombre, B.nombre));
const p2 = await nuevoParte("2026-09-11", 3, { lote: A.nombre });

let r = await rehacer(A.nombre, p2.fecha);
chequear("A abierto: no reparte", r.estado, "nada");

// ── se termina A en un parte común ────────────────────────────────
await ParteDiario.updateOne({ _id: p2._id }, { terminado: true });
r = await rehacer(A.nombre, p2.fecha);
chequear("A terminado: reparte", r.estado, "repartido");
chequear("A: dos jornadas", r.jornadas, 2);
// p1 aporta 9 h × 1000/1500 = 6 h; p2, 3 h. 1000 plantas → 666,67 y 333,33,
// que enteras son 667 y 333.
let x1 = await leer(p1._id);
chequear("p1: lo de A va en su lote", x1.lotes.map((l) => l.cantidad), [667, null]);
chequear("p1: la cantidad es la suma", x1.cantidad, 667);
chequear("p1: marcado como repartido", x1.repartido, true);
chequear("p2: el resto", (await leer(p2._id)).cantidad, 333);

// ── se termina B dentro del parte de varios lotes ─────────────────
await terminarEnVarios(p1, 1, true);
r = await rehacer(B.nombre, p1.fecha);
chequear("B terminado: reparte", r.estado, "repartido");
chequear("B: una jornada", r.jornadas, 1);
x1 = await leer(p1._id);
chequear("p1: B se lleva sus 500", x1.lotes.map((l) => l.cantidad), [667, 500]);
chequear("p1: la cantidad suma los dos", x1.cantidad, 1167);

const cierres = await cierresDeLotes(ESTAB);
const delaPrueba = cierres.filter((c) => c.lote.startsWith("ZZ varios")).map((c) => `${c.lote}@${c.fecha}`).sort();
chequear("cierres: A el 11 y B el 10", delaPrueba, ["ZZ varios A@2026-09-11", "ZZ varios B@2026-09-10"]);

// ── A vuelve a estar en proceso: se borra solo lo de A ────────────
await ParteDiario.updateOne({ _id: p2._id }, { terminado: false });
r = await rehacer(A.nombre, p2.fecha);
chequear("A desmarcado: limpia", r.estado, "limpiado");
x1 = await leer(p1._id);
chequear("p1: B queda, A se borra", x1.lotes.map((l) => l.cantidad), [null, 500]);
chequear("p1: la cantidad es la de B", x1.cantidad, 500);
chequear("p2: sin cantidad", (await leer(p2._id)).cantidad, null);

// ── B en proceso: el parte queda sin nada ─────────────────────────
await terminarEnVarios(p1, 1, false);
await rehacer(B.nombre, p1.fecha);
x1 = await leer(p1._id);
chequear("todo desmarcado: sin cantidad", [x1.cantidad, x1.repartido], [null, false]);

// ── jornada de un mes anterior: el renglón de pago va con el lote solo ──
const p0 = await nuevoParte("2026-08-12", 6, varios(A.nombre, B.nombre));
await ParteDiario.updateOne({ _id: p2._id }, { terminado: true });
r = await rehacer(A.nombre, p2.fecha);
chequear("con agosto: tres jornadas", r.jornadas, 3);
chequear("una es de agosto", r.fueraDeMes, 1);
const renglon = await ParteDiario.findOne({ pagoDe: p0._id }).lean();
chequear("el renglón va con el lote A", renglon?.lote, A.nombre);
// p0 aporta 4 h, p1 6 h y p2 3 h: 13 h para 1000 plantas.
chequear("el renglón paga las 4 h de A", renglon?.cantidad, 308);
chequear("p0 se queda en agosto sin cantidad", (await leer(p0._id)).lotes.map((l) => l.cantidad), [null, null]);
chequear("y su observación dice sus horas de A", renglon?.observacion.endsWith("(4 hs)"), true);

// ── un lote sin plantas: las horas se dividen en partes iguales ───
const p3 = await nuevoParte("2026-09-15", 8, varios(A.nombre, C.nombre));
await ParteDiario.updateOne({ _id: p2._id }, { terminado: false });
await ParteDiario.updateOne({ _id: p3._id }, { "lotes.0.terminado": true, terminado: true });
r = await rehacer(A.nombre, p3.fecha);
// p0 4 h, p1 6 h, p3 8/2 = 4 h (C no tiene plantas), p2 3 h: 17 h.
chequear("sin medida de C: mitad y mitad", r.jornadas, 4);
// 4/17 de 1000 son 235,29: queda en 235. Las dos plantas que sobran van a las
// fracciones más grandes (p1 con 352,94 y p2 con 176,47).
chequear("p3 se lleva 4 de 17 h", (await leer(p3._id)).lotes.map((l) => l.cantidad), [235, null]);

console.log(fallas ? `\n${fallas} pruebas fallaron` : "\nTodas las pruebas pasaron");
await salir(fallas ? 1 : 0);
