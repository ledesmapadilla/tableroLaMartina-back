/**
 * Las cuentas de Contable › Caja (13/11/2026).
 *
 * La semana va de viernes a jueves (13/11/2026, primero era de jueves a
 * miércoles) y se nombra por su viernes ("2026-11-13"): `inicio`.
 * Saldo de una semana = lo que sobró de la anterior + ingreso fijo + entradas
 * − gastos, y ese saldo pasa a la semana que viene (si es negativo, también:
 * le descuenta). La cadena arranca en la primera semana que tiene algo
 * cargado; una semana del medio sin nada cargado suma igual su ingreso fijo.
 */

export const FIJO_INICIAL = 500000;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-12" → Date en UTC (null si no es una fecha válida). */
const aFecha = (s) => {
  if (!FECHA.test(String(s || ""))) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
};
const aTexto = (d) => d.toISOString().slice(0, 10);

export const fechaValida = (s) => aFecha(s) !== null;

export const sumarDias = (s, n) => {
  const d = aFecha(s);
  d.setUTCDate(d.getUTCDate() + n);
  return aTexto(d);
};

/** El viernes que abre la semana de esa fecha (null si no es una fecha). */
export const inicioDe = (s) => {
  const d = aFecha(s);
  if (!d) return null;
  // getUTCDay: 0 domingo … 5 viernes. Días desde el último viernes.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 2) % 7));
  return aTexto(d);
};

export const esInicio = (s) => fechaValida(s) && inicioDe(s) === s;

/** El jueves que cierra la semana que abre ese viernes. */
export const finDeSemana = (inicio) => sumarDias(inicio, 6);

const suma = (lista) => (lista || []).reduce((t, x) => t + (Number(x.monto) || 0), 0);
const redondear = (n) => Math.round(n * 100) / 100;

/**
 * La cuenta de la semana `inicio` con todas las semanas guardadas
 * (`docs`, cualquier orden; solo se usan las de antes y la misma).
 * Devuelve { arrastre, fijo, fijoPropio, entradas, gastos, saldo, inicioCaja }:
 * `inicioCaja` es la primera semana con algo cargado, donde arranca la caja
 * (null si no hay ninguna). Antes de esa no hay caja: sobrante 0.
 */
export const cuentaDeSemana = (docs, inicio) => {
  // Solo las semanas que empiezan en viernes: las de antes del 13/11/2026
  // (de jueves a miércoles) no entran en la cuenta.
  const porSemana = new Map((docs || []).filter((d) => esInicio(d.semana)).map((d) => [d.semana, d]));
  const anteriores = [...porSemana.keys()].filter((s) => s < inicio).sort();
  let fijo = FIJO_INICIAL;
  let arrastre = 0;
  if (anteriores.length) {
    // De la primera semana cargada hasta la anterior a esta, de a una.
    for (let s = inicioDe(anteriores[0]); s < inicio; s = sumarDias(s, 7)) {
      const d = porSemana.get(s);
      if (d?.fijo != null) fijo = d.fijo;
      arrastre = redondear(arrastre + fijo + suma(d?.entradas) - suma(d?.gastos));
    }
  }
  const actual = porSemana.get(inicio);
  const fijoPropio = actual?.fijo != null;
  if (fijoPropio) fijo = actual.fijo;
  const entradas = redondear(suma(actual?.entradas));
  const gastos = redondear(suma(actual?.gastos));
  const inicioCaja = [...porSemana.keys()].sort()[0] || null;
  return { arrastre, fijo, fijoPropio, entradas, gastos, saldo: redondear(arrastre + fijo + entradas - gastos), inicioCaja };
};

/** Los viernes de un mes (mes de 1 a 12): cada semana va en el mes de su viernes. */
export const semanasDelMes = (anio, mes) => {
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  if (!fechaValida(primero)) return [];
  let j = inicioDe(primero);
  if (j < primero) j = sumarDias(j, 7);
  const lista = [];
  for (; j.slice(0, 7) === primero.slice(0, 7); j = sumarDias(j, 7)) lista.push(j);
  return lista;
};

/** Los viernes de un año: cada semana va en el año (y el mes) de su viernes. */
export const semanasDelAnio = (anio) => Array.from({ length: 12 }, (_, i) => semanasDelMes(anio, i + 1)).flat();
