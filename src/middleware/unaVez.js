import { createHash } from "crypto";
import EnvioReciente, { VENTANA_ENVIO_MS } from "../models/EnvioReciente.js";

// Los POST que no son altas: repetirlos no guarda nada dos veces.
const NO_SON_ALTAS = [/^\/api\/auth\//, /^\/api\/horometros-tractor\/validar$/];

// Cuánto espera un reintento a que termine el envío original.
const ESPERA_MAX_MS = 15 * 1000;
const PASO_MS = 300;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const huellaDe = (req, ruta) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        req.usuario?.usuario || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
        ruta,
        req.body ?? null,
      ])
    )
    .digest("hex");

const responderCopia = (res, envio) =>
  res.status(envio.status).type("application/json").send(envio.cuerpo);

/**
 * Cada alta una sola vez (29/10/2026).
 *
 * Si llega un POST igual a otro (mismo usuario, misma ruta, mismos datos)
 * dentro de VENTANA_ENVIO_MS, es el mismo que se reintentó: un doble clic o
 * la señal que se cortó antes de que llegara la respuesta. No se vuelve a
 * guardar; el reintento recibe la respuesta del original, y si el original
 * todavía se está guardando, la espera.
 *
 * Si el original sale mal se olvida, para que se pueda volver a intentar.
 * Igual que el registro, todo se resuelve antes de mandar la respuesta
 * (en Vercel lo que queda corriendo después se puede perder).
 */
export const unaVez = async (req, res, next) => {
  if (req.method !== "POST") return next();
  const ruta = req.originalUrl.split("?")[0];
  if (NO_SON_ALTAS.some((re) => re.test(ruta))) return next();

  const _id = huellaDe(req, ruta);
  const ahora = new Date();
  try {
    // Uno vencido (el índice TTL tarda en borrarlo) se pisa como si no estuviera.
    const pisado = await EnvioReciente.updateOne(
      { _id, fecha: { $lt: new Date(ahora - VENTANA_ENVIO_MS) } },
      { $set: { fecha: ahora, estado: "enCurso" }, $unset: { status: "", cuerpo: "" } }
    );
    if (!pisado.matchedCount) await EnvioReciente.create({ _id, fecha: ahora, estado: "enCurso" });
  } catch (error) {
    if (error?.code !== 11000) {
      // Si la base de esto falla, el alta sigue como siempre.
      console.error("No se pudo revisar el envío repetido:", error.message);
      return next();
    }
    // Ya hay uno igual: es un reintento.
    const hasta = Date.now() + ESPERA_MAX_MS;
    while (Date.now() < hasta) {
      const envio = await EnvioReciente.findById(_id).lean();
      if (!envio) return next(); // el original salió mal: este va de nuevo
      if (envio.estado === "listo") return responderCopia(res, envio);
      await dormir(PASO_MS);
    }
    return res.status(409).json({ error: "Ese envío ya se está guardando. Revisá en un momento si quedó." });
  }

  const enviar = res.send.bind(res);
  let anotado = false;
  res.send = (cuerpo) => {
    if (anotado) return enviar(cuerpo);
    anotado = true;
    const guardar =
      res.statusCode < 400
        ? EnvioReciente.updateOne(
            { _id },
            {
              $set: {
                estado: "listo",
                status: res.statusCode,
                cuerpo: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo ?? null),
              },
            }
          )
        : EnvioReciente.deleteOne({ _id });
    guardar
      .catch((error) => console.error("No se pudo anotar el envío:", error.message))
      .finally(() => enviar(cuerpo));
    return res;
  };
  next();
};
