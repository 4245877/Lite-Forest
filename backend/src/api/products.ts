import { FastifyInstance } from 'fastify';
import { getKnex } from '../db/knex';
import { encodeCursor, decodeCursor } from '../utils/cursor';
import { env } from '../config/env';
import type { ProductDTO, MediaVariantDTO } from '../models/dto';
import { toTsQuery, normalizeAttrFilter } from '../services/search';

export async function productsRoutes(app: FastifyInstance) {
  // GET /api/v1/products
  app.get('/api/v1/products', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          cursor: { type: 'string' },
          category_id: { type: 'integer' },
          include_descendants: { type: 'boolean', default: false },
          brand: { type: 'string' },
          q: { type: 'string' },
          min_price: { type: 'integer' },
          max_price: { type: 'integer' },
          sort: { type: 'string', enum: ['relevance','newest','price_asc','price_desc'], default: 'newest' },
          attr: { type: 'string', description: 'JSON string like {\"color\":\"red\"}' }
        }
      }
    }
  }, async (req, reply) => {
    const knex = getKnex();
    const {
      limit = 20,
      cursor,
      category_id,
      include_descendants = false,
      brand,
      q,
      min_price,
      max_price,
      sort = 'newest',
      attr
    } = req.query as any;

    type CursorNewest = { created_at: string; id: number };
    type CursorPrice = { price_cents: number; id: number };
    type CursorRank = { rank: number; id: number };

    const base = knex('products').select(
      'id','sku','title','short_description','description','price_cents','currency','category_id','brand','attributes','created_at','updated_at'
    );

    // category + optionally include descendants (recursive CTE)
    if (category_id) {
      if (include_descendants) {
        // where category_id IN (WITH RECURSIVE c AS (...) SELECT id FROM c)
        base.whereIn('category_id', function () {
          // `this` is a query builder inside whereIn
          // build the WITH RECURSIVE c AS (...) select id from c
          this.withRecursive('c', (qb) => {
            // base row
            qb.select('*').from('categories').where('id', category_id)
              .unionAll(function () {
                this.select('child.*').from({ child: 'categories' })
                  .join({ parent: 'c' }, 'child.parent_id', 'parent.id');
              });
          }).select('id').from('c');
        });
      } else {
        base.where('category_id', category_id);
      }
    }

    if (brand) base.where('brand', brand);
    if (typeof min_price === 'number') base.where('price_cents', '>=', min_price);
    if (typeof max_price === 'number') base.where('price_cents', '<=', max_price);

    // фильтр по атрибутам JSONB
    const attrFilter = normalizeAttrFilter(attr);
    if (attrFilter && Object.keys(attrFilter).length) {
      base.whereRaw('attributes @> ?', [JSON.stringify(attrFilter)]);
    }

    const limitPlus = Math.min(Number(limit) || 20, 100) + 1; // для nextCursor

    // Поиск: используем toTsQuery для формирования корректного to_tsquery
    if (q && sort === 'relevance') {
      const tq = toTsQuery(q);
      base.select(knex.raw("ts_rank(search_tsv, to_tsquery('simple', ?)) as rank", [tq]));
      base.whereRaw("search_tsv @@ to_tsquery('simple', ?)", [tq]);
    } else if (q) {
      base.whereRaw("search_tsv @@ plainto_tsquery('simple', ?)", [q])
          .orWhereILike('title', `%${q}%`); // fallback по триграммам/ilike
    }

    // Ordering + keyset pagination
    if (sort === 'newest') {
      base.orderBy([{ column: 'created_at', order: 'desc' }, { column: 'id', order: 'desc' }]);
      const c = decodeCursor<CursorNewest>(cursor);
      if (c) base.whereRaw('(created_at, id) < (?, ?)', [c.created_at, c.id]);
    } else if (sort === 'price_asc') {
      base.orderBy([{ column: 'price_cents', order: 'asc' }, { column: 'id', order: 'asc' }]);
      const c = decodeCursor<CursorPrice>(cursor);
      if (c) base.whereRaw('(price_cents, id) > (?, ?)', [c.price_cents, c.id]);
    } else if (sort === 'price_desc') {
      base.orderBy([{ column: 'price_cents', order: 'desc' }, { column: 'id', order: 'desc' }]);
      const c = decodeCursor<CursorPrice>(cursor);
      if (c) base.whereRaw('(price_cents, id) < (?, ?)', [c.price_cents, c.id]);
    } else if (sort === 'relevance') {
      base.orderBy([{ column: 'rank', order: 'desc' }, { column: 'id', order: 'desc' }]);
      const c = decodeCursor<CursorRank>(cursor);
      if (c) base.whereRaw('(rank, id) < (?, ?)', [c.rank, c.id]);
    }

    base.limit(limitPlus);

    const rows = await base;
    const hasMore = rows.length === limitPlus;
    const items = rows.slice(0, limitPlus - 1) as ProductDTO[];

    let nextCursor: string | undefined;
    if (hasMore) {
      const last = items[items.length - 1] as any;
      if (sort === 'newest') nextCursor = encodeCursor({ created_at: last.created_at, id: last.id });
      if (sort === 'price_asc' || sort === 'price_desc') nextCursor = encodeCursor({ price_cents: last.price_cents, id: last.id });
      if (sort === 'relevance') nextCursor = encodeCursor({ rank: (last as any).rank, id: last.id });
    }

    reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return { items, nextCursor };
  });

  // GET /api/v1/products/:id
  app.get('/api/v1/products/:id', {
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id']
      }
    }
  }, async (req, reply) => {
    const knex = getKnex();
    const { id } = req.params as any;

    const product = await knex('products')
      .select('id','sku','title','short_description','description','price_cents','currency','category_id','brand','attributes','created_at','updated_at')
      .where({ id })
      .first();

    if (!product) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Product not found' } });

    const mediaRows = await knex('product_media as pm')
      .leftJoin('media as m', 'pm.media_id', 'm.id')
      .select('m.id as id', 'pm.role as role', 'm.variants as variants', 'm.s3_key as s3_key')
      .where('pm.product_id', id)
      .orderBy('pm.position', 'asc');

    const media: MediaVariantDTO[] = [];
    for (const r of mediaRows) {
      const baseUrl = env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '') || '';
      const variants = Array.isArray(r.variants) ? r.variants : [];
      if (variants.length) {
        for (const v of variants) {
          media.push({
            id: r.id,
            role: r.role,
            type: v.type,
            width: v.width,
            height: v.height,
            url: v.url || (baseUrl && r.s3_key ? `${baseUrl}/${r.s3_key}` : '')
          });
        }
      } else if (r.s3_key) {
        media.push({ id: r.id, role: r.role, type: 'large', url: baseUrl ? `${baseUrl}/${r.s3_key}` : '' });
      }
    }

    return { ...product, media } as ProductDTO & { media: MediaVariantDTO[] };
  });
}
