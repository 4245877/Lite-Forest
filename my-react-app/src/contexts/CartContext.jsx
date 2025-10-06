// src/contexts/CartContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

const LOCAL_KEY = 'cart:v1';

function loadInitial() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitial);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  // derived
  const totalQty = useMemo(() => items.reduce((s, it) => s + it.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, it) => s + it.qty * Number(it.price || 0), 0), [items]);

  // helpers
  const addItem = useCallback((product, qty = 1) => {
    // нормализуем поля из разных мест каталога/деталки
    const id = product.id ?? product._id ?? product.sku ?? String(Math.random());
    const name = product.name ?? product.title ?? 'Товар';
    const price = typeof product.price === 'number' ? product.price : Number(product.price ?? product.base_price ?? 0);

    const image =
      product.image_url
      ?? product.main_image_url
      ?? product.image
      ?? product.images?.[0]?.thumb_url
      ?? product.images?.[0]?.url
      ?? 'https://placehold.co/300x300';


    setItems(prev => {
      const i = prev.findIndex(x => x.id === id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.max(1, next[i].qty + qty) };
        return next;
      }
      return [...prev, { id, name, price, image, qty: Math.max(1, qty) }];
    });
  }, []);

  const updateQty = useCallback((id, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    setItems(prev => prev.map(it => (it.id === id ? { ...it, qty: q } : it)));
  }, []);

  const inc = useCallback((id) => setItems(prev => prev.map(it => (it.id === id ? { ...it, qty: it.qty + 1 } : it))), []);
  const dec = useCallback((id) => setItems(prev => prev.map(it => (it.id === id ? { ...it, qty: Math.max(1, it.qty - 1) } : it))), []);
  const remove = useCallback((id) => setItems(prev => prev.filter(it => it.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  // отправка заказа на бэкенд (использует /api/orders из твоего backend)
  const checkout = useCallback(async ({ shipping_address, billing_address, notes, payment_provider, shipping_method } = {}) => {
    // backend ждёт product_id/qty — в наших item.id лежит product.id
    const payload = {
      items: items.map(it => ({ product_id: it.id, qty: it.qty })),
      shipping_address: shipping_address || null,
      billing_address: billing_address || null,
      notes: notes || null,
      payment_provider: payment_provider || 'cod',
      shipping_method: shipping_method || 'pickup',
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({}));
      throw new Error(message || res.statusText || 'Помилка створення замовлення');
    }
    const order = await res.json();
    // по желанию: очищаем корзину только после успешной оплаты,
    // но базовый флоу — очистить после создания заказа:
    clear();
    return order; // { id, ... }
  }, [items, clear]);

  const value = useMemo(() => ({
    items, totalQty, subtotal,
    addItem, updateQty, inc, dec, remove, clear,
    checkout,
  }), [items, totalQty, subtotal, addItem, updateQty, inc, dec, remove, clear, checkout]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
