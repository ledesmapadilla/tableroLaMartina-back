import RegistroCambio from "../models/RegistroCambio.js";
import { contexto, aTexto } from "../services/historial.js";

const ACCION = { POST: "alta", PUT: "cambio", PATCH: "cambio", DELETE: "baja" };
const OCULTO = /password|contrase|token|secret/i;
const MAX_TEXTO = 500;
const MAX_LISTA = 100;

// Lo que mandó el usuario, sin contraseñas y recortado: un texto largo o una
// lista enorme no le sirven a nadie en el registro.
const limpiar = (valor, nivel = 0) => {
  if (valor === null || typeof valor !== "object") {
    return typeof valor === "string" && valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO)}…` : valor;
  }
  if (nivel > 5) return "…";
  if (Array.isArray(valor)) return valor.slice(0, MAX_LISTA).map((v) => limpiar(v, nivel + 1));
  return Object.fromEntries(
    Object.entries(valor).map(([k, v]) => [k, OCULTO.test(k) ? "•••" : limpiar(v, nivel + 1)])
  );
};

const respuestaDe = (cuerpo) => {
  try {
    return (typeof cuerpo === "string" ? JSON.parse(cuerpo) : cuerpo) || {};
  } catch {
    return {};
  }
};

const errorDe = (cuerpo) => {
  const datos = respuestaDe(cuerpo);
  return String(datos.error || datos.message || "");
};

/**
 * El registro de cambios (25/10/2026): quién hizo qué y cuándo.
 *
 * Anota cada alta, cambio o baja que llega a la API, salga bien o mal, y cada
 * intento de entrar (el login, con el usuario que se escribió). Las lecturas
 * no se anotan. Lo que cambia en los partes y en gasoil lleva además el antes
 * y el después (services/historial.js).
 *
 * El renglón se guarda antes de mandar la respuesta: en Vercel lo que queda
 * corriendo después de responder se puede perder. Si guardarlo falla, la
 * respuesta sale igual.
 */
export const registrarCambios = (req, res, next) => {
  const accion = ACCION[req.method];
  if (!accion) return next();

  const registro = { cambios: [] };
  const enviar = res.send.bind(res);
  let anotado = false;
  res.send = (cuerpo) => {
    if (anotado) return enviar(cuerpo);
    anotado = true;
    const ruta = req.originalUrl.split("?")[0];
    const esLogin = ruta.startsWith("/api/auth/login");
    const ok = res.statusCode < 400;
    // En el login todavía no hay sesión: el nombre y el rol salen de la
    // respuesta (el token no se guarda).
    const quien = esLogin ? (ok ? respuestaDe(cuerpo) : {}) : req.usuario || {};
    RegistroCambio.create({
      fecha: new Date(),
      usuario: esLogin ? String(req.body?.usuario || "") : quien.usuario || "",
      nombre: quien.nombre || "",
      rol: quien.rol || "",
      accion: esLogin ? "login" : accion,
      metodo: req.method,
      seccion: ruta.replace(/^\/api\/?/, "").split("/")[0],
      ruta,
      estado: res.statusCode,
      ok,
      error: ok ? "" : errorDe(cuerpo),
      datos: esLogin || !req.body || !Object.keys(req.body).length ? null : aTexto(limpiar(req.body)),
      cambios: registro.cambios,
      ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim(),
    })
      .catch((error) => console.error("No se pudo anotar en el registro de cambios:", error.message))
      .finally(() => enviar(cuerpo));
    return res;
  };
  contexto.run(registro, next);
};
