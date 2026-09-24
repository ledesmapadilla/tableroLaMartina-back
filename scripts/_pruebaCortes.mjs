// Prueba del corte entre meses (23/09/2026): el inicio de un mes es siempre el
// día siguiente al cierre del anterior, y mover uno corre el otro. Arma sus
// propios meses y partes en 2099 y los borra por _id.
// Uso: node --env-file .env scripts/_pruebaCortes.mjs
import mongoose from "mongoose";
import PeriodoCertificado from "../src/models/PeriodoCertificado.js";
import ParteDiario from "../src/models/ParteDiario.js";
import { guardarPeriodo } from "../src/controllers/periodos.controller.js";

await mongoose.connect(process.env.MONGODB);
const est = "san-pablo", A = 2099;
const put = (mes, body) => new Promise((ok) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { ok({ code: this.code, d }); } };
  guardarPeriodo({ params: { anio: A, mes }, query: { establecimiento: est }, body }, res);
});
const dia = (f) => (f ? new Date(f).toISOString().slice(0, 10) : null);
const leer = async (mes) => {
  const p = await PeriodoCertificado.findOne({ establecimiento: est, anio: A, mes }).lean();
  return p ? `${dia(p.desde)}..${dia(p.hasta)}` : "sin guardar";
};
let fallas = 0;
const ver = (nombre, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallas++;
  console.log(bien ? "ok   " : "FALLA", nombre, bien ? "" : `-> ${JSON.stringify(real)} (esperado ${JSON.stringify(esperado)})`);
};

// Un parte cualquiera, con los campos que pide el modelo.
const muestra = await ParteDiario.findOne({ establecimiento: est }).lean();
const parte = await ParteDiario.create({
  ...muestra, _id: undefined, createdAt: undefined, updatedAt: undefined,
  fecha: new Date("2099-08-25"), periodo: null, motivoFueraDeCierre: "",
  terminado: false, repartido: false, lote: "_prueba_cortes_",
});

try {
  let r = await put(8, { desde: "2099-07-26", hasta: "2099-08-25" });
  ver("guardar agosto", r.code, 200);
  r = await put(9, { desde: "2099-08-26", hasta: "2099-09-25" });
  ver("guardar septiembre", [r.code, r.d.cierreAnterior], [200, null]);

  // Mover el cierre de agosto al 24: septiembre arranca el 25 y el parte pasa.
  r = await put(8, { desde: "2099-07-26", hasta: "2099-08-24" });
  ver("agosto cierra 24 -> septiembre arranca 25", [r.code, await leer(9), r.d.partesMovidos], [200, "2099-08-25..2099-09-25", 1]);

  // Mover el inicio de septiembre al 26: agosto vuelve a cerrar el 25.
  r = await put(9, { desde: "2099-08-26", hasta: "2099-09-25" });
  ver("septiembre arranca 26 -> agosto cierra 25", [r.code, await leer(8), dia(r.d.cierreAnterior)], [200, "2099-07-26..2099-08-25", "2099-08-25"]);

  // Con septiembre cerrado también se corre, aunque le meta el parte del 25.
  r = await put(9, { desde: "2099-08-26", hasta: "2099-09-25", cerrado: true, fechaCierre: "2099-09-25" });
  r = await put(8, { desde: "2099-07-26", hasta: "2099-08-23" });
  ver(
    "agosto cierra 23 con sep cerrado -> sep arranca 24 y avisa",
    [r.code, await leer(9), r.d.siguienteCerrado, r.d.partesMovidos],
    [200, "2099-08-24..2099-09-25", true, 1]
  );

  // Pasarle por delante al otro mes se rechaza.
  r = await put(8, { desde: "2099-07-26", hasta: "2099-09-30" });
  ver("agosto cierra después del cierre de septiembre", r.code, 400);
  r = await put(9, { desde: "2099-07-20", hasta: "2099-09-25", cerrado: false });
  ver("septiembre arranca antes que agosto", r.code, 400);

  // Octubre sin guardar se encadena solo; julio sin guardar se guarda al moverse.
  r = await put(8, { desde: "2099-07-28", hasta: "2099-08-23" });
  ver("agosto arranca 28 -> julio se guarda cerrando 27", [r.code, await leer(7)], [200, "2099-06-26..2099-07-27"]);
} finally {
  await ParteDiario.deleteOne({ _id: parte._id });
  const ids = (await PeriodoCertificado.find({ establecimiento: est, anio: A }).select("_id").lean()).map((p) => p._id);
  await PeriodoCertificado.deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
}
console.log(fallas ? `${fallas} fallas` : "todo bien");
process.exit(fallas ? 1 : 0);
