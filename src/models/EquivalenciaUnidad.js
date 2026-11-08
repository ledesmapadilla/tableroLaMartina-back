import mongoose from "mongoose";
import { UNIDADES_LA_MARTINA } from "../catalogos/unidadesTarea.js";

/**
 * Las unidades de Citrusvil que no están en catalogos/unidadesTarea.js y a
 * qué unidad de La Martina equivalen (08/11/2026). Una unidad nueva del Excel
 * mensual se deja cargar; después Equivalencias pide decir a cuál equivale,
 * y hasta entonces esas tareas no se pueden unir con ninguna de La Martina.
 *
 * `forma` es la unidad como la compara el catálogo: en mayúsculas, sin
 * acentos, puntos ni espacios ("Jor." → "JOR").
 */
const equivalenciaUnidadSchema = new mongoose.Schema(
  {
    forma: { type: String, required: true, trim: true },
    unidad: { type: String, required: true, enum: UNIDADES_LA_MARTINA },
    creadaPor: { type: String, trim: true },
  },
  { timestamps: true }
);

equivalenciaUnidadSchema.index({ forma: 1 }, { unique: true });

export default mongoose.model("EquivalenciaUnidad", equivalenciaUnidadSchema, "equivalenciasunidad");
