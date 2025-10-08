// services/ingester/src/workers/media.ts
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import knex from '../db.js';
import type { Job } from 'bullmq';

// env: см. services/ingester/src/env.ts
// PUBLIC_BASE_URL берём прямо из process.env (он есть в services/ingester/.env)
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const MEDIA_BASE_DIR = path.resolve(
  process.env.MEDIA_BASE_DIR ||
  process.env.UPLOADS_DIR ||
  path.resolve(process.cwd(), 'media')
);

// Под статику бэкенда: /uploads → указывает на UPLOADS_DIR (= E:/import)
const UPLOADS_PREFIX = '/uploads';

// Валидные расширения
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const isImage = (p?: string | null) => !!p && IMG_EXT.has(path.extname(String(p)).toLowerCase());

// ────────────────────────────────────────────────────────────────────────────────
// 0) Защита от гонок на уровне схемы: создаём таблицу product_images под advisory lock
//    и уникальный ключ (product_id, url) — чтобы не плодить дубликаты.
export async function ensureProductImagesSchema() {
  await knex.raw('SELECT pg_advisory_lock(711001)');
  try {
    const hasTable = await knex.schema.hasTable('product_images');
    if (!hasTable) {
      await knex.schema.createTable('product_images', (t) => {
        t.increments('id').primary();
        t.integer('product_id').notNullable()
          .references('id').inTable('products').onDelete('CASCADE');
        t.text('url').notNullable();
        t.integer('idx').notNullable().defaultTo(0);
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.unique(['product_id', 'url']);
      });
      // Индекс на сортировку галереи
      await knex.schema.alterTable('product_images', (t) => {
        t.index(['product_id', 'idx'], 'ix_product_images_pid_idx');
      });
    }
  } finally {
    await knex.raw('SELECT pg_advisory_unlock(711001)');
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 1) Тонкий advisory-lock по SKU, чтобы не было гонок при синхронизации конкретного товара.
//    Считаем хеш прямо в SQL (без промежуточного чтения hash из rows).
async function withSkuLock<T>(sku: string, fn: () => Promise<T>): Promise<T> {
  const lockExpr = "('x' || substr(md5(?),1,16))::bit(64)::bigint";
  await knex.raw(`SELECT pg_advisory_lock(${lockExpr});`, [sku]);
  try {
    return await fn();
  } finally {
    await knex.raw(`SELECT pg_advisory_unlock(${lockExpr});`, [sku]);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 2) Путь и URL-утилиты: только внутри MEDIA_BASE_DIR, иначе «не лезем к чужим фото».
function isInsideBase(absPath: string): boolean {
  const base = path.resolve(MEDIA_BASE_DIR) + path.sep;
  const candidate = path.resolve(absPath);
  return candidate.toLowerCase().startsWith(base.toLowerCase());
}

function toPublicUrlFromAbs(absPath: string): string | null {
  if (!isInsideBase(absPath)) return null;
  const rel = path.relative(MEDIA_BASE_DIR, absPath).split(path.sep).join('/'); // normalize to /
  return `${PUBLIC_BASE_URL}${UPLOADS_PREFIX}/${rel}`;
}

function tryResolvePreferUrl(preferUrl?: string | null): { abs?: string, public?: string } | null {
  if (!preferUrl) return null;
  const s = String(preferUrl).trim();
  if (!s) return null;

  // 1) http/https оставляем как есть (не наша статика — но мы её уважаем)
  if (/^https?:\/\//i.test(s)) {
    return { public: s };
  }

  // 2) Абсолютный путь (Windows/Unix) — проверим, что он внутри MEDIA_BASE_DIR
  if (path.isAbsolute(s)) {
    const abs = path.resolve(s);
    if (fs.existsSync(abs) && isImage(abs) && isInsideBase(abs)) {
      const pub = toPublicUrlFromAbs(abs);
      if (pub) return { abs, public: pub };
    }
    return null;
  }

  // 3) Относительный путь вроде "images/foo.jpg" или "models/x.stl"
  const abs = path.resolve(MEDIA_BASE_DIR, s);
  if (fs.existsSync(abs) && isImage(abs) && isInsideBase(abs)) {
    const pub = toPublicUrlFromAbs(abs);
    if (pub) return { abs, public: pub };
  }
  return null;
}

// Мягкий фолбек по basename для относительного пути из CSV
function resolvePreferByBasename(hint?: string | null): { abs?: string, public?: string } | null {
  if (!hint) return null;
  const base = path.basename(String(hint));
  if (!base) return null;
  const abs = path.resolve(MEDIA_BASE_DIR, 'images', base);
  if (fs.existsSync(abs) && isImage(abs) && isInsideBase(abs)) {
    const pub = toPublicUrlFromAbs(abs);
    if (pub) return { abs, public: pub };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────────
// 3) Поиск кандидатов по SKU — безопасный.
//    Стратегия:
//    • Если есть папка images/<SKU>/ → берём все изображения оттуда (это «свои»).
//    • Если есть preferUrl → ставим его первым и используем, даже если он один.
//    • НЕ сканируем общую папку images/* по маскам — чтобы не подцепить чужое.
async function findSkuImages(sku: string, preferAbs?: string | null): Promise<string[]> {
  const imagesDir = path.resolve(MEDIA_BASE_DIR, 'images');
  const skuDir = path.resolve(imagesDir, sku);

  const found: string[] = [];

  if (preferAbs && fs.existsSync(preferAbs) && isInsideBase(preferAbs) && isImage(preferAbs)) {
    found.push(preferAbs);
  }

  // Если есть выделенная папка под SKU — берём всё оттуда
  try {
    const st = await fsp.stat(skuDir);
    if (st.isDirectory()) {
      const entries = await fsp.readdir(skuDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        const abs = path.resolve(skuDir, ent.name);
        if (isImage(abs) && fs.existsSync(abs)) {
          found.push(abs);
        }
      }
    }
  } catch { /* no dir — ok */ }

  // Убираем дубликаты и сортируем «по-человечески». preferAbs — наверх.
  const uniq = Array.from(new Set(found.map(p => path.resolve(p))));
  uniq.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (preferAbs) {
    const i = uniq.findIndex(p => path.resolve(p) === path.resolve(preferAbs));
    if (i > 0) {
      const [x] = uniq.splice(i, 1);
      uniq.unshift(x);
    }
  }
  return uniq;
}

// ────────────────────────────────────────────────────────────────────────────────
// 4) Основная процедура синка: создаём записи в product_images, индексы,
//    и при необходимости обновляем products.image_url, не затирая осмысленное.
async function syncMediaForProduct(
  productId: number,
  sku: string,
  prefer?: { abs?: string, public?: string } | null
) {
  await ensureProductImagesSchema();

  const trx = await knex.transaction();
  try {
    const [product] = await trx('products').select('id', 'image_url').where({ id: productId }).limit(1);
    if (!product) {
      await trx.rollback();
      return;
    }

    const preferAbs = prefer?.abs;
    const candidatesAbs = await findSkuImages(sku, preferAbs);

    // Конвертируем только те, что действительно лежат в нашей базе (защита от «чужих»)
    let candidatePublicUrls = candidatesAbs
      .map(toPublicUrlFromAbs)
      .filter((u): u is string => !!u);

    // Если prefer указывает на http/https (внешний URL), уважим его и поставим первым
    if (prefer?.public && /^https?:\/\//i.test(prefer.public)) {
      if (!candidatePublicUrls.includes(prefer.public)) {
        candidatePublicUrls = [prefer.public, ...candidatePublicUrls];
      } else {
        // гарантируем, что он первый
        candidatePublicUrls = [
          prefer.public,
          ...candidatePublicUrls.filter(u => u !== prefer.public),
        ];
      }
    }

    // Если список пуст — чистим старые записи полностью и выходим
    if (candidatePublicUrls.length === 0) {
      await trx('product_images').where({ product_id: productId }).del();
      await trx.commit();
      console.log(`[media] ${sku}: no images; gallery cleared`);
      return;
    }

    // Удаляем всё, что не входит в новый «белый список» (чтобы не тянуть «чужое» из прошлого)
    await trx('product_images')
      .where({ product_id: productId })
      .andWhere((qb) => qb.whereNotIn('url', candidatePublicUrls))
      .del();

    // Текущее состояние после чистки
    const existing = await trx('product_images')
      .select('id', 'url', 'idx')
      .where({ product_id: productId })
      .orderBy('idx', 'asc');
    const existingUrls = new Set(existing.map(e => e.url));

    // Вставляем недостающие
    for (const url of candidatePublicUrls) {
      if (!existingUrls.has(url)) {
        await trx('product_images')
          .insert({ product_id: productId, url, idx: 0 }) // idx обновим ниже одним проходом
          .onConflict(['product_id', 'url'])
          .ignore();
      }
    }

    // Обновляем индексы в соответствии с порядком (prefer первым)
    const finalRows = await trx('product_images').select('id', 'url').where({ product_id: productId });
    const byUrl = new Map(finalRows.map(r => [r.url, r.id]));
    for (let i = 0; i < candidatePublicUrls.length; i++) {
      const url = candidatePublicUrls[i];
      const id = byUrl.get(url);
      if (id) {
        await trx('product_images').where({ id }).update({ idx: i });
      }
    }

    // Главная картинка в products.image_url:
    // • если есть prefer.public — проставим её как главную;
    // • иначе, если image_url пуст — ставим первую из галереи;
    if (prefer?.public) {
      await trx('products').where({ id: productId }).update({
        image_url: prefer.public,
        updated_at: new Date(),
      });
    } else if (!product.image_url) {
      await trx('products').where({ id: productId }).update({
        image_url: candidatePublicUrls[0],
        updated_at: new Date(),
      });
    }

    await trx.commit();
    console.log(`[media] ${sku}: ${candidatePublicUrls.length} image(s) linked; main -> ${candidatePublicUrls[0]}`);
  } catch (e) {
    await trx.rollback();
    console.error(`[media] ${sku}: error`, e);
    throw e;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 5) Публичный API воркера — процессор BullMQ.
//    Джоба: { sku: string; preferUrl?: string | null }
export async function processMediaJob(job: Job<{ sku: string; preferUrl?: string | null }>) {
  const { sku, preferUrl } = job.data || ({} as any);
  if (!sku) return;

  await withSkuLock(sku, async () => {
    // Ищем товар
    const p = await knex('products').select('id', 'sku').where({ sku }).first();
    if (!p) {
      console.warn(`[media] ${sku}: product not found`);
      return;
    }
    // Уважаем preferUrl — он может быть http(s) или относительный (images/..)
    const prefer =
      tryResolvePreferUrl(preferUrl) ??
      resolvePreferByBasename(preferUrl);
    await syncMediaForProduct(p.id, sku, prefer);
  });
}

// На всякий случай экспорт по умолчанию (чтобы удобно импортить в queue.worker.ts)
export default processMediaJob;
