// backend/src/worker.ts
import { Worker } from 'bullmq';
import { redis } from './config/redis';
import { processImage } from './jobs/imageProcessing';
import { processBulkImport } from './jobs/bulkImport';
import { getKnex } from './db/knex';
// убедимся, что есть подключение к БД (для обработчиков)
getKnex();
const imageWorker = new Worker('image-processing', async (job) => {
    // processImage может возвращать любое значение или void — аннотируем job как Job
    return await processImage(job);
}, {
    connection: redis,
});
imageWorker.on('completed', (job, returnValue) => {
    console.log(`image-processing: job ${job.id} completed`);
    // при необходимости можно использовать returnValue
});
imageWorker.on('failed', (job, err) => {
    console.error(`image-processing: job ${job?.id} failed:`, err);
});
const importWorker = new Worker('bulk-imports', async (job) => {
    return await processBulkImport(job);
}, {
    connection: redis,
});
importWorker.on('completed', (job, returnValue) => {
    console.log(`bulk-imports: job ${job.id} completed`);
});
importWorker.on('failed', (job, err) => {
    console.error(`bulk-imports: job ${job?.id} failed:`, err);
});
console.log('Workers started: image-processing, bulk-imports');
// graceful shutdown
async function shutdown() {
    console.log('Shutting down workers...');
    try {
        await Promise.all([imageWorker.close(), importWorker.close()]);
        console.log('Workers stopped.');
        process.exit(0);
    }
    catch (err) {
        console.error('Error while shutting down workers:', err);
        process.exit(1);
    }
}
// При получении сигнала — запускаем shutdown (void чтобы избежать Promise-предупреждений)
process.on('SIGINT', () => {
    void shutdown();
});
process.on('SIGTERM', () => {
    void shutdown();
});
