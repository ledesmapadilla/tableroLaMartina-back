/**
 * Los campos donde se produce.
 *
 * No es una colección: son dos y no se dan de alta desde ninguna pantalla, así
 * que viven acá como una lista fija. Lo que se guarda en cada documento es la
 * clave (`caspinchango`, `san-pablo`), que además es lo que va en la URL.
 *
 * Para sumar uno alcanza con agregarlo acá y en la pantalla de
 * establecimientos del front.
 */
export const ESTABLECIMIENTOS = [
  { clave: "caspinchango", nombre: "Caspinchango" },
  { clave: "san-pablo", nombre: "San Pablo" },
];

export const CLAVES = ESTABLECIMIENTOS.map((e) => e.clave);

// El que se asume cuando no viene: es el único que existía antes de separar
// los campos, así que todo lo cargado hasta ahora es de acá.
export const POR_DEFECTO = "caspinchango";

// Campo listo para meter en cualquier schema que se separe por establecimiento.
export const campoEstablecimiento = {
  type: String,
  enum: CLAVES,
  required: true,
  default: POR_DEFECTO,
  index: true,
};
