import IngresoSanPablo from "../models/IngresoSanPablo.js";
import CentroCosto from "../models/CentroCosto.js";

const POPULATE = { path: "cc", select: "cc equipo descripcion" };

const CARROS = "carros-porta-escaleras";
const ESCALERAS = "escaleras";

const limpiar = (v) => String(v ?? "").trim();
const numero = (v) => (v === "" || v == null ? null : Number(v));

// Solo los campos que se cargan en pantalla: el tipo se fija al crear.
const datosDe = (body) => {
  const datos = {};
  if ("cc" in body) datos.cc = body.cc || null;
  if ("fechaIngreso" in body) datos.fechaIngreso = body.fechaIngreso || null;
  if ("ingresadoPor" in body) datos.ingresadoPor = limpiar(body.ingresadoPor);
  if ("revisada" in body) datos.revisada = Boolean(body.revisada);
  if ("planMantenimiento" in body) datos.planMantenimiento = Boolean(body.planMantenimiento);
  if ("cantidadEscaleras" in body) datos.cantidadEscaleras = numero(body.cantidadEscaleras);
  if ("escalerasSanas" in body) datos.escalerasSanas = numero(body.escalerasSanas);
  if ("escalerasRotas" in body) datos.escalerasRotas = numero(body.escalerasRotas);
  if ("escalerasReparadas" in body) datos.escalerasReparadas = numero(body.escalerasReparadas);
  if ("motivo" in body) datos.motivo = limpiar(body.motivo);
  if ("avisadoA" in body) datos.avisadoA = limpiar(body.avisadoA);
  if ("observaciones" in body) datos.observaciones = limpiar(body.observaciones);
  return datos;
};

const ccInexistente = async (id) => Boolean(id) && !(await CentroCosto.exists({ _id: id }));

// ── Escaleras ──
// Cada ingreso de un carro porta escaleras da ingreso solo a sus escaleras:
// una fila en Escaleras enlazada por `origen`, con el mismo carro, fecha,
// quién y cantidad. Esos datos los manda el carro; en Escaleras se cargan
// sanas, rotas y observaciones.

const DEL_CARRO = ["cosecha", "cc", "fechaIngreso", "ingresadoPor", "cantidadEscaleras"];

const sincronizarEscaleras = async (carro) => {
  const datos = Object.fromEntries(DEL_CARRO.map((campo) => [campo, carro[campo]]));
  await IngresoSanPablo.findOneAndUpdate(
    { tipo: ESCALERAS, origen: carro._id },
    { $set: datos, $setOnInsert: { tipo: ESCALERAS, origen: carro._id } },
    { upsert: true, runValidators: true }
  );
};

// Y al revés: cada retiro de escaleras anota la salida en Carros porta
// escaleras, una fila enlazada por `origen` con el carro que se las lleva.
const DEL_RETIRO = ["cosecha", "cc", "fechaIngreso", "ingresadoPor", "cantidadEscaleras"];

const sincronizarSalida = async (retiro) => {
  const datos = Object.fromEntries(DEL_RETIRO.map((campo) => [campo, retiro[campo]]));
  await IngresoSanPablo.findOneAndUpdate(
    { tipo: CARROS, origen: retiro._id },
    { $set: datos, $setOnInsert: { tipo: CARROS, origen: retiro._id, salida: true } },
    { upsert: true, runValidators: true }
  );
};

// Sanas y rotas no pueden sumar más que las que trajo el carro, ni las
// reparadas ser más que las rotas.
const controlarCantidades = ({ cantidadEscaleras, escalerasSanas, escalerasRotas, escalerasReparadas }) => {
  const total = (escalerasSanas ?? 0) + (escalerasRotas ?? 0);
  if (cantidadEscaleras != null && total > cantidadEscaleras) {
    return `Sanas y rotas suman ${total}, y el carro trajo ${cantidadEscaleras}`;
  }
  if ((escalerasReparadas ?? 0) > (escalerasRotas ?? 0)) {
    return `Las reparadas (${escalerasReparadas}) no pueden ser más que las rotas (${escalerasRotas ?? 0})`;
  }
  return null;
};

// Lo que se carga en "Nuevas escaleras" y en "Retiro de escaleras".
const DE_NUEVAS = ["fechaIngreso", "ingresadoPor", "cantidadEscaleras", "observaciones"];
const DE_RETIRO = [...DE_NUEVAS, "cc"];
// Lo que se carga en "Baja de escaleras".
const DE_BAJA = ["fechaIngreso", "cantidadEscaleras", "motivo", "ingresadoPor", "avisadoA"];

// Una baja necesita cantidad, motivo, quién las desecha y a quién se avisó.
const controlarBaja = ({ cantidadEscaleras, motivo, ingresadoPor, avisadoA }) => {
  if (!(cantidadEscaleras > 0)) return "Poné cuántas escaleras se dan de baja";
  if (!motivo) return "Poné el motivo de la baja";
  if (!ingresadoPor) return "Poné quién desecha las escaleras";
  if (!avisadoA) return "Poné a quién se avisó de la baja";
  return null;
};

