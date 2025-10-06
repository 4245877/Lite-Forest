// services/ingester/src/pricing.ts
import fs from 'node:fs';
import path from 'node:path';
// Типы для js-yaml могут отсутствовать у вас локально — подавим предупреждение TS.
// Убедитесь, что пакет установлен: `npm i js-yaml` (и по желанию `-D @types/js-yaml`).
// @ts-ignore
import * as yaml from 'js-yaml';   // затем yaml.load(...)


export type PricingConfig = {
  currency: string;
  energy: { kwh_rate: number; printer_power_w: number };
  labor: { hourly_rate: number; prepare_min: number; postprocess_min_default: number };
  machine: { hourly_rate: number };
  materials: Record<string, number>;
  overhead: { percent_of_cost: number };
  profit: { target_margin_pct: number };
  fees: {
    acquiring_pct: number;
    marketplace_pct: number;
    single_tax_pct: number;
    war_tax_pct: number;
    vat_pct: number;
    include_vat_in_price: boolean;
  };
  rounding: { strategy: 'none' | 'up_1' | 'up_5' | 'nearest_9'; min_price: number };
};

export type ProductInput = {
  sku: string;
  currency?: string;

  // manual price (если задана вручную)
  price?: number | string | null;
  price_method?: 'manual' | 'cost_plus';

  // Параметры для cost_plus:
  material_type?: 'PLA' | 'PETG' | 'TPU' | 'RESIN' | string;
  material_g?: number | string | null;
  material_ml?: number | string | null; // если считаем смолу в мл
  print_time_min?: number | string | null;
  postprocess_min?: number | string | null;
  packaging_cost?: number | string | null;

  // Доставка: включена ли в цену и, если да, возможная фиксированная стоимость
  shipping_included?: boolean | string | null;
  shipping_cost?: number | string | null;

  target_margin_pct?: number | string | null;
};

export type PricingBreakdown = {
  currency: string;

  material_cost: number;
  energy_cost: number;
  machine_cost: number;
  labor_cost: number;
  postprocess_cost: number;
  packaging_cost: number;
  shipping_cost: number;

  overhead_cost: number;
  cost_total: number; // Себестоимость

  target_profit: number; // Целевая прибыль
  base_before_fees: number; // База для налогов/комиссий

  fees: {
    acquiring: number;
    marketplace: number;
    single_tax: number;
    war_tax: number;
    vat: number;
    total_pct: number;
  };

  price_before_round: number;
  price_final: number;
  method: 'manual' | 'cost_plus';
};

function roundPrice(v: number, strategy: PricingConfig['rounding']['strategy']): number {
  if (strategy === 'none') return Math.round(v * 100) / 100;
  if (strategy === 'up_1') return Math.ceil(v);
  if (strategy === 'up_5') return Math.ceil(v / 5) * 5;
  if (strategy === 'nearest_9') {
    const up = Math.ceil(v);
    return up % 10 === 0 ? up - 1 : up; // 199, 249, 999, ...
  }
  return Math.round(v);
}

export function loadPricingConfig(configPath: string): PricingConfig {
  const full = path.resolve(configPath);
  const raw = fs.readFileSync(full, 'utf8');
  const cfg = yaml.load(raw) as PricingConfig;
  return cfg;
}

