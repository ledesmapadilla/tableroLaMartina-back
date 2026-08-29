import ParteDiario from "../models/ParteDiario.js";

// "HH:mm" -> minutos desde la medianoche. Devuelve null si no es una hora.
const aMinutos = (hora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

// Único campo que no se carga a mano. Si el egreso es anterior al ingreso el
// turno cruzó la medianoche (22:00 → 06:00 son 8 horas, no -16).
const calcularTotalHoras = (horaIngreso, horaEgreso) => {
  const ingreso = aMinutos(horaIngreso);
  const egreso = aMinutos(horaEgreso);
  if (ingreso === null || egreso === null) return 0;

  const minutos = egreso >= ingreso ? egreso - ingreso : 1440 - ingreso + egreso;
  // Se redondea a 2 decimales: restando horas del reloj nunca hace falta más.
  return Math.round((minutos / 60) * 100) / 100;
};

const armarDatos = (body) => {
  const datos = { ...body };
  datos.totalHoras = calcularTotalHoras(body.horaIngreso, body.horaEgreso);
  // Los numéricos vacíos llegan como "" desde el formulario.
  ["cantidad", "combustible"].forEach((campo) => {
    datos[campo] = body[campo] === "" || body[campo] === undefined || body[campo] === null
      ? null
      : Number(body[campo]);
  });
  ["cc", "tarea"].forEach((campo) => {
    if (!body[campo]) datos[campo] = null;
  });
  return datos;
};

const conRelaciones = (consulta) =>
  consulta
    .populate("persona", "apellidoNombre dni")
    .populate("cc", "cc equipo descripcion")
    .populate("tarea", "tarea unidad empresa");

// Listado del período. Acepta ?desde&hasta (ISO) o ?anio&mes para el mes
// calendario; sin nada devuelve todo.
export const getAll = async (req, res) => {
  try {
    const { desde, hasta, anio, mes } = req.query;
    const filtro = {};

    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = new Date(desde);
      if (hasta) filtro.fecha.$lte = new Date(hasta);
    } else if (anio && mes) {
      filtro.fecha = {
        $gte: new Date(Date.UTC(Number(anio), Number(mes) - 1, 1)),
        $lte: new Date(Date.UTC(Number(anio), Number(mes), 0, 23, 59, 59)),
      };
    }

    const partes = await conRelaciones(ParteDiario.find(filtro)).sort({ fecha: 1, createdAt: 1 });
    res.json(partes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const parte = await conRelaciones(ParteDiario.findById(req.params.id));
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });
    res.json(parte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    if (!req.body.fecha) return res.status(400).json({ error: "La fecha es obligatoria" });
    if (!req.body.persona) return res.status(400).json({ error: "La persona es obligatoria" });

    const parte = new ParteDiario(armarDatos(req.body));
    await parte.save();
    res.status(201).json(await conRelaciones(ParteDiario.findById(parte._id)));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const parte = await ParteDiario.findByIdAndUpdate(req.params.id, armarDatos(req.body), {
      new: true,
      runValidators: true,
    });
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });
    res.json(await conRelaciones(ParteDiario.findById(parte._id)));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const parte = await ParteDiario.findByIdAndDelete(req.params.id);
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });
    res.json({ message: "Parte eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
