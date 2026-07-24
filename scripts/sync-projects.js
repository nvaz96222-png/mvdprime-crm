/**
 * sync-projects.js
 * Sincroniza proyectos desde Google Drive → Supabase.
 *
 * Uso: npm run sync-projects
 *
 * Variables de entorno requeridas (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL      — URL pública del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key (bypass RLS)
 *   GOOGLE_SERVICE_ACCOUNT_KEY    — JSON completo de la service account (string)
 *
 * Variable opcional:
 *   DRIVE_PROJECTS_FOLDER_ID      — ID de la carpeta PROYECTOS en Drive
 *                                   (si no se define, el script la busca por nombre)
 *
 * Limitaciones conocidas (requieren columna drive_folder_id/drive_file_id para resolver):
 *   - Renombrar una carpeta en Drive crea un proyecto nuevo (no actualiza el existente)
 *   - Renombrar una imagen en galería genera un registro duplicado
 *   - Imágenes eliminadas en Drive no se borran de Supabase (registros huérfanos)
 */

"use strict";

require("dotenv").config({ path: ".env.local" });

const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");

// ─── Validar env ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SA_KEY_RAW = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const FOLDER_ID_ENV = process.env.DRIVE_PROJECTS_FOLDER_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error(
    "❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
  process.exit(1);
}
if (!SA_KEY_RAW) {
  console.error("❌  Falta GOOGLE_SERVICE_ACCOUNT_KEY en .env.local");
  process.exit(1);
}

let serviceAccountKey;
try {
  serviceAccountKey = JSON.parse(SA_KEY_RAW);
} catch {
  console.error(
    "❌  GOOGLE_SERVICE_ACCOUNT_KEY no es JSON válido. Debe ser el contenido completo del archivo de credenciales."
  );
  process.exit(1);
}

// ─── Clientes ────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function mimeIsImage(mimeType) {
  return mimeType && mimeType.startsWith("image/");
}

function mimeIsPdf(mimeType) {
  return mimeType === "application/pdf";
}

