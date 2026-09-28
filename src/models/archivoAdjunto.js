import mongoose from 'mongoose'

/**
 * Un adjunto de Compras: el archivo vive en Cloudinary y acá queda la URL con
 * la que se abre, el nombre con el que se subió y el public_id con el que se
 * borra. `tipo` es "image" o "raw" (los PDF), que es lo que pide Cloudinary
 * para borrarlo.
 *
 * Es el mismo que ya llevaba cada ítem; desde el 28/09/2026 lo lleva también el
 * pedido entero, para lo que abarca a todos sus ítems (un presupuesto único,
 * el remito de todo lo que se pidió).
 */
export const archivoAdjuntoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    nombre: { type: String, trim: true },
    publicId: { type: String, required: true },
    tipo: { type: String, enum: ['image', 'raw'], default: 'image' },
    subidoPor: { type: String, trim: true },
    fecha: { type: Date, default: Date.now },
  },
  { _id: false }
)
