import { puedeRol } from "./resolver.js";

/**
 * Quién puede tocar qué de un ítem de pedido (19/09/2026).
 *
 * El PUT de un ítem lo usan las cuatro pantallas del circuito de Compras —el
 * taller, el analista, el comprador y Gerencia—, así que pedir "Editar en
 * alguna de las cuatro" no alcanzaba: con editar en Analista se podían escribir
 * el número de OP o los estados del comprador, llamando a la API a mano.
 *
 * Acá se dice, campo por campo y estado por estado, qué habilita cada permiso.
 * Un campo que no figura en ninguna lista no se puede escribir por esta ruta.
 */

/**
 * El apuro lo puede poner cualquiera de los cuatro: es reclamarle al que tiene
 * la tarea pendiente, y la pantalla ya se encarga de que nadie se apure a sí
 * mismo (20/09/2026).
 */
const APURO = "apuro";

/** Los datos del pedido: los carga el taller y los corrigen analista y comprador. */
const CAMPOS_DEL_PEDIDO = [
  "nombre_repuesto",
  "cant",
  "unidad",
  "descripcion",
  "urgencia",
  "grupo",
  "cc",
  "solicita",
];

export const CAMPOS_POR_PERMISO = {
  // El taller también adjunta en su pedido, no solo el analista (19/09/2026).
  "compras.pedidos": [...CAMPOS_DEL_PEDIDO, "archivo", APURO],
  // El análisis: los tres presupuestos, cuál se elige y lo que hay en stock.
  "compras.analista": [
    ...CAMPOS_DEL_PEDIDO,
    "stock",
    "proveedor1",
    "precio1",
    "proveedor2",
    "precio2",
    "proveedor3",
    "precio3",
    "elegido",
    // Lo que anota el analista sobre el ítem (22/09/2026).
    "observaciones",
    // El presupuesto del proveedor.
    "archivo",
    APURO,
  ],
  // `oc` es el número de la orden de pago: lo pone el comprador al armarla.
  "compras.comprador": [...CAMPOS_DEL_PEDIDO, "oc", APURO],
  // Gerencia autoriza y rechaza: mueve el estado, no carga datos.
  "compras.gerencia": [APURO],
};

/**
 * A qué estado puede llevar cada uno. El taller no mueve el circuito: su
 * pantalla ni siquiera manda el estado.
 *
 * El analista cierra el análisis y el monto decide: si llega al umbral va a
 * Gerencia ("Autorizar") y si no pasa derecho al comprador ("Para hacer OP"),
 * sin autorización. Por eso "Para hacer OP" es del analista y de Gerencia, y
 * hacer la OP —que es otra cosa, y otra ruta— sigue siendo solo del comprador.
 */
export const ESTADOS_POR_PERMISO = {
  "compras.pedidos": [],
  "compras.analista": ["Para analisis", "Para revision", "En analisis", "Autorizar", "Para hacer OP", "Rechazado"],
  "compras.gerencia": ["Para hacer OP", "Para revision", "Rechazado"],
  "compras.comprador": ["Pedido", "Pendiente", "En proceso", "Para retirar", "Retirado", "Completado", "Rechazado"],
};

// Desde dónde un ítem puede volver a "Para analisis": lo que todavía no tiene
// orden de pago. Después de la OP ya está comprado.
const VUELVEN_A_ANALISIS = ["Pedido", "En analisis", "Para revision", "Autorizar", "Para hacer OP", "Rechazado"];

const CLAVES = Object.keys(CAMPOS_POR_PERMISO);

/** Lo que el rol puede escribir: la suma de las pantallas donde puede editar. */
const permitidoPara = async (rol) => {
  const campos = new Set();
  const estados = new Set();
  for (const clave of CLAVES) {
    if (!(await puedeRol(rol, clave, "editar"))) continue;
    CAMPOS_POR_PERMISO[clave].forEach((c) => campos.add(c));
    (ESTADOS_POR_PERMISO[clave] || []).forEach((e) => estados.add(e));
  }
  return { campos, estados };
};

/**
 * Revisa un cambio sobre un ítem. Devuelve null si está permitido, o
 * { status, error } para cortar.
 *
 * `estadoActual` es el que tiene el ítem guardado: las pantallas mandan el
 * estado aunque no lo cambien, y repetir el que ya estaba no es mover el
 * circuito, así que no pide permiso.
 */
export const revisarCambioDeItem = async (rol, campos, estadoActual) => {
  // Volver a análisis (26/09/2026): se puede desde el análisis ya hecho
  // (Autorizar, Para hacer OP) o desde un rechazo, nunca después de la orden de
  // pago. Vale también para el superadmin: es el circuito, no un permiso.
  const nuevoEstado = campos.estado;
  if (
    nuevoEstado === "Para analisis" &&
    nuevoEstado !== estadoActual &&
    !VUELVEN_A_ANALISIS.includes(estadoActual)
  ) {
    return {
      status: 409,
      error: `Un ítem en "${estadoActual}" ya no puede volver a análisis.`,
    };
  }

  if (rol === "superadmin") return null;
  const { campos: permitidos, estados } = await permitidoPara(rol);

  // El estado va aparte: no es un dato del ítem sino el paso del circuito, y
  // se mide contra ESTADOS_POR_PERMISO, más abajo.
  const prohibidos = Object.keys(campos).filter((c) => c !== "estado" && !permitidos.has(c));
  if (prohibidos.length) {
    return {
      status: 403,
      error: `Tu rol no tiene permiso para editar: ${prohibidos.join(", ")}`,
    };
  }

  const nuevo = campos.estado;
  if (nuevo && nuevo !== estadoActual && !estados.has(nuevo)) {
    return { status: 403, error: `Tu rol no tiene permiso para pasar el pedido a "${nuevo}"` };
  }

  return null;
};
