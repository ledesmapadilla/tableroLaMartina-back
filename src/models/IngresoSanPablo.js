import { Schema, model } from "mongoose";

// Un equipo que entra al taller de la base San Pablo (16/09/2026).
//
// `tipo` es la tarjeta de Reparaciones San Pablo donde se carga: arranca con
// los Manitous y las demás (colectivos, tolvas, carros, escaleras,
// pulverizadoras) usan la misma colección.
//
// La fecha es un día sin hora: se guarda a las 00:00 UTC y se muestra en UTC.
export const TIPOS_INGRESO = [
  "manitous",
  "colectivos",
  "tolvas",
  "carros-porta-bines",
  "carros-porta-escaleras",
  "escaleras",
  "pulverizadoras",
];

const IngresoSanPabloSchema = new Schema(
  {
    tipo: { type: String, enum: TIPOS_INGRESO, required: true },
    // Para qué cosecha se prepara el equipo (2027, 2028…). Lo cargado hasta el
    // 16/09/2026 quedó en la 2027.
    cosecha: { type: Number, required: true, min: 2027 },
    // Las escaleras nuevas (hechas en el taller), las que entran sin carro y
    // las bajas no van con ningún carro.
    cc: {
      type: Schema.Types.ObjectId,
      ref: "CentroCosto",
      default: null,
      required() {
        return !this.nuevas && !this.baja && !this.sinCarro;
      },
    },
    fechaIngreso: { type: Date, required: true },
    // En Carros porta escaleras: el día que el carro sale del taller (vacío
    // mientras sigue adentro).
    fechaEgreso: { type: Date, default: null },
    ingresadoPor: { type: String, trim: true, default: "" },
    revisada: { type: Boolean, default: false },
    planMantenimiento: { type: Boolean, default: false },
    // En los carros porta escaleras: cuántas escaleras trae. En Escaleras es
    // la copia de su carro, con cuántas estaban sanas y cuántas rotas.
    cantidadEscaleras: { type: Number, min: 0, default: null },
    escalerasSanas: { type: Number, min: 0, default: null },
    escalerasRotas: { type: Number, min: 0, default: null },
    // De las rotas, cuántas ya se repararon.
    escalerasReparadas: { type: Number, min: 0, default: null },
    // En Escaleras: el ingreso del carro con el que entraron. Se crea, se
    // actualiza y se borra junto con él.
    origen: { type: Schema.Types.ObjectId, ref: "IngresoSanPablo", default: null },
    // En Escaleras: escaleras nuevas hechas en el taller ("Nuevas escaleras").
    // Van sin carro; `cantidadEscaleras` es cuántas e `ingresadoPor`, quién las
    // hizo.
    nuevas: { type: Boolean, default: false },
    // En Escaleras: escaleras que entran al taller sin carro ("Ingreso sin
    // carro"). `cantidadEscaleras` es cuántas e `ingresadoPor`, quién las trae.
    sinCarro: { type: Boolean, default: false },
    // En Escaleras: un retiro ("Retiro de escaleras"). `cc` es el carro que se
    // las lleva, `cantidadEscaleras` cuántas e `ingresadoPor` el supervisor.
    retiro: { type: Boolean, default: false },
    // En Escaleras: una baja ("Baja de escaleras"), escaleras que se desechan.
    // `ingresadoPor` es quién las desecha, `motivo` por qué y `avisadoA` a
    // quién se le avisó.
    baja: { type: Boolean, default: false },
    motivo: { type: String, trim: true, default: "" },
    avisadoA: { type: String, trim: true, default: "" },
    // En Carros porta escaleras: la salida de escaleras que anota un retiro
    // (enlazado por `origen`). Se crea, se actualiza y se borra con el retiro.
    salida: { type: Boolean, default: false },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

IngresoSanPabloSchema.index({ cosecha: 1, tipo: 1, fechaIngreso: -1 });
IngresoSanPabloSchema.index({ origen: 1 });

export default model("IngresoSanPablo", IngresoSanPabloSchema);
