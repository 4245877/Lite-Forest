// FILE: src/pages/CartPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './CartPage.module.css';

// Demo data — заменить на реальные вызовы API / context
const initialCart = [
  {
    id: 'P-101',
    title: 'Фигурка: Кот-исследователь (3D)',
    img: '/assets/products/cat-figure.jpg',
    material: 'Фотополимер (Серый)',
    size: '15 см',
    qty: 1,
    price: 450,
    leadTime: '3-5 рабочих дней',
  },
  {
    id: 'P-205',
    title: 'Подставка-основа для фигурки',
    img: '/assets/products/stand.jpg',
    material: 'Пластик PLA',
    size: 'Стандартный',
    qty: 2,
    price: 200,
    leadTime: '2-3 рабочих дней',
  },
];

const recommendedDemo = [
  { id: 'R-1', title: 'Набор красок, 6 шт.', img: '/assets/products/paint-set.jpg', price: 120 },
  { id: 'R-2', title: 'Фигурка: Другой персонаж', img: '/assets/products/fig2.jpg', price: 380 },
  { id: 'R-3', title: 'Кисть для деталей', img: '/assets/products/brush.jpg', price: 60 },
  { id: 'R-4', title: 'Подарочная коробка', img: '/assets/products/box.jpg', price: 80 },
];

const FREE_SHIPPING_THRESHOLD = 1599; // пример
const DEFAULT_SHIPPING = 50;

