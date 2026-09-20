/**
 * Prueba que las credenciales de Cloudinary estén bien puestas.
 *
 *   npm run probar-cloudinary
 *
 * Hace un ping a la cuenta y avisa qué falta. No muestra la api key ni el
 * secret: solo dice si andan.
 */
const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } =
  process.env;

const faltan = [
  !cloud && "CLOUDINARY_CLOUD_NAME",
  !key && "CLOUDINARY_API_KEY",
  !secret && "CLOUDINARY_API_SECRET",
].filter(Boolean);

if (faltan.length) {
  console.log(`✗ Faltan en el .env: ${faltan.join(", ")}`);
  process.exit(1);
}

console.log(`Cuenta: ${cloud}`);

const auth = Buffer.from(`${key}:${secret}`).toString("base64");

try {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/ping`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    console.log("✗ La api key o el secret no son de esta cuenta (401).");
    process.exit(1);
  }
  if (!res.ok || data.status !== "ok") {
    console.log(`✗ Cloudinary contestó ${res.status}: ${data.error?.message || "sin detalle"}`);
    process.exit(1);
  }

  console.log("✓ Las credenciales andan.");
  console.log("");
  console.log("Falta un paso que no se puede ver desde acá: en Settings > Security");
  console.log('tiene que estar tildado "Allow delivery of PDF and ZIP files".');
  console.log("Sin eso el PDF sube bien pero al abrirlo da error.");
} catch (error) {
  console.log(`✗ No se pudo contactar a Cloudinary: ${error.message}`);
  process.exit(1);
}
