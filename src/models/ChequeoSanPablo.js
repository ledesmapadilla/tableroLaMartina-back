import { Schema, model } from "mongoose";

// Un repuesto de una fila: guardado, o pedido y con qué pedido de
// Compras (San Pablo) salió. El estado se sigue en Compras.
const RepuestoSchema = new Schema(
  {
    // Vacío mientras está solo guardado; con el pedido, ya salió a Compras.
    pedido: { type: Schema.Types.ObjectId, ref: "SanPabloPedido", default: null },
    nro_pedido: { type: Number },
    nombre_repuesto: { type: String, trim: true, required: true },
    // 0 solo en una Manitou (13/10/2026): no hace falta en esa unidad.
    cant: { type: Number, min: 0, required: true },
    unidad: { type: String, trim: true, required: true },
    // El de la Manitou; vacío en General, que es la plantilla.
    cc: { type: String, trim: true, default: "" },
    urgencia: { type: String, required: true },
    descripcion: { type: String, trim: true },
    solicita: { type: String, trim: true },
    fecha: { type: Date, default: Date.now },
    // En una Manitou, el repuesto de General del que es copia (09/10/2026).
    // Null en General y en lo que quedó suelto al borrarse el original.
    origen: { type: Schema.Types.ObjectId, default: null },
    // Una copia con la descripción escrita en su Manitou (21/10/2026), para
    // la salvedad de ese caso: la réplica de General ya no se la pisa. Lo
    // demás sigue viniendo de General.
    descripcionPropia: { type: Boolean, default: false },
  },
  { _id: true }
);

// Un problema de una fila (08/10/2026): una fila puede tener varios, y cada
// uno se marca resuelto con su círculo.
const ProblemaSchema = new Schema(
  {
    texto: { type: String, trim: true, required: true },
    resuelto: { type: Boolean, default: false },
    // Cuánto lleva la tarea (09/10/2026): texto libre ("2 hs", "1 día").
    duracion: { type: String, trim: true, default: "" },
    fecha: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Una reparación de una fila de una Manitou (11/10/2026): el problema, el
// detalle de lo que se hizo y si ya se realizó.
const ReparacionSchema = new Schema(
  {
    problema: { type: String, trim: true, required: true },
    detalle: { type: String, trim: true, default: "" },
    realizado: { type: Boolean, default: false },
    // Los detalles de cómo se hizo (18/10/2026): texto libre, del + al lado
    // del círculo.
    notas: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

// Una fila de la tabla de un sistema (Motor, Torre…) de Manitous › General en
// una cosecha (06/10/2026): el ítem, si se chequeó, cómo dio la tarea (ok o
// x, con el problema escrito) y los repuestos pedidos.
const ChequeoSanPabloSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    seccion: { type: String, trim: true, required: true },
    sistema: { type: String, trim: true, required: true },
    item: { type: String, trim: true, required: true },
    // Una breve descripción del ítem (09/10/2026): se carga en General y se
    // copia a las Manitou, como el ítem.
    descripcion: { type: String, trim: true, default: "" },
    // En una Manitou, la tarea que no corresponde a esa unidad (10/10/2026,
    // el turbo de la 1101 y la 1102): se ve "NO APLICA" y no se chequea. No
    // sale de General, así que la réplica no la toca.
    no_aplica: { type: Boolean, default: false },
    // En una Manitou, las reparaciones de la tarea (11/10/2026; antes un
    // texto libre, `reparacion`). No salen de General, así que la réplica no
    // las toca.
    reparaciones: { type: [ReparacionSchema], default: [] },
    chequeado: { type: Boolean, default: false },
    // Cuánto pesa la tarea dentro de su sistema, en % (21/10/2026): las de un
    // sistema suman 100 (el 100% de Motor). Se carga en General y la réplica
    // lo copia a cada Manitou, donde se puede cambiar para esa máquina (según
    // el estado de cada elemento) sin tocar General. Null sin cargar.
    peso: { type: Number, min: [0, "El peso va de 0 a 100"], max: [100, "El peso va de 0 a 100"], default: null },
    // En una Manitou, el peso cambiado ahí: la réplica de General ya no lo
    // pisa. Borrándolo en la Manitou vuelve al de General.
    pesoPropio: { type: Boolean, default: false },
    // En una Manitou, cuánto lleva la tarea en % (21/10/2026): lo carga el
    // taller a mano en la columna que antes era el círculo de OK. Null sin
    // cargar. Al guardarlo, el OK (`chequeado`) queda en 100% sí y si no, no.
    avance: { type: Number, min: [0, "El avance va de 0 a 100"], max: [100, "El avance va de 0 a 100"], default: null },
    tarea: { type: String, enum: ["ok", "x", null], default: null },
    // El problema de antes, uno solo con la x (tarea). Las filas viejas se
    // pasan a `problemas` la primera vez que se tocan.
    problema: { type: String, trim: true, default: "" },
    problemas: { type: [ProblemaSchema], default: [] },
    repuestos: { type: [RepuestoSchema], default: [] },
    // En una Manitou, la fila de General de la que es copia (09/10/2026):
    // el ítem y los repuestos se mantienen iguales a los de General, salvo
    // las cantidades. Null en General y en lo que quedó suelto.
    origen: { type: Schema.Types.ObjectId, ref: "ChequeoSanPablo", default: null },
  },
  { timestamps: true }
);

ChequeoSanPabloSchema.index({ cosecha: 1, seccion: 1, sistema: 1, createdAt: 1 });
ChequeoSanPabloSchema.index({ origen: 1 });

export default model("ChequeoSanPablo", ChequeoSanPabloSchema);
