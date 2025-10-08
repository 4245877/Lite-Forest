// services/ingester/src/workers/importers.ts
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'fast-csv';
import knex from '../db.js';
import { mediaQueue } from '../queue.js';
import { loadPricingConfig, computeCostPlus } from '../pricing.js';

const PRICING_CFG = loadPricingConfig(
  path.resolve(process.cwd(), 'data/pricing.yml')
);

// --- Валидные расширения ---
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const MODEL_EXT = new Set(['.stl', '.obj', '.3mf', '.fbx', '.glb', '.gltf']);

const isImage = (p?: string | null) =>
  !!p && IMG_EXT.has(path.extname(String(p)).toLowerCase());

const isModel = (p?: string | null) =>
  !!p && MODEL_EXT.has(path.extname(String(p)).toLowerCase());

// Нормализация чисел из CSV
function toNum(x: any) {
  if (x === null || x === undefined) return undefined;
  const s = String(x).trim();
  if (!s) return undefined;
  const norm = s
    .replace(/\s+/g, '')
    .replace(/[,]/g, '.')
    .replace(/[^\d.+-]/g, '');
  const n = Number(norm);
  return Number.isFinite(n) ? n : undefined;
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

// === Обеспечиваем staging-таблицу (без схемы) ===
async function ensureStagingTable() {
  const exists = await knex.schema.hasTable('staging_products');
  if (!exists) {
    await knex.schema.createTable('staging_products', (t) => {
      t.text('import_batch_id').notNullable();
      t.text('sku');
      t.text('name');
      t.text('description');
      t.text('price');
      t.text('currency');
      t.text('stock');
      t.text('image_url');
      t.text('model_url');
      t.text('categories');
      t.jsonb('attributes').defaultTo('{}');
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS ix_staging_products_batch ON staging_products(import_batch_id)');
    console.log('[import] created table staging_products');
  }
}

export async function readCsvToStaging(csvPath: string, batchId: string) {
  await ensureStagingTable();

  const rows: any[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(parse({ headers: true, ignoreEmpty: true, trim: true }))
      .on('error', reject)
      .on('data', (r: any) => rows.push(r))
      .on('end', () => resolve());
  });

  const payload = rows.map((r) => {
    const csvImage = r.main_image ?? r.image_url ?? r.image ?? null;
    const csvModel = r.model_url ?? r.model ?? null;

    const image_url = isImage(csvImage) ? String(csvImage).trim() : null;
    const model_url = isModel(csvModel)
      ? String(csvModel).trim()
      : (isModel(csvImage) ? String(csvImage).trim() : null);

    return {
      import_batch_id: batchId,
      sku: r.sku?.trim(),
      name: r.name?.trim(),
      description: r.description ?? null,

      price: toNum(r.price) ?? '',
      currency: String(r.currency ?? '').toUpperCase(),
      stock: String(r.stock ?? '0'),

      image_url,
      model_url,

      categories: r.categories ?? '',
      attributes: safeJson(r.attributes),
    };
  });

  if (payload.length) {
    await knex('staging_products').insert(payload);
  }
}

/**
 * Корректный апсерт товара из staging с прайсингом и безопасными полями.
 */
export async function mergeFromStaging(batchId: string) {
  type Row = {
    sku: string | null;
    name: string | null;
    description: string | null;
    price: string | null;
    currency: string | null;
    stock: number | string | null;
    image_url?: string | null;
    model_url?: string | null;
    categories?: string | null;
    attributes?: any;
  };

  const rows: Row[] = await knex('staging_products')
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
    console.log(`[import] batch ${batchId}: no rows found in staging_products`);
    return;
  }

  // Собираем список всех встреченных слагов категорий
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

  let upserted = 0;

  for (const row of rows) {
    if (!row.sku) continue;
    const sku = row.sku.trim();

    // Безопасные атрибуты
    const attrs =
      (row.attributes && typeof row.attributes === 'object'
        ? row.attributes
        : {}) as Record<string, any>;

    // Прайсинг (manual / cost_plus)
    const input = {
      sku,
      currency: (row.currency || PRICING_CFG.currency) as string,
      price: toNum(row.price),
      price_method:
        ((row as any).price_method as any) || (row.price ? 'manual' : 'cost_plus'),
      material_type: (row as any).material_type ?? attrs.material_type ?? undefined,
      material_g: toNum((row as any).material_g) ?? toNum(attrs.material_g),
      material_ml: toNum((row as any).material_ml) ?? toNum(attrs.material_ml),
      print_time_min: toNum((row as any).print_time_min) ?? toNum(attrs.print_time_min),
      postprocess_min: toNum((row as any).postprocess_min) ?? toNum(attrs.postprocess_min),
      packaging_cost: toNum((row as any).packaging_cost) ?? toNum(attrs.packaging_cost),
      shipping_included:
        String((row as any).shipping_included ?? attrs.shipping_included ?? '')
          .toLowerCase()
          .trim() === 'true',
      target_margin_pct:
        toNum((row as any).target_margin_pct) ?? toNum(attrs.target_margin_pct),
    };

    let price: number | undefined = input.price;
    const pricing_method: 'manual' | 'cost_plus' =
      (input.price_method as any) || 'manual';
    let pricing: any = {};

    if (pricing_method === 'cost_plus') {
      const calc = computeCostPlus(PRICING_CFG, input as any);
      price = calc.price_final;
      pricing = calc;
    }

    // Гарантированные NOT NULL поля
    const name = (row.name?.trim() || sku);
    const currency = String(input.currency || PRICING_CFG.currency || 'UAH').toUpperCase();
    const stock = Number(row.stock ?? 0) || 0;

    // Картинка из staging — только если валидный формат
    const cleanImageUrl = isImage(row.image_url) ? String(row.image_url).trim() : null;

    // --- Гарантия цены > 0 ---
    const isPos = (v: any) => Number.isFinite(v) && Number(v) > 0;
    const MIN_PRICE = Number((PRICING_CFG as any)?.rounding?.min_price ?? 1);
    const priceInsert = isPos(price) ? Number(price) : MIN_PRICE;
    const priceMerge  = isPos(price) ? Number(price) : knex.raw('products.price');

    // Полный INSERT (чтобы пройти NOT NULL). На MERGE аккуратно не перетираем пустым.
    const now = new Date();
    const insertPayload: Record<string, any> = {
      sku,
      name,
      description: row.description ?? null,
      price: priceInsert,            // <-- гарантирован минимум
      currency,
      stock,
      attributes: attrs,
      pricing_method,
      pricing,
      image_url: cleanImageUrl,
      created_at: now,
      updated_at: now,
    };

    const mergePayload: Record<string, any> = {
      name: row.name?.trim() || knex.raw('products.name'),
      description:
        row.description != null ? row.description : knex.raw('products.description'),

      price: priceMerge,             // <-- не затираем валидную старую цену
      currency,
      stock,

      attributes: knex.raw('products.attributes || ?', [attrs]),
      pricing_method,
      pricing,

      image_url: cleanImageUrl ?? knex.raw('products.image_url'),
      updated_at: now,
    };

    const [prod] = await knex('products')
      .insert(insertPayload)
      .onConflict('sku')
      .merge(mergePayload)
      .returning(['id', 'sku']);

    upserted++;

    // Привязка к категориям
    const catSlugs = String(row.categories ?? '')
      .split('|')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (catSlugs.length) {
      const links = catSlugs
        .map((slug) => catBySlug.get(slug))
        .filter(Boolean)
        .map((category_id) => ({ product_id: prod.id, category_id }));

      if (links.length) {
        await knex('product_categories')
          .insert(links)
          .onConflict(['product_id', 'category_id'])
          .ignore();
      }
    }

    // Постановка задачи синка медиа — закрепляем "предпочтительное" фото из CSV
    await mediaQueue.add(
      'sync-media',
      {
        sku: input.sku,
        // если в CSV пришёл валидный путь к фото — закрепляем его как главный
        preferUrl: isImage(row.image_url) ? String(row.image_url).trim() : null,
      } as any, // тип джобы может не знать про preferUrl
      { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 750 } }
    );
  }

  // Обновление MView — мягко
  try {
    await knex.raw('REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_items;');
  } catch {}

  console.log(`[import] batch ${batchId}: upserted ${upserted} products`);
}

// Старое имя — на совместимость
export const mergeStagingBatch = mergeFromStaging;

/**
 * Допоміжне: масова постановка sync-media по batch.
 */
export async function enqueueMediaForBatch(batchId: string) {
  const rows: Array<{ sku?: string | null }> = await knex('staging_products')
    .select('sku')
    .where('import_batch_id', batchId);

  const skus = rows.map((r) => r.sku).filter(Boolean) as string[];
  for (const sku of skus) {
    await mediaQueue.add(
      'sync-media',
      { sku },
      { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 750 } }
    );
  }
  console.log(`[import] batch ${batchId}: media jobs enqueued for ${skus.length} products`);
}
