import { Schema, model } from "mongoose";

// Personal de Producción. El apellido y el nombre van juntos en un solo campo,
// que es como se lo carga y se lo busca en la planilla.
const PersonalSchema = new Schema(
  {
    apellidoNombre: { type: String, required: true, trim: true },
    dni: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default model("Personal", PersonalSchema);
