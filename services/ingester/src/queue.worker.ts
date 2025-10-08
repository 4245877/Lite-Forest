// services/ingester/src/queue.worker.ts
import { Worker } from 'bullmq';
import { connection, QUEUE_IMPORT, QUEUE_MEDIA, type ImportCsvJob } from './queue.js';
import { env } from './env.js';
import { readCsvToStaging, mergeStagingBatch } from './workers/importers.js';
import processMediaJob from './workers/media.js'; // ← фикс: default-импорт

function maskDbUrl(u?: string) {
  if (!u) return '';
  return u.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
}

console.log('[ingester] Import worker started');
console.log('[ingester] Redis:', env.redisUrl || 'redis://127.0.0.1:6379/0');
console.log('[ingester] DB:', maskDbUrl(env.databaseUrl));

// --- ДЕРЖИМ ССЫЛКИ НА ВОРКЕРЫ ---
const importWorker = new Worker<ImportCsvJob>(
  QUEUE_IMPORT,
  async (job) => {
    if (job.name === 'csv') {
      const { csvPath, batchId } = job.data as { csvPath: string; batchId: string };
      console.log(`[import] csv batch ${batchId} → read to staging`);
      await readCsvToStaging(csvPath, batchId);

      console.log(`[import] csv batch ${batchId} → merge`);
      await mergeStagingBatch(batchId);

      console.log(`[import] done ${batchId}`);
      return;
    }
    console.warn(`[import] unknown job name: ${job.name}`);
  },
  { connection, autorun: true, concurrency: 2 }
);

type MediaJobData = { sku: string; preferUrl?: string | null };

const mediaWorker = new Worker<MediaJobData>(
  QUEUE_MEDIA,
  async (job) => {
    if (job.name === 'sync-media') {
      return processMediaJob(job); // ← вызываем процессор из media.ts
    }
    console.warn(`[media] unknown job name: ${job.name}`);
  },
  { connection, autorun: true, concurrency: 2 }
);

// --- ПОДРОБНЫЕ СОБЫТИЯ/ЛОГИ ---
for (const [name, w] of [['import', importWorker] as const, ['media', mediaWorker] as const]) {
  w.on('completed', (job) => {
    console.log(`[${name}] completed ${job.name} (id=${job.id})`);
  });
  w.on('failed', (job, err) => {
    console.error(`[${name}] FAILED ${job?.name} (id=${job?.id}): ${err?.message}`);
    if (err?.stack) console.error(err.stack);
  });
  w.on('error', (err) => {
    console.error(`[${name}] worker error: ${err?.message}`);
    if (err?.stack) console.error(err.stack);
  });
}

// --- АККУРАТНОЕ ЗАВЕРШЕНИЕ ПО CTRL+C ---
async function shutdown(code = 0) {
  console.log('[ingester] shutting down…');
  try {
    await importWorker.close();
    await mediaWorker.close();
    await connection.quit();
  } finally {
    process.exit(code);
  }
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

// --- ЯКОРЬ: не даём процессу завершиться ---
setInterval(() => {}, 1 << 30);
