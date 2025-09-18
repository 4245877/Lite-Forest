// FILE: src/pages/CartPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './CartPage.module.css';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../auth/index.jsx';

const FREE_SHIPPING_THRESHOLD = 1599;
const DEFAULT_SHIPPING = 50;

export default function CartPage() {
  const { items: cart, inc, dec, remove, subtotal, checkout } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recommended] = useState([
    { id: 'demo-r-1', name: 'Набор красок, 6 шт.', image: '/assets/products/paint-set.jpg', price: 120 },
    { id: 'demo-r-2', name: 'Кисть для деталей', image: '/assets/products/brush.jpg', price: 60 },
  ]);

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [reserveSeconds, setReserveSeconds] = useState(15 * 60);

  useEffect(() => {
    const t = setInterval(() => setReserveSeconds(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

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

  function applyPromo(e) {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (code === 'SAVE50' || code === 'PERC10') {
      setAppliedPromo({ code });
      setPromoOpen(false);
    } else {
      alert('Промокод не найден');
    }
  }

  async function handleCheckout() {
    try {
      if (!user) {
        // отправим на login и вернемся назад
        navigate('/login', { replace: false, state: { from: '/cart' } });
        return;
      }
      const order = await checkout({
        shipping_method: 'pickup',
        payment_provider: 'cod',
        notes: appliedPromo ? `promo:${appliedPromo.code}` : undefined,
      });
      // можешь сделать страницу "спасибо" и перейти туда
      alert(`Заказ создан: ${order.id}`);
      navigate(`/orders/${order.id}`, { replace: false });
    } catch (e) {
      alert(e.message || 'Помилка оформлення');
    }
  }

  // Helper: format MM:SS
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
          <div className={styles.reserveNote}>
            Товары зарезервированы для вас на <strong>{reserveTimeFormatted}</strong>
          </div>
        </div>

        <div className={styles.freeShippingRow}>
          <div className={styles.progressWrap} aria-hidden>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: subtotal >= FREE_SHIPPING_THRESHOLD ? '#2b8a3e' : '#f39c12'
                }}
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
                  <img src={item.image} alt={item.name} className={styles.thumb} />
                  <div className={styles.itemBody}>
                    <Link to={`/products/${item.id}`} className={styles.itemTitle}>{item.name}</Link>
                    <div className={styles.qtyRow}>
                      <div className={styles.qtyControls}>
                        <button aria-label="Уменьшить" onClick={() => dec(item.id)} className={styles.qtyBtn}>-</button>
                        <input className={styles.qtyInput} value={item.qty} readOnly aria-label="Количество" />
                        <button aria-label="Увеличить" onClick={() => inc(item.id)} className={styles.qtyBtn}>+</button>
                      </div>
                      <div className={styles.itemPrice}>
                        {item.qty} × {item.price} грн = <strong>{item.qty * item.price} грн</strong>
                      </div>
                    </div>
                    <div className={styles.itemActions}>
                      <button onClick={() => remove(item.id)} className={styles.linkAction}>Удалить</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Upsell / recommendations (демо) */}
          <section className={styles.recoSection} aria-label="Рекомендации">
            <h3>С этим часто покупают</h3>
            <div className={styles.recoRow}>
              {recommended.map((r) => (
                <div key={r.id} className={styles.recoCard}>
                  <img src={r.image} alt={r.name} />
                  <div className={styles.recoInfo}>
                    <div className={styles.recoTitle}>{r.name}</div>
                    <div className={styles.recoPrice}>{r.price} грн</div>
                    {/* для демо — добавим прямую ссылку в каталог */}
                    <Link to="/catalog" className={styles.addBtn}>Посмотреть</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.right}>
          <div className={styles.summaryCard}>
            <h3>Сумма заказа</h3>
            <div className={styles.row}>
              <span>Товары ({cart.reduce((s, it) => s + it.qty, 0)} шт.)</span>
              <span>{subtotal} грн</span>
            </div>
            <div className={styles.row}>
              <span>Доставка</span>
              <span>{shipping === 0 ? 'Бесплатно' : `${shipping} грн`}</span>
            </div>

            {appliedPromo && (
              <div className={styles.row}>
                <span>Промокод ({appliedPromo.code})</span>
                <span>-{promoDiscount} грн</span>
              </div>
            )}

            <div className={styles.totalRow}>
              <strong>Итого</strong>
              <strong>{Math.max(0, subtotal + shipping - promoDiscount)} грн</strong>
            </div>

            <div className={styles.promoLinkWrap}>
              {!promoOpen ? (
                <button className={styles.promoLink} onClick={() => setPromoOpen(true)}>У меня есть промокод</button>
              ) : (
                <form onSubmit={applyPromo} className={styles.promoForm}>
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Введите промокод"
                    aria-label="Промокод"
                  />
                  <button type="submit" className={styles.applyBtn}>Применить</button>
                </form>
              )}
            </div>

            <button
              className={styles.checkoutBtn}
              disabled={cart.length === 0}
              onClick={handleCheckout}
            >
              Перейти к оформлению
            </button>

            <div className={styles.trustBlock}>
              <div className={styles.trustRow}>
                <div className={styles.trustIcons} aria-hidden>
                  <svg width="36" height="24" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="14" rx="2" stroke="#999" fill="none"/></svg>
                  <svg width="36" height="24" viewBox="0 0 24 24"><circle cx="12" cy="8" r="2" stroke="#999" fill="none"/></svg>
                </div>
                <div className={styles.trustText}>
                  <strong>Безопасная сделка</strong><br/>
                  <a href="/delivery" className={styles.trustLink}>Условия доставки и возврата</a>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
