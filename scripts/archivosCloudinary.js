/**
 * Qué archivos hay adentro de las carpetas de una cuenta de Cloudinary.
 *
 *   node --env-file <ruta al .env> scripts/archivosCloudinary.js [carpeta]
 *
 * Sin carpeta lista todo, agrupado por carpeta. Con una carpeta, solo esa.
 * **No borra nada**: es una lectura.
 *
 * De cada archivo muestra el nombre, el peso y cuándo se subió. Para *ver* las
 * imágenes en sí conviene la Media Library de la consola web, que trae las
 * miniaturas; esto sirve para tener la lista completa de una.
 */
const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_CLOUD_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_CLOUD_API_SECRET;

if (!cloud || !key || !secret) {
  console.log("✗ Faltan las credenciales de Cloudinary en el entorno.");
  process.exit(1);
}

const soloCarpeta = process.argv[2];
// Cuántos archivos se muestran de cada carpeta antes de resumir: la idea es ver
// qué hay, no leer 90 líneas.
const A_MOSTRAR = 12;

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

const peso = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR") : "—");

/** La carpeta de un archivo: lo que hay antes de la última barra. */
const carpetaDe = (publicId) => {
  const i = publicId.lastIndexOf("/");
  return i === -1 ? "(raíz)" : publicId.slice(0, i);
};

try {
  const expresion = soloCarpeta ? `folder:${soloCarpeta}/*` : "";
  const archivos = await buscar(expresion);

  console.log(`\n── Cuenta: ${cloud}${soloCarpeta ? ` · carpeta ${soloCarpeta}` : ""} ──`);
  console.log(`${archivos.length} archivos\n`);

  const porCarpeta = new Map();
  for (const a of archivos) {
    const c = carpetaDe(a.public_id);
    if (!porCarpeta.has(c)) porCarpeta.set(c, []);
    porCarpeta.get(c).push(a);
  }

  for (const [carpeta, lista] of [...porCarpeta].sort()) {
    const total = lista.reduce((s, a) => s + (a.bytes || 0), 0);
    console.log(`── ${carpeta} — ${lista.length} archivos, ${peso(total)}`);
    lista
      .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
      .slice(0, A_MOSTRAR)
      .forEach((a) => {
        const nombre = a.public_id.split("/").pop();
        console.log(
          `   ${nombre}.${a.format || "?"}  ${peso(a.bytes || 0)}  ${fecha(a.created_at)}  [${a.resource_type}]`
        );
      });
    if (lista.length > A_MOSTRAR) console.log(`   … y ${lista.length - A_MOSTRAR} más`);
    console.log("");
  }

  console.log("Nada de esto se modificó: es solo una lectura.\n");
} catch (error) {
  console.log(`\n✗ ${error.message}\n`);
  process.exit(1);
}