export function computeCostPlus(cfg: PricingConfig, p: ProductInput): PricingBreakdown {
  const currency = p.currency || cfg.currency || 'UAH';

  // --- Материал ---
  const matType = String(p.material_type || 'PLA').toUpperCase();
  const perKg = cfg.materials[`${matType}_kg`];
  const perL = cfg.materials[`${matType}_L`];

  let material_cost = 0;
  const gRaw = Number(p.material_g ?? 0);
  const mlRaw = Number(p.material_ml ?? 0);
  const g = Number.isFinite(gRaw) ? gRaw : 0;
  const ml = Number.isFinite(mlRaw) ? mlRaw : 0;

  if (g > 0 && typeof perKg === 'number') {
    material_cost = (g / 1000) * perKg;
  } else if (ml > 0 && typeof perL === 'number') {
    material_cost = (ml / 1000) * perL;
  } else {
    material_cost = 0;
  }

  // --- Энергия ---
  const timeMinRaw = Number(p.print_time_min ?? 0);
  const timeMin = Number.isFinite(timeMinRaw) ? timeMinRaw : 0;
  const kwh = (cfg.energy.printer_power_w / 1000) * (timeMin / 60);
  const energy_cost = kwh * cfg.energy.kwh_rate;

  // --- Машина (амортизация) ---
  const machine_cost = cfg.machine.hourly_rate * (timeMin / 60);

  // --- Труд ---
  const prepMin = cfg.labor.prepare_min;
  const postMinRaw = Number(p.postprocess_min ?? cfg.labor.postprocess_min_default);
  const postMin = Number.isFinite(postMinRaw) ? postMinRaw : cfg.labor.postprocess_min_default;
  const labor_time_min = prepMin + postMin;
  const labor_cost = cfg.labor.hourly_rate * (labor_time_min / 60);

  // Если хочешь отделить постобработку как отдельную статью — можно перенести часть labor сюда
  const postprocess_cost = 0;

  // --- Прочее ---
  const packaging_cost_raw = Number(p.packaging_cost ?? 0);
  const packaging_cost = Number.isFinite(packaging_cost_raw) ? packaging_cost_raw : 0;

  const shippingIncluded =
    (typeof p.shipping_included === 'string'
      ? p.shipping_included.toLowerCase().trim() === 'true'
      : !!p.shipping_included) || false;

  const shippingCostRaw = Number(p.shipping_cost ?? 0);
  const shipping_cost =
    shippingIncluded && Number.isFinite(shippingCostRaw) ? Math.max(0, shippingCostRaw) : 0;

  // --- Себестоимость ---
  const cost_base =
    material_cost +
    energy_cost +
    machine_cost +
    labor_cost +
    postprocess_cost +
    packaging_cost +
    shipping_cost;

  const overhead_cost = cost_base * cfg.overhead.percent_of_cost;
  const cost_total = cost_base + overhead_cost;

  // --- Целевая прибыль ---
  const marginRaw = Number(p.target_margin_pct ?? cfg.profit.target_margin_pct);
  const margin = Number.isFinite(marginRaw) ? marginRaw : cfg.profit.target_margin_pct;
  const target_profit = cost_total * margin;
  const base_before_fees = cost_total + target_profit;

  // --- Комиссии/налоги, включённые в цену ---
  const pct =
    cfg.fees.acquiring_pct +
    cfg.fees.marketplace_pct +
    cfg.fees.single_tax_pct +
    cfg.fees.war_tax_pct +
    (cfg.fees.include_vat_in_price ? cfg.fees.vat_pct : 0);

  // Цена к покупателю: base / (1 - Σ%)
  const denom = Math.max(0.0001, 1 - pct);
  const price_before_round = base_before_fees / denom;

  const price_final_raw = roundPrice(price_before_round, cfg.rounding.strategy);
  const price_final = Math.max(price_final_raw, cfg.rounding.min_price || 0);

  return {
    currency,
    material_cost,
    energy_cost,
    machine_cost,
    labor_cost,
    postprocess_cost,
    packaging_cost,
    shipping_cost,
    overhead_cost,
    cost_total,
    target_profit,
    base_before_fees,
    fees: {
      acquiring: cfg.fees.acquiring_pct,
      marketplace: cfg.fees.marketplace_pct,
      single_tax: cfg.fees.single_tax_pct,
      war_tax: cfg.fees.war_tax_pct,
      vat: cfg.fees.include_vat_in_price ? cfg.fees.vat_pct : 0,
      total_pct: pct,
    },
    price_before_round,
    price_final,
    method: 'cost_plus',
  };
}
