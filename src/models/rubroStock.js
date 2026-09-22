import { Schema, model } from "mongoose";
import { MOVIMIENTOS } from "../catalogos/almacen.js";

/**
 * Los modelos de un rubro del almacén que se da de alta por descripción
 * (22/09/2026).
 *
 * Todos guardan lo mismo, así que el esquema está una vez sola acá: cada rubro
 * es una colección aparte —una cubierta y un bulón no se miran juntos— pero
 * con los mismos campos. Filtros no pasa por acá: tiene su tipo de una lista y
 * su propio archivo.
 *
 * La colección es la clave del rubro en el catálogo (`cubiertas`, `repuestos`…)
 * y los movimientos se pluralizan solos (`movimientocubiertas`).
 */
export const crearModelosRubro = ({ rubro, modelo, aCargo = false }) => {
  const ArticuloSchema = new Schema(
    {
      // Único en toda la tabla: es con lo que se lo identifica. Una vez puesto
      // no cambia, ni siquiera si después se corrige la descripción (el código
      // ya quedó escrito en el estante y en los pedidos). Lo arma el
      // controlador con el prefijo del rubro: CUB-001, FER-012…
      codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
      // Lo único obligatorio del alta: qué es. "Cubierta 18.4-38", "Bulón
      // 1/2 x 3", "Amoladora angular".
      descripcion: { type: String, required: true, trim: true },
      marca: { type: String, trim: true, default: "" },
      // El que viene impreso en el artículo, el de la marca. No siempre se
      // conoce, y por eso el código interno no depende de él.
      codigoFabrica: { type: String, trim: true, default: "" },
      // Lo que hay en el depósito. Se carga sin saberlo todavía, así que por
      // defecto es cero.
      existencia: { type: Number, default: 0, min: 0 },
      ubicacion: { type: String, trim: true, default: "" },
      observaciones: { type: String, trim: true, default: "" },
    },
    { timestamps: true }
  );

  /**
   * Las entradas y salidas del artículo.
   *
   * La existencia es el saldo: cada movimiento la sube o la baja, y acá queda
   * el detalle de quién se llevó qué y para qué centro de costo. Los dos
   * movimientos guardan los mismos campos; lo que cambia es cómo se leen: en
   * una salida `persona` es quien retira y en una entrada, quien entrega.
   */
  const MovimientoSchema = new Schema(
    {
      articulo: { type: Schema.Types.ObjectId, ref: modelo, required: true, index: true },
      movimiento: { type: String, required: true, enum: MOVIMIENTOS },
      fecha: { type: Date, required: true },
      persona: { type: String, trim: true, default: "" },
      // A dónde va lo que sale. El grupo se pide primero y acota la lista de
      // centros de costo, que son muchos. Puede ser "Berdina": ahí el artículo
      // va al taller y no a un equipo, así que se queda sin CC.
      grupo: { type: String, trim: true, default: "" },
      cc: { type: String, trim: true, default: "" },
      cantidad: { type: Number, required: true, min: 1 },
      observaciones: { type: String, trim: true, default: "" },
    },
    { timestamps: true }
  );

  if (!aCargo) {
    return {
      Articulo: model(modelo, ArticuloSchema, rubro),
      Movimiento: model(`Movimiento${modelo}`, MovimientoSchema),
    };
  }

  // Una herramienta no se consume: se presta y vuelve. Quién la tiene hoy se
  // copia en el artículo para que la tabla lo muestre sin ir a buscarlo;
  // vacío quiere decir que está en el almacén.
  ArticuloSchema.add({
    aCargo: {
      persona: { type: String, trim: true, default: "" },
      fecha: { type: Date, default: null },
    },
  });

  /**
   * Una salida a cargo de alguien y su vuelta, en la misma fila.
   *
   * Es una fila por préstamo y no un movimiento suelto por cada punta: así "la
   * tiene fulano desde el martes" es una sola consulta —la que todavía no tiene
   * `devolucion.fecha`— y el historial se lee de corrido.
   */
  const AsignacionSchema = new Schema(
    {
      articulo: { type: Schema.Types.ObjectId, ref: modelo, required: true, index: true },
      // Cuándo se la llevó y quién se hace cargo.
      fecha: { type: Date, required: true },
      persona: { type: String, required: true, trim: true },
      observaciones: { type: String, trim: true, default: "" },
      // Mientras no tenga fecha, la herramienta sigue afuera.
      devolucion: {
        fecha: { type: Date, default: null },
        observaciones: { type: String, trim: true, default: "" },
      },
    },
    { timestamps: true }
  );

  return {
    Articulo: model(modelo, ArticuloSchema, rubro),
    Movimiento: model(`Movimiento${modelo}`, MovimientoSchema),
    Asignacion: model(`Asignacion${modelo}`, AsignacionSchema),
  };
};
