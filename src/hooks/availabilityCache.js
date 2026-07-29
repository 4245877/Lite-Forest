// Чистое ядро клиентского кэша складской доступности филаментов.
//
// Вынесено из useFilamentAvailability, чтобы кэш/single-flight можно было
// тестировать без React-рендера (node:test): зависимости (loader, часы, TTL)
// инъектируются. Хук создаёт ОДИН общий экземпляр на уровне модуля — справочник
// склада один для всех товаров, поэтому между карточками сеть не дёргаем.
//
// Кэшируем ТОЛЬКО достоверный успешный снимок (items — массив, не degraded/stale),
// чтобы degraded/ошибка не «залипали» на клиенте (бэкенд на такие ответы ставит
// no-store). Параллельные первые запросы дедуплицируются (single-flight).

export const CLIENT_CACHE_TTL_MS = 30000;

// Достоверные данные = items это массив и это не degraded/stale-снимок.
export function isTrustworthy(data) {
  return Boolean(data && Array.isArray(data.items) && !data.degraded && !data.stale);
}

// load — async-функция получения снимка (в хуке: api.getFilamentAvailability).
// now/ttlMs инъектируются для тестов (фейковые часы, короткий TTL).
export function createAvailabilityCache({ load, now = Date.now, ttlMs = CLIENT_CACHE_TTL_MS } = {}) {
  let snapshot = null; // { at:number, data:object } — только достоверный снимок
  let inFlight = null; // Promise — общий для параллельных первых запросов

  // Свежий достоверный снимок (или null). Хук зовёт это, чтобы не мигать loading.
  function peekFresh() {
    if (snapshot && now() - snapshot.at < ttlMs) return snapshot.data;
    return null;
  }

  // Возвращает Promise со снимком. Кэширует только достоверный; degraded/stale/
  // ошибку не кэширует (следующий вызов попробует снова).
  function get() {
    const cached = peekFresh();
    if (cached) return Promise.resolve(cached);

    if (!inFlight) {
      // load() зовём синхронно (важно для single-flight: второй синхронный get
      // до резолва получит тот же inFlight). Promise.resolve разворачивает результат.
      inFlight = Promise.resolve(load())
        .then((data) => {
          const value = data ?? null;
          if (isTrustworthy(value)) {
            snapshot = { at: now(), data: value };
          }
          return value;
        })
        .finally(() => {
          inFlight = null;
        });
    }

    return inFlight;
  }

  return { get, peekFresh };
}
