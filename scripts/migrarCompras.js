/**
 * Trae las colecciones de Compras a la base del Tablero.
 *
 * Los dos sistemas pasan a ser uno solo, con una sola base. Ninguna de estas
 * colecciones existe en el Tablero, así que se copian tal cual, con sus _id
 * originales: las referencias entre documentos siguen valiendo.
 *
 * Los centros de costo NO entran acá: ya se fusionaron aparte, con
 * `npm run fusionar-cc`, porque eran el mismo padrón cargado dos veces.
 *
 * Queda afuera también:
 *   - `users` (4 docs): datos de prueba del primer día, con roles que ya no
 *     existen (aprobador, almacen). El modelo Usuario apunta a `usuarios`.
 *   - `ordencompras`, `pedidocompras`, `repuestos`: vacías.
 *
 * No borra nada de Compras: la base original queda intacta como respaldo.
 * Es idempotente: no copia lo que ya está (compara por _id).
 *
 * Uso: npm run migrar-compras [--dry-run]
 */
import mongoose from "mongoose";

const SIMULACRO = process.argv.includes("--dry-run");

// Las que se traen. El resto de la base de Compras queda afuera a propósito.
const COLECCIONES = [
  "berdinapedidos",
  "sanpablopedidos",
  "ocs",
  "proveedors",
  "usuarios",
];

const uriTablero = process.env.MONGODB;
if (!uriTablero?.includes("dbTableroControl")) {
  console.error("El MONGODB de este .env no apunta a dbTableroControl. Aborto.");
  process.exit(1);
}
const uriCompras = uriTablero.replace("dbTableroControl", "dbComprasLaMartina");

const tablero = await mongoose.createConnection(uriTablero).asPromise();
const compras = await mongoose.createConnection(uriCompras).asPromise();
console.log(`Conectado${SIMULACRO ? " (SIMULACRO: no escribe nada)" : ""}\n`);

console.log("coleccion            origen   ya estaban   a copiar");
console.log("-".repeat(56));

let totalCopiados = 0;
for (const nombre of COLECCIONES) {
  const origen = await compras.db.collection(nombre).find().toArray();
  const destino = tablero.db.collection(nombre);

  const existentes = new Set(
    (await destino.find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id))
  );
  const nuevos = origen.filter((d) => !existentes.has(String(d._id)));

  console.log(
    `${nombre.padEnd(20)} ${String(origen.length).padStart(6)} ${String(existentes.size).padStart(12)} ${String(nuevos.length).padStart(10)}`
  );

  if (!SIMULACRO && nuevos.length) await destino.insertMany(nuevos);
  totalCopiados += nuevos.length;
}

console.log("-".repeat(56));
if (SIMULACRO) {
  console.log(`Simulacro: se habrían copiado ${totalCopiados} documentos.`);
} else {
  console.log(`Copiados: ${totalCopiados} documentos.\n`);
  console.log("Estado final en la base del Tablero:");
  for (const nombre of [...COLECCIONES, "centrocostos"]) {
    console.log(`  ${nombre.padEnd(20)} ${await tablero.db.collection(nombre).countDocuments()}`);
  }
}

await tablero.close();
await compras.close();
