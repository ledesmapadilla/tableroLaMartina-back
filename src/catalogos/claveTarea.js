/**
 * La clave con la que se comparan las tareas de Citrusvil (05/11/2026): solo
 * letras y números, en minúscula y sin acentos. No cuentan mayúsculas,
 * acentos, espacios ni signos: "Alq.Tractor C/Cisterna" y "alq tractor c
 * cisterna" son la misma tarea, igual que "75HP" y "75 HP".
 *
 * Los errores de tipeo SÍ cuentan, a propósito: "Herbicida Lateral 8 x 4" y
 * "8 x 5" se diferencian en un carácter y son tareas distintas, con tarifas
 * distintas. Una variante mal escrita aparece sin equivalencia y se asigna a
 * mano.
 *
 * Copia en TableroFront/src/utils/contable.js (claveTarea): si cambia una,
 * cambia la otra.
 */
export const claveTarea = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