/** Lista todos los archivos/carpetas directos dentro de un folder de Drive. */
async function listChildren(folderId, extraQuery = "") {
  const items = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false${extraQuery}`,
      fields: "nextPageToken, files(id, name, mimeType, size)",
      pageSize: 200,
      pageToken: pageToken || undefined,
    });
    items.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return items;
}

/** Descarga un archivo de Drive y devuelve un Buffer. */
async function downloadFile(fileId) {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

/**
 * Sube un buffer a Supabase Storage.
 * Devuelve { path, publicUrl } o lanza error.
 */
async function uploadToStorage(bucket, storagePath, buffer, contentType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload error: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { path: storagePath, publicUrl: data.publicUrl };
}

// ─── Lógica de sincronización por proyecto ───────────────────────────────────

/**
 * Upsert de proyecto en Supabase.
 * - Si existe (por slug): actualiza solo el nombre.
 * - Si no existe: inserta con valores por defecto seguros.
 * Devuelve el id del proyecto.
 */
async function upsertProyecto(nombre, slug) {
  const { data: existing, error: selectErr } = await supabase
    .from("proyectos")
    .select("id, nombre")
    .eq("slug", slug)
    .maybeSingle();

  if (selectErr) throw new Error(`SELECT proyectos: ${selectErr.message}`);

  if (existing) {
    if (existing.nombre !== nombre) {
      const { error: updErr } = await supabase
        .from("proyectos")
        .update({ nombre, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updErr) throw new Error(`UPDATE proyectos: ${updErr.message}`);
      console.log(`    ↻ Nombre actualizado: "${existing.nombre}" → "${nombre}"`);
    } else {
      console.log(`    ✓ Ya existe, sin cambios de nombre`);
    }
    return existing.id;
  }

  // Nuevo proyecto
  const { data: inserted, error: insErr } = await supabase
    .from("proyectos")
    .insert({
      nombre,
      slug,
      tipo: "edificio",
      estado: "en_comercializacion",
      publicar_web: false,
      destacado: false,
    })
    .select("id")
    .single();

  if (insErr) throw new Error(`INSERT proyectos: ${insErr.message}`);
  console.log(`    + Proyecto creado (id: ${inserted.id})`);
  return inserted.id;
}

/**
 * Sincroniza la portada de un proyecto.
 * Criterio: imagen con "portada" en el nombre (case-insensitive).
 *
 * Busca por prefijo de path (slug/portada/%) en lugar de path exacto para
 * detectar cambio de extensión (ej. .jpg → .webp) sin generar duplicados.
 */
async function syncPortada(proyectoId, slug, files) {
  const portadaFile = files.find(
    (f) => mimeIsImage(f.mimeType) && f.name.toLowerCase().includes("portada")
  );

  if (!portadaFile) {
    console.log(`    - Sin portada`);
    return;
  }

  const ext = portadaFile.name.split(".").pop().toLowerCase();
  const storagePath = `${slug}/portada/portada.${ext}`;

  const { data: existingPortada, error: checkErr } = await supabase
    .from("proyecto_fotos")
    .select("id, storage_path, nombre")
    .eq("proyecto_id", proyectoId)
    .like("storage_path", `${slug}/portada/%`)
    .maybeSingle();

  if (checkErr) throw new Error(`SELECT portada: ${checkErr.message}`);

  if (existingPortada) {
    if (existingPortada.storage_path === storagePath) {
      console.log(`    ✓ Portada ya sincronizada`);
      return;
    }
    // Extensión cambió — actualizar registro y re-subir
    console.log(`    ↻ Portada: extensión cambió (${existingPortada.storage_path} → ${storagePath})`);
    const buffer = await downloadFile(portadaFile.id);
    const { publicUrl } = await uploadToStorage(
      "proyectos-fotos",
      storagePath,
      buffer,
      portadaFile.mimeType
    );
    const { error: updErr } = await supabase
      .from("proyecto_fotos")
      .update({ url: publicUrl, storage_path: storagePath, nombre: portadaFile.name })
      .eq("id", existingPortada.id);
    if (updErr) throw new Error(`UPDATE portada: ${updErr.message}`);
    console.log(`    ✓ Portada actualizada`);
    return;
  }

  // Nueva portada
  console.log(`    ↓ Descargando portada: ${portadaFile.name}`);
  const buffer = await downloadFile(portadaFile.id);
  const { publicUrl } = await uploadToStorage(
    "proyectos-fotos",
    storagePath,
    buffer,
    portadaFile.mimeType
  );

  const { data: existingPrincipal } = await supabase
    .from("proyecto_fotos")
    .select("id")
    .eq("proyecto_id", proyectoId)
    .eq("es_principal", true)
    .maybeSingle();

  const { error } = await supabase.from("proyecto_fotos").insert({
    proyecto_id: proyectoId,
    url: publicUrl,
    storage_path: storagePath,
    tipo: "foto",
    es_principal: !existingPrincipal,
    orden: 0,
    nombre: portadaFile.name,
  });

  if (error) throw new Error(`INSERT portada: ${error.message}`);
  console.log(`    ✓ Portada sincronizada`);
}

/**
 * Sincroniza los archivos de la carpeta galeria/ de un proyecto.
 * Tipo: si el nombre contiene "render" → tipo='render', si no → tipo='foto'.
 * Solo agrega imágenes nuevas; no elimina ni actualiza existentes.
 */
async function syncGaleria(proyectoId, slug, folderId) {
  const subfolders = await listChildren(
    folderId,
    " and mimeType = 'application/vnd.google-apps.folder'"
  );
  const galeriaFolder = subfolders.find(
    (f) =>
      f.name.toLowerCase() === "galeria" || f.name.toLowerCase() === "galería"
  );

  if (!galeriaFolder) {
    console.log(`    - Sin carpeta galeria/`);
    return;
  }

  const galeriaFiles = await listChildren(galeriaFolder.id);
  const imagenes = galeriaFiles.filter((f) => mimeIsImage(f.mimeType));

  if (imagenes.length === 0) {
    console.log(`    - galeria/ vacía`);
    return;
  }

  let nuevas = 0;
  let yaExistentes = 0;

  for (let i = 0; i < imagenes.length; i++) {
    const file = imagenes[i];
    const ext = file.name.split(".").pop().toLowerCase();
    const safeName = slugify(file.name.replace(/\.[^.]+$/, ""));
    const storagePath = `${slug}/galeria/${safeName}.${ext}`;

    const { data: existing, error: checkErr } = await supabase
      .from("proyecto_fotos")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (checkErr) throw new Error(`SELECT galeria: ${checkErr.message}`);

    if (existing) {
      yaExistentes++;
      continue;
    }

    const tipo = file.name.toLowerCase().includes("render") ? "render" : "foto";

    console.log(`    ↓ Galería [${i + 1}/${imagenes.length}]: ${file.name}`);
    const buffer = await downloadFile(file.id);
    const { publicUrl } = await uploadToStorage(
      "proyectos-fotos",
      storagePath,
      buffer,
      file.mimeType
    );

    const { error } = await supabase.from("proyecto_fotos").insert({
      proyecto_id: proyectoId,
      url: publicUrl,
      storage_path: storagePath,
      tipo,
      es_principal: false,
      orden: i + 1,
      nombre: file.name,
    });

    if (error) throw new Error(`INSERT galeria foto: ${error.message}`);
    nuevas++;
  }

  console.log(
    `    ✓ Galería: ${nuevas} nuevas, ${yaExistentes} ya existentes (total: ${imagenes.length})`
  );
}

/**
 * Sincroniza el brochure (PDF) de un proyecto.
 * Criterio: PDF con "brochure" en el nombre, o el primer PDF disponible.
 *
 * Detecta brochure actualizado comparando tamano_bytes.
 * Si el PDF en Drive tiene un tamaño distinto al registrado en DB, re-sincroniza.
 */
async function syncBrochure(proyectoId, slug, files) {
  const pdfs = files.filter((f) => mimeIsPdf(f.mimeType));
  if (pdfs.length === 0) {
    console.log(`    - Sin brochure`);
    return;
  }

  const brochureFile =
    pdfs.find((f) => f.name.toLowerCase().includes("brochure")) || pdfs[0];

  const storagePath = `${slug}/documentos/brochure.pdf`;
  const driveSize = brochureFile.size ? parseInt(brochureFile.size, 10) : null;

  const { data: existing, error: checkErr } = await supabase
    .from("proyecto_documentos")
    .select("id, tamano_bytes, nombre")
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (checkErr) throw new Error(`SELECT brochure: ${checkErr.message}`);

  if (existing) {
    const sizeChanged = driveSize !== null && existing.tamano_bytes !== driveSize;
    if (!sizeChanged) {
      console.log(`    ✓ Brochure ya sincronizado (sin cambios)`);
      return;
    }

    console.log(
      `    ↻ Brochure actualizado en Drive (${existing.tamano_bytes ?? "?"}B → ${driveSize}B), re-sincronizando...`
    );
    const buffer = await downloadFile(brochureFile.id);
    const { publicUrl } = await uploadToStorage(
      "proyectos-docs",
      storagePath,
      buffer,
      "application/pdf"
    );
    const { error: updErr } = await supabase
      .from("proyecto_documentos")
      .update({ url: publicUrl, tamano_bytes: driveSize, nombre: brochureFile.name })
      .eq("id", existing.id);
    if (updErr) throw new Error(`UPDATE brochure: ${updErr.message}`);
    console.log(`    ✓ Brochure actualizado`);
    return;
  }

  // Nuevo brochure
  console.log(`    ↓ Descargando brochure: ${brochureFile.name}`);
  const buffer = await downloadFile(brochureFile.id);
  const { publicUrl } = await uploadToStorage(
    "proyectos-docs",
    storagePath,
    buffer,
    "application/pdf"
  );

  const { error } = await supabase.from("proyecto_documentos").insert({
    proyecto_id: proyectoId,
    url: publicUrl,
    storage_path: storagePath,
    tamano_bytes: driveSize,
    nombre: brochureFile.name,
    tipo: "brochure",
  });

  if (error) throw new Error(`INSERT brochure: ${error.message}`);
  console.log(`    ✓ Brochure sincronizado`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  MVDPrime — Sincronización Proyectos (Drive → Supabase)");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Encontrar carpeta PROYECTOS en Drive
  let rootFolderId = FOLDER_ID_ENV;

  if (!rootFolderId) {
    console.log('Buscando carpeta "PROYECTOS" en Drive...');
    const res = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and name = 'PROYECTOS' and trashed = false",
      fields: "files(id, name)",
      pageSize: 10,
    });

    const folders = res.data.files || [];
    if (folders.length === 0) {
      console.error(
        '❌  No se encontró carpeta "PROYECTOS" en Drive.\n' +
          "    Comparte la carpeta con la service account o define DRIVE_PROJECTS_FOLDER_ID en .env.local"
      );
      process.exit(1);
    }
    if (folders.length > 1) {
      console.warn(
        `⚠️  Se encontraron ${folders.length} carpetas con nombre "PROYECTOS". Se usará la primera.`
      );
      folders.forEach((f) => console.warn(`   - ${f.id}: ${f.name}`));
    }

    rootFolderId = folders[0].id;
    console.log(`   ✓ Carpeta encontrada (id: ${rootFolderId})\n`);
  } else {
    console.log(`Usando DRIVE_PROJECTS_FOLDER_ID: ${rootFolderId}\n`);
  }

  // 2. Listar subcarpetas (cada una = un proyecto)
  console.log("Listando proyectos...");
  const projectFolders = await listChildren(
    rootFolderId,
    " and mimeType = 'application/vnd.google-apps.folder'"
  );

  if (projectFolders.length === 0) {
    console.log("   No se encontraron subcarpetas en PROYECTOS. Nada que sincronizar.");
    return;
  }

  console.log(`   ${projectFolders.length} proyecto(s) encontrado(s)\n`);

  // 3. Procesar cada proyecto
  const resultados = { ok: [], error: [] };

  for (const folder of projectFolders) {
    const nombre = folder.name;
    const slug = slugify(nombre);

    console.log(`▸ ${nombre} (slug: ${slug})`);

    try {
      const rootFiles = await listChildren(folder.id);

      const proyectoId = await upsertProyecto(nombre, slug);

      await syncPortada(proyectoId, slug, rootFiles);
      await syncGaleria(proyectoId, slug, folder.id);
      await syncBrochure(proyectoId, slug, rootFiles);

      resultados.ok.push(nombre);
      console.log();
    } catch (err) {
      resultados.error.push({ nombre, error: err.message });
      console.error(`    ✗ ERROR: ${err.message}\n`);
    }
  }

  // 4. Resumen final
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Sincronización completada`);
  console.log(`  ✓ OK:    ${resultados.ok.length}`);
  console.log(`  ✗ Error: ${resultados.error.length}`);

  if (resultados.error.length > 0) {
    console.log("\n  Proyectos con errores:");
    resultados.error.forEach((e) => console.log(`    - ${e.nombre}: ${e.error}`));
  }

  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n❌  Error fatal:", err.message);
  process.exit(1);
});
