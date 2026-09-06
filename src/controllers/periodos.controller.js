import PeriodoCertificado from "../models/PeriodoCertificado.js";

const UN_DIA = 24 * 60 * 60 * 1000;

// Corte por defecto mientras nadie lo haya definido: del 26 del mes anterior
// al 25 de este. Es el que usaba la planilla de abril 2026, pero cambia mes a
// mes, así que se puede editar y queda guardado.
const porDefecto = (anio, mes) => ({
  desde: new Date(Date.UTC(mes === 1 ? anio - 1 : anio, mes === 1 ? 11 : mes - 2, 26)),
  hasta: new Date(Date.UTC(anio, mes - 1, 25)),
});

// La certificación de un mes arranca el día siguiente al cierre del anterior:
// entre dos períodos no queda ningún día suelto ni ningún día repetido.
const diaSiguiente = (fecha) => new Date(new Date(fecha).getTime() + UN_DIA);

const mesAnterior = (anio, mes) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });
const mesSiguiente = (anio, mes) => (mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 });

// El corte sugerido de un mes que todavía no se guardó. El "desde" sale del
// cierre del mes anterior; mientras ese mes siga abierto su "hasta" acompaña al
// día de hoy y no es un corte real, así que se cae al 26 por defecto.
const sugerido = (anio, mes, anterior) => {
  const base = porDefecto(anio, mes);
  if (!anterior?.cerrado || !anterior?.hasta) return base;
  return { desde: diaSiguiente(anterior.hasta), hasta: base.hasta };
};

// Cerrar un mes corre el arranque del siguiente. Solo se toca si el que sigue
// está abierto: un certificado cerrado no se mueve solo.
const correrArranqueDelSiguiente = async (periodo) => {
  if (!periodo?.cerrado) return;

  const { anio, mes } = mesSiguiente(periodo.anio, periodo.mes);
  const siguiente = await PeriodoCertificado.findOne({ anio, mes });
  if (!siguiente || siguiente.cerrado) return;

  const desde = diaSiguiente(periodo.hasta);
  if (siguiente.desde?.getTime() === desde.getTime()) return;
  // El "hasta" del siguiente se respeta salvo que el nuevo arranque lo pase
  // por delante, que solo puede pasar con un corte cargado mal.
  if (siguiente.hasta < desde) siguiente.hasta = desde;
  siguiente.desde = desde;
  await siguiente.save();
};

export const getPeriodo = async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    if (!anio || !mes || mes < 1 || mes > 12) {
      return res.status(400).json({ error: "Año o mes inválido" });
    }

    const guardado = await PeriodoCertificado.findOne({ anio, mes });
    if (guardado) return res.json(guardado);

    // No se crea nada todavía: se devuelve el corte sugerido, que arranca donde
    // terminó el mes anterior.
    const previo = mesAnterior(anio, mes);
    const anterior = await PeriodoCertificado.findOne(previo).lean();
    res.json({
      anio,
      mes,
      ...sugerido(anio, mes, anterior),
      cerrado: false,
      fechaCierre: null,
      guardado: false,
    });
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
    // Enero arranca donde cerró diciembre del año anterior, así que ese mes
    // también entra en la consulta.
    const diciembrePrevio = await PeriodoCertificado.findOne({ anio: anio - 1, mes: 12 }).lean();

    // Los meses se recorren en orden porque cada uno mira el cierre del que
    // tiene atrás.
    let anterior = diciembrePrevio;
    const periodos = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const guardado = porMes.get(mes);
      const periodo = guardado
        ? { ...guardado, guardado: true }
        : {
            anio,
            mes,
            ...sugerido(anio, mes, anterior),
            cerrado: false,
            fechaCierre: null,
            guardado: false,
          };
      anterior = periodo;
      return periodo;
    });

    res.json(periodos);
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

    // Al cerrar un mes, el siguiente tiene que arrancar al día siguiente. No
    // debe voltear el guardado: el período de este mes ya quedó bien.
    await correrArranqueDelSiguiente(periodo).catch((e) =>
      console.error("No se pudo correr el arranque del mes siguiente:", e.message)
    );

    res.json(periodo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
