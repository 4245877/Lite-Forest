// services/ingester/src/workers/importers.ts
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'fast-csv';
import knex from '../db.js';
import { mediaQueue } from '../queue.js';

// ⬇️ Прайсинг: конфиг + калькулятор себестоимости
import { loadPricingConfig, computeCostPlus } from '../pricing.js';

const PRICING_CFG = loadPricingConfig(
  path.resolve(process.cwd(), 'data/pricing.yml')
);

export async function readCsvToStaging(csvPath: string, batchId: string) {
  const rows: any[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(parse({ headers: true, ignoreEmpty: true, trim: true }))
      .on('error', reject)
      .on('data', (r: any) => rows.push(r))
      .on('end', () => resolve());
  });

  // Минимальный набор в staging (как было раньше)
  const payload = rows.map((r) => ({
    import_batch_id: batchId,
    sku: r.sku,
    name: r.name,
    description: r.description,
    price: String(r.price ?? ''),
    currency: String(r.currency ?? ''),
    stock: String(r.stock ?? '0'),
    image_url: r.image_url ?? null,
    model_url: r.model_url ?? null,
    categories: r.categories ?? '',
    attributes: safeJson(r.attributes),
  }));

  await knex.withSchema('staging').table('products_raw').insert(payload);
}

function safeJson(input: any) {
  if (!input) return {};
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(String(input));
  } catch {
    return {};
  }
}

function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Мердж из staging + хук прайсинга.
 *
 * Логика:
 * 1) читаем строки батча из staging.products_raw;
 * 2) для каждой строки определяем метод ценообразования:
 *    - если price в CSV указан → manual;
 *    - иначе → cost_plus (по конфигу PRICING_CFG);
 * 3) апсертим в products все базовые поля + price/pricing_method/pricing(JSON);
 * 4) назначаем категории;
 * 5) обновляем материализованный вид.
 */
export async function mergeFromStaging(batchId: string) {
  type Row = {
    sku: string | null;
    name: string | null;
    description: string | null;
    price: string | null; // как пришло в staging
    currency: string | null;
    stock: number | string | null;
    image_url?: string | null;
    model_url?: string | null;
    categories?: string | null;
    attributes?: any;
  };

  const rows: Row[] = await knex
    .withSchema('staging')
    .table('products_raw')
    .select(
      'sku',
      'name',
      'description',
      'price',
      'currency',
      'stock',
      'image_url',
      'model_url',
      'categories',
      'attributes'
    )
    .where('import_batch_id', batchId);

  if (!rows.length) {
    console.log(`[import] batch ${batchId}: no rows found in staging`);
    return;
  }

  // Соберём все категории заранее для батчевого сопоставления
  const allCatSlugs = new Set<string>();
  for (const r of rows) {
    const cats = String(r.categories ?? '')
      .split('|')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const c of cats) allCatSlugs.add(c);
  }

  const knownCats =
    allCatSlugs.size > 0
      ? await knex('categories')
          .select('id', 'slug')
          .whereIn('slug', Array.from(allCatSlugs))
      : [];

  const catBySlug = new Map<string, number>(
    knownCats.map((c: any) => [c.slug, c.id])
  );

  const upsertedProducts: Array<{ id: number; sku: string }> = [];

  for (const row of rows) {
    if (!row.sku) continue;

    const attrs = (row.attributes && typeof row.attributes === 'object'
      ? row.attributes
      : {}) as Record<string, any>;

    // Входные параметры прайсинга:
    const input = {
      sku: row.sku,
      currency: (row.currency || PRICING_CFG.currency) as string,

      // manual price, если задана в CSV
      price: toNum(row.price),

      // если price задана — manual, иначе cost_plus
      price_method: ((row as any).price_method as any) || (row.price ? 'manual' : 'cost_plus'),

      // Возможные поля для себестоимости и трудозатрат:
      material_type:
        (row as any).material_type ??
        attrs.material_type ??
        undefined,
      material_g:
        toNum((row as any).material_g) ??
        toNum(attrs.material_g),
      material_ml:
        toNum((row as any).material_ml) ??
        toNum(attrs.material_ml),
      print_time_min:
        toNum((row as any).print_time_min) ??
        toNum(attrs.print_time_min),
      postprocess_min:
        toNum((row as any).postprocess_min) ??
        toNum(attrs.postprocess_min),
      packaging_cost:
        toNum((row as any).packaging_cost) ??
        toNum(attrs.packaging_cost),
      shipping_included:
        String((row as any).shipping_included ?? attrs.shipping_included ?? '')
          .toLowerCase()
          .trim() === 'true',
      target_margin_pct:
        toNum((row as any).target_margin_pct) ??
        toNum(attrs.target_margin_pct),
    };

    let price = input.price;
    let pricing_method: 'manual' | 'cost_plus' =
      (input.price_method as any) || 'manual';
    let pricing: any = {};

    if (pricing_method === 'cost_plus') {
      const calc = computeCostPlus(PRICING_CFG, input);
      price = calc.price_final;
      pricing = calc;
    }

    // Апсерт товара
    const [prod] = await knex('products')
      .insert({
        sku: input.sku,
        name: row.name?.trim() || input.sku,
        description: row.description || null,
        price: price ?? 0,
        currency: String(input.currency || PRICING_CFG.currency).toUpperCase(),
        stock: Number(row.stock ?? 0) || 0,
        attributes: row.attributes || {},
        pricing_method,
        pricing: JSON.stringify(pricing),
      })
      .onConflict('sku')
      .merge({
        name: row.name?.trim() || knex.raw('products.name'),
        description: row.description ?? knex.raw('products.description'),
        price: price ?? knex.raw('products.price'),
        currency:
          String(input.currency || PRICING_CFG.currency).toUpperCase() ||
          knex.raw('products.currency'),
        stock: Number(row.stock ?? 0) || 0,
        attributes: knex.raw('products.attributes || ?', [row.attributes || {}]),
        pricing_method,
        pricing: JSON.stringify(pricing),
      })
      .returning(['id', 'sku']);

    upsertedProducts.push(prod);

    // Привязка категорий
    const catSlugs = String(row.categories ?? '')
      .split('|')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (catSlugs.length) {
      const links = catSlugs
        .map((slug) => catBySlug.get(slug))
        .filter(Boolean)
        .map((category_id) => ({
          product_id: prod.id,
          category_id,
        }));

      if (links.length) {
        await knex('product_categories')
          .insert(links)
          .onConflict(['product_id', 'category_id'])
          .ignore();
      }
    }
  }

  // Поддержка совместимости: обновим материализованный вид, как и раньше
  await knex.raw('REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_items;');

  console.log(
    `[import] batch ${batchId}: upserted ${upsertedProducts.length} products with pricing`
  );
}

