import { SECCION_GENERAL, SECCIONES_MANITOU } from "./manitous.js";

// La reparación de las tolvas de San Pablo (31/10/2026), igual que las
// Manitou: General es la plantilla y cada tolva trabaja con la copia. A
// diferencia de las Manitou no son fijas: salen del padrón de CC y se les
// puede cambiar el código, por eso la sección lleva el id del CC y no el
// código (lo que va por id no hay que reescribirlo, ver renombrarCC.service.js).
export const EQUIPO_TOLVA = "Tolva";
export const GRUPO_TOLVA = "Tolvas";
export const SECCION_GENERAL_TOLVAS = "tolvas-general";

// Sus tarjetas, distintas de las de las Manitou. Igual que en el front
// (SISTEMAS_TOLVA en utils/sistemasManitou.js).
export const SISTEMAS_TOLVA = ["balde", "mastil", "cilindros", "perno-central", "sistema-hidraulico", "pintura"];

const SECCION_TOLVA = /^tolva-([0-9a-f]{24})$/;

export const seccionDeTolva = (id) => `tolva-${id}`;
export const tolvaDeSeccion = (seccion) => SECCION_TOLVA.exec(seccion)?.[1] ?? null;

export const esSeccionTolvas = (seccion) => seccion === SECCION_GENERAL_TOLVAS || Boolean(tolvaDeSeccion(seccion));
export const esSeccion = (seccion) => SECCIONES_MANITOU.includes(seccion) || esSeccionTolvas(seccion);
export const esSeccionGeneral = (seccion) => seccion === SECCION_GENERAL || seccion === SECCION_GENERAL_TOLVAS;
