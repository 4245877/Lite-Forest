// FILE: src/pages/CartPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './CartPage.module.css';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../auth/index.jsx';
import ProductFilesModal from '../components/product/ProductFilesModal.jsx';
import { selectableModelCount } from '../utils/productModels';
import { normalizeAvailabilityState, getAvailabilityLabel } from '../utils/availability';

const FREE_SHIPPING_THRESHOLD = 1599;
const DEFAULT_SHIPPING = 50;
const INITIAL_RESERVE_SECONDS = 15 * 60;
const TOAST_TIMEOUT_MS = 2500;
const REMOVE_ANIMATION_MS = 280;
const PROMO_CODE_FLAT = 'SAVE50';
const PROMO_CODE_PERCENT = 'PERC10';
const LOGIN_PATH = '/login';
const CHECKOUT_PATH = '/checkout';
const RECOMMENDED_ITEMS = [
  { id: 'demo-r-1', name: 'Набір фарб, 6 шт.', image: '/assets/products/paint-set.jpg', price: 120 },
  { id: 'demo-r-2', name: 'Пензель для деталей', image: '/assets/products/brush.jpg', price: 60 },
];

const cx = (...c) => c.filter(Boolean).join(' ');
const formatUAH = (n) => `${Number(n || 0).toLocaleString('uk-UA')} грн`;
const formatCountdown = (seconds) => {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

export default function CartPage() {
  const { items: cart, inc, dec, remove, setItemSelection, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Строка, для которой открыт выбор деталей («Змінити склад»).
  const [editItem, setEditItem] = useState(null);

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  const [reserveSeconds, setReserveSeconds] = useState(INITIAL_RESERVE_SECONDS);
  useEffect(() => {
    const t = setInterval(() => setReserveSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING;
  const isFreeShippingReached = subtotal >= FREE_SHIPPING_THRESHOLD;

  const promoDiscount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.code === PROMO_CODE_FLAT) return 50;
    if (appliedPromo.code === PROMO_CODE_PERCENT) return Math.round(subtotal * 0.1);
    return 0;
  }, [appliedPromo, subtotal]);

  const total = Math.max(0, subtotal + shipping - promoDiscount);
  const amountToFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progressPct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const progressNow = Math.min(subtotal, FREE_SHIPPING_THRESHOLD);

  const totalQty = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), TOAST_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [toast]);

  function applyPromo(e) {
    e.preventDefault();
    setPromoError('');
    const code = promoCode.trim().toUpperCase();
    if (code === PROMO_CODE_FLAT || code === PROMO_CODE_PERCENT) {
      setAppliedPromo({ code });
      setPromoOpen(false);
      setPromoCode('');
      setToast('Промокод застосовано');
    } else {
      setPromoError('Промокод не знайдено');
    }
  }

  const [removingId, setRemovingId] = useState(null);
  function handleRemove(id) {
    setRemovingId(id);
    setTimeout(() => {
      remove(id);
      setRemovingId(null);
      setToast('Товар видалено з кошика');
    }, REMOVE_ANIMATION_MS);
  }

  function handleCheckout() {
    if (!user) {
      navigate(LOGIN_PATH, {
        replace: false,
        state: { from: { pathname: CHECKOUT_PATH } },
      });
      return;
    }

    navigate(CHECKOUT_PATH, {
      replace: false,
      state: {
        promo_code: appliedPromo?.code ?? null,
      },
    });
  }

  const reserveTimeFormatted = formatCountdown(reserveSeconds);

  return (
    <div className={styles.container}>
      {/* Область для озвучення коротких повідомлень */}
      <div className={styles.srOnly} aria-live="polite">
        {toast}
      </div>

      <div className={styles.motivator}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Ваш кошик</h1>
          <div className={styles.reserveNote}>
            {reserveSeconds > 0 ? (
              <>
                Товари зарезервовано для вас <strong>{reserveTimeFormatted}</strong>
              </>
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
              aria-valuetext={
                isFreeShippingReached
                  ? 'Безкоштовна доставка активна'
                  : `Залишилось ${formatUAH(amountToFree)} до безкоштовної доставки`
              }
            >
              <div
                className={cx(styles.progressFill, isFreeShippingReached && styles.progressFillComplete)}
                style={{
                  width: `${progressPct}%`,
                }}
              />
            </div>
            <div className={styles.progressText} aria-live="polite">
              {isFreeShippingReached ? (
                <span>Безкоштовна доставка вже активна для цього замовлення.</span>
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
              {cart.map((item) => {
                const productHref = `/products/${encodeURIComponent(
                  item.product_slug ?? item.product_id ?? item.id
                )}`;

                return (
                  <li key={item.id} className={cx(styles.cartItem, removingId === item.id && styles.removing)}>
                    <img src={item.image} alt={item.name} className={styles.thumb} loading="lazy" decoding="async" />
                    <div className={styles.itemBody}>
                      <Link to={productHref} className={styles.itemTitle}>
                        {item.name}
                      </Link>

                      <div className={styles.qtyRow}>
                        <div className={styles.qtyControls} role="group" aria-label={`Кількість для ${item.name}`}>
                          <button
                            type="button"
                            aria-label="Зменшити кількість"
                            onClick={() => dec(item.id)}
                            className={styles.qtyBtn}
                            disabled={item.qty <= 1}
                          >
                            −
                          </button>
                          <span className={styles.qtyValue} aria-label={`Кількість: ${item.qty}`}>
                            {item.qty}
                          </span>
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
                          {item.qty} × {formatUAH(item.price)} = <strong>{formatUAH(item.qty * item.price)}</strong>
                        </div>
                      </div>

                      <div className={styles.itemActions}>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className={styles.linkAction}
                          aria-label={`Видалити ${item.name} з кошика`}
                          disabled={removingId === item.id}
                        >
                          Видалити
                        </button>
                        {selectableModelCount(item.models) > 1 ? (
                          <>
                            <span className={styles.partsInfo}>
                              Обрано {item.selected_model_keys?.length ?? selectableModelCount(item.models)}{' '}
                              з {selectableModelCount(item.models)} деталей
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditItem(item)}
                              className={styles.linkAction}
                              aria-label={`Змінити деталі для ${item.name}`}
                            >
                              Змінити деталі
                            </button>
                          </>
                        ) : (
                          <span className={styles.leadTime}>
                            {getAvailabilityLabel(
                              normalizeAvailabilityState(
                                item.availabilityState ?? item.availability ?? item.attributes?.availability,
                              ),
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Рекомендації */}
          <section className={styles.recoSection} aria-label="Рекомендації">
            <h3>З цим часто купують</h3>
            <div className={styles.recoRow}>
              {RECOMMENDED_ITEMS.map((r) => (
                <div key={r.id} className={styles.recoCard}>
                  <img src={r.image} alt={r.name} loading="lazy" decoding="async" />
                  <div className={styles.recoInfo}>
                    <div className={styles.recoTitle}>{r.name}</div>
                    <div className={styles.recoPrice}>{formatUAH(r.price)}</div>
                    <Link to="/catalog" className={styles.addBtn} aria-label={`Переглянути каталог: ${r.name}`}>
                      До каталогу
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

            <button type="button" className={styles.checkoutBtn} disabled={cart.length === 0} onClick={handleCheckout}>
              Перейти до оформлення
            </button>

            <div className={styles.trustBlock}>
              <div className={styles.trustRow}>
                <div className={styles.trustIcons} aria-hidden="true">
                  <svg width="36" height="24" viewBox="0 0 24 24" focusable="false">
                    <rect x="1" y="4" width="22" height="14" rx="2" stroke="currentColor" fill="none" />
                  </svg>
                  <svg width="36" height="24" viewBox="0 0 24 24" focusable="false">
                    <circle cx="12" cy="8" r="2" stroke="currentColor" fill="none" />
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

      {/* Коротке повідомлення */}
      {toast && (
        <div className={styles.toast} aria-hidden="true">
          {toast}
        </div>
      )}

      <ProductFilesModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onConfirm={(keys) => {
          if (editItem) setItemSelection(editItem.id, keys);
          setEditItem(null);
          setToast('Склад замовлення оновлено');
        }}
        models={editItem?.models ?? []}
        initialSelected={editItem?.selected_model_keys ?? null}
        fallbackImage={editItem?.image ?? ''}
        productName={editItem?.name ?? ''}
        confirmLabel="Зберегти"
      />
    </div>
  );
}