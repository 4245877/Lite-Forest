import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { importQueue } from "./queue.js";

import { randomUUID } from "crypto";
import type { ArgumentsCamelCase } from "yargs";

// === Новое: пересчёт цен ===
import path from "node:path";
import { loadPricingConfig, computeCostPlus } from "./pricing.js";
import db from "./db.js";

type ProductRow = {
  id: string | number;
  sku: string;
  currency?: string | null;
  price?: number | null;
  attributes?: unknown;
  pricing_method?: string | null;
};

async function repriceAll() {
  const cfg = loadPricingConfig(
    path.join(process.cwd(), "services/ingester/data/pricing.yml")
  );

  const products: ProductRow[] = await db("products").select("*");

  for (const p of products) {
    if (p.pricing_method === "manual") continue;

    // attributes могут быть JSON-строкой, объектом или null
    let attrs: Record<string, any> = {};
    if (typeof p.attributes === "string") {
      try {
        attrs = JSON.parse(p.attributes);
      } catch {
        attrs = {};
      }
    } else if (typeof p.attributes === "object" && p.attributes !== null) {
      attrs = p.attributes as Record<string, any>;
    }

    const input = {
      sku: p.sku,
      currency: p.currency || cfg.currency,
      material_type: attrs.material_type || "PLA",
      material_g: attrs.material_g || 0,
      print_time_min: attrs.print_time_min || 0,
      postprocess_min: attrs.postprocess_min || 0,
      packaging_cost: attrs.packaging_cost || 0,
      shipping_included: !!attrs.shipping_included,
      target_margin_pct: attrs.target_margin_pct,
    };

    const calc = computeCostPlus(cfg, input);

    await db("products")
      .where({ id: p.id })
      .update({ price: calc.price_final, pricing: JSON.stringify(calc) });
  }

  console.log("Repriced all cost_plus products.");
}

// === CLI ===
yargs(hideBin(process.argv))
  .command(
    "csv <path>",
    "Импорт CSV → staging",
    (y) => y.positional("path", { type: "string", demandOption: true }),
    async (argv: ArgumentsCamelCase<{ path: string }>) => {
      const batchId = randomUUID();
      await importQueue.add(
        "csv",
        { csvPath: argv.path, batchId },
        { removeOnComplete: true, removeOnFail: false }
      );
      console.log("Queued CSV import, batch:", batchId);
    }
  )
  .command(
    "url <url>",
    "Импорт одного товара из URL",
    (y) => y.positional("url", { type: "string", demandOption: true }),
    async (argv: ArgumentsCamelCase<{ url: string }>) => {
      await importQueue.add(
        "url",
        { sourceUrl: argv.url },
        { removeOnComplete: true, removeOnFail: false }
      );
      console.log("Queued URL import:", argv.url);
    }
  )
  .command(
    ["reprice", "пересчитать-цены"],
    "Пересчитать цены для всех товаров с pricing_method ≠ 'manual'",
    () => {},
    async () => {
      try {
        await repriceAll();
      } catch (e) {
        console.error(e);
        process.exitCode = 1;
      }
    }
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();
