/**
 * El adjunto del pedido entero, no de un ítem (28/09/2026).
 *
 * En un pedido de varios ítems el taller puede subir un archivo que abarca a
 * todos: el presupuesto único, el remito, la foto de todo junto. Se guarda en
 * el pedido y se ve en la fila del pedido (la que va en negrita).
 *
 * Adjuntar pide "Editar" en las mismas pantallas que el adjunto de un ítem
 * (taller y analista); eso lo controla la ruta. Acá solo se guarda o se saca.
 * Borrarlo de Cloudinary lo hace después el navegador, igual que con un ítem:
 * si ese paso falla queda un archivo suelto y no un link roto.
 */
export const PUEDEN_ADJUNTAR = ['compras.pedidos', 'compras.analista']

export const archivoPedido = (Modelo) => async (req, res) => {
  try {
    const { archivo } = req.body

    // null (o nada) lo saca; si no, tiene que ser un adjunto de verdad.
    let update
    if (!archivo) {
      update = { $unset: { archivo: '' } }
    } else {
      if (!archivo.url || !archivo.publicId) {
        return res.status(400).json({ error: 'El adjunto tiene que traer la URL y el public_id.' })
      }
      const { url, nombre, publicId, tipo } = archivo
      update = {
        $set: {
          archivo: { url, nombre, publicId, tipo, subidoPor: req.usuario?.nombre || '', fecha: new Date() },
        },
      }
    }

    const pedido = await Modelo.findByIdAndUpdate(req.params.id, update, {
      returnDocument: 'after',
      runValidators: true,
      projection: { 'items.historial': 0 },
    })
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' })
    res.json(pedido)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}
