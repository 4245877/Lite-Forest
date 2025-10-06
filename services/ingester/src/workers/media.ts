// services/ingester/src/workers/media.ts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import got from "got";
import { fileTypeFromBuffer } from "file-type";
import { createHash } from "crypto";

import knex from "../db.js";
import { saveObject } from "../storage.js";

// Бэкап-каталог для относительных локальных путей (если источником передают относительные пути)
const MEDIA_BASE_DIR =
  process.env.MEDIA_BASE_DIR ||
  process.env.UPLOADS_DIR || // поддержка «старого» имени переменной из корневого .env
  path.resolve(process.cwd(), "media"); // т.е. services/ingester/media

console.log("[media] MEDIA_BASE_DIR =", MEDIA_BASE_DIR);

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}
function isFileUrl(s: string) {
  return /^file:\/\//i.test(s);
}
// E:\... или C:\... или \\server\share\...
function isWindowsAbsPath(s: string) {
  return /^[a-zA-Z]:[\\/]/.test(s) || /^\\\\/.test(s);
}

function normalizeLocalPath(input: string) {
  let p = String(input).trim().replace(/^"+|"+$/g, "");
  if (path.isAbsolute(p) || isWindowsAbsPath(p)) return p;
  return path.resolve(MEDIA_BASE_DIR, p);
}

function extOf(name: string) {
  const e = path.extname(name || "").toLowerCase();
  return e.startsWith(".") ? e.slice(1) : e;
}

type AssetKind = "image" | "model" | "other";

// Небольшая локальная таблица MIME по расширению (достаточно для наших задач)
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  stl: "model/stl",
  obj: "model/obj",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
};

// Жёсткое определение типа ассета по имени и/или Content-Type
function kindByNameOrMime(name: string, contentType?: string): AssetKind {
  const e = extOf(name);
  const ct = (contentType || "").toLowerCase();

  const IMG_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
  const MODEL_EXT = new Set(["stl", "obj", "glb", "gltf"]);

  if (IMG_EXT.has(e) || ct.startsWith("image/")) return "image";
  if (
    MODEL_EXT.has(e) ||
    ct.includes("stl") ||
    ct.includes("gltf") ||
    ct.includes("glb") ||
    ct.startsWith("model/")
  )
    return "model";
  return "other";
}

function mimeByExt(ext?: string): string | undefined {
  if (!ext) return undefined;
  return EXT_MIME[ext.toLowerCase()];
}

// Унифицированный ридер: возвращает буфер + имя файла + content-type (если есть)
async function readSource(
  raw: string
): Promise<{ buffer: Buffer; name: string; contentType?: string }> {
  if (!raw || !String(raw).trim()) {
    throw new Error("Empty media source");
  }

  const s = String(raw).trim();

  // HTTP/HTTPS
  if (isHttpUrl(s)) {
    const res = await got(s, {
      timeout: { request: 30_000 },
      retry: { limit: 2 },
      responseType: "buffer",
    });
    const url = new URL(s);
    const urlName = decodeURIComponent(url.pathname.split("/").pop() || "file");
    // got в режиме buffer даёт .rawBody и .body (как Buffer)
    const buffer = (res as any).rawBody ?? (res.body as unknown as Buffer);
    const contentType = res.headers["content-type"] as string | undefined;
    return { buffer, name: urlName, contentType };
  }

  // file:// URL
  if (isFileUrl(s)) {
    const p = fileURLToPath(s);
    const buffer = await fs.readFile(p);
    return { buffer, name: path.basename(p) };
  }

  // Локальный путь (в т.ч. Windows E:\..., относительный, и т.д.)
  const p = normalizeLocalPath(s);
  try {
    const buffer = await fs.readFile(p);
    return { buffer, name: path.basename(p) };
  } catch (e: any) {
    e.message = `Cannot read media file: ${p}\nOriginal: ${s}\n` + e.message;
    throw e;
  }
}

