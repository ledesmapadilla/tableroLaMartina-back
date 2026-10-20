import GasoilDia, { CAMPOS_GASOIL, ESTABLECIMIENTO_DE_CAMPO } from "../models/GasoilDia.js";
import IngresoGasoil from "../models/IngresoGasoil.js";
import AuditoriaGasoil from "../models/AuditoriaGasoil.js";
import ParteDiario from "../models/ParteDiario.js";
// Para el populate del detalle: que estén registrados aunque nadie más los
// haya importado.
import "../models/Personal.js";
import "../models/CentroCosto.js";
import "../models/Tarea.js";

// Un número vacío queda sin cargar (null) y no como cero: un cero dice que se
// midió y dio cero.
const numero = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

// "AAAA-MM-DD" → medianoche UTC, como guardan la fecha los partes.
const dia = (f) => new Date(`${String(f).slice(0, 10)}T00:00:00.000Z`);
const claveDia = (f) => new Date(f).toISOString().slice(0, 10);

const texto = (v) => (v || "").toString().trim();

const campoValido = (campo, res) => {
  if (CAMPOS_GASOIL.includes(campo)) return true;
  res.status(400).json({ error: "Campo desconocido" });
  return false;
};

// Los encargados de taller ven solo los ingresos, no los consumos
// (20/10/2026). Copia de ROLES_SIN_CONSUMOS en
// TableroFront/src/components/compras/camposGasoil.js.
const ROLES_SIN_CONSUMOS = ["solicitante"];
const veConsumos = (req, res) => {
  if (!ROLES_SIN_CONSUMOS.includes(req.usuario?.rol)) return true;
  res.status(403).json({ error: "Tu rol no puede ver los consumos de gasoil" });
  return false;
};

// Y solo los de su taller (20/10/2026): Kevin Berdina; Victor y Pablo San
// Pablo. Se busca en el usuario y en el nombre, como en el front. Un
// encargado que no está acá no ve ningún campo. Copia de POR_USUARIO en
// TableroFront/src/utils/seccionPropia.js.
const TALLER_DE_USUARIO = { kevin: "berdina", victor: "sanpablo", pablo: "sanpablo" };
// El campo del taller de quien está logueado, o null.
const tallerDe = (usuario) => {
  const quien = `${usuario?.usuario || ""} ${usuario?.nombre || ""}`.toLowerCase();
  const encontrado = Object.keys(TALLER_DE_USUARIO).find((n) => quien.includes(n));
  return encontrado ? TALLER_DE_USUARIO[encontrado] : null;
};
const esSuCampo = (req, res, campo) => {
  if (req.usuario?.rol !== "solicitante") return true;
  if (tallerDe(req.usuario) === campo) return true;
  res.status(403).json({ error: "Solo podés ver el gasoil de tu taller" });
  return false;
};

/**
 * La planilla de consumos de un campo, del día más nuevo al más viejo. Un
 * renglón por día que tenga combustible en los partes, un ingreso o
 * observaciones.
 *
 * - El consumo es lo de los partes de Producción de ese campo (los datos de
 *   certificación): combustible + combTurbo de todas las jornadas del día.
 * - El ingreso es la suma de los ingresos de gasoil del día.
 * - El saldo es lo que queda al final del día: todos los ingresos hasta ese
 *   día menos todos los consumos hasta ese día, desde el primer registro.
 */
