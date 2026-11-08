/**
 * Las unidades de las tareas de La Martina (Altas › Tareas): las mismas que
 * ofrece esa pantalla.
 */
export const UNIDADES_LA_MARTINA = ["Horas", "Plantas", "Tancadas", "Un", "Hectárea"];

// Cómo vienen escritas en los Excel de Citrusvil (05/11/2026) → la de La
// Martina. Se comparan en mayúsculas, sin acentos, puntos ni espacios.
const EQUIVALENTES = {
  Horas: ["H", "HR", "HRA", "HRS", "HS", "HORA", "HORAS"],
  Plantas: ["PL", "PLA", "PLAN", "PLANTA", "PLANTAS"],
  Tancadas: ["TAN", "TANC", "TANCADA", "TANCADAS"],
  Hectárea: ["HA", "HAS", "HECT", "HECTAREA", "HECTAREAS"],
  Un: ["U", "UN", "UNI", "UNID", "UNIDAD", "UNIDADES"],
};
const A_LA_MARTINA = new Map(
  Object.entries(EQUIVALENTES).flatMap(([unidad, formas]) => formas.map((f) => [f, unidad]))
);

/** La unidad como se compara: "Hrs." → "HRS". */
export const formaUnidad = (unidad) =>
  String(unidad || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

/**
 * La unidad de La Martina de una forma, o null si no se reconoce. `extras` son
 * las equivalencias cargadas a mano (EquivalenciaUnidad, 08/11/2026): Map
 * forma → unidad.
 */
export const unidadConocida = (unidad, extras) => {
  const forma = formaUnidad(unidad);
  if (!forma) return null;
  const deLaMartina = UNIDADES_LA_MARTINA.find((u) => formaUnidad(u) === forma);
  return A_LA_MARTINA.get(forma) || deLaMartina || extras?.get(forma) || null;
};

/**
 * La unidad de una tarea de Citrusvil con el nombre de La Martina: "HRA" y
 * "H" son Horas, "PLA" Plantas, "TAN" Tancadas, "HA" Hectárea, más las
 * cargadas a mano (`extras`). Una que no se reconoce queda como vino.
 */
export const unidadLaMartina = (unidad, extras) => {
  if (!unidad) return unidad || "";
  return unidadConocida(unidad, extras) || String(unidad).trim();
};
