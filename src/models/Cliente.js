import { Schema, model } from "mongoose";

// Padrón de clientes de Producción (04/10/2026). Antes el cliente era texto
// libre en el parte y en el precio; desde ahora se elige de acá, así un error
// de tipeo no crea un cliente nuevo ni deja un parte sin precio.
//
// El parte y el precio siguen guardando el NOMBRE (texto), no el id: así no
// hubo que migrar los 600 partes que ya existían. Por eso renombrar un cliente
// renombra también sus partes y sus precios (ver clientes.controller.js).
const ClienteSchema = new Schema(
  {
    nombre: { type: String, required: [true, "Falta el nombre"], trim: true },
    // El nombre sin mayúsculas, tildes ni espacios de más: es lo que no se
    // puede repetir ("Citrusvil" y "citrusvil" son el mismo cliente).
    clave: { type: String, required: true, unique: true },
    // Un cliente inactivo no se ofrece en las cargas nuevas, pero sus partes
    // y sus precios siguen valiendo.
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model("Cliente", ClienteSchema);
