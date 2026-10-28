import GasoilDia, {
  CAMPOS_GASOIL,
  ESTABLECIMIENTO_DE_CAMPO,
  TIPOS_DE_CAMPO,
  TANQUES_GASOIL,
  CC_INFINIA,
} from "../models/GasoilDia.js";
import IngresoGasoil from "../models/IngresoGasoil.js";
import AuditoriaGasoil from "../models/AuditoriaGasoil.js";
import StockInicialGasoil from "../models/StockInicialGasoil.js";
import ParteDiario from "../models/ParteDiario.js";
import CentroCosto from "../models/CentroCosto.js";
import { puedeRol } from "../permisos/resolver.js";
// Para el populate del detalle: que estén registrados aunque nadie más los
// haya importado.
import "../models/Personal.js";
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

// ── Tanques (27/10/2026) ──
// Un tanque es un campo + un tipo de gasoil: San Pablo tiene Común e Infinia.
// Lo cargado antes no tiene tipo y es Común.
const tipoDe = (x) => x?.tipo || "comun";
// Para buscar por tipo: el Común también encuentra lo que no lo tiene.
const filtroTipo = (tipo) => (tipo === "comun" ? { $in: ["comun", null] } : tipo);

// El tipo pedido (vacío es Común), si existe en el campo; si no, responde 400
// y devuelve null.
const tipoValido = (campo, tipo, res) => {
  const t = tipo || "comun";
  if (TIPOS_DE_CAMPO[campo]?.includes(t)) return t;
  res.status(400).json({ error: "Tipo de gasoil desconocido en este campo" });
  return null;
};

// Los partes que consumen de un tanque. En un campo con Infinia, el Infinia
// es solo lo cargado en el CC de la retro y el Común todo lo demás.
const filtroConsumos = async (campo, tipo) => {
  const filtro = {
    establecimiento: ESTABLECIMIENTO_DE_CAMPO[campo],
    $or: [{ combustible: { $ne: null } }, { combTurbo: { $ne: null } }],
  };
  if (!TIPOS_DE_CAMPO[campo].includes("infinia")) return filtro;
  const retro = await CentroCosto.findOne({ cc: CC_INFINIA }).select("_id").lean();
  if (tipo === "infinia") filtro.cc = retro ? retro._id : { $in: [] };
  else if (retro) filtro.cc = { $ne: retro._id };
  return filtro;
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

// El consumo de los partes de un tanque, sumado por día:
// [{ _id: "AAAA-MM-DD", combustible, combTurbo }].
const consumosPorDia = async (campo, tipo) =>
  ParteDiario.aggregate([
    { $match: await filtroConsumos(campo, tipo) },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$fecha", timezone: "UTC" } },
        combustible: { $sum: { $ifNull: ["$combustible", 0] } },
        combTurbo: { $sum: { $ifNull: ["$combTurbo", 0] } },
      },
    },
  ]);

// Los ingresos de un tanque, sumados por día: [{ _id: "AAAA-MM-DD", litros }].
const ingresosPorDia = (campo, tipo) =>
  IngresoGasoil.aggregate([
    { $match: { campo, tipo: filtroTipo(tipo) } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$fecha", timezone: "UTC" } },
        litros: { $sum: "$litros" },
      },
    },
  ]);

