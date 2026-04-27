import mongoose from "mongoose";
import Camioneta from "./src/models/Camioneta.js";

const datos = [
  { marca: "Hilux gris",              patente: "HPU482",   responsable: "Mario Bustos" },
  { marca: "Hilux blanca",            patente: "NMJ427",   responsable: "Carlos Chumiento" },
  { marca: "Hilux azul",              patente: "HWW084",   responsable: "Elio Rojas" },
  { marca: "Amarok blanca c/s",       patente: "AA225RH",  responsable: "Humberto", observaciones: "Responsable a confirmar" },
  { marca: "Amarok gris c/d",         patente: "AA225RN",  responsable: "German Diaz", observaciones: "Responsable a confirmar" },
  { marca: "Renault Alaskan blanca",  patente: "AE822BQ",  responsable: "Alejandro Brandan" },
  { marca: "Amarok blanca c/d",       patente: "AG224AR",  responsable: "Jorge Rosas" },
  { marca: "Ford Ranger blanca c/d",  patente: "AE233IV",  responsable: "Sin asignar" },
  { marca: "VW Saveiro",              patente: "MTS000",   responsable: "Martin Fernandez", observaciones: "Patente incompleta" },
  { marca: "VW Saveiro",              patente: "AH332A",   responsable: "Nicolas Galvan", observaciones: "Patente incompleta AH332.." },
  { marca: "VW Saveiro",              patente: "AH332B",   responsable: "Gustavo Mana", observaciones: "Patente incompleta AH332.." },
  { marca: "Fiat Strada blanca",      patente: "OQQ126",   responsable: "Posleman" },
  { marca: "VW Saveiro nueva",        patente: "PENDIENTE",responsable: "Paredes", observaciones: "CTV Norte - unidad aún no llegó" },
];

await mongoose.connect(process.env.MONGODB);
console.log("Conectado a MongoDB".green);

let insertadas = 0;
let omitidas = 0;

for (const d of datos) {
  const existe = await Camioneta.findOne({ patente: d.patente });
  if (existe) {
    console.log(`  Omitida (ya existe): ${d.patente}`);
    omitidas++;
  } else {
    await Camioneta.create(d);
    console.log(`  ✓ ${d.marca} — ${d.patente}`);
    insertadas++;
  }
}

console.log(`\nListo: ${insertadas} insertadas, ${omitidas} omitidas.`);
await mongoose.disconnect();
