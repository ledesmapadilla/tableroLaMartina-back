import { Router } from "express";
import { firmaDeSubida, borrar } from "../controllers/archivos.controller.js";
import { escribirSi, exigirEditar } from "../middleware/permisos.js";

const router = Router();

/**
 * Los adjuntos de un pedido de Compras: el presupuesto que sube el analista y
 * lo que suma el taller al pedir.
 *
 * Adjuntar es escribir, así que pide "Editar" en alguna de las dos pantallas
 * que pueden hacerlo. La firma es un GET pero se trata como escritura: con ella
 * se sube un archivo.
 */
const PUEDEN_ADJUNTAR = ["compras.pedidos", "compras.analista"];

router.get("/firma", exigirEditar(PUEDEN_ADJUNTAR), firmaDeSubida);
router.delete("/:tipo/:publicId", escribirSi(PUEDEN_ADJUNTAR), borrar);

export default router;