/**
 * La planilla de consumos de un tanque (?campo=&tipo=), del día más nuevo al
 * más viejo. Un renglón por día que tenga combustible en los partes, un
 * ingreso o observaciones.
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
    const tipo = tipoValido(campo, req.query.tipo, res);
    if (!tipo) return;

    const [porDia, ingresos, cargados, stockInicial, auditorias] = await Promise.all([
      consumosPorDia(campo, tipo),
      ingresosPorDia(campo, tipo),
      GasoilDia.find({ campo, tipo: filtroTipo(tipo) }).lean(),
      StockInicialGasoil.findOne({ campo, tipo: filtroTipo(tipo) }).select("fecha litros").lean(),
      AuditoriaGasoil.find({ "cargas.campo": campo }).select("cargas").lean(),
    ]);
    // La diferencia de cada auditoría, para su renglón de ajuste.
    const resultados = await resultadosAuditorias(campo, tipo, auditorias);

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
          stockInicial: null,
          auditoria: null,
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
    // Y el de cada auditoría ya cargada en este campo (el día de la foto, su
    // corte, como en el resultado): los litros medidos. Con dos el mismo día
    // queda la última medición.
    const momento = (c) => new Date(c.corte || c.fechaCarga);
    const medidas = auditorias
      .map((a) => a.cargas.find((c) => c.campo === campo && tipoDe(c) === tipo))
      .filter((c) => c && c.litros !== null && c.litros !== undefined && (c.corte || c.fechaCarga))
      .sort((a, b) => momento(a) - momento(b));
    for (const c of medidas) fila(diaArgentina(momento(c))).auditoria = c.litros;

    // Lo que entra en la cuenta desde el stock inicial (28/10/2026), por día:
    // `consumoCuenta` e `ingresoCuenta`. El stock inicial es lo que hay al
    // cierre de su día: entra todo lo de los días siguientes, y lo de ese día
    // o antes no. Es la misma regla que las auditorías (resultadosAuditorias),
    // así el saldo de arriba de la planilla coincide con lo que tendría que
    // medir la auditoría. Sin stock inicial quedan en null y cuenta todo.
    if (stockInicial) {
      const diaStock = claveDia(stockInicial.fecha);
      for (const f of filas.values()) {
        const entra = f.fecha > diaStock;
        f.consumoCuenta = entra ? f.consumo || 0 : 0;
        f.ingresoCuenta = entra ? f.ingreso || 0 : 0;
      }
    }

    // El saldo se acumula del más viejo al más nuevo.
    const ordenadas = [...filas.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let saldo = 0;
    for (const f of ordenadas) {
      saldo += (f.ingreso || 0) - (f.consumo || 0);
      f.saldo = Math.round(saldo * 100) / 100;
    }

    // El stock inicial (21/10/2026), el punto de partida de las auditorías,
    // en un renglón solo con su fecha (28/10/2026): es lo que hay al cierre
    // de ese día, así que va después de los consumos e ingresos del día y no
    // se confunde con ellos. `esStock` lo distingue del renglón del día.
    if (stockInicial) {
      const diaStock = claveDia(stockInicial.fecha);
      const despues = ordenadas.findIndex((f) => f.fecha > diaStock);
      ordenadas.splice(despues === -1 ? ordenadas.length : despues, 0, {
        fecha: diaStock,
        esStock: true,
        combustible: null,
        combTurbo: null,
        consumo: null,
        ingreso: null,
        consumoCuenta: 0,
        ingresoCuenta: 0,
        saldo: null,
        observaciones: "",
        stockInicial: stockInicial.litros,
        auditoria: null,
        _id: null,
      });
    }

    // El ajuste de cada auditoría con diferencia (28/10/2026): un renglón
    // aparte, después de los del día de la auditoría, con la diferencia como
    // consumo (positivo si faltó gasoil, negativo si sobró). Así el saldo
    // queda en lo medido y sigue igual que la cuenta de la auditoría
    // siguiente, que parte de lo medido. `esAjuste` lo distingue.
    const ajustes = [...resultados.entries()]
      .map(([id, r]) => ({ id, ...r, ajuste: redondear(r.teorico - r.medido) }))
      .filter((r) => r.ajuste !== 0)
      .sort((a, b) => a.hasta.localeCompare(b.hasta));
    for (const r of ajustes) {
      const dia = diaArgentina(r.hasta);
      const despues = ordenadas.findIndex((f) => f.fecha > dia);
      ordenadas.splice(despues === -1 ? ordenadas.length : despues, 0, {
        fecha: dia,
        esAjuste: true,
        auditoriaId: r.id,
        combustible: null,
        combTurbo: null,
        consumo: r.ajuste,
        ingreso: null,
        consumoCuenta: r.ajuste,
        ingresoCuenta: 0,
        saldo: null,
        observaciones: `Valor de ajuste por diferencia de auditoría del ${dia.split("-").reverse().join("/")}`,
        stockInicial: null,
        auditoria: null,
        _id: null,
      });
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
    const tipo = tipoValido(campo, req.query.tipo, res);
    if (!tipo) return;
    if (!fecha) return res.status(400).json({ error: "Falta la fecha" });

    const partes = await ParteDiario.find({ ...(await filtroConsumos(campo, tipo)), fecha: dia(fecha) })
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
    const tipo = tipoValido(campo, req.body.tipo, res);
    if (!tipo) return;
    if (!fecha) return res.status(400).json({ error: "Falta la fecha" });

    const observaciones = texto(req.body.observaciones);
    const filtro = { campo, tipo: filtroTipo(tipo), fecha: dia(fecha) };

    if (!observaciones) {
      await GasoilDia.deleteOne(filtro);
      return res.json({ ok: true, borrado: true });
    }
    const doc = await GasoilDia.findOneAndUpdate(
      filtro,
      { $set: { observaciones, tipo } },
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

// Los ingresos de un campo, del más nuevo al más viejo; con ?tipo=, solo los
// de ese tanque. Los filtros van en la pantalla: son pocos y las opciones
// salen de todos.
export const getIngresos = async (req, res) => {
  try {
    const { campo } = req.query;
    if (!campoValido(campo, res)) return;
    if (!esSuCampo(req, res, campo)) return;
    const filtro = { campo };
    if (req.query.tipo) {
      const tipo = tipoValido(campo, req.query.tipo, res);
      if (!tipo) return;
      filtro.tipo = filtroTipo(tipo);
    }
    const lista = await IngresoGasoil.find(filtro).sort({ fecha: -1, createdAt: -1 }).lean();
    res.json(lista.map((i) => ({ ...i, tipo: tipoDe(i) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crearIngreso = async (req, res) => {
  try {
    if (!campoValido(req.body.campo, res)) return;
    if (!esSuCampo(req, res, req.body.campo)) return;
    const tipo = tipoValido(req.body.campo, req.body.tipo, res);
    if (!tipo) return;
    const ingreso = await IngresoGasoil.create({ campo: req.body.campo, tipo, ...datosIngreso(req.body) });
    res.status(201).json(ingreso);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Corregir un ingreso ya cargado: el que tiene "Editar" de Gasoil (27/10/2026,
// antes solo comprador, gerencia y el superadmin); el encargado, solo los de
// su taller. El campo no se cambia: lo cargado en el campo equivocado se borra.
// El tipo sí (27/10/2026), entre los del campo.
export const editarIngreso = async (req, res) => {
  try {
    const previo = await IngresoGasoil.findById(req.params.id).select("campo tipo").lean();
    if (!previo) return res.status(404).json({ error: "Ingreso no encontrado" });
    if (!esSuCampo(req, res, previo.campo)) return;
    const tipo = tipoValido(previo.campo, req.body.tipo || tipoDe(previo), res);
    if (!tipo) return;
    const ingreso = await IngresoGasoil.findByIdAndUpdate(req.params.id, { ...datosIngreso(req.body), tipo }, {
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

// El día de la Argentina (UTC-3) de un momento: la carga del encargado a las
// 22 h sigue siendo de ese día, no del siguiente en UTC.
const diaArgentina = (f) => new Date(new Date(f).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const redondear = (n) => Math.round(n * 100) / 100;

/**
 * El resultado de las auditorías de un campo (21/10/2026): cuánto sobra
 * (positivo) o falta (negativo) en el tanque contra lo que tendría que haber.
 *
 * - La primera parte del stock inicial; cada una de las siguientes, de los
 *   litros medidos en la anterior.
 * - Lo que tendría que haber = el punto de partida + los ingresos − los
 *   consumos de los partes del período.
 * - El período corta por el momento en que cada cosa se escribió en el
 *   sistema (21/10/2026), no por la fecha: entra lo escrito hasta la foto de
 *   esta auditoría (su `corte`) y después de la foto de la anterior. Lo que
 *   se escribe después de la foto pasa a la siguiente, aunque sea del mismo
 *   día. El encargado se ocupa de que antes de la foto esté todo cargado.
 *   El momento de un consumo es su `combustibleEn` (o createdAt en los partes
 *   de antes) y el de un ingreso, su createdAt.
 * - El stock inicial es un punto de partida: lo que hay en el tanque al
 *   cierre del día de su fecha (28/10/2026; antes, el momento en que se
 *   cargaba). Entra todo lo de los días siguientes, se haya escrito antes o
 *   después de cargarlo; lo de ese día o antes no cuenta. Las auditorías
 *   siguientes cortan por el momento, como siempre.
 * - Las cargadas antes del stock inicial, o sin stock inicial, no tienen
 *   resultado.
 *
 * Devuelve un Map: id de la auditoría → el detalle de la cuenta. `desde` es
 * el momento del stock inicial o el corte de la anterior, y `hasta` el corte
 * de esta (ISO).
 */
