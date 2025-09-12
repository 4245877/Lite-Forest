import { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import { env } from '../core/env.js';




function toStaticUrl(key?: string | null) {
  if (!key) return null;
  return env.CDN_BASE_URL
    ? `${env.CDN_BASE_URL.replace(/\/+$/,'')}/${key}`
    : `/uploads/${key}`;
}

const ImageInput = z.object({
  url: z.string().url(),
  thumbUrl: z.string().url().optional(),
  alt: z.string().optional(),
  sort_order: z.number().int().nonnegative().optional()
});

const ProductCreate = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  currency: z.string().default('UAH'),
  stock: z.coerce.number().int().nonnegative().default(0),
  image_url: z.string().url().optional(),     // оставим на совместимость
  categories: z.array(z.string()).default([]).optional(),
  attributes: z.record(z.any()).default({}).optional(),
  images: z.array(ImageInput).default([]).optional()
});

const ProductPatch = ProductCreate.partial();

const requireAdmin: preHandlerHookHandler = (req, reply, done) => {
  if (!env.ADMIN_TOKEN) return reply.code(500).send({ message: 'ADMIN_TOKEN not set' });
  const token = (req.headers['x-admin-token'] as string) || '';
  if (token !== env.ADMIN_TOKEN) return reply.code(401).send({ message: 'Unauthorized' });
  done();
};

// вспомогательная проклейка картинок
function glueGallery(raw: any[]) {
  return raw.map((im: any) => {
    const guessThumbKey =
      im.thumb_key ??
      im.key?.replace('/original/', '/thumb/')?.replace(/\.(jpe?g|png)$/i, '.webp');

    return {
      ...im,
      url: im.url ?? (im.key ? toStaticUrl(im.key) : null),
      thumb_url: im.thumb_url ?? (guessThumbKey ? toStaticUrl(guessThumbKey) : null),
    };
  });
}

