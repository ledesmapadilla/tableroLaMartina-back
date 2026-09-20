/**
 * Prueba el circuito completo de un adjunto, sin navegador:
 *
 *   npm run probar-adjunto
 *
 * 1. Pide la firma como lo hace el back.
 * 2. Sube un PDF de prueba a Cloudinary, igual que lo haría el navegador.
 * 3. Abre la URL del PDF: si da 401, falta tildar "Allow delivery of PDF and
 *    ZIP files" en Settings › Security.
 * 4. Lo borra, para no dejar basura en la cuenta.
 *
 * Es la forma de saber que los adjuntos de Compras van a andar antes de
 * probarlos a mano en la pantalla.
 */
import { datosDeSubida, borrarArchivo, estaConfigurado } from "../src/services/cloudinary.service.js";

if (!estaConfigurado()) {
  console.log("✗ Faltan las variables CLOUDINARY_* en el .env");
  process.exit(1);
}

// Un PDF mínimo pero válido, armado acá para no depender de ningún archivo.
const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;

const paso = (n, texto) => console.log(`${n}. ${texto}`);

try {
  paso(1, "Pidiendo la firma…");
  const firma = datosDeSubida();
  console.log(`   cuenta ${firma.cloudName}, carpeta ${firma.folder}`);

  paso(2, "Subiendo un PDF de prueba…");
  const datos = new FormData();
  datos.append("file", new Blob([PDF], { type: "application/pdf" }), "prueba-adjunto.pdf");
  datos.append("api_key", firma.apiKey);
  datos.append("timestamp", String(firma.timestamp));
  datos.append("signature", firma.signature);
  datos.append("folder", firma.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${firma.cloudName}/auto/upload`, {
    method: "POST",
    body: datos,
  });
  const subido = await res.json().catch(() => ({}));
  if (!res.ok || !subido.secure_url) {
    console.log(`   ✗ No subió: ${subido.error?.message || res.status}`);
    process.exit(1);
  }
  const tipo = subido.resource_type === "image" ? "image" : "raw";
  console.log(`   ✓ Subido como ${tipo}`);
  console.log(`   ${subido.secure_url}`);

  paso(3, "Abriendo la URL, como haría el usuario…");
  const abierto = await fetch(subido.secure_url);
  if (abierto.ok) {
    console.log(`   ✓ Se abre (HTTP ${abierto.status}, ${abierto.headers.get("content-type")})`);
  } else if (abierto.status === 401) {
    console.log("   ✗ HTTP 401: falta tildar Settings › Security ›");
    console.log('     "Allow delivery of PDF and ZIP files" (y guardar).');
  } else {
    console.log(`   ✗ HTTP ${abierto.status}`);
  }

  paso(4, "Borrando el archivo de prueba…");
  await borrarArchivo(subido.public_id, tipo);
  console.log("   ✓ Borrado: la cuenta queda como estaba");

  console.log(abierto.ok ? "\n✓ El circuito de adjuntos funciona.\n" : "\n✗ Sube pero no se puede abrir.\n");
  process.exit(abierto.ok ? 0 : 1);
} catch (error) {
  console.log(`\n✗ ${error.message}\n`);
  process.exit(1);
}