const resultadosAuditorias = async (campo, tipo, auditorias) => {
  const stockInicial = await StockInicialGasoil.findOne({ campo, tipo: filtroTipo(tipo) })
    .select("fecha litros momento updatedAt")
    .lean();
  const resultados = new Map();
  if (!stockInicial) return resultados;
  // Los cargados antes del 27/10/2026 no tienen momento: el último cambio.
  const momentoStock = new Date(stockInicial.momento ?? stockInicial.updatedAt);

  // Uno por uno, con su momento: de los días posteriores al del stock
  // inicial. Cada tanque con sus consumos (27/10/2026: el Infinia, solo la
  // retro).
  const [partes, ingresos] = await Promise.all([
    ParteDiario.find({ ...(await filtroConsumos(campo, tipo)), fecha: { $gt: stockInicial.fecha } })
      .select("combustible combTurbo combustibleEn createdAt")
      .lean(),
    IngresoGasoil.find({ campo, tipo: filtroTipo(tipo), fecha: { $gt: stockInicial.fecha } })
      .select("litros createdAt")
      .lean(),
  ]);
  const consumos = partes.map((p) => ({
    momento: new Date(p.combustibleEn ?? p.createdAt).getTime(),
    litros: (p.combustible || 0) + (p.combTurbo || 0),
  }));
  const entradas = ingresos.map((i) => ({ momento: new Date(i.createdAt).getTime(), litros: i.litros || 0 }));
  // Lo escrito después de `desde` y hasta `hasta`, incluido.
  const suma = (lista, desde, hasta) =>
    lista.filter((x) => x.momento > desde && x.momento <= hasta).reduce((t, x) => t + x.litros, 0);

  // Las cargadas de este campo después del stock inicial, de la más vieja a
  // la más nueva por su corte.
  const cargadas = auditorias
    .map((a) => ({ id: String(a._id), carga: a.cargas.find((c) => c.campo === campo && tipoDe(c) === tipo) }))
    .filter(({ carga }) => carga && carga.litros !== null && carga.litros !== undefined && (carga.corte || carga.fechaCarga))
    .map(({ id, carga }) => ({ id, litros: carga.litros, corte: new Date(carga.corte || carga.fechaCarga) }))
    .filter((a) => a.corte > momentoStock)
    .sort((a, b) => a.corte - b.corte);

  // Desde el stock inicial entra todo lo de los días siguientes, sin mirar
  // cuándo se escribió: el corte de partida no deja nada afuera.
  let partida = {
    litros: stockInicial.litros,
    corte: -Infinity,
    desde: momentoStock.toISOString(),
    origen: "stock inicial",
  };
  for (const a of cargadas) {
    const ingresado = suma(entradas, partida.corte, a.corte.getTime());
    const consumido = suma(consumos, partida.corte, a.corte.getTime());
    const teorico = partida.litros + ingresado - consumido;
    resultados.set(a.id, {
      origen: partida.origen,
      partida: partida.litros,
      desde: partida.desde,
      hasta: a.corte.toISOString(),
      ingresos: redondear(ingresado),
      consumos: redondear(consumido),
      teorico: redondear(teorico),
      medido: a.litros,
      resultado: redondear(a.litros - teorico),
    });
    partida = { litros: a.litros, corte: a.corte.getTime(), desde: a.corte.toISOString(), origen: "auditoría anterior" };
  }
  return resultados;
};

