/**
 * El almacén de repuestos, lo que comparten todos los rubros (22/09/2026).
 *
 * Los prefijos de los códigos internos viven acá y no en cada modelo. Un
 * código como CUB-004 se escribe en el estante, en un pedido y en una entrega,
 * y cuando aparece ahí ya nadie sabe de qué rubro salió: si dos rubros usaran
 * el mismo prefijo habría dos artículos distintos con el mismo código y no
 * habría forma de distinguirlos. Teniéndolos juntos el choque se ve de una
 * mirada, y el control de abajo no deja arrancar el servidor si igual se cuela.
 *
 * La clave de cada rubro es la de su tarjeta en el stock y también el nombre de
 * su colección en Mongo.
 *
 * Hay dos formas de numerar, según cómo se dé de alta el artículo:
 *  - `porTipo`: el alta elige el tipo de una lista y el correlativo va por
 *    tipo, así los filtros de aire quedan numerados seguidos entre ellos.
 *  - `prefijo`: el alta escribe la descripción a mano —no hay lista que
 *    contenga todas las medidas de una cubierta ni todos los bulones— y el
 *    rubro entero numera con uno solo.
 */
export const RUBROS = {
  repuestos: { prefijo: "REP", modelo: "Repuesto" },
  filtros: {
    porTipo: {
      "Filtro de aire": "AIR",
      "Filtro de combustible": "COM",
      "Filtro de aceite": "ACE",
      "Filtro hidráulico": "HID",
      "Filtro trampa de agua": "TRA",
    },
  },
  // La gomería, las baterías, las correas y las cadenas.
  cubiertas: { prefijo: "CUB", modelo: "Cubierta" },
  ferreteria: { prefijo: "FER", modelo: "Ferreteria" },
  electricidad: { prefijo: "ELE", modelo: "Electricidad" },
  // Las herramientas se prestan: además de la existencia llevan a cargo de
  // quién está cada una, y por eso son el único rubro con `aCargo`.
  herramientas: { prefijo: "HER", modelo: "Herramienta", aCargo: true },
};

// Los rubros que se dan de alta escribiendo la descripción: todos menos
// Filtros. Son los que arman su modelo y su controlador solos.
export const RUBROS_POR_DESCRIPCION = Object.entries(RUBROS)
  .filter(([, config]) => config.prefijo)
  .map(([rubro, config]) => ({ rubro, ...config }));

// Todos los prefijos en uso, con de dónde sale cada uno.
const deQuienEs = new Map();
for (const [rubro, config] of Object.entries(RUBROS)) {
  const prefijos = config.porTipo
    ? Object.entries(config.porTipo).map(([tipo, prefijo]) => [prefijo, `${rubro}/${tipo}`])
    : [[config.prefijo, rubro]];

  // Un prefijo repetido entre rubros es un error de programación, no un dato
  // mal cargado: se avisa al importar, antes de que se llegue a dar de alta
  // nada.
  for (const [prefijo, dueño] of prefijos) {
    const anterior = deQuienEs.get(prefijo);
    if (anterior) {
      throw new Error(`El prefijo ${prefijo} del almacén está repetido: ${anterior} y ${dueño}`);
    }
    deQuienEs.set(prefijo, dueño);
  }
}

// Los tipos de un rubro que se da de alta eligiendo de una lista, en el orden
// en que están escritos arriba: es el de uso en el taller, no el alfabético.
export const tiposDe = (rubro) => Object.keys(RUBROS[rubro].porTipo);

// Las dos cosas que le pueden pasar a la existencia de un artículo.
export const MOVIMIENTOS = ["Entrada", "Salida"];
