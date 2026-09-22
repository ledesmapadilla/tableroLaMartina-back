import { MOVIMIENTOS } from "../catalogos/almacen.js";

/**
 * Un rubro del almacén de repuestos (22/09/2026).
 *
 * Todos los rubros se manejan igual: un catálogo de artículos con existencia y
 * las entradas y salidas que la mueven. Lo único que cambia es el modelo, los
 * tipos que ofrece y cómo se llama en pantalla, así que la lógica está una vez
 * sola acá y cada rubro arma su controlador con `crearRubro`.
 *
 * El primero que se hizo así fue Filtros, y Cubiertas y correas salió de este
 * mismo archivo: lo que se arregla acá queda arreglado en los dos.
 */

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// La cantidad de un movimiento: entera y mayor que cero, o null si no sirve.
const cantidadValida = (valor) => {
  const cuantos = Number(valor);
  return Number.isInteger(cuantos) && cuantos > 0 ? cuantos : null;
};

// Cuando el destino es el taller no hay equipo al que imputarlo.
const BERDINA = "Berdina";

/**
 * A dónde va lo que sale.
 *
 * Una entrada no tiene destino: va al depósito y todavía no es de nadie. Una
 * salida a Berdina tampoco lleva CC, porque va al taller y no a un equipo.
 */
const destinoDe = (movimiento, body) => {
  if (movimiento === "Entrada") return { grupo: "", cc: "" };
  const grupo = (body.grupo || "").trim();
  return { grupo, cc: grupo === BERDINA ? "" : body.cc || "" };
};

/**
 * Arma los handlers de un rubro.
 *
 * `textos` son los mensajes que ve el usuario, que son los únicos que hablan de
 * filtros o de cubiertas; todo lo demás sirve igual para cualquier rubro.
 *
 * Cómo se nombra el artículo depende del rubro, y de ahí sale el código:
 *  - Con `TIPOS` y `PREFIJOS`, el alta elige el tipo de una lista y el
 *    correlativo va por tipo (AIR-001, ACE-001…).
 *  - Con `PREFIJO`, el alta escribe la descripción a mano y numera todo el
 *    rubro con ese prefijo (CUB-001, CUB-002…).
 *
 * `campo` es cómo se llama, adentro del movimiento, la referencia al artículo.
 * Los rubros nuevos lo dejan en "articulo"; Filtros lo pisa con "filtro",
 * porque sus movimientos ya están guardados con ese nombre en la base y
 * renombrarlo dejaría huérfano lo que ya se cargó.
 */
