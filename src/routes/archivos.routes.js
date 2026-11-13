import { Router } from "express";
import { firmaDeSubida, borrar } from "../controllers/archivos.controller.js";
import { escribirSi, exigirEditar } from "../middleware/permisos.js";
import { PUEDEN_ADJUNTAR } from "../controllers/archivoPedido.js";

const router = Router();

/**
 * Los adjuntos de un pedido de Compras: el presupuesto que sube el analista y
 * lo que suma el taller al pedir.
 *
 * Adjuntar es escribir, así que pide "Editar" en alguna de las dos pantallas
 * que pueden hacerlo. La firma es un GET pero se trata como escritura: con ella
 * se sube un archivo.
 */
// La misma lista que el adjunto del pedido entero (controllers/archivoPedido.js).

// Caja (13/11/2026) también sube fotos y archivos de los gastos.
const ADJUNTAN = [...PUEDEN_ADJUNTAR, "contable.caja"];
router.get("/firma", exigirEditar(ADJUNTAN), firmaDeSubida);
router.delete("/:tipo/:publicId", escribirSi(ADJUNTAN), borrar);

export default router;
