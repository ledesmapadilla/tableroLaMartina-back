import { datosDeSubida, borrarArchivo, estaConfigurado } from "../services/cloudinary.service.js";

const SIN_CONFIG = {
  error:
    "Los adjuntos no están configurados: faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el .env",
};

/**
 * GET /api/archivos/firma
 *
 * Lo que el navegador necesita para subir el archivo directo a Cloudinary. El
 * secreto nunca sale de acá: lo que viaja es una firma que sirve un rato y solo
 * para la carpeta de Compras.
 */
export const firmaDeSubida = (req, res) => {
  if (!estaConfigurado()) return res.status(503).json(SIN_CONFIG);
  try {
    res.json(datosDeSubida());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/archivos/:tipo/:publicId
 *
 * Borra el archivo de Cloudinary. Quitar el adjunto del ítem es aparte: eso lo
 * hace la pantalla con el PUT del ítem, que es el que controla los permisos del
 * pedido.
 */
export const borrar = async (req, res) => {
  if (!estaConfigurado()) return res.status(503).json(SIN_CONFIG);
  const { tipo } = req.params;
  if (tipo !== "image" && tipo !== "raw") {
    return res.status(400).json({ error: "Tipo de archivo inválido." });
  }
  try {
    // El public_id lleva la carpeta adentro ("la-martina/compras/abc"), así que
    // viaja codificado en la URL.
    await borrarArchivo(decodeURIComponent(req.params.publicId), tipo);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
