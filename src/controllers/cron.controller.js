import Camioneta from "../models/Camioneta.js";
import Service from "../models/Service.js";
import Kilometro from "../models/Kilometro.js";

const INTERVAL_KM = 10000;

const sendWhatsApp = async (phone, text) => {
  try {
    const instance = process.env.ULTRAMSG_INSTANCE;
    const token    = process.env.ULTRAMSG_TOKEN;
    if (!instance || !token) return;
    await fetch(`https://api.ultramsg.com/${instance}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, to: phone, body: text }),
    });
  } catch (e) {
    console.error("Error enviando WhatsApp a", phone, e.message);
  }
};

export const checkServices = async (req, res) => {
  const auth   = req.headers["authorization"] ?? "";
  const secret = auth.replace("Bearer ", "").trim();
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const camionetas = await Camioneta.find();
    const notificadas = [];
    const yaAlDia    = [];

    // Paralelizar las consultas de base de datos para todas las camionetas
    const results = await Promise.all(camionetas.map(async (cam) => {
      const [latestKm, lastService] = await Promise.all([
        Kilometro.findOne({ camioneta: cam._id }).sort({ anio: -1, mes: -1, createdAt: -1 }),
        Service.findOne({ camioneta: cam._id }).sort({ fecha: -1, createdAt: -1 })
      ]);
      return { cam, latestKm, lastService };
    }));

    for (const { cam, latestKm, lastService } of results) {
      if (!latestKm || !lastService) continue;

      const kmActual  = latestKm.kms;
      const kmService = lastService.kms;
      const atrasado  = kmActual - kmService >= INTERVAL_KM;

      if (!atrasado && cam.serviceNotificado) {
        await Camioneta.findByIdAndUpdate(cam._id, { serviceNotificado: false });
        yaAlDia.push(cam.patente);
        continue;
      }

      if (atrasado && !cam.serviceNotificado) {
        const texto =
          `🚛 *Service vencido*\n` +
          `Camioneta: *${cam.patente}*\n` +
          `Responsable: ${cam.responsable || "—"}\n` +
          `Km actuales: ${kmActual.toLocaleString("es-AR")}\n` +
          `Km último service: ${kmService.toLocaleString("es-AR")}\n` +
          `Diferencia: ${(kmActual - kmService).toLocaleString("es-AR")} km`;

        // Enviar al dueño
        if (process.env.OWNER_PHONE) {
          await sendWhatsApp(process.env.OWNER_PHONE, texto);
        }
        // Enviar al responsable si tiene teléfono cargado
        if (cam.telefono) {
          await sendWhatsApp(cam.telefono, texto);
        }

        await Camioneta.findByIdAndUpdate(cam._id, { serviceNotificado: true });
        notificadas.push(cam.patente);
      }
    }

    res.json({ ok: true, notificadas, yaAlDia });
  } catch (e) {
    console.error("checkServices error:", e);
    res.status(500).json({ error: e.message });
  }
};
