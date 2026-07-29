// Тесты чистого ядра клиентского кэша складской доступности (Vitest).
// Запуск: pnpm test
import { test } from 'vitest';
import assert from 'node:assert/strict';

import { createAvailabilityCache, isTrustworthy, CLIENT_CACHE_TTL_MS } from './availabilityCache.js';

// Достоверный снимок: массив items, не degraded/stale.
const TRUSTWORTHY = {
  configured: true,
  degraded: false,
  stale: false,
  items: [{ material: 'PLA', color: 'Black', available: true }],
};
// degraded (склад недоступен) — items:null, кэшировать нельзя.
const DEGRADED = { configured: true, degraded: true, stale: false, items: null };
// stale (устаревший снимок при ошибке источника) — тоже не кэшируем.
const STALE = {
  configured: true,
  degraded: true,
  stale: true,
  items: [{ material: 'PLA', color: 'Black', available: true }],
};

// Управляемый loader: считает вызовы, отдаёт заданное значение.
function countingLoad(value) {
  let calls = 0;
  const load = async () => {
    calls += 1;
    return value;
  };
  return { load, calls: () => calls };
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// 1. Свежий снимок отдаётся в пределах TTL без повторного запроса.
test('свежий снимок в пределах TTL — без повторного load', async () => {
  let clock = 1000;
  const { load, calls } = countingLoad(TRUSTWORTHY);
  const cache = createAvailabilityCache({ load, now: () => clock, ttlMs: 30000 });

  const r1 = await cache.get();
  assert.equal(r1, TRUSTWORTHY);
  assert.equal(calls(), 1);

  clock += 29999; // всё ещё в пределах TTL
  const r2 = await cache.get();
  assert.equal(r2, TRUSTWORTHY);
  assert.equal(calls(), 1); // отдано из кэша, второго запроса нет
  assert.equal(cache.peekFresh(), TRUSTWORTHY);
});

// 2. По истечении TTL снимок протухает и данные перезапрашиваются.
test('после TTL снимок протухает — повторный load', async () => {
  let clock = 1000;
  const { load, calls } = countingLoad(TRUSTWORTHY);
  const cache = createAvailabilityCache({ load, now: () => clock, ttlMs: 30000 });

  await cache.get();
  assert.equal(calls(), 1);

  clock += 30000; // ровно TTL → уже не свежий (сравнение строгое)
  assert.equal(cache.peekFresh(), null);

  await cache.get();
  assert.equal(calls(), 2);
});

// 3. Single-flight: параллельные первые вызовы дедуплицируются в один запрос.
test('single-flight: параллельные get дедуплицируются', async () => {
  const d = deferred();
  let calls = 0;
  const cache = createAvailabilityCache({
    load: () => {
      calls += 1;
      return d.promise;
    },
    now: () => 1000,
  });

  const p1 = cache.get();
  const p2 = cache.get();
  assert.equal(calls, 1); // два вызова → один запрос к источнику

  d.resolve(TRUSTWORTHY);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, TRUSTWORTHY);
  assert.equal(r2, TRUSTWORTHY);
});

// 4. degraded не кэшируется — следующий get снова идёт в load.
test('degraded не кэшируется', async () => {
  const { load, calls } = countingLoad(DEGRADED);
  const cache = createAvailabilityCache({ load, now: () => 1000 });

  const r1 = await cache.get();
  assert.equal(r1, DEGRADED);
  assert.equal(cache.peekFresh(), null); // не сохранён

  await cache.get();
  assert.equal(calls(), 2); // снова запрос, degraded не закэширован
});

// 5. stale-снимок тоже не кэшируется.
test('stale не кэшируется', async () => {
  const { load, calls } = countingLoad(STALE);
  const cache = createAvailabilityCache({ load, now: () => 1000 });

  await cache.get();
  assert.equal(cache.peekFresh(), null);

  await cache.get();
  assert.equal(calls(), 2);
});

// 6. null-ответ (сеть/бэкенд недоступны) трактуется как недостоверный (fail-open).
test('null-ответ не кэшируется (fail-open)', async () => {
  const { load } = countingLoad(null);
  const cache = createAvailabilityCache({ load, now: () => 1000 });

  const r = await cache.get();
  assert.equal(r, null);
  assert.equal(cache.peekFresh(), null);
});

// 7. isTrustworthy: только массив items без degraded/stale.
test('isTrustworthy: строгая проверка достоверности', () => {
  assert.equal(isTrustworthy(TRUSTWORTHY), true);
  assert.equal(isTrustworthy(DEGRADED), false);
  assert.equal(isTrustworthy(STALE), false);
  assert.equal(isTrustworthy(null), false);
  assert.equal(isTrustworthy(undefined), false);
  assert.equal(isTrustworthy({ items: null }), false);
  assert.equal(isTrustworthy({ items: 'oops' }), false);
});

// 8. TTL по умолчанию — 30 с (контракт с бэкендом, который обновляет ~каждые 60 с).
test('дефолтный TTL = 30 c', () => {
  assert.equal(CLIENT_CACHE_TTL_MS, 30000);
});
