// backend/src/api/products.ts
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import { env } from '../core/env.js';

/**
 * Галерея из новой схемы медиа:
 * product_assets (role, sort_order) + assets (public_url)
 */
type GalleryItem = {
  product_id: string;
  role: 'main_image' | 'gallery' | 'model_primary' | 'model_alt' | 'manual' | string;
  sort_order: number;
  url: string | null;        // из assets.public_url
  mime_type: string | null;
};

async function fetchImageGalleryByProductIds(productIds: string[]): Promise<Record<string, GalleryItem[]>> {
  if (!productIds.length) return {};
  const rows: GalleryItem[] = await db('product_assets as pa')
    .join('assets as a', 'a.id', 'pa.asset_id')
    .whereIn('pa.product_id', productIds)
    .andWhere('a.kind', 'image')
    .select({
      product_id: 'pa.product_id',
      role: 'pa.role',
      sort_order: 'pa.sort_order',
      url: 'a.public_url',
      mime_type: 'a.mime_type',
    })
    // порядок: продукт → main_image → sort_order → role
    .orderBy('pa.product_id', 'asc')
    .orderByRaw(`CASE WHEN pa.role = 'main_image' THEN 0 ELSE 1 END`)
    .orderBy('pa.sort_order', 'asc')
    .orderBy('pa.role', 'asc');

  const byId: Record<string, GalleryItem[]> = {};
  for (const r of rows) (byId[r.product_id] ||= []).push(r);
  return byId;
}

const ImageInput = z.object({
  url: z.string().url(),
  thumbUrl: z.string().url().optional(),
  alt: z.string().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

const ProductCreate = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  currency: z.string().default('UAH'),
  stock: z.coerce.number().int().nonnegative().default(0),
  image_url: z.string().url().optional(), // совместимость с FE
  categories: z.array(z.string()).default([]).optional(),
  attributes: z.record(z.any()).default({}).optional(),
  images: z.array(ImageInput).default([]).optional(), // не используем для assets-схемы
});

const ProductPatch = ProductCreate.partial();

const requireAdmin: preHandlerHookHandler = (req, reply, done) => {
  if (!env.ADMIN_TOKEN) return reply.code(500).send({ message: 'ADMIN_TOKEN not set' });
  const token = (req.headers['x-admin-token'] as string) || '';
  if (token !== env.ADMIN_TOKEN) return reply.code(401).send({ message: 'Unauthorized' });
  done();
};

// helpers для универсального ключа
function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
function isIntLike(s: string) {
  return /^\d+$/.test(s);
}

