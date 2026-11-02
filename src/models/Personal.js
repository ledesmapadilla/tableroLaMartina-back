import { Schema, model } from "mongoose";

// Personal de Producción. Desde el 02/11/2026 el apellido y el nombre se
// cargan por separado; `apellidoNombre` ("Apellido, Nombre") lo arma el
// controlador al guardar y es lo que leen todas las pantallas, así que nada
// más cambió. Motor Generador y Uso interno no tienen apellido ni nombre: van
// solo con `apellidoNombre`, como siempre.
const PersonalSchema = new Schema(
  {
    apellido: { type: String, trim: true, default: "" },
    nombre: { type: String, trim: true, default: "" },
    apellidoNombre: { type: String, required: true, trim: true },
    // El DNI y el legajo son datos de referencia: hay gente que se carga sin
    // tenerlos a mano, así que ninguno de los dos es obligatorio.
    dni: { type: String, trim: true, default: "" },
    legajo: { type: String, trim: true, default: "" },
    // "Uso interno" (27/10/2026): no es una persona. Se elige en la carga de
    // datos para los consumos de gasoil sin CC ni tarea. Hay uno solo y no se
    // borra ni se renombra.
    usoInterno: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model("Personal", PersonalSchema);
