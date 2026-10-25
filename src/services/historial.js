import { AsyncLocalStorage } from "node:async_hooks";

/**
 * El antes y el después de lo que cambia un pedido (25/10/2026), para el
 * registro de cambios (middleware/registro.js).
 *
 * El middleware abre un `contexto` por cada escritura que llega a la API; las
 * colecciones que llevan el plugin `conHistorial` anotan ahí cada documento
 * que se crea, se cambia o se borra. Fuera de un pedido (scripts, cálculos
 * sueltos) no hay contexto y el plugin no hace nada.
 *
 * Lo llevan los partes diarios y todo lo de gasoil. El bulkWrite del reparto
 * de lotes no pasa por acá: es una cuenta que rehace el sistema, no un cambio
 * de nadie.
 */
export const contexto = new AsyncLocalStorage();

// Los campos que se mueven solos y no dicen nada de lo que cambió.
const IGNORADOS = new Set(["_id", "__v", "createdAt", "updatedAt"]);
// Por pedido, a lo sumo tantos documentos de un updateMany o deleteMany.
const MAX_MUCHOS = 50;

export const aTexto = (valor) => (valor === undefined ? null : JSON.stringify(valor));

const diferencias = (antes, despues) => {
  const claves = new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]);
  return [...claves]
    .filter((c) => !IGNORADOS.has(c))
    .map((campo) => ({ campo, antes: aTexto(antes?.[campo]), despues: aTexto(despues?.[campo]) }))
    .filter((c) => c.antes !== c.despues);
};

const UNO = ["findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "updateOne", "replaceOne", "deleteOne"];
const MUCHOS = ["updateMany", "deleteMany"];
const BORRA = new Set(["findOneAndDelete", "deleteOne", "deleteMany"]);

export const conHistorial = (schema, { nombre }) => {
  const anotar = (registro, tipo, antes, despues) => {
    const docId = String((antes || despues)?._id ?? "");
    if (tipo === "cambio") {
      const campos = diferencias(antes, despues);
      if (campos.length) registro.cambios.push({ modelo: nombre, docId, tipo, campos });
    } else {
      registro.cambios.push({ modelo: nombre, docId, tipo, doc: aTexto(tipo === "alta" ? despues : antes) });
    }
  };

  // Alta o cambio con save().
  schema.pre("save", async function () {
    if (!contexto.getStore()) return;
    this.$locals.historialNuevo = this.isNew;
    if (!this.isNew) this.$locals.historialAntes = await this.constructor.findById(this._id).lean();
  });
  schema.post("save", function (doc) {
    const registro = contexto.getStore();
    if (!registro) return;
    const despues = doc.toObject({ depopulate: true });
    if (doc.$locals.historialNuevo) anotar(registro, "alta", null, despues);
    else anotar(registro, "cambio", doc.$locals.historialAntes, despues);
  });

  // Por consulta: se lee cómo estaba antes y cómo quedó después.
  schema.pre([...UNO, ...MUCHOS], { document: false, query: true }, async function () {
    if (!contexto.getStore()) return;
    const filtro = this.getFilter();
    this._historialAntes = UNO.includes(this.op)
      ? [await this.model.findOne(filtro).lean()].filter(Boolean)
      : await this.model.find(filtro).limit(MAX_MUCHOS).lean();
  });
  schema.post([...UNO, ...MUCHOS], { document: false, query: true }, async function () {
    const registro = contexto.getStore();
    if (!registro || !this._historialAntes) return;
    const antes = this._historialAntes;
    if (BORRA.has(this.op)) {
      const quedan = new Set(
        (await this.model.find({ _id: { $in: antes.map((d) => d._id) } }).select("_id").lean()).map((d) => String(d._id))
      );
      antes.filter((d) => !quedan.has(String(d._id))).forEach((d) => anotar(registro, "baja", d, null));
      return;
    }
    if (!antes.length) {
      // Un upsert que creó el documento.
      if (this.getOptions().upsert) {
        const nuevo = await this.model.findOne(this.getFilter()).lean();
        if (nuevo) anotar(registro, "alta", null, nuevo);
      }
      return;
    }
    const despues = await this.model.find({ _id: { $in: antes.map((d) => d._id) } }).lean();
    const porId = new Map(despues.map((d) => [String(d._id), d]));
    antes.forEach((d) => anotar(registro, "cambio", d, porId.get(String(d._id)) ?? null));
  });
};
