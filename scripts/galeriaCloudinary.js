/**
 * Arma una página con todo lo que hay en una carpeta de Cloudinary, para verlo
 * de una sin pelearse con la consola web.
 *
 *   node --env-file <.env> scripts/galeriaCloudinary.js <carpeta> <archivo.html>
 *
 * Por ejemplo:
 *   node --env-file ...\1-cancherosback.env scripts/galeriaCloudinary.js cancheros galeria.html
 *
 * **No borra nada.** Genera un HTML con las miniaturas (las imágenes salen
 * redimensionadas por Cloudinary, así la página abre liviana) y los videos con
 * su reproductor. Cada archivo linkea a su original.
 */
const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_CLOUD_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_CLOUD_API_SECRET;

const carpeta = process.argv[2];
const salida = process.argv[3] || "galeria.html";

if (!cloud || !key || !secret) {
  console.log("✗ Faltan las credenciales de Cloudinary en el entorno.");
  process.exit(1);
}
if (!carpeta) {
  console.log("✗ Falta la carpeta. Ej: node scripts/galeriaCloudinary.js cancheros galeria.html");
  process.exit(1);
}

const fs = await import("node:fs");
const auth = Buffer.from(`${key}:${secret}`).toString("base64");

const buscar = async (expresion) => {
  const encontrados = [];
  let cursor = null;
  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${cloud}/resources/search`);
    url.searchParams.set("expression", expresion);
    url.searchParams.set("max_results", "100");
    if (cursor) url.searchParams.set("next_cursor", cursor);
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    encontrados.push(...(data.resources || []));
    cursor = data.next_cursor;
  } while (cursor);
  return encontrados;
};

const original = (a) =>
  `https://res.cloudinary.com/${cloud}/${a.resource_type}/upload/${a.public_id}.${a.format}`;

// c_fill,w_300,h_300 se lo pide a Cloudinary: la página no baja los originales.
const miniatura = (a) =>
  `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_300,h_300,q_auto/${a.public_id}.jpg`;

const peso = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

try {
  const archivos = await buscar(`folder:${carpeta}/*`);
  console.log(`${archivos.length} archivos en ${carpeta} (cuenta ${cloud})`);

  const tarjetas = archivos
    .map((a) => {
      const nombre = a.public_id.split("/").pop();
      const medio =
        a.resource_type === "video"
          ? `<video src="${original(a)}" controls preload="metadata"></video>`
          : `<img src="${miniatura(a)}" alt="${nombre}" loading="lazy">`;
      return `  <figure>
    <a href="${original(a)}" target="_blank" rel="noreferrer">${medio}</a>
    <figcaption>${nombre}.${a.format}<br><small>${peso(a.bytes || 0)} · ${new Date(
        a.created_at
      ).toLocaleDateString("es-AR")} · ${a.resource_type}</small></figcaption>
  </figure>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<title>${carpeta} — ${cloud}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; background: #f8f9fa; color: #1e293b; }
  h1 { font-size: 1.2rem; }
  .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
  figure { margin: 0; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; }
  img, video { width: 100%; height: 190px; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
  figcaption { font-size: 0.74rem; margin-top: 8px; word-break: break-all; color: #475569; }
  small { color: #64748b; }
</style>
<h1>${carpeta} · cuenta ${cloud} · ${archivos.length} archivos</h1>
<p>Cada archivo abre el original en una pestaña nueva.</p>
<div class="grilla">
${tarjetas}
</div>
</html>`;

  fs.writeFileSync(salida, html, "utf8");
  console.log(`Galería escrita en: ${salida}`);
} catch (error) {
  console.log(`✗ ${error.message}`);
  process.exit(1);
}
