import mongoose from "mongoose";

export const TIPOS = ["entrada", "salida", "ajuste"];

/**
 * Cada cosa que entra o sale del almacén (20/09/2026).
 *
 * Es lo que hace que el saldo sea confiable: el día que el número no cuadre,
 * acá está la historia de cómo llegó a ese valor. Va en su propia colección y
 * no adentro del artículo porque crece sin límite.
 *
 *  - entrada: llegó mercadería.
 *  - salida:  se entregó a un taller (queda el taller y quién retiró).
 *  - ajuste:  un conteo, una rotura o un error de carga.
 *
 * `cantidad` es lo que entró o salió; en un ajuste, la diferencia contra lo que
 * había (puede ser negativa). `saldo` es cómo quedó el artículo después, para
 * poder leer el historial sin recalcular nada.
 */
const movimientoStockSchema = new mongoose.Schema(
  {
    articulo: { type: mongoose.Schema.Types.ObjectId, ref: "ArticuloStock", required: true, index: true },
    fecha: { type: Date, default: Date.now, index: true },
    tipo: { type: String, enum: TIPOS, required: true },
    cantidad: { type: Number, required: true },
    saldo: { type: Number, required: true },
    // Solo en las salidas: a qué taller fue y quién lo retiró.
    taller: { type: String, trim: true, default: "" },
    persona: { type: String, trim: true, default: "" },
    // De dónde vino (una OP, una compra directa) o por qué se ajustó.
    nota: { type: String, trim: true, default: "" },
    // Quién lo registró en el sistema.
    usuario: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("MovimientoStock", movimientoStockSchema, "movimientosstock");