const soloCampos = (datos, campos) => Object.fromEntries(campos.filter((c) => c in datos).map((c) => [c, datos[c]]));

// No salen (por retiro o por baja) más escaleras de las que quedan en la
// cosecha: las que entraron con los carros y las nuevas, menos las que ya
// salieron. `ignorarId` es el movimiento que se está editando.
const controlarSalida = async (cosecha, cantidad, accion, ignorarId = null) => {
  const filas = await IngresoSanPablo.find({ cosecha, tipo: ESCALERAS, _id: { $ne: ignorarId } }).lean();
  const sale = (f) => f.retiro || f.baja;
  const entraron = filas.filter((f) => !sale(f)).reduce((t, f) => t + (f.cantidadEscaleras || 0), 0);
  const salieron = filas.filter(sale).reduce((t, f) => t + (f.cantidadEscaleras || 0), 0);
  const quedan = entraron - salieron;
  return cantidad > quedan
    ? `Quedan ${quedan} escaleras en la cosecha ${cosecha}: no se pueden ${accion} ${cantidad}`
    : null;
};

// La cosecha se fija al crear el ingreso y no cambia.
const cosechaDe = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 2027 ? n : null;
};
const avisoCosecha = { error: "Falta la cosecha del ingreso" };

// Un carro porta escaleras entra una sola vez por cosecha (las salidas de los
// retiros no cuentan). `ignorarId` es el ingreso que se está editando.
const carroYaIngresado = async (cosecha, cc, ignorarId = null) => {
  if (!cc) return null;
  const otro = await IngresoSanPablo.findOne({ cosecha, tipo: CARROS, cc, salida: { $ne: true }, _id: { $ne: ignorarId } })
    .populate(POPULATE)
    .lean();
  return otro ? `El carro ${otro.cc?.cc || ""} ya tiene un ingreso en la cosecha ${cosecha}` : null;
};