// Надёжная привязка ассета к товару: одиночные роли — delete-then-insert в транзакции,
// множественные — ON CONFLICT (product_id, asset_id) DO NOTHING
async function linkAssetToProduct(opts: {
  productId: string;
  assetId: number;
  role: "main_image" | "model_primary" | "gallery" | "model_alt";
  sortOrder?: number;
}) {
  const { productId, assetId, role, sortOrder = 0 } = opts;

  await knex.transaction(async (trx) => {
    if (role === "main_image" || role === "model_primary") {
      await trx("product_assets").where({ product_id: productId, role }).del();
      await trx("product_assets").insert({
        product_id: productId,
        asset_id: assetId,
        role,
        sort_order: sortOrder,
      });
    } else {
      await trx("product_assets")
        .insert({
          product_id: productId,
          asset_id: assetId,
          role,
          sort_order: sortOrder,
        })
        .onConflict(["product_id", "asset_id"])
        .ignore();
    }
  });
}

export async function fetchAndAttachAsset({
  productId,
  role,
  url,
  sku,
}: {
  productId: string;
  role: "main_image" | "gallery" | "model_primary" | "model_alt";
  url: string;
  sku: string;
}) {
  // 1) читаем/скачиваем источник
  const { buffer, name, contentType } = await readSource(url);

  // 2) определяем тип ассета (image | model | other)
  const kind: AssetKind = kindByNameOrMime(name, contentType);

  // 3) жёсткая проверка совместимости роли и типа
  if (role === "main_image" && kind !== "image") {
    console.warn(`[media] skip main_image for ${sku}: not an image (${name})`);
    return; // можно понизить до gallery, если это поведение нужно
  }
  if (role === "model_primary" && kind !== "model") {
    console.warn(`[media] skip model_primary for ${sku}: not a model (${name})`);
    return;
  }
  // Для всех model_* (включая model_alt) тоже не принимаем не-модели
  if (role.startsWith("model") && role !== "model_primary" && kind !== "model") {
    console.warn(`[media] skip ${role} for ${sku}: not a model (${name})`);
    return;
  }

  // 4) определяем MIME для сохранения
  const ft = await fileTypeFromBuffer(buffer); // помогает, если заголовка нет/неверный
  const nameExt = extOf(name);
  const mimeType =
    (contentType && contentType.toLowerCase()) ||
    ft?.mime ||
    mimeByExt(nameExt) ||
    "application/octet-stream";

  // 5) выбор папки хранения по ТИПУ, а не по роли
  const folder = kind === "image" ? "images" : kind === "model" ? "models" : "files";

  // 6) формируем ключ в сторадже и осмысленное расширение
  const ext =
    nameExt ||
    (ft?.ext ?? (kind === "image" ? "jpg" : kind === "model" ? "stl" : "bin"));
  const key = `products/${sku}/${folder}/${Date.now()}.${ext}`;

  // 7) фактическое сохранение (локально/S3 — через абстракцию saveObject)
  const { storageKey /*, publicUrl*/ } = await saveObject(key, buffer, mimeType);

  // storageKey ожидаемо вида: products/<slug>/<folder>/<fileName>
  const parts = storageKey.split("/");
  const slug = parts[1] || sku;
  const fileNameOnly = parts[parts.length - 1];

  // Публичный относительный путь под статикой — только для изображений
  // (картинку товара и витрина читают из /uploads)
  const publicPath =
    kind === "image"
      ? `/uploads/products/${slug}/${folder}/${fileNameOnly}`
      : null;

  // 8) метаданные ассета
  const sha = createHash("sha256").update(buffer).digest();

  const [asset] = await knex("assets")
    .insert({
      kind, // 'image' | 'model' | 'other'
      storage_key: storageKey,
      public_url: publicPath, // null для моделей/прочих
      mime_type: mimeType,
      size_bytes: buffer.length,
      sha256: sha,
    })
    .returning(["id"]);

  // 9) привязываем к продукту (одиночные роли — delete-then-insert)
  await linkAssetToProduct({
    productId,
    assetId: asset.id,
    role,
    sortOrder: 0,
  });

  // 10) обновляем картинку товара только если это main_image И это реально image
  if (role === "main_image" && kind === "image" && publicPath) {
    await knex("products").where({ id: productId }).update({ image_url: publicPath });
  }

  console.log(
    `[media] attached ${sku} ${role} (${kind}) -> ${storageKey}${
      publicPath ? ` (public ${publicPath})` : ""
    }`
  );
}
