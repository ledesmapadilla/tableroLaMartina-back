// Prueba la regla de los dos tramos del día: no se pueden pisar. No toca la
// base: es todo cuenta de horarios.
import { tramosSeSolapan } from "../src/controllers/partes.controller.js";

let fallas = 0;
const caso = (titulo, horarios, esperado) => {
  const [horaIngreso, horaEgreso, horaIngreso2, horaEgreso2] = horarios;
  const obtenido = tramosSeSolapan({ horaIngreso, horaEgreso, horaIngreso2, horaEgreso2 });
  const ok = obtenido === esperado;
  if (!ok) fallas += 1;
  console.log(`${ok ? "OK  " : "MAL "} ${titulo} (${horarios.join(" ")}) -> ${obtenido}`);
};

caso("día normal: mañana y tarde", ["08:00", "12:00", "14:00", "18:00"], false);
caso("pegados: el 2 arranca cuando termina el 1", ["08:00", "12:00", "12:00", "18:00"], false);
caso("se pisan una hora", ["08:00", "12:00", "11:00", "18:00"], true);
caso("el 2 arranca antes que el 1", ["08:00", "12:00", "06:00", "07:00"], true);
caso("el 2 adentro del 1", ["08:00", "18:00", "10:00", "11:00"], true);
caso("mismo horario los dos", ["08:00", "12:00", "08:00", "12:00"], true);
caso("el 1 cruza la medianoche y el 2 sigue después", ["22:00", "02:00", "03:00", "06:00"], false);
caso("el 1 cruza la medianoche y el 2 lo pisa", ["22:00", "02:00", "01:00", "05:00"], true);
caso("el 2 da la vuelta al reloj y pisa al 1", ["08:00", "12:00", "20:00", "09:00"], true);
caso("el 2 llega justo hasta la entrada del 1", ["08:00", "12:00", "20:00", "08:00"], false);
caso("sin salida del 1, pero el 2 lo tapa", ["08:00", "", "07:00", "09:00"], true);
caso("sin salida del 1 y el 2 después", ["08:00", "", "14:00", "18:00"], false);
caso("el 2 arranca antes, sin pisarlo", ["08:00", "12:00", "05:00", "06:00"], true);
caso("sin segundo tramo", ["08:00", "12:00", "", ""], false);
caso("sin nada", ["", "", "", ""], false);
caso("solo salida del 2 cargada", ["08:00", "12:00", "", "18:00"], false);

console.log(fallas ? `\n${fallas} casos fallaron` : "\nTodos los casos pasaron");
process.exit(fallas ? 1 : 0);