export default async function routes(app: FastifyInstance) {
  // list with cursor pagination & search + FILTERS
  app.get('/api/products', async (req, reply) => {
    const q = (req.query as any).q as string | undefined;
    const limit = Number((req.query as any).limit ?? 20);
    const cursor = decodeCursor<{ id: string }>((req.query as any).cursor);

    const categoriesParam = (req.query as any).categories as string | undefined; // "decor,lighting"
    const cats = categoriesParam ? categoriesParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    const minPrice = (req.query as any).minPrice;
    const maxPrice = (req.query as any).maxPrice;
    const material = (req.query as any).material as string | undefined;   // attributes->>'material'
    const printTech = (req.query as any).printTech as string | undefined; // attributes->>'printTech'
    const sort = ((req.query as any).sort as string | undefined) || 'popular';

    let query = db('products').select('*');

    // поиск
    if (q) {
      query = query.where((b) => {
        b.whereILike('name', `%${q}%`).orWhereILike('sku', `%${q}%`);
      });
    }

    // фильтр по категориям (jsonb-массив строк; условие: есть любая из выбранных)
    if (cats.length) {
      query = query.where((b) => {
        for (const c of cats) {
          b.orWhereRaw('categories ? ?', [c]);
        }
      });
    }

    // фильтр по цене
    if (minPrice !== undefined && minPrice !== '') {
      query = query.andWhere('price', '>=', Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      query = query.andWhere('price', '<=', Number(maxPrice));
    }

    // фильтр по material/printTech (в jsonb attributes)
    if (material) {
      query = query.andWhereRaw("LOWER(COALESCE(attributes->>'material','')) = LOWER(?)", [material]);
    }
    if (printTech) {
      query = query.andWhereRaw("LOWER(COALESCE(attributes->>'printTech','')) = LOWER(?)", [printTech]);
    }

    // сортировка
    if (sort === 'price_asc') {
      query = query.orderBy('price', 'asc').orderBy('id', 'desc');
    } else if (sort === 'price_desc') {
      query = query.orderBy('price', 'desc').orderBy('id', 'desc');
    } else if (sort === 'new') {
      query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');
    } else {
      // popular (пока равносильно "новые сначала")
      query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');
    }

    // пагинация по cursor (замечание: корректна для сортировки по created_at/id)
    query = query.limit(limit + 1);
    if (cursor && (sort === 'popular' || sort === 'new')) {
      // keyset по id (можно расширить по created_at)
      query = query.where('id', '<', cursor.id);
    }

    const rows = await query;

    // подтягиваем галереи
    const ids = rows.slice(0, limit).map((r: any) => r.id);
    let imagesById: Record<string, any[]> = {};
    if (ids.length) {
      const imgs = await db('product_images')
        .select('*')
        .whereIn('product_id', ids)
        .orderBy([
          { column: 'product_id', order: 'asc' },
          { column: 'sort_order', order: 'asc' },
          { column: 'created_at', order: 'asc' }
        ]);
      for (const im of imgs) {
        (imagesById[im.product_id] ||= []).push(im);
      }
    }

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((p: any) => {
      const raw = imagesById[p.id] || [];
      const gallery = raw.map((im: any) => {
        const guessThumbKey =
          im.thumb_key ??
          im.key?.replace('/original/', '/thumb/')?.replace(/\.(jpe?g|png)$/i, '.webp');

        return {
          ...im,
          url: im.url ?? toStaticUrl(im.key),
          thumb_url: im.thumb_url ?? toStaticUrl(guessThumbKey),
        };
      });
      const primary = gallery.find(g => g.role === 'primary') ?? gallery[0];

      return {
        ...p,
        categories: p.categories ?? [],
        attributes: p.attributes ?? {},
        image_url: primary?.thumb_url ?? p.image_url ?? null,
        images: gallery
      };
    });

    const nextCursor = hasMore && items.length ? encodeCursor({ id: items[items.length - 1].id }) : null;
    return reply.send({ items, nextCursor });
  });

  // get by id
  app.get('/api/products/:id', async (req, reply) => {
    const { id } = req.params as any;
    const row = await db('products').where({ id }).first();
    if (!row) return reply.code(404).send({ message: 'Not found' });

    const raw = await db('product_images')
      .where({ product_id: id })
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'created_at', order: 'asc' }
      ]);

    // проклейка ссылок
    const gallery = glueGallery(raw);
    const primary = gallery.find(g => g.role === 'primary') ?? gallery[0];

    return reply.send({
      ...row,
      categories: row.categories ?? [],
      attributes: row.attributes ?? {},
      image_url: primary?.thumb_url ?? row.image_url ?? null,
      images: gallery
    });
  });

  // create
  app.post('/api/products', { preHandler: requireAdmin }, async (req, reply) => {
    const body = ProductCreate.parse(req.body);
    const { images = [], ...product } = body;
    const [row] = await db('products').insert(product).returning('*');
    if (images.length) {
      const values = images.map((im: any, idx: number) => ({
        product_id: row.id,
        url: im.url,
        thumb_url: im.thumbUrl ?? null,
        alt: im.alt ?? null,
        sort_order: Number.isFinite(im.sort_order as number) ? (im.sort_order as number) : idx,
      }));
      await db('product_images').insert(values);
    }
    const raw = await db('product_images')
      .where({ product_id: row.id })
      .orderBy(['sort_order', 'created_at']);

    const gallery = glueGallery(raw);
    const primary = gallery.find(g => g.role === 'primary') ?? gallery[0];

    return reply
      .code(201)
      .send({
        ...row,
        categories: row.categories ?? [],
        attributes: row.attributes ?? {},
        image_url: primary?.thumb_url ?? row.image_url ?? null,
        images: gallery
      });
  });

  // Добавить изображения к товару
  app.post('/api/products/:id/images', async (req, reply) => {
    const { id } = req.params as any;
    const imgs = z.array(ImageInput).parse(req.body);
    const values = imgs.map((im, idx) => ({
      product_id: id,
      url: im.url,
      thumb_url: im.thumbUrl ?? null,
      alt: im.alt ?? null,
      sort_order: Number.isFinite(im.sort_order as number) ? (im.sort_order as number) : idx,
    }));
    await db('product_images').insert(values);

    const raw = await db('product_images').where({ product_id: id }).orderBy(['sort_order', 'created_at']);
    const gallery = glueGallery(raw);

    return reply.code(201).send({ items: gallery });
  });

  // Удалить одно изображение
  app.delete('/api/products/:id/images/:imageId', async (req, reply) => {
    const { id, imageId } = req.params as any;
    const res = await db('product_images').where({ id: imageId, product_id: id }).del();
    if (!res) return reply.code(404).send({ message: 'Not found' });
    return reply.code(204).send();
  });

  // update
  app.patch('/api/products/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const patch = ProductPatch.parse(req.body);
    const [row] = await db('products').where({ id }).update({ ...patch, updated_at: db.fn.now() }).returning('*');
    if (!row) return reply.code(404).send({ message: 'Not found' });
    return reply.send(row);
  });

  // delete
  app.delete('/api/products/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const res = await db('products').where({ id }).del();
    if (!res) return reply.code(404).send({ message: 'Not found' });
    return reply.code(204).send();
  });
}
