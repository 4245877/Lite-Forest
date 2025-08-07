// --- Кэш для хранения результатов последних запросов ---
const searchCache = new Map();

/**
 * Функция debounce. Откладывает выполнение функции до тех пор,
 * пока не пройдет `delay` миллисекунд с момента последнего вызова.
 * @param {Function} func - Функция для вызова.
 * @param {number} delay - Задержка в мс.
 * @returns {Function} - Обёрнутая функция.
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

/**
 * "Умный" поиск товаров с ранжированием и кэшированием.
 * В реальном проекте эта логика была бы на сервере.
 * @param {Array<Object>} allProducts - Полный список товаров.
 * @param {string} query - Поисковый запрос.
 * @returns {Array<Object>} - Отсортированный по релевантности список найденных товаров.
 */
export const searchProducts = (allProducts, query) => {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return allProducts;
  }
  
  // Проверяем кэш
  if (searchCache.has(normalizedQuery)) {
    return searchCache.get(normalizedQuery);
  }

  const results = [];

  allProducts.forEach(product => {
    const name = product.name.toLowerCase();
    const description = product.description.toLowerCase();
    const tags = product.tags.map(t => t.toLowerCase());

    let relevance = 0;

    // --- Логика ранжирования ---
    // 1. Точное совпадение по названию (самый высокий приоритет)
    if (name === normalizedQuery) {
      relevance = 100;
    } 
    // 2. Запрос является началом названия
    else if (name.startsWith(normalizedQuery)) {
      relevance = 80;
    }
    // 3. Запрос содержится в названии
    else if (name.includes(normalizedQuery)) {
      relevance = 50;
    }
    // 4. Запрос содержится в тегах
    else if (tags.some(tag => tag.includes(normalizedQuery))) {
      relevance = 30;
    }
    // 5. Запрос содержится в описании (самый низкий приоритет)
    else if (description.includes(normalizedQuery)) {
      relevance = 10;
    }
    
    // Простая симуляция "fuzzy search" - ищем по отдельным словам
    if (relevance === 0) {
        const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);
        if (queryWords.length > 1) {
            const matchCount = queryWords.reduce((count, word) => {
                if (name.includes(word) || description.includes(word)) {
                    return count + 1;
                }
                return count;
            }, 0);
            
            if (matchCount === queryWords.length) {
                relevance = 5; // Небольшой бонус, если все слова из запроса найдены
            }
        }
    }


    if (relevance > 0) {
      results.push({ ...product, relevance });
    }
  });

  // Сортируем по релевантности (от большей к меньшей)
  results.sort((a, b) => b.relevance - a.relevance);

  // --- Управление кэшем ---
  // Если кэш переполнен, удаляем самый старый элемент
  if (searchCache.size >= 5) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  searchCache.set(normalizedQuery, results);

  return results;
};


/**
 * Получает до 5 подсказок для автодополнения.
 * @param {Array<Object>} allProducts - Полный список товаров.
 * @param {string} query - Поисковый запрос.
 * @returns {Array<Object>} - Список подсказок.
 */
export const getSuggestions = (allProducts, query) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery.length < 2) {
        return [];
    }

    const matchedProducts = searchProducts(allProducts, query);
    
    return matchedProducts
        .slice(0, 5) // Берем топ-5 самых релевантных
        .map(p => ({
            id: p.id,
            name: p.name,
            query: normalizedQuery,
        }));
};

/**
 * Функция для подсветки найденного текста в строке.
 * @param {string} text - Исходный текст (например, название товара).
 * @param {string} highlight - Текст, который нужно подсветить.
 * @returns {React.ReactNode} - Текст с подсвеченными частями.
 */
export const highlightMatch = (text, highlight) => {
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <b key={i}>{part}</b>
        ) : (
          part
        )
      )}
    </span>
  );
};