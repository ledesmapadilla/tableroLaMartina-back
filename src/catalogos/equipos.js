// Los equipos del padrón de CC y el grupo de Compras de cada uno (16/09/2026).
//
// En el alta de CC se elige solo el equipo: el grupo sale de acá y no se
// escribe a mano, así un CC no puede quedar en un grupo que no es el suyo ni
// sin grupo (y fuera del selector de Nuevo pedido).
//
// `flota` es la pantalla donde aparece la unidad al dar de alta el CC; `km`,
// los que cuentan kilómetros en vez de horas.
//
// Hay una copia igual en TableroFront/src/utils/equipos.js: si se toca una,
// se toca la otra.
export const EQUIPOS = [
  { equipo: "Tractor", grupo: "Tractores", flota: "Tractores" },
  { equipo: "Manitou", grupo: "Manitou", flota: "Tractores" },
  { equipo: "Camión", grupo: "Tractores", flota: "Tractores", km: true },
  { equipo: "Turbo", grupo: "Pulverizadora" },
  { equipo: "Jacto", grupo: "Pulverizadora" },
  { equipo: "Martignani", grupo: "Pulverizadora" },
  { equipo: "Metalfor", grupo: "Pulverizadora" },
  { equipo: "Chancho", grupo: "Chancho" },
  { equipo: "Nodriza", grupo: "Nodriza" },
  { equipo: "Herbicida", grupo: "Herbicida" },
  { equipo: "Desmalezadora", grupo: "Desmalezadora" },
  { equipo: "Abonadora", grupo: "Abonadora" },
  { equipo: "Tk. riego", grupo: "Riego" },
  { equipo: "Camioneta", grupo: "Camioneta", flota: "Camionetas" },
  { equipo: "Colectivo", grupo: "Colectivos", flota: "Colectivos" },
  { equipo: "Otros", grupo: "Otros" },
];

const fichaDe = (equipo) => EQUIPOS.find((e) => e.equipo === (equipo || "").trim()) || null;

export const esEquipo = (equipo) => Boolean(fichaDe(equipo));
export const grupoDeEquipo = (equipo) => fichaDe(equipo)?.grupo || "";
export const flotaDeEquipo = (equipo) => fichaDe(equipo)?.flota || null;
export const cuentaKm = (equipo) => Boolean(fichaDe(equipo)?.km);