export default function CartPage() {
  const [cart, setCart] = useState(initialCart);
  const [recommended, setRecommended] = useState(recommendedDemo);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [reserveSeconds, setReserveSeconds] = useState(15 * 60); // 15:00

  useEffect(() => {
    const t = setInterval(() => {
      setReserveSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const subtotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING;

  const promoDiscount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.code === 'SAVE50') return 50;
    if (appliedPromo.code === 'PERC10') return Math.round(subtotal * 0.1);
    return 0;
  }, [appliedPromo, subtotal]);

  const total = Math.max(0, subtotal + shipping - promoDiscount);

  const amountToFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progressPct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  // Handlers
  function changeQty(id, delta) {
    setCart((c) =>
      c.map((it) => (it.id === id ? { ...it, qty: Math.max(1, it.qty + delta) } : it))
    );
  }

  function removeItem(id) {
    setCart((c) => c.filter((it) => it.id !== id));
  }

  function saveForLater(id) {
    // Заглушка: позже добавить API / избранное
    setCart((c) => c.filter((it) => it.id !== id));
    // show toast — для демонстрации используем alert (заменить на nicer UI)
    alert('Товар отложен — можно найти в избранном.');
  }

  function addRecommended(item) {
    setCart((c) => {
      const found = c.find((x) => x.id === item.id);
      if (found) return c.map((x) => (x.id === item.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { ...item, qty: 1 }];
    });

    // Optionally remove from recommendations or mark added
    setRecommended((r) => r);
  }

  function applyPromo(e) {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    // Demo promo rules
    if (code === 'SAVE50' || code === 'PERC10') {
      setAppliedPromo({ code });
      setPromoOpen(false);
    } else {
      alert('Промокод не найден');
    }
  }

  // Helper: format seconds to MM:SS
  const reserveTimeFormatted = (() => {
    const mm = String(Math.floor(reserveSeconds / 60)).padStart(2, '0');
    const ss = String(reserveSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  })();

  return (
    <div className={styles.container}>
      {/* Top motivator */}
      <div className={styles.motivator}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Ваша Корзина</h1>
          <div className={styles.reserveNote}>Товары зарезервированы для вас на <strong>{reserveTimeFormatted}</strong></div>
        </div>

        <div className={styles.freeShippingRow}>
          <div className={styles.progressWrap} aria-hidden>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPct}%`, backgroundColor: subtotal >= FREE_SHIPPING_THRESHOLD ? '#2b8a3e' : '#f39c12' }}
              />
            </div>
            <div className={styles.progressText}>
              {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                <span>🎉 Поздравляем! Ваш заказ будет доставлен бесплатно!</span>
              ) : (
                <span>Добавьте товаров ещё на <strong>{amountToFree} грн</strong> для БЕСПЛАТНОЙ доставки!</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main two-column area */}
      <div className={styles.grid}>
        <div className={styles.left}>
          <h2 className={styles.sectionTitle}>Состав заказа</h2>

          {cart.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Ваша корзина пуста.</p>
              <Link to="/catalog" className={styles.linkBtn}>Вернуться в каталог</Link>
            </div>
          ) : (
            <ul className={styles.cartList}>
              {cart.map((item) => (
                <li key={item.id} className={styles.cartItem}>
                  <img src={item.img} alt={item.title} className={styles.thumb} />
                  <div className={styles.itemBody}>
                    <Link to={`/product/${item.id}`} className={styles.itemTitle}>{item.title}</Link>
                    <div className={styles.itemMeta}>{item.material} • {item.size}</div>
                    <div className={styles.qtyRow}>
                      <div className={styles.qtyControls}>
                        <button aria-label="Уменьшить" onClick={() => changeQty(item.id, -1)} className={styles.qtyBtn}>-</button>
                        <input className={styles.qtyInput} value={item.qty} readOnly aria-label="Количество" />
                        <button aria-label="Увеличить" onClick={() => changeQty(item.id, +1)} className={styles.qtyBtn}>+</button>
                      </div>
                      <div className={styles.itemPrice}>{item.qty} x {item.price} грн = <strong>{item.qty * item.price} грн</strong></div>
                    </div>
                    <div className={styles.itemActions}>
                      <button onClick={() => removeItem(item.id)} className={styles.linkAction}>Удалить</button>
                      <button onClick={() => saveForLater(item.id)} className={styles.linkAction}>Отложить</button>
                      <span className={styles.leadTime}>⏱ {item.leadTime}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Upsell / recommendations */}
          <section className={styles.recoSection} aria-label="Рекомендации">
            <h3>С этим часто покупают</h3>
            <div className={styles.recoRow}>
              {recommended.map((r) => (
                <div key={r.id} className={styles.recoCard}>
                  <img src={r.img} alt={r.title} />
                  <div className={styles.recoInfo}>
                    <div className={styles.recoTitle}>{r.title}</div>
                    <div className={styles.recoPrice}>{r.price} грн</div>
                    <button onClick={() => addRecommended(r)} className={styles.addBtn}>Добавить в корзину</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.right}>
          <div className={styles.summaryCard}>
            <h3>Сумма заказа</h3>
            <div className={styles.row}><span>Товары ({cart.reduce((s, it) => s + it.qty, 0)} шт.)</span><span>{subtotal} грн</span></div>
            <div className={styles.row}><span>Доставка</span><span>{shipping === 0 ? 'Бесплатно' : `${shipping} грн`}</span></div>

            {appliedPromo && (
              <div className={styles.row}><span>Промокод ({appliedPromo.code})</span><span>-{promoDiscount} грн</span></div>
            )}

            <div className={styles.totalRow}><strong>Итого</strong><strong>{total} грн</strong></div>

            <div className={styles.promoLinkWrap}>
              {!promoOpen ? (
                <button className={styles.promoLink} onClick={() => setPromoOpen(true)}>У меня есть промокод</button>
              ) : (
                <form onSubmit={applyPromo} className={styles.promoForm}>
                  <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Введите промокод" aria-label="Промокод" />
                  <button type="submit" className={styles.applyBtn}>Применить</button>
                </form>
              )}
            </div>

            <button className={styles.checkoutBtn} onClick={() => alert('Перейти к оформлению — подключите маршрут/платёжную логику')}>Перейти к оформлению</button>

            <div className={styles.trustBlock}>
              <div className={styles.trustRow}>
                <div className={styles.trustIcons} aria-hidden>
                  {/* Simple inline svgs for icons */}
                  <svg width="36" height="24" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="14" rx="2" stroke="#999" fill="none"/></svg>
                  <svg width="36" height="24" viewBox="0 0 24 24"><circle cx="12" cy="8" r="2" stroke="#999" fill="none"/></svg>
                </div>
                <div className={styles.trustText}><strong>Безопасная сделка</strong><br/><a href="/delivery" className={styles.trustLink}>Условия доставки и возврата</a></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}