export default async function routes(app: FastifyInstance) {
  /**
   * GET /api/products
   * Список с фильтрами, курсорной пагинацией и возвратом image_url + images[] (assets-схема).
   */
  app.get('/api/products', async (req, reply) => {
    const q = (req.query as any).q as string | undefined;
    const limit = Math.max(1, Math.min(200, Number((req.query as any).limit ?? 20)));
    const sort = ((req.query as any).sort as string | undefined) || 'popular'; // popular|new|price_asc|price_desc

    // фильтры
    const categoriesParam = (req.query as any).categories as string | undefined; // "decor,lighting"
    const cats = categoriesParam ? categoriesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const minPrice = (req.query as any).minPrice;
    const maxPrice = (req.query as any).maxPrice;
    const material = (req.query as any).material as string | undefined;   // attributes->>'material'
    const printTech = (req.query as any).printTech as string | undefined; // attributes->>'printTech'

    // курсор: зависит от сортировки
    type CursorPopularNew = { id: string; created_at: string };
    type CursorPrice = { id: string; price: number };
    const rawCursor = (req.query as any).cursor as string | undefined;

    const cursorPopularNew: CursorPopularNew | null =
      rawCursor && (sort === 'popular' || sort === 'new')
        ? (decodeCursor(rawCursor) as CursorPopularNew)
        : null;

    const cursorPrice: CursorPrice | null =
      rawCursor && (sort === 'price_asc' || sort === 'price_desc')
        ? (decodeCursor(rawCursor) as CursorPrice)
        : null;

    // явные поля (+ image_url)
    let query = db('products').select(
      'id',
      'sku',
      'name',
      'description',
      'price',
      'currency',
      'stock',
      'image_url',
      'categories',
      'attributes',
      'created_at',
      'updated_at'
    );

    // Поиск
    if (q) {
      query = query.where((b) => {
        b.whereILike('name', `%${q}%`).orWhereILike('sku', `%${q}%`);
      });
    }

    // Категории (jsonb массив строк или сет ключей — оператор '?' покрывает оба варианта)
    if (cats.length) {
      query = query.where((b) => {
        for (const c of cats) b.orWhereRaw('categories ? ?', [c]);
      });
    }

    // Цена
    if (minPrice !== undefined && minPrice !== '') query = query.andWhere('price', '>=', Number(minPrice));
    if (maxPrice !== undefined && maxPrice !== '') query = query.andWhere('price', '<=', Number(maxPrice));

    // Атрибуты
    if (material) query = query.andWhereRaw("LOWER(COALESCE(attributes->>'material','')) = LOWER(?)", [material]);
    if (printTech) query = query.andWhereRaw("LOWER(COALESCE(attributes->>'printTech','')) = LOWER(?)", [printTech]);

    // Сортировка + курсор
    if (sort === 'price_asc') {
      query = query.orderBy('price', 'asc').orderBy('id', 'asc');
      if (cursorPrice) {
        // для ASC следующая страница — элементы СТРОГО больше пары (price,id)
        query = query.andWhereRaw('(price, id) > (?, ?)', [cursorPrice.price, cursorPrice.id]);
      }
    } else if (sort === 'price_desc') {
      query = query.orderBy('price', 'desc').orderBy('id', 'desc');
      if (cursorPrice) {
        // для DESC — СТРОГО меньше пары (price,id)
        query = query.andWhereRaw('(price, id) < (?, ?)', [cursorPrice.price, cursorPrice.id]);
      }
    } else if (sort === 'new' || sort === 'popular') {
      // popular ~ новые сначала
      query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');
      if (cursorPopularNew) {
        // следующая страница — "старше": (created_at,id) < (cursor.created_at,cursor.id)
        query = query.andWhereRaw('(created_at, id) < (?, ?)', [cursorPopularNew.created_at, cursorPopularNew.id]);
      }
    } else {
      query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');
    }

    query = query.limit(limit + 1);

    const rows = await query;

    // Галерея (assets)
    const slice = rows.slice(0, limit);
    const ids = slice.map((r: any) => r.id);
    const galleries = await fetchImageGalleryByProductIds(ids);

    const items = slice.map((p: any) => {
      const gal = galleries[p.id] || [];
      const primary =
        gal.find(g => g.role === 'main_image' && g.url) ??
        gal.find(g => g.url) ??
        null;

      return {
        ...p,
        categories: p.categories ?? [],
        attributes: p.attributes ?? {},
        image_url: p.image_url ?? primary?.url ?? null,
        images: gal.map(g => ({
          url: g.url,
          thumb_url: g.url,
          role: g.role,
          sort_order: g.sort_order,
          mime_type: g.mime_type,
        })),
      };
    });

    // nextCursor
    const hasMore = rows.length > limit;
    let nextCursor: string | null = null;
    if (hasMore && items.length) {
      const last = items[items.length - 1] as any;
      if (sort === 'price_asc' || sort === 'price_desc') {
        nextCursor = encodeCursor({ id: String(last.id), price: Number(last.price) } as CursorPrice);
      } else {
        nextCursor = encodeCursor({
          id: String(last.id),
          created_at: new Date(last.created_at).toISOString(),
        } as CursorPopularNew);
      }
    }

    return reply.send({ items, nextCursor });
  });

  /**
   * GET /api/products/by-id/:id
   * Явный эндпоинт по id (int или uuid).
   */
  app.get('/api/products/by-id/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const where = isIntLike(id) ? { id: Number(id) } : { id };
    const p = await db('products').where(where).first();
    if (!p) return reply.code(404).send({ error: 'Not found' });

    const images = await db('product_images')
      .select('url').where({ product_id: p.id }).orderBy('idx', 'asc');

    return reply.send({
      ...p,
      categories: p.categories ?? [],
      attributes: p.attributes ?? {},
      images: images.length ? images.map((i: any) => i.url) : (p.image_url ? [p.image_url] : []),
    });
  });

  /**
   * GET /api/products/:key
   * Универсальный: принимает и sku, и id (int/uuid).
   */
  app.get('/api/products/:key', async (req, reply) => {
    const { key } = req.params as { key: string };

    // 1) sku
    let p = await db('products').where({ sku: key }).first();

    // 2) numeric id
    if (!p && isIntLike(key)) {
      p = await db('products').where({ id: Number(key) }).first();
    }
    // 3) uuid id
    if (!p && isUuidLike(key)) {
      p = await db('products').where({ id: key }).first();
    }

    if (!p) return reply.code(404).send({ error: 'Not found' });

    const images = await db('product_images')
      .select('url')
      .where({ product_id: p.id })
      .orderBy('idx', 'asc');

    return reply.send({
      ...p,
      categories: p.categories ?? [],
      attributes: p.attributes ?? {},
      images: images.length ? images.map((i: any) => i.url) : (p.image_url ? [p.image_url] : []),
    });
  });

  /**
   * POST /api/products
   * Создание товара. Галерею наполняет ingester/воркер.
   */
  app.post('/api/products', { preHandler: requireAdmin }, async (req, reply) => {
    const body = ProductCreate.parse(req.body);
    const { images: _unusedImages = [], ...product } = body;

    const [row] = await db('products').insert(product).returning('*');

    return reply.code(201).send({
      ...row,
      categories: row.categories ?? [],
      attributes: row.attributes ?? {},
      image_url: row.image_url ?? null,
      images: [],
    });
  });

  /**
   * PATCH /api/products/:id
   * Обновление по id (int/uuid).
   */
  app.patch('/api/products/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const patch = ProductPatch.parse(req.body);
    const where = isIntLike(id) ? { id: Number(id) } : { id };
    const [row] = await db('products')
      .where(where)
      .update({ ...patch, updated_at: db.fn.now() })
      .returning('*');

    if (!row) return reply.code(404).send({ message: 'Not found' });

    return reply.send({
      ...row,
      categories: row.categories ?? [],
      attributes: row.attributes ?? {},
    });
  });

  /**
   * DELETE /api/products/:id
   * Удаление по id (int/uuid).
   */
  app.delete('/api/products/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const where = isIntLike(id) ? { id: Number(id) } : { id };
    const res = await db('products').where(where).del();
    if (!res) return reply.code(404).send({ message: 'Not found' });
    return reply.code(204).send();
  });
}
