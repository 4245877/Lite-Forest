// Чистая логика доступности филаментов по складским остаткам фулфилмента.
//
// Складская доступность — это свойство ПАРЫ материал×цвет (не отдельного
// материала и не отдельного цвета). Backend магазина отдаёт список пар
// (см. /api/filament-availability), а здесь строится индекс и правила выбора
// на странице товара.
//
// Ключевые принципы:
//   • сравнение устойчиво к пробелам по краям и регистру, НО не «сливает»
//     разные значения по приблизительному совпадению (Grey ≠ Silver,
//     Transparent ≠ White, Gold ≠ Bronze) — сравниваем нормализованные строки
//     точно;
//   • отсутствующая в ответе пара считается недоступной;
//   • available:false считается недоступной;
//   • материалы, не входящие в канонические филаменты (например «Resin
//     Standard» — это смола), НЕ гейтятся складом филаментов (fail-open),
//     чтобы не объявлять их отсутствующими лишь потому, что их нет в filament
//     endpoint.
//
// Модуль намеренно без React и без сетевых зависимостей — так его легко
// тестировать (node:test) и переиспользовать.

// Канонические материалы филаментов фулфилмента. Только они гейтятся складом.
export const CANONICAL_FILAMENT_MATERIALS = ['PLA', 'PETG', 'TPU', 'ABS', 'ASA'];

const CANONICAL_MATERIAL_SET = new Set(CANONICAL_FILAMENT_MATERIALS.map((m) => m.toLowerCase()));

// Нормализация для сравнения/ключа: обрезаем пробелы и приводим регистр.
// НЕ трогаем содержимое — разные слова остаются разными.
export function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

// Ключ пары материал×цвет. Пример: PLA::Black → "pla::black".
export function pairKey(material, color) {
  return `${normalizeToken(material)}::${normalizeToken(color)}`;
}

// Материал гейтится складом филаментов, только если это канонический филамент.
// «Resin Standard» и прочие неканонические материалы — fail-open (не блокируем).
export function isFilamentMaterial(material) {
  return CANONICAL_MATERIAL_SET.has(normalizeToken(material));
}

// Строит индекс доступности из массива пар backend'а.
// items: [{ material, color, available, ... }]
// Возвращает объект с набором ключей доступных (available:true) пар.
export function buildAvailabilityIndex(items) {
  const availableKeys = new Set();

  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if (item.available !== true) continue; // available:false / прочее → недоступно
      const material = item.material;
      const color = item.color;
      if (!normalizeToken(material) || !normalizeToken(color)) continue;
      availableKeys.add(pairKey(material, color));
    }
  }

  return { availableKeys };
}

// Пустой индекс (нет достоверных данных) — для fail-open-режима.
export const EMPTY_INDEX = buildAvailabilityIndex([]);

// Доступна ли конкретная пара материал×цвет по складу.
// Неканонический материал (смола/неизвестный) → true (fail-open, не гейтим).
export function isPairAvailable(index, material, color) {
  if (!isFilamentMaterial(material)) return true;
  const keys = index?.availableKeys;
  if (!keys) return false;
  return keys.has(pairKey(material, color));
}

// Цвета товара, доступные с данным материалом (в исходном порядке товара).
export function availableColorsForMaterial(index, material, colors) {
  const list = Array.isArray(colors) ? colors : [];
  return list.filter((color) => isPairAvailable(index, material, color));
}

// Материалы товара, доступные с данным цветом (в исходном порядке товара).
export function availableMaterialsForColor(index, color, materials) {
  const list = Array.isArray(materials) ? materials : [];
  return list.filter((material) => isPairAvailable(index, material, color));
}

// (7.1) Материал доступен, если существует хотя бы один цвет товара, дающий
// доступную пару.
export function isMaterialAvailable(index, material, colors) {
  const list = Array.isArray(colors) ? colors : [];
  if (!list.length) return isPairAvailable(index, material, null);
  return list.some((color) => isPairAvailable(index, material, color));
}

// (7.1) Цвет доступен, если существует хотя бы один материал товара, дающий
// доступную пару.
export function isColorAvailable(index, color, materials) {
  const list = Array.isArray(materials) ? materials : [];
  if (!list.length) return false;
  return list.some((material) => isPairAvailable(index, material, color));
}

// Есть ли у товара хотя бы одна доступная комбинация материал×цвет.
export function hasAnyAvailablePair(index, materials, colors) {
  const mats = Array.isArray(materials) ? materials : [];
  const cols = Array.isArray(colors) ? colors : [];
  return mats.some((material) => cols.some((color) => isPairAvailable(index, material, color)));
}

// (7.1) Первая доступная пара из вариантов товара. Идём по материалам в порядке
// товара, внутри — по цветам в порядке товара; возвращаем первую доступную.
// null — доступных пар нет.
export function pickInitialPair(index, materials, colors) {
  const mats = Array.isArray(materials) ? materials : [];
  const cols = Array.isArray(colors) ? colors : [];

  for (const material of mats) {
    for (const color of cols) {
      if (isPairAvailable(index, material, color)) {
        return { material, color };
      }
    }
  }
  return null;
}

// (7.2) Пользователь выбрал материал. Если текущий цвет несовместим — берём
// первый доступный цвет для нового материала; если такого нет — очищаем цвет
// (color:null) и compatible:false (блокировка добавления в корзину).
export function resolveAfterMaterialChange(index, materials, colors, nextMaterial, currentColor) {
  if (isPairAvailable(index, nextMaterial, currentColor)) {
    return { material: nextMaterial, color: currentColor, compatible: true };
  }
  const firstColor = availableColorsForMaterial(index, nextMaterial, colors)[0] ?? null;
  return { material: nextMaterial, color: firstColor, compatible: firstColor != null };
}

// (7.3) Пользователь выбрал цвет. Симметрично: несовместимый материал заменяем
// первым доступным для нового цвета; нет такого — материал:null, compatible:false.
export function resolveAfterColorChange(index, materials, colors, nextColor, currentMaterial) {
  if (isPairAvailable(index, currentMaterial, nextColor)) {
    return { material: currentMaterial, color: nextColor, compatible: true };
  }
  const firstMaterial = availableMaterialsForColor(index, nextColor, materials)[0] ?? null;
  return { material: firstMaterial, color: nextColor, compatible: firstMaterial != null };
}
