import { Schema, model } from "mongoose";

// Personal de Producción. El apellido y el nombre van juntos en un solo campo,
// que es como se lo carga y se lo busca en la planilla.
const PersonalSchema = new Schema(
  {
    apellidoNombre: { type: String, required: true, trim: true },
    // El DNI y el legajo son datos de referencia: hay gente que se carga sin
    // tenerlos a mano, así que ninguno de los dos es obligatorio.
    dni: { type: String, trim: true, default: "" },
    legajo: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default model("Personal", PersonalSchema);
