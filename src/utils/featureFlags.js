// Фича-флаги витрины.
//
// Флаг здесь — не «переменная в компоненте», а функция, которую вызывают на
// каждый рендер: значение читается в момент вызова, а не при импорте модуля.
// Иначе тесту (и человеку в консоли браузера) пришлось бы перезагружать модуль,
// чтобы поменять состояние флага, а vi.stubEnv не действовал бы вовсе.

const TRUTHY = new Set(['1', 'true', 'on', 'yes']);
const FALSY = new Set(['0', 'false', 'off', 'no']);

/**
 * Строка окружения/параметра → boolean.
 *
 * Возвращает null для «значение не задано или непонятное»: это не то же самое,
 * что «выключено». Разница нужна на уровень выше — параметр в адресе перебивает
 * сборочный флаг только тогда, когда он ПОНЯТНЫЙ, а не когда он просто есть.
 */
export function parseFlag(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;

  return null;
}

/** Сборочный флаг расширенного контента товара (vite: .env / VITE_*). */
export const PRODUCT_CONTENT_FLAG = 'VITE_PRODUCT_CONTENT_V1';

/**
 * Разовое переключение через адрес страницы: ?product_content=1 (и =0).
 *
 * Нужно затем, что фронт выкатывается сборкой (dist смонтирован в nginx), и без
 * такого переключателя единственный способ посмотреть новый рендер на проде —
 * пересобрать и выкатить его всем сразу. Опасности в параметре нет: он включает
 * показ уже опубликованных и проверенных сервером данных, а не режим отладки.
 */
export const PRODUCT_CONTENT_QUERY_PARAM = 'product_content';

/**
 * Показывать ли расширенный контент товара.
 *
 * По умолчанию ВЫКЛЮЧЕНО: без явно выставленного флага страница товара обязана
 * вести себя ровно так, как вела до появления рендерера.
 */
export function isProductContentEnabled({
  env = import.meta.env,
  search = typeof window === 'undefined' ? '' : window.location.search,
} = {}) {
  let override = null;

  try {
    override = parseFlag(new URLSearchParams(search || '').get(PRODUCT_CONTENT_QUERY_PARAM));
  } catch {
    // Битая строка запроса — не повод ронять страницу товара.
    override = null;
  }

  if (override !== null) return override;

  return parseFlag(env?.[PRODUCT_CONTENT_FLAG]) ?? false;
}
