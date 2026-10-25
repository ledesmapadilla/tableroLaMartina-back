import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";

/**
 * El antes y el después de lo que cambia un pedido (25/10/2026), para el
 * registro de cambios (middleware/registro.js).
 *
 * El middleware abre un `contexto` por cada escritura que llega a la API; el
 * plugin anota ahí cada documento que se crea, se cambia o se borra. Fuera de
 * un pedido (scripts, cálculos sueltos) no hay contexto y no hace nada.
 *
 * Va en todas las colecciones: se registra con mongoose.plugin() antes de que
 * se arme ningún modelo (es lo primero que importa index.js). El bulkWrite
 * del reparto de lotes no pasa por acá: es una cuenta que rehace el sistema,
 * no un cambio de nadie.
 */
export const contexto = new AsyncLocalStorage();

// El nombre de cada colección en el registro. La que no está va con el
// nombre del modelo.
const NOMBRES = {
  Aceite: "Aceite",
  Admisible: "Valor admisible",
  AuditoriaGasoil: "Auditoría de gasoil",
  BerdinaPedido: "Pedido Berdina",
  CambioCertificacion: "Cambio de certificación",
  CambioHorometro: "Cambio de horómetro",
  Camioneta: "Camioneta",
  CentroCosto: "Centro de costo",
  CheckList: "Check list",
  ChequeoSanPablo: "Chequeo San Pablo",
  Cliente: "Cliente",
  Colectivo: "Colectivo",
  Config: "Configuración",
  DescuentoPersonal: "Descuento",
  Filtro: "Filtro",
  GasoilDia: "Observación de gasoil",
  HistorialTractor: "Historial de tractor",
  HorometroTractor: "Horómetro",
  IngresoGasoil: "Ingreso de gasoil",
  IngresoSanPablo: "Ingreso San Pablo",
  Kilometro: "Kilómetros",
  KilometroColectivo: "Kilómetros de colectivo",
  Lote: "Lote",
  MovimientoAceite: "Movimiento de aceite",
  MovimientoFiltro: "Movimiento de filtro",
  OC: "Orden de pago",
  Parada: "Parada",
  ParteDiario: "Parte diario",
  Pendiente: "Pendiente",
  PeriodoCertificado: "Período de certificación",
  Personal: "Personal",
  PesosManitou: "Pesos de Manitou",
  PresupuestoReparacion: "Presupuesto de reparación",
  Proveedor: "Proveedor",
  Reparacion: "Reparación",
  RepuestoTractor: "Repuesto",
  Rol: "Rol",
  SanPabloPedido: "Pedido San Pablo",
  Service: "Service",
  ServiceColectivo: "Service de colectivo",
  ServiceTractor: "Service de tractor",
  StockInicialGasoil: "Stock inicial de gasoil",
  Tarea: "Tarea",
  TrabajoCamioneta: "Trabajo de camioneta",
  TrabajoTractor: "Trabajo de tractor",
  Tractor: "Tractor",
  Usuario: "Usuario",
  VariableTarea: "Variable",
  Visita: "Visita",
};
// El registro no se anota a sí mismo.
const SIN_HISTORIAL = new Set(["RegistroCambio"]);

// Los campos que se mueven solos y no dicen nada de lo que cambió.
const IGNORADOS = new Set(["_id", "__v", "createdAt", "updatedAt"]);
// Las contraseñas no se guardan: se anota que cambió, no a qué.
const OCULTO = /password|contrase|token|secret/i;
// Por pedido, a lo sumo tantos documentos de un updateMany o deleteMany.
const MAX_MUCHOS = 50;
// Un valor más largo (una lista de ítems, un historial) se recorta.
const MAX_TEXTO = 5000;

export const aTexto = (valor) => {
  if (valor === undefined) return null;
  const texto = JSON.stringify(valor);
  return texto.length > MAX_TEXTO ? `${texto.slice(0, MAX_TEXTO)}…` : texto;
};
const ocultar = (campo, valor) => (OCULTO.test(campo) && valor !== undefined && valor !== null ? "•••" : valor);

