import mongoose from "mongoose";

/**
 * Una fila de la tabla de Contable de un mes (05/11/2026).
 *
 * Nace del Excel mensual (la hoja de tareas de los contratistas, la de
 * "Otras tareas"): cada fila de detalle del Excel es una de estas. Las de
 * subtotal por tarea no se guardan, las calcula la pantalla. Desde acá la
 * tabla es del sistema: se puede trabajar sin volver al Excel.
 *
 * `orden` es la posición en el Excel, para mostrarlas igual.
 */
const filaContableSchema = new mongoose.Schema(
  {
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },
    orden: { type: Number, required: true },

    documentoCompras: { type: String, trim: true },
    ordenTrabajo: { type: String, trim: true },
    fecha: { type: Date },
    almacen: { type: String, trim: true },
    contratista: { type: String, trim: true },
    nroServicio: { type: String, trim: true },
    tarea: { type: String, trim: true },
    cantidad: { type: Number },
    unidad: { type: String, trim: true },
    precioUnitario: { type: Number },
    subtotal: { type: Number },
    ordenControl: { type: String, trim: true },
    // "Centro de coste" es el código y "Centro de costo", el nombre: así
    // vienen en el Excel.
    centroCosteCodigo: { type: String, trim: true },
    centroCosto: { type: String, trim: true },
    activoFijo: { type: String, trim: true },
  },
  { timestamps: true }
);

filaContableSchema.index({ anio: 1, mes: 1, orden: 1 });

export const CAMPOS_FILA = [
  "documentoCompras",
  "ordenTrabajo",
  "fecha",
  "almacen",
  "contratista",
  "nroServicio",
  "tarea",
  "cantidad",
  "unidad",
  "precioUnitario",
  "subtotal",
  "ordenControl",
  "centroCosteCodigo",
  "centroCosto",
  "activoFijo",
];

export default mongoose.model("FilaContable", filaContableSchema, "filascontables");
