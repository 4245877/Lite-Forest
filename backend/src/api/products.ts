import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';


const ProductCreate = z.object({
sku: z.string().min(1),
name: z.string().min(1),
description: z.string().optional(),
price: z.coerce.number().nonnegative(),
currency: z.string().default('UAH'),
stock: z.coerce.number().int().nonnegative().default(0),
image_url: z.string().url().optional()
});


const ProductPatch = ProductCreate.partial();


export default async function routes(app: FastifyInstance) {
// list with cursor pagination & search
app.get('/api/products', async (req, reply) => {
const q = (req.query as any).q as string | undefined;
const limit = Number((req.query as any).limit ?? 20);
const cursor = decodeCursor<{ id: string }>((req.query as any).cursor);


let query = db('products').select('*').orderBy('created_at', 'desc').orderBy('id', 'desc').limit(limit + 1);
if (cursor) {
// keyset по id (дополнительно по created_at можно расширить)
query = query.where('id', '<', cursor.id);
}
if (q) {
query = query.where((b) => {
b.whereILike('name', `%${q}%`).orWhereILike('sku', `%${q}%`);
});
}


const rows = await query;
const hasMore = rows.length > limit;
const items = rows.slice(0, limit);
const nextCursor = hasMore ? encodeCursor({ id: items[items.length - 1].id }) : null;
return reply.send({ items, nextCursor });
});


// get by id
app.get('/api/products/:id', async (req, reply) => {
const { id } = req.params as any;
const row = await db('products').where({ id }).first();
if (!row) return reply.code(404).send({ message: 'Not found' });
return row;
});


// create
app.post('/api/products', async (req, reply) => {
const body = ProductCreate.parse(req.body);
const [row] = await db('products').insert(body).returning('*');
return reply.code(201).send(row);
});


// update
app.patch('/api/products/:id', async (req, reply) => {
const { id } = req.params as any;
const patch = ProductPatch.parse(req.body);
const [row] = await db('products').where({ id }).update({ ...patch, updated_at: db.fn.now() }).returning('*');
if (!row) return reply.code(404).send({ message: 'Not found' });
return row;
});


// delete
app.delete('/api/products/:id', async (req, reply) => {
const { id } = req.params as any;
const res = await db('products').where({ id }).del();
if (!res) return reply.code(404).send({ message: 'Not found' });
return reply.code(204).send();
});
}