export async function createOrUpdateFromUrl(data: {
  sourceUrl: string;
  sku?: string;
  price?: number;
  currency?: string;
  stock?: number;
  categories?: string[];
  imageUrl?: string;
  modelUrl?: string;
  attributes?: any;
}) {
  const sku =
    data.sku ?? 'SKU-' + Math.random().toString(36).slice(2, 8).toUpperCase();

  const [product] = await knex('products')
    .insert({
      sku,
      name: sku,
      description: data.sourceUrl,
      price: data.price ?? 0,
      currency: (data.currency ?? 'UAH').toUpperCase(),
      stock: data.stock ?? 0,
      attributes: { ...data.attributes, source_url: data.sourceUrl },
    })
    .onConflict('sku')
    .merge()
    .returning(['id', 'sku']);

  if (data.categories?.length) {
    const cats: Array<{ id: number; slug: string }> = await knex('categories')
      .select('id', 'slug')
      .whereIn('slug', data.categories);
    const links = cats.map((c: { id: number; slug: string }) => ({
      product_id: product.id,
      category_id: c.id,
    }));
    if (links.length) {
      await knex('product_categories')
        .insert(links)
        .onConflict(['product_id', 'category_id'])
        .ignore();
    }
  }

  return {
    productId: product.id,
    sku: product.sku,
    imageUrl: data.imageUrl,
    modelUrl: data.modelUrl,
  };
}

/**
 * Поставить медиа-задачи в очередь для всех товаров из CSV-пакета.
 * Добавляет main_image, model_primary и gallery (если есть) на основе staging.products_raw.attributes.gallery_files.
 */

// --- Фильтр валидности источника медиа + безопасная постановка задач ---
function looksLikeSrc(x: any) {
  if (typeof x !== 'string') return false;
  const s = x.trim();
  if (!s) return false;
  // http(s), file://, абсолютные пути Windows/UNC, или относительный файл с расширением (без '|')
  return (
    /^https?:\/\//i.test(s) ||
    /^file:\/\//i.test(s) ||
    /^[a-zA-Z]:[\\/]/.test(s) || // Windows absolute
    /^\\\\/.test(s) || // UNC
    (!s.includes('|') && /[\/\\]/.test(s) && /\.\w{2,}$/.test(s))
  );
}

async function addIfValid(
  prod: { id: string; sku: string },
  raw: any,
  role: 'main_image' | 'model_primary' | 'gallery'
) {
  if (!looksLikeSrc(raw)) {
    if (raw && String(raw).trim()) {
      console.warn(`[media] skip invalid ${role} for ${prod.sku}: ${raw}`);
    }
    return;
  }
  await mediaQueue.add(
    'media',
    { productId: prod.id, sku: prod.sku, role, url: String(raw).trim() },
    { removeOnComplete: true }
  );
}
// ----------------------------------------------------------------------

export async function enqueueMediaForBatch(batchId: string) {
  type Row = {
    sku?: string | null;
    image_url?: string | null;
    model_url?: string | null;
    attributes?: any;
  };

  const rows: Row[] = await knex
    .withSchema('staging')
    .table('products_raw')
    .select('sku', 'image_url', 'model_url', 'attributes')
    .where('import_batch_id', batchId);

  const skus = rows.map((r) => r.sku).filter(Boolean) as string[];

  if (skus.length === 0) {
    console.log(`[import] batch ${batchId}: no SKUs found for media enqueue`);
    return;
  }

  const prods: Array<{ id: string; sku: string }> = await knex('products')
    .select('id', 'sku')
    .whereIn('sku', skus);

  const bySku = new Map(prods.map((p) => [p.sku, p]));

  for (const r of rows) {
    const prod = r.sku ? bySku.get(r.sku) : null;
    if (!prod) continue;

    // main_image
    await addIfValid(prod, r.image_url, 'main_image');

    // model_primary
    await addIfValid(prod, r.model_url, 'model_primary');

    // gallery (attributes.gallery_files)
    const gallery =
      r.attributes &&
      typeof r.attributes === 'object' &&
      Array.isArray((r.attributes as any).gallery_files)
        ? (r.attributes as any).gallery_files
        : [];

    for (const g of gallery) {
      await addIfValid(prod, g, 'gallery');
    }
  }

  console.log(
    `[import] batch ${batchId}: media jobs enqueued for ${prods.length} products`
  );
}