const diferencias = (antes, despues) => {
  const claves = new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]);
  return [...claves]
    .filter((c) => !IGNORADOS.has(c))
    .map((campo) => {
      const a = aTexto(antes?.[campo]);
      const d = aTexto(despues?.[campo]);
      if (a === d) return null;
      return OCULTO.test(campo) ? { campo, antes: aTexto("•••"), despues: aTexto("••• (cambió)") } : { campo, antes: a, despues: d };
    })
    .filter(Boolean);
};

const sinOcultos = (doc) =>
  doc && Object.fromEntries(Object.entries(doc).map(([campo, valor]) => [campo, ocultar(campo, valor)]));

const UNO = ["findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "updateOne", "replaceOne", "deleteOne"];
const MUCHOS = ["updateMany", "deleteMany"];
const BORRA = new Set(["findOneAndDelete", "deleteOne", "deleteMany"]);

const anotar = (modelo, tipo, antes, despues) => {
  const registro = contexto.getStore();
  if (!registro || SIN_HISTORIAL.has(modelo)) return;
  const nombre = NOMBRES[modelo] || modelo;
  const docId = String((antes || despues)?._id ?? "");
  if (tipo === "cambio") {
    const campos = diferencias(antes, despues);
    if (campos.length) registro.cambios.push({ modelo: nombre, docId, tipo, campos });
  } else {
    registro.cambios.push({ modelo: nombre, docId, tipo, doc: aTexto(sinOcultos(tipo === "alta" ? despues : antes)) });
  }
};

// Solo los documentos de una colección: el plugin global también llega a los
// subdocumentos (los ítems de un pedido, por ejemplo), que no tienen modelo.
const activo = (modelo) => Boolean(modelo) && Boolean(contexto.getStore()) && !SIN_HISTORIAL.has(modelo);

export const conHistorial = (schema) => {
  // Alta o cambio con save().
  schema.pre("save", async function () {
    if (this.$isSubdocument || !activo(this.constructor.modelName)) return;
    this.$locals.historialNuevo = this.isNew;
    if (!this.isNew) this.$locals.historialAntes = await this.constructor.findById(this._id).lean();
  });
  schema.post("save", function (doc) {
    if (doc.$isSubdocument || !activo(doc.constructor.modelName)) return;
    const despues = doc.toObject({ depopulate: true });
    if (doc.$locals.historialNuevo) anotar(doc.constructor.modelName, "alta", null, despues);
    else anotar(doc.constructor.modelName, "cambio", doc.$locals.historialAntes, despues);
  });

  // Altas de a varias.
  schema.post("insertMany", function (docs) {
    if (!activo(this.modelName)) return;
    (docs || []).forEach((d) => anotar(this.modelName, "alta", null, d?.toObject ? d.toObject({ depopulate: true }) : d));
  });

  // Por consulta: se lee cómo estaba antes y cómo quedó después.
  schema.pre([...UNO, ...MUCHOS], { document: false, query: true }, async function () {
    if (!activo(this.model.modelName)) return;
    const filtro = this.getFilter();
    this._historialAntes = UNO.includes(this.op)
      ? [await this.model.findOne(filtro).lean()].filter(Boolean)
      : await this.model.find(filtro).limit(MAX_MUCHOS).lean();
  });
  schema.post([...UNO, ...MUCHOS], { document: false, query: true }, async function () {
    const modelo = this.model.modelName;
    if (!activo(modelo) || !this._historialAntes) return;
    const antes = this._historialAntes;
    if (BORRA.has(this.op)) {
      const quedan = new Set(
        (await this.model.find({ _id: { $in: antes.map((d) => d._id) } }).select("_id").lean()).map((d) => String(d._id))
      );
      antes.filter((d) => !quedan.has(String(d._id))).forEach((d) => anotar(modelo, "baja", d, null));
      return;
    }
    if (!antes.length) {
      // Un upsert que creó el documento.
      if (this.getOptions().upsert) {
        const nuevo = await this.model.findOne(this.getFilter()).lean();
        if (nuevo) anotar(modelo, "alta", null, nuevo);
      }
      return;
    }
    const despues = await this.model.find({ _id: { $in: antes.map((d) => d._id) } }).lean();
    const porId = new Map(despues.map((d) => [String(d._id), d]));
    antes.forEach((d) => anotar(modelo, "cambio", d, porId.get(String(d._id)) ?? null));
  });
};

mongoose.plugin(conHistorial);
