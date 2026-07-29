// Хук получения складской доступности филаментов через backend магазина.
//
// Никогда не обращается к 192.168.0.139 напрямую — только через
// api.getFilamentAvailability() (backend-прокси с токеном/кэшем/stale-on-error).
//
// Складской справочник ОДИН для всех товаров, поэтому держим общий кэш на уровне
// модуля: при переходе между карточками не дёргаем сеть повторно и не мигаем
// loading'ом. Кэшируем ТОЛЬКО достоверный успешный снимок (items — массив,
// не degraded/stale), чтобы degraded/ошибка не «залипали» на клиенте (бэкенд
// на такие ответы ставит no-store). Параллельные первые запросы дедуплицируются
// (single-flight).
//
// Состояния (fail-open по умолчанию — ошибка склада не должна ломать магазин):
//   status: 'loading' | 'ready' | 'error'
//   data:   внутренний контракт backend'а (или null при ошибке/загрузке)
//
// Интерпретация на странице товара:
//   • loading                       → достоверных данных ещё нет, fail-open,
//                                      можно показать индикатор проверки;
//   • ready + Array.isArray(items)  → достоверные данные, строгая фильтрация;
//   • ready + items === null        → degraded/no-data, fail-open;
//   • error                         → сеть недоступна, fail-open.

import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { createAvailabilityCache } from './availabilityCache';

// Складской справочник ОДИН для всех товаров → общий кэш на уровне модуля: при
// переходе между карточками не дёргаем сеть повторно и не мигаем loading'ом.
// Логика кэша/single-flight вынесена в availabilityCache (покрыта node:test).
const cache = createAvailabilityCache({ load: () => api.getFilamentAvailability() });

export function useFilamentAvailability() {
  const [state, setState] = useState(() => {
    const cached = cache.peekFresh();
    return cached ? { status: 'ready', data: cached } : { status: 'loading', data: null };
  });

  useEffect(() => {
    let alive = true;

    const cached = cache.peekFresh();
    if (cached) {
      // Уже есть свежий достоверный снимок — сеть не трогаем.
      setState({ status: 'ready', data: cached });
      return () => {
        alive = false;
      };
    }

    cache
      .get()
      .then((data) => {
        if (!alive) return;
        setState({ status: 'ready', data: data ?? null });
      })
      .catch(() => {
        // Fail-open: не блокируем страницу из-за недоступности склада/бэкенда.
        if (!alive) return;
        setState({ status: 'error', data: null });
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
}
