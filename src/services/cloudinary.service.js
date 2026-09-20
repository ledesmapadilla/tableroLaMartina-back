import crypto from "node:crypto";

/**
 * Los adjuntos de Compras viven en Cloudinary (19/09/2026).
 *
 * El archivo **no pasa por el back**: el navegador lo sube directo a Cloudinary
 * con una firma que pide acá. Es así por el backend en Vercel, donde el cuerpo
 * de un pedido no puede pasar de unos 4,5 MB: la foto de un presupuesto sacada
 * con el celular ya lo supera. El back solo firma y, cuando se borra, le avisa
 * a Cloudinary.
 *
 * Sin SDK: la firma es un sha1 de los parámetros ordenados más el api_secret, y
 * el borrado, un POST. Son veinte líneas y evitan una dependencia más.
 *
 * Hace falta en el .env (Settings › API Keys de Cloudinary):
 *   CLOUDINARY_CLOUD_NAME=...
 *   CLOUDINARY_API_KEY=...
 *   CLOUDINARY_API_SECRET=...
 *
 * Y en la cuenta gratuita hay que destrabar Settings › Security › "Allow
 * delivery of PDF and ZIP files": si no, el PDF sube pero no se puede abrir.
 */

export const CARPETA = "la-martina/compras";

const config = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
});

export const estaConfigurado = () => {
  const { cloudName, apiKey, apiSecret } = config();
  return Boolean(cloudName && apiKey && apiSecret);
};

/** La firma de Cloudinary: los parámetros ordenados por nombre + el secreto. */
const firmar = (params, apiSecret) => {
  const texto = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${texto}${apiSecret}`).digest("hex");
};

/**
 * Lo que el navegador necesita para subir un archivo. La firma vale un rato y
 * solo para esta carpeta: no se puede usar para escribir en otra.
 */
export const datosDeSubida = () => {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: CARPETA, timestamp };
  return {
    cloudName,
    apiKey,
    timestamp,
    folder: CARPETA,
    signature: firmar(params, apiSecret),
  };
};

/**
 * Borra un archivo de Cloudinary. `tipo` es "image" para fotos y "raw" para los
 * PDF, que es como los guarda la subida.
 */
export const borrarArchivo = async (publicId, tipo = "image") => {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };
  const cuerpo = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature: firmar(params, apiSecret),
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${tipo}/destroy`,
    { method: "POST", body: cuerpo }
  );
  const data = await res.json().catch(() => ({}));
  // "not found" es un borrado que ya estaba hecho: no es un error a reportar.
  if (!res.ok || (data.result !== "ok" && data.result !== "not found")) {
    throw new Error(data.error?.message || "No se pudo borrar el archivo");
  }
  return data;
};
