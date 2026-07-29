// Контракт витринных статусов доступности (Vitest).
//
// Ключевое требование: made-to-order — рабочее состояние системы (backend шлёт
// его для всего ассортимента), но в витрине оно БЕЗ текста: об индивидуальном
// изготовлении говорим один раз на оформлении заказа, а не в каждой карточке.
// Остальные статусы и SEO-разметка при этом не должны пострадать.
import { describe, expect, test } from 'vitest';
import {
  normalizeAvailabilityState,
  getAvailabilityLabel,
  getAvailabilityTiming,
  getSchemaAvailability,
} from './availability';

describe('made-to-order: без текста в витрине', () => {
  test('label пустой', () => {
    expect(getAvailabilityLabel('made-to-order')).toBe('');
  });

  test('сроки не показываем — ни дефолтные, ни из lead_time_days', () => {
    expect(getAvailabilityTiming('made-to-order')).toBe('');
    expect(getAvailabilityTiming('made-to-order', 7)).toBe('');
  });

  test('backend-значение made_to_order по-прежнему распознаётся как состояние', () => {
    // Состояние живёт внутри системы (гейтинг, SEO), пропадает только текст.
    expect(normalizeAvailabilityState('made_to_order')).toBe('made-to-order');
    expect(normalizeAvailabilityState('custom')).toBe('made-to-order');
    expect(normalizeAvailabilityState('preorder')).toBe('made-to-order');
  });
});

describe('остальные статусы не задеты', () => {
  test('in-stock: label и сроки на месте', () => {
    expect(getAvailabilityLabel('in-stock')).toBe('Готово до відправки');
    expect(getAvailabilityTiming('in-stock')).toBe('Підготовка до відправки: 1–2 робочі дні');
    expect(getAvailabilityTiming('in-stock', 3)).toBe('Підготовка до відправки: 3 робочі дні');
  });

  test('in-catalog (дефолт): label и сроки на месте', () => {
    expect(normalizeAvailabilityState('')).toBe('in-catalog');
    expect(normalizeAvailabilityState('щось-невідоме')).toBe('in-catalog');
    expect(getAvailabilityLabel('in-catalog')).toBe('Доступно в каталозі');
    expect(getAvailabilityTiming('in-catalog')).toBe('Підготовка до відправки: 1–3 робочі дні');
  });

  test('out-of-stock: label на месте, сроков нет', () => {
    expect(getAvailabilityLabel('out-of-stock')).toBe('Тимчасово недоступно');
    expect(getAvailabilityTiming('out-of-stock')).toBe('');
  });
});

describe('SEO-разметка не задета', () => {
  test('made-to-order остаётся PreOrder в JSON-LD', () => {
    expect(getSchemaAvailability('made-to-order')).toBe('https://schema.org/PreOrder');
  });

  test('остальные состояния — как раньше', () => {
    expect(getSchemaAvailability('in-stock')).toBe('https://schema.org/InStock');
    expect(getSchemaAvailability('in-catalog')).toBe('https://schema.org/InStock');
    expect(getSchemaAvailability('out-of-stock')).toBe('https://schema.org/OutOfStock');
  });
});
