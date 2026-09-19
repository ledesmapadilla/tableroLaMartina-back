// Prueba del reparto por lote terminado. Crea sus propios datos y los borra
// por _id al final: no toca nada de lo que ya está cargado.
import mongoose from "mongoose";
import ParteDiario from "../src/models/ParteDiario.js";
import Lote from "../src/models/Lote.js";
import Tarea from "../src/models/Tarea.js";
import Personal from "../src/models/Personal.js";
import { recalcularLote, cierresDeLotes } from "../src/services/repartoLotes.service.js";

await mongoose.connect(process.env.MONGODB);

const creados = { partes: [], lotes: [] };
const salir = async (codigo = 0) => {
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
const tarea = await Tarea.findOne({ tarea: "Herbicida" }).lean();
const persona = await Personal.findOne().lean();
if (!tarea || !persona) {
  console.log("Falta la tarea Herbicida o el personal");
  await salir(1);
}

const lote = await Lote.create({
  establecimiento: ESTAB,
  nombre: "ZZ prueba reparto",
  plantas: 1000,
  hectareas: 20,
});
creados.lotes.push(lote._id);

const nuevoParte = async (fecha, totalHoras) => {
  const p = await ParteDiario.create({
    establecimiento: ESTAB,
    fecha: new Date(fecha),
    persona: persona._id,
    tarea: tarea._id,
    lote: "zz-prueba reparto", // se escribe distinto a propósito
    totalHoras,
  });
  creados.partes.push(p._id);
  return p;
};

const rehacer = (fecha) =>
  recalcularLote({ establecimiento: ESTAB, tarea: tarea._id, lote: lote.nombre, fecha });

const marcar = (parte, terminado) => ParteDiario.findByIdAndUpdate(parte._id, { terminado });

const leer = async (ids) =>
  Promise.all(
    ids.map(async (id) => {
      const p = await ParteDiario.findById(id).select("cantidad periodo repartido").lean();
      return { cantidad: p.cantidad, periodo: p.periodo, repartido: p.repartido };
    })
  );
const cantidades = async (ids) => (await leer(ids)).map((x) => x.cantidad);

// 4 h + 4 h + 2 h = 10 h -> 400 / 400 / 200 plantas.
const a = await nuevoParte("2026-08-10", 4);
const b = await nuevoParte("2026-08-20", 4);
const c = await nuevoParte("2026-09-10", 2);

// ── sin terminar no se reparte nada ────────────────────────────────
let r = await rehacer(c.fecha);
chequear("grupo abierto: no reparte", r.estado, "nada");

// ── se termina el lote ─────────────────────────────────────────────
await marcar(c, true);
r = await rehacer(c.fecha);
chequear("terminado: estado", r.estado, "repartido");
chequear("terminado: medida", r.medida, 1000);
chequear("terminado: jornadas", r.jornadas, 3);
chequear("terminado: mes del pago", r.mes, "2026-09");

let estado = await leer([a._id, b._id, c._id]);
chequear("cantidades repartidas", estado.map((x) => x.cantidad), [400, 400, 200]);
chequear("todas marcadas como repartidas", estado.map((x) => x.repartido), [true, true, true]);
chequear("las de agosto se mudan al mes del cierre", estado.map((x) => x.periodo), ["2026-09", "2026-09", null]);

// ── una jornada nueva en un grupo ya cerrado ───────────────────────
const d = await nuevoParte("2026-09-05", 10);
r = await rehacer(d.fecha);
chequear("jornada nueva: vuelve a repartir", r.estado, "repartido");
chequear("reparto con 20 h", await cantidades([a._id, b._id, d._id, c._id]), [200, 200, 500, 100]);

await ParteDiario.deleteOne({ _id: d._id });
await rehacer(d.fecha);
chequear("borrada la jornada, vuelve el reparto de 10 h", await cantidades([a._id, b._id, c._id]), [400, 400, 200]);

// ── otra jornada del MISMO día del cierre, cargada después ─────────
// El corte es por día: entra en el grupo aunque se haya cargado después del
// parte que lo terminó.
const e = await nuevoParte("2026-09-10", 2);
r = await rehacer(e.fecha);
chequear("jornada del día del cierre: entra al grupo", r.jornadas, 4);
chequear("reparto con 12 h", await cantidades([a._id, b._id, c._id, e._id]), [333.33, 333.33, 166.67, 166.67]);

// ── dos personas dan por terminado el mismo lote y la misma tarea ──
await marcar(e, true);
r = await rehacer(e.fecha);
chequear("dos cierres el mismo día: sigue siendo uno", r.jornadas, 4);
chequear("dos cierres: el reparto no cambia", await cantidades([a._id, b._id, c._id, e._id]), [333.33, 333.33, 166.67, 166.67]);

await marcar(c, false);
r = await rehacer(c.fecha);
chequear("se desmarca uno de los dos: sigue cerrado", r.estado, "repartido");
chequear("y el reparto se mantiene", await cantidades([a._id, b._id, c._id, e._id]), [333.33, 333.33, 166.67, 166.67]);

await marcar(e, false);
r = await rehacer(e.fecha);
chequear("se desmarca el otro: recién ahí se limpia", r.estado, "limpiado");
chequear("cantidades borradas", await cantidades([a._id, b._id, c._id, e._id]), [null, null, null, null]);

await ParteDiario.deleteOne({ _id: e._id });
creados.partes = creados.partes.filter((id) => String(id) !== String(e._id));
await marcar(c, true);
await rehacer(c.fecha);
chequear("vuelto al cierre de siempre", await cantidades([a._id, b._id, c._id]), [400, 400, 200]);

// ── segunda pasada: grupo nuevo ────────────────────────────────────
const f = await nuevoParte("2026-09-20", 3);
const g = await nuevoParte("2026-09-22", 1);
await marcar(g, true);
r = await rehacer(g.fecha);
chequear("segunda pasada: solo las jornadas nuevas", r.jornadas, 2);
chequear("la primera pasada no se toca", (await cantidades([a._id]))[0], 400);
chequear("la segunda reparte de nuevo las 1000", await cantidades([f._id, g._id]), [750, 250]);

// ── se desmarca el segundo cierre ──────────────────────────────────
await marcar(g, false);
r = await rehacer(g.fecha);
chequear("desmarcado: limpia", r.estado, "limpiado");
estado = await leer([f._id, g._id]);
chequear("cantidades borradas", estado.map((x) => x.cantidad), [null, null]);
chequear("sin marca de repartido", estado.map((x) => x.repartido), [false, false]);

// ── se desmarca el primer cierre ───────────────────────────────────
await marcar(c, false);
await rehacer(c.fecha);
estado = await leer([a._id, b._id, c._id]);
chequear("todo el grupo vuelve atrás", estado.map((x) => x.cantidad), [null, null, null]);
chequear("y vuelve a su mes", estado.map((x) => x.periodo), [null, null, null]);

// ── el listado de cierres que usa la planilla ──────────────────────
await marcar(c, true);
await rehacer(c.fecha);
const cierres = await cierresDeLotes(ESTAB);
const nuestro = cierres.find((x) => x.lote === "zz-prueba reparto" && x.tarea === String(tarea._id));
chequear("el cierre queda listado, con su fecha", nuestro?.fecha, "2026-09-10");
chequear("Caspinchango no lista cierres", await cierresDeLotes("caspinchango"), []);

// ── lote sin medida cargada ────────────────────────────────────────
await Lote.findByIdAndUpdate(lote._id, { plantas: null });
r = await rehacer(c.fecha);
chequear("sin plantas cargadas: avisa", Boolean(r.aviso), true);
console.log(`      aviso: ${r.aviso}`);

console.log(fallas ? `\n${fallas} pruebas fallaron` : "\nTodas las pruebas pasaron");
await salir(fallas ? 1 : 0);
