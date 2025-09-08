// utils/searchUtils.js
// Надёжные утилиты для поиска/подсказок и подсветки.
// Безопасны к пустым полям, учитывают SKU, дают простой скоринг и кэшируют результаты.

import React from 'react'; // если у тебя новый JSX runtime — эта строка не обязательна

// --- небольшой LRU-кэш на Map ---
const MAX_CACHE = 20;
const searchCache = new Map();

const norm = (s) =>
  (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, ''); // убираем диакритику

// экранируем спецсимволы для RegExp
const escapeRegExp = (s) => (s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- debounce ---
export const debounce = (fn, delay = 300) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

// --- основной локальный поиск по списку товаров ---
export const searchProducts = (allProducts = [], query = '') => {
  const q = norm(query).trim();
  if (!q) return allProducts ?? [];

  // кэш
  if (searchCache.has(q)) return searchCache.get(q);

  const results = [];
  for (const p of allProducts || []) {
    const name = p?.name ?? '';
    const sku = p?.sku ?? '';
    const description = p?.description ?? '';
    const tags = Array.isArray(p?.tags) ? p.tags : [];

    const n = norm(name);
    const s = norm(sku);
    const d = norm(description);
    const t = tags.map(norm);

    let score = -1;

    // скоринг (чем выше, тем релевантнее)
    if (n === q) score = 120;                    // точное совпадение по имени
    else if (s === q) score = 115;               // точное совпадение по SKU
    else if (n.startsWith(q)) score = 100;       // имя начинается с запроса
    else if (s.startsWith(q)) score = 95;        // SKU начинается с запроса
    else if (n.includes(q)) score = 80;          // имя содержит запрос
    else if (s.includes(q)) score = 75;          // SKU содержит запрос
    else if (t.some(tag => tag.includes(q))) score = 60;   // теги
    else if (d.includes(q)) score = 30;          // описание

    // простая токен-логика для запросов из нескольких слов
    if (score < 0) {
      const words = q.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 1) {
        const hitAll = words.every(w => n.includes(w) || s.includes(w) || d.includes(w));
        if (hitAll) score = 25;
      }
    }

    if (score >= 0) results.push({ ...p, relevance: score });
  }

  results.sort((a, b) => b.relevance - a.relevance || a.name.localeCompare(b.name, 'uk'));

  // LRU управление
  if (searchCache.size >= MAX_CACHE) {
    const oldest = searchCache.keys().next().value;
    searchCache.delete(oldest);
  }
  searchCache.set(q, results);

  return results;
};

// --- подсказки (топ-N) ---
export const getSuggestions = (allProducts = [], query = '', limit = 8) => {
  const q = norm(query).trim();
  if (q.length < 2) return [];
  const matched = searchProducts(allProducts, query);
  return matched.slice(0, limit).map(p => ({
    id: p.id ?? p._id ?? p.sku ?? p.slug ?? p.name,
    name: p.name ?? String(p.sku ?? 'Без назви'),
    sku: p.sku ?? '',
  }));
};

// --- подсветка найденной части строки ---
// Возвращает React-узел: оборачивает совпадение в <mark>, безопасно экранирует паттерн.
export const highlightMatch = (text, highlight) => {
  const t = String(text ?? '');
  const q = norm(highlight).trim();
  if (!q) return t;

  // находим индекс "логического" совпадения без учёта регистра/диакритики
  const low = norm(t);
  const idx = low.indexOf(q);
  if (idx === -1) return t;

  // сопоставляем с исходной строкой
  const start = idx;
  const end = idx + q.length;

  return (
    <>
      {t.slice(0, start)}
      <mark>{t.slice(start, end)}</mark>
      {t.slice(end)}
    </>
  );
};