export const crearRubro = ({
  Modelo,
  Movimiento,
  Asignacion,
  TIPOS,
  PREFIJOS,
  PREFIJO,
  textos,
  campo = "articulo",
}) => {
  // Con lista de tipos el alta elige; sin ella, escribe la descripción.
  const porTipo = !!TIPOS;

  /**
   * Lo que le falta al alta para poder guardarse, o null si está completa.
   *
   * Es lo único que cambia entre un rubro y otro: el resto de los campos son
   * opcionales en todos, se completan cuando se los averigua.
   */
  const loQueFalta = (body) => {
    if (porTipo) return TIPOS.includes(body.tipo) ? null : textos.tipoInvalido;
    return (body.descripcion || "").trim() ? null : textos.descripcionVacia;
  };
  /**
   * El próximo código interno del tipo: el mayor que haya + 1, en tres dígitos.
   *
   * Se cuenta sobre lo que hay en la base y no sobre un contador aparte: si se
   * borra el último, el número se vuelve a usar, que es lo que espera el taller.
   */
  const siguienteCodigo = async (tipo) => {
    const prefijo = porTipo ? PREFIJOS[tipo] : PREFIJO;
    if (!prefijo) return null;
    const desdePrefijo = new RegExp(`^${prefijo}-\\d+$`);
    const articulos = await Modelo.find({ codigo: desdePrefijo }).select("codigo").lean();
    const ultimo = articulos.reduce((mayor, a) => {
      const numero = parseInt(a.codigo.split("-")[1], 10);
      return Number.isNaN(numero) ? mayor : Math.max(mayor, numero);
    }, 0);
    return `${prefijo}-${String(ultimo + 1).padStart(3, "0")}`;
  };

  // El mismo artículo cargado dos veces: misma marca y mismo código de fábrica.
  // Si alguno de los dos está vacío no se puede afirmar que sea repetido, así
  // que se deja pasar.
  const yaEstaCargado = async (body, ignorarId = null) => {
    const marca = (body.marca || "").trim();
    const codigoFabrica = (body.codigoFabrica || "").trim();
    if (!marca || !codigoFabrica) return false;
    const filtro = {
      marca: new RegExp(`^${escapar(marca)}$`, "i"),
      codigoFabrica: new RegExp(`^${escapar(codigoFabrica)}$`, "i"),
    };
    if (ignorarId) filtro._id = { $ne: ignorarId };
    return !!(await Modelo.findOne(filtro));
  };

  /**
   * Mueve el saldo del artículo y avisa si no alcanza.
   *
   * La condición "hay al menos tanto" va adentro del propio update, así dos
   * movimientos a la vez no pueden dejar la existencia en negativo. Devuelve el
   * artículo ya actualizado, o un texto con el motivo.
   */
  const moverExistencia = async (id, delta) => {
    const condicion = { _id: id };
    if (delta < 0) condicion.existencia = { $gte: -delta };

    const articulo = await Modelo.findOneAndUpdate(
      condicion,
      { $inc: { existencia: delta } },
      { new: true }
    );
    if (articulo) return { articulo };

    const existe = await Modelo.findById(id);
    if (!existe) return { error: textos.noEncontrado, status: 404 };
    return {
      error: `No se pueden sacar ${-delta}: en el depósito hay ${existe.existencia}`,
      status: 400,
    };
  };

  const getAll = async (req, res) => {
    try {
      // Por tipo y después por código, o solo por código cuando no hay tipo:
      // el código ya agrupa lo que se cargó junto.
      const articulos = await Modelo.find().sort(porTipo ? { tipo: 1, codigo: 1 } : { codigo: 1 });
      res.json(articulos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const getById = async (req, res) => {
    try {
      const articulo = await Modelo.findById(req.params.id);
      if (!articulo) return res.status(404).json({ error: textos.noEncontrado });
      res.json(articulo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const create = async (req, res) => {
    try {
      const falta = loQueFalta(req.body);
      if (falta) return res.status(400).json({ error: falta });
      if (await yaEstaCargado(req.body)) return res.status(400).json({ error: textos.repetido });

      // El código lo pone el servidor, nunca el navegador. Si dos personas dan
      // de alta a la vez, el índice único rechaza al segundo y se reintenta con
      // el número que sigue.
      for (let intento = 0; intento < 5; intento++) {
        try {
          const articulo = new Modelo({ ...req.body, codigo: await siguienteCodigo(req.body.tipo) });
          await articulo.save();
          return res.status(201).json(articulo);
        } catch (error) {
          if (error.code !== 11000) throw error;
        }
      }
      res.status(409).json({ error: "No se pudo asignar un código, probá de nuevo" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  const update = async (req, res) => {
    try {
      // El PUT llega con la fila entera, así que se pide lo mismo que en el
      // alta: no se puede dejar sin nombre lo que ya estaba nombrado.
      const falta = loQueFalta(req.body);
      if (falta) return res.status(400).json({ error: falta });
      if (await yaEstaCargado(req.body, req.params.id)) {
        return res.status(400).json({ error: textos.repetido });
      }

      // Ni el código ni a cargo de quién está se editan desde el formulario:
      // se sacan del cuerpo antes de guardar, así un PUT con la fila entera no
      // los pisa. El código lo pone el servidor al crearlo y lo de a cargo, la
      // entrega y la devolución.
      const { codigo, aCargo, ...cambios } = req.body;
      const articulo = await Modelo.findByIdAndUpdate(req.params.id, cambios, {
        new: true,
        runValidators: true,
      });
      if (!articulo) return res.status(404).json({ error: textos.noEncontrado });
      res.json(articulo);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  const remove = async (req, res) => {
    try {
      const articulo = await Modelo.findByIdAndDelete(req.params.id);
      if (!articulo) return res.status(404).json({ error: textos.noEncontrado });
      // Los movimientos de un artículo que ya no está no le sirven a nadie: se
      // van con él.
      await Movimiento.deleteMany({ [campo]: req.params.id });
      res.json({ message: textos.eliminado });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // ── Entradas y salidas ──

  const getMovimientos = async (req, res) => {
    try {
      const movimientos = await Movimiento.find({ [campo]: req.params.id }).sort({
        fecha: -1,
        createdAt: -1,
      });
      res.json(movimientos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const addMovimiento = async (req, res) => {
    try {
      const { movimiento, fecha, cantidad } = req.body;
      if (!MOVIMIENTOS.includes(movimiento)) {
        return res.status(400).json({ error: "El movimiento tiene que ser una entrada o una salida" });
      }
      const cuantos = cantidadValida(cantidad);
      if (!cuantos) {
        return res.status(400).json({ error: "La cantidad tiene que ser un número mayor que cero" });
      }
      if (!fecha) return res.status(400).json({ error: "La fecha es requerida" });

      // El saldo se mueve primero: si no alcanza, no se guarda nada.
      const delta = movimiento === "Entrada" ? cuantos : -cuantos;
      const { articulo, error, status } = await moverExistencia(req.params.id, delta);
      if (!articulo) return res.status(status).json({ error });

      try {
        const registrado = await Movimiento.create({
          [campo]: articulo._id,
          movimiento,
          fecha,
          persona: req.body.persona,
          ...destinoDe(movimiento, req.body),
          cantidad: cuantos,
          observaciones: req.body.observaciones,
        });
        res.status(201).json({ movimiento: registrado, articulo });
      } catch (error) {
        // Si el movimiento no se pudo guardar, el saldo vuelve a donde estaba:
        // una existencia movida sin respaldo no se puede explicar después.
        await Modelo.findByIdAndUpdate(articulo._id, { $inc: { existencia: -delta } });
        throw error;
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  /**
   * Corregir un movimiento ya cargado.
   *
   * El tipo no se cambia: una entrada mal cargada como salida se borra y se
   * carga de nuevo. Lo que sí se corrige es la cantidad, y ahí el saldo se
   * mueve por la diferencia.
   */
  const updateMovimiento = async (req, res) => {
    try {
      const movimiento = await Movimiento.findOne({
        _id: req.params.movId,
        [campo]: req.params.id,
      });
      if (!movimiento) return res.status(404).json({ error: "Movimiento no encontrado" });

      const cuantos = cantidadValida(req.body.cantidad);
      if (!cuantos) {
        return res.status(400).json({ error: "La cantidad tiene que ser un número mayor que cero" });
      }
      if (!req.body.fecha) return res.status(400).json({ error: "La fecha es requerida" });

      // Cuánto cambia el saldo: una entrada que pasa de 4 a 6 suma 2; una salida
      // que pasa de 4 a 6 resta 2.
      const signo = movimiento.movimiento === "Entrada" ? 1 : -1;
      const delta = signo * (cuantos - movimiento.cantidad);

      let articulo;
      if (delta !== 0) {
        const resultado = await moverExistencia(req.params.id, delta);
        if (!resultado.articulo) {
          const cuanto = movimiento.movimiento === "Entrada" ? "devolver" : "sacar";
          return res.status(resultado.status).json({
            error: resultado.error.replace("sacar", cuanto),
          });
        }
        articulo = resultado.articulo;
      } else {
        articulo = await Modelo.findById(req.params.id);
      }

      const destino = destinoDe(movimiento.movimiento, req.body);
      movimiento.fecha = req.body.fecha;
      movimiento.persona = req.body.persona || "";
      movimiento.grupo = destino.grupo;
      movimiento.cc = destino.cc;
      movimiento.cantidad = cuantos;
      movimiento.observaciones = req.body.observaciones || "";
      await movimiento.save();

      res.json({ movimiento, articulo });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  /**
   * Borrar un movimiento: el saldo vuelve para atrás.
   *
   * Borrar una entrada baja la existencia, y si de esos ya se entregaron no se
   * puede: primero hay que corregir las salidas.
   */
  const removeMovimiento = async (req, res) => {
    try {
      const movimiento = await Movimiento.findOne({
        _id: req.params.movId,
        [campo]: req.params.id,
      });
      if (!movimiento) return res.status(404).json({ error: "Movimiento no encontrado" });

      const delta = movimiento.movimiento === "Entrada" ? -movimiento.cantidad : movimiento.cantidad;
      const { articulo, error, status } = await moverExistencia(req.params.id, delta);
      if (!articulo) {
        return res.status(status).json({
          error: error.replace(
            `No se pueden sacar ${movimiento.cantidad}`,
            `No se puede borrar una entrada de ${movimiento.cantidad}`
          ),
        });
      }

      await movimiento.deleteOne();
      res.json({ message: "Movimiento eliminado", articulo });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const handlers = {
    getAll,
    getById,
    create,
    update,
    remove,
    getMovimientos,
    addMovimiento,
    updateMovimiento,
    removeMovimiento,
  };

  // ── A cargo de quién está ──
  //
  // Solo los rubros que se prestan en vez de consumirse, que hoy es
  // Herramientas. Lo de arriba no se entera: la existencia sigue siendo lo que
  // hay cargado y esto dice dónde está.
  if (!Asignacion) return handlers;

  // El préstamo abierto: el que todavía no volvió. Hay uno o ninguno.
  const abiertaDe = (id) => Asignacion.findOne({ articulo: id, "devolucion.fecha": null });

  // Lo que ve la tabla: quién la tiene y desde cuándo, o vacío si está en el
  // almacén. Se copia en el artículo para no ir a buscarlo fila por fila.
  const anotarEnArticulo = (id, asignacion) =>
    Modelo.findByIdAndUpdate(
      id,
      {
        aCargo: asignacion
          ? { persona: asignacion.persona, fecha: asignacion.fecha }
          : { persona: "", fecha: null },
      },
      { new: true }
    );

  handlers.getAsignaciones = async (req, res) => {
    try {
      const asignaciones = await Asignacion.find({ articulo: req.params.id }).sort({
        fecha: -1,
        createdAt: -1,
      });
      res.json(asignaciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Entregarla. No se puede entregar dos veces: primero la tiene que devolver
  // el que la tiene.
  handlers.entregar = async (req, res) => {
    try {
      const articulo = await Modelo.findById(req.params.id);
      if (!articulo) return res.status(404).json({ error: textos.noEncontrado });

      const persona = (req.body.persona || "").trim();
      if (!persona) return res.status(400).json({ error: "Falta a cargo de quién queda" });
      if (!req.body.fecha) return res.status(400).json({ error: "La fecha es requerida" });

      const abierta = await abiertaDe(req.params.id);
      if (abierta) {
        return res.status(400).json({ error: `Ya está a cargo de ${abierta.persona}` });
      }

      const asignacion = await Asignacion.create({
        articulo: articulo._id,
        fecha: req.body.fecha,
        persona,
        observaciones: req.body.observaciones,
      });
      res.status(201).json({ asignacion, articulo: await anotarEnArticulo(articulo._id, asignacion) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  // Devolverla al almacén: se cierra el préstamo abierto.
  handlers.devolver = async (req, res) => {
    try {
      const asignacion = await abiertaDe(req.params.id);
      if (!asignacion) return res.status(400).json({ error: "No está a cargo de nadie" });
      if (!req.body.fecha) return res.status(400).json({ error: "La fecha es requerida" });

      asignacion.devolucion = {
        fecha: req.body.fecha,
        observaciones: req.body.observaciones || "",
      };
      await asignacion.save();
      res.json({ asignacion, articulo: await anotarEnArticulo(req.params.id, null) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  return handlers;
};
