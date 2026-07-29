// Идентичность строк корзины (чистая логика, без React — покрыта node:test).
//
// id строки = <товар:вариант>[#<сигнатура набора деталей>] (собирается в
// ProductDetailPage). Сигнатура — база36-хеш выбранных деталей, поэтому '#' в
// ней быть не может и базу всегда можно отделить.
//
// БАГ, который здесь закрыт: id фиксировался при добавлении и НЕ пересчитывался
// при смене набора деталей в корзине. Строка с набором B продолжала жить под id
// набора A, поэтому повторное добавление A попадало в неё же — в заказ уходило
// B×2 вместо A + B.

// Расширение .js обязательно: этот модуль импортируют и Vite, и node:test
// (в ESM-режиме Node не достраивает расширение сам).
import {
  normalizeSelectionKeys,
  previewPriceForSelection,
  selectionSignature,
} from './productModels.js';

export const clampQty = (qty) => {
  const n = Number(qty);
  return Math.max(1, Number.isFinite(n) ? n : 1);
};

export const baseLineIdOf = (id) => String(id ?? '').split('#')[0];

export const lineIdFor = (baseLineId, models, selectedKeys) => {
  const sig = selectionSignature(models, selectedKeys);
  return sig ? `${baseLineId}#${sig}` : baseLineId;
};

/**
 * Схлопывает строки с одинаковым id, суммируя количество. Нужен при загрузке
 * корзины, записанной прежней (сломанной) версией: после пересчёта id две строки
 * могут честно совпасть — значит это одна позиция, а не две с одним id.
 */
export function mergeSameLines(items) {
  const out = [];
  const byId = new Map();

  for (const it of items) {
    const seen = byId.get(it.id);
    if (seen) {
      seen.qty = clampQty(seen.qty + it.qty);
      continue;
    }
    const copy = { ...it };
    byId.set(copy.id, copy);
    out.push(copy);
  }

  return out;
}

/**
 * Меняет набор деталей строки: пересчитывает выбор, цену И id строки.
 * Если строка с таким набором уже есть — сливает их в одну позицию.
 * Возвращает НОВЫЙ массив (или исходный, если менять нечего).
 */
export function applySelectionToLines(items, id, selectedKeys) {
  const i = items.findIndex((it) => it.id === id);
  if (i < 0) return items;

  const it = items[i];
  const models = Array.isArray(it.models) ? it.models : [];
  if (!models.length) return items;

  const keys = normalizeSelectionKeys(models, selectedKeys);
  if (!keys.length) return items; // минимум одна деталь должна остаться

  const base = Number(it.base_price ?? it.price) || 0;
  const baseLineId = it.base_line_id ?? baseLineIdOf(it.id);
  const nextId = lineIdFor(baseLineId, models, keys);

  const updated = {
    ...it,
    id: nextId,
    base_line_id: baseLineId,
    selected_model_keys: keys,
    price: previewPriceForSelection(models, keys, base),
  };

  const twinIdx = items.findIndex((x, idx) => idx !== i && x.id === nextId);
  if (twinIdx >= 0) {
    return items
      .map((x, idx) => (idx === twinIdx ? { ...x, qty: clampQty(x.qty + it.qty) } : x))
      .filter((_, idx) => idx !== i);
  }

  return items.map((x, idx) => (idx === i ? updated : x));
}
