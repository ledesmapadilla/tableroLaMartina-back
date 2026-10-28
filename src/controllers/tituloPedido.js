/**
 * El título de un pedido de varios ítems (28/10/2026).
 *
 * Se pone al hacer el pedido o después, desde la fila del pedido (la que va en
 * negrita), y se ve ahí en lugar de "Varios". Lo cambian los mismos que
 * adjuntan al pedido (taller y analista); eso lo controla la ruta. Vacío lo
 * saca.
 */
export const tituloPedido = (Modelo) => async (req, res) => {
  try {
    const titulo = String(req.body.titulo ?? '').trim()
    if (titulo.length > 80) return res.status(400).json({ error: 'El título no puede pasar de 80 letras.' })
    const update = titulo ? { $set: { titulo } } : { $unset: { titulo: '' } }
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
