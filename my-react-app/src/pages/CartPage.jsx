// FILE: src/pages/CartPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './CartPage.module.css';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../auth/index.jsx';

const FREE_SHIPPING_THRESHOLD = 1599;
const DEFAULT_SHIPPING = 50;

const cx = (...c) => c.filter(Boolean).join(' ');
const formatUAH = (n) => `${Number(n || 0).toLocaleString('uk-UA')} грн`;

export default function CartPage() {
  const { items: cart, inc, dec, remove, subtotal, checkout } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // demo-рекомендації
  const [recommended] = useState([
    { id: 'demo-r-1', name: 'Набір фарб, 6 шт.', image: '/assets/products/paint-set.jpg', price: 120 },
    { id: 'demo-r-2', name: 'Пензель для деталей', image: '/assets/products/brush.jpg', price: 60 },
  ]);

  // промокоди
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  // таймер резерву
  const [reserveSeconds, setReserveSeconds] = useState(15 * 60);
  useEffect(() => {
    const t = setInterval(() => setReserveSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // підрахунки
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
  const progressNow = Math.min(subtotal, FREE_SHIPPING_THRESHOLD);

  const totalQty = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  // тости/повідомлення
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function applyPromo(e) {
    e.preventDefault();
    setPromoError('');
    const code = promoCode.trim().toUpperCase();
    if (code === 'SAVE50' || code === 'PERC10') {
      setAppliedPromo({ code });
      setPromoOpen(false);
      setPromoCode('');
      setToast('Промокод застосовано');
    } else {
      setPromoError('Промокод не знайдено');
    }
  }

  // видалення з м’якою анімацією
  const [removingId, setRemovingId] = useState(null);
  function handleRemove(id) {
    setRemovingId(id);
    // тривалість узгоджена з CSS-анімацією
    setTimeout(() => {
      remove(id);
      setRemovingId(null);
      setToast('Товар видалено з кошика');
    }, 280);
  }

  async function handleCheckout() {
    try {
      if (!user) {
        navigate('/login', { replace: false, state: { from: '/cart' } });
        return;
      }
      const order = await checkout({
        shipping_method: 'pickup',
        payment_provider: 'cod',
        notes: appliedPromo ? `promo:${appliedPromo.code}` : undefined,
      });
      navigate(`/orders/${order.id}`, { replace: false });
    } catch (e) {
      setToast(e?.message || 'Помилка оформлення');
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
      {/* region для живих повідомлень (a11y) */}
      <div className="sr-only" aria-live="polite">
        {toast}
      </div>

      {/* Верхній мотиваційний блок */}
      <div className={styles.motivator}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Ваш кошик</h1>
          <div className={styles.reserveNote} role="status" aria-live="polite">
            {reserveSeconds > 0 ? (
              <>Товари зарезервовано для вас <strong>{reserveTimeFormatted}</strong></>
            ) : (
              <>Резерв закінчився — оформіть замовлення, щоб знову зарезервувати товари</>
            )}
          </div>
        </div>

        <div className={styles.freeShippingRow}>
          <div className={styles.progressWrap}>
            <div
              className={styles.progressBar}
              role="progressbar"
              aria-label="Прогрес до безкоштовної доставки"
              aria-valuemin={0}
              aria-valuemax={FREE_SHIPPING_THRESHOLD}
              aria-valuenow={progressNow}
            >
              <div
                className={styles.progressFill}
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: subtotal >= FREE_SHIPPING_THRESHOLD ? '#2b8a3e' : '#f39c12',
                }}
              />
            </div>
            <div className={styles.progressText} aria-live="polite">
              {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                <span>🎉 Вітаємо! Ваше замовлення буде доставлено безкоштовно!</span>
              ) : (
                <span>
                  Додайте ще на <strong>{formatUAH(amountToFree)}</strong>, щоб отримати{' '}
                  <strong>безкоштовну доставку</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Основна область */}
      <div className={styles.grid}>
        <div className={styles.left}>
          <h2 className={styles.sectionTitle}>Склад замовлення</h2>

          {cart.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Ваш кошик порожній.</p>
              <Link to="/catalog" className={styles.linkBtn}>
                Повернутись до каталогу
              </Link>
            </div>
          ) : (
            <ul className={styles.cartList}>
              {cart.map((item) => (
                <li
                  key={item.id}
                  className={cx(styles.cartItem, removingId === item.id && styles.removing)}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className={styles.thumb}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className={styles.itemBody}>
                    <Link to={`/products/${item.id}`} className={styles.itemTitle}>
                      {item.name}
                    </Link>

                    <div className={styles.qtyRow}>
                      <div
                        className={styles.qtyControls}
                        role="group"
                        aria-label={`Кількість для ${item.name}`}
                      >
                        <button
                          type="button"
                          aria-label="Зменшити кількість"
                          onClick={() => dec(item.id)}
                          className={styles.qtyBtn}
                        >
                          −
                        </button>
                        <input
                          className={styles.qtyInput}
                          value={item.qty}
                          readOnly
                          inputMode="numeric"
                          aria-label="Кількість"
                          role="spinbutton"
                          aria-valuemin={1}
                          aria-valuenow={item.qty}
                        />
                        <button
                          type="button"
                          aria-label="Збільшити кількість"
                          onClick={() => inc(item.id)}
                          className={styles.qtyBtn}
                        >
                          +
                        </button>
                      </div>

                      <div className={styles.itemPrice}>
                        {item.qty} × {formatUAH(item.price)} ={' '}
                        <strong>{formatUAH(item.qty * item.price)}</strong>
                      </div>
                    </div>

                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className={styles.linkAction}
                        aria-label={`Видалити ${item.name} з кошика`}
                      >
                        Видалити
                      </button>
                      <span className={styles.leadTime}>Готово до відправки</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Рекомендації (демо) */}
          <section className={styles.recoSection} aria-label="Рекомендації">
            <h3>З цим часто купують</h3>
            <div className={styles.recoRow}>
              {recommended.map((r) => (
                <div key={r.id} className={styles.recoCard}>
                  <img src={r.image} alt={r.name} loading="lazy" decoding="async" />
                  <div className={styles.recoInfo}>
                    <div className={styles.recoTitle}>{r.name}</div>
                    <div className={styles.recoPrice}>{formatUAH(r.price)}</div>
                    <Link to="/catalog" className={styles.addBtn} aria-label={`Дивитись ${r.name}`}>
                      Дивитись
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.right} aria-label="Підсумок замовлення">
          <div className={styles.summaryCard}>
            <h3>Сума замовлення</h3>

            <div className={styles.row}>
              <span>Товари ({totalQty} шт.)</span>
              <span>{formatUAH(subtotal)}</span>
            </div>

            <div className={styles.row}>
              <span>Доставка</span>
              <span>{shipping === 0 ? 'Безкоштовно' : formatUAH(shipping)}</span>
            </div>

            {appliedPromo && (
              <div className={styles.row}>
                <span>Промокод ({appliedPromo.code})</span>
                <span>-{formatUAH(promoDiscount)}</span>
              </div>
            )}

            <div className={styles.totalRow}>
              <strong>Разом</strong>
              <strong>{formatUAH(total)}</strong>
            </div>

            <div className={styles.promoLinkWrap}>
              {!promoOpen ? (
                <button
                  type="button"
                  className={styles.promoLink}
                  onClick={() => {
                    setPromoOpen(true);
                    setPromoError('');
                  }}
                >
                  У мене є промокод
                </button>
              ) : (
                <form onSubmit={applyPromo} className={styles.promoForm} noValidate>
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Введіть промокод"
                    aria-label="Промокод"
                    autoComplete="off"
                  />
                  <button type="submit" className={styles.applyBtn}>
                    Застосувати
                  </button>
                </form>
              )}
              {promoError && (
                <div className={styles.formError} role="alert" aria-live="assertive">
                  {promoError}
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.checkoutBtn}
              disabled={cart.length === 0}
              onClick={handleCheckout}
            >
              Перейти до оформлення
            </button>

            <div className={styles.trustBlock}>
              <div className={styles.trustRow}>
                <div className={styles.trustIcons} aria-hidden>
                  <svg width="36" height="24" viewBox="0 0 24 24" focusable="false">
                    <rect x="1" y="4" width="22" height="14" rx="2" stroke="#999" fill="none" />
                  </svg>
                  <svg width="36" height="24" viewBox="0 0 24 24" focusable="false">
                    <circle cx="12" cy="8" r="2" stroke="#999" fill="none" />
                  </svg>
                </div>
                <div className={styles.trustText}>
                  <Link to="/legal#safe-deal" className={styles.trustLink}>
                    <strong>Безпечна угода</strong>
                  </Link>
                  <br />
                  <Link to="/legal#shipping-returns" className={styles.trustLink}>
                    Умови доставки та повернення
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Тост */}
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
