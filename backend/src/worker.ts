import { Worker } from 'bullmq';
import { redis } from './core/redis.js';
import { logger } from './core/logger.js';
import { db } from './db/knex.js';


if (!redis) {
logger.warn('REDIS_URL not set — worker will not start.');
process.exit(0);
}


const worker = new Worker('jobs', async (job) => {
if (job.name === 'reindex') {
// Здесь может быть логика пересборки поискового индекса
return { ok: true };
}


if (job.name === 'import:csv') {
const text: string = job.data.content as string;
const lines = text.split(/\r?\n/).filter(Boolean);
// Простейший CSV: sku,name,description,price,currency,stock,image_url
const rows = lines.slice(1).map((ln) => ln.split(',')).filter(r => r.length >= 6);
for (const r of rows) {
const [sku, name, description, price, currency, stock, image_url] = r;
await db('products').insert({
sku, name, description,
price: Number(price ?? 0), currency: currency ?? 'UAH',
stock: Number(stock ?? 0), image_url
}).onConflict('sku').merge();
}
return { imported: rows.length };
}


return { skipped: true };
}, { connection: redis });


worker.on('completed', (j) => logger.info({ id: j.id }, 'job completed'));
worker.on('failed', (j, err) => logger.error({ id: j?.id, err }, 'job failed'));