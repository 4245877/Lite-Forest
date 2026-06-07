// src/contexts/CartContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

      return {
        id,
        product_id: productId,
        product_slug: it.product_slug ?? it.productSlug ?? it.slug ?? null,
        variant_id: it.variant_id ?? it.variantId ?? null,
        name,
        price,
        image,
        qty,
        files: Array.isArray(it.files) ? it.files : [],
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
          image,
          qty: q,
          files,
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
        items: items.map((it) => ({
          product_id: it.product_id ?? it.id,
          variant_id: it.variant_id ?? null,
          qty: clampQty(it.qty),
          files: Array.isArray(it.files) ? it.files : [],
        })),
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
      } catch (e) {
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
      clear,
      checkout,
    ]
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}