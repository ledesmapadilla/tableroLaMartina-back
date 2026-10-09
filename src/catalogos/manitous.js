// Las Manitous de San Pablo (09/10/2026). General es la plantilla: los ítems
// y los repuestos se cargan ahí y se copian a cada unidad, que es donde se
// trabaja (OK, problemas, cantidades, cotizar y pedir). El número de la
// unidad es también su C.C.
export const UNIDADES_MANITOU = ["1100", "1101", "1102", "1103", "1104"];

export const SECCION_GENERAL = "manitous-general";
export const seccionDeUnidad = (unidad) => `manitou-${unidad}`;
export const unidadDeSeccion = (seccion) =>
  UNIDADES_MANITOU.find((u) => seccionDeUnidad(u) === seccion) || null;

export const SECCIONES_MANITOU = [SECCION_GENERAL, ...UNIDADES_MANITOU.map(seccionDeUnidad)];
