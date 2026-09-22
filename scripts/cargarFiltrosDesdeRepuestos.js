// Carga inicial del almacén de filtros con lo que ya estaba en Tractores ›
// Repuestos (22/09/2026).
//
// Cada unidad tiene hasta 3 marcas por filtro (aire, combustible, aceite) y la
// misma marca y código se repiten en muchas unidades: acá se juntan en una
// fila por filtro distinto. La existencia arranca en 0 a pedido del usuario:
// los códigos son lo que se sabe, cuántos hay en el depósito todavía no.
//
// Es idempotente: no vuelve a cargar un filtro que ya está (misma marca y
// mismo código de fábrica).
//
//   node --env-file .env scripts/cargarFiltrosDesdeRepuestos.js
import mongoose from "mongoose";
import RepuestoTractor from "../src/models/RepuestoTractor.js";
import Filtro, { PREFIJOS } from "../src/models/Filtro.js";

// Qué campo de Repuestos es qué tipo del almacén.
const TIPO_DE_CAMPO = {
  filtroAire: "Filtro de aire",
  filtroCombustible: "Filtro de combustible",
  filtroAceite: "Filtro de aceite",
};

/**
 * Los códigos escritos en una sola casilla.
 *
 * En Repuestos hay casillas con más de un código: "P5036 Y P5054" (el Chery
 * lleva los dos) y "WF10091 / SF10091". Se separan en un filtro cada uno.
 */
const codigosDe = (texto) =>
  (texto || "")
    .split(/\s+Y\s+|\s*\/\s*|\s*,\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);

const clave = (marca, codigo) => `${marca.toLowerCase()}|${codigo.toLowerCase()}`;

const uri = process.env.MONGODB;
if (!uri) {
  console.error("Falta la variable de entorno MONGODB");
  process.exit(1);
}
await mongoose.connect(uri, { autoIndex: false });

// Lo que ya está en el almacén, para no cargarlo dos veces.
const existentes = new Set(
  (await Filtro.find().select("marca codigoFabrica").lean()).map((f) =>
    clave(f.marca || "", f.codigoFabrica || "")
  )
);

const repuestos = await RepuestoTractor.find().lean();
const nuevos = new Map();

for (const repuesto of repuestos) {
  for (const [campo, tipo] of Object.entries(TIPO_DE_CAMPO)) {
    for (const alternativa of repuesto[campo] || []) {
      const marca = (alternativa.marca || "").trim();
      for (const codigoFabrica of codigosDe(alternativa.codigo)) {
        const k = clave(marca, codigoFabrica);
        if (existentes.has(k) || nuevos.has(k)) continue;
        nuevos.set(k, { tipo, marca, codigoFabrica, existencia: 0 });
      }
    }
  }
}

// Ordenados por tipo y, adentro, por marca y código: así el código interno que
// arma el alta (COM-001, ACE-001…) queda corriendo en un orden que se lee.
const orden = Object.keys(PREFIJOS);
const aCargar = [...nuevos.values()].sort(
  (a, b) =>
    orden.indexOf(a.tipo) - orden.indexOf(b.tipo) ||
    a.marca.localeCompare(b.marca, "es") ||
    a.codigoFabrica.localeCompare(b.codigoFabrica, "es")
);

for (const datos of aCargar) {
  // El código interno se arma igual que en el alta de la pantalla: el mayor
  // que haya de ese tipo + 1.
  const prefijo = PREFIJOS[datos.tipo];
  const delTipo = await Filtro.find({ codigo: new RegExp(`^${prefijo}-\\d+$`) })
    .select("codigo")
    .lean();
  const ultimo = delTipo.reduce((mayor, f) => Math.max(mayor, parseInt(f.codigo.split("-")[1], 10) || 0), 0);
  const codigo = `${prefijo}-${String(ultimo + 1).padStart(3, "0")}`;
  await Filtro.create({ ...datos, codigo });
  console.info(`${codigo}  ${datos.tipo.padEnd(12)} ${datos.marca.padEnd(20)} ${datos.codigoFabrica}`);
}

console.info(`\n${aCargar.length} filtros cargados (${existentes.size} ya estaban).`);
await mongoose.disconnect();
