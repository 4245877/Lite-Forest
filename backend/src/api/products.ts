// backend/src/api/products.ts
import { FastifyInstance, preHandlerHookHandler } from 'fastify';
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
  role: 'main_image' | 'gallery' | 'model_primary' | 'model_alt' | 'manual';
  sort_order: number;
  url: string | null;        // берём из assets.public_url
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
    // порядок: сгруппировать по продукту, приоритет main_image, затем sort_order, затем роль
    .orderBy('pa.product_id', 'asc')
    .orderByRaw(`CASE WHEN pa.role = 'main_image' THEN 0 ELSE 1 END ASC`)
    .orderBy('pa.sort_order', 'asc')
    .orderBy('pa.role', 'asc');

  const byId: Record<string, GalleryItem[]> = {};
  for (const r of rows) {
    (byId[r.product_id] ||= []).push(r);
  }
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
  images: z.array(ImageInput).default([]).optional(), // не используем для assets-схемы; оставлено для совместимости
});

const ProductPatch = ProductCreate.partial();

const requireAdmin: preHandlerHookHandler = (req, reply, done) => {
  if (!env.ADMIN_TOKEN) return reply.code(500).send({ message: 'ADMIN_TOKEN not set' });
  const token = (req.headers['x-admin-token'] as string) || '';
  if (token !== env.ADMIN_TOKEN) return reply.code(401).send({ message: 'Unauthorized' });
  done();
};

export default async function routes(app: FastifyInstance) {
  /**
   * GET /api/products
   * Список с фильтрами, курсорной пагинацией и возвратом image_url.
   * Источник: таблица products (image_url уже поддерживается триггерами).
   */
  app.get('/api/products', async (req, reply) => {
    const q = (req.query as any).q as string | undefined;
    const limit = Math.max(1, Math.min(200, Number((req.query as any).limit ?? 20)));
    const cursor = decodeCursor<{ id: string }>((req.query as any).cursor);

    const categoriesParam = (req.query as any).categories as string | undefined; // "decor,lighting"
    const cats = categoriesParam ? categoriesParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    const minPrice = (req.query as any).minPrice;
    const maxPrice = (req.query as any).maxPrice;
    const material = (req.query as any).material as string | undefined;   // attributes->>'material'
    const printTech = (req.query as any).printTech as string | undefined; // attributes->>'printTech'
    const sort = ((req.query as any).sort as string | undefined) || 'popular';

    // ВАЖНО: выбираем явные поля и image_url
    let query = db('products').select(
      'id',
      'sku',
      'name',
      'description',
      'price',
      'currency',
      'stock',
      'image_url',          // <-- ОБОВʼЯЗКОВО
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

    // Фильтр по категориям (jsonb массив/множество строк): "есть любая из выбранных"
    if (cats.length) {
      query = query.where((b) => {
        for (const c of cats) {
          // jsonb-проверка: массив содержит значение/ключ
          b.orWhereRaw('categories ? ?', [c]);
        }
      });
    }

    // Фильтр по цене
    if (minPrice !== undefined && minPrice !== '') {
      query = query.andWhere('price', '>=', Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      query = query.andWhere('price', '<=', Number(maxPrice));
    }

    // Фильтр по материалу/технологии печати (в jsonb attributes)
    if (material) {
      query = query.andWhereRaw("LOWER(COALESCE(attributes->>'material','')) = LOWER(?)", [material]);
    }
    if (printTech) {
      query = query.andWhereRaw("LOWER(COALESCE(attributes->>'printTech','')) = LOWER(?)", [printTech]);
    }

    // Сортировка
    if (sort === 'price_asc') {
      query = query.orderBy('price', 'asc').orderBy('id', 'desc');
    } else if (sort === 'price_desc') {
      query = query.orderBy('price', 'desc').orderBy('id', 'desc');
    } else if (sort === 'new') {
      query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');
    } else {
      // popular ~ "новые сначала"
      query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');
    }

    // Курсорная пагинация (простая по id)
    query = query.limit(limit + 1);
    if (cursor && (sort === 'popular' || sort === 'new')) {
      query = query.where('id', '<', cursor.id);
    }

    const rows = await query;

    // Галерея из assets/product_assets
    const ids = rows.slice(0, limit).map((r: any) => r.id);
    const galleries = await fetchImageGalleryByProductIds(ids);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((p: any) => {
      const gal = galleries[p.id] || [];
      // приоритет: явно сохранённый в products.image_url → main_image из галереи → первая картинка
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
          // thumbnail можно прокинуть позже; пока отдадим тот же url
          thumb_url: g.url,
          role: g.role,
          sort_order: g.sort_order,
          mime_type: g.mime_type,
        })),
      };
    });

    const nextCursor = hasMore && items.length ? encodeCursor({ id: items[items.length - 1].id }) : null;
    return reply.send({ items, nextCursor });
  });

  /**
   * GET /api/products/:id
   * Возвращает один товар с галереей из assets/product_assets и корректным image_url.
   */
  app.get('/api/products/:id', async (req, reply) => {
    const { id } = req.params as any;

    // Явный список полей, включая image_url
    const row = await db('products')
      .select('id','sku','name','description','price','currency','stock','image_url','categories','attributes','created_at','updated_at')
      .where({ id })
      .first();

    if (!row) return reply.code(404).send({ message: 'Not found' });

    const galleries = await fetchImageGalleryByProductIds([id]);
    const gal = galleries[id] || [];

    const primary =
      gal.find(g => g.role === 'main_image' && g.url) ??
      gal.find(g => g.url) ??
      null;

    return reply.send({
      ...row,
      categories: row.categories ?? [],
      attributes: row.attributes ?? {},
      image_url: row.image_url ?? primary?.url ?? null,
      images: gal.map(g => ({
        url: g.url,
        thumb_url: g.url,
        role: g.role,
        sort_order: g.sort_order,
        mime_type: g.mime_type,
      })),
    });
  });

  /**
   * POST /api/products
   * Базовое создание товара. Параметр images оставлен для совместимости,
   * но под новую схему медиа (assets/product_assets) он не используется.
   * Импорт изображений делаем через твой ingester.
   */
  app.post('/api/products', { preHandler: requireAdmin }, async (req, reply) => {
    const body = ProductCreate.parse(req.body);
    const { images: _unusedImages = [], ...product } = body;

    const [row] = await db('products').insert(product).returning('*');

    // Галерею не создаём здесь; ею занимается ingester/медиа-воркер
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
   */
  app.patch('/api/products/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const patch = ProductPatch.parse(req.body);
    const [row] = await db('products')
      .where({ id })
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
   */
  app.delete('/api/products/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const res = await db('products').where({ id }).del();
    if (!res) return reply.code(404).send({ message: 'Not found' });
    return reply.code(204).send();
  });
}
