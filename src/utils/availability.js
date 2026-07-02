// Единый источник правды для статусов доступности товара в публичной витрине.
//
// Позиционирование Lite Forest — это каталог практичных изделий, а не сервис
// 3D-печати «під замовлення». Поэтому дефолтный статус для товара, у которого
// backend явно ничего не передал, — нейтральный «Доступно в каталозі», а не
// «Під замовлення». «Індивідуальне замовлення» оставляем только для тех товаров,
// которые backend явно пометил как индивидуальный/предзаказный сервис.
//
// Состояния:
//   'in-stock'      — реально есть в наличии → «Готово до відправки»
//   'in-catalog'    — дефолт: можно заказать, готовится небольшими партиями
//   'made-to-order' — только явный индивидуальный/предзаказный товар
//   'out-of-stock'  — временно недоступен

export function normalizeAvailabilityState(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('_', '-');

  if (!raw) return 'in-catalog';

  if (
    raw === 'unavailable' ||
    raw === 'disabled' ||
    raw === 'archived' ||
    raw === 'out-of-stock' ||
    raw === 'outofstock' ||
    raw === 'sold-out'
  ) {
    return 'out-of-stock';
  }

  if (
    raw === 'in-stock' ||
    raw === 'instock' ||
    raw === 'available' ||
    raw === 'ready' ||
    raw === 'ready-to-ship'
  ) {
    return 'in-stock';
  }

  if (
    raw === 'made-to-order' ||
    raw === 'make-to-order' ||
    raw === 'preorder' ||
    raw === 'pre-order' ||
    raw === 'custom' ||
    raw === 'individual' ||
    raw === 'on-demand'
  ) {
    return 'made-to-order';
  }

  // Любое неизвестное/нейтральное значение ('catalog', 'in-catalog', и т.п.)
  // показываем как нейтральный каталожный статус, а не «Під замовлення».
  return 'in-catalog';
}

const STATUS_LABELS = {
  'in-stock': 'Готово до відправки',
  'in-catalog': 'Доступно в каталозі',
  'made-to-order': 'Індивідуальне замовлення',
  'out-of-stock': 'Тимчасово недоступно',
};

export function getAvailabilityLabel(state) {
  return STATUS_LABELS[state] ?? STATUS_LABELS['in-catalog'];
}

// Строка сроков подготовки/отправки рядом со статусом. Если backend передал
// lead_time_days — используем его, иначе показываем мягкий дефолтный диапазон.
export function getAvailabilityTiming(state, leadDays) {
  const days = Number(leadDays);
  const hasLead = Number.isFinite(days) && days > 0;

  switch (state) {
    case 'in-stock':
      return hasLead
        ? `Підготовка до відправки: ${days} ${pluralDays(days)}`
        : 'Підготовка до відправки: 1–2 робочі дні';
    case 'made-to-order':
      return hasLead
        ? `Виготовлення: ${days} ${pluralDays(days)}`
        : 'Терміни погоджуємо індивідуально';
    case 'out-of-stock':
      return '';
    case 'in-catalog':
    default:
      return hasLead
        ? `Підготовка до відправки: ${days} ${pluralDays(days)}`
        : 'Підготовка до відправки: 1–3 робочі дні';
  }
}

function pluralDays(days) {
  const n = Math.abs(days) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'робочих днів';
  if (n1 === 1) return 'робочий день';
  if (n1 >= 2 && n1 <= 4) return 'робочі дні';
  return 'робочих днів';
}

// schema.org availability. PreOrder ставим ТОЛЬКО для явного индивидуального/
// предзаказного товара, а не по умолчанию.
export function getSchemaAvailability(state) {
  switch (state) {
    case 'in-stock':
    case 'in-catalog':
      return 'https://schema.org/InStock';
    case 'made-to-order':
      return 'https://schema.org/PreOrder';
    case 'out-of-stock':
    default:
      return 'https://schema.org/OutOfStock';
  }
}
