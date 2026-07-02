// Stable identity + pricing helpers for product "parts" (model files) selection.
//
// A product может состоять из нескольких деталей (product.models). При покупке
// пользователь выбирает, какие из них печатать. Этот модуль — единый источник
// правды для фронта: как назвать деталь ключом, как посчитать предварительную
// цену выбора и как отличить два разных набора деталей.
//
// Ключ выбора (то, что уходит на бэкенд в selected_model_keys) — зеркалит
// core/productParts.partModelKey: storage `key`, если он есть, иначе `url`.
// Сейчас GET /api/products отдаёт детали без storage key, поэтому фактически
// ключ === url; но бэкенд (resolvePartSelection) принимает и key, и url, так что
// поддержка `key` ничего не ломает и готова к будущему.

// Канонический ключ выбора детали: key || url. Если нет ни того, ни другого —
// null: такую деталь нельзя отправить как валидный выбор (только показать в UI).
export function modelSelectionKey(model) {
  const key = model?.key != null ? String(model.key).trim() : '';
  if (key) return key;
  const url = model?.url != null ? String(model.url).trim() : '';
  return url || null;
}

// Стабильный id строки для React-ключа и состояния чекбокса. Берём ключ выбора,
// а если его нет — UI-only фолбэк (он НИКОГДА не уходит на бэкенд).
export function modelRowId(model, index) {
  return modelSelectionKey(model) ?? `__row_${index}_${model?.filename ?? 'model'}`;
}

// Все валидные ключи выбора (дедуп, порядок сохраняется). Это «выбраны все».
export function allSelectionKeys(models) {
  const seen = new Set();
  const out = [];
  for (const model of Array.isArray(models) ? models : []) {
    const key = modelSelectionKey(model);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

// Сколько деталей реально можно выбрать у товара.
export function selectableModelCount(models) {
  return allSelectionKeys(models).length;
}

// Детали, попавшие в выбор (сопоставление по key ИЛИ url — как на бэкенде).
// Порядок — как в исходном списке models.
export function modelsForSelection(models, selectedKeys) {
  if (!Array.isArray(models) || !models.length) return [];
  const sel = new Set((Array.isArray(selectedKeys) ? selectedKeys : []).map(String));
  if (!sel.size) return [];
  return models.filter((model) => {
    const key = model?.key != null ? String(model.key).trim() : '';
    const url = model?.url != null ? String(model.url).trim() : '';
    return (key && sel.has(key)) || (url && sel.has(url));
  });
}

// Нормализует произвольный список ключей к каноническим ключам выбора текущего
// товара (отбрасывает чужие/пустые, дедуп, порядок как в models). Полный/пустой
// «мусорный» вход → пустой результат — вызывающий сам решает, что это значит.
export function normalizeSelectionKeys(models, selectedKeys) {
  return allSelectionKeys(modelsForSelection(models, selectedKeys));
}

// Предварительная цена выбора. Зеркалит backend priceForSelectedParts:
//  • нет деталей / пустой выбор / выбраны все / нет подетальных цен → полная цена;
//  • иначе → сумма цен выбранных деталей (округление до копеек).
// Это ТОЛЬКО приближение для UI — финальную цену считает бэкенд.
export function previewPriceForSelection(models, selectedKeys, fullPrice) {
  const full = Number(fullPrice) || 0;
  if (!Array.isArray(models) || !models.length) return full;
  if (!Array.isArray(selectedKeys) || !selectedKeys.length) return full;

  const chosen = modelsForSelection(models, selectedKeys);
  if (!chosen.length || chosen.length === models.length) return full;

  const hasPrices = models.some((m) => Number.isFinite(Number(m?.price)));
  if (!hasPrices) return full;

  const sum = chosen.reduce((acc, m) => acc + (Number(m?.price) || 0), 0);
  return Math.round(sum * 100) / 100;
}

// djb2 — короткий стабильный хеш строки (для суффикса id строки корзины).
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// Сигнатура набора деталей для уникальности позиции в корзине.
//  • выбраны все детали (или выбор пустой/«мусорный») → '' — товар ведёт себя
//    как раньше (тот же id строки, повторное добавление увеличивает qty);
//  • частичный выбор → короткий хеш отсортированных ключей (разные наборы —
//    разные позиции корзины).
export function selectionSignature(models, selectedKeys) {
  const all = allSelectionKeys(models);
  const chosen = normalizeSelectionKeys(models, selectedKeys);
  if (!chosen.length || chosen.length >= all.length) return '';
  return hashString(chosen.slice().sort().join('|'));
}