export const getAuditorias = async (req, res) => {
  try {
    const lista = await AuditoriaGasoil.find().sort({ fechaPedido: -1 }).lean();
    // El resultado (sobra o falta), con el detalle de la cuenta para el
    // resumen. Lo ve el que tiene Ver y Editar en Gasoil (27/10/2026), sea
    // cual sea su rol.
    const rol = req.usuario?.rol;
    const conResultado =
      (await puedeRol(rol, "compras.gasoil", "ver")) && (await puedeRol(rol, "compras.gasoil", "editar"));
    // Un resultado por tanque (27/10/2026): "campo-tipo" → Map.
    const porTanque = conResultado
      ? Object.fromEntries(
          await Promise.all(
            TANQUES_GASOIL.map(async ({ campo, tipo }) => [
              `${campo}-${tipo}`,
              await resultadosAuditorias(campo, tipo, lista),
            ])
          )
        )
      : {};
    res.json(
      lista.map((a) => ({
        ...a,
        cargas: cargasVisibles(req, a).map((c) => {
          const carga = { ...c, tipo: tipoDe(c) };
          return conResultado
            ? { ...carga, resultado: porTanque[`${c.campo}-${carga.tipo}`]?.get(String(a._id)) ?? null }
            : carga;
        }),
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Pedir una auditoría: la fecha es la de hoy y nace una carga vacía por
// tanque (27/10/2026: San Pablo, Común e Infinia). El encargado de taller no
// pide: carga.
export const pedirAuditoria = async (req, res) => {
  try {
    if (req.usuario?.rol === "solicitante") {
      return res.status(403).json({ error: "El encargado de taller no pide auditorías" });
    }
    const auditoria = await AuditoriaGasoil.create({
      fechaPedido: new Date(),
      pedidoPor: req.usuario?.nombre || req.usuario?.usuario || "",
      cargas: TANQUES_GASOIL.map(({ campo, tipo }) => ({ campo, tipo })),
    });
    res.status(201).json(auditoria);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// La carga de un tanque dentro de una auditoría, para el update posicional.
const filtroCarga = (id, campo, tipo) => ({ _id: id, cargas: { $elemMatch: { campo, tipo: filtroTipo(tipo) } } });

// Cargar (o corregir) los litros y la foto de un tanque (?tipo=, vacío es
// Común). La primera vez lo hace el encargado de ese taller (el superadmin
// también, para probar); ya cargada, la corrige solo el comprador o Nacho
// (27/10/2026).
export const cargarAuditoria = async (req, res) => {
  try {
    const { id, campo } = req.params;
    if (!campoValido(campo, res)) return;
    const tipo = tipoValido(campo, req.query.tipo, res);
    if (!tipo) return;

    const previa = await AuditoriaGasoil.findOne(filtroCarga(id, campo, tipo)).select("cargas").lean();
    if (!previa) return res.status(404).json({ error: "Auditoría no encontrada" });
    const cargaPrevia = previa.cargas.find((c) => c.campo === campo && tipoDe(c) === tipo);
    const yaCargada = cargaPrevia?.litros !== null && cargaPrevia?.litros !== undefined;
    if (yaCargada && !corrigeStock(req.usuario)) {
      return res.status(403).json({ error: "Los litros ya cargados los corrige solo el comprador" });
    }
    if (!yaCargada && !["solicitante", "superadmin"].includes(req.usuario?.rol)) {
      return res.status(403).json({ error: "La auditoría la carga el encargado de taller" });
    }
    if (!esSuCampo(req, res, campo)) return;

    const litros = numero(req.body.litros);
    if (litros === null || Number.isNaN(litros) || litros < 0) {
      return res.status(400).json({ error: "Faltan los litros" });
    }
    const foto = req.body.foto;
    if (!foto?.url) return res.status(400).json({ error: "Falta la foto del nivel" });

    // El corte se fija la primera vez (21/10/2026): una corrección no lo corre.
    const ahora = new Date();
    const auditoria = await AuditoriaGasoil.findOneAndUpdate(
      filtroCarga(id, campo, tipo),
      {
        $set: {
          "cargas.$.tipo": tipo,
          "cargas.$.litros": litros,
          "cargas.$.foto": { url: foto.url, nombre: foto.nombre || "", publicId: foto.publicId || "", tipo: foto.tipo || "image" },
          "cargas.$.cargadoPor": req.usuario?.nombre || req.usuario?.usuario || "",
          "cargas.$.fechaCarga": ahora,
          "cargas.$.corte": cargaPrevia?.corte ?? cargaPrevia?.fechaCarga ?? ahora,
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
    const tipo = tipoValido(campo, req.query.tipo, res);
    if (!tipo) return;
    if (!["solicitante", "superadmin"].includes(req.usuario?.rol)) {
      return res.status(403).json({ error: "La auditoría la carga el encargado de taller" });
    }
    if (!esSuCampo(req, res, campo)) return;

    const f = req.body.foto;
    const foto = f?.url ? { url: f.url, nombre: f.nombre || "", publicId: f.publicId || "", tipo: f.tipo || "image" } : null;
    const auditoria = await AuditoriaGasoil.findOneAndUpdate(
      filtroCarga(id, campo, tipo),
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

// ── Stock inicial (21/10/2026) ──
// El stock con el que arranca el tanque de cada campo, arriba de las
// auditorías: litros, fecha y foto del nivel. Uno por campo.

// Los tanques (27/10/2026: San Pablo, Común e Infinia), con lo cargado o null.
// El encargado ve solo los de su campo.
export const getStockInicial = async (req, res) => {
  try {
    const cargados = await StockInicialGasoil.find().lean();
    const tanques =
      req.usuario?.rol === "solicitante"
        ? TANQUES_GASOIL.filter((t) => t.campo === tallerDe(req.usuario))
        : TANQUES_GASOIL;
    res.json(
      tanques.map(({ campo, tipo }) => ({
        campo,
        tipo,
        stock: cargados.find((s) => s.campo === campo && tipoDe(s) === tipo) || null,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Quien puede corregir un stock ya cargado, el inicial y los litros de una
// auditoría (27/10/2026): solo el comprador, y Nacho (el superadmin de usuario
// "nacho"), que puede todo. Copia de puedeCorregirStock en
// TableroFront/src/components/compras/GasoilAuditorias.jsx.
const corrigeStock = (usuario) =>
  usuario?.rol === "comprador" || (usuario?.rol === "superadmin" && usuario?.usuario === "nacho");

// Cargar el stock inicial de un campo (crea o pisa). Una vez cargado no se
// corrige (21/10/2026), salvo el comprador y Nacho (corrigeStock); los demás
// solo cambian la foto. El
// encargado, solo el de su taller.
export const guardarStockInicial = async (req, res) => {
  try {
    const { campo } = req.params;
    if (!campoValido(campo, res)) return;
    const tipo = tipoValido(campo, req.query.tipo, res);
    if (!tipo) return;
    if (!esSuCampo(req, res, campo)) return;
    if (!corrigeStock(req.usuario) && (await StockInicialGasoil.exists({ campo, tipo: filtroTipo(tipo) }))) {
      return res.status(409).json({ error: "El stock inicial ya está cargado y no se corrige" });
    }

    const litros = numero(req.body.litros);
    if (litros === null || Number.isNaN(litros) || litros < 0) {
      return res.status(400).json({ error: "Faltan los litros" });
    }
    if (!req.body.fecha) return res.status(400).json({ error: "Falta la fecha" });
    const f = req.body.foto;
    if (!f?.url) return res.status(400).json({ error: "Falta la foto del nivel" });

    const stock = await StockInicialGasoil.findOneAndUpdate(
      { campo, tipo: filtroTipo(tipo) },
      {
        $set: {
          tipo,
          fecha: dia(req.body.fecha),
          litros,
          foto: { url: f.url, nombre: f.nombre || "", publicId: f.publicId || "", tipo: f.tipo || "image" },
          cargadoPor: req.usuario?.nombre || req.usuario?.usuario || "",
          momento: new Date(),
        },
      },
      { returnDocument: "after", upsert: true, runValidators: true }
    ).lean();
    res.json(stock);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Poner o sacar solo la foto del stock inicial (la x y el Subir de la caja);
// `foto: null` la saca. Los litros y la fecha no se tocan. El archivo de
// Cloudinary lo borra el front.
export const fotoStockInicial = async (req, res) => {
  try {
    const { campo } = req.params;
    if (!campoValido(campo, res)) return;
    const tipo = tipoValido(campo, req.query.tipo, res);
    if (!tipo) return;
    if (!esSuCampo(req, res, campo)) return;
    const f = req.body.foto;
    const foto = f?.url ? { url: f.url, nombre: f.nombre || "", publicId: f.publicId || "", tipo: f.tipo || "image" } : null;
    const stock = await StockInicialGasoil.findOneAndUpdate(
      { campo, tipo: filtroTipo(tipo) },
      { $set: { foto } },
      { returnDocument: "after" }
    ).lean();
    if (!stock) return res.status(404).json({ error: "Stock inicial no encontrado" });
    res.json(stock);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
