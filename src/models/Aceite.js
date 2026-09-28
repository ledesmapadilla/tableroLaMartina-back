import { Schema, model } from "mongoose";

/**
 * Los aceites del almacén (28/09/2026).
 *
 * Vienen del Sistema de Gestión Lepa, donde se daban de alta en Altas › Aceites
 * y se movían en Mantenimiento › Consumo de aceites. Allá los movimientos iban
 * adentro del aceite y el stock se calculaba sumándolos cada vez; acá van en
 * su propia colección (`MovimientoAceite`) y la existencia es el saldo, como en
 * los rubros del almacén de repuestos.
 *
 * No es un rubro más: se mide en litros —con decimales— y no lleva código
 * interno, porque en el taller se lo nombra por el tipo y la marca.
 */
const AceiteSchema = new Schema(
  {
    // Motor, hidráulico, transmisión, grasa… Es lo que se elige al cargar una
    // compra o un consumo.
    tipo: { type: String, required: true, trim: true },
    marca: { type: String, required: true, trim: true },
    // El nombre comercial, con la viscosidad: "Rimula R4 15W40".
    denominacion: { type: String, trim: true, default: "" },
    // Para qué se usa: "Motor de maquinaria pesada".
    uso: { type: String, required: true, trim: true },
    // Los litros que hay. Los mueven las compras y los consumos.
    existencia: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default model("Aceite", AceiteSchema, "aceites");
