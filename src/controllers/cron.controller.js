import Camioneta from "../models/Camioneta.js";
import Service from "../models/Service.js";
import Kilometro from "../models/Kilometro.js";

const INTERVAL_KM = 10000;

const sendWhatsApp = async (phone, apikey, text) => {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apikey}`;
    await fetch(url);
  } catch (e) {
    console.error("Error enviando WhatsApp a", phone, e.message);
  }
};

export const checkServices = async (req, res) => {
  // Vercel envía Authorization: Bearer <CRON_SECRET> en los cron jobs
  const auth = req.headers["authorization"] ?? "";
  const secret = auth.replace("Bearer ", "").trim();
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const camionetas = await Camioneta.find();
    const notificadas = [];
    const yaAlDia = [];

    for (const cam of camionetas) {
      // Último km registrado
      const latestKm = await Kilometro.findOne({ camioneta: cam._id })
        .sort({ anio: -1, mes: -1, createdAt: -1 });
      // Último service registrado
      const lastService = await Service.findOne({ camioneta: cam._id })
        .sort({ fecha: -1, createdAt: -1 });

      if (!latestKm || !lastService) continue;

      const kmActual  = latestKm.kms;
      const kmService = lastService.kms;
      const atrasado  = kmActual - kmService >= INTERVAL_KM;

      if (!atrasado && cam.serviceNotificado) {
        // Se hizo el service — resetear bandera
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
        const ownerPhone = process.env.OWNER_PHONE;
        const ownerKey   = process.env.OWNER_CALLMEBOT_KEY;
        if (ownerPhone && ownerKey) {
          await sendWhatsApp(ownerPhone, ownerKey, texto);
        }

        // Enviar al responsable si tiene CallMeBot configurado
        if (cam.telefono && cam.callmebotApiKey) {
          await sendWhatsApp(cam.telefono, cam.callmebotApiKey, texto);
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