export const getAll = async (req, res) => {
  try {
    if (!veConsumos(req, res)) return;
    const { campo } = req.query;
    if (!campoValido(campo, res)) return;

    const [porDia, ingresos, cargados] = await Promise.all([
      ParteDiario.aggregate([
        {
          $match: {
            establecimiento: ESTABLECIMIENTO_DE_CAMPO[campo],
            $or: [{ combustible: { $ne: null } }, { combTurbo: { $ne: null } }],
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$fecha", timezone: "UTC" } },
            combustible: { $sum: { $ifNull: ["$combustible", 0] } },
            combTurbo: { $sum: { $ifNull: ["$combTurbo", 0] } },
          },
        },
      ]),
      IngresoGasoil.aggregate([
        { $match: { campo } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$fecha", timezone: "UTC" } },
            litros: { $sum: "$litros" },
          },
        },
      ]),
      GasoilDia.find({ campo }).lean(),
    ]);

    const filas = new Map();
    const fila = (fecha) => {
      if (!filas.has(fecha)) {
        filas.set(fecha, {
          fecha,
          combustible: null,
          combTurbo: null,
          consumo: null,
          ingreso: null,
          saldo: 0,
          observaciones: "",
          _id: null,
        });
      }
      return filas.get(fecha);
    };
    for (const d of porDia) {
      Object.assign(fila(d._id), {
        combustible: d.combustible,
        combTurbo: d.combTurbo,
        consumo: d.combustible + d.combTurbo,
      });
    }
    for (const i of ingresos) fila(i._id).ingreso = i.litros;
    for (const g of cargados) Object.assign(fila(claveDia(g.fecha)), { observaciones: g.observaciones || "", _id: g._id });

    // El saldo se acumula del más viejo al más nuevo.
    const ordenadas = [...filas.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let saldo = 0;
    for (const f of ordenadas) {
      saldo += (f.ingreso || 0) - (f.consumo || 0);
      f.saldo = Math.round(saldo * 100) / 100;
    }

    res.json(ordenadas.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * El detalle del consumo de un día: los partes de ese campo que tienen
 * combustible, con quién, en qué CC y en qué tarea (20/10/2026).
 */
export const getDetalle = async (req, res) => {
  try {
    if (!veConsumos(req, res)) return;
    const { campo, fecha } = req.query;
    if (!campoValido(campo, res)) return;
    if (!fecha) return res.status(400).json({ error: "Falta la fecha" });

    const partes = await ParteDiario.find({
      establecimiento: ESTABLECIMIENTO_DE_CAMPO[campo],
      fecha: dia(fecha),
      $or: [{ combustible: { $ne: null } }, { combTurbo: { $ne: null } }],
    })
      .select("persona cc tarea turbo combustible combTurbo provisorio")
      .populate("persona", "apellidoNombre")
      .populate("cc", "cc descripcion")
      .populate("tarea", "tarea")
      .lean();

    const filas = partes
      .map((p) => ({
        _id: p._id,
        persona: p.persona?.apellidoNombre || "",
        cc: p.cc?.cc || "",
        descripcionCC: p.cc?.descripcion || "",
        tarea: p.tarea?.tarea || "",
        turbo: p.turbo || "",
        combustible: p.combustible,
        combTurbo: p.combTurbo,
        provisorio: Boolean(p.provisorio),
      }))
      .sort((a, b) => a.cc.localeCompare(b.cc, "es", { numeric: true }) || a.persona.localeCompare(b.persona));
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Guarda las observaciones de un día (crea o pisa). Vacías, el día se borra:
// no queda un documento sin nada.
export const guardar = async (req, res) => {
  try {
    if (!veConsumos(req, res)) return;
    const { campo, fecha } = req.body;
    if (!campoValido(campo, res)) return;
    if (!fecha) return res.status(400).json({ error: "Falta la fecha" });

    const observaciones = texto(req.body.observaciones);
    const filtro = { campo, fecha: dia(fecha) };

    if (!observaciones) {
      await GasoilDia.deleteOne(filtro);
      return res.json({ ok: true, borrado: true });
    }
    const doc = await GasoilDia.findOneAndUpdate(
      filtro,
      { $set: { observaciones } },
      { returnDocument: "after", upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Borra las observaciones de un día. El consumo de los partes queda.
export const remove = async (req, res) => {
  try {
    if (!veConsumos(req, res)) return;
    const doc = await GasoilDia.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Registro no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Ingresos (20/10/2026) ──

const datosIngreso = (body) => ({
  fecha: body.fecha ? dia(body.fecha) : undefined,
  proveedor: texto(body.proveedor),
  remito: texto(body.remito),
  litros: numero(body.litros),
  quienCarga: texto(body.quienCarga),
  observaciones: texto(body.observaciones),
});

// Los ingresos de un campo, del más nuevo al más viejo. Los filtros van en
// la pantalla: son pocos y las opciones salen de todos.
export const getIngresos = async (req, res) => {
  try {
    const { campo } = req.query;
    if (!campoValido(campo, res)) return;
    if (!esSuCampo(req, res, campo)) return;
    const lista = await IngresoGasoil.find({ campo }).sort({ fecha: -1, createdAt: -1 }).lean();
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crearIngreso = async (req, res) => {
  try {
    if (!campoValido(req.body.campo, res)) return;
    if (!esSuCampo(req, res, req.body.campo)) return;
    const ingreso = await IngresoGasoil.create({ campo: req.body.campo, ...datosIngreso(req.body) });
    res.status(201).json(ingreso);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Corregir un ingreso ya cargado es solo del comprador, gerencia y el
// superadmin (20/10/2026), además del "Editar" de Gasoil. El analista no.
// Copia de ROLES_EDITAR_INGRESO en TableroFront/src/components/compras/camposGasoil.js.
const ROLES_EDITAR_INGRESO = ["comprador", "gerente", "superadmin"];

// El campo no se cambia: lo cargado en el campo equivocado se borra.
export const editarIngreso = async (req, res) => {
  try {
    if (!ROLES_EDITAR_INGRESO.includes(req.usuario?.rol)) {
      return res.status(403).json({ error: "Tu rol no puede editar ingresos de gasoil" });
    }
    const ingreso = await IngresoGasoil.findByIdAndUpdate(req.params.id, datosIngreso(req.body), {
      returnDocument: "after",
      runValidators: true,
    });
    if (!ingreso) return res.status(404).json({ error: "Ingreso no encontrado" });
    res.json(ingreso);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const borrarIngreso = async (req, res) => {
  try {
    const ingreso = await IngresoGasoil.findById(req.params.id).select("campo").lean();
    if (!ingreso) return res.status(404).json({ error: "Ingreso no encontrado" });
    if (!esSuCampo(req, res, ingreso.campo)) return;
    await IngresoGasoil.deleteOne({ _id: ingreso._id });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Auditorías (20/10/2026) ──
// Compras pide una auditoría y el encargado de taller de cada campo carga los
// litros que tiene en el tanque y la foto del nivel.

// El encargado ve solo la carga de su campo; los demás, las dos.
const cargasVisibles = (req, auditoria) => {
  if (req.usuario?.rol !== "solicitante") return auditoria.cargas;
  const propio = tallerDe(req.usuario);
  return auditoria.cargas.filter((c) => c.campo === propio);
};

export const getAuditorias = async (req, res) => {
  try {
    const lista = await AuditoriaGasoil.find().sort({ fechaPedido: -1 }).lean();
    res.json(lista.map((a) => ({ ...a, cargas: cargasVisibles(req, a) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Pedir una auditoría: la fecha es la de hoy y nacen las dos cargas vacías.
// El encargado de taller no pide: carga.
export const pedirAuditoria = async (req, res) => {
  try {
    if (req.usuario?.rol === "solicitante") {
      return res.status(403).json({ error: "El encargado de taller no pide auditorías" });
    }
    const auditoria = await AuditoriaGasoil.create({
      fechaPedido: new Date(),
      pedidoPor: req.usuario?.nombre || req.usuario?.usuario || "",
      cargas: CAMPOS_GASOIL.map((campo) => ({ campo })),
    });
    res.status(201).json(auditoria);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Cargar (o corregir) los litros y la foto de un campo. Lo hace el encargado
// de ese taller; el superadmin también, para probar o corregir.
export const cargarAuditoria = async (req, res) => {
  try {
    const { id, campo } = req.params;
    if (!campoValido(campo, res)) return;
    if (!["solicitante", "superadmin"].includes(req.usuario?.rol)) {
      return res.status(403).json({ error: "La auditoría la carga el encargado de taller" });
    }
    if (!esSuCampo(req, res, campo)) return;

    const litros = numero(req.body.litros);
    if (litros === null || Number.isNaN(litros) || litros < 0) {
      return res.status(400).json({ error: "Faltan los litros" });
    }
    const foto = req.body.foto;
    if (!foto?.url) return res.status(400).json({ error: "Falta la foto del nivel" });

    const auditoria = await AuditoriaGasoil.findOneAndUpdate(
      { _id: id, "cargas.campo": campo },
      {
        $set: {
          "cargas.$.litros": litros,
          "cargas.$.foto": { url: foto.url, nombre: foto.nombre || "", publicId: foto.publicId || "", tipo: foto.tipo || "image" },
          "cargas.$.cargadoPor": req.usuario?.nombre || req.usuario?.usuario || "",
          "cargas.$.fechaCarga": new Date(),
        },
      },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!auditoria) return res.status(404).json({ error: "Auditoría no encontrada" });
    res.json({ ...auditoria, cargas: cargasVisibles(req, auditoria) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Borrar un pedido de auditoría (con lo que se haya cargado). Las fotos las
// borra el front de Cloudinary, como el resto de los adjuntos.
export const borrarAuditoria = async (req, res) => {
  try {
    if (req.usuario?.rol === "solicitante") {
      return res.status(403).json({ error: "El encargado de taller no borra auditorías" });
    }
    const auditoria = await AuditoriaGasoil.findByIdAndDelete(req.params.id);
    if (!auditoria) return res.status(404).json({ error: "Auditoría no encontrada" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Poner o sacar solo la foto del nivel de un campo (la x y el Subir de la
// tabla). Mismos permisos que cargar; `foto: null` la saca. El archivo de
// Cloudinary lo borra el front.
export const fotoAuditoria = async (req, res) => {
  try {
    const { id, campo } = req.params;
    if (!campoValido(campo, res)) return;
    if (!["solicitante", "superadmin"].includes(req.usuario?.rol)) {
      return res.status(403).json({ error: "La auditoría la carga el encargado de taller" });
    }
    if (!esSuCampo(req, res, campo)) return;

    const f = req.body.foto;
    const foto = f?.url ? { url: f.url, nombre: f.nombre || "", publicId: f.publicId || "", tipo: f.tipo || "image" } : null;
    const auditoria = await AuditoriaGasoil.findOneAndUpdate(
      { _id: id, "cargas.campo": campo },
      { $set: { "cargas.$.foto": foto } },
      { returnDocument: "after" }
    ).lean();
    if (!auditoria) return res.status(404).json({ error: "Auditoría no encontrada" });
    res.json({ ...auditoria, cargas: cargasVisibles(req, auditoria) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Cuántas auditorías esperan la foto del nivel en cada campo (20/10/2026):
// { berdina: n, sanpablo: n }. Con eso la entrada de Producción pone el
// triángulo en la tarjeta del campo; al subir la foto deja de contar.
export const getAuditoriasPendientes = async (req, res) => {
  try {
    const filas = await AuditoriaGasoil.aggregate([
      { $unwind: "$cargas" },
      { $match: { $or: [{ "cargas.foto": null }, { "cargas.foto.url": { $in: [null, ""] } }] } },
      { $group: { _id: "$cargas.campo", n: { $sum: 1 } } },
    ]);
    const pendientes = Object.fromEntries(CAMPOS_GASOIL.map((c) => [c, 0]));
    for (const f of filas) pendientes[f._id] = f.n;
    res.json(pendientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
