// services/ingester/src/queue.worker.ts
import { Worker, JobsOptions } from "bullmq";
import { connection, mediaQueue } from "./queue.js";
import type { ImportCsvJob, ImportUrlJob, MediaJob } from "./queue.js";

// Импортируем модуль как namespace, т.к. enqueueMediaForBatch может отсутствовать в экспортах.
// Так мы избежим ошибки TS2305 и всё равно сможем корректно вызвать функцию, если она есть.
import * as importers from "./workers/importers.js";
const {
  readCsvToStaging,
  mergeFromStaging,
  createOrUpdateFromUrl,
} = importers as {
  readCsvToStaging: (csvPath: string, batchId: string) => Promise<void>;
  mergeFromStaging: (batchId: string) => Promise<void>;
  createOrUpdateFromUrl: (
    data: ImportUrlJob
  ) => Promise<{ productId: string; imageUrl?: string; modelUrl?: string; sku?: string }>;
};

// Попытаемся получить enqueueMediaForBatch, если он экспортируется модулем.
// Если нет — залогируем предупреждение и продолжим работу (после мерджа CSV задача будет пропущена).
const enqueueMediaForBatch =
  (importers as any).enqueueMediaForBatch as
    | ((batchId: string) => Promise<void>)
    | undefined;

import { fetchAndAttachAsset } from "./workers/media.js";
import knex from "./db.js";
import { env } from "./env.js";

// сразу после импортов (перед new Worker(...)):
console.log(`[ingester] Import worker started`);
console.log(`[ingester] Redis: ${env.redisUrl}`);
console.log(
  `[ingester] DB: ${env.databaseUrl?.replace(/:\/\/.*@/, "://***:***@")}`
);

process.on("unhandledRejection", (e) => {
  console.error("[ingester] UnhandledRejection:", e);
});
process.on("uncaughtException", (e) => {
  console.error("[ingester] UncaughtException:", e);
});

const defaultOpts: JobsOptions = { removeOnComplete: true, removeOnFail: false };

// type guard, чтобы TS знал какой это payload
function isUrlJob(data: ImportCsvJob | ImportUrlJob): data is ImportUrlJob {
  return (data as any)?.sourceUrl !== undefined;
}

// ВАЖНО: дженерик — union из ДВУХ типов
const importWorker = new Worker<ImportCsvJob | ImportUrlJob>(
  "import",
  async (job) => {
    if (job.name === "csv") {
      const { batchId } = job.data as { batchId: string };
      console.log(`[import] csv batch ${batchId} → read to staging`);
      await readCsvToStaging((job.data as any).csvPath, batchId);

      console.log(`[import] csv batch ${batchId} → merge`);
      await mergeFromStaging(batchId);

      console.log(`[import] csv batch ${batchId} → enqueue media`);
      if (enqueueMediaForBatch) {
        await enqueueMediaForBatch(batchId);
        console.log(`[import] csv batch ${batchId} → enqueue media: done`);
      } else {
        console.warn(
          `[import] csv batch ${batchId} → enqueue media: skipped (enqueueMediaForBatch is not exported from ./workers/importers.js)`
        );
      }

      return;
    }

    if (job.name === "url") {
      const data = job.data as ImportCsvJob | ImportUrlJob;
      if (!isUrlJob(data)) {
        throw new Error("Invalid payload for url job: sourceUrl is missing");
      }

      const { productId, imageUrl, modelUrl, sku } =
        await createOrUpdateFromUrl(data);

      if (imageUrl) {
        await mediaQueue.add(
          "media",
          { productId, url: imageUrl, role: "main_image", sku: sku! },
          defaultOpts
        );
      }

      if (modelUrl) {
        await mediaQueue.add(
          "media",
          { productId, url: modelUrl, role: "model_primary", sku: sku! },
          defaultOpts
        );
      }

      return;
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection }
);

importWorker.on("active", (job) =>
  console.log(`[import] active ${job.id} ${job.name}`)
);
importWorker.on("completed", (job) =>
  console.log(`[import] done ${job.id} ${job.name}`)
);
importWorker.on("failed", (job, err) =>
  console.error(`[import] failed ${job?.id} ${job?.name}`, err)
);

const mediaWorker = new Worker<MediaJob>(
  "media",
  async (job) => {
    await fetchAndAttachAsset(job.data);
  },
  { connection }
);

mediaWorker.on("active", (job) =>
  console.log(`[media] active ${job.id} ${job.name}`)
);
mediaWorker.on("completed", (job) =>
  console.log(`[media] done ${job.id} ${job.name}`)
);
mediaWorker.on("failed", (job, err) =>
  console.error(`[media] failed ${job?.id} ${job?.name}`, err)
);

async function shutdown() {
  console.log("[ingester] Shutting down gracefully…");
  try {
    await knex.destroy();
  } catch (e) {
    console.error("[ingester] knex destroy error:", e);
  }
  try {
    await connection.quit();
  } catch (e) {
    console.error("[ingester] redis quit error:", e);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
