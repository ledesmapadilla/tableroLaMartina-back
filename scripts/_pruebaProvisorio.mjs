// Prueba de los valores provisorios (30/09/2026): el parte que se carga a la
// mañana como ayudamemoria, sin validar, y se completa al terminar la jornada.
//   1. un provisorio se guarda con solo la fecha y la persona;
//   2. con un día en provisorio no se le carga otro a esa persona, ni
//      provisorio ni completo; cada campo va por su cuenta;
//   3. al apagarlo vuelven todas las validaciones;
//   4. su horómetro no es una lectura de la máquina hasta que se lo completa.
// Crea sus propios datos —hasta una persona, un tractor y un CC "ZZ97"— con
// fechas de 2099, y los borra por _id al final: no toca nada cargado.
import mongoose from "mongoose";
import ParteDiario from "../src/models/ParteDiario.js";
import Personal from "../src/models/Personal.js";
import Tarea from "../src/models/Tarea.js";
import CentroCosto from "../src/models/CentroCosto.js";
import Tractor from "../src/models/Tractor.js";
import HorometroTractor from "../src/models/HorometroTractor.js";
import { create, update, getUltimoHorometro } from "../src/controllers/partes.controller.js";

await mongoose.connect(process.env.MONGODB);

const creados = [];
const basura = [];
const salir = async (codigo = 0) => {
  await HorometroTractor.deleteMany({ parte: { $in: creados } });
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

// Llama al controlador como lo llama la planilla.
const llamar = async (accion, req) => {
  const salida = { status: 200, cuerpo: null };
  const res = {
    status: (codigo) => {
      salida.status = codigo;
      return res;
    },
    json: (cuerpo) => {
      salida.cuerpo = cuerpo;
      return res;
    },
  };
  await accion(req, res);
  if (accion === create && salida.cuerpo?._id) creados.push(salida.cuerpo._id);
  return salida;
};
const alta = (body) => llamar(create, { body });
const edicion = (id, body) => llamar(update, { params: { id: String(id) }, body });

const tarea = await Tarea.findOne().lean();
if (!tarea) {
  console.log("No hay tareas cargadas");
  await salir(1);
}

try {
  // Persona propia de la prueba: así no se cruza con los provisorios de nadie.
  const persona = await temporal(Personal, {
    apellidoNombre: "Zz Prueba, Provisorio",
    dni: "ZZ-PRUEBA-PROVISORIO",
  });
  const base = { establecimiento: "caspinchango", persona: String(persona._id) };
  const completo = { tarea: String(tarea._id), cantidad: 5, horaIngreso: "08:00", horaEgreso: "12:00" };

  console.log("\n── Un provisorio se guarda sin validar ──");

  const sinNada = await alta({ ...base, fecha: "2099-03-10" });
  chequear("sin provisorio y sin tarea: no entra", sinNada.status, 400);

  const p1 = await alta({ ...base, fecha: "2099-03-10", provisorio: true, horaIngreso: "08:00" });
  chequear("provisorio con solo fecha, persona y entrada", p1.status, 201);
  chequear("queda marcado provisorio", p1.cuerpo?.provisorio, true);

  const sinPersona = await alta({ establecimiento: "caspinchango", fecha: "2099-03-10", provisorio: true });
  chequear("provisorio sin persona: no entra", sinPersona.status, 400);

  const pisado = await alta({
    ...base,
    fecha: "2099-03-10",
    provisorio: true,
    horaIngreso: "08:00",
    horaEgreso: "12:00",
    horaIngreso2: "11:00",
    horaEgreso2: "18:00",
    lote: "ZZ",
    terminado: true,
  });
  chequear("provisorio con los tramos pisados: entra igual", pisado.status, 201);
  chequear("un provisorio no da el lote por terminado", pisado.cuerpo?.terminado, false);

  console.log("\n── Un solo día en provisorio por persona ──");

  const otroDia = await alta({ ...base, fecha: "2099-03-11", provisorio: true });
  chequear("otro día en provisorio con el anterior sin completar", otroDia.status, 409);
  chequear("el motivo del rechazo", otroDia.cuerpo?.motivo, "PROVISORIO_PENDIENTE");
  console.log(`      ${otroDia.cuerpo?.error}`);

  // Los dos campos son independientes: el día pendiente de Berdina no frena a
  // San Pablo, que lleva su propia cuenta.
  const otroCampo = await alta({ ...base, establecimiento: "san-pablo", fecha: "2099-03-11", provisorio: true });
  chequear("en el otro campo sí: cada uno va por su cuenta", otroCampo.status, 201);
  const otroCampoOtroDia = await alta({ ...base, establecimiento: "san-pablo", fecha: "2099-03-12", provisorio: true });
  chequear("pero en ese campo tampoco van dos días", otroCampoOtroDia.status, 409);

  // Tampoco un parte completo: hasta cerrar el provisorio no se carga otro día.
  const realOtroDia = await alta({ ...base, ...completo, fecha: "2099-03-11" });
  chequear("un parte completo de otro día tampoco entra", realOtroDia.status, 409);
  chequear("el motivo del rechazo", realOtroDia.cuerpo?.motivo, "PROVISORIO_PENDIENTE");
  const realMismoDia = await alta({ ...base, ...completo, fecha: "2099-03-10" });
  chequear("un parte completo del mismo día sí", realMismoDia.status, 201);

  // Lo que ya estaba cargado de otro día se puede corregir, pero no mudar.
  const viejo = await ParteDiario.create({
    establecimiento: "caspinchango",
    persona: persona._id,
    fecha: new Date("2099-03-02T00:00:00.000Z"),
    tarea: tarea._id,
    cantidad: 3,
  });
  creados.push(viejo._id);
  const corregido = await edicion(viejo._id, { ...base, ...completo, fecha: "2099-03-02", cantidad: 4 });
  chequear("corregir un parte completo de otro día sí se puede", corregido.status, 200);
  const mudado = await edicion(viejo._id, { ...base, ...completo, fecha: "2099-03-03" });
  chequear("pero no cambiarle la fecha a otro día", mudado.status, 409);

  console.log("\n── Al apagarlo vuelven las validaciones ──");

  const apagadoSinDatos = await edicion(p1.cuerpo._id, { ...base, fecha: "2099-03-10", provisorio: false });
  chequear("apagar provisorio sin tarea ni cantidad: no entra", apagadoSinDatos.status, 400);

  const completado = await edicion(p1.cuerpo._id, { ...base, ...completo, fecha: "2099-03-10", provisorio: false });
  chequear("completado con los datos reales", completado.status, 200);
  chequear("deja de ser provisorio", completado.cuerpo?.provisorio, false);

  const todaviaNo = await alta({ ...base, fecha: "2099-03-11", provisorio: true });
  chequear("queda otro provisorio del día 10: sigue sin poder", todaviaNo.status, 409);

  const mismoDia = await edicion(pisado.cuerpo._id, {
    ...base,
    fecha: "2099-03-10",
    provisorio: true,
    horaIngreso: "08:00",
    horaEgreso: "13:00",
  });
  chequear("editar el provisorio de ese mismo día sí se puede", mismoDia.status, 200);

  const completado2 = await edicion(pisado.cuerpo._id, { ...base, ...completo, fecha: "2099-03-10", provisorio: false });
  chequear("completado el segundo", completado2.status, 200);

  const ahoraSi = await alta({ ...base, fecha: "2099-03-11", provisorio: true });
  chequear("con el día 10 completo, el 11 ya puede ir en provisorio", ahoraSi.status, 201);

  console.log("\n── El horómetro de un provisorio no es una lectura ──");

  const tractor = await temporal(Tractor, { cc: "ZZ97", descripcion: "Prueba provisorio", gruppo: 8 });
  const centro = await temporal(CentroCosto, {
    cc: "ZZ97",
    equipo: "Tractor",
    descripcion: "Prueba provisorio",
    tractor: tractor._id,
  });
  const conCC = { ...base, cc: String(centro._id) };
  const lecturaDel = (id) => HorometroTractor.countDocuments({ parte: id });
  const ultimo = async (fecha) => {
    const r = await llamar(getUltimoHorometro, { params: { cc: String(centro._id) }, query: { fecha } });
    return r.cuerpo?.horometro;
  };

  // La lectura anterior de la máquina la deja otra persona: la de la prueba
  // tiene el día 11 en provisorio y no se le puede cargar otro día.
  const otraPersona = await temporal(Personal, {
    apellidoNombre: "Zz Prueba, Provisorio Dos",
    dni: "ZZ-PRUEBA-PROVISORIO-2",
  });
  const real = await alta({
    ...conCC,
    ...completo,
    persona: String(otraPersona._id),
    fecha: "2099-03-05",
    horomIngreso: 1000,
    horomSalida: 1010,
  });
  chequear("parte real con horómetro 1000 → 1010", real.status, 201);
  chequear("deja su lectura", await lecturaDel(real.cuerpo._id), 1);

  // Un horómetro que retrocede: en un parte común no entra.
  const retrocede = { ...conCC, fecha: "2099-03-11", horomIngreso: 900, horomSalida: 905 };
  const prov = await edicion(ahoraSi.cuerpo._id, { ...retrocede, provisorio: true });
  chequear("provisorio con un horómetro que retrocede: entra igual", prov.status, 200);
  chequear("no deja lectura", await lecturaDel(ahoraSi.cuerpo._id), 0);
  chequear("la máquina sigue en 1010", await ultimo("2099-03-12"), 1010);

  const malCompletado = await edicion(ahoraSi.cuerpo._id, { ...retrocede, ...completo, provisorio: false });
  chequear("completarlo con ese horómetro: ahora sí se rechaza", malCompletado.status, 409);
  chequear("el motivo del rechazo", malCompletado.cuerpo?.motivo, "HOROMETRO_RETROCEDE");

  const bienCompletado = await edicion(ahoraSi.cuerpo._id, {
    ...conCC,
    ...completo,
    fecha: "2099-03-11",
    horomIngreso: 1010,
    horomSalida: 1020,
    provisorio: false,
  });
  chequear("completado con el horómetro real", bienCompletado.status, 200);
  chequear("ahora deja su lectura", await lecturaDel(ahoraSi.cuerpo._id), 1);
  chequear("la máquina queda en 1020", await ultimo("2099-03-12"), 1020);

  const vuelta = await edicion(ahoraSi.cuerpo._id, { ...conCC, fecha: "2099-03-11", horomIngreso: 1010, provisorio: true });
  chequear("vuelve a provisorio", vuelta.status, 200);
  chequear("y se lleva su lectura", await lecturaDel(ahoraSi.cuerpo._id), 0);
  chequear("la máquina vuelve a 1010", await ultimo("2099-03-12"), 1010);
} catch (e) {
  fallas += 1;
  console.error("La prueba se cortó:", e);
}

console.log(fallas ? `\n${fallas} casos fallaron` : "\nTodos los casos pasaron");
await salir(fallas ? 1 : 0);
