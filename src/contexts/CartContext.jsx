// src/contexts/CartContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  allSelectionKeys,
  normalizeSelectionKeys,
  previewPriceForSelection,
} from '../utils/productModels';

const CartCtx = createContext(null);

export const useCart = () => {
  const ctx = useContext(CartCtx);
  if (!ctx) {
    throw new Error('useCart() must be used within <CartProvider>');
  }
  return ctx;
};

const LOCAL_KEY = 'cart:v1';

const hasWindow = () => typeof window !== 'undefined';

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clampQty = (qty) => Math.max(1, safeNumber(qty, 1));

const makeId = () => {
  // более надёжно, чем Math.random()
  if (hasWindow() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

function normalizeLoaded(arr) {
  if (!Array.isArray(arr)) return [];

  return arr
    .filter(Boolean)
    .map((it) => {
      const productId =
        it.product_id ?? it.productId ?? it.id ?? it._id ?? it.sku ?? makeId();

      const id =
        it.id ?? `${productId}:${it.variant_id ?? it.variantId ?? 'default'}`;

      const name = it.name ?? it.title ?? 'Товар';

      const price = safeNumber(it.price ?? it.base_price, 0);

      const image =
        it.image_url ??
        it.main_image_url ??
        it.image ??
        it.images?.[0]?.thumb_url ??
        it.images?.[0]?.url ??
        'https://placehold.co/300x300';

      const qty = clampQty(it.qty);

      const models = Array.isArray(it.models) ? it.models : [];
      const basePrice = safeNumber(it.base_price ?? price, price);
      // Выбор деталей: новое поле selected_model_keys, иначе легаси selected_files
      // (url). Нормализуем к текущим деталям; пусто → выбраны все.
      const storedSelection = Array.isArray(it.selected_model_keys)
        ? it.selected_model_keys
        : Array.isArray(it.selected_files)
          ? it.selected_files
          : null;
      const normalizedSelection = storedSelection
        ? normalizeSelectionKeys(models, storedSelection)
        : [];
      // Пусто (нет сохранённого выбора, либо url деталей разъехались и ничего не
      // совпало) → выбраны все, как это трактует checkout/бэкенд: отсутствие
      // выбора = печатать все детали. Иначе показали бы «0 з Y» при печати всего.
      const selectedKeys = normalizedSelection.length
        ? normalizedSelection
        : allSelectionKeys(models);

      return {
        id,
        product_id: productId,
        product_slug: it.product_slug ?? it.productSlug ?? it.slug ?? null,
        variant_id: it.variant_id ?? it.variantId ?? null,
        name,
        // Цену строки восстанавливаем из полной цены и выбора, чтобы она не
        // разъехалась с набором деталей (финальную всё равно считает бэкенд).
        price: previewPriceForSelection(models, selectedKeys, basePrice),
        base_price: basePrice,
        image,
        qty,
        files: Array.isArray(it.files) ? it.files : [],
        // Полный список деталей товара (для редактирования) и выбор (ключи key||url).
        models,
        selected_model_keys: selectedKeys,
      };
    });
}

function loadInitial() {
  if (!hasWindow()) return [];

  try {
    const raw = window.localStorage?.getItem(LOCAL_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return normalizeLoaded(parsed);
  } catch (e) {
    // чтобы не было пустого экрана без подсказок — покажем понятное предупреждение
    console.warn('[Cart] Failed to load cart from localStorage:', e);
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitial);

  // persist
  useEffect(() => {
    if (!hasWindow()) return;

    try {
      window.localStorage?.setItem(LOCAL_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[Cart] Failed to save cart to localStorage:', e);
    }
  }, [items]);

  // derived
  const totalQty = useMemo(
    () => items.reduce((s, it) => s + safeNumber(it.qty, 0), 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, it) => s + safeNumber(it.qty, 0) * safeNumber(it.price, 0),
        0
      ),
    [items]
  );

  // helpers
  const addItem = useCallback((product, qty = 1) => {
    if (!product || typeof product !== 'object') {
      throw new Error('[Cart] addItem(product, qty): product must be an object');
    }

    const productId =
      product.product_id ??
      product.productId ??
      product.id ??
      product._id ??
      product.sku ??
      makeId();

    const variantId =
      product.variant_id ?? product.variantId ?? product.activeVariantId ?? null;

    const lineId =
      product.cartLineId ??
      `${productId}:${variantId ?? product.optionsKey ?? 'default'}`;

    const name = product.name ?? product.title ?? 'Товар';

    const price =
      typeof product.price === 'number'
        ? product.price
        : safeNumber(product.price ?? product.base_price, 0);

    const image =
      product.image_url ??
      product.main_image_url ??
      product.image ??
      product.images?.[0]?.thumb_url ??
      product.images?.[0]?.url ??
      'https://placehold.co/300x300';

    const q = clampQty(qty);

    const files = Array.isArray(product.files) ? product.files : [];
    const models = Array.isArray(product.models) ? product.models : [];
    // Выбор деталей: ключи key||url. Не переданы → выбраны все детали.
    const selectedKeys = Array.isArray(product.selected_model_keys)
      ? normalizeSelectionKeys(models, product.selected_model_keys)
      : allSelectionKeys(models);

    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === lineId);

      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: clampQty(next[i].qty + q) };
        return next;
      }

      return [
        ...prev,
        {
          id: lineId,
          product_id: productId,
          product_slug: product.product_slug ?? product.productSlug ?? product.slug ?? null,
          variant_id: variantId,
          name,
          price,
          // Полная цена товара (всех деталей) — база для пересчёта при смене
          // выбора в корзине. Если не передана — текущая цена и есть полная.
          base_price: safeNumber(product.base_price ?? price, price),
          image,
          qty: q,
          files,
          models,
          selected_model_keys: selectedKeys,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((id, qty) => {
    if (!id) throw new Error('[Cart] updateQty(id, qty): id is required');

    const q = clampQty(qty);

    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: q } : it))
    );
  }, []);

  const inc = useCallback((id) => {
    if (!id) throw new Error('[Cart] inc(id): id is required');

    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, qty: clampQty(it.qty + 1) } : it
      )
    );
  }, []);

  const dec = useCallback((id) => {
    if (!id) throw new Error('[Cart] dec(id): id is required');

    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, qty: clampQty(it.qty - 1) } : it
      )
    );
  }, []);

  const remove = useCallback((id) => {
    if (!id) throw new Error('[Cart] remove(id): id is required');

    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // Меняет набор выбранных деталей строки (ключи key||url) и пересчитывает её
  // цену от base_price (полная цена товара хранится отдельно, чтобы выбор был
  // обратимым). Финальную цену всё равно считает бэкенд при оформлении.
  const setItemSelection = useCallback((id, selectedKeys) => {
    if (!id) throw new Error('[Cart] setItemSelection(id, keys): id is required');

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const models = Array.isArray(it.models) ? it.models : [];
        if (!models.length) return it;

        const keys = normalizeSelectionKeys(models, selectedKeys);
        if (!keys.length) return it; // минимум одна деталь должна остаться

        const base = Number(it.base_price ?? it.price) || 0;
        return {
          ...it,
          selected_model_keys: keys,
          price: previewPriceForSelection(models, keys, base),
        };
      })
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  // отправка заказа на бэкенд
  const checkout = useCallback(
    async ({
      customer,
      shipping_address,
      billing_address,
      notes,
      payment_provider,
      payment_kind,
      shipping_method,
      promo_code,
    } = {}) => {
      if (!items.length) {
        throw new Error('[Cart] checkout(): cart is empty');
      }

      const payload = {
        items: items.map((it) => {
          const models = Array.isArray(it.models) ? it.models : [];
          // Цену клиента НЕ шлём — источник истины по цене и файлам бэкенд.
          const base = {
            product_id: it.product_id ?? it.id,
            variant_id: it.variant_id ?? null,
            qty: clampQty(it.qty),
            files: Array.isArray(it.files) ? it.files : [],
          };
          // Выбор деталей шлём ТОЛЬКО при частичном выборе. Ключи нормализуем к
          // моделям строки.
          //  • полный выбор (или пустой/«мусорный») → поле не шлём, и бэкенд
          //    печатает все детали (старое поведение). Это устойчиво к
          //    устаревшей корзине: если файлы товара пересоздали и url детали
          //    изменился, строгий бэкенд НЕ вернёт 400 на «выбраны все»;
          //  • частичный выбор → шлём подмножество ключей (обязательно).
          const allKeys = allSelectionKeys(models);
          const selectedKeys = normalizeSelectionKeys(models, it.selected_model_keys);
          const isPartial =
            models.length > 0 &&
            selectedKeys.length > 0 &&
            selectedKeys.length < allKeys.length;
          if (isPartial) {
            base.selected_model_keys = selectedKeys;
          }
          return base;
        }),
        customer: customer ?? undefined,
        shipping_address: shipping_address ?? undefined,
        billing_address: billing_address ?? undefined,
        notes: notes ?? undefined,
        payment_provider: payment_provider || 'google_pay',
        payment_kind: payment_kind || 'deposit',
        shipping_method: shipping_method || 'pickup',
        promo_code: promo_code ?? undefined,
      };

      let res;

      try {
        res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } catch (e) {
        throw new Error(
          `[Cart] Network error while POST /api/orders: ${e?.message || e}`
        );
      }

      if (!res.ok) {
        let message = '';

        try {
          const data = await res.json();
          message = data?.message || '';
        } catch {
          try {
            message = await res.text();
          } catch {
            message = '';
          }
        }

        const details = message?.trim() ? ` — ${message.trim()}` : '';

        throw new Error(
          `[Cart] Checkout failed (${res.status} ${res.statusText})${details}`
        );
      }

      let order;

      try {
        order = await res.json();
      } catch {
        throw new Error('[Cart] Checkout succeeded but response is not valid JSON');
      }

      clear();

      return order; // { id, ... }
    },
    [items, clear]
  );

  const value = useMemo(
    () => ({
      items,
      totalQty,
      subtotal,
      addItem,
      updateQty,
      inc,
      dec,
      remove,
      setItemSelection,
      clear,
      checkout,
    }),
    [
      items,
      totalQty,
      subtotal,
      addItem,
      updateQty,
      inc,
      dec,
      remove,
      setItemSelection,
      clear,
      checkout,
    ]
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}