// GET /?cosecha=2027&tipo=manitous — los más nuevos primero.
export const getAll = async (req, res) => {
  try {
    const filtro = {};
    if (req.query.tipo) filtro.tipo = req.query.tipo;
    if (req.query.cosecha) filtro.cosecha = Number(req.query.cosecha);
    const ingresos = await IngresoSanPablo.find(filtro)
      .sort({ fechaIngreso: -1, createdAt: -1 })
      .populate(POPULATE);
    res.json(ingresos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const cosecha = cosechaDe(req.body.cosecha);
    if (!cosecha) return res.status(400).json(avisoCosecha);
    // En Escaleras se dan de alta bajas, retiros y nuevas: las que vienen en un
    // carro entran solas con el ingreso del carro.
    if (req.body.tipo === ESCALERAS && req.body.baja) {
      const datos = soloCampos(datosDe(req.body), DE_BAJA);
      const falta = controlarBaja(datos);
      if (falta) return res.status(400).json({ error: falta });
      const aviso = await controlarSalida(cosecha, datos.cantidadEscaleras, "dar de baja");
      if (aviso) return res.status(400).json({ error: aviso });
      const ingreso = await IngresoSanPablo.create({ ...datos, cosecha, tipo: ESCALERAS, baja: true, cc: null });
      return res.status(201).json(ingreso);
    }
    if (req.body.tipo === ESCALERAS && req.body.retiro) {
      const datos = soloCampos(datosDe(req.body), DE_RETIRO);
      if (!(datos.cantidadEscaleras > 0)) return res.status(400).json({ error: "Poné cuántas escaleras se retiran" });
      if (!datos.cc || (await ccInexistente(datos.cc))) {
        return res.status(400).json({ error: "Elegí el carro porta escaleras del retiro" });
      }
      const aviso = await controlarSalida(cosecha, datos.cantidadEscaleras, "retirar");
      if (aviso) return res.status(400).json({ error: aviso });
      const ingreso = await IngresoSanPablo.create({ ...datos, cosecha, tipo: ESCALERAS, retiro: true });
      try {
        await sincronizarSalida(ingreso);
      } catch (error) {
        // Sin la salida en su carro el retiro quedaría a medias.
        await IngresoSanPablo.findByIdAndDelete(ingreso._id);
        throw error;
      }
      return res.status(201).json(await ingreso.populate(POPULATE));
    }
    if (req.body.tipo === ESCALERAS) {
      const datos = soloCampos(datosDe(req.body), DE_NUEVAS);
      if (!(datos.cantidadEscaleras > 0)) return res.status(400).json({ error: "Poné cuántas escaleras nuevas son" });
      const ingreso = await IngresoSanPablo.create({ ...datos, cosecha, tipo: ESCALERAS, nuevas: true, cc: null });
      return res.status(201).json(ingreso);
    }
    const datos = { ...datosDe(req.body), cosecha, tipo: req.body.tipo };
    if (await ccInexistente(datos.cc)) return res.status(400).json({ error: "El CC no existe" });
    if (datos.tipo === CARROS) {
      const repetido = await carroYaIngresado(cosecha, datos.cc);
      if (repetido) return res.status(400).json({ error: repetido });
    }
    const ingreso = await IngresoSanPablo.create(datos);
    if (ingreso.tipo === CARROS) {
      try {
        await sincronizarEscaleras(ingreso);
      } catch (error) {
        // Sin sus escaleras el ingreso del carro quedaría a medias.
        await IngresoSanPablo.findByIdAndDelete(ingreso._id);
        throw error;
      }
    }
    res.status(201).json(await ingreso.populate(POPULATE));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const actual = await IngresoSanPablo.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "Ingreso no encontrado" });

    if (actual.tipo === CARROS && actual.salida) {
      return res.status(400).json({ error: "Es la salida de un retiro: se cambia en Escaleras" });
    }

    let datos = datosDe(req.body);
    if (actual.tipo === ESCALERAS && actual.baja) {
      datos = soloCampos(datos, DE_BAJA);
      const falta = controlarBaja({ ...actual.toObject(), ...datos });
      if (falta) return res.status(400).json({ error: falta });
      if ("cantidadEscaleras" in datos) {
        const aviso = await controlarSalida(actual.cosecha, datos.cantidadEscaleras, "dar de baja", actual._id);
        if (aviso) return res.status(400).json({ error: aviso });
      }
    } else if (actual.tipo === ESCALERAS && actual.retiro) {
      datos = soloCampos(datos, DE_RETIRO);
      if ("cantidadEscaleras" in datos) {
        if (!(datos.cantidadEscaleras > 0)) return res.status(400).json({ error: "Poné cuántas escaleras se retiran" });
        const aviso = await controlarSalida(actual.cosecha, datos.cantidadEscaleras, "retirar", actual._id);
        if (aviso) return res.status(400).json({ error: aviso });
      }
      if ("cc" in datos && !datos.cc) return res.status(400).json({ error: "Elegí el carro porta escaleras del retiro" });
    } else if (actual.tipo === ESCALERAS && actual.nuevas) {
      datos = soloCampos(datos, DE_NUEVAS);
      if ("cantidadEscaleras" in datos && !(datos.cantidadEscaleras > 0)) {
        return res.status(400).json({ error: "Poné cuántas escaleras nuevas son" });
      }
    } else if (actual.tipo === ESCALERAS && actual.origen) {
      for (const campo of DEL_CARRO) delete datos[campo];
      const aviso = controlarCantidades({ ...actual.toObject(), ...datos });
      if (aviso) return res.status(400).json({ error: aviso });
    }
    if (actual.tipo === CARROS && "cantidadEscaleras" in datos) {
      const escaleras = await IngresoSanPablo.findOne({ tipo: ESCALERAS, origen: actual._id }).lean();
      const aviso = escaleras && controlarCantidades({ ...escaleras, cantidadEscaleras: datos.cantidadEscaleras });
      if (aviso) return res.status(400).json({ error: `${aviso}: corregí primero Escaleras` });
    }
    if (await ccInexistente(datos.cc)) return res.status(400).json({ error: "El CC no existe" });
    if (actual.tipo === CARROS && "cc" in datos) {
      const repetido = await carroYaIngresado(actual.cosecha, datos.cc, actual._id);
      if (repetido) return res.status(400).json({ error: repetido });
    }

    const ingreso = await IngresoSanPablo.findByIdAndUpdate(req.params.id, datos, {
      returnDocument: "after",
      runValidators: true,
    }).populate(POPULATE);
    if (ingreso.tipo === CARROS) await sincronizarEscaleras({ ...ingreso.toObject(), cc: ingreso.cc?._id });
    if (ingreso.retiro) await sincronizarSalida({ ...ingreso.toObject(), cc: ingreso.cc?._id });
    res.json(ingreso);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const actual = await IngresoSanPablo.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "Ingreso no encontrado" });
    if (actual.tipo === ESCALERAS && actual.origen) {
      return res
        .status(400)
        .json({ error: "Estas escaleras entraron con un carro: se borran borrando el ingreso del carro" });
    }
    if (actual.tipo === CARROS && actual.salida) {
      return res.status(400).json({ error: "Es la salida de un retiro: se borra borrando el retiro en Escaleras" });
    }
    await actual.deleteOne();
    if (actual.tipo === CARROS) await IngresoSanPablo.deleteMany({ tipo: ESCALERAS, origen: actual._id });
    if (actual.retiro) await IngresoSanPablo.deleteMany({ tipo: CARROS, origen: actual._id, salida: true });
    res.json({ message: "Ingreso eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
