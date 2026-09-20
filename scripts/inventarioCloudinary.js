/**
 * Qué hay en una cuenta de Cloudinary: plan, consumo, carpetas y cuántos
 * archivos tiene cada una.
 *
 *   npm run inventario-cloudinary
 *
 * Usa las credenciales del .env. **No borra nada** y no muestra la api key ni
 * el secret: es para mirar antes de decidir.
 *
 * Para revisar una cuenta vieja sin tocar el .env del proyecto:
 *   CLOUDINARY_CLOUD_NAME=xxx CLOUDINARY_API_KEY=yyy CLOUDINARY_API_SECRET=zzz \
 *     node scripts/inventarioCloudinary.js
 */
// Los nombres con CLOUD_ en el medio son los que usó un proyecto viejo
// (CrudFood): se aceptan para poder inventariar esas cuentas sin tocar su .env.
const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_CLOUD_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_CLOUD_API_SECRET;

if (!cloud || !key || !secret) {
  console.log("✗ Faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET.");
  process.exit(1);
}

const auth = Buffer.from(`${key}:${secret}`).toString("base64");

const pedir = async (ruta) => {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${ruta}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `${ruta}: HTTP ${res.status}`);
  return data;
};

const numero = (n) => (n == null ? "—" : Number(n).toLocaleString("es-AR"));
const mb = (bytes) => (bytes == null ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

console.log(`\n── Cuenta: ${cloud} ─────────────────────────────`);

try {
  const uso = await pedir("usage");
  console.log(`Plan: ${uso.plan || "—"}`);
  if (uso.credits) {
    console.log(`Créditos: ${numero(uso.credits.usage)} de ${numero(uso.credits.limit)} usados`);
  }
  console.log(`Archivos guardados: ${numero(uso.resources)}`);
  console.log(`Espacio: ${mb(uso.storage?.usage)}`);
  console.log(`Transferencia del mes: ${mb(uso.bandwidth?.usage)}`);

  // Las carpetas de la raíz, que es como se separa un proyecto de otro.
  const { folders = [] } = await pedir("folders");
  console.log(`\n── Carpetas en la raíz (${folders.length}) ──`);
  if (!folders.length) console.log("  (ninguna: todo está suelto en la raíz)");
  for (const f of folders) console.log(`  ${f.path}`);

  // Cuántos archivos hay de cada tipo. `raw` son los PDF y similares.
  // El conteo sale de la Search API: `resources/<tipo>` devuelve la lista pero
  // no el total, y quedaba en NaN.
  console.log("\n── Archivos por tipo ──");
  for (const tipo of ["image", "video", "raw"]) {
    try {
      const { total_count } = await pedir(
        `resources/search?expression=${encodeURIComponent(`resource_type:${tipo}`)}&max_results=1`
      );
      console.log(`  ${tipo}: ${numero(total_count ?? 0)}`);
    } catch {
      console.log(`  ${tipo}: no se pudo consultar`);
    }
  }

  console.log("\nNada de esto se modificó: es solo una lectura.\n");
} catch (error) {
  console.log(`\n✗ ${error.message}`);
  console.log("Si dice 401, la api key o el secret no son de esta cuenta.\n");
  process.exit(1);
}
