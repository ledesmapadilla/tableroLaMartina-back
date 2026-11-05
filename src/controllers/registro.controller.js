import RegistroCambio from "../models/RegistroCambio.js";

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILAS = 2000;

// El día en hora argentina (UTC−3): "AAAA-MM-DD" → el instante en que empieza.
const inicioDia = (d) => new Date(`${d}T00:00:00-03:00`);

/**
 * El registro de cambios entre dos días (25/10/2026), lo más nuevo primero.
 * Sin lo que se mandó ni el antes y después: eso lo trae el detalle de cada
 * renglón. Los demás filtros (usuario, sección, acción) los hace la pantalla.
 */
export const getAll = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!DIA.test(desde || "") || !DIA.test(hasta || "")) {
      return res.status(400).json({ error: "Faltan las fechas (desde y hasta)" });
    }
    const fin = inicioDia(hasta);
    fin.setUTCDate(fin.getUTCDate() + 1);
    const filas = await RegistroCambio.find({ fecha: { $gte: inicioDia(desde), $lt: fin } })
      .sort({ fecha: -1 })
      .limit(MAX_FILAS + 1)
      .select("-datos -cambios.doc -cambios.campos.antes -cambios.campos.despues")
      .lean();
    res.json({ filas: filas.slice(0, MAX_FILAS), recortado: filas.length > MAX_FILAS });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUno = async (req, res) => {
  try {
    const fila = await RegistroCambio.findById(req.params.id).lean();
    if (!fila) return res.status(404).json({ error: "No está en el registro" });
    res.json(fila);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Una pantalla que abrió el usuario (05/11/2026). La manda el front cada vez
 * que cambia de pantalla; el middleware del registro no la anota como alta.
 * Si no se puede guardar, no pasa nada: es solo para saber qué mira cada uno.
 */
export const registrarVista = async (req, res) => {
  try {
    const ruta = String(req.body?.ruta || "").slice(0, 300);
    if (!ruta.startsWith("/")) return res.status(400).json({ error: "Falta la pantalla" });
    const quien = req.usuario || {};
    await RegistroCambio.create({
      fecha: new Date(),
      usuario: quien.usuario || "",
      nombre: quien.nombre || "",
      rol: quien.rol || "",
      accion: "vista",
      metodo: "GET",
      seccion: ruta.split("/")[1] || "",
      ruta,
      pantalla: String(req.body?.pantalla || "").slice(0, 200),
      estado: 200,
      ok: true,
      ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim(),
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Qué hizo cada usuario entre dos días (05/11/2026): cuántas veces entró,
 * cuántas pantallas abrió, cuánto cargó, editó y borró, lo que no se guardó
 * y en qué secciones anduvo. Se cuenta en la base: no tiene el tope de 2000
 * renglones de la lista.
 */
export const getResumen = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!DIA.test(desde || "") || !DIA.test(hasta || "")) {
      return res.status(400).json({ error: "Faltan las fechas (desde y hasta)" });
    }
    const fin = inicioDia(hasta);
    fin.setUTCDate(fin.getUTCDate() + 1);
    const filtro = { fecha: { $gte: inicioDia(desde), $lt: fin } };

    const [porAccion, porSeccion] = await Promise.all([
      RegistroCambio.aggregate([
        { $match: filtro },
        {
          $group: {
            _id: { usuario: "$usuario", accion: "$accion", ok: "$ok" },
            n: { $sum: 1 },
            nombre: { $max: "$nombre" },
            rol: { $max: "$rol" },
            ultima: { $max: "$fecha" },
          },
        },
      ]),
      RegistroCambio.aggregate([
        { $match: { ...filtro, accion: { $in: ["alta", "cambio", "baja"] }, ok: true } },
        { $group: { _id: { usuario: "$usuario", seccion: "$seccion" }, n: { $sum: 1 } } },
      ]),
    ]);

    const usuarios = new Map();
    const de = (usuario) => {
      if (!usuarios.has(usuario)) {
        usuarios.set(usuario, {
          usuario,
          nombre: "",
          rol: "",
          entradas: 0,
          entradasFallidas: 0,
          vistas: 0,
          altas: 0,
          cambios: 0,
          bajas: 0,
          errores: 0,
          ultima: null,
          secciones: [],
        });
      }
      return usuarios.get(usuario);
    };
    for (const g of porAccion) {
      const u = de(g._id.usuario);
      if (g.nombre) u.nombre = g.nombre;
      if (g.rol) u.rol = g.rol;
      if (!u.ultima || g.ultima > u.ultima) u.ultima = g.ultima;
      const { accion, ok } = g._id;
      if (accion === "login") ok ? (u.entradas += g.n) : (u.entradasFallidas += g.n);
      else if (accion === "vista") u.vistas += g.n;
      else if (!ok) u.errores += g.n;
      else if (accion === "alta") u.altas += g.n;
      else if (accion === "cambio") u.cambios += g.n;
      else if (accion === "baja") u.bajas += g.n;
    }
    for (const g of porSeccion) de(g._id.usuario).secciones.push({ seccion: g._id.seccion, n: g.n });
    for (const u of usuarios.values()) u.secciones.sort((a, b) => b.n - a.n);

    res.json([...usuarios.values()].sort((a, b) => (b.ultima || 0) - (a.ultima || 0)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
