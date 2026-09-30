/**
 * Deja la misma lista de precios en Berdina y en San Pablo (30/09/2026).
 *
 * Del 18/09 al 30/09 el precio fue uno solo para todo Producción y la pantalla
 * mostraba las cargas de los dos campos mezcladas. Al volver a separarlos, los
 * dos arrancan con esa misma lista: a cada campo se le copian las cargas del
 * otro que no tenga.
 *
 * Solo agrega: no borra ni modifica ninguna carga. La copia conserva la fecha
 * de alta (createdAt) del original, así el desempate entre dos cargas con la
 * misma vigencia sale igual que antes y el precio vigente no cambia.
 *
 * Al final compara, tarea por tarea, el vigente de la lista mezclada con el de
 * cada campo.
 *
 * Uso: node --env-file .env scripts/igualarVariablesEntreCampos.js [--aplicar]
 * Sin --aplicar solo muestra lo que haría.
 */
import mongoose from "mongoose";

const APLICAR = process.argv.includes("--aplicar");
const CAMPOS = ["caspinchango", "san-pablo"];

const huella = (v) =>
  [
    String(v.tarea),
    v.vigenciaDesde?.toISOString(),
    v.fecha?.toISOString(),
    v.neto,
    v.netoAlto ?? null,
  ].join("|");

// El mismo orden que usa la pantalla para decidir el vigente.
const ordenar = (lista) =>
  lista
    .slice()
    .sort(
      (a, b) =>
        (b.vigenciaDesde?.getTime() || 0) - (a.vigenciaDesde?.getTime() || 0) ||
        (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0) ||
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );

const vigentes = (lista) => {
  const mapa = new Map();
  for (const v of ordenar(lista)) {
    const t = String(v.tarea);
    if (!mapa.has(t)) mapa.set(t, v);
  }
  return mapa;
};

await mongoose.connect(process.env.MONGODB);
const col = mongoose.connection.db.collection("variabletareas");

const todas = await col.find().toArray();
const antes = vigentes(todas);
console.log(`Cargas hoy: ${todas.length}`);

const nuevos = [];
for (const destino of CAMPOS) {
  const delDestino = todas.filter((v) => v.establecimiento === destino);
  const yaEstan = new Set(delDestino.map(huella));
  for (const v of todas) {
    if (v.establecimiento === destino || yaEstan.has(huella(v))) continue;
    yaEstan.add(huella(v));
    const { _id, ...resto } = v;
    nuevos.push({ ...resto, establecimiento: destino });
  }
  console.log(`A copiar a ${destino}: ${nuevos.filter((n) => n.establecimiento === destino).length}`);
}

// Dos cargas iguales con la misma vigencia en un campo pueden ganarle a la que
// rige hoy (pasó con Herbicida: Berdina tenía 17,65 y San Pablo 14,54, y en la
// lista mezclada rige la de San Pablo, que es la más nueva). A ese campo se le
// copia además la carga que rige hoy, que por ser la más nueva vuelve a ganar.
for (const campo of CAMPOS) {
  const vig = vigentes([...todas, ...nuevos].filter((v) => v.establecimiento === campo));
  for (const [tarea, v] of antes) {
    const w = vig.get(tarea);
    if (w && w.neto === v.neto) continue;
    console.log(`  ${campo}: tarea ${tarea} regiría ${w?.neto ?? "nada"}; se copia la de ${v.neto}`);
    const { _id, ...resto } = v;
    nuevos.push({ ...resto, establecimiento: campo });
  }
}

const despues = [...todas, ...nuevos];
let distintos = 0;
for (const campo of CAMPOS) {
  const vig = vigentes(despues.filter((v) => v.establecimiento === campo));
  for (const [tarea, v] of antes) {
    const w = vig.get(tarea);
    if (!w || w.neto !== v.neto || w.bruto !== v.bruto) {
      distintos++;
      console.log(`  ${campo}: tarea ${tarea} rige ${w?.neto ?? "nada"} en vez de ${v.neto}`);
    }
  }
}
console.log(`Total a copiar: ${nuevos.length}`);
console.log(distintos ? `Vigentes distintos: ${distintos}` : "Los vigentes de los dos campos son los de hoy.");

if (APLICAR && nuevos.length) {
  const r = await col.insertMany(nuevos);
  console.log(`\nInsertadas: ${r.insertedCount}`);
  console.log("Ids nuevos:", Object.values(r.insertedIds).map(String).join(" "));
} else if (!APLICAR) {
  console.log("\nModo prueba: no se tocó nada. Correr con --aplicar para copiar.");
}

await mongoose.disconnect();
