/**
 * Caspinchango se llama Berdina en todo el proyecto (19/09/2026). Los textos
 * que vienen de afuera (el Excel mensual de Contable, 05/11/2026) todavía
 * dicen Caspinchango: esto lo cambia por Berdina en cualquier parte del texto.
 *
 * Reconoce la palabra escrita de muchas maneras:
 *  - mayúsculas, minúsculas y acentos: "CASPINCHANGO", "Caspinchángo";
 *  - con un espacio, un guion o un punto en el medio: "Caspin chango";
 *  - con hasta dos letras de más, de menos o cambiadas: "Caspinchago",
 *    "Kaspinchango", "Caspichango";
 *  - abreviada desde "Caspinch" o "Caspich": "Caspinch I Lote 9 Li".
 *
 * Una palabra se cambia entera y el resto del texto queda igual:
 * "Plantación 2023-Caspinchango I-Lote 6" → "Plantación 2023-Berdina I-Lote 6".
 * Si venía toda en mayúsculas, queda "BERDINA".
 *
 * Solo para textos que se muestran. Las claves internas (`caspinchango` en
 * las URL y en la base) no se tocan.
 */

const OBJETIVO = "caspinchango";
const PREFIJOS = ["caspinch", "kaspinch", "caspich", "kaspich"];
const MAX_ERRORES = 2;
// Por debajo de esto una palabra es demasiado corta para parecerse sin riesgo
// ("casa", "campo").
const LARGO_MINIMO = 9;

const normalizar = (t) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** Distancia de edición (letras de más, de menos o cambiadas). */
const distancia = (a, b) => {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
};

const pareceCompleta = (n) => n.length >= LARGO_MINIMO && distancia(n, OBJETIVO) <= MAX_ERRORES;

/** Una sola palabra: completa (aunque esté mal escrita) o abreviada. */
const esCaspinchango = (palabra) => {
  const n = normalizar(palabra);
  return PREFIJOS.some((p) => n.startsWith(p)) || pareceCompleta(n);
};

const reemplazo = (original) =>
  original === original.toUpperCase() && original !== original.toLowerCase() ? "BERDINA" : "Berdina";

/** El texto con cada Caspinchango (o parecido) cambiado por Berdina. */
export const conBerdina = (texto) => {
  if (typeof texto !== "string" || !texto) return texto;
  // Las palabras (letras, con tildes) y dónde está cada una.
  const palabras = [...texto.matchAll(/\p{L}+/gu)].map((m) => ({ texto: m[0], desde: m.index, hasta: m.index + m[0].length }));
  if (!palabras.length) return texto;

  let salida = "";
  let cursor = 0;
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i];
    const sig = palabras[i + 1];
    // Partida en dos ("Caspin chango", "Caspinchan go"): se toman las dos
    // mitades juntas si así dan la palabra casi exacta (un error como mucho)
    // y se parecen más que la primera sola. Con un error y no dos, para no
    // comerse la palabra que sigue a "Caspinch" ("Caspinch I Lote").
    const separador = sig ? texto.slice(p.hasta, sig.desde) : null;
    const juntas = sig ? normalizar(p.texto + sig.texto) : "";
    if (
      sig &&
      /^[\s.-]{1,2}$/.test(separador) &&
      juntas.length >= LARGO_MINIMO &&
      distancia(juntas, OBJETIVO) <= 1 &&
      distancia(juntas, OBJETIVO) < distancia(normalizar(p.texto), OBJETIVO)
    ) {
      salida += texto.slice(cursor, p.desde) + reemplazo(p.texto);
      cursor = sig.hasta;
      i++;
      continue;
    }
    if (esCaspinchango(p.texto)) {
      salida += texto.slice(cursor, p.desde) + reemplazo(p.texto);
      cursor = p.hasta;
    }
  }
  return salida + texto.slice(cursor);
};
