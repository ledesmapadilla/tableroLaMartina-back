import PeriodoCertificado from "../models/PeriodoCertificado.js";

// Corte por defecto mientras nadie lo haya definido: del 26 del mes anterior
// al 25 de este. Es el que usaba la planilla de abril 2026, pero cambia mes a
// mes, así que se puede editar y queda guardado.
const porDefecto = (anio, mes) => ({
  desde: new Date(Date.UTC(mes === 1 ? anio - 1 : anio, mes === 1 ? 11 : mes - 2, 26)),
  hasta: new Date(Date.UTC(anio, mes - 1, 25)),
});

export const getPeriodo = async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    if (!anio || !mes || mes < 1 || mes > 12) {
      return res.status(400).json({ error: "Año o mes inválido" });
    }

    const guardado = await PeriodoCertificado.findOne({ anio, mes });
    if (guardado) return res.json(guardado);

    // No se crea nada todavía: se devuelve el corte sugerido.
    res.json({ anio, mes, ...porDefecto(anio, mes), cerrado: false, fechaCierre: null, guardado: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Los 12 meses de un año: lo que esté guardado y, para los que nadie tocó
// todavía, el corte sugerido. La grilla de meses lo pide de una vez en lugar
// de hacer doce consultas.
export const getPeriodosDelAnio = async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    if (!anio) return res.status(400).json({ error: "Año inválido" });

    const guardados = await PeriodoCertificado.find({ anio }).lean();
    const porMes = new Map(guardados.map((p) => [p.mes, p]));

    res.json(
      Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const guardado = porMes.get(mes);
        return guardado
          ? { ...guardado, guardado: true }
          : { anio, mes, ...porDefecto(anio, mes), cerrado: false, fechaCierre: null, guardado: false };
      })
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const guardarPeriodo = async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    const { desde, hasta, cerrado, fechaCierre } = req.body;

    if (!desde || !hasta) {
      return res.status(400).json({ error: "Hay que indicar desde y hasta" });
    }
    if (new Date(desde) > new Date(hasta)) {
      return res.status(400).json({ error: "La fecha de inicio no puede ser posterior a la de fin" });
    }

    // cerrado/fechaCierre solo se tocan si vienen en el body; guardar el
    // periodo desde la pantalla no debe reabrir un certificado ya cerrado.
    const cambios = { anio, mes, desde: new Date(desde), hasta: new Date(hasta) };
    if (cerrado !== undefined) {
      cambios.cerrado = Boolean(cerrado);
      cambios.fechaCierre = cerrado && fechaCierre ? new Date(fechaCierre) : null;
    }

    const periodo = await PeriodoCertificado.findOneAndUpdate(
      { anio, mes },
      cambios,
      { new: true, upsert: true, runValidators: true }
    );
    res.json(periodo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
