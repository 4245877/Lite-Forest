// Модульные тесты фича-флага расширенного контента (Vitest). Запуск: pnpm test
//
// Главное здесь — умолчание: без явно выставленного флага контент выключен.
// Ошибиться в эту сторону нельзя, поэтому кейс стоит первым.
import { describe, expect, test } from 'vitest';

import {
  isProductContentEnabled,
  parseFlag,
  PRODUCT_CONTENT_FLAG,
  PRODUCT_CONTENT_QUERY_PARAM,
} from './featureFlags.js';

describe('parseFlag', () => {
  test('понимает привычные написания', () => {
    for (const value of ['1', 'true', 'TRUE', ' on ', 'yes']) expect(parseFlag(value)).toBe(true);
    for (const value of ['0', 'false', 'off', 'NO']) expect(parseFlag(value)).toBe(false);
  });

  test('«не задано» и «непонятно» — это null, а не false', () => {
    for (const value of [undefined, null, '', '   ', 'maybe']) expect(parseFlag(value)).toBeNull();
  });
});

describe('isProductContentEnabled', () => {
  test('по умолчанию выключен', () => {
    expect(isProductContentEnabled({ env: {}, search: '' })).toBe(false);
    expect(isProductContentEnabled({ env: { [PRODUCT_CONTENT_FLAG]: '' }, search: '' })).toBe(false);
    expect(isProductContentEnabled({ env: { [PRODUCT_CONTENT_FLAG]: 'maybe' }, search: '' })).toBe(false);
  });

  test('включается сборочным флагом', () => {
    expect(isProductContentEnabled({ env: { [PRODUCT_CONTENT_FLAG]: '1' }, search: '' })).toBe(true);
    expect(isProductContentEnabled({ env: { [PRODUCT_CONTENT_FLAG]: 'true' }, search: '' })).toBe(true);
  });

  test('параметр адреса перебивает сборочный флаг в обе стороны', () => {
    const on = `?${PRODUCT_CONTENT_QUERY_PARAM}=1`;
    const off = `?${PRODUCT_CONTENT_QUERY_PARAM}=0`;

    expect(isProductContentEnabled({ env: {}, search: on })).toBe(true);
    expect(isProductContentEnabled({ env: { [PRODUCT_CONTENT_FLAG]: '1' }, search: off })).toBe(false);
  });

  test('непонятный параметр не перебивает ничего', () => {
    const env = { [PRODUCT_CONTENT_FLAG]: '1' };
    expect(isProductContentEnabled({ env, search: `?${PRODUCT_CONTENT_QUERY_PARAM}=возможно` })).toBe(true);
    expect(isProductContentEnabled({ env: {}, search: '?другой=1' })).toBe(false);
  });

  test('битая строка запроса не роняет страницу товара', () => {
    expect(isProductContentEnabled({ env: {}, search: '?%%%' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Приоритет и независимость флагов.
//
// Проверяется контракт, записанный в docs/product-content-feature-flags.md.
// Он важен именно на этом уровне: «включить всем» и «откатить всем» — операции,
// которые делает человек под нагрузкой, и порядок разрешения обязан быть один и
// тот же в коде, в документе и в голове.
// ─────────────────────────────────────────────────────────────────────────────
describe('приоритет источников', () => {
  const cases = [
    { env: undefined, search: '', expected: false, why: 'ничего не задано → выключено' },
    { env: '1', search: '', expected: true, why: 'сборочный флаг включает' },
    { env: '0', search: '', expected: false, why: 'сборочный флаг выключает' },
    { env: '0', search: '?product_content=1', expected: true, why: 'параметр перебивает выключенный флаг' },
    { env: '1', search: '?product_content=0', expected: false, why: 'параметр перебивает включённый флаг' },
    { env: '1', search: '?product_content=', expected: true, why: 'пустой параметр не перебивает' },
    { env: '1', search: '?product_content=абв', expected: true, why: 'непонятный параметр не перебивает' },
  ];

  for (const { env, search, expected, why } of cases) {
    test(`${why}`, () => {
      const environment = env === undefined ? {} : { [PRODUCT_CONTENT_FLAG]: env };
      expect(isProductContentEnabled({ env: environment, search })).toBe(expected);
    });
  }

  test('порядок ровно такой: понятный параметр → сборочный флаг → выключено', () => {
    // Один тест, который ломается при любой перестановке источников местами.
    const resolved = (env, search) => isProductContentEnabled({ env, search });

    // Параметр важнее окружения.
    expect(resolved({ [PRODUCT_CONTENT_FLAG]: '1' }, '?product_content=0')).toBe(false);
    // Окружение важнее умолчания.
    expect(resolved({ [PRODUCT_CONTENT_FLAG]: '1' }, '')).toBe(true);
    // Умолчание — последнее.
    expect(resolved({}, '')).toBe(false);
  });

  test('параметр — не авторизация: он лишь показывает то, что сервер уже отдал', () => {
    // Флаг не участвует в загрузке данных и не может ничего «открыть»: он решает
    // только, разбирать ли поле content, которое уже пришло в публичном ответе.
    // Проверка держит это свойство: функция не обращается ни к сети, ни к
    // хранилищу — у неё вообще нет доступа ни к чему, кроме двух строк.
    expect(isProductContentEnabled.length).toBeLessThanOrEqual(1);
    expect(String(isProductContentEnabled)).not.toMatch(/fetch|XMLHttpRequest|localStorage|document\./);
  });
});
